// v2.10・SQL 364：棚卸し（オーナーのみ）。AB棚の品の追加・理論在庫の修正・× で外す・棚卸しの記録（オーナー 2026-11-05「AB棚のボトルを編集したり追加できるようにしたい、削除したり」「上下いらん。ボトルキープもいらん。2列」「削除じゃなくて×マーク」・見本 作業場/棚卸し_案2_AB棚の品.png）
// 理論在庫＝修正した本数＋その後の仕入れ（開店作業）−販売（POS の伝票・取消は除く）。棚卸しでは変わらない（差は修正するまで毎回出る）
PAGES.o_stock=async()=>{ const st=storeId, head=psHead('o_stock'); /* v2.13：集計「商品集計」のタブ */
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_ab_get',{p_store:st}); if(page!=='o_stock'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_ab_get/.test(r.error.message)?'SQL 364 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data, I=D.items||[], S=D.stock||[], M=D.menu||[], C=D.counts||[], cats=[...new Set(M.map(m=>m.cat))], all=[...I,...S.flatMap(g=>g.items||[])];
  const hm=x=>new Date(x).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false});
  const cell=(x,rm=true)=>`<div style="display:flex;align-items:center;gap:6px;padding:8px 0;border-top:1px solid var(--line)"><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name)}</span><input data-abq="${x.id}" inputmode="numeric" maxlength="3" value="${x.theory??''}" style="width:48px;text-align:right"><span class="muted">本</span>${rm?`<button class="xb" data-abx="${x.id}" aria-label="削除">×</button>`:''}</div>`;
  /* v2.12・SQL 367：ワイン・シャンパンも理論在庫を修正できる（品はメニューから。価格だけの品は出ない。まだ数えていない品は空欄） */
  const grid=L=>`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:20px">${L.join('')}</div>`;
  const th=['品','前回','仕入れ','販売','理論在庫','実在庫','差'];
  const rec=c=>{ const R=c.rows||[], dv=x=>x.actual-x.theory, X=R.filter(x=>dv(x)!==0);
    return `<div style="padding:10px 0;border-top:1px solid var(--line)"><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><b>${mdW(c.day)}</b><span class="muted">${esc(c.by||'')} ${hm(c.at)}${c.prev?`　前回 ${mdW(c.prev)}`:''}</span></div>
      ${X.length?`<div style="color:var(--warn);font-weight:700;margin:4px 0">差あり ${X.length}品</div><div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:14px"><tr>${th.map((h,i)=>`<th style="font-weight:400;color:var(--muted);padding:5px 8px;border-bottom:1px solid var(--line);text-align:${i?'right':'left'};white-space:nowrap">${h}</th>`).join('')}</tr>
        ${X.map(x=>`<tr style="color:var(--warn);font-weight:700">${[esc(x.name),x.prev,x.shiire,x.sales,x.theory,x.actual,(dv(x)>0?'+':'−')+Math.abs(dv(x))].map((v,i)=>`<td style="padding:6px 8px;border-bottom:1px solid var(--line);${i?'text-align:right;font-variant-numeric:tabular-nums':''}">${v}</td>`).join('')}</tr>`).join('')}</table></div>`:''}
      <div class="muted" style="font-size:13px;margin-top:4px">差なし ${R.length-X.length}品</div></div>`; };
  $('main').innerHTML=head+`<div class="card"><b>AB棚の品</b><div class="muted" style="font-size:13px;margin:4px 0 8px">TODO の「AB棚」に出ます。理論在庫はオーナーのみ修正できます。削除してもメニューには残ります</div>
    ${I.length?grid(I.map(x=>cell(x))):'<div class="muted">まだありません</div>'}
    <div class="row" style="gap:8px;border-top:1px solid var(--line);padding-top:10px;margin-top:4px"><select id="abSel" style="flex:1;min-width:0"><option value="">メニューから選択</option>${cats.map(c=>`<optgroup label="${esc(c)}">${M.filter(m=>m.cat===c).map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</optgroup>`).join('')}<option value="free">品名入力</option></select><button class="ghost" id="abAdd">追加</button></div>
    <input id="abName" maxlength="60" placeholder="品名" style="display:none;width:100%;margin-top:8px">
    <div class="muted" style="font-size:13px;margin-top:6px">メニューに無い品は「品名入力」を選ぶと、メニューに 9,990,000円で登録して追加します</div></div>
    ${S.map(g=>`<div class="card"><b>${esc(g.title)}</b><div class="muted" style="font-size:13px;margin:4px 0 8px">メニューの${esc(g.title)}です（価格だけの品は対象外）。空欄はまだ数えていない品です</div>${grid((g.items||[]).map(x=>cell(x,false)))}</div>`).join('')}
    <div class="card"><b>棚卸しの記録</b>${C.length?C.map(rec).join(''):'<div class="muted" style="margin-top:6px">まだありません</div>'}</div>`;
  const again=()=>PAGES.o_stock();
  $('abSel').onchange=()=>{ $('abName').style.display=$('abSel').value==='free'?'block':'none'; };
  $('abAdd').onclick=guard($('abAdd'),async()=>{ const v=$('abSel').value; if(!v){ await uiAlert('品を選択してください'); return; }
    const nm=v==='free'?$('abName').value.trim():null; if(v==='free'&&!nm){ await uiAlert('品名を入力してください'); return; }
    const q=await rpc('admin_ab_add',{p_store:st,p_product:v==='free'?null:v,p_name:nm}); if(!q.ok) return; toast('追加しました'); again(); });
  $('main').querySelectorAll('[data-abq]').forEach(b=>b.onchange=async()=>{ const x=all.find(i=>i.id===b.dataset.abq), v=b.value.trim();
    if(!/^\d{1,3}$/.test(v)){ await uiAlert('本数を確認してください'); b.value=x.theory??''; return; }
    const q=await rpc('admin_ab_set',{p_store:st,p_product:x.id,p_qty:+v}); if(!q.ok){ b.value=x.theory??''; return; } toast('保存しました'); again(); });
  $('main').querySelectorAll('[data-abx]').forEach(b=>b.onclick=guard(b,async()=>{ const x=I.find(i=>i.id===b.dataset.abx);
    if(!await uiConfirm(`「${x.name}」をAB棚から削除しますか？\nメニューには残ります`,'削除','danger')) return;
    const q=await rpc('admin_ab_remove',{p_store:st,p_product:x.id}); if(!q.ok) return; toast('削除しました'); again(); }));
};
