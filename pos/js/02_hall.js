// ---------- hall ----------
const HALL_SEL='*, bill_casts(staff_id,role,is_kakari), bill_extensions(minutes,unit_price,qty,is_auto), bill_tags(id,kind,returned_at), bill_customers(customer_id)';
async function loadHall(){
  const { data, error } = await sb.from('bills').select(HALL_SEL).eq('status','open');
  if (error) { toast(error.message); return; }
  checkPwAlert(); openBills = data||[]; await autoExtend(); await loadOki(); await loadHand();
  const totals={}; await Promise.all(openBills.map(async b=>{ const r=await sb.rpc('calc_bill',{p_bill:b.id}); totals[b.id]=r.data; }));
  renderHall(totals);
}
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
