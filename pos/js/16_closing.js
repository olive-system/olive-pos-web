// ---------- 閉店作業（入出金の登録 → ボトル残量 → 顧客メモの更新申請の確認（顧客ウェブサイトから届いた分） → 今日出たお酒・ドリンク → レジ金合わせ → 月間一覧） ----------
const DENOMS=[[10000,'1万円札'],[5000,'5千円札'],[2000,'2千円札'],[1000,'千円札'],[500,'500円玉'],[100,'100円玉'],[50,'50円玉'],[10,'10円玉'],[5,'5円玉'],[1,'1円玉']];
let clDate=null, clCounts={}, clDeposit=0, clOpening=0, clMonth=null, clCtx=null, clReqAuthor='';
function clRange(d){ const a=new Date(`${d}T08:00:00`); return [a.toISOString(), new Date(a.getTime()+24*3600*1000).toISOString()]; }
// v10.43：閉店作業の④ 今日出たお酒・ドリンク（発注用）。取消の伝票・取消した注文は除く。フード・その他（h.c・b.c・立替金など）は出さない
function clOrderHtml(od){ if(od.error) return `<div class="muted">${esc(od.error.message)}</div>`; const skip=new Set(categories.filter(c=>['フード','その他'].includes(c.name)).map(c=>c.id)); const agg=new Map();
  (od.data||[]).forEach(i=>{ const cid=i.category_id||products.find(p=>p.id===i.product_id)?.category_id||null; if(skip.has(cid)) return; const k=i.product_id||i.name; const a=agg.get(k)||{name:i.name,cid,qty:0}; a.qty+=Number(i.qty)||0; agg.set(k,a); });
  const items=[...agg.values()].filter(a=>a.qty>0); if(!items.length) return '<div class="muted">なし</div>';
  const cats=[...categories.map(c=>c.id),null]; return `<div class="list">${cats.map(cid=>{ const xs=items.filter(a=>(a.cid||null)===cid).sort((a,b)=>b.qty-a.qty); if(!xs.length) return ''; const cn=categories.find(c=>c.id===cid)?.name||'未分類'; return `<div class="item" style="flex-wrap:wrap;gap:4px 14px"><b style="flex:0 0 auto">${esc(cn)}</b>${xs.map(a=>`<span>${esc(a.name)} ×${a.qty}</span>`).join('')}</div>`; }).join('')}</div>`; }
const clNum=v=>{ const n=parseInt(String(v??'').replace(/[^0-9]/g,''),10); return isNaN(n)?0:n; };
// v10.61：閉店作業④ 係・同伴・反応◎の登録に間違いがないかを伝票一覧で確認し、確認者を記録する（操作ログに残る。誰が確認したかで責任の所在が分かる）
const CL_CHK='伝票の確認（係・同伴・反応◎）';
// v11.59・SQL 130：⑤ 着物（ドレス新調日の免除。オーナー 2026-10-16「閉店作業で、着物の項目。本日出勤のキャストの中から選ぶ形で」）
// 出勤したキャストから着物の子を押す → その月のドレス新調日が免除（付いた罰金は取消）。もう一度押すと取消。ドレス新調日をしない店は出さない
// v11.60・SQL 131：カード売上の照合（Square と POS。オーナー 2026-10-16「スクエアと API 連携して自動で照合し結果を表示。照合ボタン」）。閉店作業を開くと自動、「照合」でやり直し
async function clCardRender(d,btn){ const el=$('clCard'); if(!el) return; el.innerHTML='<div class="muted">カード売上の照合…</div>';
  const q=await sb.rpc('pos_card_check',{p_day:d}); if(!$('clCard')||clDate!==d) return;
  const go='<button class="sm" id="clCardGo">照合</button>';
  if(q.error){ el.innerHTML=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>カード売上の照合</b><span style="color:var(--warn)">${esc(q.error.message)}</span>${go}</div>`; }
  else if(!q.data.set){ el.innerHTML='<div class="muted">カード売上の照合：Square がつながっていません（管理サイトの「Square 連携」）</div>'; return; }
  else { const D=q.data, ok=D.diff===0;
    el.innerHTML=`<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;${ok?'':'background:var(--warn-soft)'}"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>カード売上の照合</b>${ok?'<span class="badge k">一致</span>':`<b style="color:var(--warn)">差 ${D.diff>0?'+':''}${yen(D.diff)}</b>`}<span style="flex:1"></span>${go}</div>
      <div style="display:grid;grid-template-columns:auto auto 1fr;gap:2px 14px;margin-top:6px;font-size:15px"><span>Square</span><b class="right">${yen(D.square.total)}</b><span class="muted">${D.square.count}件</span><span>POS</span><b class="right">${yen(D.pos.total)}</b><span class="muted">${D.pos.count}件</span></div></div>`; }
  const b=$('clCardGo'); if(b) b.onclick=()=>clCardRender(d,true); if(btn&&!q.error) toast('照合しました'); }
// v11.71・SQL 145：閉店作業「⑦ TODO」（v11.72 でレジ金合わせの前に。オーナー 2026-10-18）（オーナー 2026-10-18「POS の閉店作業で警告する。絶対に終わらせる。できない場合は理由を書かせる」）。未で理由も無いと精算を保存できない（データベースでも止める）
async function clTodoRender(d){ const el=$('clTodo'); if(!el) return; const q=await sb.rpc('pos_todos',{p_day:d}); if(!$('clTodo')||clDate!==d) return;
  if(q.error){ el.innerHTML=`<div class="muted">${esc(/pos_todos/.test(q.error.message)?'SQL 145 が未実行です':q.error.message)}</div>`; return; }
  const L=q.data||[]; if(!L.length){ el.innerHTML='<div class="muted">この日の TODO はありません</div>'; return; }
  const n=L.filter(x=>x.status==='open').length;
  el.innerHTML=(n?`<div style="color:var(--warn);font-weight:700;margin-bottom:6px">終わっていない TODO が ${n}つ</div>`:'<div style="color:var(--pri);font-weight:700;margin-bottom:6px">全部完了</div>')+L.map(x=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--line);font-size:15px"><span style="flex:1;min-width:0">${esc(x.name)}${x.carry?` <small class="muted">休日分 ${+x.day.slice(5,7)}/${+x.day.slice(8,10)}</small>`:''}${x.late?' <b style="color:var(--warn);font-size:13px">17:00 超過</b>':''}</span>${x.status==='done'?`<b style="color:var(--ok)">完了</b><small class="muted">${esc(x.by||'')}</small>`:x.status==='skip'?`<small class="muted" style="max-width:50%">理由：${esc(x.reason||'')}</small>`:`<b style="color:var(--warn)">未完了</b><button class="ghost sm" data-tdr="${x.id}" data-tdi="${L.indexOf(x)}">理由</button>`}</div>`).join('')+'<div class="muted" style="font-size:13px;margin-top:6px">完了は黒服マイページで（写真）</div>';
  el.querySelectorAll('[data-tdr]').forEach(b=>b.onclick=async()=>{ const x=L[+b.dataset.tdi]; const r=await uiPrompt(`${x.name}\nできない理由`,''); if(r==null) return; if(!r.trim()){ toast('理由を入力してください'); return; } const z=await sb.rpc('pos_todo_skip',{p_item:x.id,p_day:x.carry?x.day:d,p_reason:r.trim()}); /* v12.13・SQL 234：休日分はその日付 */ if(z.error){ await uiAlert(z.error.message); return; } toast('理由を入れました'); clTodoRender(d); }); }
async function clKmRender(d){ const el=$('clKmBox'); if(!el) return; const q=await sb.rpc('pos_kimono_day',{p_day:d}); if(!$('clKmBox')||clDate!==d) return;
  if(q.error||!q.data?.enabled){ el.innerHTML=''; return; } const C=q.data.casts||[], mo=Number(d.slice(5,7)), md=x=>{ const [,m,dd]=String(x).split('-').map(Number); return `${m}/${dd}`; };
  el.innerHTML=`<h2 style="margin:18px 0 8px">⑤ 着物（ドレス新調日の免除）</h2>${C.length?`<div style="display:flex;flex-wrap:wrap;gap:8px">${C.map(c=>`<button type="button" class="${c.kimono?'primary':''}" data-km="${c.id}" ${c.done||c.other_day?'disabled':''} style="min-width:96px">${esc(c.name)}${c.kimono?'　着物':''}${c.done?'<br><small>新調済み</small>':''}${c.other_day?`<br><small>着物 ${md(c.other_day)}</small>`:''}</button>`).join('')}</div>
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
// v12.22：② 出退勤確認（③ マイページの閉店作業の前）（オーナー 2026-10-28「閉店作業で全員の出退勤時間の確認。本日打刻があった人の一覧（編集可能）。最終のお客様の退店時間と一緒に」「POS 画面でのみ。②に入れたい。コンパクトに」「列揃えたい」）
// 時刻は在籍と同じ（丸めた時刻）。キャストの時刻を押すと在籍と同じ修正（罰金も同じ）。黒服・体験は表示のみ。修正できるのは今日の営業日だけ
async function clPunchRender(d){ const el=$('clPunch'); if(!el) return; if(!staffAll.length) await loadStaffAll();
  const [ev,bl,lt]=await Promise.all([ sb.from('attendance_events').select('staff_id,event_type,event_at,rounded_at,is_corrected,orig_at,orig_rounded_at').eq('store_id',store.id).eq('business_date',d).in('event_type',['clock_in','clock_out','douhan','after']).order('event_at'),
    sb.from('bills').select('status,closed_at,table_id,bill_customers(customer_id)').eq('store_id',store.id).eq('business_date',d).neq('status','void'), sb.rpc('pos_close_late',{p_date:d}) ]);
  if(!$('clPunch')||clDate!==d) return; if(ev.error||bl.error){ el.innerHTML=`<div class="muted">出退勤を読み込めません。再度開いてください：${esc((ev.error||bl.error).message)}</div>`; return; }
  const T={}, Q=900000; (ev.data||[]).forEach(e=>{ const t=T[e.staff_id]||(T[e.staff_id]={}); if(e.event_type==='clock_out'||e.event_type==='after'){ t.out=e.rounded_at||Math.floor(new Date(e.event_at).getTime()/Q)*Q; t.outFix=e.is_corrected; t.outO=e.orig_at?(e.orig_rounded_at||Math.floor(new Date(e.orig_at).getTime()/Q)*Q):null; t.after=e.event_type==='after'; }
    else if(!t.in){ t.in=e.rounded_at||Math.ceil(new Date(e.event_at).getTime()/Q)*Q; t.inFix=e.is_corrected; t.inO=e.orig_at?(e.orig_rounded_at||Math.ceil(new Date(e.orig_at).getTime()/Q)*Q):null; t.douhan=e.event_type==='douhan'; } });
  const B=bl.data||[], open=B.filter(b=>b.status==='open').length, last=B.filter(b=>b.closed_at).sort((a,b)=>a.closed_at<b.closed_at?1:-1)[0];
  const lastHtml=open?`<span style="color:var(--warn)">来店中 ${open}組</span>`:last?`最終退店 <b style="font-size:18px">${hm(last.closed_at)}</b> <small class="muted">${esc(tables.find(x=>x.id===last.table_id)?.name||'')} ${esc((last.bill_customers||[]).map(c=>customers.find(x=>x.id===c.customer_id)?.name).filter(Boolean).slice(0,1).map(n=>n+' 様').join(''))}</small>`:'<span class="muted">伝票なし</span>';
  const edit=d===businessDate(), P=Object.keys(T).map(id=>({id,s:staffAll.find(x=>x.id===id)||{},t:T[id]})).sort((a,b)=>((a.s.kind==='hall')-(b.s.kind==='hall'))||(a.t.in||0)-(b.t.in||0)||(a.s.sort_order||0)-(b.s.sort_order||0));
  const tm=(on,k,v,fix,key,id,o)=>`<span ${on?`data-${key}="${id}" `:''}style="font-size:14px;white-space:nowrap;padding:2px 4px;font-variant-numeric:tabular-nums;border-bottom:1px dotted ${on?'#999':'transparent'};${on?'cursor:pointer;':''}color:${fix?'var(--warn)':on?'inherit':'var(--muted)'}">${k}${o&&hm(o)!==v?`<small style="color:var(--muted)">${hm(o)}→</small>`:''}${v}</span>`;
  // v12.29・SQL 290：シフトの列と遅刻（遅刻連絡／連絡なし遅刻・罰金。免除は「免除」。黒服は金額なし）（オーナー 2026-10-29「これ、遅刻なんだよね。こーゆうこと、ここで知りたいな」）
  const LT={}; if(!lt.error) (lt.data||[]).forEach(x=>{ LT[x.staff_id]=x; }); const sW=P.some(x=>LT[x.id])?96:0, lW=P.some(x=>LT[x.id]?.late)?210:0;
  const lateHtml=(s,l)=>!l?.late?'':(l.notice?'<span class="badge gray">遅刻連絡</span>':'<span class="badge warnb">連絡なし遅刻</span>')+(l.notice==='approved'?' <span class="badge gray">免除</span>':s.kind!=='hall'&&Number(l.fine)>0?` <span style="color:var(--warn);font-size:14px;white-space:nowrap">罰金 ${Number(l.fine).toLocaleString()}円</span>`:'');
  const oW=P.some(x=>x.t.inO||x.t.outO)?46:0; // v12.23・SQL 282：修正した打刻は「最初の打刻の丸めた時刻→今」。ある時は列を広げて出・退をそろえる
  const row=({id,s,t})=>{ const on=edit&&s.kind!=='hall'&&!s.is_trial, tag=s.kind==='hall'?'黒服':s.is_trial?'体験':t.douhan?'同伴':'';
    return `<div class="item" style="padding:6px 10px"><span class="n" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.display_name||'')}${tag?`<small class="muted"> ${tag}</small>`:''}</span>${sW?`<span class="muted" style="width:${sW}px;flex:none;font-size:14px;white-space:nowrap;font-variant-numeric:tabular-nums">${LT[id]?'シフト '+LT[id].shift:''}</span>`:''}<span style="width:${84+oW}px;flex:none">${tm(on,'出 ',t.in?hm(t.in):'―',t.inFix||!t.in,'pfin',id,t.inO)}</span><span style="width:${118+oW}px;flex:none">${t.out?tm(on,t.after?'アフター ':'退 ',hm(t.out),t.outFix,'pfout',id,t.outO):tm(on,'','未退勤',s.kind!=='hall','pfout',id)}</span>${lW?`<span style="width:${lW}px;flex:none;display:flex;gap:6px;align-items:center">${lateHtml(s,LT[id])}</span>`:''}</div>`; };
  el.innerHTML=`<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px"><span>${lastHtml}</span>${P.length&&edit?'<small class="muted">キャストの時刻を押して修正します。赤字は修正済・未退勤</small>':''}</div>
    <div class="list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${330+oW*2+sW+lW}px,1fr));column-gap:18px">${P.map(row).join('')||'<div class="muted">打刻なし</div>'}</div>`;
  const again=()=>clPunchRender(d);
  el.querySelectorAll('[data-pfin]').forEach(b=>b.onclick=()=>punchFix(b.dataset.pfin,'clock_in',again)); el.querySelectorAll('[data-pfout]').forEach(b=>b.onclick=()=>punchFix(b.dataset.pfout,'clock_out',again)); }
