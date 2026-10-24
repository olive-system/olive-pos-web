// ---------- pay ----------
function renderPay(){ const b=cur,T=b.totals; $('pTable').textContent=tables.find(x=>x.id===b.table_id)?.name||'';
  $('pTotals').innerHTML=`${T.mode==='industry'?'<span class="badge" style="grid-column:1/3;justify-self:start">同業（注文＋税のみ。セット・サ料・HC/BCなし）</span>':''}<span>小計</span><span class="right">${yen(T.subtotal)}</span><span>サービス料</span><span class="right">${yen(T.service)}</span><span>消費税</span><span class="right">${yen(T.tax)}</span><span>請求額</span><span class="right big">${yen(T.amount_due)}</span><span>入金済</span><span class="right">${yen(isOki(b)?T.paid-okiRemain(b):T.paid)}</span><span>未収</span><span class="right big">${yen(isOki(b)?okiRemain(b):T.unpaid)}</span>`;
  const ind=modes.find(m=>m.code==='industry'), isInd=b.pricing_mode_id===ind?.id;
  if(isOki(b)&&payMethod==='oki') payMethod='cash'; $('payMethods').innerHTML=Object.entries(METHOD).filter(([k])=>!(isOki(b)&&k==='oki')).map(([k,v])=>`<button class="chip ${payMethod===k?'on':''}" data-m="${k}">${v}</button>`).join('');
  $('payMethods').querySelectorAll('.chip[data-m]').forEach(c=>c.onclick=()=>{ if(c.dataset.m==='oki'){ closeAsOki(); return; } payMethod=c.dataset.m;renderPay();});

  $('payAmount').value=isOki(b)?okiRemain(b):(T.unpaid>0?T.unpaid:'');
  $('payAdd').textContent=payMethod==='invoice'?'請求書にする':'入金'; btRender(); splitApply();
  $('payList').innerHTML=[...(b.payments||[]).filter(p=>p.amount>0).map(p=>`<div class="item"><span class="n">${METHOD[p.method]}${p.method==='oki'?(p.received_at?` <small>入金済 ${new Date(p.received_at).getMonth()+1}/${new Date(p.received_at).getDate()}</small>`:' <small>未入金</small>'):''}${invTag(p)}</span><span class="amt">${yen(p.amount)}</span>${(isOki(b)&&p.method==='oki')||b.depPays?.has(p.id)?'':`<button class="ghost sm" data-pay="${p.id}">×</button>`}</div>`),...(b.bill_adjustments||[]).map(a=>`<div class="item"><span class="n">${a.kind==='discount'?'値引':'値増'} <small>${esc(a.reason||'')}</small></span><span class="amt">${yen(a.amount)}</span><button class="ghost sm" data-adj="${a.id}">×</button></div>`)].join('');
  /* v11.91：お釣り（現金の時だけ。入金は「金額」の欄の額で記録し、お預かりは記録しない） */ { const on=payMethod==='cash'&&!(b.status!=='open'&&!isOki(b)); $('payChange').classList.toggle('hidden',!on); $('payRecv').value=''; const calc=()=>{ const amt=parseInt($('payAmount').value||'0',10), rv=parseInt($('payRecv').value||'0',10), el=$('payChg'); if(!rv){ el.textContent='―'; el.style.color=''; return; } if(rv<amt){ el.textContent=`${yen(amt-rv)} 足りません`; el.style.color='var(--warn)'; return; } el.textContent=yen(rv-amt); el.style.color=''; }; $('payRecv').oninput=calc; $('payAmount').oninput=calc; calc(); }
  const okiP=isOki(b); const ro=b.status!=='open'&&!okiP; ['payAdd','payAdjDiscount','payAdjSurcharge','payClose'].forEach(i=>$(i).disabled=ro); $('payClose').style.display=okiP?'none':''; $('prReceipt').style.display=hasReceived(b)?'':'none'; $('payList').querySelectorAll('[data-adj],[data-pay]').forEach(x=>x.disabled=ro);
  $('payList').querySelectorAll('[data-pay]').forEach(x=>x.onclick=async()=>{ const p=(cur.payments||[]).find(z=>z.id===x.dataset.pay); if(!p||cur.depPays?.has(p.id))return; if(!await uiConfirm(`${METHOD[p.method]} ${yen(p.amount)} の入金を取り消しますか？`))return; const wasOki=isOki(cur); const r=await cashClosed(()=>sb.from('payments').delete().eq('id',p.id),`入金取消（${tblName()} ${METHOD[p.method]} ${yen(p.amount)}）`); if(r.error){ if(!r.error.cancel) toast('取り消せません：'+r.error.message); return; } if(!DBLOG) await logOp('入金取消',{method:METHOD[p.method],amount:p.amount,table:tables.find(t=>t.id===cur.table_id)?.name||null}); await openBill(cur.id); if(await okiSync(wasOki)) return; renderPay(); show('v-pay'); });
  $('payList').querySelectorAll('[data-adj]').forEach(x=>x.onclick=async()=>{ const a=(cur.bill_adjustments||[]).find(z=>z.id===x.dataset.adj); const wasOki=isOki(cur); { const dl=await sb.from('bill_adjustments').delete().eq('id',x.dataset.adj); if(dl.error){ toast('削除できません：'+dl.error.message); return; } } await logOp('値引・値増の削除',{kind:a?.kind,amount:a?.amount,reason:a?.reason}); /* 通しチェック3：削除できた時だけ記録 */ await openBill(cur.id); if(await okiSync(wasOki)) return; renderPay(); show('v-pay'); }); }
// v11.18・SQL 067：もう1台で会計・入金されていた時は登録しないで、伝票を最新にする（データベースでも止める）
const isStale=e=>/もう1台/.test(e?.message||'');
// v12.07・SQL 220：精算済みの日に現金の会計を入れようとした時は止める。「精算の取消」で精算を取り消してから入れ、閉店作業でレジ金合わせを再度（オーナー 2026-10-23「精算できないのは困るから、こんな時はもう一度レジ合わせをさせたい」）
// run は Supabase の書き込み（{error} を返す）。やめた時は {error:{cancel:true}}
async function cashClosed(run,what){ let r=await run(); const m=String(r?.error?.message||'').match(/精算済みの日は現金の会計を登録できません（(\d{4}-\d{2}-\d{2})）/); if(!m) return r;
  const dl=m[1]===businessDate()?'本日':`${+m[1].slice(5,7)}/${+m[1].slice(8,10)}`; const ok=$('uiDlgOk'); ok.textContent='精算の取消'; let yes=false;
  try{ yes=await uiConfirm(`${dl}は精算済みです\n現金の会計を登録するには、精算を取り消して、レジ金合わせを再度行います\nカードなど現金以外の会計は、このまま登録できます`); } finally{ ok.textContent='OK'; }
  if(!yes) return {error:{message:'',cancel:true}};
  const c=await sb.rpc('pos_close_cancel',{p_day:m[1],p_why:what||''}); if(c.error) return {error:c.error};
  r=await run(); if(!r.error) await uiAlert('精算を取り消しました\n閉店作業でレジ金合わせを再度行い、「精算を保存」を押してください'); return r; }
const tblName=()=>tables.find(t=>t.id===cur?.table_id)?.name||'';
async function staleReload(msg){ toast(msg); if(!cur) return; const onPay=$('v-pay').classList.contains('on'); await openBill(cur.id); if(onPay&&cur.status==='open'){ renderPay(); show('v-pay'); } }
async function stillOpen(){ const r=await sb.from('bills').select('status').eq('id',cur.id).single(); if(!r.error&&r.data?.status!=='open'){ await staleReload('もう1台で会計済です'); return false; } return true; }
let okiBusy=false; async function closeAsOki(){ if(okiBusy||!cur||cur.status!=='open') return; const un=cur.totals?.unpaid??0; if(un<=0){ toast('未収がないため、置きにする金額がありません'); return; }
  const tg=(cur.bill_tags||[]).filter(t=>!t.returned_at); if(tg.length&&!await uiConfirm(`お預かり品が ${tg.length} 点あります（${tg.map(t=>TAGK[t.kind]+(t.tag_no?'#'+t.tag_no:'')).join('、')}）。\n会計後、この卓に大きく表示されます。お渡ししたら卓をタップして「お渡ししました」を押してください。`))return;
  if(!await uiConfirm(`未収 ${yen(un)} を「置き」にして会計を終了しますか？`))return; okiBusy=true;
  try{ if(!await stillOpen()) return; const r=await sb.from('payments').insert({bill_id:cur.id,method:'oki',amount:un,revenue_date:cur.business_date,received_at:null}).select('id').single(); if(r.error){ if(isStale(r.error)){ await staleReload(r.error.message); return; } toast(r.error.message); return; } await logOp('入金',{method:METHOD.oki,amount:un});
    const { error } = await sb.from('bills').update({status:'closed',closed_at:new Date().toISOString(),set_end:billEnd(cur).toISOString()}).eq('id',cur.id); if(error){ await sb.from('payments').delete().eq('id',r.data.id); if(isStale(error)){ await staleReload(error.message); return; } toast(error.message); return; }
    await logOp('会計締め（置き）',{total:cur.totals.amount_due,oki:un,payments:[...(cur.payments||[]).filter(p=>p.amount>0).map(p=>`${METHOD[p.method]}:${p.amount}`),`${METHOD.oki}:${un}`]}); toast('置きで会計を終了しました'); payMethod='cash'; loadHall(); show('v-hall'); } finally { okiBusy=false; } }
// v11.12：値引は請求額まで（請求額より多くは引けない）
async function addAdj(kind){ const v=parseInt($('payAmount').value||'0',10); if(!v){toast('金額を入力してください');return;} if(kind==='discount'){ const due=Number(cur.totals?.amount_due||0); if(v>due){ await uiAlert(`値引は請求額（${yen(due)}）までです`); return; } } /* v11.87：値引・値増は理由を必ず聞く。未収の全額を値引きする時はそう出す（ゲネプロ #23：金額の欄が未収のままで、OK 1回で全額値引きになっていた） */ if(await askBy()===null) return; const lbl=kind==='discount'?'値引':'値増', all=kind==='discount'&&v>=Math.max(0,cur.totals?.unpaid??0); const why=await uiPrompt(`${lbl} ${yen(v)}${all?'（未収の全額です）':''}\n理由を入力してください（必須・操作ログに残ります）`,''); if(why===null) return; if(!why.trim()){ toast('理由を入力してください'); return; } const wasOki=isOki(cur); const ra=await sb.from('bill_adjustments').insert({bill_id:cur.id,kind,amount:v,reason:why.trim()}); if(ra.error){ toast(ra.error.message); return; } await logOp(lbl,{amount:v},why.trim()); await openBill(cur.id); if(await okiSync(wasOki)) return; renderPay(); show('v-pay'); }
$('payAdjDiscount').onclick=()=>addAdj('discount'); $('payAdjSurcharge').onclick=()=>addAdj('surcharge');
$('payAdd').onclick=guard($('payAdd'),async()=>{ const v=parseInt($('payAmount').value||'0',10); if(!v||v<0){toast('金額を入力してください');return;}
  const wasOki=isOki(cur); if(wasOki&&v>okiRemain(cur)){ toast(`置きの残額は ${yen(okiRemain(cur))} です`); return; }
  if(!wasOki){ const un=Math.max(0,cur.totals?.unpaid??0); if(v>un){ await uiAlert(`未収は ${yen(un)} です。これを超える入金はできません`); return; } } // v10.60：過入金は受け付けない（以前は超えた分を自動で値増にしていた）
  const inv=payMethod==='invoice', bt=inv&&billTo&&billTo.bill===cur.id?billTo:null; if(inv&&!bt){ await uiAlert('請求先を選んでください'); return; }
  if(bt&&bt.fromCust&&bt.customer_id){ const r=await sb.from('customer_bill_tos').insert({customer_id:bt.customer_id,company:bt.company,address:bt.address||null,attn:bt.attn||null}).select('id').single(); if(r.error){ await uiAlert(/customer_bill_tos/.test(r.error.message)?'SQL 171 が未実行です':r.error.message); return; } bt.id=r.data.id; bt.fromCust=false; btList.sig=''; }
  const { error } = await cashClosed(()=>sb.from('payments').insert({bill_id:cur.id,method:payMethod,amount:v,revenue_date:cur.business_date,received_at:(payMethod==='cash'||payMethod==='card')?new Date().toISOString():null,...(bt?{bill_to_id:bt.id||null,bill_to_company:bt.company,bill_to_address:bt.address||null,bill_to_attn:bt.attn||null}:{})}),`現金の会計（${tblName()} ${yen(v)}）`);
  if(error){ if(error.cancel) return; if(isStale(error)){ await staleReload(error.message); return; } toast(/bill_to/.test(error.message)?'SQL 171 が未実行です：'+error.message:error.message);return;} if(split&&split.bill===cur.id) split.done++; await logOp(wasOki?'置きの入金':inv?'請求書にする':'入金',{method:METHOD[payMethod],amount:v,...(bt?{bill_to:bt.company+(bt.attn?' '+bt.attn+' 様':'')}:{})}); await openBill(cur.id); if(await okiSync(wasOki)) return; renderPay(); show('v-pay'); });
// v11.97・SQL 171：請求先（オーナー 2026-10-19「請求の時に請求先を入力」「1人のお客様が会社を何個も持っていて、請求先が違う場合もある」「1回請求先にしたものは後で選べるように」）
// 「請求書」を押すと、伝票のお客様の請求先（前に使ったもの・顧客サイトで足したもの）が並ぶ。選ぶか新しく入れないと「請求書にする」を押せない。会計には請求先の写しを残す
let billTo=null, btList={bill:null,sig:'',rows:[]};
const btCusts=()=>(cur?.bill_customers||[]).map(x=>customers.find(c=>c.id===x.customer_id)).filter(Boolean);
async function btLoad(){ const cs=btCusts(), ids=cs.map(c=>c.id); let rows=[];
  if(ids.length){ const r=await sb.from('customer_bill_tos').select('*').in('customer_id',ids).order('last_used_on',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}); if(r.error){ toast(/customer_bill_tos/.test(r.error.message)?'SQL 171 が未実行です':r.error.message); } else rows=r.data||[]; }
  // まだ請求先が無いお客様は、顧客の「会社名・会社住所」を候補に出す（選ぶと、そのお客様の請求先として覚える）
  cs.forEach(c=>{ const co=(c.company||'').trim(); if(co&&!rows.some(x=>x.customer_id===c.id&&x.company===co)) rows.push({id:null,customer_id:c.id,company:co,address:c.company_address||'',attn:c.receipt_name||c.name,fromCust:true}); });
  btList={bill:cur.id,sig:cur.id+':'+ids.join(','),rows}; }
function btLine(x){ const many=btCusts().length>1, cn=customers.find(c=>c.id===x.customer_id)?.name; return `<b>${esc(x.company)}</b>${x.attn?`　${esc(x.attn)} 様`:''}<div class="muted" style="font-size:13px;white-space:pre-line">${esc([x.address||'',x.last_used_on?'最後 '+md(x.last_used_on):x.fromCust?'顧客の会社名から':'',many&&cn?cn+' 様の請求先':''].filter(Boolean).join('　'))}</div>`; }
async function btRender(){ const box=$('payBillTo'); if(!box) return; const on=payMethod==='invoice'&&cur&&cur.status==='open'; box.classList.toggle('hidden',!on); if(!on) return;
  const sig=cur.id+':'+btCusts().map(c=>c.id).join(','); if(btList.sig!==sig){ box.innerHTML='<div class="muted">請求先を読み込み中…</div>'; billTo=null; await btLoad(); if(payMethod!=='invoice') return; }
  const rows=btList.rows; if(billTo?.bill!==cur.id) billTo=null; if(!billTo&&rows.length) billTo={...rows[0],bill:cur.id};
  const sel=x=>billTo&&billTo.id===x.id&&billTo.company===x.company&&billTo.customer_id===x.customer_id;
  box.innerHTML=`<div class="muted" style="font-size:13px;margin-bottom:6px">請求先（押して選ぶ）</div><div style="display:flex;flex-direction:column;gap:6px">
    ${rows.map((x,i)=>`<button type="button" class="item" data-bt="${i}" style="display:block;text-align:left;width:100%;${sel(x)?'border:2px solid var(--ink)':''}">${btLine(x)}</button>`).join('')}
    ${billTo&&!rows.some(sel)?`<div class="item" style="display:block;border:2px solid var(--ink)">${btLine(billTo)}</div>`:''}
    <button type="button" class="ghost" id="btNew">＋ 新しい請求先を入れる</button></div>`;
  box.querySelectorAll('[data-bt]').forEach(e=>e.onclick=()=>{ billTo={...rows[+e.dataset.bt],bill:cur.id}; btRender(); });
  $('btNew').onclick=()=>btNew(); }
function btNew(){ const cs=btCusts(), c0=cs[0], m=document.createElement('div'); m.className='modal on'; m.style.zIndex=60;
  m.innerHTML=`<div class="box" style="width:min(480px,92vw)"><h2 style="margin:0 0 8px">新しい請求先</h2>
    <label>会社名（部署も書ける）<input data-k="company" maxlength="100" style="width:100%"></label>
    <label>住所（〒から）<textarea data-k="address" rows="3" maxlength="200" style="width:100%;font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px"></textarea></label>
    <label>宛名（様の前）<input data-k="attn" maxlength="60" style="width:100%" value="${esc(c0?.receipt_name||c0?.name||'')}"></label>
    ${cs.length>1?`<label>どのお客様の請求先として覚えるか<select data-k="cust" style="width:100%">${cs.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}<option value="">覚えない（この会計だけ）</option></select></label>`
      :cs.length?`<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" data-k="keep" checked>${esc(c0.name)} さんの請求先として覚える（次から選べる）</label>`:'<div class="muted" style="font-size:13px;margin-top:6px">伝票にお客様がいないので、この会計だけに使います</div>'}
    <div class="bar" style="justify-content:flex-end"><button class="ghost" data-k="no">戻る</button><button class="primary" data-k="ok">この請求先にする</button></div></div>`;
  document.body.appendChild(m); const q=k=>m.querySelector(`[data-k=${k}]`); q('company').focus();
  q('no').onclick=()=>m.remove();
  q('ok').onclick=guard(q('ok'),async()=>{ const company=q('company').value.trim(), address=q('address').value.trim(), attn=q('attn').value.trim(); if(!company){ await uiAlert('会社名を入れてください'); return; }
    const cid=cs.length>1?q('cust').value:(cs.length&&q('keep').checked?c0.id:''); let id=null;
    if(cid){ const r=await sb.from('customer_bill_tos').insert({customer_id:cid,company,address:address||null,attn:attn||null}).select('*').single(); if(r.error){ await uiAlert(/customer_bill_tos/.test(r.error.message)?'SQL 171 が未実行です':r.error.message); return; } id=r.data.id; btList.rows.unshift(r.data); await logOp('請求先を足す',{customer:customers.find(c=>c.id===cid)?.name,company}); }
    billTo={id,customer_id:cid||null,company,address,attn,bill:cur.id}; m.remove(); btRender(); }); }
// v11.99：割り勘（ゲネプロ #57。オーナー 2026-10-19「足す」）。未収を人数で割った1人分を金額の欄に入れる。割り切れない分は最後の人で合わせる。入金するたびに「あと n人」を出す
let split=null;
function splitApply(){ const b=cur, un=Math.max(0,b?.totals?.unpaid??0), open=b&&b.status==='open'&&!isOki(b); $('paySplit').style.display=open&&un>0?'':'none';
  if(!split||split.bill!==b?.id||!open||un<=0||split.done>=split.n){ split=null; $('paySplitNote').classList.add('hidden'); return; }
  const k=split.n-split.done; $('payAmount').value=k===1?un:Math.min(split.per,un);
  $('paySplitTxt').innerHTML=`割り勘 ${split.n}人：あと <b>${k}人</b>・${yen(un)}`; $('paySplitNote').classList.remove('hidden'); }
$('paySplit').onclick=()=>{ const un=Math.max(0,cur?.totals?.unpaid??0); if(!un) return; const m=document.createElement('div'); m.className='modal on'; m.style.zIndex=60;
  m.innerHTML=`<div class="box" style="width:min(460px,92vw)"><h2 style="margin:0 0 6px">人数で割る</h2><div class="muted">未収 ${yen(un)}</div>
    <div class="chips" style="margin:12px 0">${[2,3,4,5,6,7,8,9,10].map(n=>`<button class="chip" data-n="${n}">${n}人</button>`).join('')}</div><div id="spOut" style="min-height:1.6em;font-size:18px"></div>
    <div class="bar" style="justify-content:flex-end"><button class="ghost" data-k="no">やめる</button><button class="primary" data-k="ok" disabled>この金額にする</button></div></div>`;
  document.body.appendChild(m); let n=0; const per=x=>Math.floor(un/x);
  m.querySelectorAll('[data-n]').forEach(c=>c.onclick=()=>{ n=+c.dataset.n; m.querySelectorAll('[data-n]').forEach(z=>z.classList.toggle('on',z===c)); const p=per(n), last=un-p*(n-1); m.querySelector('#spOut').innerHTML=`${n}人：1人 <b>${yen(p)}</b>${last!==p?`（最後の人 ${yen(last)}）`:''}`; m.querySelector('[data-k=ok]').disabled=false; });
  m.querySelector('[data-k=no]').onclick=()=>m.remove();
  m.querySelector('[data-k=ok]').onclick=()=>{ if(!n) return; split={bill:cur.id,n,per:per(n),done:0}; m.remove(); splitApply(); }; };
$('paySplitEnd').onclick=()=>{ split=null; renderPay(); };
$('payBack').onclick=()=>openBill(cur.id);
$('payClose').onclick=guard($('payClose'),async()=>{ if(cur.totals.unpaid>0){toast(`未収 ${yen(cur.totals.unpaid)} があります。請求書か置きで登録してください`);return;}
  const tg=(cur.bill_tags||[]).filter(t=>!t.returned_at); if(tg.length&&!await uiConfirm(`お預かり品が ${tg.length} 点あります（${tg.map(t=>TAGK[t.kind]+(t.tag_no?'#'+t.tag_no:'')).join('、')}）。\n会計後、この卓に大きく表示されます。お渡ししたら卓をタップして「お渡ししました」を押してください。`))return;
  if(!await uiConfirm(`請求額 ${yen(cur.totals.amount_due)} で会計を締めます。\n締めた後は変更できません。`))return;
  if(!await stillOpen()) return;
  const { error } = await sb.from('bills').update({status:'closed',closed_at:new Date().toISOString(),set_end:billEnd(cur).toISOString()}).eq('id',cur.id); if(error){ if(isStale(error)){ await staleReload(error.message); return; } toast(error.message); return; } await logOp('会計締め',{total:cur.totals.amount_due,payments:(cur.payments||[]).filter(p=>p.amount>0).map(p=>`${METHOD[p.method]}:${p.amount}`)}); toast('会計を締めました'); loadHall(); show('v-hall'); });

// v11.11・SQL 060：店名・住所・電話・メール・インボイス番号・領収書メールの宛先は管理サイト「POS設定」の店の情報で変える（POS では変えない。領収書・閉店作業はそれを読む）
