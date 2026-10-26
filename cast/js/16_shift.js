// v0.22・SQL 122：⑧シフト（オーナーにヒアリングして決めた形 2026-10-16）。毎月10日までに来月の「出勤できない日」を提出（1日5人まで先着・10日を過ぎたら変更できない）
// v0.30：ホームのシフトは成績の横（オーナー 2026-10-16）
// v0.29：シフトの変更は申請の仕組みを作らず公式 LINE で黒服に（オーナー 2026-10-16）。ホームの「申請（変更）」は外して、シフトの画面に「シフト変更（メッセージにてご相談ください）」。押すとお店のトークに戻る
// v0.28：シフトのカレンダーは左揃え（オーナー 2026-10-16）
// v0.27：確定のカレンダーは時刻を出さず「予約1」「係予約2」の件数だけ（時刻は日を押すと出る。オーナー 2026-10-16）
// v0.26・SQL 128：お店の休みの日は「休」（押せない）
// v0.25・SQL 127：スタッフ設定で「出勤できる日のみ：可」の子は、逆に「出勤できる日」を提出（○。5人の上限なし）
//   確定したシフトはカレンダーで、出勤時刻と同伴・予約・係予約（自分が係のお客様の予約）。日を押すと詳細
let SHIFT = null;
const calGrid = (month, cell) => { const m = new Date(month+'T00:00:00+09:00'), y = m.getFullYear(), mo = m.getMonth(), first = new Date(y, mo, 1).getDay(), n = new Date(y, mo + 1, 0).getDate();
  let h = '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">' + WD.map(w => `<div class="muted" style="text-align:left;padding-left:5px;font-size:11px">${w}</div>`).join('');
  for(let i = 0; i < first; i++) h += '<div></div>';
  for(let d = 1; d <= n; d++) h += cell(`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, d);
  return h + '</div>'; };
async function shiftHome(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_shift_info', { p_token: TOKEN }); if(r.error){ fail(r.error.message); return; }
  SHIFT = r.data; shiftPaint(new Set(((SHIFT.ok_only ? SHIFT.ok : SHIFT.ng) || []).filter(d => !(SHIFT.off || []).includes(d))));
}
function shiftPaint(ng){
  const S = SHIFT, OFF = new Set(S.off || []), OK = !!S.ok_only, full = new Set(OK ? [] : S.full || []), mo = Number(String(S.month).slice(5,7)), dueD = mdDay(S.due);
  const box = 'border:1px solid var(--line);border-radius:6px;text-align:left;padding:5px 4px;font-size:13px;line-height:1.25;min-height:44px';
  const fixed = (S.fixed || []).map(F => { const D = {}; (F.days||[]).forEach(x => D[x.day] = x.time); const M = {}; (F.marks||[]).forEach(x => (M[x.day] = M[x.day] || []).push(x));
    return `<div class="card"><div class="gh">${Number(String(F.month).slice(5,7))}月の出勤（確定）${(F.days||[]).length}日</div>${calGrid(F.month, (iso, d) => { const t = D[iso], k = M[iso];
      return `<div data-sd="${iso}" style="${box};cursor:pointer;${t?'background:var(--gold-soft);font-weight:700':''}">${d}${t?`<small style="display:block;font-size:10px;color:var(--pri)">${t}</small>`:OFF.has(iso)?'<small style="display:block;font-size:10px;color:var(--muted);font-weight:400">休</small>':(k?'<small style="display:block;font-size:10px;color:var(--muted);font-weight:400;white-space:nowrap">出勤なし</small>':'')}${['同伴','予約','係予約'].map(n => { const c = (k||[]).filter(x => x.kind === n).length; return c ? `<small style="display:block;font-size:10px;color:var(--ok);font-weight:400;white-space:nowrap">${n.replace('係', KL)}${c}</small>` : ''; }).join('')}</div>`; })}</div>`; }).join('');
  show(`<div style="display:flex;justify-content:flex-end;margin-bottom:-28px"><button class="lkb" id="shAtt">打刻一覧</button></div><div class="ttl">シフト</div>${fixed}
    <div class="card"><div class="sm" style="font-weight:700;margin-bottom:8px">${mo}月分${OK?'出勤希望':'休み希望'}　提出期限 ${dueD}</div>
    ${calGrid(S.month, (iso, d) => { const on = ng.has(iso), of = OFF.has(iso), fu = (full.has(iso) && !on) || of;
      return `<div ${S.closed||fu?'':`data-ng="${iso}"`} style="${box};${S.closed||fu?'':'cursor:pointer;'}${on?'background:var(--soft)':''}${fu?';color:var(--muted);background:var(--bg)':''}">${d}${on?(OK?'<small style="display:block;color:var(--ok);font-size:12px">○</small>':'<small style="display:block;color:var(--warn);font-size:12px">×</small>'):fu?`<small style="display:block;font-size:10px">${of?'休':'満'}</small>`:''}</div>`; })}
    <div class="muted sm" style="margin-top:6px">${OK?'○ 出勤できる日':'× 出勤できない日（1日5人まで）・満 5人に達した日'}${OFF.size?'・休 お店の休み':''}</div>
    ${S.closed?'<div class="sm" style="margin-top:6px">提出期限を過ぎました。変更は黒服にご連絡ください</div>':''}</div>
    ${S.closed?'':`<button class="btn" id="shGo">${S.submitted?'再提出':'提出'}</button>`}<button class="btn g" id="shChg" style="margin-top:10px">シフト変更（メッセージにてご相談ください）</button>`);
  $('main').querySelectorAll('[data-ng]').forEach(b => b.onclick = () => { const k = b.dataset.ng; ng.has(k) ? ng.delete(k) : ng.add(k); const y = window.scrollY; shiftPaint(ng); window.scrollTo(0, y); });
  $('main').querySelectorAll('[data-sd]').forEach(b => b.onclick = () => shiftDay(b.dataset.sd));
  $('shAtt').onclick = () => attend(null); /* v0.42：打刻一覧はシフトの中から（オーナー 2026-10-18） */
  $('shChg').onclick = async () => { try{ if(liff.isInClient()){ liff.closeWindow(); return; } }catch(e){} await uiAlert('公式 LINE のトークからご連絡ください'); }; // v0.29：お店のトークに戻る
  if($('shGo')) $('shGo').onclick = async () => {
    const days = [...ng].sort();
    if(!await uiConfirm(`${mo}月の${OK?'出勤できる日':'出勤できない日'} ${days.length}日を提出しますか？${days.length?'\n'+days.map(mdDay).join('、'):''}`)) return;
    $('shGo').disabled = true;
    const q = await sb.rpc(OK ? 'cast_shift_ok_submit' : 'cast_shift_ng_submit', { p_token: TOKEN, p_days: days });
    if(q.error){ $('shGo').disabled = false; await uiAlert(q.error.message); shiftHome(); return; }
    SHIFT = q.data; await uiAlert('提出しました'); shiftPaint(new Set(((SHIFT.ok_only ? SHIFT.ok : SHIFT.ng) || []).filter(d => !(SHIFT.off || []).includes(d))));
  };
}
async function shiftDay(iso){
  const F = (SHIFT.fixed || []).find(f => iso >= f.month && iso.slice(0,7) === String(f.month).slice(0,7)); if(!F) return;
  const t = (F.days||[]).find(x => x.day === iso), k = (F.marks||[]).filter(x => x.day === iso), d = new Date(iso+'T00:00:00+09:00');
  await uiAlert(`${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）\n${t?`出勤 ${t.time}`:'出勤なし'}${k.length?'\n'+k.map(x => `${String(x.kind).replace('係', KL)}　${x.time}　${x.name} 様 ${x.guests}名`).join('\n'):''}`);
}

// v0.70・SQL 257：黒服とママ（staff.shift_all）はキャスト全員のシフト（オーナー 2026-10-26 見本 全員のシフト_マイページ_見本「この形で作る」）。
//   並びは管理サイトのシフトと同じ 本日 → 月のカレンダー → 日を押すとその日の出勤。確定した月だけ。ママは上で銀座｜広島を切り替え
let SHALL = null;
const SH_STORE = { ginza: '銀座', hiroshima: '広島' };
async function shiftAll(store){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_shift_all', { p_token: TOKEN, p_store: store || null }); if(r.error){ fail(r.error.message); return; }
  const A = SHALL = r.data, td = new Date(A.today+'T00:00:00+09:00');
  const box = 'border:1px solid var(--line);border-radius:6px;text-align:left;padding:5px 4px;font-size:13px;line-height:1.25;min-height:44px';
  const rows = L => { const T = {}; L.forEach(x => (T[x.time] = T[x.time] || []).push(esc(x.name) + (x.douhan ? '（同伴）' : ''))); return Object.keys(T).sort().map(t => `<div class="row" style="justify-content:flex-start"><b>${t}</b><span>${T[t].join('・')}</span></div>`).join(''); };
  const cur = (A.months || [])[0] || {}, tL = (cur.fixed ? cur.shifts || [] : []).filter(x => x.day === A.today);
  const sw = (A.stores || []).length > 1 ? `<div style="display:flex;gap:8px;margin-bottom:10px">${A.stores.map(s => `<button class="btn${s.code === A.store ? '' : ' g'}" data-shst="${s.code}" style="flex:1">${esc(SH_STORE[s.code] || s.name)}</button>`).join('')}</div>` : '';
  const cal = M => { const OFF = new Set(M.off || []), D = {}; (M.shifts || []).forEach(x => (D[x.day] = D[x.day] || []).push(x));
    return `<div class="card"><div class="gh">${Number(String(M.month).slice(5,7))}月の出勤（確定）</div>${M.fixed ? calGrid(M.month, (iso, d) => { const L = D[iso] || [], dh = L.filter(x => x.douhan).length;
      return `<div ${L.length?`data-sa="${iso}"`:''} style="${box};${L.length?'cursor:pointer;background:var(--gold-soft);font-weight:700':''}">${d}${L.length?`<small style="display:block;font-size:10px;color:var(--pri)">${L.length}人</small>`:OFF.has(iso)?'<small style="display:block;font-size:10px;color:var(--muted);font-weight:400">休</small>':''}${dh?`<small style="display:block;font-size:10px;color:var(--ok);font-weight:400;white-space:nowrap">同伴${dh}</small>`:''}</div>`; })
      + '<div class="muted sm" style="margin-top:6px">日を押すと、その日の出勤</div>' : '<div class="muted sm">まだ確定していません</div>'}</div>`; };
  show(`${sw}<div class="ttl">シフト（全員）</div><div class="card"><div class="gh">本日 ${td.getMonth()+1}/${td.getDate()}（${WD[td.getDay()]}） 出勤 ${tL.length}人</div>${rows(tL) || '<div class="muted sm">シフトなし</div>'}</div>${(A.months || []).map(cal).join('')}`);
  $('main').querySelectorAll('[data-shst]').forEach(b => b.onclick = () => { if(b.dataset.shst !== A.store) shiftAll(b.dataset.shst); });
  $('main').querySelectorAll('[data-sa]').forEach(b => b.onclick = () => { const iso = b.dataset.sa, d = new Date(iso+'T00:00:00+09:00'), L = [];
    (SHALL.months || []).forEach(M => (M.shifts || []).forEach(x => { if(x.day === iso) L.push(x); }));
    const T = {}; L.forEach(x => (T[x.time] = T[x.time] || []).push(x.name + (x.douhan ? '（同伴）' : '')));
    uiAlert(`${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）　出勤 ${L.length}人\n${Object.keys(T).sort().map(t => `${t}　${T[t].join('・')}`).join('\n')}`); });
}
