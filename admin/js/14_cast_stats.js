// ---------- 集計「キャスト」 v0.28・SQL 068・069：成績 → 支給 → 罰金 → 控除 → 支払う額（見るだけ。計算はデータベースの admin_cast_month） ----------
// 決定時給：選んだスライド表と保証時給（日給の人は日給）の高い方。時間報酬＝決定時給×稼働時間（日給の人は 日給×稼働日数）。会計済の伝票だけ。体験は入れない
// 同伴ノルマ罰金＝足りない回数×時間給×4時間。源泉＝（課税対象額−5,000円×その月の日数）×10.21%（罰金は引かずに計算）。厚生費「標準」＝出勤 1〜3日 5,000円／4〜10日 10,000円／11日以上 15,000円
let ksMonth=null;
const KS_COLS=[
  ['成績',[['manager','担当黒服','t'],['days','稼働日数','d'],['hours','稼働時間','h'],['sales',''+KL+'小計','y'],['points','ポイント','p'],['douhan','同伴','dq'],['reactions','反応','n']]],
  ['支給',[['wage','決定時給','w'],['time_pay','時間報酬','y'],['kakari_back','小計バック','y'],['seppan_pay','折半','y'],['item_back','商品バック','y'],['allowance','手当','y'],['special_pay','個別支給','y']]],
  ['罰金',[['fines','罰金','m'],['quota_fine','同伴ノルマ','m']]],
  ['控除',[['ctax','消費税','m'],['welfare','厚生費','m'],['special_deduct','個別控除','m'],['advance','日払（立替）','m'],['withholding','源泉徴収','m']]],
  ['支給額',[['taxable','課税対象額','y'],['net','残り支給額','net']]]];
PAGES.cast_sales=async()=>{ const st=storeId, now=csNowMonth(); if(!ksMonth) ksMonth=now; const m=ksMonth;
  const mOpts=Array.from({length:13},(_,i)=>csAddMonth(now,-i));
  const head=`<h1>スタッフ <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="row" style="margin-bottom:12px;justify-content:space-between"><select id="ksM" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel(x)}</option>`).join('')}</select>${me?.is_owner?'<span class="row" style="gap:8px"><button class="ghost" id="ksXls" disabled>詳細（Excel）</button><button class="ghost" id="ksPdf" disabled>報酬明細（PDF）</button></span>':''}</div>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>'; let data=null, hall=null;
  const wire=()=>{ const e=$('ksM'); if(e) e.onchange=()=>{ ksMonth=e.value; PAGES.cast_sales(); }; const x=$('ksXls'), pd=$('ksPdf'); if(x&&data){ x.disabled=pd.disabled=!(data.rows||[]).length&&!(hall?.rows||[]).length; x.onclick=guard(x,()=>ksExcel(data,hall)); pd.onclick=guard(pd,()=>ksPdf(data,hall)); } }; wire();
  // v0.35：黒服も同じ画面に（キャストの下）。Excel・PDF にも黒服を入れる
  /* v0.81・SQL 090：キャストと黒服を1回で（キャストの計算を2回しない）。関数が無い時は今までどおり2つ */
  let r, hr; const sm=await sb.rpc('admin_staff_month',{p_store:st,p_month:m});
  if(!sm.error){ r={data:sm.data.cast}; hr=sm.data.hall?{data:sm.data.hall}:{error:{message:sm.data.hall_error||''}}; }
  else if(/admin_staff_month/.test(sm.error.message)) [r,hr]=await Promise.all([sb.rpc('admin_cast_month',{p_store:st,p_month:m}), sb.rpc('admin_hall_month',{p_store:st,p_month:m})]);
  else { r={error:sm.error}; hr={error:sm.error}; }
  if(page!=='cast_sales'||storeId!==st||ksMonth!==m) return;
  hall=hr.error?null:(hr.data||{});
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_cast_month/.test(r.error.message)?'SQL 068・069 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; wire(); return; }
  data=r.data; const rows=r.data?.rows||[], n=v=>Number(v||0), yen0=v=>v?yen(v):'—', neg=v=>v?`<span style="color:var(--warn)">−${yen(v).replace(/^-/,'')}</span>`:'—';
  const fmt=(k,typ,x)=>{ const v=x[k]; if(typ==='t') return esc(v||'—'); if(typ==='d') return n(v)?n(v)+'日':'—'; if(typ==='h') return n(v)?n(v).toLocaleString('ja-JP',{maximumFractionDigits:2})+'時間':'—';
    if(typ==='p') return n(v)?n(v).toLocaleString('ja-JP',{maximumFractionDigits:1}):'—'; if(typ==='n') return n(v)?n(v)+'回':'—';
    if(typ==='dq') return `${n(x.douhan)}回${x.quota!=null?` <small class="muted">／${x.quota}</small>`:''}`;
    if(typ==='w') return v==null?(x.seppan?'—':'<span class="badge warnb">未設定</span>'):yen(v)+(x.pay_type==='daily'?' <small class="muted">日給</small>':'');
    if(typ==='m') return neg(n(v)); if(typ==='net') return n(v)<0?`<b style="color:var(--warn)">${yen(v)}</b>`:`<b>${yen(v)}</b>`; return yen0(n(v)); };
  const sumKeys=['days','hours','sales','points','douhan','reactions','time_pay','kakari_back','seppan_pay','item_back','allowance','special_pay','fines','quota_fine','ctax','welfare','special_deduct','advance','withholding','taxable','net'];
  const tot={}; sumKeys.forEach(k=>tot[k]=rows.reduce((a,x)=>a+n(x[k]),0));
  const cols=KS_COLS.flatMap(([g,cs])=>cs.map(c=>[g,...c]));
  const totCell=([g,k,l,typ])=>{ if(!sumKeys.includes(k)) return '<td></td>'; if(typ==='dq') return `<td>${tot.douhan}回</td>`; return `<td>${fmt(k,typ,tot)}</td>`; };
  $('main').innerHTML=head+'<h2 style="margin:4px 0 8px">キャスト</h2>'+(rows.length?`<div class="cs-w"><table class="t cs ks"><thead><tr><th class="nm" rowspan="2">名前</th>${KS_COLS.map(([g,cs])=>`<th colspan="${cs.length}" class="ksg">${g}</th>`).join('')}</tr>
    <tr>${cols.map(([g,k,l])=>`<th>${l}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(x=>`<tr><td class="nm">${esc(x.name)}${x.active?'':' <small class="muted">（退店）</small>'}${x.seppan?' <small class="muted">折半</small>':''}</td>${cols.map(([g,k,l,typ])=>`<td>${fmt(k,typ,x)}</td>`).join('')}</tr>`).join('')}
    <tr class="kst"><td class="nm"><b>合計</b></td>${cols.map(totCell).join('')}</tr></tbody></table></div>`:'<div class="card muted">この月のキャストはいません</div>')
    +`<div class="muted hint" style="font-size:13px;margin-top:8px;line-height:1.6">会計済の伝票と、タイムカードの打刻（丸めた時刻）で計算します<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">決定時給：選んだスライド表と保証時給（日給の人は日給）のうち一番高い金額。時間報酬＝決定時給×稼働時間（日給の人は 日給×稼働日数）<br>小計バック＝${KL}小計×スタッフ設定のバック％（時給・日給に加算）。折半＝${KL}小計×小計バック％（報酬が折半の人。時給・保証時給・同伴ノルマ罰金はなし）。商品バック・手当・日払（立替）・罰金は POS で入れたもの。％の罰金は月末の時給で計算します<br>同伴ノルマ罰金＝足りない回数×時給×4時間（日給の人の時給は 日給÷所定時間）<br>課税対象額＝支給の合計。源泉＝（課税対象額−5,000円×その月の日数）×10.21%（罰金は引かずに計算。スタッフ設定で「しない」の人は0円）<br>厚生費「標準」：稼働日数 1〜3日 5,000円／4〜10日 10,000円／11日以上 15,000円<br>残り支給額＝課税対象額−罰金−控除。体験の人はその日に支払済のため含めていません</div></div>`+'<div id="hpBox" style="margin-top:22px"></div>';
  hallPayDraw(hr,st,m,rows); wire(); };

// v0.29・SQL 069：詳細（Excel）と報酬明細（PDF）のダウンロード（d-system の「Excel」「報酬明細PDF」と同じ形）。ライブラリは押した時に読む
const ksLib={}; function ksLoad(u){ return ksLib[u]||(ksLib[u]=new Promise((ok,ng)=>{ const sc=document.createElement('script'); sc.src=u; sc.onload=ok; sc.onerror=()=>{ delete ksLib[u]; ng(new Error('読み込めません：'+u)); }; document.head.appendChild(sc); })); }
const ksN=v=>Number(v||0), ksB=(x,k,f)=>ksN(x.backs?.[k]?.[f]);
const ksFineNames=rows=>[...new Set(rows.flatMap(x=>Object.keys(x.fine_items||{})))].sort((a,b)=>a.localeCompare(b,'ja'));
const ksDed=x=>ksN(x.ctax)+ksN(x.fines)+ksN(x.quota_fine)+ksN(x.welfare)+ksN(x.special_deduct);
const ksHM=h=>{ const t=Math.round(ksN(h)*60); return `${Math.floor(t/60)}時間${String(t%60).padStart(2,'0')}分`; };
const ksCode=()=>{ const c=curStore()?.code; return c?'_'+c:''; };
// v0.94：本名（POS の在籍キャストで入れたもの）。報酬明細の PDF は「源氏名/本名」、Excel は「本名」の列（オーナー 2026-10-15）。読めない時は空
async function ksReal(){ const r=await sb.from('staff').select('id,real_name').eq('store_id',storeId); const m={}; (r.data||[]).forEach(x=>{ m[x.id]=(x.real_name||'').trim(); }); return m; }
async function ksExcel(d,h){ try{ await ksLoad('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); }catch(e){ await uiAlert(e.message); return; }
  const RN=await ksReal();
  // v0.60：キャストと黒服を1つの表に（d-system の「キャスト売上一覧」と同じ。「黒服」のシートはやめた）。黒服の行は名前に（黒服）。黒服だけの数字は ボーナスの「黒服報酬」「黒服ボーナス」、マイナスの「遅刻・早退」「黒服罰金」
  // 黒服の総支給額は 遅刻・早退を引く前（課税対象額＋遅刻・早退）。マイナスの計に遅刻・早退が入るので、総支給額−マイナス−消費税−日払−源泉＝残り支給額 が合う
  const casts=d.rows||[], halls=(h?.rows||[]).map(x=>({_hall:true,id:x.id,name:x.name+'（黒服）',active:x.active,manager:'',points:0,taxable:ksN(x.taxable)+ksN(x.late_deduct),_taxable:ksN(x.taxable),net:x.net,days:x.days,hours:x.hours,
    allowance:x.allowance,special_pay:x.special_pay,_base:x.base,_bonus:x.bonus,_late:x.late_deduct,_hfine:x.fines,ctax:x.ctax,advance:x.advance,welfare:x.welfare,special_deduct:x.special_deduct,withholding:x.withholding}));
  const rows=[...casts,...halls], fn=ksFineNames(casts), [y,mo]=String(d.month).split('-').map(Number);
  // [見出し, 小見出し, 値]。小見出しが無い列は2行を1つにする
  const G=[['No',null,(x,i)=>i+1],['名前',null,x=>x.name+(x.active?'':'（退店）')],['本名',null,x=>RN[x.id]||''],['担当黒服',null,x=>x.manager||''],['ポイント',null,x=>ksN(x.points)],['総支給額',null,x=>ksN(x.taxable)],['残り支給額',null,x=>ksN(x.net)],
    [''+KL+'本計',null,x=>ksN(x.honkei)],[''+KL+'小計',null,x=>ksN(x.sales)],['同伴本計',null,x=>ksN(x.douhan_honkei)],['同伴小計',null,x=>ksN(x.douhan_sales)],['給率(%)',null,x=>ksN(x.sales)?Math.round(ksN(x.taxable)/ksN(x.sales)*1000)/10:0],['稼働日数',null,x=>ksN(x.days)],
    ['時間報酬','決定時給',x=>ksN(x.wage)],['時間報酬','時間',x=>ksN(x.hours)],['時間報酬','報酬額',x=>ksN(x.time_pay)],['小計バック',null,x=>ksN(x.kakari_back)],['折半',null,x=>ksN(x.seppan_pay)],
    ...[['hc','HC'],['bottle','ボトルバック'],['other','商品バック']].flatMap(([k,l])=>[[l,'組数',x=>ksB(x,k,'groups')],[l,'本数',x=>ksB(x,k,'qty')],[l,'金額',x=>ksB(x,k,'amount')]]),
    ['バック計',null,x=>ksN(x.kakari_back)+ksN(x.item_back)],['ボーナス','手当など、その他',x=>ksN(x.allowance)],['ボーナス','個別支給',x=>ksN(x.special_pay)],['ボーナス','黒服報酬',x=>ksN(x._base)],['ボーナス','黒服ボーナス',x=>ksN(x._bonus)],['ボーナス','計',x=>ksN(x.allowance)+ksN(x.special_pay)+ksN(x._base)+ksN(x._bonus)],
    ['消費税',null,x=>ksN(x.ctax)],['日払（立替）',null,x=>ksN(x.advance)],
    ...fn.map(f=>['マイナス',f,x=>ksN(x.fine_items?.[f])]),['マイナス','同伴ノルマ',x=>ksN(x.quota_fine)],['マイナス','厚生費',x=>ksN(x.welfare)],['マイナス','個別控除',x=>ksN(x.special_deduct)],['マイナス','遅刻・早退',x=>ksN(x._late)],['マイナス','黒服罰金',x=>ksN(x._hfine)],['マイナス','計',x=>ksN(x.fines)+ksN(x.quota_fine)+ksN(x.welfare)+ksN(x.special_deduct)+ksN(x._late)+ksN(x._hfine)],
    ['課税対象額',null,x=>ksN(x._hall?x._taxable:x.taxable)],['源泉徴収',null,x=>ksN(x.withholding)]];
  const last=new Date(y,mo,0).getDate(), body=rows.map((x,i)=>G.map(g=>g[2](x,i)));
  const tot=G.map((g,j)=>j===0?'合計':j<3?null:typeof body[0]?.[j]==='number'?Math.round(body.reduce((a,r)=>a+ksN(r[j]),0)*100)/100:null); const kr=G.findIndex(g=>g[0]==='給率(%)'), cTax=casts.reduce((a,x)=>a+ksN(x.taxable),0); tot[kr]=tot[7]?Math.round(cTax/tot[7]*1000)/10:0; tot[12]=null; // 給率の合計はキャストだけで（黒服は係小計が無い）
  const aoa=[['キャスト売上一覧'],[`${y}年${mo}月1日〜${y}年${mo}月${last}日`],G.map((g,j)=>j>0&&G[j-1][0]===g[0]&&g[1]?null:g[0]),G.map(g=>g[1]),tot,...body];
  const ws=XLSX.utils.aoa_to_sheet(aoa), mg=[]; let j=0; while(j<G.length){ if(!G[j][1]){ mg.push({s:{r:2,c:j},e:{r:3,c:j}}); j++; continue; } let k=j; while(k+1<G.length&&G[k+1][0]===G[j][0]&&G[k+1][1]) k++; if(k>j) mg.push({s:{r:2,c:j},e:{r:2,c:k}}); j=k+1; }
  ws['!merges']=mg; ws['!cols']=G.map((g,i)=>({wch:i===1?14:i===0?5:11}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'キャスト売上一覧');
  XLSX.writeFile(wb,`data-${y}-${String(mo).padStart(2,'0')}${ksCode()}.xlsx`); toast('ダウンロードしました'); }
async function ksPdf(d,h){ try{ await ksLoad('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'); await ksLoad('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'); }catch(e){ await uiAlert(e.message); return; }
  const RN=await ksReal(), nmT=x=>esc(x.name)+(RN[x.id]?'/'+esc(RN[x.id]):'');
  const rows=[...(d.rows||[]),...(h?.rows||[]).map(x=>({...x,hall:true}))], fn=ksFineNames(d.rows||[]), [y,mo]=String(d.month).split('-').map(Number), sn=curStore()?.name||'', v=n=>ksN(n)?ksN(n).toLocaleString('ja-JP'):'--';
  const now=new Date(), pt=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  // 列は3つ（縦の見出し・項目・金額）。見出しの無い行は最初の2つをまとめる。縦書きは1文字ずつ改行（PDF にする時に縦書きが崩れないように）
  const L=(l,val,c='')=>`<tr class="${c}"><td class="lb" colspan="2">${esc(l)}</td><td class="vl">${val}</td></tr>`, grp=(name,trs)=>trs.map((t,i)=>t.replace('<td class="lb" colspan="2">',(i===0?`<td class="gl" rowspan="${trs.length}">${[...name].join('<br>')}</td>`:'')+'<td class="gi">')).join('');
  const slip=x=>{ if(x.hall) return hallSlip(x); const pay=[L(x.pay_type==='daily'?'報酬（日給）':'報酬（時給）',v(x.time_pay)),L('小計バック',v(x.kakari_back)),...(x.seppan?[L(`折半（${ksN(x.seppan_pct)}%）`,v(x.seppan_pay))]:[]),L('HC',v(ksB(x,'hc','amount'))),L('ボトルバック',v(ksB(x,'bottle','amount'))),L('商品バック',v(ksB(x,'other','amount'))),L('手当など、その他',v(ksN(x.allowance)+ksN(x.special_pay))),L('合計',v(x.taxable),'sum')];
    const ded=[L('消費税',v(x.ctax)),...fn.map(f=>L(f,v(x.fine_items?.[f]))),L('同伴ノルマ',v(x.quota_fine)),L('厚生費',v(x.welfare)),L('個別控除',v(x.special_deduct)),L('合計',v(ksDed(x)),'sum')];
    return `<div class="sl"><div class="sh"><div class="t1">報酬支払明細書</div><div>令和 ${y-2018}年 ${mo}月分</div><div>${esc(sn)}</div><div class="nm">${nmT(x)}</div></div><table><colgroup><col class="c1"><col><col class="c3"></colgroup>${L('稼働日数',ksN(x.days)+'日')}${L('稼働時間',ksHM(x.hours))}${L(x.pay_type==='daily'?'決定日給':'決定時給',x.wage?ksN(x.wage).toLocaleString('ja-JP'):'--')}
      ${grp('支給対象',pay)}${grp('控除対象',ded)}${L('総支給額',ksN(x.taxable-ksDed(x)).toLocaleString('ja-JP'))}${L('課税対象額',v(x.taxable))}${L('源泉徴収',v(x.withholding))}${L('日払（立替）',v(x.advance))}${L('残り支給額',(ksN(x.net)<0?'−':'')+'¥'+Math.abs(ksN(x.net)).toLocaleString('ja-JP'),'net')}</table></div>`; };
  // v0.34：黒服の明細（基本給・遅刻・早退・ボーナス）
  const hallSlip=x=>{ const pay=[L(`基本給（${CS_HPAY[x.pay_type]||'—'}）`,v(x.base)),L('遅刻・早退',ksN(x.late_deduct)?'−'+v(x.late_deduct):'--'),L('ボーナス',v(x.bonus)),L('手当など、その他',v(ksN(x.allowance)+ksN(x.special_pay))),L('合計',v(x.taxable),'sum')];
    const ded=[L('消費税',v(x.ctax)),L('罰金',v(x.fines)),L('厚生費',v(x.welfare)),L('個別控除',v(x.special_deduct)),L('合計',v(ksDed(x)),'sum')];
    return `<div class="sl"><div class="sh"><div class="t1">報酬支払明細書</div><div>令和 ${y-2018}年 ${mo}月分</div><div>${esc(sn)}</div><div class="nm">${nmT(x)}</div></div><table><colgroup><col class="c1"><col><col class="c3"></colgroup>${L('稼働日数',ksN(x.days)+'日')}${L('稼働時間',ksHM(x.hours))}${L('遅刻・早退',`${ksN(x.late_min)+ksN(x.early_min)}分`)}
      ${grp('支給対象',pay)}${grp('控除対象',ded)}${L('総支給額',ksN(x.taxable-ksDed(x)).toLocaleString('ja-JP'))}${L('課税対象額',v(x.taxable))}${L('源泉徴収',v(x.withholding))}${L('日払（立替）',v(x.advance))}${L('残り支給額',(ksN(x.net)<0?'−':'')+'¥'+Math.abs(ksN(x.net)).toLocaleString('ja-JP'),'net')}</table></div>`; };
  const per=6, pages=[]; for(let i=0;i<rows.length;i+=per) pages.push(rows.slice(i,i+per));
  // 最後のページ：支払報酬金種一覧（残り支給額を、大きいお札・硬貨から順に何枚ずつ用意するか。マイナスの人は0円）
  const DN=[[10000,'1万円札'],[5000,'5千円札'],[1000,'千円札'],[500,'500円玉'],[100,'100円玉'],[50,'50円玉'],[10,'10円玉'],[5,'5円玉'],[1,'1円玉']];
  const cnt=a=>{ let r=Math.max(0,Math.floor(ksN(a))); return DN.map(([u])=>{ const c=Math.floor(r/u); r-=c*u; return c; }); };
  const dRows=rows.map((x,i)=>({no:i+1,name:x.name,pay:Math.max(0,ksN(x.net)),c:cnt(x.net)})), dPer=24, dPages=[]; for(let i=0;i<dRows.length;i+=dPer) dPages.push(dRows.slice(i,i+dPer));
  const dTot=DN.map((_,j)=>dRows.reduce((t,r)=>t+r.c[j],0)), dSum=dRows.reduce((t,r)=>t+r.pay,0), total=pages.length+dPages.length;
  const dPage=(pg,k)=>`<div class="kp"><div class="pt">print: ${pt}</div><div class="dk"><div class="dh">${esc(sn)} 令和${y-2018}年${mo}月度 支払報酬金種一覧 (${k+1})</div><table class="dt"><tr><th>No</th><th class="l">名前</th><th>支給額</th>${DN.map(([,l])=>`<th>${l}</th>`).join('')}</tr>
    ${pg.map(r=>`<tr><td>${r.no}</td><td class="l">${esc(r.name)}</td><td>¥${r.pay.toLocaleString('ja-JP')}</td>${r.c.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}
    ${k===dPages.length-1?`<tr class="tt"><td colspan="2" class="r">合計</td><td>¥${dSum.toLocaleString('ja-JP')}</td>${dTot.map(c=>`<td>${c}</td>`).join('')}</tr>`:''}</table></div><div class="pg">- ${pages.length+k+1} / ${total} -</div></div>`;
  const box=document.createElement('div'); box.style.cssText='position:fixed;left:-20000px;top:0;z-index:-1'; document.body.appendChild(box);
  box.innerHTML=`<style>.kp{width:1123px;height:794px;background:#fff;color:#222;font-family:"Zen Kaku Gothic New",system-ui,"Hiragino Sans","Noto Sans JP",sans-serif;padding:14px 40px;box-sizing:border-box;position:relative}
    .kp .pt{text-align:right;font-size:11px;border-bottom:1px solid #222;padding-bottom:2px}.kp .pg{position:absolute;left:40px;right:40px;bottom:22px;border-top:1px solid #222;text-align:center;font-size:11px;padding-top:2px}
    .kp .ss{display:flex;gap:8px;margin-top:16px;align-items:flex-start}.kp .sl{width:165px;flex:none;box-shadow:0 1px 3px rgba(0,0,0,.25);border-radius:4px;overflow:hidden}
    .kp .sh{background:linear-gradient(#fafafa,#e9e9e9);text-align:center;padding:12px 4px 10px;font-size:12px;line-height:1.7}.kp .sh .t1{font-size:15px}.kp .sh .nm{font-size:15px;margin-top:2px}
    .kp table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5px}.kp col.c1{width:12px}.kp col.c3{width:62px}.kp td{border-bottom:1px solid #ddd;padding:3px 4px;height:12px;white-space:nowrap;overflow:hidden}
    .kp td.vl{text-align:right;border-left:1px solid #ddd}.kp td.lb{background:#f3f3f3}.kp td.gl{padding:3px 0 0;background:#f3f3f3;vertical-align:top;font-size:8px;line-height:1.15;text-align:center;border-right:1px solid #ddd}
    .kp tr.sum td.gi,.kp tr.sum td.vl{font-weight:600}.kp tr.net td{background:#f3f3f3}
    .kp .dk{margin-top:16px;box-shadow:0 1px 3px rgba(0,0,0,.25);border-radius:4px;overflow:hidden}.kp .dh{background:linear-gradient(#fafafa,#e9e9e9);padding:14px 14px 12px;font-size:14px}
    .kp table.dt{table-layout:auto;font-size:11px}.kp table.dt th{background:#f3f3f3;font-weight:400;text-align:right;padding:4px 6px;border-bottom:1px solid #ddd}.kp table.dt td{text-align:right;padding:4px 6px;height:auto;border-left:1px solid #ddd}
    .kp table.dt .l{text-align:left}.kp table.dt td.r{text-align:right}.kp table.dt tr.tt td{background:#f3f3f3;border-top:1px solid #bbb}</style>`
    +pages.map((pg,i)=>`<div class="kp"><div class="pt">print: ${pt}</div><div class="ss">${pg.map(slip).join('')}</div><div class="pg">- ${i+1} / ${total} -</div></div>`).join('')+dPages.map(dPage).join('');
  try{ const { jsPDF }=window.jspdf; const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}); const els=box.querySelectorAll('.kp');
    for(let i=0;i<els.length;i++){ const c=await html2canvas(els[i],{scale:2,backgroundColor:'#ffffff'}); if(i) pdf.addPage(); pdf.addImage(c.toDataURL('image/jpeg',0.92),'JPEG',0,0,297,210); }
    pdf.save(`${y}${String(mo).padStart(2,'0')}${ksCode()}-salarylist.pdf`); toast('ダウンロードしました'); }
  catch(e){ await uiAlert('PDF を作れませんでした：'+e.message); } finally{ box.remove(); } }

// v1.70・SQL 281：月給の人の遅刻は15分ごとに 2,000円（連絡なしは2倍）。v1.51・SQL 215：月給の時給は営業日数で割る・レジ精算より後の退勤は早退にしない。v0.34・SQL 074（v0.35：集計「スタッフ」のキャストの下に移動）：黒服の報酬（その月）。基本給−遅刻・早退＋ボーナス＋手当＋個別支給＝課税対象額。直せるのはオーナーだけ（遅刻・早退の減算額とボーナス。操作ログに残る）
function hallPayDraw(r,st,m,casts){ const box=$('hpBox'); if(!box) return;
  if(r.error){ box.innerHTML=`<div class="card err">${esc(/admin_hall_month|hall_month_calc/.test(r.error.message)?'SQL 074 が未実行です：':'黒服の報酬を読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data||{}, rows=D.rows||[], own=!!me?.is_owner, N=v=>Number(v||0), neg=v=>N(v)?`<span style="color:var(--warn)">−${yen(N(v))}</span>`:'—', y0=v=>N(v)?yen(N(v)):'—';
  const sl=D.slide, RK={within:'目標以内',plus2:'＋2%まで',plus5:'＋5%まで',over:'5%超'};
  // v0.61：担当キャスト売上・売上シェア（POS の黒服の詳細と同じ）。担当キャスト売上＝その黒服が担当黒服になっているキャストの係小計の合計。売上シェア＝担当キャスト売上÷（担当黒服のいるキャスト全員の分）
  const hid=new Set(rows.map(x=>x.id)), ms={}, mn={}; let mall=0; (casts||[]).forEach(c=>{ const h=c.manager_id; if(!h||!hid.has(h)) return; ms[h]=(ms[h]||0)+N(c.sales); mall+=N(c.sales); if(c.active) mn[h]=(mn[h]||0)+1; });
  if(!own&&D.kakari_all!=null) mall=N(D.kakari_all); /* v0.68・SQL 087：オーナー以外は自分の行だけ返るので、全体は関数の値を使う */
  const share=x=>mall>0?(Math.round(N(ms[x.id])/mall*1000)/10).toFixed(1)+'%':'—';
  box.innerHTML=`<h2 style="margin:0 0 8px">黒服</h2>
    <div class="card" style="font-size:14px;line-height:1.7">ボーナス総額 <b>${yen(N(D.pool))}</b>　<span class="muted">売上計 ${yen(N(D.sales))}・人件費比率 ${N(D.ratio).toFixed(2)}%${sl?`（目標 ${N(sl.target).toFixed(2)}%・${RK[sl.rank]||''}・「${N(sl.sales_man)}万円以上」の行）`:'（黒服ボーナススライドに当てはまる行がありません）'}</span></div>
    <div class="cs-w"><table class="t cs ks"><thead><tr><th class="nm">名前</th><th>報酬</th><th>担当キャスト売上</th><th>売上シェア</th><th>稼働日数</th><th>稼働時間</th><th>基本給</th><th>遅刻・早退</th><th>ボーナス</th><th>手当</th><th>個別支給</th><th>課税対象額</th><th>罰金</th><th>消費税</th><th>厚生費</th><th>個別控除</th><th>日払（立替）</th><th>源泉徴収</th><th>残り支給額</th>${own?'<th></th>':''}</tr></thead><tbody>
    ${rows.map(x=>`<tr><td class="nm">${esc(x.name)}${x.active?'':' <small class="muted">（退店）</small>'}</td><td>${x.pay_type?CS_HPAY[x.pay_type]+(x.amount!=null?' '+yen(N(x.amount)):''):'<span class="badge warnb">未設定</span>'}</td><td>${yen(N(ms[x.id]))} <small class="muted">担当 ${N(mn[x.id])}人</small></td><td>${share(x)}</td><td>${N(x.days)?N(x.days)+'日':'—'}</td><td>${N(x.hours)?N(x.hours)+'時間':'—'}</td><td>${y0(x.base)}</td>
      <td>${neg(x.late_deduct)}${N(x.late_min)+N(x.early_min)?`<br><small class="muted">遅刻${N(x.late_min)}分・早退${N(x.early_min)}分</small>`:''}${x.late_fixed?' <span class="badge">修正済</span>':''}</td>
      <td>${y0(x.bonus)}${x.bonus_fixed!=null?' <span class="badge">修正済</span>':''}</td><td>${y0(x.allowance)}</td><td>${y0(x.special_pay)}</td><td>${y0(x.taxable)}</td><td>${neg(x.fines)}</td><td>${neg(x.ctax)}</td><td>${neg(x.welfare)}</td><td>${neg(x.special_deduct)}</td><td>${neg(x.advance)}</td><td>${neg(x.withholding)}</td>
      <td>${N(x.net)<0?`<b style="color:var(--warn)">${yen(N(x.net))}</b>`:`<b>${yen(N(x.net))}</b>`}</td>${own?`<td><button class="ghost sm" data-hpfix="${x.id}">修正</button></td>`:''}</tr>`).join('')||`<tr><td colspan="20" class="muted">この月の黒服はいません</td></tr>`}</tbody></table></div>
    <div class="muted hint" style="font-size:13px;margin-top:8px;line-height:1.6">基本給−遅刻・早退＋ボーナス＋手当＋個別支給＝課税対象額<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">基本給：月給＝月給の額、日給＝日給×稼働日数、時給＝時給×稼働時間<br>遅刻・早退：スタッフ設定→黒服の「出勤〜退勤」とタイムカードをくらべて、15分ごとに減算します。月給の人の遅刻は15分ごとに 2,000円（連絡なしは 4,000円。［修正］で遅刻日ごとに選択）、早退は時給分です。日給の人は遅刻・早退とも時給分です。月給の人の時給＝月給÷（その月の営業日数×出勤〜退勤の時間）、日給の人の時給＝日給÷出勤〜退勤の時間。営業日数は、シフト設定の休の日を除いた日数です。レジ精算より後の退勤は、早退にしません（早仕舞いの日）。時給の人は稼働時間で支払うので減算しません。出勤・退勤の時刻が両方入力されていないと減算しません<br>ボーナス：黒服ボーナススライドの総額（売上計で行を選び、人件費比率と目標比率をくらべた額＋売上ボーナス）を、担当キャストの${KL}小計の割合で分けます。人件費比率＝（キャスト報酬＋キャスト日払い＋体験の報酬＋黒服の報酬〈ボーナスの前〉）÷売上計。係専用（店・ママ）は入りません<br>厚生費・消費税はスタッフ設定のとおり。源泉はスタッフ設定で「する」の人だけ<br>［修正］はオーナーのみ。遅刻・早退の減算額とボーナスを修正できます（空にすると自動の計算に戻ります）</div></div>`;
  box.querySelectorAll('[data-hpfix]').forEach(b=>b.onclick=guard(b,async()=>{ const x=rows.find(z=>z.id===b.dataset.hpfix); if(!x) return;
    // v1.70・SQL 281：月給の人は遅刻日ごとに「連絡なし」を選ぶ（15分ごとに 2,000円・連絡なし 4,000円）。理由の入力と操作ログはなし（オーナー 2026-10-28）
    const ld=x.pay_type==='monthly'?(x.late_days||[]):[], md2=d=>{ const t=String(d).slice(5).split('-'); return t[0]+'/'+t[1]; };
    const ldBox=ld.length?`<div style="margin-top:10px;border:1px solid var(--line);border-radius:10px;overflow:hidden"><div style="display:flex;justify-content:space-between;gap:8px;padding:8px 12px;background:var(--soft);font-weight:700"><span>遅刻日</span><span class="muted" style="font-weight:400;font-size:13px">15分ごと 2,000円・連絡なし 4,000円</span></div>
      ${ld.map(z=>`<div style="display:grid;grid-template-columns:60px 56px 1fr auto;align-items:center;gap:6px;padding:7px 12px;border-top:1px solid var(--line)"><span>${md2(z.d)}</span><span>${N(z.min)}分</span><label style="display:inline-flex;align-items:center;gap:5px;margin:0"><input type="checkbox" data-nc="${esc(z.d)}"${z.nocontact?' checked':''}>連絡なし</label><b data-ncamt="${esc(z.d)}" data-min="${N(z.min)}">${yen(N(z.amount))}</b></div>`).join('')}</div>`:'';
    const md=modal(`<h2 style="margin:0">${esc(x.name)}　${csMLabel(m)}の報酬の修正</h2><div class="muted" style="font-size:14px">空にすると自動の計算に戻ります（自動：ボーナス ${yen(N(x.bonus_auto))}）</div>
      ${ldBox}
      <label>遅刻・早退の減算額<input id="hfL" inputmode="numeric" value="${x.late_fixed?N(x.late_deduct):''}" placeholder="自動（${yen(N(x.late_deduct))}）"></label>
      <label>ボーナス<input id="hfB" inputmode="numeric" value="${x.bonus_fixed!=null?N(x.bonus_fixed):''}" placeholder="自動（${yen(N(x.bonus_auto))}）"></label>
      <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
    md.querySelectorAll('[data-nc]').forEach(c=>c.onchange=()=>{ const b=md.querySelector(`[data-ncamt="${c.dataset.nc}"]`); b.textContent=yen(N(b.dataset.min)/15*2000*(c.checked?2:1)); });
    const v=await new Promise(res=>{ md.querySelector('[data-k=no]').onclick=()=>{ md.remove(); res(null); }; md.querySelector('[data-k=ok]').onclick=()=>{ const g=id=>md.querySelector(id).value.trim(); const o={l:g('#hfL'),b:g('#hfB'),nc:[...md.querySelectorAll('[data-nc]:checked')].map(c=>c.dataset.nc)}; md.remove(); res(o); }; });
    if(!v) return; const num=t=>t===''?null:slNum(t); const l=num(v.l), bb=num(v.b);
    if((l!=null&&!(Number.isInteger(l)&&l>=0))||(bb!=null&&!(Number.isInteger(bb)&&bb>=0))){ await uiAlert('金額は0以上の整数で入力してください'); return; }
    const z=await rpc('admin_save_hall_adjust',{p_staff:x.id,p_month:m,p_late:l,p_bonus:bb,p_nocontact:v.nc}); if(!z.ok) return; toast('修正しました'); PAGES.cast_sales(); })); }

