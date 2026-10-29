// ---------- 伝票の修正 v0.31・SQL 071：収支（日次）の伝票一覧から、会計済の伝票をオーナーが直す（いつの日でも）----------
// 直せるもの：削除／係・同伴・反応◎／注文（数量・取消・追加・バックの人）／支払い（方法・金額）／人数・来店と退店の時刻（自動延長も付け直す）・値引と値増
// 画面の中で直してから［保存］でまとめて送る。保存の前に直した後の請求額を確かめる（SQL で計算して元に戻す）。削除以外は操作ログに「何を直したか」を残す
const BE_M={cash:'現金',card:'カード',invoice:'請求書',oki:'置き'}, BE_ROLE={douhan:'同伴',douhan1:'同伴①',douhan2:'同伴②'};
const beDh=r=>r==='douhan'||r==='douhan1'||r==='douhan2';
const beUid=()=>crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
// v0.93：来店の時刻は5分切り上げで出す（POS v11.45 と同じ。09:17→09:20）。退店は実際の時刻
const ceil5=t=>{ const d=new Date(t); d.setSeconds(0,0); d.setMinutes(d.getMinutes()+(5-d.getMinutes()%5)%5); return d; };
const beHm5=t=>t?beHm(ceil5(t)):'';
const beHm=t=>t?new Date(t).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}):'';
function beRole(ts){ const x=new Date(new Date(ts||Date.now()).toLocaleString('en-US',{timeZone:'Asia/Tokyo'})), m=x.getHours()*60+x.getMinutes(); if(m<8*60) return 'douhan'; if(m<=20*60+30) return 'douhan1'; if(m<=21*60) return 'douhan2'; return 'douhan'; } // POS と同じ決め方
// v0.38：伝票の No を押すと、その伝票の中身を全部見る（見るだけ。オーナーは「直す」へ）
async function billView(id,canEdit){ // v0.49・SQL 078：見るだけの人も admin_bill_view で見られる（前は admin_bill_get＝オーナーだけ）
  let r=await sb.rpc('admin_bill_view',{p_bill:id}); if(r.error&&/admin_bill_view/.test(r.error.message)) r=await sb.rpc('admin_bill_get',{p_bill:id});
  if(r.error){ await uiAlert(r.error.message); return; }
  const O=r.data||{}, B=O.bill||{}, C=O.calc||{}, ST=O.staff||[], sn=sid=>ST.find(x=>x.id===sid)?.name||'（不明）', pn=pid=>(O.products||[]).find(p=>p.id===pid)?.name||'';
  const N=v=>Number(v||0), items=(O.items||[]).filter(i=>!i.is_void), voids=(O.items||[]).filter(i=>i.is_void), exts=O.exts||[], adjs=O.adjs||[], pays=O.pays||[];
  const dur=(a,b)=>{ if(!a||!b) return ''; const m=Math.max(0,Math.round((new Date(b)-new Date(a))/60000)); return `${Math.floor(m/60)}時間${String(m%60).padStart(2,'0')}分`; };
  const ks=(O.casts||[]).filter(c=>c.is_kakari).map(c=>sn(c.staff_id)), ds=(O.casts||[]).filter(c=>beDh(c.role)).map(c=>sn(c.staff_id)), gd=(O.goods||[]).map(g=>sn(g.staff_id));
  // POS の会計済の伝票（明細書）と同じ形
  const L=(l,v,c)=>`<div class="bv-ln ${c||''}"><span>${l}</span><span style="white-space:nowrap">${v}</span></div>`, extMin=exts.reduce((t,e)=>t+N(e.minutes),0);
  const its=items.map(i=>{ const bk=(i.splits||[]).filter(z=>N(z.back_amount)||N(z.back_points)).map(z=>sn(z.staff_id)); return L(`${esc(i.name||pn(i.product_id))} <small>× ${i.qty}</small>${bk.length?` <small>（バック：${esc(bk.join('・'))}）</small>`:''}`,yen(N(i.unit_price)*N(i.qty))); }).join('');
  const box=modal(`<style>.bv-ln{display:flex;justify-content:space-between;gap:12px;padding:6px 2px;font-size:16px}.bv-ln small{color:var(--muted);font-size:13px}.bv-ln.sm,.bv-sm{font-size:14px;color:var(--muted)}.bv hr{border:0;border-top:1px solid var(--line);margin:8px 0}</style>
    <div class="bv"><div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><b style="font-size:22px">${esc(B.table||'')}</b><span>${md(B.business_date)}　${beHm5(B.opened_at)}〜${B.closed_at?beHm(B.closed_at):''}${B.closed_at?`（${dur(B.opened_at,B.closed_at)}）`:''}　${N(B.guest_count)}名</span>${B.closed_at?'':'<span class="badge" style="margin-left:auto">来店中</span>'}</div>
    <div class="bv-sm" style="margin-top:6px">お客様：${B.customers?esc(String(B.customers).split('・').map(n=>n+' 様').join('・')):'未登録'}　　${KL}：${ks.length?esc(ks.join('・')):'なし'}${ds.length?'　　同伴：'+esc(ds.join('・')):''}　　反応<span style="color:var(--gold)">◎</span>：${gd.length?esc(gd.join('・')):'なし'}</div><hr>
    ${N(C.set)?L(`セット${C.set_guests!=null?` <small>× ${C.set_guests}</small>`:''}`,yen(C.set)):''}${N(C.vip_set)?L('VIPルーム料金',yen(C.vip_set)):''}${N(C.extension)?L(`延長 <small>${exts.length}回・計${extMin}分</small>`,yen(C.extension)):''}${N(C.vip_ext)?L('VIPルーム延長',yen(C.vip_ext)):''}${its||'<div class="bv-sm">注文はありません</div>'}
    ${voids.length?`<div class="bv-sm" style="margin-top:4px">取消：${voids.map(i=>esc(i.name||pn(i.product_id))+' × '+i.qty).join('、')}</div>`:''}<hr>
    ${C.subtotal!=null?L('小計',yen(C.subtotal),'sm'):''}${C.service!=null?L('サービス料'+(C.service_rate!=null?' '+C.service_rate+'%':''),yen(C.service),'sm'):''}${C.tax!=null?L('消費税',yen(C.tax),'sm'):''}${adjs.map(a=>L((a.kind==='discount'?'値引':'値増')+(a.reason?` <small>${esc(a.reason)}</small>`:''),(a.kind==='discount'?'−':'')+yen(a.amount),'sm')).join('')}
    <div class="bv-ln" style="font-size:24px;font-weight:800;padding-top:10px"><span>請求額</span><span>${yen(C.amount_due)}</span></div><hr>
    <div class="bv-ln"><span>お支払い</span><span style="white-space:normal;text-align:right">${pays.filter(p=>N(p.amount)>0).map(p=>`${BE_M[p.method]||esc(p.method)} ${yen(p.amount)}${p.method==='invoice'?`<small>（${p.invoice_paid_on?mdj(p.invoice_paid_on)+'入金':'未入金'}）</small>`:''}`).join('／')||'入金の記録はありません'}</span></div></div>
    <div class="bar">${canEdit?'<button class="ghost" data-k="ed">修正</button>':''}<button class="primary" data-k="ok">閉じる</button></div>`);
  box.querySelector('.box').style.width='min(640px,100%)';
  box.querySelector('[data-k=ok]').onclick=()=>box.remove();
  const e=box.querySelector('[data-k=ed]'); if(e) e.onclick=()=>{ box.remove(); billEdit(id); }; }
async function billEdit(id){
  const r=await sb.rpc('admin_bill_get',{p_bill:id}); if(r.error){ await uiAlert(/admin_bill_get/.test(r.error.message)?'SQL 071 が未実行です：'+r.error.message:r.error.message); return; }
  const O=r.data, S=JSON.parse(JSON.stringify(O)), st=O.settings||{}, B=S.bill, att=new Set(O.attended||[]), bd=O.bill.business_date;
  const ST=O.staff||[], sn=sid=>ST.find(x=>x.id===sid)?.name||'（不明）', pn=pid=>(O.products||[]).find(p=>p.id===pid);
  const live=it=>!it.is_void, hcId=st.auto_hc_product_id, bcId=st.auto_bc_product_id;
  // バックは等分（端数は最初の人）。POS と同じ
  const split=(it,ids)=>{ const m=ids.length, bk=Number(it.back_amount||0)*it.qty, pt=Number(it.back_points||0)*it.qty; if(!m||(!bk&&!pt)) return [];
    const eb=Math.floor(bk/m), ep=Math.floor(pt/m*10)/10; return ids.map((sid,j)=>({id:(it.splits||[]).find(z=>z.staff_id===sid)?.id||beUid(),staff_id:sid,sales_amount:0,back_amount:eb+(j===0?bk-eb*m:0),back_points:j===0?Math.round((pt-ep*(m-1))*10)/10:ep})); };
  const kks=()=>[...new Set(S.casts.filter(c=>c.is_kakari&&!ST.find(x=>x.id===c.staff_id)?.kakari_only).map(c=>c.staff_id))];
  const syncHc=()=>S.items.filter(i=>live(i)&&hcId&&i.product_id===hcId).forEach(i=>{ i.splits=split(i,kks()); });
  const resplit=it=>{ if(hcId&&it.product_id===hcId) syncHc(); else it.splits=split(it,(it.splits||[]).map(z=>z.staff_id)); };
  // 自動延長：POS の自動延長と同じ考え方で、退店の時刻までに足りる回数にそろえる（手で入れた延長はそのまま）
  const reExt=()=>{ if(O.mode&&O.mode.include_set===false) return; const em=Number(st.ext_minutes||0); if(em<=0||!B.set_start||!B.closed_at) return;
    const man=S.exts.filter(e=>!e.is_auto), au=S.exts.filter(e=>e.is_auto), base=Number(B.set_minutes||0)+man.reduce((a,e)=>a+Number(e.minutes||0),0)+Number(B.ext_waived_minutes||0);
    const used=(new Date(B.closed_at)-new Date(B.set_start))/60000, n=Math.max(0,Math.ceil((used-base)/em-1e-9));
    while(au.length>n) au.pop(); while(au.length<n) au.push({id:beUid(),minutes:em,unit_price:Number(st.ext_unit_price||0),qty:B.guest_count,is_auto:true}); S.exts=[...man,...au]; };
  const toTs=t=>{ const day=t<'08:00'?dayAdd(bd,1):bd; return new Date(`${day}T${t}:00+09:00`).toISOString(); };
  // 変えた所（画面の内容と最初の内容の差）を、送る内容と操作ログの文に
  function diff(){ const ops=[], note=[];
    const bc={}; ['guest_count','set_guest_count','opened_at','set_start','closed_at'].forEach(k=>{ const a=B[k], b=O.bill[k], tm=k.endsWith('_at')||k==='set_start';
      if(tm?(a&&b?new Date(a).getTime()!==new Date(b).getTime():(a||null)!==(b||null)):String(a??'')!==String(b??'')) bc[k]=a??null; });
    if(Object.keys(bc).length) ops.push({t:'bills',op:'update',set:bc});
    if('guest_count' in bc) note.push(`客数 ${O.bill.guest_count}→${B.guest_count}名`); if('opened_at' in bc) note.push(`来店 ${beHm(O.bill.opened_at)}→${beHm(B.opened_at)}`); if('closed_at' in bc) note.push(`退店 ${beHm(O.bill.closed_at)}→${beHm(B.closed_at)}`);
    const rows=(t,o,s,cols,lab,extra)=>{ const om=new Map(o.map(x=>[x.id,x])), sm=new Set(s.map(x=>x.id));
      s.forEach(x=>{ const y=om.get(x.id), set={}; cols.forEach(c=>{ if(!y||String(x[c]??'')!==String(y[c]??'')) set[c]=x[c]??null; }); if(!y){ ops.push({t,op:'insert',...(extra?extra(x):{}),set}); note.push(lab(x,null)); } else if(Object.keys(set).length){ ops.push({t,op:'update',id:x.id,set}); note.push(lab(x,y)); } });
      o.forEach(y=>{ if(!sm.has(y.id)){ ops.push({t,op:'delete',id:y.id}); note.push(lab(null,y)); } }); };
    const cl=(x,y)=>{ const z=x||y, k=c=>[c.is_kakari?''+KL+'':'',BE_ROLE[c.role]||''].filter(Boolean).join('・'); return !y?`${k(x)}を追加 ${sn(x.staff_id)}`:!x?`${k(y)}を外す ${sn(y.staff_id)}`:`${sn(z.staff_id)} ${k(y)||'—'}→${k(x)||'—'}`; };
    const oSp=O.items.flatMap(i=>i.splits.map(z=>({...z,_i:i.id}))), sSp=S.items.flatMap(i=>(i.splits||[]).map(z=>({...z,_i:i.id})));
    // 先にバックの行を消す → 伝票・係・反応◎・注文 → バックの行を足す → 延長・値引・支払い
    const spOps=[]; { const keep=ops.length; rows('bill_item_splits',oSp,sSp,['staff_id','sales_amount','back_amount','back_points'],()=>'',x=>({item:x._i})); spOps.push(...ops.splice(keep)); }
    ops.push(...spOps.filter(o=>o.op==='delete'));
    rows('bill_casts',O.casts,S.casts,['staff_id','role','is_kakari'],cl);
    rows('good_reactions',O.goods,S.goods,['staff_id'],(x,y)=>x?`反応◎ ${sn(x.staff_id)}`:`反応◎を取消 ${sn(y.staff_id)}`);
    rows('bill_items',O.items,S.items,['product_id','category_id','name','qty','unit_price','cast_subtotal_price','back_amount','back_points','is_service_target','is_void'],
      (x,y)=>!y?`注文を追加 ${x.name}×${x.qty}`:x.is_void&&!y.is_void?`注文を取消 ${x.name}×${y.qty}`:`数量 ${x.name} ${y.qty}→${x.qty}`,x=>({id:x.id}));
    ops.push(...spOps.filter(o=>o.op!=='delete'));
    const bk=items=>Object.fromEntries(items.map(i=>[i.id,(i.splits||[]).map(z=>sn(z.staff_id)).join('・')]));
    { const a=bk(O.items), b=bk(S.items); S.items.forEach(i=>{ if(a[i.id]!==undefined&&a[i.id]!==b[i.id]&&!i.is_void) note.push(`バック ${i.name} ${a[i.id]||'なし'}→${b[i.id]||'なし'}`); }); }
    const oe=O.exts.length, se=S.exts.length; rows('bill_extensions',O.exts,S.exts,['minutes','unit_price','qty','is_auto'],()=>''); if(oe!==se) note.push(`延長 ${oe}→${se}回`);
    rows('bill_adjustments',O.adjs,S.adjs,['kind','amount','reason'],(x,y)=>x?`${x.kind==='discount'?'値引':'値増'} ${yen(x.amount)}`:`${y.kind==='discount'?'値引':'値増'}を取消 ${yen(y.amount)}`);
    rows('payments',O.pays,S.pays,['method','amount','paid_at','revenue_date','received_at'],(x,y)=>!y?`支払いを追加 ${BE_M[x.method]} ${yen(x.amount)}`:!x?`支払いを取消 ${BE_M[y.method]} ${yen(y.amount)}`:`支払い ${BE_M[y.method]} ${yen(y.amount)}→${BE_M[x.method]} ${yen(x.amount)}`);
    return {ops,note:note.filter(Boolean)}; }
  const box=modal('<div class="muted">読み込み中…</div>'); box.querySelector('.box').style.width='min(760px,100%)'; let calcSeq=0, last=null;
  const close=()=>{ box.remove(); }, sel=(k,ph,list)=>`<select data-badd="${k}" style="width:auto"><option value="">${ph}</option>${list.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>`;
  async function check(){ const my=++calcSeq, {ops}=diff(), el=box.querySelector('#beSum'); if(!el) return; if(!ops.length){ last={due:O.calc.amount_due,paid:O.calc.paid}; }
    else{ el.innerHTML='<span class="muted">計算中…</span>'; const z=await sb.rpc('admin_bill_edit',{p_bill:id,p_ops:ops,p_note:[],p_reason:'',p_dry:true}); if(my!==calcSeq) return; if(z.error){ last=null; el.innerHTML=`<span style="color:var(--warn)">${esc(z.error.message)}</span>`; return; } last=z.data; }
    const pd=S.pays.reduce((a,p)=>a+Number(p.amount||0),0), df=pd-Number(last.due);
    el.innerHTML=`請求額 <b>${yen(last.due)}</b>${ops.length&&Number(last.due)!==Number(O.calc.amount_due)?` <small class="muted">（修正前 ${yen(O.calc.amount_due)}）</small>`:''}　支払い 計 <b>${yen(pd)}</b>　${df?`<b style="color:var(--warn)">${df>0?'多い':'足りない'} ${yen(Math.abs(df))}</b>`:'<span class="badge k">合っています</span>'}`; }
  function draw(){ const it=S.items.filter(live), ex=S.exts.length, prods=(O.products||[]).filter(p=>p.is_visible!==false||S.items.some(i=>i.product_id===p.id));
    const act=ST.filter(s=>s.is_active&&(s.kind==='cast'||s.kakari_only)), cs=S.casts;
    box.querySelector('.box').innerHTML=`<h2 style="margin:0">伝票の修正　<small class="muted" style="font-weight:400">${md(bd)} 卓${esc(B.table||'')}${B.customers?'　'+esc(B.customers):''}</small></h2>
    <div class="card" style="margin:0"><h2>人数・時刻</h2><div class="row" style="flex-wrap:wrap;gap:10px"><label style="flex:1 1 120px">客数<input type="number" inputmode="numeric" id="beG" min="1" value="${B.guest_count}"></label><label style="flex:1 1 140px">来店<input type="time" id="beIn" value="${beHm5(B.opened_at)}"></label><label style="flex:1 1 140px">退店<input type="time" id="beOut" value="${beHm(B.closed_at)}"></label></div>
      <div class="muted" style="font-size:13px;margin-top:6px">延長 ${ex}回${S.exts.some(e=>e.is_auto)||Number(st.ext_minutes||0)>0?'（時刻を変更すると、自動延長を付け直します）':''}</div></div>
    <div class="card" style="margin:0"><h2>${KL}・同伴・反応◎</h2>${cs.filter(c=>c.is_kakari||beDh(c.role)).map(c=>`<div class="row" style="justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line)"><span>${esc(sn(c.staff_id))} <small class="muted">${[c.is_kakari?''+KL+'':'',BE_ROLE[c.role]||''].filter(Boolean).join('・')}</small></span><button class="ghost sm" data-bcrm="${c.id}">×</button></div>`).join('')||'<div class="muted">なし</div>'}
      <div class="row" style="margin:8px 0;flex-wrap:wrap">${sel('k','＋'+KL+'',act.filter(s=>!cs.some(c=>c.staff_id===s.id&&c.is_kakari)))}${sel('d','＋同伴',act.filter(s=>!s.kakari_only&&att.has(s.id)&&!cs.some(c=>c.staff_id===s.id&&beDh(c.role))))}</div>
      <div class="row" style="flex-wrap:wrap;gap:6px">${S.goods.map(g=>`<span class="badge gray" style="background:#fff;color:var(--ink);border:1px solid var(--line);font-size:14px">${esc(sn(g.staff_id))}<span style="color:var(--gold)">◎</span> <a data-bgrm="${g.id}" style="cursor:pointer;color:var(--muted)">×</a></span>`).join('')}${sel('g','＋反応◎',ST.filter(s=>s.is_active&&s.kind==='cast'&&!s.kakari_only&&att.has(s.id)&&!S.goods.some(g=>g.staff_id===s.id)))}</div></div>
    <div class="card" style="margin:0"><h2>注文</h2><table class="t">${it.map(i=>{ const hasB=Number(i.back_amount||0)>0||Number(i.back_points||0)>0, auto=hcId&&i.product_id===hcId;
        return `<tr><td>${esc(i.name||pn(i.product_id)?.name||'')}<br><small class="muted">${yen(i.unit_price)}${hasB?`　バック：${esc((i.splits||[]).map(z=>sn(z.staff_id)).join('・')||'なし')}${auto?'（'+KL+'で等分）':''}`:''}</small></td><td style="width:90px"><input type="number" inputmode="numeric" min="1" data-bq="${i.id}" value="${i.qty}" style="text-align:right"></td><td style="white-space:nowrap">${hasB&&!auto?`<button class="ghost sm" data-bbk="${i.id}">バック</button> `:''}<button class="ghost sm" data-bvd="${i.id}">取消</button></td></tr>`; }).join('')||'<tr><td class="muted">注文はありません</td></tr>'}</table>
      <div class="row" style="margin-top:8px"><select id="beP" style="flex:1"><option value="">メニューを選ぶ</option>${prods.map(p=>`<option value="${p.id}">${esc(p.name)}　${yen(p.price)}</option>`).join('')}</select><input type="number" inputmode="numeric" id="beQ" value="1" min="1" style="width:80px;text-align:right"><button class="ok" id="bePAdd">追加</button></div></div>
    <div class="card" style="margin:0"><h2>値引・値増</h2>${S.adjs.map(a=>`<div class="row" style="justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line)"><span>${a.kind==='discount'?'値引':'値増'} ${yen(a.amount)}</span><button class="ghost sm" data-barm="${a.id}">×</button></div>`).join('')||'<div class="muted">なし</div>'}
      <div class="be3"><select id="beAK"><option value="discount">値引</option><option value="surcharge">値増</option></select><input type="number" inputmode="numeric" id="beAA" placeholder="金額"><button class="ok" id="beAAdd">追加</button></div></div>
    <div class="card" style="margin:0"><h2>支払い</h2>${S.pays.map(p=>{ const lock=!!p.invoice_paid_on||p.method==='oki'; /* v0.91：種類・金額・ボタンの3列を、どの行も同じ幅にそろえる（オーナー 2026-10-15） */
        return lock?`<div class="be3 ln"><span>${BE_M[p.method]||esc(p.method)}</span><span class="r">${yen(p.amount)}</span><span></span><small class="muted">${p.invoice_paid_on?'入金済（「請求書の未入金」で戻すと修正できます）':'置きは POS で'}</small></div>`
          :`<div class="be3 ln"><select data-bpm="${p.id}">${['cash','card','invoice'].map(m=>`<option value="${m}" ${p.method===m?'selected':''}>${BE_M[m]}</option>`).join('')}</select><input type="number" inputmode="numeric" data-bpa="${p.id}" value="${p.amount}"><button class="ghost" data-bprm="${p.id}" aria-label="支払いを取消">×</button></div>`; }).join('')||'<div class="muted">支払いはありません</div>'}
      <div class="be3"><select id="bePM">${['cash','card','invoice'].map(m=>`<option value="${m}">${BE_M[m]}</option>`).join('')}</select><input type="number" inputmode="numeric" id="bePA" placeholder="金額"><button class="ok" id="bePayAdd">追加</button></div></div>
    <div id="beSum" style="font-size:15px"></div>
    <label>理由（任意・操作ログに残ります）<input id="beR" maxlength="100" value="${esc(S._reason||'')}"></label>
    <div class="bar" style="justify-content:space-between"><button class="ghost" id="beDel">伝票を削除</button><span class="row"><button class="ghost" id="beNo">閉じる</button><button class="primary" id="beOk">保存</button></span></div>`;
    const q=s=>box.querySelector(s), qa=s=>box.querySelectorAll(s), redo=()=>{ S._reason=q('#beR').value; draw(); };
    q('#beR').oninput=e=>{ S._reason=e.target.value; };
    q('#beG').onchange=e=>{ const n=parseInt(e.target.value,10); if(!(n>=1)){ e.target.value=B.guest_count; return; } const old=B.guest_count; if(n===old) return;
      if(B.set_guest_count!=null){ if(n>old) B.set_guest_count+=n-old; } else S.items.filter(i=>live(i)&&(i.product_id===hcId||i.product_id===bcId)&&i.product_id).forEach(i=>{ i.qty=n; resplit(i); }); // POS と同じ：途中で帰った人がいなければ、自動の HC・BC の数も客数に
      B.guest_count=n; redo(); };
    const tm=(k,v)=>{ if(!v) return; const ts=toTs(v); if(k==='opened_at'&&B.set_start){ B.set_start=new Date(new Date(B.set_start).getTime()+(ceil5(ts)-ceil5(B.opened_at))).toISOString(); } B[k]=ts; reExt(); redo(); };
    q('#beIn').onchange=e=>tm('opened_at',e.target.value); q('#beOut').onchange=e=>tm('closed_at',e.target.value);
    qa('[data-bcrm]').forEach(x=>x.onclick=()=>{ const c=S.casts.find(z=>z.id===x.dataset.bcrm); S.casts=S.casts.filter(z=>z!==c); if(c.is_kakari) syncHc(); redo(); });
    qa('[data-bgrm]').forEach(x=>x.onclick=()=>{ S.goods=S.goods.filter(z=>z.id!==x.dataset.bgrm); redo(); });
    qa('[data-badd]').forEach(x=>x.onchange=async()=>{ const sid=x.value, k=x.dataset.badd; if(!sid) return; const ex=S.casts.find(c=>c.staff_id===sid);
      if(k==='g') S.goods.push({id:beUid(),staff_id:sid});
      else if(k==='k'){ if(ex) ex.is_kakari=true; else S.casts.push({id:beUid(),staff_id:sid,role:'none',is_kakari:true}); syncHc(); }
      else { if(S.casts.filter(c=>beDh(c.role)).length>=B.guest_count){ await uiAlert(`同伴は客数（${B.guest_count}名）までです`); redo(); return; } const role=beRole(B.opened_at), kak=!!st.douhan_is_kakari;
        if(ex){ ex.role=role; if(kak) ex.is_kakari=true; } else S.casts.push({id:beUid(),staff_id:sid,role,is_kakari:kak}); if(kak) syncHc(); }
      redo(); });
    qa('[data-bq]').forEach(x=>x.onchange=()=>{ const i=S.items.find(z=>z.id===x.dataset.bq), n=parseInt(x.value,10); if(!(n>=1)){ x.value=i.qty; return; } i.qty=n; resplit(i); redo(); });
    qa('[data-bvd]').forEach(x=>x.onclick=()=>{ const i=S.items.find(z=>z.id===x.dataset.bvd); if(O.items.some(z=>z.id===i.id)) i.is_void=true; else S.items=S.items.filter(z=>z!==i); redo(); });
    qa('[data-bbk]').forEach(x=>x.onclick=async()=>{ const i=S.items.find(z=>z.id===x.dataset.bbk), cur=new Set((i.splits||[]).map(z=>z.staff_id)), list=ST.filter(s=>s.kind==='cast'&&!s.kakari_only&&(s.is_active||cur.has(s.id))&&(att.has(s.id)||cur.has(s.id)));
      const m=modal(`<h2 style="margin:0">${esc(i.name)} のバック</h2><div class="muted" style="font-size:13px">選んだ人で等分します（端数は最初の人）</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px">${list.map(s=>`<label style="display:flex;align-items:center;gap:6px;font-size:15px"><input type="checkbox" value="${s.id}" ${cur.has(s.id)?'checked':''} style="width:auto;min-height:0">${esc(s.name)}</label>`).join('')||'<div class="muted">この日に出勤したキャストがいません</div>'}</div><div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">決める</button></div>`);
      m.querySelector('[data-k=no]').onclick=()=>m.remove(); m.querySelector('[data-k=ok]').onclick=()=>{ const ids=[...m.querySelectorAll('input:checked')].map(c=>c.value); m.remove(); i.splits=split(i,ids); redo(); }; });
    q('#bePAdd').onclick=()=>{ const p=pn(q('#beP').value), n=parseInt(q('#beQ').value,10); if(!p){ uiAlert('メニューを選んでください'); return; } if(!(n>=1)){ uiAlert('数量を入力してください'); return; }
      const i={id:beUid(),product_id:p.id,category_id:p.category_id??null,name:p.name,qty:n,unit_price:Number(p.price||0),cast_subtotal_price:Number(p.cast_subtotal_price||0),back_amount:Number(p.back_amount||0),back_points:Number(p.back_points||0),is_service_target:p.is_service_target!==false,is_void:false,splits:[]};
      S.items.push(i); if(hcId&&p.id===hcId) syncHc(); redo(); };
    qa('[data-barm]').forEach(x=>x.onclick=()=>{ S.adjs=S.adjs.filter(z=>z.id!==x.dataset.barm); redo(); });
    q('#beAAdd').onclick=()=>{ const v=parseInt(q('#beAA').value,10); if(!(v>0)){ uiAlert('金額を入力してください'); return; } S.adjs.push({id:beUid(),kind:q('#beAK').value,amount:v,reason:''}); redo(); };
    const recv=m=>m==='invoice'?null:B.closed_at;
    qa('[data-bpm]').forEach(x=>x.onchange=()=>{ const p=S.pays.find(z=>z.id===x.dataset.bpm); p.method=x.value; p.received_at=p.method==='invoice'?null:(p.received_at||recv(p.method)); redo(); });
    qa('[data-bpa]').forEach(x=>x.onchange=()=>{ const p=S.pays.find(z=>z.id===x.dataset.bpa), v=parseInt(x.value,10); if(!(v>0)){ x.value=p.amount; uiAlert('金額は1円以上にしてください（削除は ×）'); return; } p.amount=v; redo(); });
    qa('[data-bprm]').forEach(x=>x.onclick=()=>{ S.pays=S.pays.filter(z=>z.id!==x.dataset.bprm); redo(); });
    q('#bePayAdd').onclick=()=>{ const v=parseInt(q('#bePA').value,10), m=q('#bePM').value; if(!(v>0)){ uiAlert('金額を入力してください'); return; } S.pays.push({id:beUid(),method:m,amount:v,paid_at:B.closed_at,revenue_date:bd,received_at:recv(m)}); redo(); };
    q('#beNo').onclick=async()=>{ if(diff().ops.length&&!await uiConfirm('修正内容を保存せずに閉じますか？','閉じる','danger')) return; close(); };
    q('#beDel').onclick=guard(q('#beDel'),async()=>{ if(!await uiConfirm(`${md(bd)} 卓${B.table||''}　${yen(O.calc.amount_due)} の伝票を削除しますか？\n売上・${KL}小計・バックから外れます`,'削除','danger')) return; const z=await rpc('admin_bill_void',{p_bill:id}); if(!z.ok) return; close(); toast('削除しました'); (PAGES[page]||PAGES.pl)(); });
    q('#beOk').onclick=guard(q('#beOk'),async()=>{ const {ops,note}=diff(); if(!ops.length){ close(); return; } await check(); if(!last) { await uiAlert('修正内容に問題があります。赤い文字を確かめてください'); return; }
      const pd=S.pays.reduce((a,p)=>a+Number(p.amount||0),0); if(pd!==Number(last.due)&&!await uiConfirm(`支払いの合計（${yen(pd)}）が請求額（${yen(last.due)}）と合いません。このまま保存しますか？`,'保存')) return;
      const z=await rpc('admin_bill_edit',{p_bill:id,p_ops:ops,p_note:note,p_reason:q('#beR').value.trim(),p_dry:false,p_ver:O.ver||null /* v1.75・SQL 293：開いた時の伝票の版。ほかの画面で変わっていたら断る */}); if(!z.ok) return; close(); toast('修正しました'); (PAGES[page]||PAGES.pl)(); });
    check(); }
  draw(); }

