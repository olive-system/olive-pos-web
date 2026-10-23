// ---------- 予約 v1.48・SQL 203（オーナー 2026-10-23「タブは シフト・予約 にして、開いたらシフトと予約に切り替え」「カレンダー表示」「同伴と予約の一覧」「ここからでも追加・表示も編集も（私以外の人も）」） ----------
// 月のカレンダーに、その日の予約と同伴。日を押すと下にその日の一覧（直す・取消）と「予約を足す」。時刻が無い予約は「未定」。権限はシフトと同じ。ここで足した・直した予約は LINE の知らせを送らない
const shSwitch=cur=>`<div class="seg" style="margin-bottom:14px">${[['shift','シフト'],['resv','予約']].map(([k,n])=>`<button data-shsw="${k}" class="${k===cur?'on':''}">${n}</button>`).join('')}</div>`;
document.addEventListener('click',async e=>{ const b=e.target.closest&&e.target.closest('[data-shsw]'); if(!b||b.dataset.shsw===page) return; if(!await leaveOk()) return; go(b.dataset.shsw); });
let rvMonth=null;
// v1.49：並びはシフトと同じ（オーナー 2026-10-23「シフトのように予約も上に本日置いてよ」）＝ 本日の箱 → 月のカレンダー → 日を押すと小窓（直す・取消・足す）。同伴は来店 20:30（2026-10-15 の決まり）
PAGES.resv=async()=>{ const st=storeId, ed=perm('resv')==='edit', now=csNowMonth(); if(!rvMonth) rvMonth=now; const m=rvMonth, today=businessDate();
  const head=shSwitch('resv')+`<h1>予約 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const [r,rt]=await Promise.all([sb.rpc('admin_resv_month',{p_store:st,p_month:m}), m===today.slice(0,8)+'01'?null:sb.rpc('admin_resv_month',{p_store:st,p_month:today.slice(0,8)+'01'})]);
  if(page!=='resv'||storeId!==st||rvMonth!==m) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_resv_month/.test(r.error.message)?'SQL 203 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data||{}, R=D.resv||[], S=D.staff||[], OFF=new Set(D.offs||[]), WD=['日','月','火','水','木','金','土'];
  const RT=(rt&&!rt.error?rt.data.resv:R).filter(x=>x.day===today);
  const y=Number(m.slice(0,4)), mo=Number(m.slice(5,7)), first=new Date(y,mo-1,1).getDay(), nd=new Date(y,mo,0).getDate(), iso=d=>`${m.slice(0,8)}${String(d).padStart(2,'0')}`;
  const byDay={}; R.forEach(x=>(byDay[x.day]=byDay[x.day]||[]).push(x));
  const md=d=>{ const x=new Date(d+'T00:00:00+09:00'); return `${x.getMonth()+1}/${x.getDate()}（${WD[x.getDay()]}）`; }, mOpts=[csAddMonth(now,-1),now,csAddMonth(now,1),csAddMonth(now,2),csAddMonth(now,3)];
  const row=(x,i)=>`<div style="display:flex;gap:8px;align-items:center;border-top:1px solid var(--line);padding:8px 0;flex-wrap:wrap;font-size:14px"><b style="min-width:3em">${esc(x.time||'未定')}</b>${x.douhan?'<b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 4px">同伴</b>':''}
    <span style="flex:1 1 200px">${esc(x.name)} 様　${x.guests?esc(x.guests)+'名':''}<span class="muted">　${x.douhan?'同伴':'誘客'} ${esc(x.by_name||'')}${x.kakari_name?'・係 '+esc(x.kakari_name):''}</span>${x.memo?`<div class="muted" style="font-size:13px">${esc(x.memo)}</div>`:''}</span>
    ${ed?`<button class="ghost sm" data-rve="${i}">直す</button><button class="ghost sm" data-rvx="${i}">取消</button>`:''}</div>`;
  const wireRows=(box,L,day,close)=>{ if(!ed) return;
    box.querySelectorAll('[data-rve]').forEach(b=>b.onclick=()=>{ close&&close(); resvForm(st,S,day,L[+b.dataset.rve]); });
    box.querySelectorAll('[data-rvx]').forEach(b=>b.onclick=guard(b,async()=>{ const x=L[+b.dataset.rvx]; if(!await uiConfirm(`${x.name} 様の${x.douhan?'同伴':'予約'}を取り消しますか？`,'取消','danger')) return;
      const z=await rpc('admin_resv_cancel',{p_store:st,p_id:x.id}); if(!z.ok) return; close&&close(); toast('取り消しました'); PAGES.resv(); })); };
  // 本日
  const todayCard=`<div class="card"><div class="row" style="justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap"><div><b>本日 ${md(today)}</b>　<small class="muted">予約 ${RT.filter(x=>!x.douhan).length}・同伴 ${RT.filter(x=>x.douhan).length}</small></div>${ed?'<button class="ghost sm" id="rvAddT">＋ 予約を足す</button>':''}</div>
    <div id="rvToday">${RT.map(row).join('')||'<div class="muted" style="margin-top:6px">本日の予約はありません</div>'}</div></div>`;
  // 月
  let cal='<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">'+WD.map(w=>`<div class="muted" style="text-align:center;font-size:12px">${w}</div>`).join('')+'<div></div>'.repeat(first);
  for(let d=1;d<=nd;d++){ const k=iso(d), L=byDay[k]||[], dh=L.filter(x=>x.douhan).length;
    cal+=`<div data-rvd="${k}" style="border:1px solid var(--line);border-radius:8px;padding:5px 6px;min-height:78px;font-size:12px;line-height:1.5;cursor:pointer;overflow:hidden;${OFF.has(k)?'background:var(--soft);color:var(--muted)':''}">
      <b style="color:var(--ink)">${d}</b>${OFF.has(k)&&!L.length?'<div style="font-size:13px">休</div>':''}
      ${L.length?`<div style="font-size:11px;white-space:nowrap">${L.length-dh?`予約${L.length-dh}`:''}${L.length-dh&&dh?'・':''}${dh?`同伴${dh}`:''}</div>`:''}
      <div style="font-size:11px;word-break:keep-all">${L.slice(0,3).map(x=>x.douhan?`<b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 3px">${esc(x.by_name||'')}</b>`:esc(x.name)).join('・')}${L.length>3?`<span class="muted">　他${L.length-3}</span>`:''}</div></div>`; }
  cal+='</div>';
  $('main').innerHTML=head+todayCard+`<div class="card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><select id="rvM0" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel?csMLabel(x):x}</option>`).join('')}</select>
      <span class="muted" style="font-size:13px">予約 ${R.filter(x=>!x.douhan).length}・同伴 ${R.filter(x=>x.douhan).length}</span><span style="flex:1"></span>
      <span style="font-size:12px;color:var(--muted)"><b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 4px">同伴</b>　名前は予約のお客様</span></div>${cal}
      <div class="muted" style="font-size:12px;margin-top:6px">日を押すと、その日の予約（足す・直す・取消）</div></div>`;
  wireRows($('rvToday'),RT,today,null);
  if(ed) $('rvAddT').onclick=()=>resvForm(st,S,today,null);
  $('rvM0').onchange=()=>{ rvMonth=$('rvM0').value; PAGES.resv(); };
  $('main').querySelectorAll('[data-rvd]').forEach(c=>c.onclick=()=>{ const day=c.dataset.rvd, L=byDay[day]||[];
    const box=modal(`<div class="row" style="justify-content:space-between;align-items:baseline;gap:10px"><h2 style="margin:0">${md(day)}</h2><small class="muted">${OFF.has(day)?'休　':''}予約 ${L.filter(x=>!x.douhan).length}・同伴 ${L.filter(x=>x.douhan).length}</small></div>
      ${L.map(row).join('')||'<div class="muted" style="margin-top:6px">この日の予約はありません</div>'}
      <div class="bar">${ed?'<button class="ghost" data-k="add" style="margin-right:auto">＋ 予約を足す</button>':''}<button class="primary" data-k="ok">閉じる</button></div>`);
    const close=()=>box.remove(); box.querySelector('[data-k=ok]').onclick=close; const ad=box.querySelector('[data-k=add]'); if(ad) ad.onclick=()=>{ close(); resvForm(st,S,day,null); };
    wireRows(box,L,day,close); });
};
function resvForm(st,S,day,x){ x=x||{}; const opt=(id,inc0)=>(inc0?'<option value="">—</option>':'')+S.map(s=>`<option value="${s.id}" ${s.id===id?'selected':''}>${esc(s.name)}${s.kind==='hall'?'（黒服）':''}</option>`).join('');
  const m=modal(`<h2 style="margin:0">${x.id?'予約を直す':'予約を足す'}</h2>
    <div class="grid2" style="margin-top:8px"><label>日付<input type="date" id="rvD" value="${esc(x.day||day)}"></label><label>時刻（空なら未定・同伴は 20:30）<input id="rvT" inputmode="numeric" placeholder="21:00" value="${esc(x.time||'')}"></label>
    <label>お客様<input id="rvN" maxlength="40" value="${esc(x.name||'')}"></label><label>人数<input id="rvG" inputmode="numeric" value="${esc(x.guests||1)}"></label>
    <label>誘客（同伴の人）<select id="rvB">${opt(x.by||S.find(s=>s.name==='店')?.id,false)}</select></label><label>係<select id="rvK">${opt(x.kakari,true)}</select></label></div>
    <label class="ck"><input type="checkbox" id="rvDh" ${x.douhan?'checked':''}>同伴</label>
    <label>メモ<input id="rvMm" maxlength="200" value="${esc(x.memo||'')}"></label>
    <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  m.querySelector('#rvDh').onchange=e=>{ if(e.target.checked&&!m.querySelector('#rvT').value.trim()) m.querySelector('#rvT').value='20:30'; };
  m.querySelector('[data-k=no]').onclick=()=>m.remove();
  const sv=m.querySelector('[data-k=ok]'); sv.onclick=guard(sv,async()=>{ const q=id=>m.querySelector(id); const g=Number(String(q('#rvG').value).replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)));
    const dh=q('#rvDh').checked, t=q('#rvT').value.trim()||(dh?'20:30':'');
    const z=await rpc('admin_resv_save',{p_store:st,p_id:x.id||null,p_day:q('#rvD').value,p_time:t,p_name:q('#rvN').value.trim(),p_guests:g,p_douhan:dh,p_by:q('#rvB').value,p_kakari:q('#rvK').value||null,p_meet:'',p_memo:q('#rvMm').value.trim()});
    if(!z.ok) return; m.remove(); rvMonth=q('#rvD').value.slice(0,8)+'01'; toast('保存しました'); PAGES.resv(); });
}
