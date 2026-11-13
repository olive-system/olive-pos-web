// ---------- 閉店作業（入出金の登録 → ボトル残量 → 顧客メモの更新申請の確認（顧客ウェブサイトから届いた分） → 今日出たお酒・ドリンク → レジ金合わせ → 月間一覧） ----------
const DENOMS=[[10000,'1万円札'],[5000,'5千円札'],[2000,'2千円札'],[1000,'千円札'],[500,'500円玉'],[100,'100円玉'],[50,'50円玉'],[10,'10円玉'],[5,'5円玉'],[1,'1円玉']];
let clDate=null, clCounts={}, clDeposit=0, clOpening=0, clMonth=null, clCtx=null, clReqAuthor='';
function clRange(d){ const a=new Date(bdStart(d)); return [a.toISOString(), new Date(a.getTime()+24*3600*1000).toISOString()]; }
// 閉店作業の④ 今日出たお酒・ドリンク（発注用）。取消の伝票・取消した注文は除く。フード・その他（h.c・b.c・立替金など）は出さない
function clOrderHtml(od){ if(od.error) return `<div class="muted">${esc(od.error.message)}</div>`; const skip=new Set(categories.filter(c=>['フード','その他'].includes(c.name)).map(c=>c.id)); const agg=new Map();
  (od.data||[]).forEach(i=>{ const cid=i.category_id||products.find(p=>p.id===i.product_id)?.category_id||null; if(skip.has(cid)) return; const k=i.product_id||i.name; const a=agg.get(k)||{name:i.name,cid,qty:0}; a.qty+=Number(i.qty)||0; agg.set(k,a); });
  const items=[...agg.values()].filter(a=>a.qty>0); if(!items.length) return '<div class="muted">なし</div>';
  const cats=[...categories.map(c=>c.id),null]; return `<div class="list">${cats.map(cid=>{ const xs=items.filter(a=>(a.cid||null)===cid).sort((a,b)=>b.qty-a.qty); if(!xs.length) return ''; const cn=categories.find(c=>c.id===cid)?.name||'未分類'; return `<div class="item" style="flex-wrap:wrap;gap:4px 14px"><b style="flex:0 0 auto">${esc(cn)}</b>${xs.map(a=>`<span>${esc(a.name)} ×${a.qty}</span>`).join('')}</div>`; }).join('')}</div>`; }
const clNum=numIn;
// 閉店作業④ 係・同伴・反応◎の登録に間違いがないかを伝票一覧で確認し、確認者を記録する（操作ログに残る。誰が確認したかで責任の所在が分かる）
const CL_CHK='伝票の確認（係・同伴・反応◎）';
// ⑤ 着物（ドレス新調日の免除。オーナー「閉店作業で、着物の項目。本日出勤のキャストの中から選ぶ形で」）
// 出勤したキャストから着物の子を押す → その月のドレス新調日が免除（付いた罰金は取消）。もう一度押すと取消。ドレス新調日をしない店は出さない
// カード売上の照合（Square と POS。オーナー「スクエアと API 連携して自動で照合し結果を表示。照合ボタン」）。閉店作業を開くと自動、「照合」でやり直し
async function clCardRender(d,btn){ const el=$('clCard'); if(!el) return; el.innerHTML='<div class="muted">カード売上の照合…</div>';
  const q=await sb.rpc('pos_card_check',{p_day:d}); if(!$('clCard')||clDate!==d) return;
  const go='<button class="sm" id="clCardGo">照合</button>';
  if(q.error){ el.innerHTML=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>カード売上の照合</b><span style="color:var(--warn)">${esc(q.error.message)}</span>${go}</div>`; }
  else if(!q.data.set){ el.innerHTML='<div class="muted">カード売上の照合：Square がつながっていません（管理サイトの「Square 連携」）</div>'; return; }
  else { const D=q.data, ok=D.diff===0;
    el.innerHTML=`<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;${ok?'':'background:var(--warn-soft)'}"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>カード売上の照合</b>${ok?'<span class="badge k">一致</span>':`<b style="color:var(--warn)">差 ${D.diff>0?'+':''}${yen(D.diff)}</b>`}<span style="flex:1"></span>${go}</div>
      <div style="display:grid;grid-template-columns:auto auto 1fr;gap:2px 14px;margin-top:6px;font-size:15px"><span>Square</span><b class="right">${yen(D.square.total)}</b><span class="muted">${D.square.count}件</span><span>POS</span><b class="right">${yen(D.pos.total)}</b><span class="muted">${D.pos.count}件</span></div></div>`; }
  const b=$('clCardGo'); if(b) b.onclick=()=>clCardRender(d,true); if(btn&&!q.error) toast('照合しました'); }
// 閉店作業「⑦ TODO」（v11.72 でレジ金合わせの前に。オーナー）（オーナー「POS の閉店作業で警告する。絶対に終わらせる。できない場合は理由を書かせる」）。未で理由も無いと精算を保存できない（データベースでも止める）
async function clTodoRender(d){ const el=$('clTodo'); if(!el) return; const q=await sb.rpc('pos_todos',{p_day:d}); if(!$('clTodo')||clDate!==d) return;
  if(q.error){ el.innerHTML=`<div class="muted">${esc(/pos_todos/.test(q.error.message)?'SQL 145 が未実行です':q.error.message)}</div>`; return; }
  const L=q.data||[]; if(!L.length){ el.innerHTML='<div class="muted">この日の TODO はありません</div>'; return; }
  const n=L.filter(x=>x.status==='open').length;
  el.innerHTML=(n?`<div style="color:var(--warn);font-weight:700;margin-bottom:6px">終わっていない TODO が ${n}つ</div>`:'<div style="color:var(--pri);font-weight:700;margin-bottom:6px">全部完了</div>')+L.map(x=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--line);font-size:15px"><span style="flex:1;min-width:0">${esc(x.name)}${x.carry?` <small class="muted">休日分 ${+x.day.slice(5,7)}/${+x.day.slice(8,10)}</small>`:''}${x.late?' <b style="color:var(--warn);font-size:13px">17:00 超過</b>':''}</span>${x.status==='done'?`<b style="color:var(--ok)">完了</b><small class="muted">${esc(x.by||'')}</small>`:x.status==='skip'?`<small class="muted" style="max-width:50%">理由：${esc(x.reason||'')}</small>`:`<b style="color:var(--warn)">未完了</b><button class="ghost sm" data-tdr="${x.id}" data-tdi="${L.indexOf(x)}">理由</button>`}</div>`).join('')+'<div class="muted" style="font-size:13px;margin-top:6px">完了は黒服マイページで（写真）</div>';
  el.querySelectorAll('[data-tdr]').forEach(b=>b.onclick=async()=>{ const x=L[+b.dataset.tdi]; const r=await uiDlg(`${x.name}\nできない理由`,true,'','理由を入力してください'); if(r==null) return; if(!r.trim()){ toast('理由を入力してください'); return; } const z=await sb.rpc('pos_todo_skip',{p_item:x.id,p_day:x.carry?x.day:d,p_reason:r.trim()}); /* 休日分はその日付 */ if(z.error){ await uiAlert(z.error.message); return; } toast('理由を入れました'); clTodoRender(d); }); }
async function clKmRender(d){ const el=$('clKmBox'); if(!el) return; const q=await sb.rpc('pos_kimono_day',{p_day:d}); if(!$('clKmBox')||clDate!==d) return;
  if(q.error||!q.data?.enabled){ el.innerHTML=''; return; } const C=q.data.casts||[], mo=Number(d.slice(5,7)), md=mdS;
  el.innerHTML=`<h2 style="margin:18px 0 8px">⑦ 着物（ドレス新調日の免除）</h2>${C.length?`<div style="display:flex;flex-wrap:wrap;gap:8px">${C.map(c=>`<button type="button" class="${c.kimono?'primary':''}" data-km="${c.id}" ${c.done||c.other_day?'disabled':''} style="min-width:96px">${esc(c.name)}${c.kimono?'　着物':''}${c.done?'<br><small>新調済</small>':''}${c.other_day?`<br><small>着物 ${md(c.other_day)}</small>`:''}</button>`).join('')}</div>
    <div class="muted hint" style="margin-top:6px">着物で出勤した子を押す → ${mo}月のドレス新調日は免除（もう一度押すと取消）</div>`:'<div class="muted">この日に出勤したキャストがいません</div>'}`;
  el.querySelectorAll('[data-km]').forEach(b=>b.onclick=async()=>{ const c=C.find(x=>x.id===b.dataset.km), on=!c.kimono; b.disabled=true;
    const r=await sb.rpc('pos_kimono_set',{p_staff:c.id,p_day:d,p_on:on}); if(r.error){ b.disabled=false; await uiAlert(r.error.message); return; } toast(on?`${c.name}：着物（${mo}月のドレス新調日は免除）`:`${c.name}：着物を取消しました`); clKmRender(d); }); }
async function clChkRender(d){ const el=$('clChk'); if(!el) return; if(!staffAll.length) await loadStaffAll();
  const r=await sb.from('pos_audit_log').select('created_at,detail').eq('store_id',store.id).eq('action',CL_CHK).eq('detail->>business_date',d).order('created_at',{ascending:false}).limit(1); if(!$('clChk')||clDate!==d) return;
  const done=(r.data||[])[0]; if(done){ const x=new Date(done.created_at); el.innerHTML=`<div style="font-size:16px">${FX('ballotboxwithcheck')} 伝票一覧で確認済　<b>${esc(done.detail?.by||'')}</b>　<small class="muted">${x.getMonth()+1}/${x.getDate()} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}</small></div>`; return; }
  if(d!==businessDate()){ el.innerHTML='<div class="muted">確認の記録なし</div>'; return; }
  const who=staffAll.filter(s=>s.is_active&&(s.kind==='hall'||(s.kakari_only&&s.display_name!=='店')));
  el.innerHTML=`<div style="margin-bottom:8px">${KL}・同伴・反応◎の登録に間違いがないか、伝票一覧で確認してください。</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="ghost sm" id="clChkOpen">伝票一覧を開く</button>
    <label style="display:flex;align-items:center;gap:6px;margin:0;font-size:16px;color:var(--ink)"><input type="checkbox" id="clChkBox" style="width:auto;margin:0">伝票一覧で確認した</label>
    <select id="clChkWho" style="width:auto;min-width:0"><option value="">確認者</option>${who.map(s=>`<option value="${s.id}">${esc(s.display_name)}</option>`).join('')}</select>
    <button class="primary sm" id="clChkSave" disabled>記録</button></div>`;
  const upd=()=>{ $('clChkSave').disabled=!($('clChkBox').checked&&$('clChkWho').value); }; $('clChkBox').onchange=upd; $('clChkWho').onchange=upd;
  $('clChkOpen').onclick=()=>{ setCur='bills'; renderSettings('bills'); };
  $('clChkSave').onclick=async()=>{ $('clChkSave').disabled=true; const s=staffAll.find(x=>x.id===$('clChkWho').value); await logOp(CL_CHK,{by:s?.display_name||'',staff_id:s?.id||null,business_date:d},null,true); clChkRender(d); }; }
// ② 出退勤確認（③ マイページの閉店作業の前）（オーナー「閉店作業で全員の出退勤時間の確認。本日打刻があった人の一覧（編集可能）。最終のお客様の退店時間と一緒に」「POS 画面でのみ。②に入れたい。コンパクトに」「列揃えたい」）
// 時刻は在籍と同じ（丸めた時刻）。キャストの時刻を押すと在籍と同じ修正（罰金も同じ）。黒服・体験は表示のみ。修正できるのは今日の営業日だけ
async function clPunchRender(d){ const el=$('clPunch'); if(!el) return; if(!staffAll.length) await loadStaffAll();
  const [ev,bl,lt,af]=await Promise.all([ sb.from('attendance_events').select('staff_id,event_type,event_at,rounded_at,is_corrected,orig_at,orig_rounded_at').eq('store_id',store.id).eq('business_date',d).in('event_type',['clock_in','clock_out','douhan','after']).order('event_at'),
    sb.from('bills').select('id,status,closed_at,opened_at,table_id,table_name,guest_count,bill_customers(customer_id),bill_casts(staff_id,role)').eq('store_id',store.id).eq('business_date',d).neq('status','void'), sb.rpc('pos_close_late',{p_date:d}), sb.rpc('pos_after_list',{p_date:d}) ]);
  if(!$('clPunch')||clDate!==d) return; const AF=!af.error&&af.data&&af.data.value!=null?af.data:null; if(ev.error||bl.error){ el.innerHTML=`<div class="muted">出退勤を読み込めません。再度開いてください：${esc((ev.error||bl.error).message)}</div>`; return; }
  const K=cpPrep(d,ev,bl,lt); Object.assign(K,cpKit(K)); const {P,lastHtml,B,T,edit}=K, row=r=>cpRow(K,r);
  el.innerHTML=(lt.error?RDERR:'')+`<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px"><span>${lastHtml}</span>${P.length&&edit?'<small class="muted">キャストの時刻を押して修正します。赤字は修正済・未退勤</small>':''}</div>
    <div class="list">${P.map(row).join('')||'<div class="muted">打刻なし</div>'}</div>`+(AF?clAfterHtml(AF,B,edit):'');
  const again=()=>clPunchRender(d);
  el.querySelectorAll('[data-pfin]').forEach(b=>b.onclick=()=>punchFix(b.dataset.pfin,'clock_in',again)); el.querySelectorAll('[data-pfout]').forEach(b=>b.onclick=()=>AF?clPunchOut(b.dataset.pfout,T[b.dataset.pfout],again):punchFix(b.dataset.pfout,'clock_out',again));
  if(AF) el.querySelectorAll('[data-afsel]').forEach(b=>b.onclick=()=>clAfterPick(b.dataset.afsel,d,B,AF,again)); }
/* 出退勤の表に使う値（打刻の丸め・同伴・最終退店・シフトと遅刻） */
function cpPrep(d,ev,bl,lt){
  const T={}, Q=900000; (ev.data||[]).forEach(e=>{ const t=T[e.staff_id]||(T[e.staff_id]={}); if(e.event_type==='clock_out'||e.event_type==='after'){ t.out=e.rounded_at||Math.floor(new Date(e.event_at).getTime()/Q)*Q; t.outFix=e.is_corrected; t.outO=e.orig_at?(e.orig_rounded_at||Math.floor(new Date(e.orig_at).getTime()/Q)*Q):null; t.after=e.event_type==='after'; }
    else if(!t.in){ t.in=e.rounded_at||Math.ceil(new Date(e.event_at).getTime()/Q)*Q; t.inFix=e.is_corrected; t.inO=e.orig_at?(e.orig_rounded_at||Math.ceil(new Date(e.orig_at).getTime()/Q)*Q):null; t.douhan=e.event_type==='douhan'; } });
  const B=bl.data||[], DH=new Set(B.flatMap(b=>(b.bill_casts||[]).filter(c=>/^douhan[12]?$/.test(c.role)).map(c=>c.staff_id))), open=B.filter(b=>b.status==='open').length, last=B.filter(b=>b.closed_at).sort((a,b)=>a.closed_at<b.closed_at?1:-1)[0];
  const lastHtml=open?`<span style="color:var(--warn)">来店中 ${open}組</span>`:last?`最終退店 <b style="font-size:18px">${hmJst(last.closed_at)}</b> <small class="muted">${esc(billTable(last))} ${esc((last.bill_customers||[]).map(c=>customers.find(x=>x.id===c.customer_id)?.name).filter(Boolean).slice(0,1).map(n=>n+' 様').join(''))}</small>`:'<span class="muted">伝票なし</span>';
  const edit=d===businessDate(), P=Object.keys(T).map(id=>({id,s:staffAll.find(x=>x.id===id)||{},t:T[id]})).sort((a,b)=>((a.s.kind==='hall')-(b.s.kind==='hall'))||(a.t.in||0)-(b.t.in||0)||(a.s.sort_order||0)-(b.s.sort_order||0));
  // シフトの列と遅刻（遅刻連絡／連絡なし遅刻・罰金。免除は「免除」。黒服は金額なし）（オーナー「これ、遅刻なんだよね。こーゆうこと、ここで知りたいな」）
  const LT={}; if(!lt.error) (lt.data||[]).forEach(x=>{ LT[x.staff_id]=x; }); /* シフト・遅刻を読めない時は黙って消さず1行出す（点検 B5） */ const sW=P.some(x=>LT[x.id])?96:0, lW=P.some(x=>LT[x.id]?.late)?210:0;
  const oW=P.some(x=>x.t.inO||x.t.outO)?46:0; /* 並びは店・日によらずいつも1列（オーナー「広島も銀座も一列」。前は遅刻・修正のある日だけ幅が広がって1列になっていた） */ // 修正した打刻は「最初の打刻の丸めた時刻→今」。ある時は列を広げて出・退をそろえる
  return {d,edit,P,T,B,DH,open,last,lastHtml,LT,oW,sW,lW}; }
/* 時刻の枠と遅刻のしるし */
function cpKit(K){ const {d,edit,P,T,B,DH,open,last,lastHtml,LT,oW,sW,lW}=K;
  const tm=(on,k,v,fix,key,id,o)=>`<span ${on?`data-${key}="${id}" `:''}style="font-size:14px;white-space:nowrap;padding:2px 4px;font-variant-numeric:tabular-nums;border-bottom:1px dotted ${on?'#999':'transparent'};${on?'cursor:pointer;':''}color:${fix?'var(--warn)':on?'inherit':'var(--muted)'}">${k}${o&&hmJst(o)!==v?`<small style="color:var(--muted)">${hmJst(o)}→</small>`:''}${v}</span>`;
  // 遅刻・無断遅刻のしるしは同じ幅の枠に入れて、罰金・免除の始まりをそろえる（オーナー）。シフトが同伴の日は「同伴」
  const lateHtml=(s,l)=>!l?.late?'':'<span style="display:inline-block;width:70px">'+(l.notice?'<span class="badge gray">遅刻</span>':'<span class="badge warnb">無断遅刻</span>')+'</span>'+(s.kind!=='hall'&&Number(l.fine)>0?` <span style="color:var(--warn);font-size:14px;white-space:nowrap">罰金 ${Number(l.fine).toLocaleString()}円</span>`:l.notice==='approved'?' <span class="badge gray">免除</span>':''); // しるしは「遅刻」「無断遅刻」（オーナー「遅刻連絡ではなく遅刻・連絡なし遅刻ではなく無断遅刻」）。手で付けた遅刻の罰金も金額を出す（免除でも罰金があれば金額）
  return {tm,lateHtml}; }
/* 出退勤確認の1人の行（シフト・出・退・遅刻・罰金・同伴） */
function cpRow(K,{id,s,t}){ const {d,edit,P,T,B,DH,open,last,LT,oW,sW,lW,tm,lateHtml}=K; const on=edit&&s.kind!=='hall'&&!s.is_trial, tag=s.kind==='hall'?'':s.is_trial?'体験':''; /* 同伴かどうかは伝票の係（同伴・同伴①・同伴②）で見る。シフトの同伴・予約・同伴の打刻は予定でキャンセルがあるため（オーナー） */ // 黒服のしるしは出さない（オーナー「黒服って名前でわかるから…スペースがもったいない」）
    return `<div class="item" style="padding:6px 10px"><span class="n" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.display_name||'')}${tag?`<small class="muted"> ${tag}</small>`:''}</span>${sW?`<span class="muted" style="width:${sW}px;flex:none;font-size:14px;white-space:nowrap;font-variant-numeric:tabular-nums">${LT[id]?PL_SH+esc(LT[id].shift):''}</span>`:''}<span style="width:${84+oW}px;flex:none">${tm(on,DH.has(id)?PL_DH:PL_IN,t.in?hmJst(t.in):'―',t.inFix||!t.in,'pfin',id,t.inO)}</span><span style="width:${118+oW}px;flex:none">${t.out?tm(on,t.after?PL_AF:PL_OUT,hmJst(t.out),t.outFix,'pfout',id,t.outO):tm(on,'','未退勤',s.kind!=='hall','pfout',id)}</span>${lW?`<span style="width:${lW}px;flex:none;display:flex;gap:6px;align-items:center">${lateHtml(s,LT[id])}</span>`:''}</div>`;
}
// アフター（報酬の種類に「自動：アフター」がある店＝広島）。アフターの打刻をした子に伝票を選ぶ → お客様1名の数を同じ伝票の子の人数で分配。選ばなければ 0（オーナー）
// 卓の名前は同じ幅の枠・人数は右の端（スキル olive-no-misalign）。並びは1列3名
const clBillName=b=>{ const c=(b.bill_customers||[]).map(x=>customers.find(z=>z.id===x.customer_id)?.name).filter(Boolean)[0]; return c?c+' 様':'お客様未登録'; };
const clBillRow=b=>`<span style="display:inline-block;width:44px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(billTable(b))}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(clBillName(b))}</span><span style="width:30px;flex:none;text-align:right;font-variant-numeric:tabular-nums">${b.guest_count}名</span>`;
function clAfterHtml(AF,B,edit){ const R=AF.rows||[]; if(!R.length) return ''; const v=Number(AF.value||0), u=AF.unit==='yen'?'円':'P';
  const n={}; R.forEach(r=>{ if(r.bill_id) n[r.bill_id]=(n[r.bill_id]||0)+1; });
  const pt=r=>{ const b=r.bill_id&&B.find(x=>x.id===r.bill_id); if(!b) return ''; const x=v*Math.min(b.guest_count,n[r.bill_id])/n[r.bill_id]; return (u==='P'?Math.round(x*10)/10:Math.round(x)).toLocaleString()+u; };
  const nm=id=>staffAll.find(x=>x.id===id)?.display_name||'';
  const row=r=>{ const b=r.bill_id&&B.find(x=>x.id===r.bill_id); const inner=b?clBillRow(b):'<span class="muted" style="flex:1">選択</span>';
    return `<div class="item" style="padding:6px;gap:5px;font-size:14px"><span style="width:58px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nm(r.staff_id))}</span>${edit?`<button type="button" class="ghost" data-afsel="${r.staff_id}" style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;text-align:left;padding:5px 6px;font-size:14px;min-height:0;background:#fff">${inner}<span class="muted" style="flex:none">▾</span></button>`:`<span style="flex:1;min-width:0;display:flex;gap:6px;font-size:14px">${inner}</span>`}<span style="width:34px;flex:none;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${pt(r)}</span></div>`; };
  return `<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin:14px 0 6px"><b style="font-size:16px">アフター</b><small class="muted">お客様1名 ${v.toLocaleString()}${u} を人数で分配・伝票の選択なしは 0${u}</small></div>
    <div class="list" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:10px">${R.map(row).join('')}</div>`; }
async function clAfterPick(sid,d,B,AF,again){ const cur=(AF.rows||[]).find(r=>r.staff_id===sid)?.bill_id||null; const L=B.slice().sort((a,b)=>(a.opened_at||'')<(b.opened_at||'')?-1:1);
  const m=mkModal(60);
  m.innerHTML=`<div class="box" style="width:min(420px,94vw);max-height:86vh;overflow:auto"><b>アフター（${esc(staffAll.find(x=>x.id===sid)?.display_name||'')}）</b><div class="list" style="margin-top:10px">${L.map(b=>`<button type="button" class="item" data-afb="${b.id}" style="display:flex;gap:6px;align-items:center;text-align:left;width:100%;font-size:15px;${b.id===cur?'outline:2px solid var(--pri);':''}">${clBillRow(b)}</button>`).join('')}<button type="button" class="item muted" data-afb="" style="text-align:left;width:100%;font-size:15px;${cur?'':'outline:2px solid var(--pri);'}">なし</button></div><div class="bar" style="justify-content:flex-end"><button class="ghost" data-afno>キャンセル</button></div></div>`;
  document.body.appendChild(m); m.querySelector('[data-afno]').onclick=()=>m.remove();
  m.querySelectorAll('[data-afb]').forEach(x=>x.onclick=async()=>{ m.remove(); const bid=x.dataset.afb||null; if(bid===cur) return; const r=await sb.rpc('pos_after_set',{p_staff:sid,p_date:d,p_bill:bid}); if(r.error){ await uiConfirm(r.error.message); again(); return; }
    const b=bid&&B.find(z=>z.id===bid); await logOp('アフターの伝票',{name:staffAll.find(z=>z.id===sid)?.display_name||'',bill:b?`${billTable(b)} ${clBillName(b)}`:'なし'}); again(); }); }
// ② の「退」で 退勤／アフター を切り替え（アフターの打刻をし忘れた子を、アフターの欄に出す）。時刻を変えない時は罰金なし
async function clPunchOut(id,t,after){ const s=staffAll.find(x=>x.id===id); const wi=await sb.rpc('pos_waive_info',{p_staff:id,p_type:'clock_out'}); const kind=t&&t.after?'after':'clock_out';
  const w={...(wi.data||{}),label:s?.display_name||'',kind,at:t&&t.out?new Date(t.out).getTime():null}; const v=await uiTime('clock_out',w); if(!v) return; const by=await askBy(); if(by===null) return; /* 修正した黒服を残す */
  const r=await sb.rpc('pos_punch_out',{p_staff:id,p_kind:v.kind||kind,p_at:v.at}); if(r.error){ await uiConfirm(r.error.message); return; } if(by) await punchBy(id,'clock_out',by); attDrop();
  if(v.w){ const q=await sb.rpc('pos_waive_request',{p_staff:id,p_type:'clock_out',p_applicant:v.w.applicant,p_reason:v.w.reason}); if(q.error) await uiConfirm('打刻は記録しました。免除申請は送信できませんでした：'+q.error.message); else toast('免除申請を送信しました'); } else toast((v.kind||kind)==='after'?'アフターを記録しました':'退勤を記録しました'); after(); }
// 閉店作業「① お客様登録」（一番上）。伝票ごとにお客様を追加し、確認者を選んで完了 → 出勤したキャストへ連絡先交換の LINE（オーナー「閉店作業の一番最初に伝票のお客様の登録。完了次第、女の子に LINE」）
// 1組1行（卓・来店時刻・人数・お名前・未登録 n名・＋お客様）。お名前を押すとメモ。× は会計の後にここで追加したお客様だけ（会計の時のお客様は伝票で修正）。未登録が残っていても確かめの箱で止めて完了できる
const CL_REG='お客様登録の完了';
async function clRegRender(d){ const el=$('clReg'); if(!el) return; if(!staffAll.length) await loadStaffAll();
  const [bl,lg]=await Promise.all([ sb.from('bills').select('id,status,table_id,table_name,guest_count,opened_at,closed_at,bill_customers(customer_id,created_at),bill_casts(staff_id,is_kakari)').eq('store_id',store.id).eq('business_date',d).neq('status','void').order('opened_at'),
    sb.from('pos_audit_log').select('created_at,detail').eq('store_id',store.id).eq('action',CL_REG).eq('detail->>business_date',d).order('created_at',{ascending:false}).limit(1) ]);
  if(!$('clReg')||clDate!==d) return; if(bl.error||lg.error){ el.innerHTML=RDERR; return; }
  const done=(lg.data||[])[0]; if(done){ const n=await sb.from('pos_audit_log').select('id',{count:'exact',head:true}).eq('store_id',store.id).eq('action','連絡先交換を LINE で聞く').eq('detail->>business_date',d); if(!$('clReg')||clDate!==d) return;
    el.innerHTML=`<div style="font-size:16px;font-variant-numeric:tabular-nums">${esc(done.detail?.by||'')}　<small class="muted">${hmJst(done.created_at)}</small>　完了${n.count?`　<small class="muted">連絡先交換の LINE ${n.count}名</small>`:''}</div>`; return; }
  const B=bl.data||[]; if(!B.length){ el.innerHTML='<div class="muted">伝票なし</div>'; return; }
  const cnm=id=>customers.find(c=>c.id===id)?.name||'', un=b=>Math.max((b.guest_count||0)-(b.bill_customers||[]).length,0), total=B.reduce((a,b)=>a+un(b),0);
  const late=(b,c)=>b.closed_at&&c.created_at&&c.created_at>b.closed_at;
  const who=staffAll.filter(s=>s.is_active&&(s.kind==='hall'||(s.kakari_only&&s.display_name!=='店')));
  el.innerHTML=clRegHtml(B,un,late,who,cnm,total);
  clRegWire(el,d,B,total,cnm); }
/* ① 来店のお客様の登録の画面のボタン（完了・お客様を足す・外す・メモ） */
function clRegWire(el,d,B,total,cnm){
  $('clRegWho').onchange=()=>{ $('clRegDone').disabled=!$('clRegWho').value; };
  $('clRegDone').onclick=guard($('clRegDone'),async()=>{ if(total&&!await uiConfirm(`未登録が ${total}名います。完了しますか？`)) return; const r=await sb.rpc('pos_cust_reg_done',{p_day:d,p_by:$('clRegWho').value}); if(r.error){ toast(r.error.message); return; } toast(r.data?.sent?`完了しました（連絡先交換の LINE ${r.data.sent}名）`:'完了しました'); clRegRender(d); });
  el.querySelectorAll('[data-clradd]').forEach(x=>x.onclick=()=>{ const b=B.find(z=>z.id===x.dataset.clradd); const on=new Set((b.bill_customers||[]).map(c=>c.customer_id));
    custBill=b; custPick=async c=>{ custBill=null; if(!c) return; if(on.has(c.id)){ toast('この伝票に登録済です'); return; } const r=await sb.rpc('pos_rows_add',{p_table:'bill_customers',p:{bill_id:b.id,customer_id:c.id}}); if(r.error&&!r.error.message.includes('duplicate')){ toast(r.error.message); return; } if(!r.error) await logOp('お客様を伝票に追加',{customer:c.name,table:billTable(b),date:d}); clRegRender(d); };
    $('custCancel').textContent='キャンセル'; $('custSearch').value=''; renderCust(''); $('custModal').classList.add('on'); $('custSearch').focus(); });
  el.querySelectorAll('[data-clrx]').forEach(x=>x.onclick=async()=>{ const [bid,cid]=x.dataset.clrx.split('|'); if(!await uiConfirm(`${cnm(cid)} 様を伝票から削除しますか？`)) return; const r=await sb.rpc('pos_rows_del',{p_table:'bill_customers',p_where:{bill_id:(bid)??null,customer_id:(cid)??null}}); if(r.error){ toast(r.error.message); return; } await logOp('お客様を伝票から外す',{customer:cnm(cid),date:d}); clRegRender(d); });
  el.querySelectorAll('[data-clrm]').forEach(x=>x.onclick=()=>clRegMemo(x.dataset.clrm));
}
/* ① 来店のお客様の登録の画面の文 */
function clRegHtml(B,un,late,who,cnm,total){
  return `<div style="margin-bottom:4px">伝票ごとに、ご来店のお客様全員の名前を登録してください。<br>完了すると、出勤したキャストへ連絡先交換の LINE が届きます。</div><small class="muted">お名前を押すとメモを表示します</small>
    <div class="list">${B.map(b=>{ const cs=[...(b.bill_customers||[])].sort((x,y)=>String(x.created_at).localeCompare(String(y.created_at))); return `<div class="item" style="padding:6px 10px;gap:8px"><b style="width:56px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(billTable(b))}</b><span class="muted" style="width:48px;flex:none;font-size:14px;font-variant-numeric:tabular-nums">${hm5(b.opened_at)}</span><span class="muted" style="width:36px;flex:none;font-size:14px">${b.guest_count}名</span>
      <span class="n" style="flex:1;min-width:0">${cs.length?cs.map(c=>`<span data-clrm="${c.customer_id}" style="white-space:nowrap;border-bottom:1px dotted #999;cursor:pointer">${esc(cnm(c.customer_id))}</span>${late(b,c)?`<button class="xb" data-clrx="${b.id}|${c.customer_id}" aria-label="削除" style="font-size:15px;padding:0 2px">×</button>`:''}`).join('・'):'<span class="muted">―</span>'}</span>
      <span style="width:84px;flex:none;text-align:right;font-size:14px;color:var(--warn)">${un(b)?`未登録 ${un(b)}名`:''}</span><button class="ghost sm" style="flex:none" data-clradd="${b.id}">＋お客様</button></div>`; }).join('')}</div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:8px"><select id="clRegWho" style="width:auto;min-width:0"><option value="">確認者</option>${who.map(s=>`<option value="${s.id}">${esc(s.display_name)}</option>`).join('')}</select><button class="primary sm" id="clRegDone" disabled>完了</button></div>`;
}
// ① のメモ：その場で編集（POS の顧客の画面と同じく直接。ほかの端末で先に変わっていたら行ごとに合わせる）
async function clRegMemo(id){ const q=await sb.from('customers').select('id,name,memo').eq('id',id).maybeSingle(); if(q.error||!q.data){ toast(q.error?.message||'お客様が見つかりません'); return; } const c=q.data;
  const m=mkModal(60); m.innerHTML=`<div class="box" style="width:min(520px,94vw)"><button class="xb dx" data-x aria-label="閉じる">×</button><div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(c.name)} 様　メモ</div><textarea data-m rows="8" style="width:100%">${esc(c.memo||'')}</textarea><div class="bar" style="justify-content:flex-end"><button class="primary" data-s>保存</button></div></div>`;
  document.body.appendChild(m); m.querySelector('[data-x]').onclick=()=>m.remove();
  m.querySelector('[data-s]').onclick=guard(m.querySelector('[data-s]'),async()=>{ let v=m.querySelector('[data-m]').value.replace(/\s+$/,'')||null; if(v===(c.memo||null)){ m.remove(); return; }
    const now=await sb.from('customers').select('memo').eq('id',id).maybeSingle(); if(now.error){ toast(now.error.message); return; } let merged=false;
    if((now.data?.memo||null)!==(c.memo||null)){ const r=memoMerge(c.memo,v,now.data?.memo), ch=[]; for(const x of r.conflicts){ const p=await pickClash(x); if(p==null) return; ch.push(p); } v=memoMergeDone(r,ch).replace(/\s+$/,'')||null; merged=true; }
    const u=await sb.rpc('pos_customer_memo',{p_id:id,p_memo:v}); if(u.error){ toast(u.error.message); return; } await logOp('顧客変更',{name:c.name,fields:['memo']},null,true);
    const lc=customers.find(x=>x.id===id); if(lc) lc.memo=v; m.remove(); toast(merged?'ほかの人の変更と合わせて保存しました':'保存しました'); }); }
