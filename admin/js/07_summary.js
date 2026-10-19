// ---------- まとめ v0.50：月間と本日（v0.71 から箱は2つだけ）、売上推移のグラフ。数字は収支と同じ（admin_pl_month） ----------
// 経費＝人件費（キャスト＝キャスト報酬＋日払い、黒服＝黒服の報酬。日ごとは黒服日払い）＋諸経費（出金）。粗利＝売上＋入金−人件費−諸経費
let smMonth=null, smChart=null;
PAGES.summary=async()=>{ const st=storeId, now=csNowMonth(); if(!smMonth) smMonth=now; const m=smMonth, mOpts=Array.from({length:13},(_,i)=>csAddMonth(now,-i));
  if(smChart){ smChart.destroy(); smChart=null; }
  const head=`<h1>まとめ <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="row" style="margin-bottom:12px"><select id="smM" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel(x)}</option>`).join('')}</select></div>`;
  const wire=()=>{ $('smM').onchange=()=>{ smMonth=$('smM').value; PAGES.summary(); }; };
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>'; wire();
  // v0.59：ユニーク数＝その期間に来店した、登録のあるお客様の人数（同じお客様は何回来ても1人。会計済の伝票）。読めない時は「—」
  const uniq=(async()=>{ try{ const all=[]; for(let i=0;i<20;i++){ const q=await sb.from('bills').select('business_date,bill_customers(customer_id)').eq('store_id',st).eq('status','closed').gte('business_date',m).lt('business_date',csAddMonth(m,1)).order('business_date').range(i*1000,i*1000+999); if(q.error) return null; all.push(...(q.data||[])); if((q.data||[]).length<1000) break; }
      const cnt=f=>new Set(all.filter(f).flatMap(b=>(b.bill_customers||[]).map(c=>c.customer_id)).filter(Boolean)).size; return {month:cnt(()=>true),day:d=>cnt(b=>b.business_date===d)}; }catch(e){ return null; } })();
  const okiP=sb.rpc('admin_oki_month',{p_store:st,p_month:m}); const r=await sb.rpc('admin_pl_month',{p_store:st,p_month:m}); const U=await uniq; const okR=await okiP, OK=okR.error?null:(okR.data||{}); if(page!=='summary'||storeId!==st||smMonth!==m) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(r.error.message)}</div>`; wire(); return; }
  const d=r.data, D=d.days||[], T=plTotals(d), N=v=>Number(v||0), per=(a,b)=>N(b)?yen(Math.round(N(a)/N(b))):yen(0);
  const hallM=Math.max(N(T.hall_pay),N(T.hall_adv)), castD=x=>N(x.cast_pay)+N(x.cast_adv);
  // v0.71：箱に分けない。「月間」と「本日」の2つだけ。並びは同じ（オーナーの指示 2026-10-14）。v0.72：売上のまとまりを一番上に（オーナーの指示）。売上の内訳は 現金・置き・請求・カード
  // 置き＝その期間に置きにして、まだ入金されていない額（SQL 088 の admin_oki_month。売上の合計には入らない。関数が無い時は「—」）
  const okiOf=f=>OK==null?null:Object.entries(OK).filter(([k])=>f(k)).reduce((a,[,v])=>a+N(v),0);
  const one=(ttl,x,fPay,mPay,uq,oki)=>`<div class="smb"><h2 style="background:var(--head);color:#fff">${ttl}</h2><table>${[
    ['売上',yen(x.sales),1],['現金',yen(x.cash),2],['置き',oki==null?'—':yen(oki),2],['請求',yen(x.invoice),2],['カード',yen(x.card),2],
    ['来店人数',N(x.guests)+'名',3],['来店組数',N(x.groups)+'組'],['ユニーク数',uq==null?'—':uq+'名'],['客単価',per(x.sales,x.guests)],['組単価',per(x.sales,x.groups)],
    ['経費',yen(fPay+mPay+N(x.cash_out)),1],['人件費-キャスト',yen(fPay),2],['人件費-黒服',yen(mPay),2],['諸経費',yen(x.cash_out),2],
    ['入金',yen(x.cash_in),1]].map(([l,v,k])=>`<tr class="${k===1?'sum':k===2?'sub':k===3?'grp':''}"><td>${l}</td><td>${v}</td></tr>`).join('')}</table></div>`;
  const bdNow=businessDate(), t=D.find(x=>x.date===bdNow)||{}, jd=x=>{ const [y,mo,dd]=x.split('-').map(Number); return `${y}年${mo}月${dd}日`; };
  $('main').innerHTML=head+`<div class="smg">${one('月間',T,N(T.cast_pay)+N(T.cast_adv),hallM,U?U.month:null,okiOf(()=>true))}${m===now?one(`本日 <small>${jd(bdNow)}</small>`,t,castD(t),N(t.hall_adv),U?U.day(bdNow):null,okiOf(k=>k===bdNow)):''}</div>`
    +`<div class="smb" style="margin-bottom:14px"><h2 style="background:var(--head);color:#fff">売上推移</h2><div style="padding:12px;height:420px"><canvas id="smCv"></canvas></div>
      <div class="muted" style="font-size:13px;line-height:1.7;padding:0 14px 12px">・粗利＝売上＋入金−人件費−経費<br>・グラフの人件費は日ごとの分です（キャスト報酬＋日払（立替））。小計バック・罰金・控除・黒服の報酬など月で決まるものは、「月間」の経費だけに入ります</div></div>`;
  wire();
  try{ await ksLoad('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'); }catch(e){ return; }
  if(page!=='summary'||storeId!==st||smMonth!==m||!$('smCv')) return;
  let acc=0; const lab=x=>castD(x)+N(x.hall_adv), cum=D.map(x=>(acc+=N(x.sales)+N(x.cash_in)-lab(x)-N(x.cash_out)));
  const bar=(l,k,c,stack)=>({type:'bar',label:l,data:D.map(k),backgroundColor:c+'55',borderColor:c,borderWidth:1.5,stack,yAxisID:'y',order:2});
  smChart=new Chart($('smCv'),{data:{labels:D.map(x=>Number(x.date.slice(8))+'日'),datasets:[
    bar('売上',x=>N(x.sales),'#4b5320','a'),bar('入金',x=>N(x.cash_in),'#c9b37a','a'),bar('人件費',lab,'#c0392b','b'),bar('経費',x=>N(x.cash_out),'#7a7a7a','b'),
    {type:'line',label:'粗利(累計)',data:cum,borderColor:'#b8973e',backgroundColor:'#b8973e55',pointStyle:'triangle',pointRadius:5,tension:0,yAxisID:'y2',order:1}]},
    options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{tooltip:{callbacks:{label:c=>`${c.dataset.label}：${yen(c.parsed.y)}`}}},
      scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true,ticks:{callback:v=>Number(v).toLocaleString('ja-JP')}},y2:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>Number(v).toLocaleString('ja-JP')}}}}}); };

