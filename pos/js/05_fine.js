// ---------- 罰金の入力と一覧・反応◎の一覧（在籍キャストの詳細から開く） ----------
// v10.66：罰金（staff_fines・SQL 041）。1件ごとに理由と金額を残す。取消は消さずに is_void。操作ログあり
// v11.03：罰金の種類（fine_types・SQL 052。管理サイト「報酬・罰金項目」で店舗ごとに決める）から選ぶ。円＝そのまま登録（個数を入れる種類は 金額×個数）／日給の％＝その人の日給で計算／時給の％＝「時給×○%」で記録し、月末に確定した時給で計算／その都度入れる・その他＝金額を入れる
const fineAmt=x=>x.wage_pct?`時給×${x.wage_pct}%`:`${Number(x.amount||0).toLocaleString()}円`;
const fineSumTxt=(y,p)=>p?`${y?Number(y).toLocaleString()+'円＋':''}時給×${p}%`:`${Number(y||0).toLocaleString()}円`;
async function fineDlg(id){ const st=staffAll.find(x=>x.id===id); const nm=st?.display_name||''; const bd=businessDate(); const m=mkModal(50); document.body.appendChild(m); const close=()=>{ m.remove(); renderCasts(); };
  const isHall=st?.kind==='hall', daily=!isHall&&st?.pay_type==='daily', dw=Number(st?.daily_wage||0);
  // v11.15・SQL 064：その月に免除の罰金（管理サイト「スタッフ設定」の罰金の免除）は灰色にして、押すと「免除です」。データベースでも付けられない
  const m1=bd.slice(0,7)+'-01', [ftR,ctR]=await Promise.all([sb.from('fine_types').select('*').eq('store_id',store.id).order('sort_order'), isHall?Promise.resolve({data:[]}):sb.from('cast_terms').select('month,only_month,exempt_fines').eq('staff_id',id).lte('month',m1).order('month',{ascending:false})]);
  const exempt=new Set(((ctR.data||[]).find(x=>x.month===m1||!x.only_month)?.exempt_fines)||[]); const types=(ftR.error?[]:(ftR.data||[])).filter(t=>isHall?(t.target==='all'&&(t.calc==='yen'||t.calc==='input')):(t.target==='all'||t.target===(daily?'daily':'hourly')));
  const hrs=Number(settings?.daily_hours||5);
  const F={id,st,nm,bd,m,close,isHall,daily,dw,ftR,exempt,types,hrs};
  await fineDraw(F); }
/* 罰金の小窓の部品（fineDlg の入れ物 F を受け取る） */
function fineTAmt(F,t){ const {dw}=F; return t.calc==='daily_late'||t.calc==='daily_early'?`時間分${t.value?`＋日給×${t.value}%`:''}`:t.calc==='yen'?`${Number(t.value).toLocaleString()}円${t.per_unit?'／1回':''}`:t.calc==='hourly_pct'?`時給×${t.value}%`:t.calc==='daily_pct'?(dw?`${Math.round(dw*t.value/100).toLocaleString()}円（日給×${t.value}%）`:`日給×${t.value}%`):'金額を入れる'; }
async function fineIns(F,o){ const {id,nm,bd}=F; const e=(await insOnce('staff_fines',{store_id:store.id,staff_id:id,business_date:bd,source:'manual',...o})).error; if(e){ toast('保存エラー：'+e.message); return false; } await logOp('罰金',{name:nm,amount:o.amount,reason:o.reason,...(o.wage_pct?{wage_pct:o.wage_pct}:{})},null,true); toast('罰金を保存しました'); return true; }
async function fineAsk(F,r0,a0){ const {nm}=F; const rs0=await uiDlg(`${nm}　罰金の理由`,true,r0,'理由を入力してください'); if(rs0==null) return null; const rs=rs0.trim(); if(!rs){ toast('理由を入力してください'); return null; } const v=await uiPrompt(`${nm}　罰金の金額（円）`,String(a0)); if(v==null) return null; const a=numIn(v); if(!a){ toast('金額を入力してください'); return null; } return {rs,a}; }
async function finePick(F,t){ const {id,nm,bd,dw,hrs}=F; const ins=o=>fineIns(F,o), ask=(r,a)=>fineAsk(F,r,a);
  if(!t){ const q=await ask('',0); return q?ins({amount:q.a,reason:q.rs}):false; }
    if(t.calc==='yen'){ let n=1; if(t.per_unit){ const v=await uiPrompt(`${nm}　${t.name}\n回数（1回 ${Number(t.value).toLocaleString()}円）`,'1'); if(v==null) return false; n=numIn(v); if(!n){ toast('回数を入力してください'); return false; } } return ins({amount:t.value*n,reason:t.per_unit&&n>1?`${t.name}（${n}回）`:t.name}); } /* v11.65：個数→回数（管理サイトの罰金は円ならいつも回数を入れられる） */
    if(t.calc==='daily_pct'){ if(!dw){ await uiAlert(`${nm} の日給が入っていません。\nキャストの詳細で日給の金額を入力してから、再度選んでください`); return false; } return ins({amount:Math.round(dw*t.value/100),reason:`${t.name}（日給×${t.value}%）`}); }
    if(t.calc==='hourly_pct') return ins({amount:0,wage_pct:t.value,reason:t.name});
    // v11.04・SQL 053：日給の人の遅刻・早上がり。決まった時刻と打刻の差 × 時間給（日給÷所定時間）＋ 日給の○%（無断の時）
    // v11.05：打刻はタイムカードの丸め（rounded_at・round_punch。アフターの延長もここに入っている）を使う。無い時は 出勤15分切り上げ・退勤15分切り下げ。アフターの打刻は退勤の代わり
    if(t.calc==='daily_late'||t.calc==='daily_early') return fineDailyLate(F,t);
    const v=await uiPrompt(`${nm}　${t.name}\n罰金の金額（円）`,''); if(v==null) return false; const a=numIn(v); if(!a){ toast('金額を入力してください'); return false; } return ins({amount:a,reason:t.name});
}
/* 日給の人の遅刻・早上がりの罰金（決まった時刻と丸めた打刻の差 × 時間給 ＋ 日給の○%） */
async function fineDailyLate(F,t){ const {id,nm,bd,dw,hrs}=F; const ins=o=>fineIns(F,o);
  if(!dw){ await uiAlert(`${nm} の日給が入っていません。\nキャストの詳細で日給の金額を入力してから、再度選んでください`); return false; }
  const late=t.calc==='daily_late', ev=await sb.from('attendance_events').select('*').eq('staff_id',id).eq('business_date',bd).in('event_type',['clock_in','clock_out','after']).order('event_at'); if(ev.error){ toast(ev.error.message); return false; }
  const L2=(ev.data||[]), pin=L2.find(e=>e.event_type==='clock_in'), pout=L2.filter(e=>e.event_type==='clock_out'||e.event_type==='after').pop(); const p0=late?pin:pout;
  if(!p0){ await uiAlert(`${nm} の${late?'出勤':'退勤（アフター）'}の打刻がありません。\n先にタイムカード（または在籍リストの「${late?'出':'退'}」）で打刻を入力してください`); return false; }
  const Q=900000, day0=new Date(`${bd}T00:00:00`).getTime(); let pt=p0.rounded_at?new Date(p0.rounded_at).getTime():late?Math.ceil(new Date(p0.event_at).getTime()/Q)*Q:Math.floor(new Date(p0.event_at).getTime()/Q)*Q; let aft='';
  if(!late&&p0.event_type==='after') aft=pt>Math.floor(new Date(p0.event_at).getTime()/Q)*Q?'アフター・延長あり':'アフター';
  const v=await uiPrompt(`${nm}　${t.name}\n決まった${late?'出勤':'退勤'}時刻（例 ${late?'20:00':'1:00'}）\n打刻：${hmJst(p0.event_at)}${aft?`（${aft}）`:''}　→ 計算に使う時刻 ${hmJst(pt)}`,''); if(v==null) return false;
  const mt=toHan(v).replace(/\s/g,'').match(/^(\d{1,2})(?:[:時](\d{1,2})?分?|(\d{2}))?$/); const h=mt?+mt[1]:NaN, mi=mt?+(mt[2]||mt[3]||0):0;
  if(!mt||h>29||mi>59){ await uiAlert('時刻は 20:00 のように入力してください'); return false; }
  const sch=day0+((h<12?h+24:h)*60+mi)*60000; const min=Math.round((late?pt-sch:sch-pt)/60000);
  if(min<=0){ await uiAlert(late?`出勤 ${hmJst(pt)}（丸めた時刻）は、決まった出勤時刻 ${hmJst(sch)} より遅れていません`:`${aft?'アフター':'退勤'} ${hmJst(pt)}（丸めた時刻）は、決まった退勤時刻 ${hmJst(sch)} より早くありません`); return false; }
  const hw=dw/hrs, ta=Math.round(hw*min/60), add=t.value?Math.round(dw*t.value/100):0, f=n=>Number(n).toLocaleString();
  if(!await uiConfirm(`${nm}　${t.name}\n${late?'遅れた':'早く上がった'}時間 ${min}分（${late?'出勤':'退勤'}予定 ${hmJst(sch)}・打刻 ${hmJst(pt)}）\n時間分 ${f(ta)}円（時間給 ${f(Math.round(hw))}円 ＝ 日給 ${f(dw)}円 ÷ ${hrs}時間）${add?`\n＋日給×${t.value}% ${f(add)}円`:''}\n合計 ${f(ta+add)}円 で登録しますか？`)) return false;
  return ins({amount:ta+add,reason:`${t.name}（予定${hmJst(sch)}・${aft?'アフター':'打刻'}${hmJst(pt)}・${min}分${add?`＋日給×${t.value}%`:''}）`});
}
function finePickView(F){ const {m,nm,isHall,daily,dw,ftR,exempt,types}=F; const tAmt=t=>fineTAmt(F,t), pick=t=>finePick(F,t), draw=()=>fineDraw(F);
  m.innerHTML=`<div class="box" style="width:520px"><div style="font-size:18px;font-weight:700;margin-bottom:4px">${esc(nm)}　罰金を選ぶ</div><div class="muted" style="font-size:13px;margin-bottom:8px">${isHall?'黒服':daily?`日給の人（日給 ${dw?dw.toLocaleString()+'円':'未設定'}）`:'時給の人'}${types.some(t=>t.calc==='hourly_pct')?'　時給の％は月末に決まった時給で計算します':''}${ftR.error?'<br><span style="color:var(--warn)">罰金の種類を読み込めません（SQL 052 が未実行かもしれません）</span>':''}</div><div style="max-height:56vh;overflow:auto">${types.map((t,i)=>`<button class="ghost" data-fp="${i}" style="display:flex;width:100%;justify-content:space-between;align-items:center;gap:10px;text-align:left;font-size:16px;padding:12px;margin-bottom:6px${exempt.has(t.name)?';opacity:.45;background:var(--soft)':''}"><span style="min-width:0">${esc(t.name)}</span><b style="flex:none;font-size:15px">${exempt.has(t.name)?'免除':esc(tAmt(t))}</b>`+
    `</button>`).join('')}<button class="ghost" data-fp="x" style="display:flex;width:100%;justify-content:space-between;align-items:center;gap:10px;text-align:left;font-size:16px;padding:12px"><span>その他</span><b style="flex:none;font-size:15px">理由と金額を入れる</b></button></div><div class="bar" style="justify-content:flex-end"><button class="ghost" data-fb>戻る</button></div></div>`;
    m.querySelector('[data-fb]').onclick=draw; m.querySelectorAll('[data-fp]').forEach(b=>b.onclick=guard(b,async()=>{ const t=b.dataset.fp==='x'?null:types[+b.dataset.fp]; if(t&&exempt.has(t.name)){ await uiAlert(`${nm} は「${t.name}」が免除です`); return; } if(await pick(t)) draw(); }));
}
async function fineDraw(F){ const {id,nm,bd,m,close}=F; const pickView=()=>finePickView(F), ask=(r,a)=>fineAsk(F,r,a), draw=()=>fineDraw(F);
  const r=await sb.from('staff_fines').select('*').eq('staff_id',id).eq('business_date',bd).order('created_at'); if(r.error){ m.remove(); await uiConfirm(r.error.message); renderCasts(); return; } const L=(r.data||[]).filter(x=>!x.is_void); const W=(r.data||[]).filter(x=>x.is_void&&x.waive==='approved'); /* v12.24・SQL 283：免除申請で取り消した罰金は線を引いて残す */ const tot=fineSumTxt(L.reduce((a,x)=>a+Number(x.amount||0),0),L.reduce((a,x)=>a+Number(x.wage_pct||0),0));
    m.innerHTML=`<div class="box" style="width:460px"><button class="xb dx" data-fc aria-label="閉じる">×</button><div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(nm)}　罰金（本日）</div><div style="max-height:50vh;overflow:auto">${L.length||W.length?L.map(x=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;border-bottom:1px solid var(--line);font-size:16px"><span style="flex:1;min-width:0">${esc(x.reason)}${wvBadge(x)}</span><b style="flex:none">${esc(fineAmt(x))}</b>${x.wage_pct?'':`<button class="sm ghost" data-fe="${x.id}">変更</button>`}<button class="sm ghost" data-fv="${x.id}">取消</button></div>`).join('')+W.map(x=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;border-bottom:1px solid var(--line);font-size:16px;color:var(--muted)"><span style="flex:1;min-width:0"><s>${esc(x.reason)}</s>${wvBadge(x)}</span>`+
    `<s style="flex:none">${esc(fineAmt(x))}</s></div>`).join(''):'<div class="muted" style="padding:8px 2px">なし</div>'}</div><div style="display:flex;justify-content:space-between;padding:10px 2px;font-size:16px"><span>合計</span><b>${esc(tot)}</b></div><div class="bar" style="justify-content:flex-end"><button class="ghost" data-fa>＋罰金</button></div></div>`;
    m.querySelector('[data-fc]').onclick=close;
    m.querySelector('[data-fa]').onclick=pickView;
    m.querySelectorAll('[data-fe]').forEach(b=>b.onclick=async()=>{ const x=L.find(z=>z.id===b.dataset.fe); const q=await ask(x.reason,x.amount); if(!q||(q.a===Number(x.amount)&&q.rs===x.reason)) return; const e=(await sb.rpc('pos_fine_edit',{p_id:x.id,p_amount:q.a,p_reason:q.rs})).error; if(e){ toast('保存エラー：'+e.message); return; } await logOp('罰金の変更',{name:nm,before:{amount:x.amount,reason:x.reason},amount:q.a,reason:q.rs},null,true); toast('変更しました'); draw(); });
    m.querySelectorAll('[data-fv]').forEach(b=>b.onclick=async()=>{ const x=L.find(z=>z.id===b.dataset.fv); if(!await uiConfirm('この罰金を取り消しますか？')) return; const by=await askBy(); if(by===null) return; /* v12.74・SQL 389：取り消した黒服を操作ログに */ const e=(await sb.rpc('pos_fine_void',{p_id:x.id,p_by:by||null})).error; if(e){ toast('保存エラー：'+e.message); return; } if(!DBLOG) await logOp('罰金の取消',{name:nm,amount:x.amount,reason:x.reason,...(x.wage_pct?{wage_pct:x.wage_pct}:{})},null,true); toast('取り消しました'); draw(); });
}
// v10.66：罰金の一覧（日付・理由・金額）。在籍キャストの詳細で今月／累計をタップして開く
// v12.24・SQL 283：罰金免除申請のしるし（免除申請中／免除／却下）
const wvBadge=x=>x.waive==='pending'?' <span class="badge gray">免除申請中</span>':x.waive==='approved'?' <span class="badge gray">免除</span>':x.waive==='rejected'?' <span class="badge gray">却下</span>':'';
async function fineList(title,rows){ let box=$('uiDlgList'); if(!box){ box=document.createElement('div'); box.id='uiDlgList'; box.style.cssText='max-height:55vh;overflow:auto;margin:10px 0;font-size:15px'; $('uiDlgMsg').after(box); } const md=d=>{ const m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${m[1]===businessDate().slice(0,4)?'':m[1]+'/'}${+m[2]}/${+m[3]}`:''; };
  box.innerHTML=rows.length?rows.map(x=>`<div style="display:flex;gap:12px;padding:7px 2px;border-bottom:1px solid var(--line)"><span class="muted" style="flex:none;width:5.5em">${md(x.business_date)}</span><span style="flex:1">${esc(x.reason||'')}${wvBadge(x)}</span><span style="flex:none;text-align:right">${esc(fineAmt(x))}</span></div>`).join(''):'<div class="muted">なし</div>';
  try{ await uiAlert(title); } finally { box.remove(); } }
// v10.56：反応◎の一覧（日付・お客様・卓）。在籍キャストの詳細で今月／累計をタップして開く
async function goodList(title,rows){ let box=$('uiDlgList'); if(!box){ box=document.createElement('div'); box.id='uiDlgList'; box.style.cssText='max-height:55vh;overflow:auto;margin:10px 0;font-size:15px'; $('uiDlgMsg').after(box); } const md=d=>{ const m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${m[1]===businessDate().slice(0,4)?'':m[1]+'/'}${+m[2]}/${+m[3]}`:''; };
  box.innerHTML=rows.length?rows.map(x=>{ const b=x.bills; const cs=(b.bill_customers||[]).map(c=>customers.find(z=>z.id===c.customer_id)?.name).filter(Boolean); return `<div style="display:flex;gap:12px;padding:7px 2px;border-bottom:1px solid var(--line)"><span class="muted" style="flex:none;width:5.5em">${md(b.business_date)}</span><span style="flex:1">${cs.length?esc(cs.map(n=>n+' 様').join('・')):'<span class="muted">お客様なし</span>'}</span><span class="muted" style="flex:none">${b.guest_count?b.guest_count+'名':''}</span><span class="muted" style="flex:none;min-width:3em;text-align:right">${esc(billTable(b))}</span></div>`; }).join(''):'<div class="muted">なし</div>';
  try{ await uiAlert(title); } finally { box.remove(); } }
