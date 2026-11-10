// v0.03・SQL 098：当日欠勤。理由は自由入力。罰金のルールは本人の報酬（時給／日給）の分だけ出し、今の時刻に当たる行を赤くする
const dTxt = d => { const x = jd(d); return `${x.getMonth()+1}月${x.getDate()}日（${WD[x.getDay()]}）`; };
const tTxt = t => new Date(t).toLocaleTimeString('ja-JP', { timeZone:'Asia/Tokyo', hour:'2-digit', minute:'2-digit', hour12:false });
const fineTxt = (f, pt) => !f ? '—' : f.calc === 'hourly_pct' ? `時給の${f.value}%` : f.calc === 'daily_pct' ? `日給の${f.value}%` : f.calc === 'yen' ? yen(f.value) : '—';
async function absent(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_absence_info', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const A = r.data;
  /* v1.05・点検 2026-11-02 C2・SQL 316：罰金を免除されている子（A.exempt）には、罰金の表も罰金の行も出さない。免除の種類は types から外して届く */
  if(A.sent){ absentDone(A.date, A.sent.at, A.sent.fine_name, true, true, A.exempt); return; }
  const t = A.types || {}, rows = [['13時までの連絡', t.early, false], ['13時以降・金曜日・イベント日', t.late, true]].filter(x => x[1]), nowRow = rows.some(x => x[2] === !!A.is_late);
  const rule = rows.length ? `<div class="warnbox"><b class="t">当日欠勤の罰金</b><table>${rows.map(x => `<tr class="${x[2]===!!A.is_late?'hi':''}"><td>${x[0]}</td><td>${esc(fineTxt(x[1], t.pay_type))}</td></tr>`).join('')}</table>
    ${nowRow ? `<div class="now">現在の連絡は「${A.is_late ? '13時以降・金曜日・イベント日' : '13時までの連絡'}」に該当します</div>` : ''}</div>` : '';
  show(`${segHtml('absent')}<div class="subh">${dTxt(A.date)} ${tTxt(A.now)}</div>
    <div class="card"><label class="f" for="abR">理由</label><textarea id="abR" maxlength="300"></textarea></div>${rule}
    <button class="btn" id="abGo">欠勤連絡</button><p class="muted sm" style="margin:10px 2px">送信内容は公式 LINE のトークにも送信されます</p>`); segBind();
  const go = $('abGo'); /* 送っている間に別の画面へ移ると $('abGo') が無くなるので、押したボタンを持っておく */
  go.onclick = async () => {
    const rs = $('abR').value.trim(); if(!rs){ await uiAlert('理由を入力してください'); return; }
    if(!await uiConfirm(`${dTxt(A.date)}の欠勤連絡を送信しますか？`)) return;
    go.disabled = true;
    const q = await sb.rpc('cast_absence_submit', { p_token: TOKEN, p_reason: rs });
    if(q.error){ go.disabled = false; await uiAlert(q.error.message); return; }
    let lineOk = true;
    try{ await liff.sendMessages([{ type:'text', text:`【当日欠勤】${dTxt(q.data.date)} ${tTxt(q.data.at)}\n${ME.name}\n理由：${rs}` }]); }catch(e){ lineOk = false; }
    absentDone(q.data.date, q.data.at, q.data.fine_name, false, lineOk, A.exempt);
  };
}
function absentDone(date, at, fine, already, lineOk = true, exempt = false){
  setBack(home);
  show(`${already ? segHtml('absent') : ''}<div class="card c"><div class="big">${already ? '送信済' : '送信完了'}</div><p>${dTxt(date)}の欠勤連絡を受付しました。</p>
    <div class="row" style="text-align:left"><span>連絡時刻</span><b>${tTxt(at)}</b></div>${exempt ? '' : `<div class="row" style="text-align:left"><span>罰金</span><b>${esc(fine || 'なし')}</b></div>`}
    <div class="muted sm">取消は黒服にご連絡ください</div>${lineOk ? '' : '<p class="err sm">公式 LINE への送信に失敗しました。黒服に LINE でもご連絡ください</p>'}</div>
    <button class="btn g" id="abHome">ホーム</button>`);
  $('abHome').onclick = home; segBind();
}

// v0.88・SQL 283：欠勤・遅刻連絡（オーナー 2026-10-29 案ア「1つのボタン」）。上で欠勤／遅刻を選ぶ。黒服は「遅刻連絡」だけ（hall）
const segHtml = on => `<div class="seg"><button data-sg="absent" class="${on === 'absent' ? 'on' : ''}">欠勤</button><button data-sg="late" class="${on === 'late' ? 'on' : ''}">遅刻</button></div>`;
function segBind(){ $('main').querySelectorAll('[data-sg]').forEach(b => b.onclick = () => b.dataset.sg === 'absent' ? absent() : lateForm(false)); }
// 遅刻連絡：シフトの時刻より前だけ。出勤予定（15分ごと）と理由 → 承認者に公式 LINE（通常／免除）。トークにも送る（欠勤連絡と同じ）
async function lateForm(hall){
  setBack(hall ? hallHome : home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc(hall ? 'hall_late_info' : 'cast_late_info', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const L = r.data, seg = hall ? '' : segHtml('late');
  if(L.sent){ lateDone(hall, L.date, L.sent.at, L.shift, L.sent.eta, L.sent.status, true, true, L.sent.line === 0); return; } /* v1.05・点検 2026-11-02 A4・SQL 316：承認者に届いた数（line） */
  /* v1.05・点検 2026-11-02 B4・SQL 316：シフトが「同伴」（時刻なし）の日は遅刻の罰金がかからない（late_fine_apply）ため、遅刻連絡は不要 */
  if(!L.open){ show(`${seg}<div class="subh">${dTxt(L.date)} ${tTxt(L.now)}</div><div class="card muted">${!L.shift ? (L.douhan ? '本日は同伴のため、遅刻連絡は不要です' : '本日のシフトがありません') : hall ? 'シフトの時刻を過ぎたため送信できません' : 'シフトの時刻を過ぎたため送信できません。黒服にご連絡ください'}</div>`); if(!hall) segBind(); return; }
  const Q = 900000, s0 = new Date(L.shift_at).getTime(); let op = '';
  for(let t = s0 + Q; t <= s0 + 16 * Q; t += Q) op += `<option>${tTxt(t).replace(/^0(\d)/, '$1')}</option>`;
  show(`${seg}<div class="subh">${dTxt(L.date)} ${tTxt(L.now)}</div>
    <div class="card"><div class="row" style="text-align:left"><span>シフト</span><b>${esc(L.shift)}</b></div><label class="f" for="ltE" style="margin-top:10px">出勤予定</label><select id="ltE" style="font:inherit;font-size:18px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card)">${op}</select>
    <label class="f" for="ltR" style="margin-top:10px">理由</label><textarea id="ltR" maxlength="300"></textarea></div>
    <button class="btn" id="ltGo">遅刻連絡</button><p class="muted sm" style="margin:10px 2px">送信内容は公式 LINE のトークにも送信されます</p>`);
  if(!hall) segBind();
  $('ltGo').onclick = async () => {
    const eta = $('ltE').value, rs = $('ltR').value.trim(); if(!rs){ await uiAlert('理由を入力してください'); return; }
    if(!await uiConfirm(`${dTxt(L.date)}の遅刻連絡を送信しますか？（出勤予定 ${eta}）`)) return;
    $('ltGo').disabled = true;
    const q = await sb.rpc(hall ? 'hall_late_submit' : 'cast_late_submit', { p_token: TOKEN, p_eta: eta, p_reason: rs });
    if(q.error){ if($('ltGo')) $('ltGo').disabled = false; await uiAlert(q.error.message); return; }
    let lineOk = true;
    try{ await liff.sendMessages([{ type:'text', text:`【遅刻連絡】${dTxt(q.data.date)} ${tTxt(q.data.at)}\n${ME.name}\nシフト ${q.data.shift}\n出勤予定 ${eta}\n理由：${rs}` }]); }catch(e){ lineOk = false; }
    lateDone(hall, q.data.date, q.data.at, q.data.shift, eta, 'pending', false, lineOk, q.data.sent === 0);
  };
}
function lateDone(hall, date, at, shift, eta, st, already, lineOk = true, noAppr = false){
  const na = noAppr && st === 'pending'; /* v1.05・点検 2026-11-02 A4：承認者に届いていない時は「承認者が確認中」を出さず、赤い文 */
  setBack(hall ? hallHome : home);
  show(`${already && !hall ? segHtml('late') : ''}<div class="card c"><div class="big">${already ? '送信済' : '送信完了'}</div><p>${dTxt(date)}の遅刻連絡を受付しました。</p>
    <div class="row" style="text-align:left"><span>連絡時刻</span><b>${tTxt(at)}</b></div><div class="row" style="text-align:left"><span>出勤予定</span><b>${esc(eta)}</b></div>
    ${na ? '' : `<div class="row" style="text-align:left"><span>罰金</span><b>${st === 'approved' ? 'なし（免除）' : st === 'rejected' ? '遅刻（通常）' : '承認者が確認中'}</b></div>`}
    ${na ? '<p class="err sm">承認者に LINE が届いていません。黒服に LINE でもご連絡ください</p>' : lineOk ? '' : '<p class="err sm">公式 LINE への送信に失敗しました。黒服に LINE でもご連絡ください</p>'}</div>
    <button class="btn g" id="ltHome">ホーム</button>`);
  $('ltHome').onclick = hall ? hallHome : home; if(already && !hall) segBind();
}

