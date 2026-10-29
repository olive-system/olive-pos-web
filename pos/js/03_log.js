// ---------- 操作ログ（不正予防）：pos_audit_log に追記のみ。画面から消せない ----------
let DBLOG=false;
const logShort=(o,KJ,val,unit)=>{ const e=Object.entries(o||{}).filter(([k,v])=>v!==null&&v!==undefined&&v!==''&&!(Array.isArray(v)&&!v.length)&&k!=='table'&&k!=='reason'); e.sort((a,b)=>(a[0]==='by'?-1:0)-(b[0]==='by'?-1:0));
  const md=v=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); return m?`${+m[2]}/${+m[3]}`:String(v); }, U={amount:'円',total:'円',total_before:'円',minutes:'分',guest_count:'名'};
  return e.map(([k,v])=>{ const n=typeof v==='number'?v.toLocaleString('ja-JP')+(U[k]||''):null;
    if(k==='by') return '操作者：'+String(v).replace(/^管理サイト：/,'');
    if(k==='date'||k==='business_date') return md(v);
    if(k==='kind'&&(v==='in'||v==='out')) return v==='in'?'入金':'出金';
    if(k==='is_auto') return v?'自動延長':'手動延長';
    if(['amount','minutes','guest_count'].includes(k)&&n!=null) return n;
    if(k==='method'||k==='name'||k==='email') return val(v);
    return `${KJ[k]||k}：${n!=null?n:val(v)}`; }).join(' ／ '); }; /* 2026-10-14：内容は短く（オーナー「長い」）。金額・分・人数・日付・入金／出金は値だけ */
async function logOp(action, detail, reason, noBill){ try{ const t=noBill?null:tables.find(x=>x.id===cur?.table_id); const { error } = await sb.from('pos_audit_log').insert({store_id:store.id,bill_id:noBill?null:(cur?.id||null),action,detail:{table:t?.name||null,...detail,...(opBy&&Date.now()-opBy.at<180000?{by:opBy.name}:{})},reason:reason||null}); opBy=null; if(error) console.warn('audit',error.message); }catch(e){ console.warn('audit',e); } }
// ブラウザ標準の確認・入力ダイアログ（サイト名が出る）を使わず、画面内のダイアログで聞く
function uiDlg(msg, withInput, def){ return new Promise(res=>{ $('uiDlgMsg').textContent=msg; const inp=$('uiDlgIn'); inp.style.display=withInput?'':'none'; inp.value=def??''; inp.inputMode=(withInput&&/^\d+$/.test(String(def??'')))?'numeric':'text'; $('uiDlg').classList.add('on'); if(withInput) setTimeout(()=>{ inp.focus(); inp.select(); },50);
  const done=v=>{ $('uiDlg').classList.remove('on'); $('uiDlgOk').onclick=$('uiDlgNo').onclick=inp.onkeydown=null; res(v); };
  $('uiDlgOk').onclick=()=>done(withInput?inp.value:true); $('uiDlgNo').onclick=()=>done(withInput?null:false); inp.onkeydown=e=>{ if(e.key==='Enter'&&!e.isComposing) done(inp.value); }; }); }
const uiConfirm=msg=>uiDlg(msg,false), uiPrompt=(msg,def)=>uiDlg(msg,true,def); /* v11.88：お金が減る操作（延長・注文の削除）は理由を必ず聞く。null＝やめた（ゲネプロ #44：×1回で消え、理由も残らなかった） */ /* v11.92：お金が動く操作は「入れた人」（黒服）を選ぶ。操作ログの detail.by に入り、日報メールに出る（ゲネプロ #42・見本 オ） */ let opBy=null; const askBy=async()=>{ opBy=null; const hs=staff.filter(x=>x.kind==='hall'); if(!hs.length) return ''; const v=await uiPick('入れた人（黒服）',hs.map(h=>({label:h.display_name,value:h.display_name}))); if(!v) return null; opBy={name:v,at:Date.now()}; return v; };
 const askWhy=async msg=>{ if(await askBy()===null) return null; const w=await uiPrompt(msg+'\n理由を入力してください（必須・操作ログに残ります）',''); if(w===null) return null; if(!w.trim()){ toast('理由を入力してください'); return null; } return w.trim(); }; const uiAlert=async msg=>{ $('uiDlgNo').style.display='none'; try{ await uiDlg(msg,false); } finally { $('uiDlgNo').style.display=''; } };
// 選択肢から1つ選ぶダイアログ（キャンセルは null）
function uiPick(msg, opts){ return new Promise(res=>{ $('uiDlgMsg').textContent=msg; $('uiDlgIn').style.display='none'; let box=$('uiDlgPick'); if(!box){ box=document.createElement('div'); box.id='uiDlgPick'; box.style.cssText='display:flex;flex-direction:column;gap:8px;margin:12px 0'; $('uiDlgMsg').after(box); } box.innerHTML=opts.map((o,i)=>`<button class="ghost" data-pk="${i}" style="font-size:18px;padding:12px">${esc(o.label)}</button>`).join(''); $('uiDlgOk').style.display='none'; $('uiDlg').classList.add('on');
  const done=v=>{ $('uiDlg').classList.remove('on'); box.innerHTML=''; $('uiDlgOk').style.display=''; $('uiDlgNo').onclick=null; res(v); }; box.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>done(opts[Number(b.dataset.pk)].value)); $('uiDlgNo').onclick=()=>done(null); }); }
// v11.14・SQL 063：打刻の写真（タイムカードで撮ったもの）。在籍リストの時刻の横の📷で見る
const phBtn=p=>p?`<button class="ghost sm" data-ph="${esc(p)}" style="min-height:0;padding:0 6px;font-size:14px;border:0;background:none" aria-label="写真">${FX('camera',20)}</button>`:'';
async function showSelfie(path){ const r=await sb.storage.from('selfies').createSignedUrl(path,600); if(r.error||!r.data?.signedUrl){ toast('写真を出せません：'+(r.error?.message||'')); return; }
  const m=document.createElement('div'); m.className='modal on'; m.style.zIndex=60; m.innerHTML=`<div class="box" style="width:min(520px,94vw)"><img src="${esc(r.data.signedUrl)}" alt="" style="width:100%;border-radius:10px;display:block"><div class="bar" style="justify-content:flex-end"><button class="primary" data-x>閉じる</button></div></div>`; document.body.appendChild(m); m.querySelector('[data-x]').onclick=()=>m.remove(); }
async function askReason(title){ const r=await uiPrompt(title+'\n理由を入力してください（必須・操作ログに残ります）'); if(r===null) return null; if(!r.trim()){ toast('理由が未入力のため中止しました'); return null; } return r.trim(); }
function billEnd(b){ const ext=(b.bill_extensions||[]).reduce((a,e)=>a+e.minutes,0)+(b.ext_waived_minutes||0); return new Date(new Date(b.set_start).getTime()+(b.set_minutes+ext)*60000); }
// v11.18・SQL 067：自動延長はデータベースで伝票を押さえてから足す（POS 2台が同時に足しても二重にならない）
let extWarned=false;
async function autoExtend(){ const now=new Date(); let added=false, called=false;
  for (const b of openBills) { const mode=modes.find(m=>m.id===b.pricing_mode_id); if (mode && !mode.include_set) continue; if (billEnd(b)>=now) continue;
    const r=await sb.rpc('pos_auto_extend',{p_bill:b.id});
    if (r.error) { if(!extWarned){ extWarned=true; toast(/pos_auto_extend/.test(r.error.message)?'SQL 067 が未実行です（自動延長）':r.error.message); } continue; }
    called=true; if (r.data>0){ added=true; hallDrop(b.id); } /* v12.30：延長した伝票は計算し直す */ }
  if (called&&!added) { const { data } = await sb.from('bills').select(HALL_SEL).eq('status','open'); if (data) openBills=data; } /* v12.30：もう1台で延長済みの時は、手元の伝票を新しくする（毎分呼び続けない） */
  if (added) { const { data } = await sb.from('bills').select(HALL_SEL).eq('status','open'); if (data) openBills=data; toast('セット時間を過ぎた卓に延長を追加しました'); } }
let okiBills=[];
// v10.89：会計済でまだお返ししていないお預かり品（卓ごと）
let handTags={};
async function loadHand(){ const { data, error } = await sb.from('bill_tags').select('id,kind,tag_no,memo,bill_id,bills!inner(table_id,status)').is('returned_at',null).eq('bills.status','closed'); if(error){ console.warn('hand',error.message); return; } handTags={}; for(const t of data||[]){ const k=t.bills?.table_id; if(!k) continue; (handTags[k]=handTags[k]||[]).push(t); } }
function tagLabel(t){ return `${TAGK[t.kind]||''}${t.tag_no?' #'+esc(t.tag_no):''}${t.memo?` <small>${esc(t.memo)}</small>`:''}`; }
function openHand(t){ const tg=handTags[t.id]||[]; if(!tg.length) return; const m=document.createElement('div'); m.className='modal on'; m.style.zIndex=60;
  m.innerHTML=`<div class="box" style="width:360px;text-align:center"><div style="font-size:18px;font-weight:700">${esc(t.name)}　お預かり品</div><div style="margin:14px 0;font-size:22px;font-weight:800;line-height:1.5;text-align:left">${tg.map(x=>FX('label')+' '+tagLabel(x)).join('<br>')}</div><div class="bar" style="justify-content:flex-end"><button class="ghost" data-h="no">閉じる</button><button class="primary" data-h="ok">お渡ししました</button></div></div>`;
  document.body.appendChild(m); m.querySelector('[data-h=no]').onclick=()=>m.remove();
  const ok=m.querySelector('[data-h=ok]'); ok.onclick=async()=>{ ok.disabled=true; const { error } = await sb.from('bill_tags').update({returned_at:new Date().toISOString()}).in('id',tg.map(x=>x.id)); if(error){ toast(error.message); ok.disabled=false; return; }
    try{ await sb.from('pos_audit_log').insert({store_id:store.id,bill_id:tg[0].bill_id,action:'お預かり返却（会計後）',detail:{table:t.name,items:tg.map(x=>TAGK[x.kind]+(x.tag_no?'#'+x.tag_no:''))},reason:null}); }catch(e){ console.warn('audit',e); }
    m.remove(); toast('お渡ししました'); loadHall(); }; }
// v11.29：未入金の置きだけをデータベースで絞って読む（前は会計済の伝票を全部読んでから絞っていて、1000枚を超えると欠けた）。新しい順に100件まで（オーナーの指示）
const OKI_MAX=100;
async function loadOki(){ const SEL='id,memo,guest_count,set_start,business_date,bill_casts(staff_id,is_kakari),bill_customers(customer_id),payments!inner(method,amount,received_at)';
  let r=await sb.from('bills').select(SEL).eq('store_id',store.id).eq('status','closed').eq('payments.method','oki').gt('payments.amount',0).is('payments.received_at',null).order('business_date',{ascending:false}).order('id').limit(OKI_MAX);
  if(r.error){ console.warn('oki',r.error.message); return; } // 読めない時は、前に読んだ一覧のまま
  okiBills=(r.data||[]).filter(b=>(b.payments||[]).some(p=>p.method==='oki'&&p.amount>0&&!p.received_at)); }
function renderHall(totals){ const now=new Date(); const cnames=b=>(b.bill_customers||[]).map(c=>customers.find(x=>x.id===c.customer_id)?.name).filter(Boolean).join('・');
  const al=openBills.filter(b=>(billEnd(b)-now)<10*60000);
  $('alerts').innerHTML = al.length ? `<div class="alert">⏰ 残り10分未満：${al.map(b=>esc(tables.find(t=>t.id===b.table_id)?.name||'?')).join('、')}</div>` : '';
  $('bdHall').textContent=openBills.length;
  $('tables').innerHTML='';
  for (const t of tables.filter(t=>t.is_visible)) { const b=openBills.find(x=>x.table_id===t.id); const el=document.createElement('div'); const hd=handTags[t.id]||[];
    if (hd.length) { el.className='tbl hand'; el.innerHTML=`<div class="name">${esc(t.name)}</div><div class="hmsg">お預かり品をお返しください</div>${hd.map(x=>`<div class="hitem">${FX('label')} ${tagLabel(x)}</div>`).join('')}`; el.onclick=()=>openHand(t); }
    else if (!b) { el.className='tbl'; el.innerHTML=`<div class="name">${esc(t.name)}</div><div class="empty">空 席</div>`; el.onclick=()=>openNew(t); }
    else { const end=billEnd(b), remain=Math.round((end-now)/60000); el.className='tbl busy'+(remain<10?' over':'');
      const k=(b.bill_casts||[]).find(c=>c.is_kakari); const kn=k?staff.find(s=>s.id===k.staff_id)?.display_name:'';
      el.innerHTML=`<div class="name">${esc(t.name)}</div>${cnames(b)?`<div class="cust">${bdayLines(b).length?FX('birthdaycake')+' ':''}${esc(cnames(b))} 様</div>`:''}<div class="row"><span>${b.guest_count}名</span><span>残り ${remain<0?'-':''}${Math.abs(remain).toLocaleString()}分</span></div><div class="pill">${hm5(b.set_start)}〜${hm5(end)}</div><div class="total">${yen(totals[b.id]?.amount_due)}</div><div class="casts">${kn?'☑ '+esc(kn):''}</div>${(()=>{const n=(b.bill_tags||[]).filter(t=>!t.returned_at).length;return n?`<div class="tags">${FX('label')} お預かり ${n}</div>`:''})()}`;
      el.onclick=()=>{ billFrom='hall'; openBill(b.id); }; }
    $('tables').appendChild(el); }
  for (const b of okiBills) { const el=document.createElement('div'); const unpaid=(b.payments||[]).filter(p=>p.method==='oki'&&!p.received_at).reduce((a,p)=>a+p.amount,0);
    const k=(b.bill_casts||[]).find(c=>c.is_kakari); const kn=k?staff.find(s=>s.id===k.staff_id)?.display_name:'';
    const ml='置き'; el.className='tbl busy oki'; el.innerHTML=`<div class="name">未入金（${ml}）</div><div class="row"><span>${b.guest_count}名 ${esc(cnames(b)||b.memo||'')}</span></div><div class="row"><span>${b.business_date}</span></div><div class="total">${yen(unpaid)}</div><div class="casts">${kn?'☑ '+esc(kn):''}</div>`;
    el.onclick=()=>{ billFrom='hall'; openBill(b.id); }; $('tables').appendChild(el); }
  updateCastBadge(); }
async function updateCastBadge(){ const s=await attendedOn(businessDate()); /* v12.30：20秒の間は読んだ出勤を使う */ const act=new Set(staff.map(x=>x.id)); $('bdCasts').textContent=[...s].filter(i=>act.has(i)).length; return s; }
$('navHall').onclick=()=>{ billFrom='hall'; loadHall(); show('v-hall'); };
$('navOrder').onclick=()=>{ if(cur&&cur.status==='open'){ openOrder(); } else { toast('卓を選んでください'); loadHall(); show('v-hall'); } };

