// ---------- 在籍キャスト ----------
let cMode='today', cSorting=false, cDeleteMode=false, cSel=null, cPast=false; /* cPast：［退店・体験］の一覧（04_cast_leave.js の renderPast） */
$('navCasts').onclick=()=>{ cPast=false; renderCasts(); show('v-casts'); };
$('cTabToday').onclick=()=>{ cMode='today'; cPast=false; renderCasts(); };
$('cTabPast').onclick=()=>{ cPast=true; cSorting=false; renderCasts(); };
$('cTabAll').onclick=()=>{ cMode='all'; renderCasts(); };
$('cSort').onclick=()=>{ cSorting=!cSorting; cPast=false; renderCasts(); };
$('cSearch').oninput=()=>renderCasts();
$('cNew').onclick=()=>{ cPast=false; cSel={_new:true,display_name:'',real_name:'',kind:'cast',is_trial:false,is_active:true}; cMode='all'; renderCasts(); castFormShow(); };
// 狭い画面（iPad の縦向き）は詳細が一覧の上に出るので、編集・新規登録を押したらそこへ動く（ゲネプロ #8）
function castFormShow(){ if(innerWidth<=900) setTimeout(()=>$('cForm')?.closest('.cside')?.scrollIntoView({block:'start',behavior:'smooth'}),50); }
const needMgr=s=>s.kind!=='hall'&&!s.kakari_only;
async function renderCasts(){ if(cPast) return renderPast(); $('cTabPast').classList.remove('on'); cMode='today'; { const ta=$('cTabAll'); if(ta) ta.style.display='none'; } /* 在籍リストと全員を1つにまとめる（出勤した人が上） */ await expireTrials(); await loadStaffAll(); attDrop(); /* 在籍リストは出勤を読み直す */ const present=await updateCastBadge(); const q=$('cSearch').value.trim();
  const C=await caLoadDay(); C.present=present; C.q=q;
  /* 報酬の種類（手当・ポイント） */ let rdErr=false; /* 読めなかった項目（手当／ポイント・当日欠勤・遅刻）は黙って消さず、一覧の上に1行出す（点検 B5） */ { const r=await sb.rpc('pos_rewards',{p_day:businessDate()}); if(r.error) rdErr=true; RW=r.error?{point_slide:false,types:[],points:[],auto:{}}:(r.data||RW); }
  C.rdErr=rdErr; C.tcalc=await caTrialPay(C);
  if(cSel&&!cSel._new&&!staffAll.some(x=>x.id===cSel.id&&(x.is_active||x.leave_pending))) cSel=null; /* 在籍リストに出ない人（体験の次の営業日の自動削除など）の編集は閉じる（オーナー「名前が無いのに編集にサツキの画面がある」） */
  Object.assign(C,caRows(C)); Object.assign(C,caKitA(C)); Object.assign(C,caKitB(C));
  $('cTodayN').textContent=[...present].filter(i=>staff.some(z=>z.id===i)).length; $('cTabToday').classList.toggle('on',cMode==='today'); $('cTabAll').classList.toggle('on',cMode==='all'); $('cSort').textContent=cSorting?'完了':'並べ替え';
  Object.assign(C,await caMarks(C)); C.rowHtml=s=>caRowHtml(C,s);
  C.saveAlw=id=>caSaveAlw(C,id); C.rwPick=(id,title,types,extra)=>caRwPick(C,id,title,types,extra); C.alwYen=id=>caAlwYen(C,id); C.alwPoint=id=>caAlwPoint(C,id);
  caList(C); caBindA(C); caBindB(C);
  renderCastForm(); }
/* その日の日払（立替）・手当・打刻・体験の受領・罰金・精算を読む */
async function caLoadDay(){ let adv={}, advX={}, advN={}, advA={}, advM={}, tev={}, rcp={}, fixN={}, finT={}, finP={}, clDone=false;
  { const bd=businessDate();
  const [ra,re,rc,rr,rf]=await Promise.all([ sb.from('daily_advances').select('*').eq('business_date',bd), sb.from('attendance_events').select('*').eq('business_date',bd).in('event_type',['clock_in','clock_out','douhan','after']).order('event_at'), sb.from('register_closings').select('id').eq('store_id',store.id).eq('business_date',bd), sb.from('trial_receipts').select('id,staff_id,business_date,amount,calc,signed_at').eq('business_date',bd), sb.from('staff_fines').select('*').eq('store_id',store.id).eq('business_date',bd) ]);
  if(rf.error) toast('SQL 041 が未適用です：'+rf.error.message);
  { const e=[ra,re,rc,rr].find(x=>x.error);
  if(e) toast('打刻・日払いを読み込めません。再度開いてください：'+e.error.message);
  } /* 通しチェック3：読めないと全員「打刻なし・日払い0円」に見えた */ (rf.data||[]).forEach(x=>{ if(!x.is_void){ finT[x.staff_id]=(finT[x.staff_id]||0)+Number(x.amount||0);
  if(x.wage_pct) finP[x.staff_id]=(finP[x.staff_id]||0)+Number(x.wage_pct);
  } });
  (rr.data||[]).forEach(x=>{ rcp[x.staff_id]=x;
  });
  (ra.data||[]).forEach(a=>{ adv[a.staff_id]=a.amount;
  advX[a.staff_id]=a.extra||0;
  advN[a.staff_id]=a.calc_note||'';
  advA[a.staff_id]=a.allowance||0;
  advM[a.staff_id]=a.allowance_memo||'';
  });
  (re.data||[]).forEach(e=>{ const t=tev[e.staff_id]||(tev[e.staff_id]={});
  if(e.event_type==='clock_out'||e.event_type==='after'){ t.out=e.event_at;
  t.outFix=e.is_corrected;
  t.outPh=e.photo_path;
  t.after=e.event_type==='after';
  t.outR=e.rounded_at||null;
  t.outO=e.orig_rounded_at||e.orig_at||null;
  } else if(!t.in){ t.in=e.event_at;
  t.inFix=e.is_corrected;
  t.inPh=e.photo_path;
  t.inR=e.rounded_at||null;
  t.inO=e.orig_rounded_at||e.orig_at||null;
  } if(e.is_corrected&&e.event_type!=='douhan') fixN[e.staff_id]=(fixN[e.staff_id]||0)+1;
  });
  clDone=!!(rc.data||[]).length;
  }
  return {adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone}; }
/* 体験の子の日払（立替）を、打刻から計算し直して保存する */
async function caTrialPay(C){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C;
  const tcalc={}; if(cMode==='today'){ for(const s of staffAll.filter(x=>x.is_trial&&present.has(x.id))){ const c=trialCalc(s,tev[s.id]||{},advX[s.id]||0); tcalc[s.id]=c; if(c.ready&&!clDone&&!rcp[s.id]&&(adv[s.id]!==c.pay||advN[s.id]!==c.note)){ const r=await sb.rpc('pos_rows_upsert',{p_table:'daily_advances',p:{store_id:store.id,staff_id:s.id,business_date:businessDate(),amount:c.pay,extra:advX[s.id]||0,calc_note:c.note},p_conflict:'staff_id,business_date'}); if(r.error){ toast('日払（立替）保存エラー：'+r.error.message); } else { adv[s.id]=c.pay; await logOp('日払い（体験・自動計算）',{name:s.display_name,amount:c.pay,calc:c.note},null,true); } } } }
  return tcalc; }
/* 一覧に出す人と並び（出勤した人が上・打刻なしの人は下・退店は一番下） */
function caRows(C){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C;
  let rows=staffAll.filter(s=>cDeleteMode?true:(s.is_active||(!cSorting&&s.leave_pending))); /* 受取待ち（退店）の人も一番下に */ let ntRows=[]; if(cMode==='today'&&!cSorting&&!cDeleteMode){ ntRows=rows.filter(s=>s.is_active&&s.no_timecard&&!present.has(s.id)); rows=[...rows.filter(s=>present.has(s.id)),...rows.filter(s=>!present.has(s.id)&&!(s.is_active&&s.no_timecard))]; } rows=[...rows.filter(s=>s.is_active),...rows.filter(s=>!s.is_active)]; if(q){ rows=rows.filter(s=>(s.display_name+(s.real_name||'')).includes(q)); ntRows=ntRows.filter(s=>(s.display_name+(s.real_name||'')).includes(q)); }
  return {rows,ntRows}; }
function caKitA(C){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C;
  // 手当は［手当］を押すと 理由 → 金額 の順に入力（メモ欄は廃止し、出勤・退勤の時刻を表示）
  // ポイントスライドの店（広島）だけ「手当」をプルダウン（手当／ポイント）にする。ポイントの枠はその日の合計（自動の連絡先報告を含む）
  const ptDay=id=>RW.points.filter(x=>x.staff_id===id).reduce((a,x)=>a+Number(x.points||0),0)+RW.types.filter(t=>t.kind==='point'&&t.auto==='contact').reduce((a,t)=>a+Number(t.value||0),0)*Number(RW.auto[id]||0);
  const alwHtml=s=>{ const pt=RW.point_slide&&s.kind==='cast'&&alwMode[s.id]==='point';
    return '<span class="lp">'+(RW.point_slide&&s.kind==='cast'?`<select data-alwk="${s.id}" style="width:auto;font-size:14px;padding:2px 4px;min-height:0;height:36px"><option value="yen">手当</option><option value="point" ${pt?'selected':''}>ポイント</option></select>`:'<span class="muted" style="font-size:14px">手当</span>')
      +(pt?`<input readonly ${clDone?'disabled':''} data-alwp="${s.id}" value="${ptDay(s.id)?ptDay(s.id).toLocaleString()+'P':''}" placeholder="0P" style="width:84px;font-size:16px;text-align:right;cursor:pointer;background:#fff">`
        :`<input readonly ${clDone?'disabled':''} data-alw="${s.id}" title="${esc(advM[s.id]||'')}" value="${advA[s.id]?Number(advA[s.id]).toLocaleString():''}" placeholder="0" style="width:84px;font-size:16px;text-align:right;cursor:pointer;background:#fff">`)+'</span>'; };
  const fine=Number(settings.punch_fine??1000); const hmx=v=>v?hmJst(v):'―';
  // 罰金は1件ごとの記録（staff_fines）。押すと本日の内訳・追加・変更・取消
  // 時給の％の罰金は金額が月末に決まるので「＋%」と出す（押すと内訳）
  const fineInp=s=>{ const y=finT[s.id]||0, p=finP[s.id]||0; const v=p?(y?Number(y).toLocaleString()+'＋%':'時給×%'):(y?Number(y).toLocaleString():''); return `<input readonly data-fine="${s.id}" value="${v}" title="${p?esc(fineSumTxt(y,p)):''}" placeholder="0" style="width:84px;font-size:${p?14:16}px;text-align:right;cursor:pointer;background:#fff;${y||p?'color:var(--warn)':''}">`; };
  return {ptDay,alwHtml,fine,hmx,fineInp}; }
function caKitB(C){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C;
  // 時刻は計算に使う時刻（タイムカードの丸め rounded_at。無い時は 出勤15分切り上げ・退勤15分切り下げ。体験は閉店で打ち止め）。アフターの打刻は「退」の代わりに「アフター」
  const tmCalc=s=>{ const t=tev[s.id]||{}, Q=900000; if(s.is_trial&&t.in){ const a=Math.ceil(new Date(t.in).getTime()/Q)*Q; return {i:a,o:t.out?Math.max(a,Math.floor(Math.min(new Date(t.out).getTime(),closeCap(businessDate(new Date(t.in))))/Q)*Q):null}; }
    return {i:t.in?(t.inR||Math.ceil(new Date(t.in).getTime()/Q)*Q):null, o:t.out?(t.outR||Math.floor(new Date(t.out).getTime()/Q)*Q):null}; };
  const orgH=(o,v)=>o&&v&&hmx(o)!==hmx(v)?`<small style="color:var(--muted)">${hmx(o)}→</small>`:''; // 修正した打刻は「最初の打刻の丸めた時刻→今」（オーナー）
  // 出・退・アフターは同じ幅の枠に入れて時刻をそろえる。アフターは2行（アフ／ター）。閉店作業のシフトも同じ（シフ／ト）（オーナー 手書き「揃えたいの」）
  // 体験も出・退の時刻を出す。受領のサインの前は押して修正でき、報酬は自動で計算し直す。サインの後は表示のみ（オーナー「サインをまだやってないのに退勤時間を編集できない」）
  const tmHtml=(s,ro)=>{ const c=tmCalc(s), fx=k=>ro?'style="padding:2px 4px;border-bottom:1px solid transparent;':`data-${k}="${s.id}" style="cursor:pointer;padding:2px 4px;border-bottom:1px dotted var(--line);`; /* ro：体験のサインの後は表示のみ（オーナー「時刻はそのまま出して、編集はできないように」） */ return `<span style="font-size:14px;white-space:nowrap"><span ${fx('fixin')}${tev[s.id]?.inFix?'color:var(--warn)':''}">${PL_IN}${orgH(tev[s.id]?.inO,c.i)}${hmx(c.i)}</span>${phBtn(tev[s.id]?.inPh)} <span ${fx('fixout')}${tev[s.id]?.outFix?'color:var(--warn)':''}">${tev[s.id]?.after?PL_AF:PL_OUT}${orgH(tev[s.id]?.outO,c.o)}${hmx(c.o)}</span>${phBtn(tev[s.id]?.outPh)}</span>`; };
  // 日払（立替）と罰金は1つのプルダウンで切り替え（最初は日払（立替）。切り替えはその端末で画面を開き直すまで）。値はそれぞれ今までどおり保存（オーナー「スペース節約」・見本 作業場/在籍_プルダウン_案2.png）
  const advFineHtml=s=>{ const fm=afMode[s.id]==='fine'; return `<span class="lp"><select data-afk="${s.id}" style="width:auto;font-size:14px;padding:2px 4px;min-height:0;height:36px"><option value="adv">日払（立替）</option><option value="fine" ${fm?'selected':''}>罰金</option></select>${fm?fineInp(s):`<input type="number" class="adv" data-adv="${s.id}" value="${adv[s.id]||''}" placeholder="0" ${clDone?'disabled':''} style="width:84px;font-size:16px;text-align:right">`}</span>`; };
  // 日払（立替）の欄は全員に出す（日払が不可の人も、立替は必ずできる）
  // 本名が未入力の人（住民票の提出がない＝報酬を渡せない）。在籍中で、係専用（店・ママ）以外。名前の横と一覧の上に赤で出す（オーナー）
  const noReal=s=>s.is_active&&!s.kakari_only&&!(s.real_name||'').trim();
  return {tmCalc,orgH,tmHtml,advFineHtml,noReal}; }
async function caMarks(C){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C; let rdErr=C.rdErr;
  // LINEマイページの当日欠勤（名前の横に赤で「当日欠勤」、一覧の上に名前・時刻・理由）。SQL 098 が無い時は出さない
  const absM={}; { const ar=await sb.rpc('pos_absences',{p_date:businessDate()}); if(ar.error) rdErr=true; else (ar.data||[]).forEach(a=>{ absM[a.staff_id]=a; }); }
  // LINEマイページの遅刻連絡（出勤予定）と、連絡なしの遅刻
  const lateM={}; { const lr=await sb.rpc('pos_late_notices',{p_date:businessDate()}); if(lr.error) rdErr=true; else (lr.data||[]).forEach(a=>{ lateM[a.staff_id]={...(lateM[a.staff_id]||{}),...a}; }); }
  // アプローチ。今日出勤して、連絡済リストをまだ共有していない人を一覧の上に（強く出さない。オーナー「あくまでもお願い」）
  { const sr=await sb.rpc('pos_sales_today'); salesM={}; if(!sr.error) (sr.data.rows||[]).forEach(r=>{ salesM[r.staff_id]=r; }); }
  const slTxt=Object.values(salesM).filter(r=>r.worked&&r.count==null).map(r=>esc(staffAll.find(x=>x.id===r.staff_id)?.display_name||'')).join('・');
  const krM=await caRatio();
  return {absM,lateM,slTxt,rdErr,krM}; }
/* キャストの給率（今月）と 3M（前の3か月）。数え方は管理サイトの集計「スタッフ」と同じ（SQL 514）。重い計算なので10分は前の答えを使う。関数が無い時は出さない */
let caKr={at:0,m:{}};
async function caRatio(){ if(Date.now()-caKr.at<600000) return caKr.m; const r=await sb.rpc('pos_cast_ratio'); if(!r.error) caKr={at:Date.now(),m:r.data||{}}; return r.error?{}:caKr.m; }
/* 黒服・体験・係専用の行には出さない（オーナー「黒服はいらん」）。給率＝課税対象額÷係小計（管理サイトと同じ式） */
function caKrHtml(C,s){ const z=(C.krM||{})[s.id]; if(!z||!s.is_active||s.kind==='hall'||s.is_trial||s.kakari_only||cSorting||cDeleteMode) return ''; const pct=(t,v)=>Number(v)>0?(Math.round(Number(t)/Number(v)*1000)/10).toFixed(1)+'%':'—';
  return `<small class="kr">給率 <b>${pct(z.taxable,z.sales)}</b> / 3M <b>${pct(z.taxable3,z.sales3)}</b></small>`; }
/* 一覧の1行：名前としるし（caRowHtml）と、時刻・日払・手当・ボタン（caRowCtl） */
function caRowHtml(C,s){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C; return `<div class="rrow ${s.is_active?'':'inactive'}" data-id="${s.id}">${cSorting?'<span class="hd">≡</span>':''}<span class="nm"${cMode==='today'?' style="white-space:nowrap"':''}>${esc(s.display_name)}${needMgr(s)&&s.is_active?(mgrOf(s)?` <small style="color:var(--muted);font-size:13px">${esc(mgrOf(s).display_name)}</small>`:' <small style="color:var(--warn);font-size:13px">未選択</small>'):''}${s.is_active&&absM[s.id]?' <span class="badge warnb">当日欠勤</span>':''}${!s.is_active?'':lateM[s.id]?.eta?` <span class="badge gray">遅刻 ${esc(lateM[s.id].eta)}</span>`:(lateM[s.id]?.nocontact?' <span class="badge warnb">無断遅刻</span>':'')}${
    noReal(s)?'<small style="display:block;color:var(--warn);font-size:12px;line-height:1.3">本名未入力</small>':''}${s.is_trial?' <span class="badge warnb">体験</span>':''}${s.is_seppan?' <span class="badge gray">折半</span>':''}${s.kakari_only?' <span class="badge gray">'+KL+'専用</span>':''}${s.is_active?'':(s.leave_pending?leaveBadge(s):' <span class="badge" style="background:var(--muted)">退店</span>')}${cMode==='today'&&s.is_trial&&present.has(s.id)&&!tev[s.id]?.out?` <button class="sm" data-pout="${s.id}">退勤</button>`:''}${cMode==='today'&&s.is_trial&&rcp[s.id]?` <span class="badge" data-show="${s.id}" style="background:var(--acc);cursor:pointer">受領済</span>`:(cMode==='today'&&s.is_trial&&present.has(s.id)&&tev[s.id]?.out&&tcalc[s.id]?.ready&&adv[s.id]===tcalc[s.id].pay?` <button class="sm" data-show="${s.id}">報酬明細</button>`:'')}${caKrHtml(C,s)}</span>`+caRowCtl(C,s); }
function caRowCtl(C,s){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C;
  return `${cMode==='today'&&!cSorting&&!cDeleteMode&&s.is_active&&!s.kakari_only&&(!s.is_trial||present.has(s.id))?(s.is_trial?`<span style="display:flex;align-items:center;gap:8px;flex:2 1 340px;min-width:0;justify-content:flex-end;flex-wrap:wrap;row-gap:6px">${tmHtml(s,!!rcp[s.id])}<span class="lp" data-tamt style="justify-content:flex-end"><b style="font-size:18px">${rcp[s.id]?yen(rcp[s.id].amount):(tcalc[s.id]?.ready?yen(tcalc[s.id].pay):'')}</b></span><span class="lp"><span class="muted" style="font-size:14px">手当</span><input type="number" inputmode="numeric" data-extra="${s.id}" value="${advX[s.id]||''}" placeholder="0" ${clDone||rcp[s.id]?'disabled':''} style="width:84px;font-size:16px;text-align:right"></span></span>`:`<span style="display:flex;align-items:center;gap:8px;flex:2 1 340px;min-width:0;justify-content:flex-end;flex-wrap:wrap;row-gap:6px">${s.no_timecard?'':tmHtml(s)}${
    advFineHtml(s)}${alwHtml(s)}</span>`):''}${!s.is_active&&s.leave_pending?`<button class="sm" data-ldone="${s.id}">退店完了</button>`:cDeleteMode?(s.is_active?`<button class="sm" style="background:var(--warn);color:#fff" data-del="${s.id}">退店</button>`:`<button class="sm" data-restore="${s.id}">復元</button>`):`${!cSorting&&s.is_trial&&s.is_active&&!present.has(s.id)?`<button class="sm" data-pin="${s.id}">出勤</button>`:''}<button class="primary sm" data-edit="${s.id}">編集</button>`}</div>`; }
function caList(C){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C;
  const nr=staffAll.filter(noReal);
  const absTxt=Object.values(absM).map(a=>`${esc(staffAll.find(x=>x.id===a.staff_id)?.display_name||'')}（${hmJst(a.at)}・${esc(a.reason)}）`).join('、');
  $('cList').innerHTML=(rdErr&&!cSorting&&!cDeleteMode?RDERR:'')+(slTxt&&!cSorting&&!cDeleteMode?`<div style="color:var(--muted);font-size:14px;margin:2px 2px 8px;line-height:1.6">本日のアプローチ（未連絡）：${slTxt}</div>`:'')+(absTxt&&!cSorting&&!cDeleteMode?`<div style="color:var(--warn);font-weight:700;font-size:14px;margin:2px 2px 8px;line-height:1.6">本日の当日欠勤：${absTxt}</div>`:'')+(nr.length&&!cSorting&&!cDeleteMode?`<div style="color:var(--warn);font-weight:700;font-size:14px;margin:2px 2px 8px;line-height:1.6">本名未入力の人がいます：${nr.map(x=>esc(x.display_name)).join('、')}（住民票を確認して、本名を入力してください。本名がないと報酬を渡せません）</div>`:'')+(rows.map(rowHtml).join('')||'<div class="muted">該当なし</div>')+(ntRows.length?`<div class="muted" style="margin:14px 2px 6px;font-size:14px">打刻なしの人（手当のみ）</div>`+ntRows.map(rowHtml).join(''):'');
  { const w=$('cList').querySelector('[data-afk]')?.closest('.lp')?.getBoundingClientRect().width; if(w) $('cList').querySelectorAll('[data-tamt]').forEach(e=>{ e.style.width=w+'px'; }); } /* 体験の金額の枠は 日払（立替）の枠と同じ幅にして、出・退の時刻の位置をほかの人とそろえる */
  $('cList').querySelectorAll('.rrow').forEach(r=>{ if(r.querySelector('[data-extra]')) r.style.flexWrap='wrap'; else if(r.querySelector('[data-alw]')) r.querySelectorAll('span.muted,button').forEach(e=>{ e.style.whiteSpace='nowrap'; e.style.flexShrink='0'; }); });
}
async function caSaveAlw(C,id){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C;
  const st=staffAll.find(x=>x.id===id);
  if(await askBy()===null) return;
  const m0=await uiDlg(`${st?.display_name||''}　手当の理由`,true,advM[id]||'','理由を入力してください');
  if(m0==null) return;
  const m=m0.trim();
  if(!m){ toast('理由を入力してください');
  return;
  } const a0=await uiPrompt(`${st?.display_name||''}　手当の金額（円）`,String(advA[id]||0));
  if(a0==null) return;
  const a=numIn(a0);
  if(a===(advA[id]||0)&&m===(advM[id]||'')) return;
  { const now=await sb.from('daily_advances').select('allowance,allowance_memo').eq('staff_id',id).eq('business_date',businessDate()).maybeSingle();
  if(now.error){ toast('保存エラー：'+now.error.message);
  return;
  } if((now.data?.allowance||0)!==(advA[id]||0)||(now.data?.allowance_memo||'')!==(advM[id]||'')){ toast('ほかの端末で変更されました');
  renderCasts();
  return;
  } } /* 書く前に今の手当を読み、ほかで変わっていたら上書きしないで読み直す */ const r=await sb.rpc('pos_rows_upsert',{p_table:'daily_advances',p:{store_id:store.id,staff_id:id,business_date:businessDate(),allowance:a,allowance_memo:m||null},p_conflict:'staff_id,business_date'});
  if(r.error){ toast(r.error.message.includes('allowance')?'SQL 024 が未適用です：'+r.error.message:'保存エラー：'+r.error.message);
  return;
  } await logOp('手当',{name:st?.display_name,amount:a,before:advA[id]||0,memo:m||null},null,true);
  advA[id]=a;
  advM[id]=m;
  toast('手当を保存しました');
}
// 報酬の種類から選ぶ（種類 → 回数）。手当はその日の手当に足す（理由に「名前×回数」）。その他は今までどおり 理由 → 金額
function caRwPick(C,id,title,types,extra){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C; return new Promise(res=>{ const st=staffAll.find(x=>x.id===id); const m=mkModal(60);
    m.innerHTML=`<div class="box" style="width:min(440px,94vw)"><div style="font-size:18px;font-weight:700;margin-bottom:10px">${esc(st?.display_name||'')}　${title}</div>${extra||''}<div style="display:flex;flex-direction:column;gap:8px">${types.map((t,k)=>`<button class="ghost" data-rk="${k}" style="text-align:left">${esc(t.name)}　<small class="muted">${Number(t.value).toLocaleString()}${t.kind==='point'?'P':'円'}／1回</small></button>`).join('')}<button class="ghost" data-rk="x" style="text-align:left">その他（理由を入力）</button></div><div class="bar" style="margin-top:12px"><button class="ghost" data-rk="">戻る</button></div></div>`;
    document.body.appendChild(m); m.querySelectorAll('[data-rk]').forEach(b=>b.onclick=()=>{ const k=b.dataset.rk; m.remove(); res(k===''?null:k==='x'?'x':types[Number(k)]); }); m.querySelectorAll('[data-rv]').forEach(b=>b.onclick=async()=>{ m.remove(); res({void:b.dataset.rv}); }); }); }
async function caAlwYen(C,id){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C; const T=RW.types.filter(t=>t.kind==='yen'&&!t.auto&&Number(t.value)>0); if(!T.length) return saveAlw(id);
    const t=await rwPick(id,'手当',T); if(!t) return; if(t==='x') return saveAlw(id); const st=staffAll.find(x=>x.id===id);
    if(await askBy()===null) return; const q0=await uiPrompt(`${st?.display_name||''}　${t.name}\n回数（1回 ${Number(t.value).toLocaleString()}円）`,'1'); if(q0==null) return; const n=numIn(q0); if(!(n>0)) return;
    /* 今の手当に足す（2台で同時に足しても消えない） */ const r=await sb.rpc('pos_allowance_add',{p_staff:id,p_day:businessDate(),p_amount:n*Number(t.value),p_memo:`${t.name}×${n}`}); if(r.error){ toast('保存エラー：'+r.error.message); return; }
    const a=r.data.allowance, m=r.data.memo||''; await logOp('手当',{name:st?.display_name,amount:a,before:r.data.before,memo:m},null,true); advA[id]=a; advM[id]=m; toast('手当を保存しました');
}
async function caAlwPoint(C,id){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C; const T=RW.types.filter(t=>t.kind==='point'&&!t.auto&&Number(t.value)>0), L=RW.points.filter(x=>x.staff_id===id), st=staffAll.find(x=>x.id===id);
    const au=RW.types.filter(t=>t.kind==='point'&&t.auto==='contact').map(t=>Number(RW.auto[id]||0)?`<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${esc(t.name)}×${RW.auto[id]}<small class="muted">　自動</small></span><span>${(Number(t.value||0)*Number(RW.auto[id])).toLocaleString()}P</span></div>`:'').join('');
    const cur=(au||L.length)?`<div style="border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin-bottom:10px">${au}${L.map(x=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0"><span>${esc(x.name)}×${Number(x.qty)}</span><span>${Number(x.points).toLocaleString()}P <button class="ghost sm" data-rv="${x.id}">取消</button></span></div>`).join('')}</div>`:'';
    const t=await rwPick(id,'ポイント',T,cur); if(!t) return;
    if(t.void){ if(!await uiConfirm('このポイントを取り消しますか？')) return; const r=await sb.rpc('pos_reward_void',{p_id:t.void}); if(r.error){ toast(r.error.message); return; } toast('取り消しました'); return; }
    let name, val;
    if(t==='x'){ const m0=await uiDlg(`${st?.display_name||''}　ポイントの理由`,true,'','理由を入力してください'); if(m0==null||!m0.trim()) return; name=m0.trim(); const v0=await uiPrompt(`${st?.display_name||''}　${name}\nポイント（1回）`,''); if(v0==null) return; val=numIn(v0); if(!(val>0)) return; }
    else { name=t.name; val=Number(t.value); }
    const q0=await uiPrompt(`${st?.display_name||''}　${name}\n回数（1回 ${val.toLocaleString()}P）`,'1'); if(q0==null) return; const n=numIn(q0); if(!(n>0)) return;
    const r=await sb.rpc('pos_reward_add',{p_staff:id,p_day:businessDate(),p_name:name,p_qty:n,p_value:val}); if(r.error){ toast(/pos_reward_add/.test(r.error.message)?'SQL 140 が未実行です：'+r.error.message:r.error.message); return; } toast(`${(n*val).toLocaleString()}P を付けました`);
}
/* 押した時の動き：手当・ポイント・罰金・写真・打刻の修正 */
function caBindA(C){ const {present,q,adv,advX,advN,advA,advM,tev,rcp,fixN,finT,finP,clDone,rdErr,tcalc,rows,ntRows,ptDay,alwHtml,fine,hmx,fineInp,tmCalc,orgH,tmHtml,advFineHtml,noReal,absM,lateM,slTxt,rowHtml,saveAlw,rwPick,alwYen,alwPoint}=C;
  $('cList').querySelectorAll('[data-alw]').forEach(i=>i.onclick=async()=>{ if(clDone) return; await alwYen(i.dataset.alw); renderCasts(); });
  $('cList').querySelectorAll('[data-afk]').forEach(x=>x.onchange=()=>{ afMode[x.dataset.afk]=x.value; renderCasts(); });
  $('cList').querySelectorAll('[data-alwk]').forEach(x=>x.onchange=()=>{ alwMode[x.dataset.alwk]=x.value; renderCasts(); });
  $('cList').querySelectorAll('[data-alwp]').forEach(i=>i.onclick=async()=>{ if(clDone) return; await alwPoint(i.dataset.alwp); renderCasts(); }); // 精算済の日は立替・手当を変えられない（DB でも拒否）
  $('cList').querySelectorAll('[data-fine]').forEach(i=>i.onclick=()=>fineDlg(i.dataset.fine));
  $('cList').querySelectorAll('[data-ph]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); showSelfie(b.dataset.ph); });
  $('cList').querySelectorAll('[data-fixin]').forEach(b=>b.onclick=()=>punchFix(b.dataset.fixin,'clock_in')); $('cList').querySelectorAll('[data-fixout]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.fixout, t=tev[id]; /* まちがえて押した退勤は取り消せる（閉店作業の精算の前まで。理由は聞かない。オーナー） */
    if(t?.out&&!t.after&&!clDone){ const nm=snm(id); const k=await uiPick(`${nm}　退勤 ${hmJst(t.out)}`,[{label:'時刻を直す',value:'fix'},{label:'退勤を取り消す',value:'cancel'}]); if(!k) return;
      if(k==='cancel'){ const r=await sb.rpc('punch_cancel_out',{p_staff_id:id}); if(r.error){ await uiAlert(/punch_cancel_out/.test(r.error.message)?'SQL 160 が未実行です':r.error.message); return; } await logOp('退勤の取消',{name:nm,out:hmJst(t.out)},null,true); toast(`${nm} の退勤を取り消しました`); renderCasts(); return; } }
    punchFix(id,'clock_out'); });
}
/* 押した時の動き：体験の出勤・編集・退店・復元・体験の手当・日払・並べ替え */
function caBindB(C){ const {adv,advX,tev,rcp,tcalc}=C;
  $('cList').querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>punchTrial(b.dataset.pin,'clock_in')); $('cList').querySelectorAll('[data-pout]').forEach(b=>b.onclick=()=>punchTrial(b.dataset.pout,'clock_out')); $('cList').querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>{ const s=staffAll.find(x=>x.id===b.dataset.show); if(s) openTrialPay(s,tcalc[s.id],tev[s.id]||{},advX[s.id]||0,rcp[s.id]||null); });
  $('cList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{ cSel=staffAll.find(s=>s.id===b.dataset.edit); renderCastForm(); castFormShow(); });
  $('cList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>leaveDlg(staffAll.find(x=>x.id===b.dataset.del)));
  $('cList').querySelectorAll('[data-ldone]').forEach(b=>b.onclick=()=>leaveDone(staffAll.find(x=>x.id===b.dataset.ldone)));
  $('cList').querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{ const { error } = await sb.rpc('pos_row_update',{p_table:'staff',p_id:b.dataset.restore,p:{is_active:true}}); if(!error) await logOp('キャストを戻す',{name:snm(b.dataset.restore)},null,true); toast(error?error.message:'戻しました'); renderCasts(); });
  $('cList').querySelectorAll('[data-extra]').forEach(inp=>inp.onchange=async()=>{ const s=staffAll.find(x=>x.id===inp.dataset.extra); const ex=Math.max(0,parseInt(inp.value||'0',10)||0); const c=trialCalc(s,tev[s.id]||{},ex); const r=await sb.rpc('pos_rows_upsert',{p_table:'daily_advances',p:{store_id:store.id,staff_id:s.id,business_date:businessDate(),amount:c.ready?c.pay:(adv[s.id]||0),extra:ex,calc_note:c.note},p_conflict:'staff_id,business_date'}); if(r.error){ toast('保存エラー：'+r.error.message); return; } await logOp('日払い（体験・手当の変更）',{name:s.display_name,extra:ex,amount:c.ready?c.pay:null,calc:c.note},null,true); toast('手当を保存しました'); renderCasts(); });
  $('cList').querySelectorAll('[data-adv]').forEach(inp=>inp.onchange=async()=>{ const v=parseInt(inp.value||'0',10)||0; const st=staffAll.find(x=>x.id===inp.dataset.adv); const cap=Number(st?.kind==='hall'?(settings?.advance_cap_hall??5000):(settings?.advance_cap_cast??10000)); if(v>cap){ toast(`日払（立替）の上限は ${cap.toLocaleString()}円 です`); inp.value=adv[inp.dataset.adv]??''; return; } if(v<0){ inp.value=adv[inp.dataset.adv]??''; return; } adv[inp.dataset.adv]=v; const { error } = await sb.rpc('pos_rows_upsert',{p_table:'daily_advances',p:{store_id:store.id,staff_id:inp.dataset.adv,business_date:businessDate(),amount:v},p_conflict:'staff_id,business_date'}); if(!error) await logOp('日払い',{name:snm(inp.dataset.adv),amount:v},null,true); toast(error?('日払（立替）保存エラー：'+error.message):`日払（立替） ${v.toLocaleString()}円 を保存しました`); });
  if (cSorting) dragSort($('cList'),'.rrow',async ids=>{ const rs=[await sb.rpc('pos_staff_sort',{p_ids:ids})]; const er=rs.find(r=>r.error); toast(er?('並び順を保存できませんでした：'+er.error.message):'並び順を保存しました'); renderCasts(); });
}
