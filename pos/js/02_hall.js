// ---------- hall ----------
const HALL_SEL='*, bill_casts(staff_id,role,is_kakari), bill_extensions(minutes,unit_price,qty,is_auto), bill_tags(id,kind,returned_at), bill_customers(customer_id)';
/* 伝票の金額（calc_bill）は伝票ごとに覚えておき、変わった伝票だけ計算し直す（前は1分ごと・知らせのたびに全部の伝票を計算していた） */
let hallTot={}, hallGen={}, hallEpoch=0, hallFullAt=0; S.hallOn=false;
const hallDrop=id=>{ delete hallTot[id]; hallGen[id]=(hallGen[id]||0)+1; };
const hallDropAll=()=>{ hallTot={}; hallEpoch++; };
const hallPut=(id,v)=>{ hallGen[id]=(hallGen[id]||0)+1; hallTot[id]=v; };
async function hallTotals(){ const ids=new Set(S.openBills.map(b=>b.id)); for(const k of Object.keys(hallTot)) if(!ids.has(k)) delete hallTot[k];
  await Promise.all(S.openBills.filter(b=>!(b.id in hallTot)).map(async b=>{ const g=hallGen[b.id], e=hallEpoch; const r=await sb.rpc('calc_bill',{p_bill:b.id}); if(!r.error&&hallGen[b.id]===g&&hallEpoch===e) hallTot[b.id]=r.data; })); }
/* full＝5分ごと・最初・画面に戻った時（金額も置きも全部読み直す）。{side:false}＝置き・お預かり品は読まない */
let hallSeq=0;
async function loadHall(o){ const full=o===true, side=full||!(o&&o.side===false), seq=++hallSeq;
  const { data, error } = await sb.from('bills').select(HALL_SEL).eq('status','open');
  if(seq!==hallSeq){ if(full) hallFullAt=0; return; } /* 1分ごと・知らせ・画面に戻った時の読み直しが重なった時は、後から頼んだ方だけ使う（古い返事が後に着くと、新しい卓が出なかった） */
  if (error) { toast(error.message); return; }
  if(full){ hallFullAt=Date.now(); hallDropAll(); checkPwAlert(); attDrop(); } else if(S.cur) hallDrop(S.cur.id); /* この端末で触った伝票は計算し直す */
  S.openBills = data||[]; await autoExtend(); await Promise.all([side?loadOki():null, side?loadHand():null, hallTotals()]); /* 置き・お預かり品・金額は互いに使わないので同時に読む（前は1つずつ待ち、開くのが遅かった） */
  renderHall(hallTot);
}
/* 1分ごと：画面を開いている時だけ。開いている伝票の一覧は今までどおり1分ごとに読む（知らせが届かない時も、ほかの端末の新しい卓が1分で出る）。金額は変わった伝票だけ。5分ごとに全部読み直す */
async function hallTick(){ if(!S.store||document.visibilityState!=='visible') return; if(await posTermLost()) return; /* 点検 1分ごとに端末のログインと合鍵を確かめる */ if(Date.now()-hallFullAt>=5*60000){ await loadHall(true); return; }
  if(!rtBusy()) await loadHall({side:false}); else renderHall(hallTot); }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&S.hallOn) loadHall(true); });
// 黒服を削除した時の警告（管理サイトでオーナーがパスワードを新しくするまで出し続ける）。パスワードが変わってこの端末のログインが使えなくなったら、ログイン画面に戻す
async function checkPwAlert(){ if(!S.store) return; try{
  const [a,s]=await Promise.all([sb.from('admin_store_settings').select('pw_alert,pw_alert_note').eq('store_id',S.store.id).maybeSingle(), sb.from('stores').select('id').limit(1)]);
  if(!s.error&&!(s.data||[]).length){ await sb.auth.signOut(); await uiAlert('パスワードが変わりました。新しいパスワードでログインしてください'); location.reload(); /* ブラウザの窓はアドレスが出るので画面の中の窓に */ return; }
  const el=$('pwAlert'); if(a.error||!a.data?.pw_alert){ el.style.display='none'; return; }
  el.innerHTML=`${FX('warningsign')} 黒服（${esc(a.data.pw_alert_note||'')}）が退店しました。オーナーは管理サイトでパスワードを更新してください`; el.style.display='block';
}catch(e){ console.warn('pwAlert',e); } }
S.extOpen=false;
// 二重押し防止：処理中はボタンを止める
// 新しい版が公開されていたら、ホール状況を見ている時に自動で読み直す（古い画面のまま使い続けない）
const MY_VER=(document.head.innerHTML.match(/<!-- (v[\d.]+) -->/)||[])[1]||'';
async function checkVersion(){ try{ const h=await fetch(location.pathname+'?v='+Date.now(),{cache:'no-store'}).then(r=>r.text()); const v=(h.match(/<!-- (v[\d.]+) -->/)||[])[1]; if(v&&MY_VER&&v!==MY_VER&&$('v-hall').classList.contains('on')&&!document.querySelector('.modal.on')) location.reload(); }catch(e){} }
setInterval(checkVersion,5*60000);
// 自動HCのバックは、係（係専用の店・ママなどは除く）で自動的に等分する。係や客数が変わるたびに付け直す（端数は最初の係）。ほかのバックは注文時に選んだ人に付く
let hcQ=Promise.resolve(); /* 通しチェック3：同時に2回走ると HC のバックが二重になるので、順番に */
/* id を渡すと、その伝票を振り分ける（渡さない時は、順番が来た時に開いている伝票） */
function syncHcBack(id){ const f=()=>syncHcBack0(id); hcQ=hcQ.then(f,f); return hcQ; }
async function syncHcBack0(id){ id=id||S.cur?.id; if(!S.settings.auto_hc_product_id||!id) return; /* 消して入れ直すのを1つの関数で（2台同時でも二重にならない・途中で切れても消えたままにならない） */
  const r=await sb.rpc('pos_hc_sync',{p_bill:id}); if(r.error) toast('HC のバックを振分できません：'+r.error.message); }
// 係小計：売上は全部係に付く（セット＋延長＋VIP代＋注文の小計価格）。係が複数なら等分。振り分けできるのはバックだけ
function kakariRows(b,T){ const ks=(b.bill_casts||[]).filter(c=>c.is_kakari).map(c=>c.staff_id);
  const total=(T.set||0)+(T.vip_set||0)+(T.extension||0)+(T.vip_ext||0)+(b.bill_items||[]).filter(i=>!i.is_void).reduce((a,i)=>a+i.cast_subtotal_price*i.qty,0);
  const nm=id=>S.staffAll.find(x=>x.id===id)?.display_name||S.staff.find(x=>x.id===id)?.display_name||'';
  if(!ks.length) return `<span style="font-size:14px">${KL}小計 <small class="muted">${KL}が未設定</small></span><span class="right" style="font-size:14px">${yen(total)}</span>`;
  return ks.map(id=>`<span style="font-size:14px">${KL}小計 ${esc(nm(id))}</span><span class="right" style="font-size:14px">${yen(Math.floor(total/ks.length))}</span>`).join(''); }
// ---------- ホールの卓の一覧（自動延長・お預かり品・置き・在籍のしるし） ----------
// 自動延長はデータベースで伝票を押さえてから足す（POS 2台が同時に足しても二重にならない）
let extWarned=false;
async function autoExtend(){ const now=new Date(); let added=false, called=false;
  for (const b of S.openBills) { const mode=S.modes.find(m=>m.id===b.pricing_mode_id); if (mode && !mode.include_set) continue; if (billEnd(b)>=now) continue;
    const r=await sb.rpc('pos_auto_extend',{p_bill:b.id});
    if (r.error) { if(!extWarned){ extWarned=true; toast(/pos_auto_extend/.test(r.error.message)?'SQL 067 が未実行です（自動延長）':r.error.message); } continue; }
    called=true; if (r.data>0){ added=true; hallDrop(b.id); } /* 延長した伝票は計算し直す */ }
  if (called&&!added) { const { data } = await sb.from('bills').select(HALL_SEL).eq('status','open'); if (data) S.openBills=data; } /* もう1台で延長済みの時は、手元の伝票を新しくする（毎分呼び続けない） */
  if (added) { const { data } = await sb.from('bills').select(HALL_SEL).eq('status','open'); if (data) S.openBills=data; toast('セット時間を過ぎた卓に延長を追加しました'); } }
let okiBills=[];
// 会計済でまだお返ししていないお預かり品（卓ごと）
let handTags={};
async function loadHand(){ const { data, error } = await sb.from('bill_tags').select('id,kind,tag_no,memo,bill_id,bills!inner(table_id,status)').is('returned_at',null).eq('bills.status','closed'); if(error){ console.warn('hand',error.message); return; } handTags={}; for(const t of data||[]){ const k=t.bills?.table_id; if(!k) continue; (handTags[k]=handTags[k]||[]).push(t); } }
function tagLabel(t){ return `${TAGK[t.kind]||''}${t.tag_no?' #'+esc(t.tag_no):''}${t.memo?` <small>${esc(t.memo)}</small>`:''}`; }
function openHand(t){ const tg=handTags[t.id]||[]; if(!tg.length) return; const m=mkModal(60);
  m.innerHTML=`<div class="box" style="width:360px;text-align:center"><button class="xb dx" data-h="no" aria-label="閉じる">×</button><div style="font-size:18px;font-weight:700">${esc(t.name)}　お預かり品</div><div style="margin:14px 0;font-size:22px;font-weight:800;line-height:1.5;text-align:left">${tg.map(x=>FX('label')+' '+tagLabel(x)).join('<br>')}</div><div class="bar" style="justify-content:flex-end"><button class="primary" data-h="ok">お渡ししました</button></div></div>`;
  document.body.appendChild(m); m.querySelector('[data-h=no]').onclick=()=>m.remove();
  const ok=m.querySelector('[data-h=ok]'); ok.onclick=async()=>{ ok.disabled=true; const { error } = await sb.rpc('pos_tag_return',{p_ids:tg.map(x=>x.id)}); if(error){ toast(error.message); ok.disabled=false; return; }
    try{ await sb.rpc('pos_log_add',{p_store:S.store.id,p_bill:tg[0].bill_id,p_action:'お預かり返却（会計後）',p_detail:{table:t.name,items:tg.map(x=>TAGK[x.kind]+(x.tag_no?'#'+x.tag_no:''))},p_reason:null}); }catch(e){ console.warn('audit',e); }
    m.remove(); toast('お渡ししました'); loadHall(); }; }
// 未入金の置きだけをデータベースで絞って読む（前は会計済の伝票を全部読んでから絞っていて、1000枚を超えると欠けた）。新しい順に100件まで（オーナーの指示）
const OKI_MAX=100;
async function loadOki(){ const SEL='id,memo,guest_count,set_start,business_date,bill_casts(staff_id,is_kakari),bill_customers(customer_id),payments!inner(method,amount,received_at)';
  let r=await sb.from('bills').select(SEL).eq('store_id',S.store.id).eq('status','closed').eq('payments.method','oki').gt('payments.amount',0).is('payments.received_at',null).order('business_date',{ascending:false}).order('id').limit(OKI_MAX);
  if(r.error){ console.warn('oki',r.error.message); return; } // 読めない時は、前に読んだ一覧のまま
  okiBills=(r.data||[]).filter(b=>(b.payments||[]).some(p=>p.method==='oki'&&p.amount>0&&!p.received_at)); }
function renderHall(totals){ const now=new Date(); const cnames=b=>(b.bill_customers||[]).map(c=>S.customers.find(x=>x.id===c.customer_id)?.name).filter(Boolean).join('・');
  const al=S.openBills.filter(b=>(billEnd(b)-now)<10*60000);
  $('alerts').innerHTML = al.length ? `<div class="alert">⏰ 残り10分未満：${al.map(b=>esc(billTable(b)||'?')).join('、')}</div>` : '';
  $('bdHall').textContent=S.openBills.length;
  $('tables').innerHTML='';
  for (const t of S.tables.filter(t=>t.is_visible)) { const b=S.openBills.find(x=>x.table_id===t.id); const el=document.createElement('div'); const hd=handTags[t.id]||[];
    if (hd.length) { el.className='tbl hand'; el.innerHTML=`<div class="name">${esc(t.name)}</div><div class="hmsg">お預かり品をお返しください</div>${hd.map(x=>`<div class="hitem">${FX('label')} ${tagLabel(x)}</div>`).join('')}`; el.onclick=()=>openHand(t); }
    else if (!b) { el.className='tbl'; el.innerHTML=`<div class="name">${esc(t.name)}</div><div class="empty">空 席</div>`; el.onclick=()=>openNew(t); }
    else { const end=billEnd(b), remain=Math.round((end-now)/60000); el.className='tbl busy'+(remain<10?' over':'');
      const k=(b.bill_casts||[]).find(c=>c.is_kakari); const kn=k?S.staff.find(s=>s.id===k.staff_id)?.display_name:'';
      el.innerHTML=`<div class="name">${esc(t.name)}</div>${cnames(b)?`<div class="cust">${bdayLines(b).length?FX('birthdaycake')+' ':''}${esc(cnames(b))} 様</div>`:''}<div class="row"><span>${b.guest_count}名</span><span>残り ${remain<0?'-':''}${Math.abs(remain).toLocaleString()}分</span></div><div class="pill">${hm5(b.set_start)}〜${hm5(end)}</div><div class="total">${yen(totals[b.id]?.amount_due)}</div><div class="casts">${kn?'☑ '+esc(kn):''}</div>${(()=>{const n=(b.bill_tags||[]).filter(t=>!t.returned_at).length;return n?`<div class="tags">${FX('label')} お預かり ${n}</div>`:''})()}`;
      el.onclick=()=>{ S.billFrom='hall'; openBill(b.id); }; }
    $('tables').appendChild(el); }
  for (const b of okiBills) { const el=document.createElement('div'); const unpaid=(b.payments||[]).filter(p=>p.method==='oki'&&!p.received_at).reduce((a,p)=>a+p.amount,0);
    const k=(b.bill_casts||[]).find(c=>c.is_kakari); const kn=k?S.staff.find(s=>s.id===k.staff_id)?.display_name:'';
    const ml='置き'; el.className='tbl busy oki'; el.innerHTML=`<div class="name">未入金（${ml}）</div><div class="row"><span>${b.guest_count}名 ${esc(cnames(b)||b.memo||'')}</span></div><div class="row"><span>${b.business_date}</span></div><div class="total">${yen(unpaid)}</div><div class="casts">${kn?'☑ '+esc(kn):''}</div>`;
    el.onclick=()=>{ S.billFrom='hall'; openBill(b.id); }; $('tables').appendChild(el); }
  updateCastBadge(); }
async function updateCastBadge(){ const s=await attendedOn(businessDate()); /* 20秒の間は読んだ出勤を使う */ const act=new Set(S.staff.map(x=>x.id)); $('bdCasts').textContent=[...s].filter(i=>act.has(i)).length; return s; }
$('navHall').onclick=()=>{ S.billFrom='hall'; loadHall(); show('v-hall'); };
$('navOrder').onclick=()=>{ if(S.cur&&S.cur.status==='open'){ openOrder(); } else { toast('卓を選んでください'); loadHall(); show('v-hall'); } };
