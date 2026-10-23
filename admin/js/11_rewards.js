// ---------- 報酬・罰金項目（v0.09：スライド表。店舗で全員同じ）----------
// キャストの時給＝小計（またはポイント）スライド・同伴スライド・保証時給のうち一番高いもの（POS と同じ）。黒服のボーナス総額＝人件費比率のボーナス＋売上ボーナス
const SLIDE_DEF={
  sales:{t:'小計スライド',sub:''+KL+'小計で時給が決まる',cols:[{k:'threshold',l:''+KL+'小計（万円以上）',sc:10000},{k:'wage',l:'時給（円）'}]},
  points:{t:'ポイントスライド',sub:'ポイントで時給が決まる',cols:[{k:'threshold',l:'ポイント（以上）'},{k:'wage',l:'時給（円）'}]},
  douhan:{t:'同伴スライド',sub:'月の同伴回数で時給が決まる',cols:[{k:'threshold',l:'同伴（回以上）'},{k:'wage',l:'時給（円）'}]},
  hall:{t:'黒服ボーナススライド',sub:'',cols:[{k:'sales_man',l:'売上（万円以上）'},{k:'target_ratio',l:'目標比率（%）',sc:0.01},{k:'b_within',l:'以内'},{k:'b_plus2',l:'＋2%まで'},{k:'b_plus5',l:'＋5%まで'},{k:'b_over',l:'5%超'},{k:'b_sales',l:'売上ボーナス'}]},
};
const slNum=v=>{ const t=String(v??'').replace(/[０-９．]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[,，\s]/g,''); return t===''?null:Number(t); };
const slShow=(v,sc)=>v==null?'':String(Math.round(Number(v)/(sc||1)*10000)/10000);
// v0.90：報酬・罰金項目の箱は、タイトルだけ並べて押すと開く（payOpen：開いている箱。保存して描き直しても開いたまま）
const payOpen=new Set();
const foldCard=(key,title,extra,sum,body,attr='')=>`<div class="card fold${payOpen.has(key)?' open':''}" data-fold="${esc(key)}" ${attr}><div class="fh"><span class="ar">▸</span><b>${title}</b>${extra||''}<span class="sm2">${sum||''}</span></div><div class="fb">${body}</div></div>`;
const foldWire=root=>root.querySelectorAll('.fold>.fh').forEach(h=>{ if(h.dataset.w) return; h.dataset.w=1; h.onclick=()=>{ const f=h.parentElement, k=f.dataset.fold; f.classList.toggle('open'); f.classList.contains('open')?payOpen.add(k):payOpen.delete(k); }; });
function slideCard(kind,rows,ed,note){ const d=SLIDE_DEF[kind];
  const body=rows.map((r,i)=>`<tr data-i="${i}">${d.cols.map(c=>`<td><input inputmode="decimal" data-c="${c.k}" value="${esc(slShow(r[c.k],c.sc))}" ${ed?'':'disabled'}></td>`).join('')}${ed?`<td class="x"><button class="ghost sm" data-del="${i}" aria-label="行を削除">✕</button></td>`:''}</tr>`).join('');
  return foldCard('sl:'+kind,d.t,'',`${rows.length}行`,`${note||''}
    <div class="slw"><table class="sl"><tr>${d.cols.map(c=>`<th>${c.l}</th>`).join('')}${ed?'<th></th>':''}</tr>${body||`<tr><td colspan="${d.cols.length}" class="muted" style="padding:8px 4px">まだ入っていません</td></tr>`}</table></div>
    ${ed?`<div class="fend"><button class="ghost sm" data-add>＋ 行を追加</button><span class="sp"></span><button class="primary sm" data-save>保存</button></div>`:''}`,`data-sl="${kind}"`); }
function slideRead(card,kind){ const d=SLIDE_DEF[kind]; const out=[];
  for(const tr of card.querySelectorAll('tr[data-i]')){ const r={}; let empty=true;
    for(const c of d.cols){ const v=slNum(tr.querySelector(`[data-c="${c.k}"]`).value); if(v!=null) empty=false; if(v!=null&&!Number.isFinite(v)) return {err:`「${c.l}」に数字でないものがあります`}; r[c.k]=v==null?null:Math.round(v*(c.sc||1)*10000)/10000; }
    if(empty) continue; if(r[d.cols[0].k]==null||r[d.cols[1].k]==null) return {err:`「${d.cols[0].l}」と「${d.cols[1].l}」は必ず入力してください`}; out.push(r); }
  const k0=d.cols[0].k; out.sort((a,b)=>a[k0]-b[k0]); for(let i=1;i<out.length;i++) if(out[i][k0]===out[i-1][k0]) return {err:`「${d.cols[0].l}」が同じ行が2つあります`};
  return {rows:out}; }
// v0.18・SQL 058：スライド表（店ごとにいくつでも）。何で決まるか（係小計・ポイント・同伴数・稼働日数）と時給／日給を表ごとに決める。キャストごとに使う表は「キャスト設定」で選ぶ
// v0.19・SQL 059：反応数（反応◎の回数）・組数（係の伝票の数）・人数（係の伝票の客数の合計）を追加。何で決まるかは作る時だけ選べて、作ったあとは変えられない
const ST_BASIS=[['sales',''+KL+'小計',''+KL+'小計（万円以上）',10000],['points','ポイント','ポイント（以上）',1],['douhan','同伴数','同伴（回以上）',1],['days','稼働日数','稼働日数（日以上）',1],['reactions','反応数','反応◎（回以上）',1],['groups','組数',''+KL+'の組数（組以上）',1],['guests','人数',''+KL+'の人数（名以上）',1]];
const stB=k=>ST_BASIS.find(x=>x[0]===k)||ST_BASIS[0];
const SL_COLS=()=>matchMedia('(max-width:640px)').matches?1:3;
const srHtml=(th,am,ed)=>`<div class="sr" data-i><input inputmode="decimal" data-c="th" value="${esc(th)}" ${ed?'':'disabled'}><input inputmode="numeric" data-c="am" value="${esc(am)}" ${ed?'':'disabled'}>${ed?'<button class="ghost sm" data-del aria-label="行を削除">✕</button>':'<span></span>'}</div>`;
// 行の数に合わせて、上から下へ3列に流す（見出しは使っている列だけ）
function slFlow(card){ const bx=card.querySelector('.slb'); if(!bx) return; const c=SL_COLS(), n=bx.querySelectorAll('[data-i]').length;
  card.querySelectorAll('.slb,.slhd').forEach(x=>x.style.setProperty('--slc',c)); bx.style.gridTemplateRows=`repeat(${Math.max(1,Math.ceil(n/c))},auto)`;
  card.querySelectorAll('.slhd>.sr').forEach((h,i)=>h.style.visibility=i<Math.max(1,Math.min(c,n))?'':'hidden'); }
function stCard(t,rows,users,ed){ const dis=ed?'':'disabled', b=stB(t.basis||'sales'), un=t.unit||'hourly';
  const body=rows.map(r=>srHtml(slShow(r.threshold,b[3]),r.amount??'',ed)).join('');
  const hd=`<div class="sr"><span data-k="thl">${b[2]}</span><span data-k="aml">${un==='daily'?'日給':'時給'}（円）</span><span></span></div>`;
  return foldCard('st:'+(t.id||'new'),t.id?esc(t.name||''):'新しい表',t.id?`<span class="tg">${b[1]}</span><span class="tg">${un==='daily'?'日給':'時給'}</span>`:'',t.id?`使っているキャスト ${users}人`:'',
    `<div class="row" style="margin-bottom:10px"><input data-k="name" value="${esc(t.name||'')}" placeholder="表の名前" maxlength="20" ${dis} style="flex:1;min-width:140px;font-weight:700">
    ${t.id?`<span data-k="basis" data-v="${b[0]}" class="stb">${b[1]}</span>`:`<select data-k="basis" style="width:auto" ${dis}>${ST_BASIS.map(x=>`<option value="${x[0]}" ${x[0]===b[0]?'selected':''}>${x[1]}</option>`).join('')}</select>`}
    <span class="seg" data-k="unit">${[['hourly','時給'],['daily','日給']].map(([v,n])=>`<button data-v="${v}" class="${un===v?'on':''}" ${dis}>${n}</button>`).join('')}</span></div>
    <div class="slhd">${hd}${hd}${hd}</div><div class="slb">${body}</div>${rows.length?'':'<div class="muted" data-empty style="padding:8px 4px">まだ入っていません</div>'}
    ${ed?`<div class="fend"><button class="ghost sm" data-add>＋ 行を追加</button><span class="sp"></span>${t.id?'<button class="ghost sm" data-delt>この表を削除</button>':''}<button class="primary sm" data-save>保存</button></div>`:''}`,`data-st="${t.id||''}"`); }
function stSection(tbls,rows,terms,ed){ const cur=csNowMonth(), by={};
  terms.forEach(x=>{ if(x.month<=cur&&(x.month===cur||!x.only_month)){ const p=by[x.staff_id]; if(!p||x.month>p.month) by[x.staff_id]=x; } });
  const users=id=>Object.values(by).filter(x=>(x.slide_ids||[]).includes(id)).length;
  return `<div id="stGrid">${tbls.map(t=>stCard(t,rows.filter(r=>r.table_id===t.id),users(t.id),ed)).join('')||'<div class="card muted">スライド表がありません</div>'}</div>
    <div class="row" style="margin:2px 0 10px">${ed?'<button class="ghost sm" id="stAdd">＋ スライド表を追加</button>':''}<div class="muted hint" style="font-size:13px;line-height:1.6">キャストごとに使う表は「スタッフ設定」で選びます<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">その人が選んだ表と保証時給のうち、一番高い金額になります<br>時給の人は時給の表、日給の人は日給の表だけ選べます<br>表の行は「○○以上 → 金額」。今月の数字が、その行の数字以上になっている行のうち一番下の行を使います</div></div></div>`; }
function stWire(st){ const grid=$('stGrid'); if(!grid) return;
  const wire=card=>{ const q=k=>card.querySelector(`[data-k=${k}]`); let unit=card.querySelector('[data-k=unit] button.on')?.dataset.v||'hourly';
    const setAll=(k,v)=>card.querySelectorAll(`[data-k=${k}]`).forEach(x=>x.textContent=v); slFlow(card);
    const bs=()=>q('basis').dataset.v||q('basis').value; if(q('basis').tagName==='SELECT') q('basis').onchange=()=>setAll('thl',stB(bs())[2]);
    card.querySelectorAll('[data-k=unit] button').forEach(b=>b.onclick=()=>{ unit=b.dataset.v; card.querySelectorAll('[data-k=unit] button').forEach(x=>x.classList.toggle('on',x===b)); setAll('aml',(unit==='daily'?'日給':'時給')+'（円）'); });
    const delRow=x=>x.onclick=()=>{ x.closest('[data-i]').remove(); slFlow(card); }; card.querySelectorAll('[data-del]').forEach(delRow);
    card.querySelector('[data-add]').onclick=()=>{ card.querySelector('[data-empty]')?.remove(); const bx=card.querySelector('.slb'); bx.insertAdjacentHTML('beforeend',srHtml('','',true)); const tr=[...bx.querySelectorAll('[data-i]')].pop(); delRow(tr.querySelector('[data-del]')); slFlow(card); tr.querySelector('input').focus(); };
    const sv=card.querySelector('[data-save]'); sv.onclick=guard(sv,async()=>{ const name=q('name').value.trim(), basis=bs(), sc=stB(basis)[3]; if(!name){ await uiAlert('表の名前を入力してください'); return; }
      const out=[]; for(const tr of card.querySelectorAll('.slb [data-i]')){ const th=slNum(tr.querySelector('[data-c=th]').value), am=slNum(tr.querySelector('[data-c=am]').value); if(th==null&&am==null) continue;
        if(th==null||am==null){ await uiAlert('「以上」と金額は必ず入力してください'); return; } if(!Number.isFinite(th)||th<0){ await uiAlert('「以上」は0以上の数にしてください'); return; } if(!Number.isInteger(am)||am<=0){ await uiAlert('金額は1以上の整数にしてください'); return; }
        out.push({threshold:Math.round(th*sc*10000)/10000,amount:am}); }
      out.sort((a,b)=>a.threshold-b.threshold); for(let i=1;i<out.length;i++) if(out[i].threshold===out[i-1].threshold){ await uiAlert('「以上」が同じ行が2つあります'); return; }
      if(!await uiConfirm(`スライド表「${name}」を保存しますか？（${out.length}行）\nPOS の時給の表示も変わります`)) return;
      const r=await rpc('admin_save_slide_table',{p_store:st,p_id:card.dataset.st||null,p_name:name,p_basis:basis,p_unit:unit,p_rows:out}); if(!r.ok) return; toast('保存しました'); PAGES.set_pay(); });
    const dl=card.querySelector('[data-delt]'); if(dl) dl.onclick=guard(dl,async()=>{ if(!await uiConfirm(`スライド表「${q('name').value.trim()}」を削除しますか？\nこの表を選んでいたキャストからは外れます（ほかに表がなければ「未選択」になります）`,'削除','danger')) return;
      const r=await rpc('admin_delete_slide_table',{p_id:card.dataset.st}); if(!r.ok) return; toast('削除しました'); PAGES.set_pay(); }); };
  grid.querySelectorAll('[data-st]').forEach(wire);
  const ad=$('stAdd'); if(ad) ad.onclick=()=>{ if(grid.querySelector('[data-st=""]')){ grid.querySelector('[data-st=""] [data-k=name]').focus(); return; } grid.querySelector(':scope > .card.muted')?.remove(); grid.insertAdjacentHTML('beforeend',stCard({},[],0,true)); const c=grid.querySelector('[data-st=""]'); c.classList.add('open'); foldWire(grid); wire(c); c.querySelector('[data-k=name]').focus(); }; }
PAGES.set_pay=async()=>{
  const st=storeId, ed=perm('set_pay')==='edit';
  $('main').innerHTML=`<h1>報酬・罰金項目 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="card muted">読み込み中…</div>`;
  const [ps,hb,pos,ft,ax,stb,srw,ctm,rwt]=await Promise.all([ sb.from('pay_slides').select('kind,threshold,wage').eq('store_id',st).order('threshold'),
    sb.from('hall_bonus_slides').select('*').eq('store_id',st).order('sales_man'), sb.from('pos_settings').select('*').eq('store_id',st).maybeSingle(),
    sb.from('fine_types').select('name,target,calc,value,per_unit,sort_order').eq('store_id',st).order('sort_order'), sb.rpc('admin_get_after_ext',{p_store:st}),
    sb.from('slide_tables').select('*').eq('store_id',st).eq('is_active',true).order('sort_order'), sb.from('slide_rows').select('table_id,threshold,amount').eq('store_id',st).order('threshold'),
    sbAll(()=>sb.from('cast_terms').select('staff_id,month,only_month,slide_ids').eq('store_id',st).lte('month',csNowMonth()).order('id')), sb.rpc('admin_reward_types',{p_store:st}) ]);
  if(page!=='set_pay'||storeId!==st) return;
  const er=ps.error||hb.error||pos.error; if(er){ $('main').innerHTML=`<h1>報酬・罰金項目</h1><div class="card err">${esc(/hall_bonus_slides/.test(er.message)&&/does not exist|schema cache/.test(er.message)?'SQL 050 が未実行です：':'読み込めません：')}${esc(er.message)}</div>`; return; }
  $('main').innerHTML=`<h1>報酬・罰金項目 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  ${ed?'':'<div class="muted" style="margin-bottom:10px">閲覧のみ</div>'}
  <div class="psec">勤怠・日払</div>
  ${afterCard(ax,ed)}
  ${payAdvCard(pos,ed)}
  <div class="psec">罰金</div>
  ${ft.error?`<div class="card err">${esc(/fine_types/.test(ft.error.message)&&/does not exist|schema cache/.test(ft.error.message)?'SQL 052 が未実行です：':'罰金の種類を読み込めません：')}${esc(ft.error.message)}</div>`:fineCard(ft.data||[],ed,pos.data?.daily_hours)}
  <div class="psec">報酬</div>
  ${rwt.error?`<div class="card err">${esc(/admin_reward_types/.test(rwt.error.message)?'SQL 140 が未実行です：':'報酬の種類を読み込めません：')}${esc(rwt.error.message)}</div>`:rwCard(rwt.data||{},ed)}
  <div class="psec">キャスト</div>
  ${stb.error?`<div class="card err">${esc(/slide_tables/.test(stb.error.message)&&/does not exist|schema cache/.test(stb.error.message)?'SQL 058 が未実行です：':'スライド表を読み込めません：')}${esc(stb.error.message)}</div>`:stSection(stb.data||[],srw.data||[],ctm.data||[],ed)}
  ${payPtCard(pos,ed)}
  <div id="cardBox"></div>
  <div id="dressBox"></div>
  <div class="psec">黒服</div>
  ${slideCard('hall',hb.data||[],ed,`<div class="muted hint" style="font-size:13px;margin-bottom:8px;line-height:1.6">単位は万円。月の総売上が、その行の売上以上になっている行のうち、一番下の行を使います<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">一番上の行より売上が少ない月は0円です。<br>人件費比率（キャストの報酬＋黒服の月給＋体験の報酬 ÷ 総売上）が 目標比率以内／＋2%まで／＋5%まで／5%超 で金額が決まり、売上ボーナスを加算した総額を、黒服の売上シェアで分けます</div></div>`)}`;
  foldWire($('main'));
  cardFold(st,ed);
  dressFold(st,ed);
  fineListWire(st,ed);
  rwWire(st,ed);
  if(!ed) return;
  payNumWire(st);
  { const ac=$('main').querySelector('[data-after]'); if(ac){ let on=!!ax.data?.on; ac.querySelectorAll('#afOn button').forEach(b=>b.onclick=()=>{ on=b.dataset.v==='true'; ac.querySelectorAll('#afOn button').forEach(x=>x.classList.toggle('on',x===b)); });
    const sv=$('afSave'); sv.onclick=guard(sv,async()=>{ const m=slNum($('afM').value); if(m==null||!Number.isInteger(m)||m<1||m>180){ await uiAlert('何分前かは 1〜180 の整数で入力してください'); return; } const cl=closeTxt(ax.data.close);
      if(!await uiConfirm(on?`閉店（${cl}）の ${m}分前を過ぎたアフターは、閉店まで働いたことにしますか？\nこれから押す打刻から変わります`:'アフターの延長を「しない」にしますか？\nこれから押す打刻から変わります')) return;
      const r=await rpc('admin_set_after_ext',{p_store:st,p_on:on,p_minutes:m}); if(!r.ok) return; toast('保存しました'); PAGES.set_pay(); }); } }
  { const fc=$('main').querySelector('[data-fines]'); if(fc){
    const hs=$('dHoursSave'); if(hs) hs.onclick=guard(hs,async()=>{ const h=slNum($('dHours').value); if(h==null||!(h>0&&h<=24)){ await uiAlert('所定時間は0より大きく24以下の数にしてください'); return; } if(!await uiConfirm(`日給の人の所定時間を ${h}時間 にしますか？\n時間給 ＝ 日給 ÷ ${h}時間 になります`)) return; const r=await rpc('admin_set_daily_hours',{p_store:st,p_hours:h}); if(!r.ok) return; toast('保存しました'); PAGES.set_pay(); });
  } }
  stWire(st);
  $('main').querySelectorAll('[data-sl]').forEach(card=>{ const kind=card.dataset.sl, d=SLIDE_DEF[kind];
    card.querySelector('[data-add]').onclick=()=>{ const tb=card.querySelector('table.sl'); const ph=tb.querySelector('td[colspan]'); if(ph) ph.parentElement.remove(); const i=tb.querySelectorAll('tr[data-i]').length+Date.now(); const tr=document.createElement('tr'); tr.dataset.i=i; tr.innerHTML=d.cols.map(c=>`<td><input inputmode="decimal" data-c="${c.k}"></td>`).join('')+`<td class="x"><button class="ghost sm" aria-label="行を削除">✕</button></td>`; tr.querySelector('button').onclick=()=>tr.remove(); tb.appendChild(tr); tr.querySelector('input').focus(); };
    card.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>x.closest('tr').remove());
    const sv=card.querySelector('[data-save]'); sv.onclick=guard(sv,async()=>{ const g=slideRead(card,kind); if(g.err){ await uiAlert(g.err); return; }
      if(!await uiConfirm(`${d.t}を保存しますか？（${g.rows.length}行）`)) return;
      const r=kind==='hall'?await rpc('admin_save_hall_bonus',{p_store:st,p_rows:g.rows}):await rpc('admin_save_pay_slides',{p_store:st,p_kind:kind,p_rows:g.rows}); if(!r.ok) return;
      toast('保存しました'); PAGES.set_pay(); }); });
};

// v0.11・SQL 052：罰金の種類（店舗ごと）。POS の在籍リスト「＋罰金」で選ぶ。金額が決まっているものはそのまま登録、時給の％は月末の時給で計算、日給の％はその人の日給で計算
// v1.26・SQL 140：報酬の種類（オーナー 2026-10-17「罰金の種類だけではなく、報酬の種類も作れ」「広島はポイントの加算でスライド表作ってる」）
// 名前・手当（円）かポイント・1回の数・自動（連絡先交換の提出）。ポイントはその月のポイント（ポイントスライド）に、手当は報酬の手当に足す。POS の在籍リストの「手当」で選ぶ
let RWT=[], RWPS=false;
const rwTxt=x=>`${x.value!=null?`${Number(x.value).toLocaleString('ja-JP')}${x.kind==='point'?'P':'円'}／1回`:'<span class="muted">数 未設定</span>'}${x.auto==='contact'?'　自動':''}`;
function rwCard(d,ed){ RWT=d.rows||[]; RWPS=!!d.point_slide; return foldCard('rewards','報酬の種類','',`${RWT.length}種類`,`<div class="muted" style="font-size:13px;margin-bottom:8px">POS：在籍リストの「手当」${RWPS?'（手当／ポイント）':''}　自動：連絡先交換の提出1件ごと</div>
  <div style="border:1px solid var(--line);border-radius:10px;background:#fff">${RWT.map((x,i)=>`<div ${ed?`data-rwi="${i}"`:''} style="display:flex;justify-content:space-between;gap:12px;padding:10px 14px;${i?'border-top:1px solid var(--line);':''}${ed?'cursor:pointer':''}"><span>${esc(x.name)}　<small class="muted">${x.kind==='point'?'ポイント':'手当'}</small></span><b style="font-weight:600">${rwTxt(x)}</b></div>`).join('')||'<div class="muted" style="padding:10px 14px">なし</div>'}</div>
  ${ed?'<div class="fend"><button class="ghost sm" data-rwadd>＋ 報酬を追加</button></div>':''}`,'data-rewards'); }
function rwEdit(st,i){ const x=i==null?{name:'',kind:RWPS?'point':'yen',value:null,auto:null}:RWT[i];
  const md=modal(`<h2 style="margin:0">${i==null?'報酬の追加':esc(x.name)}</h2><label>名前<input id="rwN" value="${esc(x.name)}"></label>
    <label>種類<select id="rwK"><option value="yen" ${x.kind==='yen'?'selected':''}>手当（円）</option><option value="point" ${x.kind==='point'?'selected':''}>ポイント</option></select></label>
    <label>1回<span style="display:flex;gap:6px;align-items:center"><input id="rwV" inputmode="numeric" value="${x.value??''}" style="width:120px;text-align:right"><span id="rwU">${x.kind==='point'?'P':'円'}</span></span></label>
    <label>自動<select id="rwA"><option value="">なし（POS で付ける）</option><option value="contact" ${x.auto==='contact'?'selected':''}>連絡先交換の提出1件ごと</option></select></label>
    <div class="bar">${i==null?'':'<button class="ghost" data-k="del" style="color:var(--warn);margin-right:auto">削除</button>'}<button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  const q=id=>md.querySelector('#'+id); q('rwK').onchange=()=>{ q('rwU').textContent=q('rwK').value==='point'?'P':'円'; };
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  const save=async L=>{ const r=await rpc('admin_reward_types_save',{p_store:st,p_rows:L}); return r.ok; };
  const del=md.querySelector('[data-k=del]'); if(del) del.onclick=async()=>{ if(!await uiConfirm(`「${x.name}」を報酬の一覧から消しますか？\n今までに付けたものは消えません`,'削除','danger')) return; if(!await save(RWT.filter((_,k)=>k!==i))) return; md.remove(); toast('削除しました'); PAGES.set_pay(); };
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{ const name=q('rwN').value.trim(); if(!name){ await uiAlert('名前を入力してください'); return; }
    if(RWT.some((y,k)=>k!==i&&y.name===name)){ await uiAlert(`「${name}」はもうあります`); return; }
    const v=q('rwV').value.trim()===''?null:slNum(q('rwV').value); if(v!=null&&!(v>0)){ await uiAlert('1回の数は1以上にするか、空けてください'); return; }
    const y={name,kind:q('rwK').value,value:v,auto:q('rwA').value||null}; const L=RWT.slice(); if(i==null) L.push(y); else L[i]=y; if(!await save(L)) return; md.remove(); toast('保存しました'); PAGES.set_pay(); }); }
function rwWire(st,ed){ if(!ed) return; document.querySelectorAll('[data-rwi]').forEach(e=>e.onclick=()=>rwEdit(st,Number(e.dataset.rwi))); const a=document.querySelector('[data-rewards] [data-rwadd]'); if(a) a.onclick=()=>rwEdit(st,null); }
// v0.17：罰金1つを1行にして、時給の人・日給の人の決め方を横に並べる（表は今と同じ fine_types。時給と日給が同じ「円」か「その都度」なら target='all' の1行＝黒服にもかかる。違えば hourly・daily の2行）
const FINE_H=[['','なし'],['hourly_pct','％'],['yen','円'],['input','その都度']], FINE_D=[['','なし'],['daily_pct','％'],['yen','円'],['input','その都度'],['daily_late','遅刻（時間分）'],['daily_early','早上がり（時間分）']];
const FINE_TIME=c=>c==='daily_late'||c==='daily_early';
// fine_types の行 → 名前ごとに {name, h:{calc,value,per_unit}, d:{…}}
function fineGroup(rows){ const g=new Map();
  for(const r of rows){ const k=r.name; if(!g.has(k)) g.set(k,{name:k,h:null,d:null}); const x=g.get(k), c={calc:r.calc,value:r.value,per_unit:r.per_unit};
    if(r.target==='hourly') x.h=c; else if(r.target==='daily') x.d=c;
    else if(r.calc==='hourly_pct') x.h=x.h||c; else if(r.calc==='daily_pct'||FINE_TIME(r.calc)) x.d=x.d||c; else { x.h=x.h||c; x.d=x.d||c; } }
  return [...g.values()]; }
function fineSide(k,c,ed){ const dis=ed?'':'disabled', os=k==='h'?FINE_H:FINE_D, cl=c?.calc||'';
  return `<td><select data-f="${k}c" ${dis}>${os.map(([v,n])=>`<option value="${v}" ${cl===v?'selected':''}>${n}</option>`).join('')}</select></td>
    <td><input data-f="${k}v" inputmode="numeric" value="${c?.value??''}" ${dis}><span class="u" data-f="${k}u"></span></td><td><label class="pu"><input type="checkbox" data-f="${k}p" ${c?.per_unit?'checked':''} ${dis}>個数</label></td>`; }
function fineRowHtml(r,ed){ return `<tr data-fr><td><input data-f="name" value="${esc(r.name||'')}" ${ed?'':'disabled'}></td>${fineSide('h',r.h,ed)}<td class="sep"></td>${fineSide('d',r.d,ed)}${ed?'<td class="x"><button class="ghost sm" data-fdel aria-label="行を削除">✕</button></td>':''}</tr>`; }
function fineRowWire(tr,ed){ for(const k of ['h','d']){ const q=f=>tr.querySelector(`[data-f=${k}${f}]`), cl=q('c'), v=q('v'), pu=q('p'), u=q('u');
    const upd=()=>{ const c=cl.value; u.textContent=c==='yen'?'円':(c===''||c==='input')?'':'%'; v.disabled=!ed||c===''||c==='input'; if(c===''||c==='input') v.value=''; v.placeholder=FINE_TIME(c)?'加算（%）':''; pu.disabled=!ed||c!=='yen'; if(c!=='yen') pu.checked=false; }; cl.onchange=upd; upd(); }
  const d=tr.querySelector('[data-fdel]'); if(d) d.onclick=()=>tr.remove(); }
// v1.18：罰金の種類は「一覧は文、押して小窓で変える」（オーナー 2026-10-17。見本ア）。時給・日給の2列と「個数」のチェックをやめた。円の罰金は POS でいつも回数を入れられる（per_unit を全部 true）
let FINES=[];
const fineTxt=c=>!c?'なし':c.calc==='yen'?`${Number(c.value||0).toLocaleString('ja-JP')}円`:c.calc==='hourly_pct'?(c.value%100===0?`時給×${c.value/100}時間`:`時給の${c.value}%`):c.calc==='daily_pct'?`日給 ${c.value}%`:c.calc==='input'?'その都度':c.calc==='daily_late'?`遅刻時間分${c.value?`＋日給 ${c.value}%`:''}`:c.calc==='daily_early'?`早上がり時間分${c.value?`＋日給 ${c.value}%`:''}`:'—';
const fineSame=(a,b)=>!!a&&!!b&&a.calc===b.calc&&(a.value??null)===(b.value??null);
// v1.55：所定時間の保存も箱の右下（オーナー 2026-10-23「ちぐはぐやめて」）
function fineCard(rows,ed,hours){ FINES=fineGroup(rows); return foldCard('fines','罰金の種類','',`${FINES.length}種類`,`<div class="muted" style="font-size:13px;margin-bottom:8px">POS の在籍リストの「＋罰金」で選びます。${ed?'押すと変えられます':''}</div>
  <div class="row" style="margin-bottom:10px;font-size:14px">日給の人の所定時間<input id="dHours" inputmode="decimal" value="${hours??''}" ${ed&&hours!=null?'':'disabled'} style="width:80px;text-align:right">時間${hours==null?'<span class="muted" style="font-size:13px">SQL 053 が未実行です</span>':''}</div>
  <div id="fnList">${fineListHtml(ed)}</div>${ed?`<div class="fend"><button class="ghost sm" data-fadd>＋ 罰金を追加</button><span class="sp"></span>${hours!=null?'<button class="primary sm" id="dHoursSave">保存</button>':''}</div>`:''}`,'data-fines'); }
function fineListHtml(ed){ return `<div style="border:1px solid var(--line);border-radius:10px;background:#fff">${FINES.map((g,i)=>{ const same=fineSame(g.h,g.d)||(!g.d&&g.h&&(g.h.calc==='yen'||g.h.calc==='input'));
    return `<div ${ed?`data-fi="${i}"`:''} style="display:flex;justify-content:space-between;gap:12px;padding:10px 14px;${i?'border-top:1px solid var(--line);':''}${ed?'cursor:pointer':''}"><span>${esc(g.name)}</span><span style="text-align:right">${!g.h?`<b>${fineTxt(g.d)}</b><br><span class="muted" style="font-size:12px">日給のみ</span>`:`<b>${fineTxt(g.h)}</b>${same?'':`<br><span class="muted" style="font-size:12px">${g.d&&g.d.calc==='daily_pct'?fineTxt(g.d):'日給 '+fineTxt(g.d)}</span>`}`}</span></div>`; }).join('')||'<div class="muted" style="padding:10px 14px">まだ入っていません</div>'}</div>`; }
function fineEdit(st,i){ const g=i==null?{name:'',h:{calc:'yen',value:null},d:null}:FINES[i], hc=g.h?.calc||'none', same=fineSame(g.h,g.d)||(!g.d&&g.h&&(g.h.calc==='yen'||g.h.calc==='input'))||(g.h&&g.d&&g.h.calc==='yen'&&g.d.calc==='yen'&&g.h.value===g.d.value);
  const dSel=same?'same':g.d?g.d.calc:'none';
  const md=modal(`<h2 style="margin:0">${i==null?'罰金の追加':esc(g.name)}</h2><label>名前<input id="fnN" value="${esc(g.name)}"></label>
    <div><div class="muted" style="font-size:13px;margin-bottom:4px">時給の人</div>${[['yen','金額',`<input id="fnHy" inputmode="numeric" value="${hc==='yen'?g.h.value??'':''}" style="width:110px;text-align:right"> 円`],['hourly_pct','時給の',`<input id="fnHp" inputmode="decimal" value="${hc==='hourly_pct'?g.h.value/100:''}" style="width:80px;text-align:right"> 時間分`],['input','その都度（POS で金額を入れる）',''],['none','かからない','']].map(([v,n,x])=>`<label style="display:flex;align-items:center;gap:8px;flex-direction:row;margin:4px 0;color:var(--ink);font-size:15px"><input type="radio" name="fnH" value="${v}" ${hc===v?'checked':''} style="width:auto">${n} ${x}</label>`).join('')}</div>
    <div><div class="muted" style="font-size:13px;margin-bottom:4px">日給の人</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select id="fnD" style="width:auto">${[['same','時給の人と同じ'],['yen','金額'],['daily_pct','日給の'],['input','その都度'],['daily_late','遅刻の時間分'],['daily_early','早上がりの時間分'],['none','かからない']].map(([v,n])=>`<option value="${v}" ${dSel===v?'selected':''}>${n}</option>`).join('')}</select><span id="fnDv"><input id="fnDn" inputmode="numeric" value="${g.d&&!same?g.d.value??'':''}" style="width:100px;text-align:right"> <span id="fnDu"></span></span></div></div>
    <div class="bar">${i==null?'':'<button class="ghost" data-k="del" style="color:var(--warn);margin-right:auto">削除</button>'}<button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  const q=id=>md.querySelector('#'+id), dp=()=>{ const v=q('fnD').value; q('fnDv').style.display=['yen','daily_pct','daily_late','daily_early'].includes(v)?'':'none'; q('fnDu').textContent=v==='yen'?'円':v==='daily_pct'?'%':'＋日給の %（空けてよい）'; }; q('fnD').onchange=dp; dp();
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  const save=async list=>{ const rows=[]; for(const x of list){ const same=fineSame(x.h,x.d); if(x.h&&x.d&&same&&(x.h.calc==='yen'||x.h.calc==='input')) rows.push({name:x.name,target:'all',...x.h,per_unit:x.h.calc==='yen'}); else { if(x.h) rows.push({name:x.name,target:'hourly',...x.h,per_unit:x.h.calc==='yen'}); if(x.d) rows.push({name:x.name,target:'daily',...x.d,per_unit:x.d.calc==='yen'}); } }
    const r=await rpc('admin_save_fine_types',{p_store:st,p_rows:rows}); if(!r.ok) return false; return true; };
  const del=md.querySelector('[data-k=del]'); if(del) del.onclick=async()=>{ if(!await uiConfirm(`「${g.name}」を罰金の一覧から消しますか？\n今までに付けた罰金は消えません`,'削除','danger')) return; const L=FINES.filter((_,k)=>k!==i); if(!await save(L)) return; md.remove(); toast('削除しました'); PAGES.set_pay(); };
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{ const name=q('fnN').value.trim(); if(!name){ await uiAlert('名前を入力してください'); return; }
    if(FINES.some((x,k)=>k!==i&&x.name===name)){ await uiAlert(`「${name}」はもうあります`); return; }
    const hv=md.querySelector('input[name=fnH]:checked')?.value||'none'; let h=null;
    if(hv==='yen'){ const v=slNum(q('fnHy').value); if(!(v>0)||!Number.isInteger(v)){ await uiAlert('時給の人の金額を入力してください'); return; } h={calc:'yen',value:v}; }
    else if(hv==='hourly_pct'){ const v=slNum(q('fnHp').value); if(!(v>0)){ await uiAlert('時給の何時間分かを入力してください'); return; } h={calc:'hourly_pct',value:Math.round(v*100)}; }
    else if(hv==='input') h={calc:'input',value:null};
    const dv=q('fnD').value; let d=null;
    if(dv==='same'){ if(!h){ await uiAlert('時給の人が「かからない」の時は、日給の人を選んでください'); return; } if(h.calc==='hourly_pct'){ await uiAlert('時給の時間分は日給の人には使えません。日給の人を選んでください'); return; } d={...h}; }
    else if(dv==='yen'||dv==='daily_pct'){ const v=slNum(q('fnDn').value); if(!(v>0)||!Number.isInteger(v)){ await uiAlert(dv==='yen'?'日給の人の金額を入力してください':'日給の何%かを入力してください'); return; } d={calc:dv,value:v}; }
    else if(dv==='input') d={calc:'input',value:null};
    else if(dv==='daily_late'||dv==='daily_early'){ const v=slNum(q('fnDn').value); if(v!=null&&(!(v>0)||!Number.isInteger(v))){ await uiAlert('加算の%は1以上の整数にするか、空けてください'); return; } d={calc:dv,value:v}; }
    if(!h&&!d){ await uiAlert('時給の人か日給の人のどちらかを選んでください'); return; }
    const L=FINES.slice(); const x={name,h,d}; if(i==null) L.push(x); else L[i]=x; if(!await save(L)) return; md.remove(); toast('保存しました'); PAGES.set_pay(); }); }
function fineListWire(st,ed){ if(!ed) return; document.querySelectorAll('[data-fi]').forEach(e=>e.onclick=()=>fineEdit(st,Number(e.dataset.fi))); const a=document.querySelector('[data-fines] [data-fadd]'); if(a) a.onclick=()=>fineEdit(st,null); }
function fineRead(card){ const out=[]; let i=0, n=0; const names=new Set();
  for(const tr of card.querySelectorAll('tr[data-fr]')){ i++; const g=k=>tr.querySelector(`[data-f=${k}]`); const name=g('name').value.trim();
    const side=k=>{ const calc=g(k+'c').value; if(!calc) return {}; const vs=g(k+'v').value; let value=null, lb=k==='h'?'時給':'日給';
      if(FINE_TIME(calc)){ value=slNum(vs); if(value!=null&&(!Number.isInteger(value)||value<=0)) return {err:`${i}行目（${name}・${lb}）：加算（%）は1以上の整数にするか、空けてください`}; }
      else if(calc!=='input'){ value=slNum(vs); if(value==null||!Number.isInteger(value)||value<=0) return {err:`${i}行目（${name}・${lb}）：${calc==='yen'?'金額':'％'}を1以上の整数で入力してください`}; }
      return {c:{calc,value,per_unit:calc==='yen'&&g(k+'p').checked}}; };
    const h=side('h'), d=side('d'); if(!name&&!h.c&&!d.c) continue; if(!name) return {err:`${i}行目：名前を入力してください`};
    if(h.err) return {err:h.err}; if(d.err) return {err:d.err}; if(!h.c&&!d.c) return {err:`${i}行目（${name}）：時給か日給のどちらかの決め方を選んでください`};
    if(names.has(name)) return {err:`同じ名前の行が2つあります：${name}`}; names.add(name); n++;
    const same=h.c&&d.c&&h.c.calc===d.c.calc&&(h.c.calc==='yen'||h.c.calc==='input')&&h.c.value===d.c.value&&h.c.per_unit===d.c.per_unit;
    if(same) out.push({name,target:'all',...h.c}); else { if(h.c) out.push({name,target:'hourly',...h.c}); if(d.c) out.push({name,target:'daily',...d.c}); } }
  return {rows:out,n}; }

// v0.14・SQL 055：アフターの延長（attendance_rules。タイムカードの打刻の時に round_punch が使う）。閉店の○分前を過ぎたアフターは、閉店まで働いたことにする。閉店時間は店舗設定で決める
const closeTxt=c=>{ const m=String(c||'01:00').match(/^(\d{1,2}):(\d{2})/); return m?`${+m[1]<12?'翌':''}${+m[1]}:${m[2]}`:String(c); };
function afterCard(ax,ed){ const T='アフターの延長', h='<div class="muted" style="font-size:13px;margin-bottom:10px">アフターの打刻（退勤の代わり）で、時給を付ける時間を延ばします</div>';
  if(ax.error) return foldCard('after',T,'','',`<div class="err">${esc(/after_ext|minutes|close/.test(ax.error.message)||/find|exist|schema cache/.test(ax.error.message)?'SQL 055 が未実行です：':'読み込めません：')}${esc(ax.error.message)}</div>`);
  const a=ax.data||{}; if(a.minutes==null) return foldCard('after',T,'','','<div class="err">SQL 055 が未実行です</div>');
  const on=!!a.on, dis=ed?'':'disabled', cl=closeTxt(a.close);
  return foldCard('after',T,'',on?`する・閉店の${esc(String(a.minutes))}分前から`:'しない',`${h}<div class="row"><span class="seg" id="afOn">${[[true,'する'],[false,'しない']].map(([v,n])=>`<button data-v="${v}" class="${on===v?'on':''}" ${dis}>${n}</button>`).join('')}</span></div>
    <div class="row" style="margin-top:10px;font-size:14px">閉店（${esc(cl)}）の<input id="afM" inputmode="numeric" value="${esc(String(a.minutes))}" ${dis} style="width:80px;text-align:right">分前を過ぎたアフターは、閉店（${esc(cl)}）まで働いたことにする</div>
    <div class="muted hint" style="font-size:13px;margin-top:8px;line-height:1.6">時給の人・日給の人の両方。タイムカードで打刻した時に決まります<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">（変更しても、前の打刻はそのまま）<br>閉店時間は「POS設定」で設定します。退勤・アフターの打刻は閉店より後になりません</div></div>
    ${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" id="afSave">保存</button></div>':''}`,'data-after'); }

