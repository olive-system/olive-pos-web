// ---------- 報酬・罰金項目（スライド表。店舗で全員同じ）----------
// キャストの時給＝小計（またはポイント）スライド・同伴スライド・保証時給のうち一番高いもの（POS と同じ）。黒服のボーナス総額＝人件費比率のボーナス＋売上ボーナス
const SLIDE_DEF={
  sales:{t:'小計スライド',sub:''+KL+'小計で時給が決まる',cols:[{k:'threshold',l:''+KL+'小計（万円以上）',sc:10000},{k:'wage',l:'時給（円）'}]},
  points:{t:'ポイントスライド',sub:'ポイントで時給が決まる',cols:[{k:'threshold',l:'ポイント（以上）'},{k:'wage',l:'時給（円）'}]},
  douhan:{t:'同伴スライド',sub:'月の同伴回数で時給が決まる',cols:[{k:'threshold',l:'同伴（回以上）'},{k:'wage',l:'時給（円）'}]},
  hall:{t:'黒服ボーナススライド',sub:'',cols:[{k:'sales_man',l:'売上（万円以上）'},{k:'target_ratio',l:'目標比率（%）',sc:0.01},{k:'b_within',l:'以内'},{k:'b_plus2',l:'＋2%まで'},{k:'b_plus5',l:'＋5%まで'},{k:'b_over',l:'5%超'},{k:'b_sales',l:'売上ボーナス'}]},
};
const slNum=v=>{ const t=toHan(v).replace(/[,，\s]/g,''); return t===''?null:Number(t); };
const slShow=(v,sc)=>v==null?'':String(Math.round(Number(v)/(sc||1)*10000)/10000);
// 報酬・罰金項目の箱は、タイトルだけ並べて押すと開く（payOpen：開いている箱。保存して描き直しても開いたまま）
const payOpen=new Set();
const foldCard=(key,title,extra,sum,body,attr='')=>`<div class="card fold${payOpen.has(key)?' open':''}" data-fold="${esc(key)}" ${attr}><div class="fh"><span class="ar">▸</span><b>${title}</b>${extra||''}<span class="sm2">${sum||''}</span></div><div class="fb">${body}</div></div>`;
const foldWire=root=>root.querySelectorAll('.fold>.fh').forEach(h=>{ if(h.dataset.w) return; h.dataset.w=1; h.onclick=()=>{ const f=h.parentElement, k=f.dataset.fold; f.classList.toggle('open'); f.classList.contains('open')?payOpen.add(k):payOpen.delete(k); }; });
function slideCard(kind,rows,ed,note){ const d=SLIDE_DEF[kind];
  const body=rows.map((r,i)=>`<tr data-i="${i}">${d.cols.map(c=>`<td><input inputmode="decimal" data-c="${c.k}" value="${esc(slShow(r[c.k],c.sc))}" ${ed?'':'disabled'}></td>`).join('')}${ed?`<td class="x"><button class="xb" data-del="${i}" aria-label="行を削除">×</button></td>`:''}</tr>`).join('');
  return foldCard('sl:'+kind,d.t,'',`${rows.length}行`,`${note||''}
    <div class="slw"><table class="sl"><tr>${d.cols.map(c=>`<th>${c.l}</th>`).join('')}${ed?'<th></th>':''}</tr>${body||`<tr><td colspan="${d.cols.length}" class="muted" style="padding:8px 4px">まだ入っていません</td></tr>`}</table></div>
    ${ed?`<div class="fend"><button class="ghost sm" data-add>＋ 行を追加</button><span class="sp"></span><button class="primary sm" data-save>保存</button></div>`:''}`,`data-sl="${kind}"`); }
function slideRead(card,kind){ const d=SLIDE_DEF[kind]; const out=[];
  for(const tr of card.querySelectorAll('tr[data-i]')){ const r={}; let empty=true;
    for(const c of d.cols){ const v=slNum(tr.querySelector(`[data-c="${c.k}"]`).value); if(v!=null) empty=false; if(v!=null&&!Number.isFinite(v)) return {err:`「${c.l}」に数字でないものがあります`}; r[c.k]=v==null?null:Math.round(v*(c.sc||1)*10000)/10000; }
    if(empty) continue; if(r[d.cols[0].k]==null||r[d.cols[1].k]==null) return {err:`「${d.cols[0].l}」と「${d.cols[1].l}」は必ず入力してください`}; out.push(r); }
  const k0=d.cols[0].k; out.sort((a,b)=>a[k0]-b[k0]); for(let i=1;i<out.length;i++) if(out[i][k0]===out[i-1][k0]) return {err:`「${d.cols[0].l}」が同じ行が2つあります`};
  return {rows:out}; }
// スライド表（店ごとにいくつでも）。何で決まるか（係小計・ポイント・同伴数・稼働日数）と時給／日給を表ごとに決める。キャストごとに使う表は「キャスト設定」で選ぶ
// 反応数（反応◎の回数）・組数（係の伝票の数）・人数（係の伝票の客数の合計）を追加。何で決まるかは作る時だけ選べて、作ったあとは変えられない
const ST_BASIS=[['sales',''+KL+'小計',''+KL+'小計（万円以上）',10000],['points','ポイント','ポイント（以上）',1],['douhan','同伴数','同伴（回以上）',1],['days','稼働日数','稼働日数（日以上）',1],['reactions','反応数','反応◎（回以上）',1],['groups','組数',''+KL+'の組数（組以上）',1],['guests','人数',''+KL+'の人数（名以上）',1]];
const stB=k=>ST_BASIS.find(x=>x[0]===k)||ST_BASIS[0];
const SL_COLS=()=>matchMedia('(max-width:640px)').matches?1:3;
const srHtml=(th,am,ed)=>`<div class="sr" data-i><input inputmode="decimal" data-c="th" value="${esc(th)}" ${ed?'':'disabled'}><input inputmode="numeric" data-c="am" value="${esc(am)}" ${ed?'':'disabled'}>${ed?'<button class="xb" data-del aria-label="行を削除">×</button>':'<span></span>'}</div>`;
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
function stSection(tbls,rows,terms,ed,act){ const cur=csNowMonth(), by={}, fut={};
  terms.forEach(x=>{ if(x.month<=cur&&(x.month===cur||!x.only_month)){ const p=by[x.staff_id]; if(!p||x.month>p.month) by[x.staff_id]=x; } else if(x.month>cur) (fut[x.staff_id]=fut[x.staff_id]||[]).push(x); });
  /* （点検 C7）：在籍キャストの今月以降の条件で数える（前は退店した人・前の月の条件も数え、0人なのに時給／日給を変更できなかった） */
  const ids=act||[...new Set([...Object.keys(by),...Object.keys(fut)])];
  const users=id=>ids.filter(sid=>(by[sid]?.slide_ids||[]).includes(id)||(fut[sid]||[]).some(x=>(x.slide_ids||[]).includes(id))).length;
  return `<div id="stGrid">${tbls.map(t=>stCard(t,rows.filter(r=>r.table_id===t.id),users(t.id),ed)).join('')||'<div class="card muted">スライド表がありません</div>'}</div>
    <div class="row" style="margin:2px 0 10px">${ed?'<button class="ghost sm" id="stAdd">＋ スライド表を追加</button>':''}<div class="muted hint" style="font-size:13px;line-height:1.6">キャストごとに使う表は「スタッフ設定」で選びます<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">その人が選んだ表と保証時給のうち、一番高い金額になります<br>時給の人は時給の表、日給の人は日給の表だけ選べます<br>表の行は「○○以上 → 金額」。今月の数字が、その行の数字以上になっている行のうち一番下の行を使います</div></div></div>`; }
function stWire(st){ const grid=$('stGrid'); if(!grid) return;
  const wire=card=>stWireCard(st,card);
  grid.querySelectorAll('[data-st]').forEach(wire);
  const ad=$('stAdd'); if(ad) ad.onclick=()=>{ if(grid.querySelector('[data-st=""]')){ grid.querySelector('[data-st=""] [data-k=name]').focus(); return; } grid.querySelector(':scope > .card.muted')?.remove(); grid.insertAdjacentHTML('beforeend',stCard({},[],0,true)); const c=grid.querySelector('[data-st=""]'); c.classList.add('open'); foldWire(grid); wire(c); c.querySelector('[data-k=name]').focus(); }; }
/* スライド表の1枚（単位・行の追加と削除・保存・表の削除） */
function stWireCard(st,card){
  const q=k=>card.querySelector(`[data-k=${k}]`); let unit=card.querySelector('[data-k=unit] button.on')?.dataset.v||'hourly';
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
      const r=await rpc('admin_delete_slide_table',{p_id:card.dataset.st}); if(!r.ok) return; toast('削除しました'); PAGES.set_pay(); });
}
