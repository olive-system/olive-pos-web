// v0.16・SQL 115：係から誘客したキャストへ「ありがとう」（決まった文＋ひとこと。1つの予約に1回。2026-10-15 オーナー）
function thxParam(){
  const q = new URLSearchParams(location.search); let t = q.get('thanks');
  if(!t){ const st = q.get('liff.state'); if(st) t = new URLSearchParams(st.replace(/^[^?]*\?/, '')).get('thanks'); }
  return /^[0-9a-f-]{36}$/.test(t || '') ? t : null;
}
async function resvThanksById(id){
  const r = await sb.rpc('cast_resv_list', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  RESV = r.data || []; const x = RESV.find(v => v.id === id);
  if(!x){ await uiAlert('この予約は取消されたか、来店日を過ぎています'); resvList(); return; }
  if(x.thanked){ await uiAlert('ありがとうは送信済みです'); resvList(); return; }
  resvThanks(x);
}
function resvThanks(x){
  setBack(resvList);
  show(`<div class="ttl">ありがとう</div><div class="card"><div class="gh">誘客 ${esc(x.by)}さん</div><div style="padding:6px 0">${esc(resvLine(x))}</div>
      <label class="f" style="margin-top:8px">ひとこと（任意）<textarea id="thN" maxlength="100" style="min-height:60px"></textarea></label></div>
    <button class="btn" id="thGo">送信</button><p class="muted sm" style="margin:10px 2px">お店の公式 LINE から ${esc(x.by)}さんに届きます</p>`);
  $('thGo').onclick = async () => {
    const note = $('thN').value.trim();
    $('thGo').disabled = true;
    const q = await sb.rpc('cast_resv_thanks', { p_token: TOKEN, p_id: x.id, p_note: note || null });
    if(q.error){ $('thGo').disabled = false; await uiAlert(q.error.message); return; }
    /* v1.05・点検 2026-11-02 A3・SQL 316：未連携と送信失敗で文を分ける。送信失敗の時は記録せず、送り直せる */
    if(!q.data.sent && q.data.linked === true){ $('thGo').disabled = false; await uiAlert('ありがとうの送信に失敗しました。再度お試しください'); return; }
    await uiAlert(q.data.sent ? `${x.by}さんにありがとうを送信しました` : `ありがとうを記録しました。\n${x.by}さんは LINE 未連携のため、LINE は届いていません`);
    resvList();
  };
}
/* v0.94：LINE の送信に失敗した時は、欠勤連絡と同じ文を一覧の上に出す（前は何も出さなかった） */
const RV_LINE_NG = '<p class="err sm">公式 LINE への送信に失敗しました。黒服に LINE でもご連絡ください</p>';
async function resvListNg(lineOk){ await resvList(); if(!lineOk) $('main').insertAdjacentHTML('afterbegin', RV_LINE_NG); }
async function resvCancel(x, b){
  if(!await uiConfirm(`${resvLine(x)}\nこの予約を取消しますか？`, '取消')) return;
  if(b) b.disabled = true; /* v0.94：送っている間は押せない（2回押し） */
  const q = await sb.rpc('cast_resv_cancel', { p_token: TOKEN, p_id: x.id });
  if(q.error){ if(b) b.disabled = false; await uiAlert(q.error.message); return; }
  let lineOk = true;
  try{ await liff.sendMessages([{ type:'text', text: resvMsg('予約取消', x, x.kakari_name || '', ME.name) }]); }catch(e){ lineOk = false; }
  await uiAlert('予約を取消しました');
  resvListNg(lineOk);
}
async function resvForm(ed){
  setBack(resvList); show('<div class="card c muted">読み込み中…</div>');
  const st = await sb.rpc('cast_resv_staff', { p_token: TOKEN });
  if(st.error){ fail(st.error.message); return; }
  const today = new Date(Date.now() + 9*3600e3).toISOString().slice(0,10), fld = 'width:100%;height:48px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)';
  const me = (st.data||[]).find(s => s.name === ME.name), kk = ed ? ed.kakari : me?.id, NK = RV_NOKK();
  const opts = (st.data||[]).map(s => `<option value="${s.id}"${s.id===kk?' selected':''}>${s.id===me?.id?'自分':esc(s.name)}</option>`).join('');
  let dh = ed ? !!ed.douhan : false, cid = ed ? ed.customer_id || null : null, cTimer = null;
  show(`<div class="ttl">${ed?'予約の変更':'予約／同伴申請'}</div><div class="card"><label class="f">来店日<input type="date" id="rvD" min="${today}" value="${ed?ed.date:today}" style="${fld}"></label><div id="rvOff" class="sm hide" style="color:var(--warn);font-weight:700;margin-top:4px"></div><div id="rvNoS" class="sm hide" style="color:var(--warn);font-weight:700;margin-top:4px"></div>
      <label class="f" style="margin-top:8px">来店時刻<input type="time" id="rvT" value="${ed?ed.time:'21:00'}" style="${fld}"></label>
      <div style="display:flex;gap:8px;margin-top:8px"><label class="f" style="flex:1;min-width:0;margin:0">お客様（フルネーム）<input id="rvC" maxlength="30" placeholder="例：孫 正義" value="${ed?esc(ed.name):''}" style="${fld}"></label>
        <label class="f" style="width:64px;flex:none;margin:0">人数<input type="number" id="rvN" inputmode="numeric" min="1" value="${ed?ed.guests:1}" style="${fld};text-align:right"></label></div>
      <div class="muted" style="margin-top:4px;white-space:nowrap;font-size:min(12px,calc((100vw - 58px)/29))">ニックネームではなく、お客様のフルネームを入力してください</div><div id="rvCands"></div>
      ${NK?'':`<label class="f" style="margin-top:8px">${esc(KL)}<select id="rvK" style="${fld}"><option value="">選んでください</option>${opts}</select></label>`}
      ${/* v1.30・SQL 368：お客様｜人数、VIPルーム｜同伴、同伴「あり」の時だけ 黒ドレス｜同伴キャスト（オーナー 2026-11-05 見本 黒ドレス・領収書_案「同伴がない場合すっきりする」） */''}
      <div style="display:flex;gap:8px;margin-top:8px;align-items:flex-end"><label class="f hide" id="rvVW" style="flex:1;min-width:0;margin:0">VIPルーム<select id="rvV" style="${fld}"><option value="">なし</option></select></label>
        <div style="flex:none"><div class="f">同伴</div><div style="display:flex;gap:8px"><button class="btn g" id="rvDh0" style="width:auto;padding:8px 14px">なし</button><button class="btn g" id="rvDh1" style="width:auto;padding:8px 14px">あり</button></div></div></div>
      <div id="rvBW" class="hide" style="display:flex;gap:8px;margin-top:8px;align-items:flex-start"><label class="f" style="width:110px;flex:none;margin:0">黒ドレス<select id="rvB" style="${fld};padding:0 6px"></select></label>
        <div style="flex:1;min-width:0"><div class="f">同伴キャスト</div><div id="rvDhC"></div></div></div>
      <div id="rvSW" class="hide"><div style="display:flex;gap:14px;margin-top:8px;align-items:flex-end"><div><div class="f">出勤希望</div><div style="display:flex;gap:8px"><button class="btn g" id="rvSr0" style="width:auto;padding:8px 18px">なし</button><button class="btn g" id="rvSr1" style="width:auto;padding:8px 18px">あり</button></div></div>
        <label class="f hide" id="rvSTW" style="flex:1;min-width:0;margin:0">出勤時刻<select id="rvST" style="${fld}"></select></label></div></div>
      <div id="rvVB" class="sm hide" style="color:var(--warn);font-weight:700;margin-top:6px"></div>
      <label class="f" style="margin-top:8px">メモ（任意）<textarea id="rvMemo" maxlength="300" style="min-height:60px">${ed&&ed.memo?esc(ed.memo):''}</textarea></label></div>
    <button class="btn" id="rvGo">${ed?'変更':'予約／同伴申請'}</button><p class="muted sm" style="margin:10px 2px">${ed?'変更':'申請'}すると、お店と${NK?'':KL+'・'}同伴のキャストに LINE が届きます<span id="rvSN" class="hide"><br>出勤希望は、承認されるとシフトに入ります</span></p>`);
  const setDh = v => { dh = v; $('rvDh1').style.background = v ? 'var(--ink)' : ''; $('rvDh1').style.color = v ? '#fff' : ''; $('rvDh0').style.background = v ? '' : 'var(--ink)'; $('rvDh0').style.color = v ? '' : '#fff'; };
  // 同伴ありは来店時刻 20:30、なしは 21:00（オーナー 2026-10-15。自分で時刻を変えていたら、そのまま）
  const setDhT = v => { const t = $('rvT'); if(t.value === (v ? '21:00' : '20:30')) t.value = v ? '20:30' : '21:00'; setDh(v); };
  // v1.06・SQL 321：シフトの無い日・同伴なしの時だけ「出勤希望」（オーナー 2026-11-02「出勤承認か出勤却下（予約は受ける）は、私が指定した権限者＋私に来たラインで決定」「本人が出勤要請をしたらね」）
  //   出勤時刻は 19:50 か 20:00〜来店時刻の15分ごと（はじめは来店時刻。オーナー「来店時間にもよるよね」）。申請の後に cast_shift_request で承認者に LINE
  let sr = false; const srOn = () => !$('rvSW').classList.contains('hide') && sr;
  const srTimes = () => { const v = $('rvT').value || '23:00', L = ['19:50']; for(let m = 20*60; m <= 23*60; m += 15) /* 2026-11-04：23:00 まで */{ const t = String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0'); if(t <= v) L.push(t); } return L; };
  const srPaint = () => { const d = $('rvD')?.value; if(!d) return; const no = !dh && !(DAY.shifts || {})[me?.id] && !offs.has(d) && DAY.date === d;
    $('rvSW').classList.toggle('hide', !no); $('rvNoS').classList.toggle('hide', !no); $('rvNoS').textContent = no ? `${Number(d.slice(5,7))}/${Number(d.slice(8,10))} はシフトがありません。出勤する時は「出勤希望 あり」` : '';
    [['rvSr1', sr], ['rvSr0', !sr]].forEach(([id, on]) => { $(id).style.background = on ? 'var(--ink)' : ''; $(id).style.color = on ? '#fff' : ''; });
    $('rvSTW').classList.toggle('hide', !(no && sr)); $('rvSN').classList.toggle('hide', !(no && sr));
    const L = srTimes(), cur = $('rvST').value; $('rvST').innerHTML = L.map(t => `<option>${t}</option>`).join(''); $('rvST').value = L.includes(cur) ? cur : L[L.length - 1]; };
  // v0.79・SQL 265：同伴の子（お客様の人数まで・自分も外せる。オーナー 2026-10-27）と VIPルーム（POS の卓の名前に VIP。最初は「なし」）
  const ST = (st.data || []).slice().sort((a, b) => (b.id === me?.id) - (a.id === me?.id)) /* 小窓は「自分」を一番上に */, nmOf = id => id === me?.id ? '自分' : (ST.find(s => s.id === id)?.name || ''), guests = () => parseInt($('rvN').value, 10) || 1;
  let dhIds = ed && ed.douhan && ed.dh && ed.dh.length ? [...ed.dh] : (me ? [me.id] : []), DAY = { rooms: [], busy: [], shifts: {} };
  // v1.30・SQL 368：黒ドレス（同伴キャストから1名・店ごとに1日1名の先着。決定済みの日は「受付終了」で、着用者は出さない）
  let blk = ed ? ed.black_id || null : null;
  const bkPaint = () => { const x = $('rvB'); if(!x) return; if(blk && !dhIds.includes(blk)) blk = null; if(DAY.black_taken){ blk = null; x.disabled = true; x.style.color = 'var(--muted)'; x.innerHTML = '<option value="">受付終了</option>'; return; }
    x.disabled = false; x.style.color = ''; x.innerHTML = `<option value="">なし</option>${dhIds.map(id => `<option value="${id}"${id === blk ? ' selected' : ''}>${esc(nmOf(id))}</option>`).join('')}`; x.value = blk || ''; };
  const chipPaint = () => { const b = $('rvDhC'); if(!b) return; const on = dh; /* v1.30：同伴キャストは「あり」の時はいつも（黒ドレスのとなり） */
    $('rvBW').classList.toggle('hide', !dh); bkPaint();
    b.innerHTML = on ? `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:48px">${dhIds.map((id, i) => `<span style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:16px;padding:5px 10px;background:var(--card);font-size:15px">${esc(nmOf(id))}<button class="xb" data-dhx="${i}" aria-label="外す">×</button></span>`).join('')}${dhIds.length < guests() ? '<button class="btn g" id="rvDhAdd" style="width:auto;padding:6px 16px">追加</button>' : ''}</div>` : '';
    b.querySelectorAll('[data-dhx]').forEach(x => x.onclick = () => { dhIds.splice(+x.dataset.dhx, 1); chipPaint(); });
    if($('rvDhAdd')) $('rvDhAdd').onclick = () => dhPick(); };
  // 小窓：お客様の人数まで。人数を減らした時は、残す子を選ぶ（キャンセルは人数を戻す）
  const dhPick = (shrink) => { if(document.querySelector('.dlg[data-dh]')) return; const n = guests(), w = document.createElement('div'); w.className = 'dlg'; w.dataset.dh = '1'; let sel = [...dhIds]; /* 人数の欄の change が続けて来ても小窓は1つ */
    const paint = () => { w.innerHTML = `<div class="box"><b style="font-size:17px">同伴（${n}人まで）</b><div style="max-height:65vh;overflow:auto;margin:8px 0 12px;display:grid;grid-template-columns:1fr 1fr;column-gap:12px">${ST.map(c => { const on = sel.includes(c.id); /* v0.82：2列・出勤の時刻は出さない（オーナー 2026-10-27「ここ見えないように。2列にして1画面で全員」） */
        return `<label style="display:flex;align-items:center;gap:8px;padding:9px 2px;border-top:1px solid var(--line);min-width:0"><input type="checkbox" data-dc="${c.id}" ${on ? 'checked' : ''} ${!on && sel.length >= n ? 'disabled' : ''} style="width:20px;height:20px;flex:none"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nmOf(c.id))}</span></label>`; }).join('')}</div>
        <div class="bt"><button class="btn g" data-k="no">キャンセル</button><button class="btn" data-k="ok">選択</button></div></div>`;
      w.querySelectorAll('[data-dc]').forEach(x => x.onchange = () => { sel = x.checked ? [...sel, x.dataset.dc] : sel.filter(id => id !== x.dataset.dc); paint(); });
      w.querySelector('[data-k=no]').onclick = () => { if(shrink) $('rvN').value = dhIds.length; w.remove(); chipPaint(); };
      w.querySelector('[data-k=ok]').onclick = async () => { if(!sel.length){ await uiAlert('同伴のキャストを選んでください'); return; } dhIds = sel; w.remove(); chipPaint(); }; };
    paint(); document.body.appendChild(w); };
  $('rvN').addEventListener('change', () => { if(dh && dhIds.length > guests()) dhPick(true); else chipPaint(); });
  const vipPaint = () => { const v = $('rvV').value, b = $('rvVB'), r = DAY.rooms.find(x => x.id === v), T = DAY.busy.filter(x => x.vip === v).map(x => x.time);
    b.classList.toggle('hide', !(r && T.length)); b.textContent = r && T.length ? `${r.name}：${T.join('・')} 予約あり` : ''; };
  const dayLoad = async () => { const d = $('rvD').value; if(!d) return; const q = await sb.rpc('cast_resv_day', { p_token: TOKEN, p_date: d, p_id: ed ? ed.id : null }); if(q.error || $('rvD')?.value !== d) return;
    DAY = q.data; DAY.date = d; const v = $('rvV').value || (ed && !DAY.loaded ? ed.vip_id || '' : ''); $('rvV').innerHTML = `<option value="">なし</option>${(DAY.rooms || []).map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}`; $('rvV').value = v; DAY.loaded = true;
    $('rvVW').classList.toggle('hide', !(DAY.rooms || []).length); vipPaint(); srPaint(); bkPaint(); };
  $('rvB').onchange = () => { blk = $('rvB').value || null; };
  $('rvV').onchange = vipPaint; $('rvD').addEventListener('change', dayLoad); dayLoad();
  setDh(dh); $('rvDh0').onclick = () => { setDhT(false); chipPaint(); srPaint(); }; $('rvDh1').onclick = () => { setDhT(true); chipPaint(); srPaint(); }; chipPaint();
  $('rvSr0').onclick = () => { sr = false; srPaint(); }; $('rvSr1').onclick = () => { sr = true; $('rvST').value = ''; srPaint(); }; $('rvT').addEventListener('change', srPaint);
  // v0.31・SQL 129：顧客から選ぶ（お店の朝礼で、そのお客様のメモを確認するため）。候補に無い時は名前だけ
  const candPaint = L => { const b = $('rvCands'); if(!b) return;
    if(cid){ b.innerHTML = `<div class="sm" style="margin-top:6px;color:var(--ok);font-weight:700">✓ 顧客から選択</div>`; return; }
    b.innerHTML = L && L.length ? `<div class="muted sm" style="margin-top:8px">顧客の候補</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${L.map(x => `<button class="btn g" data-cu="${x.id}" data-nm="${esc(x.name)}" style="width:auto;padding:8px 12px">${esc(x.name)}${x.kakari&&!NK?`<small class="muted">（${KL} ${esc(x.kakari)}）</small>`:''}</button>`).join('')}</div>` : '';
    b.querySelectorAll('[data-cu]').forEach(x => x.onclick = () => { cid = x.dataset.cu; $('rvC').value = x.dataset.nm; candPaint(); }); };
  $('rvC').oninput = () => { cid = null; clearTimeout(cTimer); const v = $('rvC').value.trim(); if(!v){ candPaint([]); return; }
    cTimer = setTimeout(async () => { const q = await sb.rpc('cast_customer_search', { p_token: TOKEN, p_q: v }); if($('rvC').value.trim() === v) candPaint(q.error ? [] : q.data); }, 300); };
  candPaint([]);
  // v0.50・SQL 173：来店日を選んだ時に、お店の休みならすぐ出す（ゲネプロ マイページ #5。前は申請を押した後にわかった）
  let offs = new Set(); const offPaint = () => { const d = $('rvD')?.value, b = $('rvOff'); if(!b) return; srPaint(); const on = !!d && offs.has(d); b.classList.toggle('hide', !on); b.textContent = on ? `${Number(d.slice(5,7))}/${Number(d.slice(8,10))} はお店の休みです。ほかの日を選んでください` : ''; };
  const dft = ed ? null : draftBind('resv', ['rvD','rvT','rvC','rvK','rvN','rvMemo']); if(dft?.had){ const n = document.createElement('div'); n.className = 'muted sm'; n.style.margin = '0 2px 8px'; n.textContent = '途中の入力を戻しました'; $('rvD').closest('.card').before(n); dayLoad(); } /* 点検 2026-11-02：戻した来店日で VIP ルームを読み直す（前は今日の分で読み、VIP の欄が出なかった） */
  $('rvD').addEventListener('change', offPaint); sb.rpc('cast_off_days', { p_token: TOKEN }).then(r => { if(!r.error){ offs = new Set(r.data || []); offPaint(); } });
  $('rvGo').onclick = async () => {
    const d = $('rvD').value, t = $('rvT').value, c = $('rvC').value.trim().replace(/[\s　]+/g, ' '), k = NK ? me?.id || '' : $('rvK').value, n = parseInt($('rvN').value, 10), memo = $('rvMemo').value.trim();
    if(!d || !t){ await uiAlert('来店日と来店時刻を入力してください'); return; }
    if(offs.has(d)){ await uiAlert(`${Number(d.slice(5,7))}/${Number(d.slice(8,10))} はお店の休みです。ほかの日を選んでください`); return; }
    if(!c){ await uiAlert('お客様のフルネームを入力してください'); return; }
    if(!k){ await uiAlert(KL + 'を選んでください'); return; }
    if(!(n >= 1)){ await uiAlert('人数を入力してください'); return; }
    if(dh && !dhIds.length){ await uiAlert('同伴のキャストを選んでください'); return; }
    if(dh && dhIds.length > n){ dhPick(true); return; }
    const vip = $('rvV').value || null, vn = vip ? (DAY.rooms.find(r => r.id === vip) || {}).name : null;
    const kn = NK ? '自分' : $('rvK').selectedOptions[0].textContent, x = { date:d, time:t, name:c, guests:n, douhan:dh, meet:null, memo:memo || null, vip:vn, dh_names: dh ? dhIds.map(id => id === me?.id ? ME.name : nmOf(id)) : [] };
    if(!await uiConfirm(`${resvLine(x)}${NK?'':`\n${KL} ${kn}`}${dh?`\n${rvDh(x, ME.name) || '同伴あり'}`:''}${vn?`\n${vn} 希望`:''}${dh&&blk&&!DAY.black_taken?`\n黒ドレス ${nmOf(blk)}`:''}${srOn()?`\n出勤希望 ${$('rvST').value}`:''}\nこの内容で${ed?'変更':'申請'}しますか？`)) return;
    $('rvGo').disabled = true;
    const q = await sb.rpc('cast_resv_submit', { p_token: TOKEN, p_id: ed ? ed.id : null, p_date: d, p_time: t, p_name: c, p_kakari: k, p_guests: n, p_douhan: dh, p_meet: null, p_memo: memo || null, p_customer: cid, p_vip: vip, p_dh: dh ? dhIds : null, p_black: dh && blk && !DAY.black_taken ? blk : null });
    if(q.error){ $('rvGo').disabled = false; await uiAlert(q.error.message); return; }
    dft?.clear();
    let lineOk = true;
    try{ await liff.sendMessages([{ type:'text', text: resvMsg(ed ? '予約変更' : '予約', x, kn === '自分' ? ME.name : kn, ME.name) }]); }catch(e){ lineOk = false; }
    let srMsg = ''; if(srOn()){ const w = await sb.rpc('cast_shift_request', { p_token: TOKEN, p_resv: q.data.id, p_time: $('rvST').value }); /* v1.06・SQL 321 */
      srMsg = w.error ? `\n出勤希望：${w.error.message}` : w.data?.auto ? '\n出勤のシフトが入りました' /* v1.36・SQL 372：シフトが未確定の月は承認なしで出勤 */ : w.data?.sent ? '\n出勤希望は、承認者に LINE で送りました' : '\n出勤希望の LINE が承認者に届いていません。お店にご連絡ください'; }
    await uiAlert(`${ed?'予約を変更しました':'予約／同伴申請を受付しました'}${q.data.notified?`\n${NK?'':KL+'・'}同伴のキャストにも LINE で送りました`:''}${srMsg}`);
    resvListNg(lineOk);
  };
}

