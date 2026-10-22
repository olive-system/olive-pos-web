// ---------- 予約 v1.48・SQL 203（オーナー 2026-10-23「タブは シフト・予約 にして、開いたらシフトと予約に切り替え」「カレンダー表示」「同伴と予約の一覧」「ここからでも追加・表示も編集も（私以外の人も）」） ----------
// 月のカレンダーに、その日の予約と同伴。日を押すと下にその日の一覧（直す・取消）と「予約を足す」。時刻が無い予約は「未定」。権限はシフトと同じ。ここで足した・直した予約は LINE の知らせを送らない
const shSwitch=cur=>`<div class="seg" style="margin-bottom:14px">${[['shift','シフト'],['resv','予約']].map(([k,n])=>`<button data-shsw="${k}" class="${k===cur?'on':''}">${n}</button>`).join('')}</div>`;
document.addEventListener('click',async e=>{ const b=e.target.closest&&e.target.closest('[data-shsw]'); if(!b||b.dataset.shsw===page) return; if(!await leaveOk()) return; go(b.dataset.shsw); });
let rvMonth=null, rvDay=null, rvEdit=null;
PAGES.resv=async()=>{ const st=storeId, ed=perm('resv')==='edit', now=csNowMonth(); if(!rvMonth) rvMonth=now; const m=rvMonth;
  const head=shSwitch('resv')+`<h1>予約 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_resv_month',{p_store:st,p_month:m}); if(page!=='resv'||storeId!==st||rvMonth!==m) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_resv_month/.test(r.error.message)?'SQL 203 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data||{}, R=D.resv||[], S=D.staff||[], OFF=new Set(D.offs||[]), WD=['日','月','火','水','木','金','土'];
  const y=Number(m.slice(0,4)), mo=Number(m.slice(5,7)), first=new Date(y,mo-1,1).getDay(), nd=new Date(y,mo,0).getDate(), iso=d=>`${m.slice(0,8)}${String(d).padStart(2,'0')}`;
  const today=businessDate(); if(!rvDay||rvDay.slice(0,7)!==m.slice(0,7)) rvDay=today.slice(0,7)===m.slice(0,7)?today:iso(1);
  const byDay={}; R.forEach(x=>(byDay[x.day]=byDay[x.day]||[]).push(x));
  const tm=x=>x.time||'未定', mOpts=[csAddMonth(now,-1),now,csAddMonth(now,1),csAddMonth(now,2),csAddMonth(now,3)];
  let cal='<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">'+WD.map(w=>`<div class="muted" style="text-align:center;font-size:12px">${w}</div>`).join('')+'<div></div>'.repeat(first);
  for(let d=1;d<=nd;d++){ const k=iso(d), L=byDay[k]||[], dh=L.filter(x=>x.douhan).length, on=k===rvDay;
    cal+=`<div data-rvd="${k}" style="border:${on?'2px solid var(--pri)':'1px solid var(--line)'};border-radius:8px;padding:5px 6px;min-height:78px;font-size:12px;line-height:1.5;cursor:pointer;overflow:hidden;${OFF.has(k)?'background:var(--soft);color:var(--muted)':''}">
      <b style="color:var(--ink)">${d}</b>${OFF.has(k)&&!L.length?'<div style="font-size:13px">休</div>':''}
      ${L.length?`<div style="font-size:11px;white-space:nowrap">${L.length-dh?`予約${L.length-dh}`:''}${L.length-dh&&dh?'・':''}${dh?`同伴${dh}`:''}</div>`:''}
      <div style="font-size:11px;word-break:keep-all">${L.slice(0,3).map(x=>x.douhan?`<b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 3px">${esc(x.by_name||'')}</b>`:esc(x.name)).join('・')}${L.length>3?`<span class="muted">　他${L.length-3}</span>`:''}</div></div>`; }
  cal+='</div>';
  const DL=byDay[rvDay]||[], dd=new Date(rvDay+'T00:00:00+09:00');
  const opt=(id,inc0)=>(inc0?'<option value="">—</option>':'')+S.map(s=>`<option value="${s.id}" ${s.id===id?'selected':''}>${esc(s.name)}${s.kind==='hall'?'（黒服）':''}</option>`).join('');
  const form=x=>{ x=x||{}; return `<div class="card" id="rvForm" style="border:2px solid var(--pri)"><b>${x.id?'予約を直す':'予約を足す'}　${dd.getMonth()+1}/${dd.getDate()}（${WD[dd.getDay()]}）</b>
    <div class="grid2" style="margin-top:8px"><label>日付<input type="date" id="rvD" value="${esc(x.day||rvDay)}"></label><label>時刻（空なら未定）<input id="rvT" inputmode="numeric" placeholder="20:30" value="${esc(x.time||'')}"></label>
    <label>お客様<input id="rvN" maxlength="40" value="${esc(x.name||'')}"></label><label>人数<input id="rvG" inputmode="numeric" value="${esc(x.guests||1)}"></label>
    <label>誘客（同伴の人）<select id="rvB">${opt(x.by||S.find(s=>s.name==='店')?.id,false)}</select></label><label>係<select id="rvK">${opt(x.kakari,true)}</select></label>
    <label class="ck" style="align-self:end"><input type="checkbox" id="rvDh" ${x.douhan?'checked':''}>同伴</label><label>待ち合わせ（同伴の時）<input id="rvM" inputmode="numeric" placeholder="19:30" value="${esc(x.meet||'')}"></label></div>
    <label>メモ<input id="rvMm" maxlength="200" value="${esc(x.memo||'')}"></label>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:8px"><button class="ghost" id="rvNo">キャンセル</button><button class="primary" id="rvOk">保存</button></div></div>`; };
  $('main').innerHTML=head+`<div class="card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><select id="rvM0" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel?csMLabel(x):x}</option>`).join('')}</select>
      <span class="muted" style="font-size:13px">予約 ${R.filter(x=>!x.douhan).length}・同伴 ${R.filter(x=>x.douhan).length}</span><span style="flex:1"></span>
      <span style="font-size:12px;color:var(--muted)"><b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 4px">同伴</b>　名前は予約のお客様</span></div>${cal}
      <div class="muted" style="font-size:12px;margin-top:6px">日を押すと、下にその日の予約</div></div>
    <div class="card"><div class="row" style="justify-content:space-between;align-items:center"><b style="font-size:18px">${dd.getMonth()+1}/${dd.getDate()}（${WD[dd.getDay()]}）${OFF.has(rvDay)?'　<span class="muted" style="font-size:13px">休</span>':''}</b>${ed?'<button class="ghost sm" id="rvAdd">＋ 予約を足す</button>':''}</div>
      ${DL.map((x,i)=>`<div style="display:flex;gap:8px;align-items:center;border-top:1px solid var(--line);padding:8px 0;flex-wrap:wrap;font-size:14px"><b style="min-width:3em">${esc(tm(x))}</b>${x.douhan?'<b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 4px">同伴</b>':''}
        <span style="flex:1 1 200px">${esc(x.name)} 様　${x.guests?esc(x.guests)+'名':''}<span class="muted">　${x.douhan?'同伴':'誘客'} ${esc(x.by_name||'')}${x.kakari_name?'・係 '+esc(x.kakari_name):''}${x.meet?'・待ち合わせ '+esc(x.meet):''}</span>${x.memo?`<div class="muted" style="font-size:13px">${esc(x.memo)}</div>`:''}</span>
        ${ed?`<button class="ghost sm" data-rve="${i}">直す</button><button class="ghost sm" data-rvx="${i}">取消</button>`:''}</div>`).join('')||'<div class="muted" style="margin-top:6px">この日の予約はありません</div>'}</div>
    ${rvEdit?form(rvEdit.x):''}`;
  $('rvM0').onchange=()=>{ rvMonth=$('rvM0').value; rvEdit=null; PAGES.resv(); };
  $('main').querySelectorAll('[data-rvd]').forEach(c=>c.onclick=()=>{ rvDay=c.dataset.rvd; rvEdit=null; PAGES.resv(); });
  if(!ed) return;
  $('rvAdd').onclick=()=>{ rvEdit={x:null}; PAGES.resv(); };
  $('main').querySelectorAll('[data-rve]').forEach(b=>b.onclick=()=>{ rvEdit={x:DL[+b.dataset.rve]}; PAGES.resv(); });
  $('main').querySelectorAll('[data-rvx]').forEach(b=>b.onclick=guard(b,async()=>{ const x=DL[+b.dataset.rvx]; if(!await uiConfirm(`${x.name} 様の${x.douhan?'同伴':'予約'}を取り消しますか？`,'取消','danger')) return;
    const z=await rpc('admin_resv_cancel',{p_store:st,p_id:x.id}); if(!z.ok) return; toast('取り消しました'); PAGES.resv(); }));
  if(rvEdit){ const f=$('rvForm'); f.scrollIntoView({block:'nearest'}); $('rvNo').onclick=()=>{ rvEdit=null; PAGES.resv(); };
    $('rvOk').onclick=guard($('rvOk'),async()=>{ const g=Number(String($('rvG').value).replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)));
      const z=await rpc('admin_resv_save',{p_store:st,p_id:rvEdit.x?.id||null,p_day:$('rvD').value,p_time:$('rvT').value.trim(),p_name:$('rvN').value.trim(),p_guests:g,p_douhan:$('rvDh').checked,p_by:$('rvB').value,p_kakari:$('rvK').value||null,p_meet:$('rvM').value.trim(),p_memo:$('rvMm').value.trim()});
      if(!z.ok) return; rvDay=$('rvD').value; rvMonth=rvDay.slice(0,7)+'-01'; rvEdit=null; toast('保存しました'); PAGES.resv(); }); }
};
