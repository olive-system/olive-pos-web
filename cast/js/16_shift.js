// v0.22・SQL 122：⑧シフト（オーナーにヒアリングして決めた形 2026-10-16）。毎月10日までに来月の「出勤できない日」を提出（1日5人まで先着・10日を過ぎたら変更できない）
// v0.30：ホームのシフトは成績の横（オーナー 2026-10-16）
// v0.29：シフトの変更は申請の仕組みを作らず公式 LINE で黒服に（オーナー 2026-10-16）。ホームの「申請（変更）」は外して、シフトの画面に「シフト変更（メッセージにてご相談ください）」。押すとお店のトークに戻る
// v0.28：シフトのカレンダーは左揃え（オーナー 2026-10-16）
// v0.27：確定のカレンダーは時刻を出さず「予約1」「係予約2」の件数だけ（時刻は日を押すと出る。オーナー 2026-10-16）
// v0.26・SQL 128：お店の休みの日は「休」（押せない）
// v0.25・SQL 127：スタッフ設定で「出勤できる日のみ：可」の子は、逆に「出勤できる日」を提出（○。5人の上限なし）
//   確定したシフトはカレンダーで、出勤時刻と同伴・予約・係予約（自分が係のお客様の予約）。日を押すと詳細
let SHIFT = null;
// v0.71：今日のマスはオリーブでぬる（文字は白。オーナー 2026-10-26 案ウ）。今日＝営業日（朝8時で切りかわる。POS と同じ）
const shToday = () => (SHALL && SHALL.today) || new Date(Date.now() + (9 - 8) * 3600e3).toISOString().slice(0, 10);
const calGrid = (month, cell) => { const m = new Date(month+'T00:00:00+09:00'), y = m.getFullYear(), mo = m.getMonth(), first = new Date(y, mo, 1).getDay(), n = new Date(y, mo + 1, 0).getDate();
  let h = '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">' + WD.map(w => `<div class="muted" style="text-align:left;padding-left:5px;font-size:11px">${w}</div>`).join('');
  for(let i = 0; i < first; i++) h += '<div></div>';
  const td = shToday();
  for(let d = 1; d <= n; d++){ const iso = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; let c = cell(iso, d); if(iso === td) c = c.replace('<div ', '<div class="tdy" '); h += c; }
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
  const A = SHALL = r.data, td = new Date(A.today+'T00:00:00+09:00'), KLs = A.kakari_label || '係';
  const box = 'border:1px solid var(--line);border-radius:6px;text-align:left;padding:5px 4px;font-size:13px;line-height:1.25;min-height:44px';
  // v0.72・SQL 259：同伴がある人は「同伴」の行にまとめて件数だけ（オーナー 2026-10-26 案ア）。黒服はシフトに出さない（休みの日だけ「黒服の休み」）
  const groups = L => { const T = {}, DH = []; L.forEach(x => { if(Number(x.douhan) > 0 || x.time === '同伴') DH.push(x); else (T[x.time] = T[x.time] || []).push(x.trial ? `${x.name}（体験）` : x.name); }); /* v0.84・SQL 273 */
    const g = Object.keys(T).sort().map(t => [t, T[t].join('・')]); if(DH.length) g.push(['同伴', DH.map(x => `${x.name}（${Math.max(1, Number(x.douhan) || 0)}件）`).join('・')]); return g; };
  const rows = L => groups(L).map(([t, n]) => `<div class="row" style="justify-content:flex-start"><b>${esc(t)}</b><span>${esc(n)}</span></div>`).join('');
  const all = k => (A.months || []).flatMap(M => M[k] || []);
  const hallOff = iso => all('hall_off').filter(x => x.day === iso).map(x => x.name);
  const resvOf = iso => all('resv').filter(x => x.day === iso);
  const rvHead = R => `予約 ${R.length}件${R.some(x => x.douhan) ? `（同伴 ${R.filter(x => x.douhan).length}件）` : ''}`;
  const who = x => [x.by ? `誘客 ${x.by}` : '', x.kakari && A.store !== 'hiroshima' ? `${KLs} ${x.kakari}` : ''].filter(Boolean).join('・'); /* v0.89：広島は担当を出さない（予約画面 v0.86 と同じ。2026-10-29 オーナー） */
  const cur = (A.months || [])[0] || {}, tL = (cur.fixed ? cur.shifts || [] : []).filter(x => x.day === A.today), tOff = hallOff(A.today), tR = resvOf(A.today);
  const sep = '<div style="border-top:1px solid var(--line);margin:8px 0"></div>';
  const todayExtra = (tOff.length ? `${sep}<div class="gh">黒服の休み</div><div>${esc(tOff.join('・'))}</div>` : '')
    + (tR.length ? `${sep}<div class="gh">${rvHead(tR)}</div>${tR.map((x, i) => rvRow(x, who(x), i)).join('')}` : ''); /* v0.79：しるしは右の列・同伴の子 */
  const sw = (A.stores || []).length > 1 ? `<div style="display:flex;gap:8px;margin-bottom:10px">${A.stores.map(s => `<button class="btn${s.code === A.store ? '' : ' g'}" data-shst="${s.code}" style="flex:1">${esc(SH_STORE[s.code] || s.name)}</button>`).join('')}</div>` : '';
  const cal = M => { const OFF = new Set(M.off || []), D = {}, RV = {}; (M.shifts || []).forEach(x => (D[x.day] = D[x.day] || []).push(x)); (M.resv || []).forEach(x => RV[x.day] = (RV[x.day] || 0) + 1); const RVD = {}; (M.resv || []).forEach(x => { if(x.douhan) RVD[x.day] = (RVD[x.day] || 0) + 1; }); /* v0.74：同伴と、同伴でない予約を分けて出す（足すと合計。オーナー 2026-10-26「予約が2件と別に同伴が2件で合計4件あるみたい」→ 見本でウ「予約0 と表示したい」）。v0.75：同伴・予約の行は場所を固定して、0 も出す（オーナー「予約の場所、同伴の列、固定して」「同伴も0ならゼロで表示する」） */
    return `<div class="card"><div class="gh">${Number(String(M.month).slice(5,7))}月の出勤（確定）</div>${M.fixed ? calGrid(M.month, (iso, d) => { const L = D[iso] || [], dh = L.reduce((a, x) => a + Number(x.douhan || 0), 0), rv = RV[iso] || 0;
      return `<div ${L.length||rv||(iso>=A.today&&!OFF.has(iso))?`data-sa="${iso}"`:''} style="${box};${L.length?'cursor:pointer;background:var(--gold-soft);font-weight:700':''}">${d}${L.length?`<small style="display:block;font-size:10px;color:var(--pri)">${L.length}人</small>`:OFF.has(iso)?'<small style="display:block;font-size:10px;color:var(--muted);font-weight:400">休</small>':''}${L.length || rv ? `<small style="display:block;font-size:10px;color:var(--ok);font-weight:400;white-space:nowrap">同伴${RVD[iso] || 0}</small><small style="display:block;font-size:10px;color:var(--muted);font-weight:400;white-space:nowrap">予約${rv - (RVD[iso] || 0)}</small>` : ''}</div>`; })
      + '<div class="muted sm" style="margin-top:6px">タップで詳細表示</div>' : '<div class="muted sm">まだ確定していません</div>'}</div>`; };
  show(`${sw}<div class="ttl">シフト（全員）</div><div class="card"><div class="gh">本日 ${td.getMonth()+1}/${td.getDate()}（${WD[td.getDay()]}） 出勤 ${tL.length}人</div>${rows(tL) || '<div class="muted sm">シフトなし</div>'}${todayExtra}</div>${(A.months || []).map(cal).join('')}`);
  $('main').querySelectorAll('[data-shst]').forEach(b => b.onclick = () => { if(b.dataset.shst !== A.store) shiftAll(b.dataset.shst); });
  $('main').querySelectorAll('[data-sa]').forEach(b => b.onclick = () => { if(b.dataset.sa >= A.today && !(A.months || []).some(M => (M.off || []).includes(b.dataset.sa))){ shiftDayEdit(b.dataset.sa, A.store); return; } const iso = b.dataset.sa, d = new Date(iso+'T00:00:00+09:00'), L = all('shifts').filter(x => x.day === iso), off = hallOff(iso), R = resvOf(iso);
    uiAlert(`${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）　出勤 ${L.length}人\n${groups(L).map(([t, n]) => `${t}　${n}`).join('\n')}`
      + (off.length ? `\n\n黒服の休み　${off.join('・')}` : '')
      + (R.length ? `\n\n${rvHead(R)}\n${R.map(x => `${x.time}　${x.name} 様 ${Number(x.guests)||0}名（${[rvDh(x) || (x.douhan ? '同伴' : ''), x.vip || '', who(x)].filter(Boolean).join('・')}）`).join('\n')}` : '')); });
}

// v0.78・SQL 263：全員のシフトで、今日から先の日の出勤を直す（オーナー 2026-10-27「追加や削除や出勤時間の変更」「全員のシフトが見れる人のみ」「×マークで」「追加ボタンで小窓でキャスト、選んだら時間を入力」「15分刻み」「PMはいらん」）
//   直すとキャストに LINE（【シフトの追加】【シフトの変更】【シフトの取消】）・操作ログ「シフトの変更」。同伴のシフトは予約から入るので直さない
// 時刻は営業時間の中だけ：19:50 と 20:00〜23:45 の15分ごと（オーナー 2026-10-27「PMはいらん」「営業時間外に出勤できんだろ」。type=time は iPhone で午前・午後が出るので選ぶ形）
const SH_EDIT_T = ['19:50', ...Array.from({ length: 16 }, (_, i) => `${20 + Math.floor(i / 4)}:${String(i % 4 * 15).padStart(2, '0')}`)];
async function shiftDayEdit(iso, store){
  setBack(() => shiftAll(store)); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_shift_day', { p_token: TOKEN, p_store: store || null, p_day: iso }); if(r.error){ fail(r.error.message); return; }
  const D = r.data, d = new Date(iso+'T00:00:00+09:00'), again = () => shiftDayEdit(iso, store), L = D.shifts || [];
  const all = k => ((SHALL && SHALL.months) || []).flatMap(M => M[k] || []), off = all('hall_off').filter(x => x.day === iso).map(x => x.name), R = all('resv').filter(x => x.day === iso);
  const tin = (v, a, st) => `<select ${a} style="${st || 'width:auto;font:inherit;font-size:15px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--card)'}">${(SH_EDIT_T.includes(v) ? SH_EDIT_T : [v, ...SH_EDIT_T]).map(t => `<option ${t === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const set = async (id, t) => { const q = await sb.rpc('cast_shift_set', { p_token: TOKEN, p_store: store || null, p_staff: id, p_day: iso, p_time: t }); if(q.error){ await uiAlert(q.error.message); again(); return false; } return true; };
  show(`<div class="ttl">${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）　出勤 ${L.length}人</div><div class="card">
    ${L.map((x, i) => `<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><span style="flex:1">${esc(x.name)}${x.trial ? ` <small class="muted">体験・${esc(x.pay || '')}</small>` : ''}</span>${x.douhan || !D.edit ? `<span class="muted sm">${x.douhan ? (x.time && x.time !== '同伴' ? `同伴 ${esc(x.time)}` : '同伴') : esc(x.time)}</span>`
      : `${tin(x.time, `data-sdt="${i}"`)}<button class="btn g" data-sdx="${i}" aria-label="消す" style="width:auto;padding:6px 12px;color:var(--warn)">×</button>`}</div>`).join('') || '<div class="muted sm">なし</div>'}
    ${D.edit ? '<button class="btn" id="sdAdd" style="margin-top:10px">追加</button>' : ''}</div>
    ${off.length ? `<div class="card"><div class="gh">黒服の休み</div><div>${esc(off.join('・'))}</div></div>` : ''}
    ${R.length ? `<div class="card"><div class="gh">予約 ${R.length}件</div>${R.map((x, i) => D.edit && x.douhan ? `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0">${rvRow(x, '', i)}</div><button class="btn g" data-dcx="${i}" style="width:auto;padding:6px 12px;color:var(--warn)">取消</button></div>` : rvRow(x, '', i)).join('')}</div>` : ''}`); /* v0.79：しるしは右の列・同伴の子。v0.89・SQL 285：シフトを直せる人（黒服・ママ）は同伴を取消 */
  $('main').querySelectorAll('[data-dcx]').forEach(b => b.onclick = async () => { const x = R[+b.dataset.dcx]; if(!await uiConfirm(`${x.name} 様の同伴を取り消しますか？`, '取消')) return; b.disabled = true;
    const q = await sb.rpc('cast_douhan_cancel', { p_token: TOKEN, p_store: store || null, p_id: x.id }); if(q.error){ b.disabled = false; await uiAlert(q.error.message); return; }
    await uiAlert('取り消しました。申請した子と同伴の子に LINE で知らせました'); shiftAll(store); }); /* 予約の一覧は全員のシフトと一緒に読み直す */
  $('main').querySelectorAll('[data-sdt]').forEach(el => el.onchange = async () => { const x = L[+el.dataset.sdt]; if(!el.value){ el.value = x.time; return; } if(await set(x.staff_id, el.value)) again(); });
  $('main').querySelectorAll('[data-sdx]').forEach(b => b.onclick = async () => { const x = L[+b.dataset.sdx]; if(!await uiConfirm(`${x.name}さんの ${x.time} の出勤を取消しますか？`, '取消')) return; if(await set(x.staff_id, null)) again(); });
  if($('sdAdd')) $('sdAdd').onclick = () => { const C = D.casts || [], w = document.createElement('div'); w.className = 'dlg';
    const close = () => w.remove(), pick = () => { w.innerHTML = `<div class="box"><div style="max-height:60vh;overflow:auto"><button class="lkb" data-sdtr style="display:block;width:100%;text-align:left;margin-bottom:6px;font-weight:700;border-color:var(--head)">体験</button><div style="border-top:1px solid var(--line);margin:8px 0"></div>${C.map((c, i) => `<button class="lkb" data-sdc="${i}" ${c.ng ? 'disabled' : ''} style="display:block;width:100%;text-align:left;margin-bottom:6px">${esc(c.name)}${c.ng ? ' <small class="muted">出勤不可</small>' : ''}</button>`).join('') || '<div class="muted">なし</div>'}</div><div class="bt" style="margin-top:8px"><button class="btn g" data-k="no">キャンセル</button></div></div>`;
      w.querySelector('[data-k=no]').onclick = close; w.querySelector('[data-sdtr]').onclick = trial; w.querySelectorAll('[data-sdc]').forEach(b => b.onclick = () => time(C[+b.dataset.sdc])); };
    /* v0.84・SQL 273：体験の人の登録（オーナー 2026-10-27「1番上に体験と言う項目を作って体験を押したら体験の子の情報を入力する画面」「報酬額は先方には見えないように」） */
    const trial = () => { const fs = 'width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card)', lb = t => `<div class="muted sm" style="margin:10px 0 4px">${t}</div>`; let pt = 'hourly';
      w.innerHTML = `<div class="box"><p style="font-weight:700;margin-bottom:4px">体験　${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）</p>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px"><div>${lb('源氏名')}<input id="trN" maxlength="30" style="${fs}"></div><div>${lb('本名')}<input id="trR" maxlength="60" style="${fs}"></div></div>
        ${lb('時刻')}${tin('20:00', 'id="trT"', fs)}
        ${lb('報酬')}<div style="display:flex;gap:8px"><span id="trP" style="display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;flex:none">${[['hourly', '時給'], ['daily', '日給']].map(([v, n]) => `<button type="button" data-trp="${v}" style="border:0;font:inherit;font-size:16px;padding:8px 14px">${n}</button>`).join('')}</span><input id="trA" type="number" inputmode="numeric" min="1" style="${fs};flex:1;min-width:0" placeholder="円"></div>
        <div class="bt" style="margin-top:14px"><button class="btn g" data-k="no">戻る</button><button class="btn" data-k="ok">追加</button></div></div>`;
      const seg = () => w.querySelectorAll('[data-trp]').forEach(b => { const on = b.dataset.trp === pt; b.style.background = on ? 'var(--head)' : 'var(--card)'; b.style.color = on ? '#fff' : 'var(--ink)'; });
      w.querySelectorAll('[data-trp]').forEach(b => b.onclick = () => { pt = b.dataset.trp; seg(); }); seg();
      w.querySelector('[data-k=no]').onclick = pick;
      w.querySelector('[data-k=ok]').onclick = async e => { const n = w.querySelector('#trN').value.trim(), a = parseInt(w.querySelector('#trA').value || '0', 10) || 0;
        if(!n){ await uiAlert('源氏名を入力してください'); return; } if(a <= 0){ await uiAlert('金額を入力してください'); return; }
        e.target.disabled = true; const q = await sb.rpc('cast_shift_trial_add', { p_token: TOKEN, p_store: store || null, p_day: iso, p_name: n, p_real: w.querySelector('#trR').value.trim(), p_time: w.querySelector('#trT').value, p_pay_type: pt, p_amount: a });
        if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; } close(); again(); }; };
    const time = c => { w.innerHTML = `<div class="box"><p style="margin-bottom:10px">${esc(c.name)}</p>${tin('20:30', 'id="sdTm"', 'width:100%;font:inherit;font-size:18px;padding:8px;border:1px solid var(--line);border-radius:8px;margin-bottom:14px;background:var(--card)')}<div class="bt"><button class="btn g" data-k="no">戻る</button><button class="btn" data-k="ok">追加</button></div></div>`;
      w.querySelector('[data-k=no]').onclick = pick; w.querySelector('[data-k=ok]').onclick = async e => { const v = w.querySelector('#sdTm').value; if(!v) return; e.target.disabled = true; close(); if(await set(c.id, v)) again(); }; };
    pick(); document.body.appendChild(w); };
}
