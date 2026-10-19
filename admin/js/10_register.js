// ---------- レジ精算（v0.07：月次・日次を1つの画面で切り替える）----------
// POS の閉店作業と同じ計算。管理サイトでは見るだけ（精算の保存は POS で行う）
const DENOMS=[[10000,'1万円札'],[5000,'5千円札'],[2000,'2千円札'],[1000,'千円札'],[500,'500円玉'],[100,'100円玉'],[50,'50円玉'],[10,'10円玉'],[5,'5円玉'],[1,'1円玉']];
const yen=n=>Number(n||0).toLocaleString('ja-JP')+'円';
const sgnYen=n=>(n>0?'+':'')+yen(n);
function businessDate(d=new Date()){ const x=new Date(d.getTime()-8*3600*1000); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
const bdStart=d=>new Date(`${d}T08:00:00+09:00`).toISOString();
const md=x=>`${+x.slice(5,7)}/${+x.slice(8,10)}`;
const WJ=['日','月','火','水','木','金','土'];
let regDate=null, regMonth=null, regTab='day';
const regHead=()=>`<h1>現金管理 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="row" style="margin-bottom:14px"><span class="seg">${[['month','月次'],['day','日次']].map(([v,n])=>`<button data-rt="${v}" class="${regTab===v?'on':''}">${n}</button>`).join('')}</span></div>`;
function regTabs(){ $('main').querySelectorAll('[data-rt]').forEach(b=>b.onclick=()=>{ if(b.dataset.rt==='month'&&regTab==='day'&&regDate) regMonth=regDate.slice(0,7); /* v0.08：日次で見ている日の月を開く */ regTab=b.dataset.rt; PAGES.register(); }); }
PAGES.register=()=>regTab==='month'?regMonthPage():regDayPage();
// 期間（from〈含まない〉〜to〈含まない〉）の日ごとの 現金売上・入金・出金（日払い含む）
// v0.65：1000行で切れないように分けて読む（精算の間が空いた時に「未精算分」が少なく出た）
async function sbAll(mk){ let all=[]; for(let from=0;;from+=1000){ const r=await mk().range(from,from+999); if(r.error) return {data:all.length?all:null,error:r.error}; all=all.concat(r.data||[]); if((r.data||[]).length<1000) return {data:all,error:null}; } }
async function regMoves(fromEx,toEx){
  const [mv,adv,pay]=await Promise.all([
    sbAll(()=>sb.from('cash_movements').select('business_date,kind,amount').eq('store_id',storeId).gt('business_date',fromEx).lt('business_date',toEx).order('id')),
    sbAll(()=>sb.from('daily_advances').select('business_date,amount').eq('store_id',storeId).gt('business_date',fromEx).lt('business_date',toEx).order('id')),
    sbAll(()=>sb.from('payments').select('amount,paid_at,bills!inner(status,store_id)').eq('method','cash').eq('bills.store_id',storeId).gte('paid_at',bdStart(fromEx)).lt('paid_at',bdStart(toEx)).order('id')) ]);
  const er=mv.error||adv.error||pay.error; if(er) return {error:er};
  const sum={}; const add=(dd,k,v)=>{ if(dd<=fromEx||dd>=toEx) return; (sum[dd]=sum[dd]||{sales:0,cin:0,cout:0})[k]+=Number(v)||0; };
  (mv.data||[]).forEach(x=>add(x.business_date,x.kind==='in'?'cin':'cout',x.amount)); (adv.data||[]).filter(x=>x.amount>0).forEach(x=>add(x.business_date,'cout',x.amount));
  (pay.data||[]).filter(p=>p.bills&&p.bills.status!=='void'&&p.amount).forEach(p=>add(businessDate(new Date(p.paid_at)),'sales',p.amount));
  return {sum}; }
const dayAdd=(d,n)=>{ const x=new Date(d+'T00:00:00'); x.setDate(x.getDate()+n); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };

// v0.16・SQL 057：POS の閉店作業と同じように、入出金の登録・削除とレジ金合わせ（精算の保存）ができる。POS と同じ表・同じ操作ログに入る
let regCounts={}, regDeposit=0, regOpening=0;
const regNum=v=>{ const n=parseInt(String(v??'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[^0-9]/g,''),10); return isNaN(n)?0:n; };
async function regDayPage(){
  const today=businessDate(); if(!regDate) regDate=today; if(!regMonth) regMonth=regDate.slice(0,7); const d=regDate; const st=storeId; const ed=perm('register')==='edit';
  $('main').innerHTML=regHead()+`<div class="card muted">読み込み中…</div>`; regTabs();
  const [mv,adv,pay,cls,prev,stf,lat]=await Promise.all([
    sb.from('cash_movements').select('*').eq('store_id',st).eq('business_date',d).order('created_at'),
    sb.from('daily_advances').select('staff_id,amount').eq('store_id',st).eq('business_date',d),
    sb.from('payments').select('amount,bills!inner(status,store_id)').eq('method','cash').eq('bills.store_id',st).gte('paid_at',bdStart(d)).lt('paid_at',bdStart(dayAdd(d,1))),
    sb.from('register_closings').select('*').eq('store_id',st).eq('business_date',d).maybeSingle(),
    sb.from('register_closings').select('business_date,next_float').eq('store_id',st).lt('business_date',d).order('business_date',{ascending:false}).limit(1),
    sb.from('staff').select('id,display_name').eq('store_id',st),
    sb.from('register_closings').select('business_date').eq('store_id',st).gt('business_date',d).limit(1) ]);
  if(page!=='register'||regTab!=='day'||regDate!==d||storeId!==st) return;
  const er=mv.error||adv.error||pay.error||cls.error||prev.error; if(er){ $('main').innerHTML=regHead()+`<div class="card err">${esc(er.message)}</div>`; regTabs(); return; }
  const nm=id=>(stf.data||[]).find(x=>x.id===id)?.display_name||'';
  const moves=mv.data||[]; const inSum=moves.filter(m=>m.kind==='in').reduce((a,m)=>a+m.amount,0), outSum=moves.filter(m=>m.kind==='out').reduce((a,m)=>a+m.amount,0);
  const advRows=(adv.data||[]).filter(a=>a.amount>0); const advSum=advRows.reduce((a,x)=>a+x.amount,0);
  const cashSales=(pay.data||[]).filter(p=>p.bills&&p.bills.status!=='void').reduce((a,p)=>a+(p.amount||0),0);
  const saved=cls.data||null, prevRow=(prev.data||[])[0]||null, future=d>today, later=(lat.data||[]).length>0;
  // 前回の精算から今日までに未精算の日があれば、その日の現金の動きも本日釣銭に含める（POS と同じ）
  let gapNet=0, gapDays=[]; if(!saved&&prevRow){ const g=await regMoves(prevRow.business_date,d); if(page!=='register'||regDate!==d) return; const done=new Set(); const r2=await sb.from('register_closings').select('business_date').eq('store_id',st).gt('business_date',prevRow.business_date).lt('business_date',d); (r2.data||[]).forEach(x=>done.add(x.business_date)); Object.entries(g.sum||{}).forEach(([k,v])=>{ if(done.has(k)) return; const n=v.sales+v.cin-v.cout; if(n){ gapNet+=n; gapDays.push(k); } }); gapDays.sort(); }
  const idle=!saved&&d<today&&!outSum&&!inSum&&!advSum&&!cashSales;
  const canMove=ed&&!saved&&!future, canSave=ed&&!saved&&!future&&!later;
  const cnt=saved?(saved.counts||{}):regCounts;
  $('main').innerHTML=regHead()+`<div id="regWarn"></div>
  <div class="row" style="margin-bottom:14px"><button class="ghost sm" id="regPrev">◀ 前の日</button><input type="date" id="regDateIn" value="${d}" style="width:auto"><button class="ghost sm" id="regNext">次の日 ▶</button>
    <span class="badge ${saved||idle?'k':future?'gray':'warnb'}">${saved?'精算済':idle?'（変動なし自動繰越）':future?'これから':'未精算'}</span>${ed?'':'<span class="muted" style="font-size:13px">閲覧のみ</span>'}</div>
  <div class="card"><h2>入出金</h2>
    ${canMove?`<div class="row" style="margin-bottom:10px"><select id="rgKind" style="width:auto"><option value="out">出金</option><option value="in">入金</option></select><input id="rgAmt" inputmode="numeric" placeholder="金額" style="width:130px;text-align:right"><select id="rgMemoSel" style="width:auto"><option value="領収書精算">領収書精算</option><option value="支払い">支払い</option><option value="__other">その他</option></select><input id="rgMemo" placeholder="内容を入力" style="flex:1;min-width:160px;display:none"><button class="ok" id="rgAdd">追加</button></div>`:saved&&ed?'<div class="muted" style="margin-bottom:6px;font-size:14px">精算済のため変更できません</div>':''}
    <table class="t">${moves.map(m=>`<tr><td style="width:60px"><span class="badge ${m.kind==='out'?'gray':''}">${m.kind==='out'?'出金':'入金'}</span></td><td style="width:100%">${esc(m.memo||'')}</td><td class="num">${yen(m.amount)}</td>${canMove?`<td><button class="ghost sm" data-mvdel="${m.id}">削除</button></td>`:''}</tr>`).join('')}
    <tr><td><span class="badge gray">出金</span></td><td style="width:100%">日払（立替）合計 <small class="muted">${advRows.length?esc(advRows.map(a=>nm(a.staff_id)+' '+a.amount.toLocaleString()).join('、')):'なし'}（POS の在籍リストで入力）</small></td><td class="num">${yen(advSum)}</td>${canMove?'<td></td>':''}</tr></table></div>
  <div class="card"><h2>レジ金合わせ</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;align-items:start">
    <table class="t rgden"><tr><th>金種</th><th class="num">枚数</th><th class="num">金額</th></tr>${DENOMS.map(([v,n])=>{ const c=regNum(cnt[v]); return `<tr><td>${n}</td><td class="num">${canSave?`<input data-den="${v}" inputmode="numeric" value="${cnt[v]||''}" style="width:90px;text-align:right">`:(c?c.toLocaleString():'')}</td><td class="num" data-denamt="${v}"></td></tr>`; }).join('')}<tr><td><b>合計金額</b></td><td></td><td class="num"><b id="rgCounted"></b></td></tr></table>
    <div class="kv2">
      <span>本日釣銭${gapDays.length?`<br><small class="muted">${gapDays.map(md).join('・')} の未精算分 ${sgnYen(gapNet)} を含む</small>`:''}</span>${!saved&&!prevRow&&canSave?`<input id="rgOpenIn" inputmode="numeric" value="${regOpening||''}" placeholder="初回のみ入力" style="width:150px;text-align:right">`:`<span class="num" id="rgOpen"></span>`}
      <span>現金売上 <small class="muted">その日に受け取った現金</small></span><span class="num" id="rgSales"></span>
      <span>入金合計</span><span class="num" id="rgIn"></span>
      <span>出金合計 <small class="muted">日払（立替）を含む</small></span><span class="num" id="rgOut"></span>
      <span>レジ内現金（理論値）</span><span class="num" id="rgExp"></span>
      <span>レジ内現金</span><span class="num" id="rgCnt2"></span>
      <b>現金過不足</b><b class="num" id="rgDiff"></b>
      <span>預金金額</span>${canSave?`<input id="rgDepIn" inputmode="numeric" value="${regDeposit||''}" style="width:150px;text-align:right">`:`<span class="num" id="rgDep"></span>`}
      <span>翌日釣銭準備金</span><span class="num" id="rgNext"></span>
    </div></div>
    ${ed&&!saved&&!future?`<div class="row" style="margin-top:12px;justify-content:flex-end">${later?'<span class="muted">後の日の精算があるため保存できません</span>':'<button class="primary" id="rgSave">精算を保存</button>'}</div>`:''}</div>
`; regTabs();
  // 計算は POS の閉店作業と同じ（本日釣銭＋現金売上＋入金−出金＝理論値、レジ内現金−理論値＝過不足、レジ内現金−預金＝翌日釣銭準備金）
  const calc=()=>{ let counted=0; DENOMS.forEach(([v])=>{ const a=v*regNum(cnt[v]); counted+=a; const e=$('main').querySelector(`[data-denamt="${v}"]`); if(e) e.textContent=a?yen(a):''; });
    if(saved) counted=saved.counted;
    const opening=saved?saved.opening_float:(prevRow?Number(prevRow.next_float)+gapNet:(canSave?regOpening:null));
    const sales=saved?saved.cash_sales:cashSales, cin=saved?saved.cash_in:inSum, cout=saved?saved.cash_out:outSum+advSum;
    const expected=opening==null?null:opening+sales+cin-cout;
    const showCnt=saved||canSave||idle; const cv=saved?counted:canSave?counted:idle?expected:null;
    const diff=saved?saved.diff:canSave&&expected!=null?counted-expected:idle?0:null;
    const deposit=saved?saved.deposit:canSave?regDeposit:idle?0:null, next=saved?(saved.next_float??saved.counted-saved.deposit):canSave?counted-regDeposit:idle?expected:null;
    const V=v=>v==null?'—':yen(v); const T=(id,t)=>{ const e=$(id); if(e) e.textContent=t; };
    T('rgCounted',showCnt&&cv!=null?yen(cv):'—'); T('rgOpen',opening==null?'初回は POS で入力':yen(opening)); T('rgSales',yen(sales)); T('rgIn',yen(cin)); T('rgOut',yen(cout)); T('rgExp',V(expected)); T('rgCnt2',V(cv));
    T('rgDiff',diff==null?'—':sgnYen(diff)); const de=$('rgDiff'); if(de) de.style.color=diff?'var(--warn)':''; T('rgDep',V(deposit)); T('rgNext',V(next));
    return {opening,sales,cin,cout,expected,counted,diff,deposit,next}; };
  calc();
  const goD=x=>{ regDate=x; regCounts={}; regDeposit=0; PAGES.register(); };
  $('regDateIn').onchange=e=>{ if(e.target.value) goD(e.target.value); };
  $('regPrev').onclick=()=>goD(dayAdd(d,-1)); $('regNext').onclick=()=>goD(dayAdd(d,1));
  $('main').querySelectorAll('[data-den]').forEach(i=>i.oninput=()=>{ regCounts[i.dataset.den]=regNum(i.value); calc(); });
  if($('rgDepIn')) $('rgDepIn').oninput=e=>{ regDeposit=regNum(e.target.value); calc(); };
  if($('rgOpenIn')) $('rgOpenIn').oninput=e=>{ regOpening=regNum(e.target.value); calc(); };
  if($('rgKind')){ const mvu=()=>{ const out=$('rgKind').value==='out'; $('rgMemoSel').style.display=out?'':'none'; $('rgMemo').style.display=(!out||$('rgMemoSel').value==='__other')?'':'none'; $('rgMemo').placeholder=out?'内容を入力':'内容（例：両替、釣銭補充）'; }; $('rgKind').onchange=mvu; $('rgMemoSel').onchange=()=>{ mvu(); if($('rgMemoSel').value==='__other') $('rgMemo').focus(); }; mvu();
    const ad=$('rgAdd'); ad.onclick=guard(ad,async()=>{ const amount=regNum($('rgAmt').value), kind=$('rgKind').value, memo=(kind==='out'&&$('rgMemoSel').value!=='__other')?$('rgMemoSel').value:$('rgMemo').value.trim();
      if(!amount){ await uiAlert('金額を入力してください'); return; } if(!memo){ await uiAlert('内容を入力してください'); return; }
      const r=await rpc('admin_add_cash_move',{p_store:st,p_date:d,p_kind:kind,p_amount:amount,p_memo:memo}); if(!r.ok) return; toast(kind==='out'?'出金を登録しました':'入金を登録しました'); PAGES.register(); }); }
  $('main').querySelectorAll('[data-mvdel]').forEach(x=>x.onclick=guard(x,async()=>{ const m=moves.find(z=>z.id===x.dataset.mvdel); if(!m||!await uiConfirm(`${m.kind==='out'?'出金':'入金'} ${yen(m.amount)}（${m.memo||''}）を削除しますか？`,'削除','danger')) return;
    const r=await rpc('admin_del_cash_move',{p_id:m.id}); if(!r.ok) return; toast('削除しました'); PAGES.register(); }));
  if($('rgSave')){ const sv=$('rgSave'); sv.onclick=guard(sv,async()=>{ const v=calc(); if(v.opening==null){ await uiAlert('本日釣銭を入力してください'); return; }
    if(v.deposit>v.counted){ await uiAlert('預金金額がレジ内現金より多くなっています'); return; }
    if(!await uiConfirm(`${d} のレジ精算を保存しますか？\nレジ内現金 ${yen(v.counted)}／過不足 ${sgnYen(v.diff)}\n保存すると、この日の入出金は変更できなくなります（POS も同じ）`)) return;
    const counts={}; DENOMS.forEach(([dv])=>{ const c=regNum(regCounts[dv]); if(c) counts[dv]=c; });
    const r=await rpc('admin_save_register_closing',{p_store:st,p_date:d,p_counts:counts,p_opening:v.opening,p_sales:v.sales,p_in:v.cin,p_out:v.cout,p_expected:v.expected,p_counted:v.counted,p_diff:v.diff,p_deposit:v.deposit,p_next:v.next});
    if(!r.ok) return; regCounts={}; regDeposit=0; toast('精算を保存しました'); PAGES.register(); }); }
  // 前回の精算の翌日〜前日で、動きがあったのに精算していない日（直近31日）
  const lo=dayAdd(d,-32), from=prevRow&&prevRow.business_date>lo?prevRow.business_date:lo;
  const [g,cl]=await Promise.all([regMoves(from,d), sb.from('register_closings').select('business_date').eq('store_id',st).gt('business_date',from).lt('business_date',d)]);
  if(page!=='register'||regTab!=='day'||regDate!==d||!$('regWarn')) return; const done=new Set((cl.data||[]).map(r=>r.business_date));
  const miss=Object.keys(g.sum||{}).filter(k=>!done.has(k)).sort(); if(!miss.length) return;
  $('regWarn').innerHTML=`<div class="alert">${miss.map(x=>`<a href="#" data-rw="${x}" style="color:inherit">${md(x)}</a>`).join('・')} が未精算です</div>`;
  $('regWarn').querySelectorAll('[data-rw]').forEach(a=>a.onclick=e=>{ e.preventDefault(); goD(a.dataset.rw); });
}

async function regMonthPage(){
  const today=businessDate(); if(!regMonth) regMonth=today.slice(0,7); const mo=regMonth, st=storeId;
  const [y,m]=mo.split('-').map(Number); const last=new Date(y,m,0).getDate(); const d1=`${mo}-01`, dN=`${mo}-${String(last).padStart(2,'0')}`;
  $('main').innerHTML=regHead()+`<div class="row" style="margin-bottom:14px"><button class="ghost sm" id="rmPrev">◀ 前の月</button><input type="month" id="rmIn" value="${mo}" style="width:auto"><button class="ghost sm" id="rmNext">次の月 ▶</button></div><div class="card" id="rmBox"><div class="muted">読み込み中…</div></div>`; regTabs();
  const goM=x=>{ regMonth=x; PAGES.register(); };
  const shiftM=n=>{ const t=new Date(y,m-1+n,1); goM(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`); };
  $('rmIn').onchange=e=>{ if(e.target.value) goM(e.target.value); }; $('rmPrev').onclick=()=>shiftM(-1); $('rmNext').onclick=()=>shiftM(1);
  const [r,pv,g]=await Promise.all([ sb.from('register_closings').select('*').eq('store_id',st).gte('business_date',d1).lte('business_date',dN),
    sb.from('register_closings').select('next_float').eq('store_id',st).lt('business_date',d1).order('business_date',{ascending:false}).limit(1),
    regMoves(dayAdd(d1,-1),dayAdd(dN,1)) ]);
  if(page!=='register'||regTab!=='month'||regMonth!==mo||storeId!==st) return;
  const er=r.error||pv.error||g.error; if(er){ $('rmBox').innerHTML=`<div class="err">${esc(er.message)}</div>`; return; }
  const byD={}; (r.data||[]).forEach(x=>byD[x.business_date]=x); const sum=g.sum||{};
  let carry=Number((pv.data||[])[0]?.next_float)||0; const rows=[]; const C=v=>`<td>${v}</td>`; const CS=v=>`<td style="text-align:left;font-size:12px;line-height:1.3">${v}</td>`;
  const tot={sales:0,cin:0,cout:0,diff:0,deposit:0};
  for(let i=1;i<=last;i++){ const dd=`${mo}-${String(i).padStart(2,'0')}`; const dl=`${dd.slice(5).replace('-','/')}（${WJ[new Date(dd+'T00:00:00').getDay()]}）`; const x=byD[dd];
    if(x){ rows.push(`<tr data-rd="${dd}">${C(dl)}${C(yen(x.opening_float))}${C(yen(x.cash_sales))}${C(yen(x.cash_in))}${C(yen(x.cash_out))}${C(yen(x.expected))}${C(yen(x.counted))}<td style="${x.diff?'color:var(--warn)':''}">${sgnYen(x.diff)}</td>${C(yen(x.deposit))}${CS('精算済')}</tr>`);
      tot.sales+=x.cash_sales; tot.cin+=x.cash_in; tot.cout+=x.cash_out; tot.diff+=x.diff; tot.deposit+=x.deposit; carry=Number(x.next_float??(x.counted-x.deposit))||0; continue; }
    if(dd>today){ rows.push(`<tr style="color:var(--muted)">${C(dl)}${C('').repeat(9)}</tr>`); continue; }
    const t=sum[dd]||{sales:0,cin:0,cout:0}; const exp=carry+t.sales+t.cin-t.cout; const idle=!t.sales&&!t.cin&&!t.cout; tot.sales+=t.sales; tot.cin+=t.cin; tot.cout+=t.cout;
    rows.push(`<tr data-rd="${dd}" style="color:var(--muted)">${C(dl)}${C(yen(carry))}${C(yen(t.sales))}${C(yen(t.cin))}${C(yen(t.cout))}${C(yen(exp))}${idle?C(yen(exp))+C(yen(0))+C(yen(0))+CS(dd<today?'（変動なし自動繰越）':''):C('')+C('')+C('')+CS('<span style="color:var(--warn)">未精算</span>')}</tr>`); carry=exp; }
  $('rmBox').innerHTML=`<div style="overflow-x:auto"><table class="reg"><tr>${['日付','本日釣銭','現金売上','入金合計','出金合計','理論値','レジ内現金','過不足','預金','状態'].map(h=>`<th${h==='状態'?' style="text-align:left"':''}>${h}</th>`).join('')}</tr>${rows.join('')}
    <tr style="font-weight:700"><td>合計</td><td></td><td>${yen(tot.sales)}</td><td>${yen(tot.cin)}</td><td>${yen(tot.cout)}</td><td></td><td></td><td style="${tot.diff?'color:var(--warn)':''}">${sgnYen(tot.diff)}</td><td>${yen(tot.deposit)}</td><td></td></tr></table></div>
    <div class="muted" style="font-size:13px;margin-top:8px">行を押すと、その日の日次を開きます</div>`;
  $('rmBox').querySelectorAll('[data-rd]').forEach(t=>t.onclick=()=>{ regDate=t.dataset.rd; regTab='day'; PAGES.register(); });
}

