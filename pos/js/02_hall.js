// ---------- hall ----------
const HALL_SEL='*, bill_casts(staff_id,role,is_kakari), bill_extensions(minutes,unit_price,qty,is_auto), bill_tags(id,kind,returned_at), bill_customers(customer_id)';
/* v12.30：伝票の金額（calc_bill）は伝票ごとに覚えておき、変わった伝票だけ計算し直す（前は1分ごと・知らせのたびに全部の伝票を計算していた） */
let hallTot={}, hallGen={}, hallEpoch=0, hallFullAt=0, hallOn=false;
const hallDrop=id=>{ delete hallTot[id]; hallGen[id]=(hallGen[id]||0)+1; };
const hallDropAll=()=>{ hallTot={}; hallEpoch++; };
const hallPut=(id,v)=>{ hallGen[id]=(hallGen[id]||0)+1; hallTot[id]=v; };
async function hallTotals(){ const ids=new Set(openBills.map(b=>b.id)); for(const k of Object.keys(hallTot)) if(!ids.has(k)) delete hallTot[k];
  await Promise.all(openBills.filter(b=>!(b.id in hallTot)).map(async b=>{ const g=hallGen[b.id], e=hallEpoch; const r=await sb.rpc('calc_bill',{p_bill:b.id}); if(!r.error&&hallGen[b.id]===g&&hallEpoch===e) hallTot[b.id]=r.data; })); }
/* full＝5分ごと・最初・画面に戻った時（金額も置きも全部読み直す）。{side:false}＝置き・お預かり品は読まない */
async function loadHall(o){ const full=o===true, side=full||!(o&&o.side===false);
  const { data, error } = await sb.from('bills').select(HALL_SEL).eq('status','open');
  if (error) { toast(error.message); return; }
  if(full){ hallFullAt=Date.now(); hallDropAll(); checkPwAlert(); attDrop(); } else if(cur) hallDrop(cur.id); /* この端末で触った伝票は計算し直す */
  openBills = data||[]; await autoExtend(); if(side){ await loadOki(); await loadHand(); }
  await hallTotals(); renderHall(hallTot);
}
/* 1分ごと：画面を開いている時だけ。開いている伝票の一覧は今までどおり1分ごとに読む（知らせが届かない時も、ほかの端末の新しい卓が1分で出る）。金額は変わった伝票だけ。5分ごとに全部読み直す */
async function hallTick(){ if(!store||document.visibilityState!=='visible') return; if(Date.now()-hallFullAt>=5*60000){ await loadHall(true); return; }
  if(!rtBusy()) await loadHall({side:false}); else renderHall(hallTot); }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&hallOn) loadHall(true); });
// v11.00：黒服を削除した時の警告（管理サイトでオーナーがパスワードを新しくするまで出し続ける）。パスワードが変わってこの端末のログインが使えなくなったら、ログイン画面に戻す（SQL 046）
async function checkPwAlert(){ if(!store) return; try{
  const [a,s]=await Promise.all([sb.from('admin_store_settings').select('pw_alert,pw_alert_note').eq('store_id',store.id).maybeSingle(), sb.from('stores').select('id').limit(1)]);
  if(!s.error&&!(s.data||[]).length){ await sb.auth.signOut(); await uiAlert('パスワードが変わりました。新しいパスワードでログインしてください'); location.reload(); /* v11.51：ブラウザの窓はアドレスが出るので画面の中の窓に */ return; }
  const el=$('pwAlert'); if(a.error||!a.data?.pw_alert){ el.style.display='none'; return; }
  el.innerHTML=`${FX('warningsign')} 黒服（${esc(a.data.pw_alert_note||'')}）が削除されました。オーナーは管理サイトでパスワードを更新してください`; el.style.display='block';
}catch(e){ console.warn('pwAlert',e); } }
let extOpen=false;
const snm=id=>staffAll.find(x=>x.id===id)?.display_name||staff.find(x=>x.id===id)?.display_name||'';
// 二重押し防止：処理中はボタンを止める
function guard(btn,fn){ return async(...a)=>{ if(btn.disabled) return; btn.disabled=true; try{ await fn(...a); } finally{ btn.disabled=false; } }; }
// 新しい版が公開されていたら、ホール状況を見ている時に自動で読み直す（古い画面のまま使い続けない）
const MY_VER=(document.head.innerHTML.match(/<!-- (v[\d.]+) -->/)||[])[1]||'';
async function checkVersion(){ try{ const h=await fetch(location.pathname+'?v='+Date.now(),{cache:'no-store'}).then(r=>r.text()); const v=(h.match(/<!-- (v[\d.]+) -->/)||[])[1]; if(v&&MY_VER&&v!==MY_VER&&$('v-hall').classList.contains('on')&&!document.querySelector('.modal.on')) location.reload(); }catch(e){} }
setInterval(checkVersion,5*60000);
// v10.43：自動HCのバックは、係（係専用の店・ママなどは除く）で自動的に等分する。係や客数が変わるたびに付け直す（端数は最初の係）。ほかのバックは注文時に選んだ人に付く
let hcQ=Promise.resolve(); /* 通しチェック3：同時に2回走ると HC のバックが二重になるので、順番に */
function syncHcBack(){ hcQ=hcQ.then(syncHcBack0,syncHcBack0); return hcQ; }
async function syncHcBack0(){ if(!settings.auto_hc_product_id||!cur) return; /* v12.21・SQL 279：消して入れ直すのを1つの関数で（2台同時でも二重にならない・途中で切れても消えたままにならない） */
  const r=await sb.rpc('pos_hc_sync',{p_bill:cur.id}); if(r.error) toast('HC のバックを振分できません：'+r.error.message); }
// 係小計：売上は全部係に付く（セット＋延長＋VIP代＋注文の小計価格）。係が複数なら等分。振り分けできるのはバックだけ
function kakariRows(b,T){ const ks=(b.bill_casts||[]).filter(c=>c.is_kakari).map(c=>c.staff_id);
  const total=(T.set||0)+(T.vip_set||0)+(T.extension||0)+(T.vip_ext||0)+(b.bill_items||[]).filter(i=>!i.is_void).reduce((a,i)=>a+i.cast_subtotal_price*i.qty,0);
  const nm=id=>staffAll.find(x=>x.id===id)?.display_name||staff.find(x=>x.id===id)?.display_name||'';
  if(!ks.length) return `<span style="font-size:14px">${KL}小計 <small class="muted">${KL}が未設定</small></span><span class="right" style="font-size:14px">${yen(total)}</span>`;
  return ks.map(id=>`<span style="font-size:14px">${KL}小計 ${esc(nm(id))}</span><span class="right" style="font-size:14px">${yen(Math.floor(total/ks.length))}</span>`).join(''); }
