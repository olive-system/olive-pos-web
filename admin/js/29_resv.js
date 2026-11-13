// ---------- 予約（オーナー「タブは シフト・予約 にして、開いたらシフトと予約に切り替え」「カレンダー表示」「同伴と予約の一覧」「ここからでも追加・表示も編集も（私以外の人も）」） ----------
// 月のカレンダーに、その日の予約と同伴。日を押すと下にその日の一覧（直す・取消）と「予約を足す」。時刻が無い予約は「未定」。権限はシフトと同じ。ここで足した・直した予約は LINE の知らせを送らない
const shSwitch=cur=>`<div class="seg" style="margin-bottom:14px">${[['shift','シフト'],['resv','予約']].map(([k,n])=>`<button data-shsw="${k}" class="${k===cur?'on':''}">${n}</button>`).join('')}</div>`;
document.addEventListener('click',async e=>{ const b=e.target.closest&&e.target.closest('[data-shsw]'); if(!b||b.dataset.shsw===page) return; if(!await leaveOk()) return; go(b.dataset.shsw); });
// 広島はお店のお客様で、女の子に担当は無い（担当は誘客した子を報酬に付ける印だけ）→ 担当を出さず、誘客がキャストならその子を担当に入れる（マイページ v0.86 と同じ。 オーナー）
const rvNoKK=()=>curStore()?.code==='hiroshima';
let rvMonth=null, rvRooms=[]; // VIPルーム（POS の卓の名前に VIP）
// 並びはシフトと同じ（オーナー「シフトのように予約も上に本日置いてよ」）＝ 本日の箱 → 月のカレンダー → 日を押すと小窓（直す・取消・足す）。同伴は来店 20:30（2026-10-15 の決まり）
PAGES.resv=async()=>{ const st=storeId, ed=perm('resv')==='edit', now=csNowMonth(); if(!rvMonth) rvMonth=now; const m=rvMonth, today=businessDate();
  const head=shSwitch('resv')+`<h1>予約 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const [r,rt]=await Promise.all([sb.rpc('admin_resv_month',{p_store:st,p_month:m}), m===today.slice(0,8)+'01'?null:sb.rpc('admin_resv_month',{p_store:st,p_month:today.slice(0,8)+'01'})]);
  if(page!=='resv'||storeId!==st||rvMonth!==m) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_resv_month/.test(r.error.message)?'SQL 203 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data||{}, R=D.resv||[], S=D.staff||[], OFF=new Set(D.offs||[]); rvRooms=D.rooms||[];
  const RT=(rt&&!rt.error?rt.data.resv:R).filter(x=>x.day===today);
  const y=Number(m.slice(0,4)), mo=Number(m.slice(5,7)), first=new Date(y,mo-1,1).getDay(), nd=new Date(y,mo,0).getDate(), iso=d=>`${m.slice(0,8)}${String(d).padStart(2,'0')}`;
  const byDay={}; R.forEach(x=>(byDay[x.day]=byDay[x.day]||[]).push(x));
  const mOpts=[csAddMonth(now,-1),now,csAddMonth(now,1),csAddMonth(now,2),csAddMonth(now,3)];
    // VIPルームのしるしと、同伴の子（お客様の人数まで）
  const dhN=x=>(x.dh_names&&x.dh_names.length?x.dh_names:[x.by_name||'']);
  const row=(x,i)=>rvDayRow(x,i,ed,dhN);
  const wireRows=(box,L,day,close)=>rvWireRows(box,L,day,close,ed,st,S);
  // 本日
  const todayCard=rvTodayCard(today,RT,ed,row);
  // 月
  const cal=rvCal(nd,first,iso,byDay,OFF);
  $('main').innerHTML=head+todayCard+rvMonthCard(m,mOpts,R,cal);
  wireRows($('rvToday'),RT,today,null);
  if(ed) $('rvAddT').onclick=()=>resvForm(st,S,today,null);
  $('rvM0').onchange=()=>{ rvMonth=$('rvM0').value; PAGES.resv(); };
  $('main').querySelectorAll('[data-rvd]').forEach(c=>c.onclick=()=>rvDayOpen(c.dataset.rvd,byDay,OFF,row,wireRows,ed,st,S));
};
// 予約の1行（時刻・同伴・VIP・お客様・誘客と係・メモ・直す／取消）
const rvDayRow=(x,i,ed,dhN)=>`<div style="display:flex;gap:8px;align-items:center;border-top:1px solid var(--line);padding:8px 0;flex-wrap:wrap;font-size:14px"><b style="min-width:3em">${esc(x.time||'未定')}</b>${x.douhan?'<b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 4px">同伴</b>':''}${x.vip?`<b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 4px">${esc(x.vip)}</b>`:''}
    <span style="flex:1 1 200px">${esc(x.name)} 様　${x.guests?esc(x.guests)+'名':''}<span class="muted">　${resvWho({douhan:x.douhan,dh:dhN(x),by:x.by_name,kakari:x.kakari_name,black:x.black},{noKK:rvNoKK(),mark:FX('dress',15)})}</span>${x.memo?`<div class="muted" style="font-size:13px">${esc(x.memo)}</div>`:''}</span>
    ${ed?`<button class="ghost sm" data-rve="${i}">修正</button><button class="ghost sm" data-rvx="${i}">取消</button>`:''}</div>`;
// 1行の［修正］［取消］
const rvWireRows=(box,L,day,close,ed,st,S)=>{ if(!ed) return;
    box.querySelectorAll('[data-rve]').forEach(b=>b.onclick=()=>{ close&&close(); resvForm(st,S,day,L[+b.dataset.rve]); });
    box.querySelectorAll('[data-rvx]').forEach(b=>b.onclick=guard(b,async()=>{ const x=L[+b.dataset.rvx]; if(!await uiConfirm(`${x.name} 様の${x.douhan?'同伴':'予約'}を取り消しますか？`,'取消','danger')) return;
      const z=await rpc('admin_resv_cancel',{p_store:st,p_id:x.id}); if(!z.ok) return; close&&close(); toast('取り消しました'); PAGES.resv(); })); };
// 本日の箱
const rvTodayCard=(today,RT,ed,row)=>`<div class="card"><div class="row" style="justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap"><div><b>本日 ${mdW(today)}</b>　<small class="muted">予約 ${RT.filter(x=>!x.douhan).length}・同伴 ${RT.filter(x=>x.douhan).length}</small></div>${ed?'<button class="ghost sm" id="rvAddT">＋ 予約を追加</button>':''}</div>
    <div id="rvToday">${RT.map(row).join('')||'<div class="muted" style="margin-top:6px">本日の予約はありません</div>'}</div></div>`;
// 月のカレンダー
function rvCal(nd,first,iso,byDay,OFF){
  let cal='<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">'+WD.map(w=>`<div class="muted" style="text-align:center;font-size:12px">${w}</div>`).join('')+'<div></div>'.repeat(first);
  for(let d=1;d<=nd;d++){ const k=iso(d), L=byDay[k]||[], dh=L.filter(x=>x.douhan).length;
    cal+=`<div data-rvd="${k}" style="border:1px solid var(--line);border-radius:8px;padding:5px 6px;min-height:78px;font-size:12px;line-height:1.5;cursor:pointer;overflow:hidden;${OFF.has(k)?'background:var(--soft);color:var(--muted)':''}">
      <b style="color:var(--ink)">${d}</b>${OFF.has(k)&&!L.length?'<div style="font-size:13px">休</div>':''}
      ${L.length?`<div style="font-size:11px;white-space:nowrap">${L.length-dh?`予約${L.length-dh}`:''}${L.length-dh&&dh?'・':''}${dh?`同伴${dh}`:''}</div>`:''}
      <div style="font-size:11px;word-break:keep-all">${L.slice(0,3).map(x=>x.douhan?`<b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 3px">${esc(x.by_name||'')}</b>`:esc(x.name)).join('・')}${L.length>3?`<span class="muted">　他${L.length-3}</span>`:''}</div></div>`; }
  cal+='</div>';
  return cal;
}
// 月の箱（月を選ぶ・数・カレンダー）
const rvMonthCard=(m,mOpts,R,cal)=>`<div class="card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><select id="rvM0" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel?csMLabel(x):x}</option>`).join('')}</select>
      <span class="muted" style="font-size:13px">予約 ${R.filter(x=>!x.douhan).length}・同伴 ${R.filter(x=>x.douhan).length}</span><span style="flex:1"></span>
      <span style="font-size:12px;color:var(--muted)"><b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 4px">同伴</b>　名前は予約のお客様</span></div>${cal}
      <div class="muted" style="font-size:12px;margin-top:6px">タップで詳細表示</div></div>`;
// 日を押した時の小窓（その日の一覧・直す・取消・足す）
function rvDayOpen(day,byDay,OFF,row,wireRows,ed,st,S){ const L=byDay[day]||[];
    const box=mkModal(null,`<button class="xb dx" data-k="ok" aria-label="閉じる">×</button><div class="row" style="justify-content:space-between;align-items:baseline;gap:10px"><h2 style="margin:0">${mdW(day)}</h2><small class="muted">${OFF.has(day)?'休　':''}予約 ${L.filter(x=>!x.douhan).length}・同伴 ${L.filter(x=>x.douhan).length}</small></div>
      ${L.map(row).join('')||'<div class="muted" style="margin-top:6px">この日の予約はありません</div>'}
      ${ed?'<div class="bar"><button class="ghost" data-k="add" style="margin-right:auto">＋ 予約を追加</button></div>':''}`);
    const close=()=>box.remove(); box.querySelector('[data-k=ok]').onclick=close; const ad=box.querySelector('[data-k=add]'); if(ad) ad.onclick=()=>{ close(); resvForm(st,S,day,null); };
    wireRows(box,L,day,close);
}
/* 予約の小窓の中身（日付・時刻・お客様・誘客・同伴・VIPルーム・メモ） */
function resvFormHtml(S,day,x,opt){ return `<h2 style="margin:0">${x.id?'予約修正':'予約追加'}</h2>
    <div class="grid2" style="margin-top:8px"><label>日付<input type="date" id="rvD" value="${esc(x.day||day)}"></label><label>時刻（空なら未定・同伴は 20:30）<input id="rvT" inputmode="numeric" placeholder="21:00" value="${esc(x.time||'')}"></label>
    <label>お客様<input id="rvN" maxlength="40" value="${esc(x.name||'')}"></label><label>人数<input id="rvG" inputmode="numeric" value="${esc(x.guests||1)}"></label>
    <label>誘客<select id="rvB">${opt(x.by||S.find(s=>s.name==='店')?.id,false)}</select></label>${rvNoKK()?'':`<label>${KL}<select id="rvK">${opt(x.kakari,true)}</select></label>`}</div>
    <div class="row" style="gap:16px;align-items:center;flex-wrap:wrap"><label class="ck"><input type="checkbox" id="rvDh" ${x.douhan?'checked':''}>同伴</label>${rvRooms.length?`<label style="flex:1;min-width:160px">VIPルーム<select id="rvV"><option value="">なし</option>${rvRooms.map(v=>`<option value="${v.id}" ${v.id===x.vip_id?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label>`:''}</div>
    <div id="rvDhW" class="${x.douhan?'':'hide'}"><div class="muted" style="font-size:13px">同伴（人数まで）</div><div style="display:flex;flex-wrap:wrap;gap:4px 14px">${S.filter(s=>s.kind==='cast').map(s=>`<label class="ck"><input type="checkbox" data-dhc="${s.id}" ${(x.dh||[]).includes(s.id)?'checked':''}>${esc(s.name)}</label>`).join('')}</div></div>
    <label>メモ<input id="rvMm" maxlength="200" value="${esc(x.memo||'')}"></label>
    <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`; }
function resvForm(st,S,day,x){ x=x||{}; const opt=(id,inc0)=>(inc0?'<option value="">—</option>':'')+S.map(s=>`<option value="${s.id}" ${s.id===id?'selected':''}>${esc(s.name)}${s.kind==='hall'?'（黒服）':''}</option>`).join('');
  const m=mkModal(null,resvFormHtml(S,day,x,opt));;
  // 同伴にした時、同伴の子が空なら誘客を入れる
  const dhSync=()=>{ const on=m.querySelector('#rvDh').checked; m.querySelector('#rvDhW').classList.toggle('hide',!on); const C=[...m.querySelectorAll('[data-dhc]')]; if(on&&!C.some(c=>c.checked)){ const b=C.find(c=>c.dataset.dhc===m.querySelector('#rvB').value); if(b) b.checked=true; } };
  m.querySelector('#rvDh').onchange=e=>{ if(e.target.checked&&!m.querySelector('#rvT').value.trim()) m.querySelector('#rvT').value='20:30'; dhSync(); };
  m.querySelector('[data-k=no]').onclick=()=>m.remove();
  const sv=m.querySelector('[data-k=ok]'); sv.onclick=guard(sv,async()=>{ const q=id=>m.querySelector(id); const g=Number(toHan(q('#rvG').value));
    const dh=q('#rvDh').checked, t=q('#rvT').value.trim()||(dh?'20:30':'');
    const z=await rpc('admin_resv_save',{p_store:st,p_id:x.id||null,p_day:q('#rvD').value,p_time:t,p_name:q('#rvN').value.trim(),p_guests:g,p_douhan:dh,p_by:q('#rvB').value,p_kakari:rvNoKK()?(S.find(s=>s.id===q('#rvB').value)?.kind==='cast'?q('#rvB').value:null):q('#rvK').value||null,p_meet:x.meet||'' /* 待ち合わせの時刻は小窓に無いので、今の値を送る（前は空にして消えていた。点検） */,p_memo:q('#rvMm').value.trim(),
      p_vip:q('#rvV')?.value||null,p_dh:dh?[...m.querySelectorAll('[data-dhc]:checked')].map(c=>c.dataset.dhc):null});
    if(!z.ok) return; m.remove(); rvMonth=q('#rvD').value.slice(0,8)+'01'; toast('保存しました'); PAGES.resv(); });
}
