// ---------- 閉店作業の画面（①〜⑤・精算の差・月の一覧）。② の領収書精算は 19_close_receipt.js ----------
// v12.06・SQL 209：マイページの閉店作業（完了・作業中）。黒服マイページで開始・保存する
// v12.37：右の状態は「名前 時刻 完了」「名前 作業中」の順にして、完了・作業中の位置をそろえる（オーナー 2026-10-30「完了の位置がずれている。気持ち悪い」）
function clMpHtml(L,H){ const nil=x=>x.kind==='todo'&&!x.todo_open&&!x.todo_all, n=L.filter(x=>x.status==='done'&&!nil(x)).length;
  return `${H(`⑤ マイページの閉店作業　<small class="muted" style="font-weight:400">完了 ${n}／${L.filter(x=>!nil(x)).length}</small>`)}<div id="clMp" class="list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));column-gap:18px">${L.map(x=>`<div class="item"><span class="n">${esc(x.name)}</span>${nil(x)?'<span class="muted">なし</span>':x.status==='done'?`<b style="color:var(--ok);white-space:nowrap">${x.kind==='todo'?'':`${esc(x.by||'')} ${x.at?hmJst(x.at):''} `}完了</b>`:x.kind==='todo'?`<b style="color:var(--warn)">未完了 ${x.todo_open}</b>`:x.wip_by?`<b style="background:var(--gold-soft);border-radius:6px;padding:2px 7px;white-space:nowrap">${esc(x.wip_by)} 作業中</b>`:'<b style="color:var(--warn)">未完了</b>'}</div>`).join('')||'<div class="muted">項目がありません</div>'}</div>
  <div class="muted" style="font-size:13px;margin-top:6px">黒服マイページの「閉店作業」で開始・保存します。全部完了で精算できます</div>`; }
async function renderClosing(){ const today=businessDate(); if(!clDate){ clDate=today; } if(!clMonth) clMonth=clDate.slice(0,7); const d=clDate; const box=$('setList'); box.innerHTML='<div class="muted">読み込み中…</div>'; const [from,to]=clRange(d);
  const K=await clPrep(d,today,box,await clFetch(d,from,to)); if(!K) return;
  K.bottles=await clBottles(K.custIds); if(setCur!=='closing') return;
  const nm=id=>staffAll.find(x=>x.id===id)?.display_name||staff.find(x=>x.id===id)?.display_name||''; const cn=id=>customers.find(c=>c.id===id)?.name||''; const H=t=>`<h2 style="margin:18px 0 8px">${t}</h2>`; Object.assign(K,{from,to,nm,cn,H,cnt:K.saved?(K.saved.counts||{}):clCounts}); K.clOldMid=clHtmlOld(K);
  box.innerHTML=clHtml1(K)+clHtml2(K)+clHtml3(K)+clHtml4(K);
  clBindA(K); clBindB(K); clDayMemo(K); clBindReq(K); clBindSave(K); clAfter(K); }
/* その日の現金の動き・精算・お客様・メモの申請・お酒・後の日の精算・マイページの閉店作業・TODO を読む */
function clFetch(d,from,to){ return Promise.all([
    sbAll(()=>sb.from('cash_movements').select('*').eq('store_id',store.id).eq('business_date',d).order('created_at').order('id')), /* v12.30：1000行で切れないように分けて読む・店はデータベースで絞る */
    sbAll(()=>sb.from('daily_advances').select('staff_id,amount').eq('store_id',store.id).eq('business_date',d).order('id')),
    sbAll(()=>sb.from('payments').select('amount,bills!inner(status,store_id)').eq('method','cash').eq('bills.store_id',store.id).gte('paid_at',from).lt('paid_at',to).order('id')),
    sb.from('register_closings').select('*').eq('store_id',store.id).eq('business_date',d).maybeSingle(),
    sb.from('register_closings').select('business_date,next_float').eq('store_id',store.id).lt('business_date',d).order('business_date',{ascending:false}).limit(1),
    sb.from('bill_customers').select('customer_id,bills!inner(business_date,status,store_id)').eq('bills.business_date',d),
    sb.from('customer_note_requests').select('*').eq('store_id',store.id).eq('status','pending').order('created_at'),
    sb.from('bill_items').select('product_id,name,qty,category_id,bills!inner(business_date,status,store_id)').eq('bills.business_date',d).eq('bills.store_id',store.id).neq('bills.status','void').eq('is_void',false),
    sb.from('register_closings').select('business_date').eq('store_id',store.id).gt('business_date',d).limit(1),
    sb.rpc('pos_close_tasks',{p_day:d}), sb.rpc('pos_todos',{p_day:d}) ]); }
/* 読んだものから、入金・出金・日払・現金売上・前回の精算・未精算の日を出す。読めない時は箱に出して null */
async function clPrep(d,today,box,R){ const [mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl]=R;
  /* v12.06・SQL 209：閉店作業をマイページでする店は、②〜⑦・⑨をマイページへ（v12.22 から ② 出退勤確認・③ マイページの閉店作業・④ レジ金合わせ）。ここは完了・作業中の一覧（全部完了でないと精算できない。オーナー 2026-10-23） */
  const mp=!ctk.error&&ctk.data?.on, mpL=mp?(ctk.data.items||[]):[]; mpL.forEach(x=>{ if(x.kind==='todo') x.todo_all=tdl.error?1:(tdl.data||[]).length; }); /* TODO が1件も無い日（休みの日など）は「完了」ではなく「なし」と出す（終わらせた人がいないのに完了に見えるため） */
  if(setCur!=='closing') return;
  if(mv.error||cls.error){ box.innerHTML=`<div class="muted">SQL 018 が未適用の可能性があります：${esc((mv.error||cls.error).message)}</div>`; return; }
  { const e=[adv,pay,prev,lat,ctk].find(x=>x.error); if(e){ box.innerHTML=`<div class="muted">閉店作業を読み込めません。再度開いてください：${esc(e.error.message)}</div>`; return; } } /* 通しチェック3：日払い・現金売上が読めないと0円のまま精算できた */
  const moves=mv.data||[]; const outSum=moves.filter(m=>m.kind==='out').reduce((a,m)=>a+m.amount,0), inSum=moves.filter(m=>m.kind==='in').reduce((a,m)=>a+m.amount,0);
  const advRows=(adv.data||[]).filter(a=>a.amount>0); const advSum=advRows.reduce((a,x)=>a+x.amount,0);
  const cashSales=(pay.data||[]).filter(p=>p.bills&&p.bills.store_id===store.id&&p.bills.status!=='void').reduce((a,p)=>a+(p.amount||0),0);
  const saved=cls.data||null; const prevRow=(prev.data||[])[0]||null; const hasPrev=!!prevRow;
  // v10.43：前回の精算から今日までに未精算の日があれば、その日の現金の動きも本日釣銭に含める（未精算の日のお金はレジに残っているため）。後の日の精算がある日・未来の日は保存できない
  const gp=(!saved&&prevRow)?await clGap(prevRow.business_date,d):{net:0,days:[]}; if(setCur!=='closing'||clDate!==d) return; if(gp.error){ box.innerHTML=`<div class="muted">閉店作業を読み込めません。再度開いてください：${esc(gp.error.message)}</div>`; return; } const later=(lat.data||[]).length>0, future=d>today;
  clCtx={d,outSum,inSum,advSum,cashSales,saved,hasPrev,prevFloat:prevRow?prevRow.next_float+gp.net:0}; const clIdle=!saved&&d<today&&!outSum&&!inSum&&!advSum&&!cashSales; // v10.43：休みなどで動きがない過去の日は「精算済（変動なし自動繰越）」
  const custIds=[...new Set((bc.data||[]).filter(x=>x.bills&&x.bills.store_id===store.id&&x.bills.status!=='void').map(x=>x.customer_id))];
  return {d,today,box,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds}; }
/* 今日ご来店のお客様のキープボトル（共同のお客様のボトルも） */
async function clBottles(custIds){ let bottles=[]; if(custIds.length){ const sh=await sb.from('customer_bottle_shares').select('bottle_id').in('customer_id',custIds); const sid=sh.error?[]:(sh.data||[]).map(x=>x.bottle_id); /* v12.40・SQL 306：共同のお客様が来た日も、そのボトルを出す */ const bt=await sb.from('customer_bottles').select('*').or(`customer_id.in.(${custIds.join(',')})`+(sid.length?`,id.in.(${sid.join(',')})`:'')).eq('is_finished',false); bottles=(bt.data||[]).filter(b=>!b.expired_on); } return bottles; }
/* 画面の形（④〜⑨ はマイページで閉店作業をしない店だけ） */
function clHtmlOld(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K; return mp?'':`  ${H('④ ボトル残量（今日ご来店のお客様のキープボトル）')}
  <div class="list">${bottles.map(b=>`<div class="item"><span class="n">${esc(b.name)}<br><small>${esc(cn(b.customer_id))} 様${esc(knLabel(b,cn(b.customer_id)))}</small></span><select data-clrem="${b.id}">${[10,9,8,7,6,5,4,3,2,1,0].map(n=>`<option value="${n}" ${b.remaining===n?'selected':''}>${n}/10</option>`).join('')}</select></div>`).join('')||'<div class="muted">該当なし（伝票に「＋お客様」で登録された方のボトルが出ます）</div>'}</div>
  ${H('⑤ 顧客メモの更新申請')}
  ${rq.error?`<div class="muted">${esc(rq.error.message)}</div>`:`<div class="list">${(rq.data||[]).map(r=>`<div class="item" style="flex-wrap:wrap;gap:6px"><span class="n" style="flex:1 1 100%">${esc(cn(r.customer_id))} 様　<small>${esc(reqMd(r.business_date))}　${esc(nm(r.author_staff_id))}</small><br><span style="white-space:pre-wrap">${esc(r.body)}</span></span><button class="ok sm" data-clrqok="${r.id}">メモに追記</button><button class="ghost sm" data-clrqno="${r.id}">却下</button></div>`).join('')||'<div class="muted">申請なし</div>'}</div>`}
  ${H('⑥ '+KL+'・同伴・反応◎の確認')}
  <div id="clChk"><div class="muted">読み込み中…</div></div>
  <div id="clKmBox"></div>
  ${H('⑧ 今日出たお酒・ドリンク（発注用）')}
  ${clOrderHtml(od)}
  ${H('⑨ TODO')}<div id="clTodo" style="flex-shrink:0;margin-bottom:12px"><div class="muted">読み込み中…</div></div>`; }
function clHtml1(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K; return `<div id="clWarn"></div><div id="clAhead"></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:18px">閉店作業</b><input type="date" id="clDateIn" value="${d}"><span class="badge ${saved||clIdle?'k':'warnb'}">${saved?'精算済':clIdle?'（変動なし自動繰越）':'未精算'}</span></div>
  <div id="clRe"></div>
  ${H('① お客様登録')}<div id="clReg"><div class="muted">読み込み中…</div></div>
  ${H('② 入出金の登録（経費の現金払い・立替など）')}<div id="clMvTop"></div>
  ${saved?'<div class="muted" style="margin-bottom:6px">精算済のため変更できません</div>':`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><input type="hidden" id="clKind" value="out"><div class="clseg"><button type="button" data-clk="out" class="on">出金</button><button type="button" data-clk="in">入金</button></div><select id="clMemoSel" style="width:200px"></select><input id="clMemo" placeholder="内容を入力" style="flex:1;min-width:160px;display:none"><input id="clAmt" type="number" inputmode="numeric" placeholder="金額" style="width:130px;text-align:right"><button class="ok sm" id="clAdd">追加</button><label class="cllb" id="clShot" style="display:none">撮影<input type="file" accept="image/*" capture="environment" style="display:none"></label></div>`}
  <div class="clmv">${moves.map(m=>`<div class="r"><span class="badge ${m.kind==='out'?'gray':''}">${m.kind==='out'?'出金':'入金'}</span><span class="t">${esc(m.memo||'')}</span><span>${m.receipt_path?`<button class="xb" data-mvpdf="${m.id}" aria-label="領収書">${FX('filetext')}</button>`:''}</span><span class="p">${esc(m.payer||'')}</span><span class="a">${yen(m.amount)}</span><span>${saved?'':`<button class="xb" data-mvdel="${m.id}" aria-label="削除">×</button>`}</span></div>`).join('')}
  <div class="r"><span class="badge gray">出金</span><span class="t" style="grid-column:span 3">日払（立替）　<small class="muted">${advRows.length?esc(advRows.map(a=>nm(a.staff_id)+' '+a.amount.toLocaleString()).join('・')):'なし'}</small></span><span class="a">${yen(advSum)}</span><span></span></div></div><div id="clMvDone"></div>`; }
function clHtml2(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K; return `
  ${H('③ 領収書メール')}<div id="clRcpt"></div>
  ${mp?H('④ 出退勤確認')+'<div id="clPunch"></div>'+clMpHtml(mpL,H):clOldMid}
  ${H(mp?'⑥ レジ金合わせ':'⑩ レジ金合わせ')}
  <div id="clCard" style="margin-bottom:12px"></div>`; }
function clHtml3(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K; return `
  <div style="display:grid;grid-template-columns:minmax(260px,1fr) minmax(280px,1fr);gap:18px;align-items:start">
    <div><div style="display:grid;grid-template-columns:1fr 90px 1fr;gap:6px;align-items:center"><b>金種</b><b style="text-align:center">枚数</b><b style="text-align:right">金額</b>${DENOMS.map(([v,n])=>`<span>${n}</span><input type="number" inputmode="numeric" min="0" data-den="${v}" value="${cnt[v]??''}" ${saved?'disabled':''} style="text-align:right"><span class="right" data-denamt="${v}"></span>`).join('')}<b>合計金額</b><span></span><b class="right" id="clCounted"></b></div></div>
    <div class="totals" style="display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center">
      <span>本日釣銭${gp.days.length?`<br><small class="muted">${gp.days.map(mdS).join('・')} の未精算分 ${gp.net>=0?'+':''}${yen(gp.net)} を含む</small>`:''}</span>${saved||hasPrev?`<span class="right" id="clOpenTxt"></span>`:`<input id="clOpenIn" type="number" inputmode="numeric" value="${clOpening||''}" placeholder="初回のみ入力" style="width:150px;text-align:right">`}
      <span>現金売上 <small class="muted">その日に受け取った現金</small></span><span class="right"><span id="clSales"></span> <small class="muted" id="clSalesWas"></small></span>
      <span>入金合計</span><span class="right" id="clIn"></span>
      <span>出金合計 <small class="muted">日払（立替）を含む</small></span><span class="right" id="clOut"></span>
      <span>レジ内現金（理論値）</span><span class="right" id="clExp"></span>
      <span>レジ内現金</span><span class="right" id="clCnt2"></span>
      <b>現金過不足</b><b class="right" id="clDiff"></b>
      <span>預金金額</span>${saved?`<span class="right" id="clDepTxt"></span>`:`<input id="clDepIn" type="number" inputmode="numeric" value="${clDeposit||''}" style="width:150px;text-align:right">`}
      <span>翌日釣銭準備金</span><span class="right" id="clNext"></span>
    </div></div>`; }
function clHtml4(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K; return `
  <div class="bar" style="margin-top:12px">${saved||future?'':later?'<span class="muted">後の日の精算があるため保存できません</span>':`<button class="primary" id="clSave">精算を保存</button>`}</div>
  ${mp?'':`  ${H('⑪ その日のメモ')}<div class="muted" style="font-size:14px;margin-bottom:6px">管理サイトの収支の Excel（日次の「メモ」）に入ります。精算の後でも修正できます</div>
  <textarea id="clDayMemo" rows="3" maxlength="1000" style="width:100%;min-height:96px;flex-shrink:0;box-sizing:border-box;font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px"></textarea>
  <div class="muted" id="clDayMemoSt" style="font-size:13px;margin-top:4px;min-height:1.4em"></div>`}
  ${H('月間一覧')}<div style="margin-bottom:8px"><input type="month" id="clMonthIn" value="${clMonth}"></div><div id="clMonthBox" style="overflow-x:auto;flex-shrink:0"></div>`; }
/* 押した時の動き：日付・月・金種・預金・入出金の登録 */
function clBindA(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K;
  $('clDateIn').onchange=e=>{ if(e.target.value){ clDate=e.target.value; clCounts={}; clDeposit=0; renderClosing(); } };
  $('clMonthIn').onchange=e=>{ if(e.target.value){ clMonth=e.target.value; clRenderMonth(); } };
  box.querySelectorAll('[data-den]').forEach(i=>i.oninput=()=>{ clCounts[i.dataset.den]=clNum(i.value); clRecalc(); });
  if($('clDepIn')) $('clDepIn').oninput=e=>{ clDeposit=clNum(e.target.value); clRecalc(); };
  if($('clOpenIn')) $('clOpenIn').oninput=e=>{ clOpening=clNum(e.target.value); clRecalc(); };
  // v11.24・SQL 077：入金・出金の項目は管理サイトの POS設定 で決める（「その他」は自由に書ける）
  if($('clKind')){ const items=k=>{ const v=settings?.['cash_'+k+'_items']; return Array.isArray(v)?v:(k==='out'?['領収書精算','支払い']:[]); };
    const fill=()=>{ const k=$('clKind').value; $('clMemoSel').innerHTML=items(k).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')+'<option value="__other">その他</option>'; };
    const mv=()=>{ const out=$('clKind').value==='out', rc=out&&$('clMemoSel').value===CL_RCPT; /* v12.75：領収書精算の時は 金額・追加 のかわりに撮影だけ（オーナー 2026-11-07「日払いの場合は撮影いらないよね」） */ $('clAmt').style.display=$('clAdd').style.display=rc?'none':''; $('clShot').style.display=rc?'':'none'; $('clMemo').style.display=$('clMemoSel').value==='__other'?'':'none'; $('clMemo').placeholder=out?'内容を入力':'内容（例：両替、釣銭補充）'; }; fill(); $('clKind').onchange=()=>{ fill(); mv(); };
    box.querySelectorAll('[data-clk]').forEach(b=>b.onclick=()=>{ $('clKind').value=b.dataset.clk; box.querySelectorAll('[data-clk]').forEach(x=>x.classList.toggle('on',x===b)); fill(); mv(); }); $('clMemoSel').onchange=()=>{ mv(); if($('clMemoSel').value==='__other') $('clMemo').focus(); }; mv(); }
  if($('clAdd')) $('clAdd').onclick=guard($('clAdd'),async()=>{ /* v12.30：二度押しで2つ入らないように */ const amount=clNum($('clAmt').value), kind=$('clKind').value, memo=$('clMemoSel').value!=='__other'?$('clMemoSel').value:$('clMemo').value.trim(); if(!amount){ toast('金額を入力してください'); return; } if(!memo){ toast('内容を入力してください'); return; } if(await askBy()===null) return; $('clAdd').disabled=true; const r=await insOnce('cash_movements',{store_id:store.id,business_date:d,kind,amount,memo}); if(r.error){ toast(r.error.message); $('clAdd').disabled=false; return; } await logOp(kind==='out'?'レジ出金の登録':'レジ入金の登録',{date:d,amount,memo},null,true); renderClosing(); });
}
/* 押した時の動き：入出金の取消・ボトル残量・写真・領収書。①〜⑨ の中身を読む */
function clBindB(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K;
  box.querySelectorAll('[data-mvdel]').forEach(x=>x.onclick=async()=>{ const m=moves.find(z=>z.id===x.dataset.mvdel); if(!m||!await uiConfirm(`${m.kind==='out'?'出金':'入金'} ${yen(m.amount)}（${m.memo}）を削除しますか？`))return; const r=await sb.rpc('pos_rows_del',{p_table:'cash_movements',p_where:{id:(m.id)??null}}); if(r.error){ toast(r.error.message); return; } if(!DBLOG) await logOp('レジ入出金の削除',{date:d,kind:m.kind,amount:m.amount,memo:m.memo},null,true); renderClosing(); });
  box.querySelectorAll('[data-clrem]').forEach(x=>x.onchange=async()=>{ const b=bottles.find(z=>z.id===x.dataset.clrem); const v=Number(x.value); const r=await sb.rpc('pos_bottle_set',{p_id:b.id,p:{remaining:v}}); if(r.error){ toast(r.error.message); return; } await logOp('ボトル残量変更',{customer:cn(b.customer_id),bottle:b.name,before:b.remaining,after:v},null,true); b.remaining=v; toast('残量を保存しました'); });
  if($('clShot')){ const fi=$('clShot').querySelector('input'); fi.onchange=()=>{ const f=fi.files&&fi.files[0]; fi.value=''; if(f) clRcptShot(f,d); }; }
  box.querySelectorAll('[data-mvpdf]').forEach(x=>x.onclick=()=>clRcptView(moves.find(z=>z.id===x.dataset.mvpdf)));
  clRegRender(d); // v12.72・SQL 387
  clRcptRender(d,moves);
  clMvRender(d,moves,saved);
  clChkRender(d); // v10.61
  clKmRender(d); // v11.59
  clTodoRender(d); // v11.71・SQL 145
  clCardRender(d,false); // v11.60
  if(mp) clPunchRender(d); // v12.22
}
function clDayMemo(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K;
  // v11.22・SQL 073：その日のメモ（店・営業日ごとに1つ。管理サイトの収支の Excel の日次「メモ」に入る）
  /* v12.30・SQL 291：読み終わるまでは保存しない。保存は「読んだ時のメモ」のままの時だけ。ほかで変わっていたら行ごとに合わせて（同じ行は両方残す）もう一度 */
  let dmLoaded=false, dmLast=null, dmTm=null;
  sb.from('daily_memos').select('memo').eq('store_id',store.id).eq('business_date',d).maybeSingle().then(r=>{ if(setCur!=='closing'||clDate!==d||!$('clDayMemo')) return; if(r.error){ $('clDayMemo').placeholder=/daily_memos/.test(r.error.message)?'SQL 073 が未実行です':r.error.message; return; } const el=$('clDayMemo'), got=r.data?.memo||'', typed=el.value.trim(); dmLast=got; dmLoaded=true; if(typed){ const mg=memoMerge('',typed,got); el.value=memoMergeDone(mg,mg.conflicts.map(()=>'b')); dmTm=setTimeout(memoSave,1200); } else el.value=got; });
  // v11.72：その日のメモは打つと自動で保存（オーナー 2026-10-18「メモを保存っていらないように」）
  const memoSave=async()=>{ clearTimeout(dmTm); const el=$('clDayMemo'); if(!el||!dmLoaded) return; let v=el.value.trim(); if(v===dmLast) return; const st=$('clDayMemoSt'); if(st) st.textContent='保存中…';
    for(let k=0;k<5;k++){ const r=await sb.rpc('pos_day_memo_save',{p_day:d,p_base:dmLast,p_memo:v});
      if(r.error){ if($('clDayMemoSt')) $('clDayMemoSt').textContent=''; toast((/daily_memos/.test(r.error.message)?'SQL 073 が未実行です：':'')+r.error.message); return; }
      if(r.data?.ok){ dmLast=v; if($('clDayMemoSt')) $('clDayMemoSt').textContent='保存しました'; return; }
      const th=r.data?.memo??'', mg=memoMerge(dmLast,v,th), nv=memoMergeDone(mg,mg.conflicts.map(()=>'b')).trim(); dmLast=th;
      const e2=$('clDayMemo'); if(e2){ const now=e2.value.trim(); if(now===v) e2.value=nv; else { const m2=memoMerge(v,now,nv); e2.value=memoMergeDone(m2,m2.conflicts.map(()=>'b')); } } v=nv; } if($('clDayMemoSt')) $('clDayMemoSt').textContent=''; };
  if($('clDayMemo')){ $('clDayMemo').addEventListener('input',()=>{ clearTimeout(dmTm); const st=$('clDayMemoSt'); if(st) st.textContent=''; dmTm=setTimeout(memoSave,1200); }); $('clDayMemo').addEventListener('blur',memoSave); /* 別の所を押すと、その前に保存 */ }
}
/* 顧客メモの更新申請の OK・取消 */
function clBindReq(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K;
  box.querySelectorAll('[data-clrqok]').forEach(x=>x.onclick=async()=>{ const q=(rq.data||[]).find(z=>z.id===x.dataset.clrqok); x.disabled=true; if(await reqResolve(q,'applied')) toast('メモに追記しました'); renderClosing(); });
  box.querySelectorAll('[data-clrqno]').forEach(x=>x.onclick=async()=>{ const q=(rq.data||[]).find(z=>z.id===x.dataset.clrqno); if(!await uiConfirm('この申請を却下しますか？')) return; if(await reqResolve(q,'rejected')) toast('却下しました'); renderClosing(); });
}
/* レジ精算の保存 */
function clBindSave(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K;
  if($('clSave')) $('clSave').onclick=async()=>{ const v=clRecalc();
    if(!await clSaveCheck(d,mp)) return;
    const w=await clSaveAsk(v);
    if(!w) return;
    const {cb,dw}=w;
    if(!await uiConfirm(`${d} のレジ精算を保存しますか？\nレジ内現金 ${yen(v.counted)}／過不足 ${v.diff>0?'+':''}${yen(v.diff)}${cb?`\n数えた人 ${cb}`:''}`))return;
    $('clSave').disabled=true;
    const r=await sb.rpc('pos_rows_add',{p_table:'register_closings',p:{store_id:store.id,business_date:d,counts:clCounts,opening_float:v.opening,cash_sales:cashSales,cash_in:inSum,cash_out:outSum+advSum,expected:v.expected,counted:v.counted,diff:v.diff,deposit:v.deposit,next_float:v.next,...(cb?{counted_by:cb}:{})}});
    if(r.error){ if(/もう1台/.test(r.error.message)){ await uiAlert(r.error.message);
    renderClosing();
    return;
    } /* v12.78・SQL 396：ほかの iPad で入出金・日払・現金の会計が入った時は、最新の金額で開き直す */ toast(/counted_by/.test(r.error.message)?'SQL 164 が未実行です':r.error.message);
    $('clSave').disabled=false;
    return;
    } await logOp('レジ精算を保存',{date:d,expected:v.expected,counted:v.counted,diff:v.diff,deposit:v.deposit,next_float:v.next,...(cb?{by:cb}:{})},dw||null,true);
    if(dw){ const line=`レジ過不足 ${v.diff>0?'+':''}${yen(v.diff)}：${dw}${cb?`（${cb}）`:''}`;
    await sb.rpc('pos_day_memo_append',{p_day:d,p_line:line});
    /* v12.30・SQL 291：今のメモの後ろに1行足す（1回で） */ } toast('精算を保存しました');
    clCounts={};
    clDeposit=0;
    renderClosing();
    };
}
/* 精算の前の確かめ（完了していない作業・会計していない伝票）。通せる時だけ true */
async function clSaveCheck(d,mp){ { let L; try{ L=await clUndone(d,mp); }catch(_){ await uiAlert(RDERR_T); return; } /* 読めない時は通さない */ if(L.length){ await uiAlert('完了していない作業があります\n'+L.map(x=>'・'+x.t).join('\n')); $(L[0].el)?.scrollIntoView({block:'center'}); return; } } /* v12.00：会計していない伝票があると精算できない（締め忘れると、その伝票の分が抜けたまま精算され、自動の延長も足され続ける。オーナー 2026-10-20） */ { const ob=await sb.from('bills').select('table_id').eq('store_id',store.id).eq('status','open').lte('business_date',d); if(ob.error){ await uiAlert(RDERR_T); return; } /* v12.43：読めない時に未会計0枚として通さない */ const L=ob.data||[]; if(L.length){ const nm=L.map(b=>billTable(b)||'卓なし').join('・'); await uiAlert(`まだ会計していない伝票が ${L.length}枚あります（${nm}）\nホールで会計してから精算してください`); return; } } return true; }
/* 数えた人と過不足の理由を聞く。やめた時は null */
async function clSaveAsk(v){ /* v11.94・SQL 164：数えた人を選ぶ（日報メールに出る。オーナー 2026-10-19） */ const hs=staff.filter(x=>x.kind==='hall'); const cb=hs.length?await uiPick('レジのお金を数えた人',hs.map(h=>({label:h.display_name,value:h.display_name}))):''; if(hs.length&&!cb) return null; /* v11.95：過不足がある時は理由を必ず聞き、その日のメモに足す（日報メールに出る。ゲネプロ #62） */ let dw=''; if(v.diff){ const w=await uiPrompt(`レジの過不足 ${v.diff>0?'+':''}${yen(v.diff)}\n理由を入力してください（必須・その日のメモに入ります）`,''); if(w===null) return null; if(!w.trim()){ toast('理由を入力してください'); return null; } dw=w.trim(); } return {cb,dw}; }
/* 合計・月間一覧・警告・連休明け・精算の取消のお知らせ */
function clAfter(K){ const {d,today,box,from,to,mv,adv,pay,cls,prev,bc,rq,od,lat,ctk,tdl,mp,mpL,moves,outSum,inSum,advRows,advSum,cashSales,saved,prevRow,hasPrev,gp,later,future,clIdle,custIds,bottles,nm,cn,H,cnt,clOldMid}=K;
  clRecalc(); clRenderMonth(); clRenderWarn(d,prevRow?prevRow.business_date:null);
  /* v12.72・SQL 387：連絡先交換の LINE は、開いた時ではなく「① お客様登録」の完了の時（v12.54 は開いた時。オーナー 2026-11-06） */
  sb.rpc('pos_todo_ahead',{p_day:d}).then(q=>{ const el=$('clAhead'); if(el&&clDate===d&&!q.error) el.innerHTML=aheadHtml(q.data); }); /* v12.13・SQL 234：連休前の日は、連休明けの休日分を知らせる（オーナー 2026-10-25） */
  /* v12.07・SQL 220：精算の取消の後は、レジ金合わせを再度（取消の時刻・理由・取消前の現金売上） */ if(!saved) sb.from('pos_audit_log').select('created_at,reason,detail').eq('store_id',store.id).eq('action','レジ精算の取消').eq('detail->>date',d).order('created_at',{ascending:false}).limit(1).then(q=>{ const x=(q.data||[])[0]; if(!x||setCur!=='closing'||clDate!==d||!$('clRe')) return; const t=new Date(x.created_at);
    $('clRe').innerHTML=`<div style="background:var(--warn-soft);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.6"><b style="color:var(--warn)">精算の取消　${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}</b>　${esc(x.reason||'')}<br>レジ金合わせを再度行い、「精算を保存」を押してください</div>`;
    if(x.detail?.cash_sales!=null&&$('clSalesWas')) $('clSalesWas').textContent=`（取消前 ${yen(x.detail.cash_sales)}）`; });
}
// v10.43：前回の精算の翌日〜前日のうち、未精算の日の現金の動き（現金売上＋入金−出金−日払い）の合計
async function clGap(after,d){ const [mv,adv,pay,cl]=await Promise.all([ sbAll(()=>sb.from('cash_movements').select('business_date,kind,amount').eq('store_id',store.id).gt('business_date',after).lt('business_date',d).order('id')), /* v11.30：1000行で切れないように分けて読む */
    sbAll(()=>sb.from('daily_advances').select('business_date,amount').eq('store_id',store.id).gt('business_date',after).lt('business_date',d).order('id')),
    sbAll(()=>sb.from('payments').select('amount,paid_at,bills!inner(status,store_id)').eq('method','cash').gte('paid_at',bdStart(after)).lt('paid_at',bdStart(d)).order('id')),
    sb.from('register_closings').select('business_date').eq('store_id',store.id).gt('business_date',after).lt('business_date',d) ]);
  { const e=[mv,adv,pay,cl].find(x=>x.error); if(e) return {net:0,days:[],error:e.error}; }
  const done=new Set((cl.data||[]).map(r=>r.business_date)); const net={}; const add=(k,v)=>{ if(!done.has(k)) net[k]=(net[k]||0)+v; };
  (mv.data||[]).forEach(r=>add(r.business_date,r.kind==='in'?Number(r.amount):-Number(r.amount))); (adv.data||[]).filter(r=>r.amount>0).forEach(r=>add(r.business_date,-Number(r.amount)));
  (pay.data||[]).filter(p=>p.bills&&p.bills.store_id===store.id&&p.bills.status!=='void'&&p.amount).forEach(p=>{ const b=businessDate(new Date(p.paid_at)); if(b>after&&b<d) add(b,Number(p.amount)); });
  const days=Object.keys(net).filter(k=>net[k]).sort(); return {net:days.reduce((s,k)=>s+net[k],0),days}; }
function clRecalc(){ const c=clCtx; if(!c) return {}; const s=c.saved; const cnt=s?(s.counts||{}):clCounts; let counted=0; DENOMS.forEach(([v])=>{ const a=v*clNum(cnt[v]); counted+=a; const el=document.querySelector(`[data-denamt="${v}"]`); if(el) el.textContent=yen(a); });
  const opening=s?s.opening_float:(c.hasPrev?c.prevFloat:clOpening); const sales=s?s.cash_sales:c.cashSales, cin=s?s.cash_in:c.inSum, cout=s?s.cash_out:(c.outSum+c.advSum); const expected=opening+sales+cin-cout; if(s) counted=s.counted; const diff=counted-expected; const deposit=s?s.deposit:clDeposit; const next=counted-deposit;
  const T=(id,t)=>{ const e=$(id); if(e) e.textContent=t; }; T('clCounted',yen(counted)); T('clOpenTxt',yen(opening)); T('clSales',yen(sales)); T('clIn',yen(cin)); T('clOut',yen(cout)); T('clExp',yen(expected)); T('clCnt2',yen(counted)); T('clDiff',(diff>0?'+':'')+yen(diff)); T('clDepTxt',yen(deposit)); T('clNext',yen(next)); const de=$('clDiff'); if(de) de.style.color=diff===0?'':'var(--warn)';
  return {opening,expected,counted,diff,deposit,next}; }
// v10.43：前回の精算の翌日〜前日までに、動き（現金売上・入出金・日払い）があったのに精算していない日を赤で出す。日付を押すとその日を開く
async function clRenderWarn(d,after){ const el=$('clWarn'); if(!el) return; const x=new Date(d+'T00:00:00'); x.setDate(x.getDate()-31); const lo=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; const from=after&&after>lo?after:lo;
  const [mv,adv,pay,cl]=await Promise.all([ sbAll(()=>sb.from('cash_movements').select('business_date').eq('store_id',store.id).gt('business_date',from).lt('business_date',d).order('id')), /* v12.30：1000行で切れないように分けて読む・店はデータベースで絞る */
    sbAll(()=>sb.from('daily_advances').select('business_date,amount').eq('store_id',store.id).gt('business_date',from).lt('business_date',d).order('id')),
    sbAll(()=>sb.from('payments').select('amount,paid_at,bills!inner(status,store_id)').eq('method','cash').eq('bills.store_id',store.id).gte('paid_at',bdStart(from)).lt('paid_at',bdStart(d)).order('id')),
    sb.from('register_closings').select('business_date').eq('store_id',store.id).gt('business_date',from).lt('business_date',d) ]);
  if($('clWarn')!==el||clDate!==d) return; const done=new Set((cl.data||[]).map(r=>r.business_date)); const act=new Set();
  (mv.data||[]).forEach(r=>act.add(r.business_date)); (adv.data||[]).filter(r=>r.amount>0).forEach(r=>act.add(r.business_date));
  (pay.data||[]).filter(p=>p.bills&&p.bills.store_id===store.id&&p.bills.status!=='void'&&p.amount).forEach(p=>{ const b=businessDate(new Date(p.paid_at)); if(b>from&&b<d) act.add(b); });
  const days=[...act].filter(x=>!done.has(x)).sort(); if(!days.length){ el.innerHTML=''; return; }
  const md=mdS; el.innerHTML=`<div class="alert">${days.map(x=>`<a href="#" data-clw="${x}" style="color:inherit">${md(x)}</a>`).join('・')} が未精算です</div>`;
  el.querySelectorAll('[data-clw]').forEach(a=>a.onclick=e=>{ e.preventDefault(); clDate=a.dataset.clw; clCounts={}; clDeposit=0; renderClosing(); }); }
async function clRenderMonth(){ const el=$('clMonthBox'); if(!el) return; const [y,m]=clMonth.split('-').map(Number); const last=new Date(y,m,0).getDate(); const d1=`${clMonth}-01`, dN=`${clMonth}-${String(last).padStart(2,'0')}`; const nx=m===12?`${y+1}-01-01`:`${y}-${String(m+1).padStart(2,'0')}-01`;
  // v10.43：動きがない日も含めて全日を表示。精算記録がない日は、前日から引き継いだ釣銭・現金売上・入出金（日払い含む）から計算して出す。動きがない過去の日はレジ内現金＝理論値・過不足0円・預金0円で「精算済（変動なし自動繰越）」、動きがあったのに精算していない日は「未精算」
  const [r,pv,mv,adv,pay]=await Promise.all([ sb.from('register_closings').select('*').eq('store_id',store.id).gte('business_date',d1).lte('business_date',dN),
    sb.from('register_closings').select('next_float').eq('store_id',store.id).lt('business_date',d1).order('business_date',{ascending:false}).limit(1),
    sbAll(()=>sb.from('cash_movements').select('business_date,kind,amount').eq('store_id',store.id).gte('business_date',d1).lte('business_date',dN).order('id')), /* v12.30：1000行で切れないように分けて読む・店はデータベースで絞る */
    sbAll(()=>sb.from('daily_advances').select('business_date,amount').eq('store_id',store.id).gte('business_date',d1).lte('business_date',dN).order('id')),
    sbAll(()=>sb.from('payments').select('amount,paid_at,bills!inner(status,store_id)').eq('method','cash').eq('bills.store_id',store.id).gte('paid_at',bdStart(d1)).lt('paid_at',bdStart(nx)).order('id')) ]);
  if(!$('clMonthBox')) return; const er=r.error||mv.error||adv.error||pay.error; if(er){ el.innerHTML=`<div class="muted">${esc(er.message)}</div>`; return; }
  const byD={}; (r.data||[]).forEach(x=>byD[x.business_date]=x); const sum={}; const add=(dd,k,v)=>{ (sum[dd]=sum[dd]||{sales:0,cin:0,cout:0})[k]+=Number(v)||0; };
  (mv.data||[]).forEach(x=>add(x.business_date,x.kind==='in'?'cin':'cout',x.amount)); (adv.data||[]).filter(x=>x.amount>0).forEach(x=>add(x.business_date,'cout',x.amount));
  (pay.data||[]).filter(p=>p.bills&&p.bills.store_id===store.id&&p.bills.status!=='void').forEach(p=>add(businessDate(new Date(p.paid_at)),'sales',p.amount));
  const today=businessDate(); const td='style="padding:6px 5px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap"'; const C=v=>`<td ${td}>${v}</td>`; const CS=v=>`<td style="padding:6px 5px;border-bottom:1px solid var(--line);font-size:12px;white-space:nowrap;line-height:1.3">${v}</td>`; // 状態の列は折り返して全部見せる
  let carry=Number((pv.data||[])[0]?.next_float)||0; const rows=[];
  for(let i=1;i<=last;i++){ const dd=`${clMonth}-${String(i).padStart(2,'0')}`; const dl=`${dd.slice(5).replace('-','/')}（${WD[new Date(dd+'T00:00:00').getDay()]}）`; const x=byD[dd];
    if(x){ rows.push(`<tr data-cld="${dd}" style="cursor:pointer">${C(dl)}${C(yen(x.opening_float))}${C(yen(x.cash_sales))}${C(yen(x.cash_in))}${C(yen(x.cash_out))}${C(yen(x.expected))}${C(yen(x.counted))}${C((x.diff>0?'+':'')+yen(x.diff))}${C(yen(x.deposit))}${CS('精算済')}</tr>`); carry=Number(x.next_float??(x.counted-x.deposit))||0; continue; }
    if(dd>today){ rows.push(`<tr style="color:var(--muted)">${C(dl)}${C('').repeat(9)}</tr>`); continue; }
    const t=sum[dd]||{sales:0,cin:0,cout:0}; const exp=carry+t.sales+t.cin-t.cout; const idle=!t.sales&&!t.cin&&!t.cout;
    rows.push(`<tr data-cld="${dd}" style="cursor:pointer;color:var(--muted)">${C(dl)}${C(yen(carry))}${C(yen(t.sales))}${C(yen(t.cin))}${C(yen(t.cout))}${C(yen(exp))}${idle?C(yen(exp))+C(yen(0))+C(yen(0))+CS(dd<today?'精算済<br>（変動なし自動繰越）':''):C('')+C('')+C('')+CS('<span style="color:var(--warn)">未精算</span>')}</tr>`); carry=exp; }
  el.innerHTML=`<table style="border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:13px"><tr>${['日付','本日釣銭','現金売上','入金合計','出金合計','理論値','レジ内現金','過不足','預金','状態'].map(h=>`<th ${td}>${h}</th>`).join('')}</tr>${rows.join('')}</table>`;
  el.querySelectorAll('[data-cld]').forEach(t=>t.onclick=()=>{ clDate=t.dataset.cld; clCounts={}; clDeposit=0; renderClosing(); }); }
// 精算の前に、閉店作業の全部の項目が完了しているかを1か所で見る（オーナー 2026-11-10「すべてのタスクを完了させないと精算できないように」）。完了していない項目を全部返す
async function clUndone(d,mp){ const ok=r=>{ if(r.error) throw r.error; return r; };
  const lg=a=>sb.from('pos_audit_log').select('detail').eq('store_id',store.id).eq('action',a).eq('detail->>business_date',d).order('created_at',{ascending:false}).limit(1);
  const [rb,rl,mv,rm,rg,ev,tq,mt,ck]=(await Promise.all([ sb.from('bills').select('id',{count:'exact',head:true}).eq('store_id',store.id).eq('business_date',d).neq('status','void'), lg(CL_REG), lg(CL_MVD),
    sb.from('cash_movements').select('id').eq('store_id',store.id).eq('business_date',d).not('receipt_path','is',null), lg(CL_RMAIL),
    sb.from('attendance_events').select('staff_id,event_type').eq('store_id',store.id).eq('business_date',d).in('event_type',['clock_in','clock_out','douhan','after']),
    sb.rpc('pos_todos',{p_day:d}), mp?sb.rpc('pos_close_tasks',{p_day:d}):null, mp?null:lg(CL_CHK) ])).map(r=>r&&ok(r));
  const L=[], has=r=>!!(r.data||[]).length;
  if(rb.count&&!has(rl)) L.push({t:'① お客様登録',el:'clReg'});
  if(!has(mv)) L.push({t:'② 入出金の登録',el:'clMvDone'});
  const sent=new Set((rg.data||[])[0]?.detail?.ids||[]); if((rm.data||[]).some(m=>!sent.has(m.id))) L.push({t:'③ 領収書メール',el:'clRcpt'});
  if(mp){ if(!staffAll.length) await loadStaffAll(); const IN=new Set(), OUT=new Set(); (ev.data||[]).forEach(e=>(e.event_type==='clock_out'||e.event_type==='after'?OUT:IN).add(e.staff_id));
    const nm=[...IN].filter(id=>!OUT.has(id)).map(id=>staffAll.find(x=>x.id===id)).filter(x=>x&&x.kind!=='hall'&&!x.is_trial).map(x=>x.display_name); /* 黒服・体験は POS で修正できないので止めない */
    if(nm.length) L.push({t:`④ 出退勤確認（未退勤 ${nm.join('・')}）`,el:'clPunch'});
    const T=(mt.data?.items||[]).filter(x=>x.status!=='done'); if(T.length) L.push({t:`⑤ マイページの閉店作業（${T.map(x=>x.name).join('・')}）`,el:'clMp'}); }
  else if(!has(ck)) L.push({t:`⑥ ${KL}・同伴・反応◎の確認`,el:'clChk'});
  const n=(tq.data||[]).filter(x=>x.status==='open').length; if(n) L.push({t:`⑨ TODO（${n}件）`,el:'clTodo'});
  return L; }
