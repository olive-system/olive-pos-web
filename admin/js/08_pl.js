// ---------- 収支 v0.30・SQL 070：月次（1日1行）→ 日付を押すと日次（営業日報・現金管理・入出金・伝票一覧・勤怠）。d-system の収支と同じ形 ----------
// 売上は会計済の伝票の入金を売上日で（置きは入金した日、請求＝請求書）。キャスト報酬は日ごと＝その日の時間報酬＋商品バック＋手当−日払。月で決まるものは合計の行だけ（合計＝集計「キャスト」の残り支給額）
// v0.32・SQL 072：総人件費＝キャスト報酬＋日払い（キャスト・黒服）。合計の行は 黒服の報酬（月給・日給・時給）も入る（黒服日払いは黒服の報酬の先払いなので二重にしない）。人件費比率＝総人件費÷売上計。経費＝出金。勤怠の時刻は「収支」を変えられる人が直せる（理由は必須・操作ログ）
let plMonth=null, plDate=null;
const plYen=v=>Number(v||0)?yen(v).replace(/^-/,'−'):'—';
const plRate=(a,b)=>Number(b||0)?(Math.round(Number(a||0)/Number(b)*10000)/100).toFixed(2)+'%':'—%';
// v1.11：収支の上の「置き」と「ユニーク数」（まとめと同じ数え方）。あとから入れる
async function plFill(st,m){ setTimeout(async()=>{
  const ok=await sb.rpc('admin_oki_month',{p_store:st,p_month:m}); if($('plOki')) $('plOki').textContent=ok.error?'—':Object.values(ok.data||{}).reduce((a,v)=>a+Number(v||0),0).toLocaleString('ja-JP');
  try{ const set=new Set(); for(let i=0;i<20;i++){ const q=await sb.from('bills').select('bill_customers(customer_id)').eq('store_id',st).eq('status','closed').gte('business_date',m).lt('business_date',csAddMonth(m,1)).order('business_date').range(i*1000,i*1000+999); if(q.error) throw 0; (q.data||[]).forEach(b=>(b.bill_customers||[]).forEach(c=>c.customer_id&&set.add(c.customer_id))); if((q.data||[]).length<1000) break; }
    if($('plUq')) $('plUq').textContent=set.size+'名'; }catch(e){ if($('plUq')) $('plUq').textContent='—'; } },0); }
const plLabor=x=>Number(x.cast_pay||0)+Number(x.cast_adv||0)+(x.hall_pay==null?Number(x.hall_adv||0):Math.max(Number(x.hall_pay||0),Number(x.hall_adv||0))); // 総人件費
function plTotals(d){ const D=d.days||[], S=k=>D.reduce((a,x)=>a+Number(x[k]||0),0); const t={date:'合計',cash:S('cash'),invoice:S('invoice'),card:S('card'),sales:S('sales'),kakari_sub:S('kakari_sub'),douhan_sub:S('douhan_sub'),groups:S('groups'),guests:S('guests'),
  cast_pay:Number(d.cast_net||0),cast_adv:S('cast_adv'),hall_adv:S('hall_adv'),hall_pay:Number(d.hall_pay||0),cash_in:S('cash_in'),cash_out:S('cash_out')}; t.cast_gross=t.cast_pay+t.cast_adv; return t; }
const PL_COLS=[['売上',[['cash','現金'],['invoice','請求'],['card','カード'],['sales','売上計']]],['キャスト売上',[['kakari_sub',''+KL+'小計']]],
  ['経費',[['cast_pay','キャスト報酬'],['adv','日払い'],['labor','総人件費'],['rate','人件費比率'],['cash_in','入金'],['cash_out','出金']]]];
const plCell=(k,x)=>k==='rate'?plRate(plLabor(x),x.sales):k==='labor'?plYen(plLabor(x)):k==='adv'?plYen(Number(x.cast_adv||0)+Number(x.hall_adv||0)):plYen(x[k]);
PAGES.pl=()=>plDate?plDayPage():plMonthPage();
async function plMonthPage(){ const st=storeId, now=csNowMonth(); if(!plMonth) plMonth=now; const m=plMonth, mOpts=Array.from({length:13},(_,i)=>csAddMonth(now,-i));
  const head=`<h1>収支 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="row" style="margin-bottom:12px;justify-content:space-between"><select id="plM" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel(x)}</option>`).join('')}</select><button class="ghost" id="plXls" disabled>Excel</button></div>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>'; let data=null;
  const wire=()=>{ $('plM').onchange=()=>{ plMonth=$('plM').value; PAGES.pl(); }; const x=$('plXls'); if(x&&data){ x.disabled=false; x.onclick=guard(x,()=>plExcel(data)); } $('main').querySelectorAll('[data-pld]').forEach(e=>e.onclick=()=>{ plDate=e.dataset.pld; PAGES.pl(); }); }; wire();
  const r=await sb.rpc('admin_pl_month',{p_store:st,p_month:m}); if(page!=='pl'||storeId!==st||plMonth!==m||plDate) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_pl_month|cast_month_calc/.test(r.error.message)?'SQL 070 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; wire(); return; }
  data=r.data; const T=plTotals(data), cols=PL_COLS.flatMap(([g,cs])=>cs);
  const box=(l,v,c)=>`<div style="display:flex;align-items:center;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff;flex:1 1 220px"><span style="background:${c};padding:12px 16px;font-weight:700;white-space:nowrap">${l}</span><b style="flex:1;text-align:right;padding:12px 16px;font-size:20px">${v}</b></div>`;
  // v1.11：上に「まとめ」の月間（売上・来店・経費・入金の4つの箱。オーナー 2026-10-17「収支の上にまとめの月間を。かさばらないように」→ 見本ア、客単価のあとで改行）
  const Nn=v=>Number(v||0), per=(a,b)=>Nn(b)?Math.round(Nn(a)/Nn(b)).toLocaleString('ja-JP'):'0', cm=v=>Nn(v).toLocaleString('ja-JP'), lab=plLabor(T), ex=lab+Nn(T.cash_out);
  // v1.17：箱の中は「名前（左）｜数字（右）」の表の形（オーナー「現金 98,000／カード 4,243,000 …こんな感じ。他の枠も」）
  const kb=(k,v,rows)=>`<div class="card" style="margin:0;padding:10px 12px"><div class="muted" style="font-size:12px">${k}</div><div style="font-size:20px;font-weight:700;margin:2px 0 6px">${v}</div>${rows.length?`<div style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:13px">${rows.map(([a,b])=>`<span class="muted">${a}</span><span style="text-align:right;font-variant-numeric:tabular-nums">${b}</span>`).join('')}</div>`:''}</div>`;
  $('main').innerHTML=head+`<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px">
      ${kb('売上',plYen(T.sales),[['現金',cm(T.cash)],['カード',cm(T.card)],['請求',cm(T.invoice)],['置き','<span id="plOki">…</span>']])}
      ${kb('来店',`${Nn(T.groups)}組 ${Nn(T.guests)}名`,[['ユニーク','<span id="plUq">…</span>'],['客単価',per(T.sales,T.guests)],['組単価',per(T.sales,T.groups)]])}
      ${kb('経費',plYen(ex),[['キャスト',cm(Nn(T.cast_pay)+Nn(T.cast_adv))],['黒服',cm(lab-Nn(T.cast_pay)-Nn(T.cast_adv))],['諸経費',cm(T.cash_out)]])}
      ${kb('入金',plYen(T.cash_in),[])}</div>
    <div id="invBox" style="margin-bottom:14px"><div class="card muted">請求書の未入金を読み込み中…</div></div>${(plFill(st,m),'')}
    <div class="muted" style="font-size:13px;margin-bottom:6px">日付を押すと、その日の収支（日次）を開きます</div>
    <div class="cs-w"><table class="t cs ks"><thead><tr><th class="nm" rowspan="2">${csMLabel(m)}</th>${PL_COLS.map(([g,cs])=>`<th colspan="${cs.length}" class="ksg">${g}</th>`).join('')}</tr><tr>${cols.map(([,l])=>`<th>${l}</th>`).join('')}</tr></thead><tbody>
    <tr class="kst"><td class="nm"><b>合計</b></td>${cols.map(([k])=>`<td>${plCell(k,T)}</td>`).join('')}</tr>
    ${(data.days||[]).map(x=>{ const wd=new Date(x.date+'T00:00:00').getDay(); return `<tr><td class="nm"><a data-pld="${x.date}" style="color:var(--blue);cursor:pointer">${md(x.date)}</a> <span style="color:${wd===0?'var(--warn)':wd===6?'var(--pri)':'var(--muted)'}">${WJ[wd]}</span></td>${cols.map(([k])=>`<td>${plCell(k,x)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>
    <div class="muted hint" style="font-size:13px;margin-top:8px;line-height:1.6">売上は会計済の伝票の入金を売上日で数えます<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">置きは入金日に、入金方法（現金・カード）で入ります<br>キャスト報酬：日ごとは その日の時間報酬（月の決定時給×稼働時間、日給の人は日給）＋商品バック＋手当 − その日の日払。小計バック・個別支給・罰金・控除・源泉など月で決まるものは、合計の行だけに入ります（合計は集計「キャスト」の残り支給額の合計）<br>総人件費＝キャスト報酬＋日払い（キャスト・黒服）。合計の行は 黒服の報酬（基本給−遅刻・早退＋ボーナス＋手当など。スタッフ設定の「黒服の報酬」と同じ）も入ります。黒服日払いは黒服の報酬の先払いなので、二重には数えません<br>人件費比率＝総人件費÷売上計。上の「経費」は出金（領収書精算・支払いなど）の合計</div></div>`;
  wire(); invRender(st); }
async function plExcel(d){ /* 請求書がある月は、フォルダのいちばん上に 00_請求書_… を入れる（plInvoices） */ try{ await ksLoad('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); }catch(e){ await uiAlert(e.message); return; }
  const T=plTotals(d), cols=PL_COLS.flatMap(([g,cs])=>cs.map(c=>[g,...c])), [y,mo]=String(d.month).split('-').map(Number);
  const val=(k,x)=>k==='rate'?(Number(x.sales||0)?Math.round(plLabor(x)/Number(x.sales)*10000)/100:0):k==='labor'?plLabor(x):k==='adv'?Number(x.cast_adv||0)+Number(x.hall_adv||0):Number(x[k]||0);
  const aoa=[[`収支明細（月次）${y}年${mo}月`],['日付',...cols.map(c=>c[1])],['',...cols.map(c=>c[2]+(c[1]==='rate'?'(%)':''))],['合計',...cols.map(c=>val(c[1],T))],...(d.days||[]).map(x=>[x.date,...cols.map(c=>val(c[1],x))])];
  aoa[1]=['日付',...cols.map((c,i)=>i>0&&cols[i-1][0]===c[0]?null:c[0]||c[2])]; aoa[2]=['',...cols.map(c=>c[0]?c[2]+(c[1]==='rate'?'(%)':''):null)];
  const ws=XLSX.utils.aoa_to_sheet(aoa), mg=[{s:{r:1,c:0},e:{r:2,c:0}}]; let j=0; while(j<cols.length){ let k=j; while(k+1<cols.length&&cols[k+1][0]===cols[j][0]) k++; if(cols[j][0]) mg.push({s:{r:1,c:j+1},e:{r:1,c:k+1}}); else mg.push({s:{r:1,c:j+1},e:{r:2,c:j+1}}); j=k+1; }
  ws['!merges']=mg; ws['!cols']=[{wch:12},...cols.map(()=>({wch:11}))]; const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'月次収支明細');
  // v0.33・SQL 073：d-system と同じく ZIP（フォルダの中に 月次1つ＋日次をその月の全部の日。日次のタブは 出金・入金・伝票一覧・メモ）
  const ym=`${y}-${String(mo).padStart(2,'0')}`, base=`${curStore()?.name||'OLIVE'}_収支明細-${ym}`.replace(/[\\/:*?"<>|]/g,'_');
  try{ await ksLoad('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'); }catch(e){ await uiAlert(e.message); return; }
  const ex=await sb.rpc('admin_pl_export',{p_store:storeId,p_month:d.month}); if(ex.error){ await uiAlert((/admin_pl_export/.test(ex.error.message)?'SQL 073 が未実行です：':'')+ex.error.message); return; }
  const E=ex.data||{}, zip=new JSZip(), dir=zip.folder(base), out=w=>XLSX.write(w,{bookType:'xlsx',type:'array'});
  dir.file(`月次収支明細-${ym}.xlsx`,out(wb));
  if(!await plInvoices(dir,d.month)) return;
  const hm=t=>t?new Date(t).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}):'';
  const dur=(a,b)=>{ if(!a||!b) return ''; const m=Math.max(0,Math.round((new Date(b)-new Date(a))/60000)); return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`; };
  const sheet=(aoa,w,mg)=>{ const x=XLSX.utils.aoa_to_sheet(aoa); x['!cols']=w.map(n=>({wch:n})); if(mg) x['!merges']=mg; return x; };
  const last=new Date(y,mo,0).getDate();
  for(let i=1;i<=last;i++){ const dd=`${ym}-${String(i).padStart(2,'0')}`, w=XLSX.utils.book_new();
    const mv=k=>(E.moves||[]).filter(x=>x.date===dd&&x.kind===k), mvs=(k,l)=>{ const r=mv(k); return sheet([['摘要',l,'備考'],...r.map(x=>[x.memo||'',Number(x.amount||0),'']),['合計',r.reduce((a,x)=>a+Number(x.amount||0),0),'']],[24,12,24]); };
    XLSX.utils.book_append_sheet(w,mvs('out','支払金額'),'出金'); XLSX.utils.book_append_sheet(w,mvs('in','収入金額'),'入金');
    const bs=(E.bills||[]).filter(b=>b.date===dd), N=k=>bs.reduce((a,b)=>a+Number(b[k]||0),0);
    const O=[0,1,2,3,4,5,6,7,8,9,11,16,12,13,14,15,10], ord=r=>O.map(i=>r[i]); // v0.37：列の順番（係小計・合計のあとに現金〜置き、注文は最後）
    XLSX.utils.book_append_sheet(w,sheet([ord(['№','入店','退店','時間','領収書','卓番号','客数','顧客',''+KL+'','同伴','注文',''+KL+'小計','現金','カード','請求','置き','合計']),
      ...bs.map((b,j)=>ord([j+1,beHm5(b.opened_at),b.closed_at?hm(b.closed_at):'来店中',dur(b.opened_at,b.closed_at),b.receipt?'◯':'',b.table||'',Number(b.guests||0),b.customers||'',b.kakari||'',b.douhan||'',b.items||'',Number(b.sub||0),Number(b.cash||0),Number(b.card||0),Number(b.invoice||0),Number(b.oki||0),Number(b.due||0)])),
      ord(['計','','','',bs.filter(b=>b.receipt).length,'',N('guests'),'','','','',N('sub'),N('cash'),N('card'),N('invoice'),N('oki'),N('due')])],ord([5,7,7,7,7,9,6,16,14,14,40,10,10,10,10,10,10])),'伝票一覧');
    const memo=(E.memos||[]).find(x=>x.date===dd)?.memo||''; XLSX.utils.book_append_sheet(w,sheet([['メモ'],[memo]],[80]),'メモ');
    dir.file(`日次収支明細-${dd}.xlsx`,out(w)); }
  const blob=await zip.generateAsync({type:'blob'}), a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${base}.zip`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000); toast('ダウンロードしました'); }
// v1.38・SQL 171：請求書（オーナー 2026-10-19「請求がある月は、収支のDLで、月次の上（最初）につけてほしい」「その月の分を、会社ごとに1枚」）
// オーナーの今の請求書と同じ形。その月に「請求書」で会計した分を、売上日ごとに1行（ご飲食代）。宛先は POS で選んだ請求先（会社名・住所・宛名）。請求先ごとに1枚。請求先が無い前の会計は、お客様の会社名・会社住所
// 画像（ロゴ）を入れるため、ここだけ ExcelJS で作る。ファイル名は 00_ で始めて、フォルダのいちばん上に並べる
async function plInvoices(dir,month){
  const r=await sb.rpc('admin_invoice_month',{p_store:storeId,p_month:month}); if(r.error){ await uiAlert((/admin_invoice_month/.test(r.error.message)?'SQL 171 が未実行です：':'')+r.error.message); return false; }
  const I=r.data||{}, rows=I.rows||[]; if(!rows.length) return true;
  try{ await ksLoad('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'); }catch(e){ await uiAlert(e.message); return false; }
  let logo=null; try{ const b=new Uint8Array(await (await fetch('img/olive_logo.png')).arrayBuffer()); let t=''; for(let i=0;i<b.length;i+=8192) t+=String.fromCharCode(...b.subarray(i,i+8192)); logo=btoa(t); }catch(e){}
  const G='FF4B5320', LG='FF6B7436', who=x=>(x.company?'c:'+x.company+'|':'n:')+(x.attn||x.receipt_name||x.name||''), groups=[];
  rows.forEach(x=>{ let g=groups.find(z=>z.k===who(x)); if(!g){ g={k:who(x),h:x,days:[]}; groups.push(g); } const dd=g.days.find(z=>z.date===x.date); if(dd) dd.amount+=Number(x.amount||0); else g.days.push({date:x.date,amount:Number(x.amount||0)}); });
  const zipSplit=a=>{ const m=String(a||'').match(/^(〒?\s*\d{3}-?\d{4})[\s　]+(.*)$/s); return (m?[m[1].replace(/\s/g,''),m[2]]:[String(a||'')]).flatMap(l=>l.split(/\n/)).map(l=>l.trim()).filter(Boolean); };
  const used={};
  for(const g of groups){ const h=g.h, nm=(h.attn||h.receipt_name||h.name||'').trim(), wb=new ExcelJS.Workbook(), ws=wb.addWorksheet('請求書',{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,margins:{left:0.5,right:0.5,top:0.6,bottom:0.6,header:0.3,footer:0.3}},views:[{showGridLines:false}]});
    ws.columns=[{width:2},{width:30},{width:12},{width:10},{width:15},{width:2}];
    const font=(c,o={})=>{ c.font={size:10,...o}; }, bar=r=>{ ['B','C','D'].forEach(k=>{ ws.getCell(k+r).fill={type:'pattern',pattern:'solid',fgColor:{argb:G}}; }); ws.getRow(r).height=5; };
    bar(2);
    const L=[...(h.company?zipSplit(h.company_address).map(t=>({t})):[]),...(h.company?[{t:''},{t:h.company}]:[]),{t:nm?nm.replace(/\s+/,'　')+'　様':'',b:true}];
    const R=[{t:'請求書',big:true},{logo:true},{logo:true},{t:I.reg?'登録番号…'+I.reg:'',g:true},{t:''}];
    (I.stores||[]).forEach(st=>{ zipSplit(st.address).forEach(t=>R.push({t,g:true})); if(st.phone) R.push({t:st.phone,g:true}); R.push({t:''}); });
    String(I.bank||'').split(/\n/).map(t=>t.trimEnd()).filter(Boolean).forEach(t=>R.push({t}));
    const top=4, n=Math.max(L.length,R.length);
    for(let i=0;i<n;i++){ const row=top+i, l=L[i], rr=R[i];
      if(l){ const c=ws.getCell('B'+row); c.value=l.t; font(c,l.b?{size:12,bold:true}:{}); }
      if(rr&&!rr.logo){ const c=ws.getCell('C'+row); c.value=rr.t; font(c,rr.big?{size:16}:rr.g?{size:8,color:{argb:LG}}:{size:9}); if(rr.big) ws.getRow(row).height=24; }
      if(rr&&rr.logo) ws.getRow(row).height=18; }
    if(logo){ const id=wb.addImage({base64:logo,extension:'png'}); ws.addImage(id,{tl:{col:2,row:top},ext:{width:120,height:38}}); }
    let r0=top+n+1; ['B','C','D','E'].forEach(k=>{ ws.getCell(k+r0).border={bottom:{style:'dotted',color:{argb:'FF888888'}}}; });
    r0+=2; const hd=ws.getRow(r0); ['詳細','日付','単価','金額'].forEach((t,i)=>{ const c=hd.getCell(i+2); c.value=t; c.font={size:10,color:{argb:'FFFFFFFF'}}; c.alignment={horizontal:'center',vertical:'middle'}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:G}}; }); hd.height=18;
    const dl={style:'dotted',color:{argb:'FF999999'}}, lines=Math.max(8,g.days.length);
    g.days.sort((a,b)=>a.date<b.date?-1:1);
    for(let i=0;i<lines;i++){ const rw=ws.getRow(r0+1+i), x=g.days[i]; rw.height=20;
      if(x){ rw.getCell(2).value=i===0?'ご飲食代':''; const [,mm,dd]=x.date.split('-').map(Number); rw.getCell(3).value=`${mm}月${dd}日`; rw.getCell(5).value=x.amount; rw.getCell(5).numFmt='#,##0'; }
      [2,3,4,5].forEach(k=>{ const c=rw.getCell(k); font(c,{size:11}); c.alignment={horizontal:k===2?'left':'right',vertical:'middle',indent:k===2?1:0}; c.border={bottom:dl,...(k>2?{left:dl}:{})}; }); }
    const tr=ws.getRow(r0+1+lines); tr.height=22; [2,3,4,5].forEach(k=>{ const c=tr.getCell(k); c.border={top:{style:'medium'},bottom:dl,...(k>2?{left:dl}:{})}; font(c,{size:11}); c.alignment={horizontal:'right',vertical:'middle'}; });
    tr.getCell(4).value='合計'; tr.getCell(5).value=g.days.reduce((a,x)=>a+x.amount,0); tr.getCell(5).numFmt='"¥"#,##0';
    const nt=ws.getCell('E'+(r0+2+lines)); nt.value='（10%対象 消費税込み）'; font(nt,{size:8}); nt.alignment={horizontal:'right'};
    ['いつもありがとうございます。','上記の通り、ご請求申し上げます。','今後ともよろしくお願い致しますm(__)m'].forEach((t,i)=>{ const c=ws.getCell('B'+(r0+3+lines+i)); c.value=t; font(c); });
    bar(r0+7+lines);
    ws.pageSetup.printArea=`A1:F${r0+8+lines}`;
    const fn=`00_請求書_${[h.company,nm?nm.split(/[\s　]+/)[0]+'様':''].filter(Boolean).join('_')||'お名前なし'}`.replace(/[\\/:*?"<>|]/g,'_'); used[fn]=(used[fn]||0)+1;
    dir.file(`${fn}${used[fn]>1?'_'+used[fn]:''}.xlsx`,await wb.xlsx.writeBuffer()); }
  return true; }
async function plDayPage(){ const st=storeId, d=plDate, ed=perm('pl')==='edit', m=d.slice(0,7)+'-01';
  const jd=x=>{ const t=new Date(x+'T00:00:00'); return `${t.getFullYear()}年${t.getMonth()+1}月${t.getDate()}日(${WJ[t.getDay()]})`; };
  const head=`<h1>収支 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="row" style="margin-bottom:12px"><button class="ghost" id="plBack">◀ 月次へ</button><button class="ghost" id="plPrev">前の日</button><input type="date" id="plDate" value="${d}" style="width:auto"><button class="ghost" id="plNext">次の日</button>${ed?'':'<span class="muted" style="font-size:13px">閲覧のみ</span>'}</div>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const wire=()=>{ $('plBack').onclick=()=>{ plMonth=m; plDate=null; PAGES.pl(); }; $('plPrev').onclick=()=>{ plDate=dayAdd(d,-1); PAGES.pl(); }; $('plNext').onclick=()=>{ plDate=dayAdd(d,1); PAGES.pl(); }; $('plDate').onchange=()=>{ if($('plDate').value){ plDate=$('plDate').value; PAGES.pl(); } }; }; wire();
  const [rm,rd]=await Promise.all([sb.rpc('admin_pl_month',{p_store:st,p_month:m}), sb.rpc('admin_pl_day',{p_store:st,p_date:d})]); if(page!=='pl'||storeId!==st||plDate!==d) return;
  const er=rm.error||rd.error; if(er){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_pl_|cast_month_calc/.test(er.message)?'SQL 070 が未実行です：':'読み込めません：')}${esc(er.message)}</div>`; wire(); return; }
  const D=(rm.data.days||[]).filter(x=>x.date<=d), today=D.find(x=>x.date===d)||{}, S=k=>D.reduce((a,x)=>a+Number(x[k]||0),0), open=D.filter(x=>Number(x.sales||0)>0||Number(x.groups||0)>0).length||1, X=rd.data;
  const rep=[['総売上','sales'],['現金売上','cash'],['カード売上','card'],['請求','invoice'],null,['キャスト売上','kakari_sub'],['キャスト報酬','cast_gross'],null];
  const repRows=rep.map(r=>r?`<tr><td>${r[0]}</td><td>${plYen(today[r[1]])}</td><td>${plYen(S(r[1]))}</td><td>${plYen(Math.round(S(r[1])/open))}</td></tr>`:'<tr class="sep"><td colspan="4"></td></tr>').join('')
    +`<tr><td>客組人数</td><td>${Number(today.groups||0)}組 ${Number(today.guests||0)}名</td><td>${S('groups')}組 ${S('guests')}名</td><td>${Math.round(S('groups')/open*10)/10}組 ${Math.round(S('guests')/open*10)/10}名</td></tr>
     <tr><td>客単価</td><td>${Number(today.guests||0)?plYen(Math.round(Number(today.sales||0)/Number(today.guests))):'—'}</td><td>${S('guests')?plYen(Math.round(S('sales')/S('guests'))):'—'}</td><td>—</td></tr>`;
  const adv=X.advances||[], fAdv=adv.filter(a=>a.kind!=='hall').reduce((a,x)=>a+Number(x.amount||0),0), mAdv=adv.filter(a=>a.kind==='hall').reduce((a,x)=>a+Number(x.amount||0),0);
  const mv=X.moves||[], inS=mv.filter(x=>x.kind==='in').reduce((a,x)=>a+Number(x.amount||0),0), outS=mv.filter(x=>x.kind==='out').reduce((a,x)=>a+Number(x.amount||0),0);
  const cl=X.closing, opening=cl?cl.opening_float:X.prev_float, recv=Number(today.cash||0)+inS, paid=fAdv+mAdv+outS;
  const cashRows=[['本日釣銭',plYen(opening),'',''],['現金売上',plYen(today.cash),'',''],['入金',plYen(inS),'',''],['日払報酬（キャスト）','',plYen(fAdv),''],['日払報酬（黒服）','',plYen(mAdv),''],['出金','',plYen(outS),''],['合計',plYen(recv),plYen(paid),plYen(recv-paid)],
    ['現金過不足','','',cl?plYen(cl.diff):'<span class="badge warnb">未精算</span>'],['預金額','','',cl?plYen(cl.deposit):'—'],['翌日釣銭','','',cl?plYen(cl.next_float):'—'],['現金過不足 当月累計','','',plYen(X.month_closings?.diff)],['預金額 当月累計','','',plYen(X.month_closings?.deposit)]];
  const list=(k,l)=>{ const rows=mv.filter(x=>x.kind===k); return `<div class="card"><h2>${l} - ${jd(d)}</h2><table class="t pl"><tr><th>摘要</th><th class="r">金額</th></tr>${rows.map(x=>`<tr><td>${esc(x.memo||'')}</td><td class="r">${plYen(x.amount)}</td></tr>`).join('')}<tr class="kst"><td>合計</td><td class="r">${plYen(rows.reduce((a,x)=>a+Number(x.amount||0),0))}</td></tr></table></div>`; };
  const hm=t=>t?new Date(t).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}):''; // 時刻は日本時間で出す（直す時も日本時間で送る）
  const own=!!me?.is_owner, bills=X.bills||[], bt=k=>bills.reduce((a,b)=>a+Number(b[k]||0),0);
  const billRows=bills.map((b,i)=>`<tr><td><a data-bvw="${b.id}" style="color:var(--blue);cursor:pointer;text-decoration:underline">${i+1}</a></td><td>${b.status==='void'?'削除':b.closed_at?'会計済':'<span class="badge">来店中</span>'}</td><td>${esc(b.customers||'')}</td><td>${esc(b.kakari||'')}</td><td class="r"><b>${plYen(b.due)}</b></td><td class="r">${plYen(b.cash)}</td><td class="r">${plYen(b.card)}</td><td class="r">${plYen(b.invoice)}</td><td class="r">${b.oki?plYen(b.oki):'—'}</td><td class="r">${b.guests}</td><td>${esc(b.table||'')}</td><td>${blDur(b.opened_at,b.closed_at)}</td>${own?`<td>${b.closed_at&&b.status==='closed'?`<button class="ghost sm" data-bed="${b.id}">修正</button>`:''}</td>`:''}</tr>`).join('');
  // 勤怠：一人1行（同伴・出勤・退勤またはアフター）。時刻は打刻した時刻、小さく丸めた時刻（計算に使う時刻）
  const EV={douhan:'同伴',clock_in:'出勤',clock_out:'退勤',after:'アフター'}, ppl=[]; (X.events||[]).forEach(e=>{ let p=ppl.find(z=>z.id===e.staff_id); if(!p){ p={id:e.staff_id,name:e.name,kind:e.kind,ev:{}}; ppl.push(p); } p.ev[e.type]=e; });
  const tcell=e=>e?`<span${e.corrected?' style="color:var(--warn)"':''}>${hm(e.at)}</span>${e.rounded_at&&hm(e.rounded_at)!==hm(e.at)?` <small class="muted">→${hm(e.rounded_at)}</small>`:''}${ed?` <button class="ghost sm" data-pfx="${e.id}">修正</button>`:''}`:'—';
  const attRows=ppl.map(p=>`<tr><td>${esc(p.name)}${p.kind==='hall'?' <small class="muted">黒服</small>':''}</td><td>${tcell(p.ev.douhan)}</td><td>${tcell(p.ev.clock_in)}</td><td>${tcell(p.ev.clock_out||p.ev.after)}${p.ev.after?' <small class="muted">アフター</small>':''}</td></tr>`).join('');
  $('main').innerHTML=head+`<div class="plg">
    <div class="card"><h2>営業日報 - ${jd(d)}</h2><table class="t pl"><tr><th></th><th class="r">${md(d)}(${WJ[new Date(d+'T00:00:00').getDay()]})</th><th class="r">累計（${Number(d.slice(8))}日時点）</th><th class="r">平均（${open}営業日）</th></tr>${repRows}</table></div>
    <div class="card"><h2>現金管理 - ${jd(d)}</h2><table class="t pl"><tr><th>摘要</th><th class="r">収入金額</th><th class="r">支払金額</th><th class="r">差引残高</th></tr>${cashRows.map(r=>`<tr><td>${r[0]}</td><td class="r">${r[1]}</td><td class="r">${r[2]}</td><td class="r">${r[3]}</td></tr>`).join('')}</table>
      <div class="row" style="margin-top:8px"><button class="ghost sm" id="plReg">この日の現金管理を開く</button></div></div>
    ${list('out','出金')}${list('in','入金')}</div>
    <div class="card"><h2>伝票一覧 - ${jd(d)}</h2><div class="cs-w" style="border:none"><table class="t pl"><tr><th>No</th><th>状態</th><th>お客様</th><th>${KL}</th><th class="r">合計</th><th class="r">現金</th><th class="r">カード</th><th class="r">請求</th><th class="r">置き</th><th class="r">客数</th><th>卓</th><th>時間</th>${own?'<th></th>':''}</tr>
      ${billRows||`<tr><td colspan="${own?13:12}" class="muted">伝票はありません</td></tr>`}${bills.length?`<tr class="kst"><td colspan="4">合計</td><td class="r">${plYen(bt('due'))}</td><td class="r">${plYen(bt('cash'))}</td><td class="r">${plYen(bt('card'))}</td><td class="r">${plYen(bt('invoice'))}</td><td class="r">${plYen(bt('oki'))}</td><td class="r">${bt('guests')}</td><td colspan="2"></td>${own?'<td></td>':''}</tr>`:''}</table></div></div>
    <div class="card"><h2>勤怠 - ${jd(d)}</h2><table class="t pl"><tr><th>名前</th><th>同伴</th><th>出勤</th><th>退勤</th></tr>${attRows||'<tr><td colspan="4" class="muted">打刻はありません</td></tr>'}</table>
      <div class="muted" style="font-size:13px;margin-top:6px">→の後は計算に使う時刻（丸めた時刻）。赤は修正済の時刻</div></div>`;
  wire(); $('plReg').onclick=()=>{ regDate=d; regTab='day'; go('register'); };
  $('main').querySelectorAll('[data-bed]').forEach(bn=>bn.onclick=guard(bn,()=>billEdit(bn.dataset.bed)));
  $('main').querySelectorAll('[data-bvw]').forEach(a=>a.onclick=()=>billView(a.dataset.bvw,own&&!!bills.find(b=>b.id===a.dataset.bvw&&b.closed_at&&b.status==='closed')));
  $('main').querySelectorAll('[data-pfx]').forEach(bn=>bn.onclick=guard(bn,async()=>{ const e=(X.events||[]).find(z=>z.id===bn.dataset.pfx); if(!e) return;
    const mdl=modal(`<h2 style="margin:0">${esc(e.name)}　${EV[e.type]||''}の時刻の修正</h2><div class="muted">今：${hm(e.at)}</div><label>時刻<input type="time" id="pfT" value="${hm(e.at)}"></label><div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">修正</button></div>`);
    const v=await new Promise(res=>{ mdl.querySelector('[data-k=no]').onclick=()=>{ mdl.remove(); res(null); }; mdl.querySelector('[data-k=ok]').onclick=()=>{ const t=mdl.querySelector('#pfT').value; mdl.remove(); res({t,rs:null}); }; });
    if(!v) return; if(!v.t){ await uiAlert('時刻を入力してください'); return; }
    const day=v.t<'08:00'?dayAdd(d,1):d; const z=await rpc('admin_punch_fix',{p_event:e.id,p_at:`${day}T${v.t}:00+09:00`,p_reason:v.rs}); if(!z.ok) return; toast('修正しました'); PAGES.pl(); })); }

