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
    await uiAlert(q.data.sent ? `${x.by}さんにありがとうを送信しました` : `ありがとうを記録しました。\n${x.by}さんは LINE 未連携のため、LINE は届いていません`);
    resvList();
  };
}
async function resvCancel(x){
  if(!await uiConfirm(`${resvLine(x)}\nこの予約を取消しますか？`, '取消')) return;
  const q = await sb.rpc('cast_resv_cancel', { p_token: TOKEN, p_id: x.id });
  if(q.error){ await uiAlert(q.error.message); return; }
  try{ await liff.sendMessages([{ type:'text', text: resvMsg('予約取消', x, x.kakari_name || '', ME.name) }]); }catch(e){}
  await uiAlert('予約を取消しました');
  resvList();
}
async function resvForm(ed){
  setBack(resvList); show('<div class="card c muted">読み込み中…</div>');
  const st = await sb.rpc('cast_resv_staff', { p_token: TOKEN });
  if(st.error){ fail(st.error.message); return; }
  const today = new Date(Date.now() + 9*3600e3).toISOString().slice(0,10), fld = 'width:100%;height:48px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)';
  const me = (st.data||[]).find(s => s.name === ME.name), kk = ed ? ed.kakari : me?.id;
  const opts = (st.data||[]).map(s => `<option value="${s.id}"${s.id===kk?' selected':''}>${s.id===me?.id?'自分':esc(s.name)}</option>`).join('');
  let dh = ed ? !!ed.douhan : false, cid = ed ? ed.customer_id || null : null, cTimer = null;
  show(`<div class="ttl">${ed?'予約の変更':'予約／同伴申請'}</div><div class="card"><label class="f">来店日<input type="date" id="rvD" min="${today}" value="${ed?ed.date:today}" style="${fld}"></label>
      <label class="f" style="margin-top:8px">来店時刻<input type="time" id="rvT" value="${ed?ed.time:'21:00'}" style="${fld}"></label>
      <label class="f" style="margin-top:8px">お客様（フルネーム）<input id="rvC" maxlength="30" placeholder="例：孫 正義" value="${ed?esc(ed.name):''}" style="${fld}"></label>
      <div class="muted" style="margin-top:4px;white-space:nowrap;font-size:min(12px,calc((100vw - 58px)/29))">ニックネームではなく、お客様のフルネームを入力してください</div><div id="rvCands"></div>
      <label class="f" style="margin-top:8px">${esc(KL)}<select id="rvK" style="${fld}"><option value="">選んでください</option>${opts}</select></label>
      <label class="f" style="margin-top:8px">人数<input type="number" id="rvN" inputmode="numeric" min="1" value="${ed?ed.guests:1}" style="${fld};text-align:right"></label>
      <div class="f" style="margin-top:8px">同伴</div><div style="display:flex;gap:8px"><button class="btn g" id="rvDh0" style="width:auto;padding:8px 18px">なし</button><button class="btn g" id="rvDh1" style="width:auto;padding:8px 18px">あり</button></div>
      <label class="f hide" id="rvMw" style="margin-top:8px">待ち合わせの時刻<input type="time" id="rvM" value="${ed&&ed.meet?ed.meet:'19:30'}" style="${fld}"></label>
      <label class="f" style="margin-top:8px">メモ（任意）<textarea id="rvMemo" maxlength="300" style="min-height:60px">${ed&&ed.memo?esc(ed.memo):''}</textarea></label></div>
    <button class="btn" id="rvGo">${ed?'変更':'予約／同伴申請'}</button><p class="muted sm" style="margin:10px 2px">${ed?'変更':'申請'}すると、お店と係のキャストに LINE が届きます</p>`);
  const setDh = v => { dh = v; $('rvDh1').style.background = v ? 'var(--ink)' : ''; $('rvDh1').style.color = v ? '#fff' : ''; $('rvDh0').style.background = v ? '' : 'var(--ink)'; $('rvDh0').style.color = v ? '' : '#fff'; $('rvMw').classList.toggle('hide', !v); };
  // 同伴ありは来店時刻 20:30、なしは 21:00（オーナー 2026-10-15。自分で時刻を変えていたら、そのまま）
  const setDhT = v => { const t = $('rvT'); if(t.value === (v ? '21:00' : '20:30')) t.value = v ? '20:30' : '21:00'; setDh(v); };
  setDh(dh); $('rvDh0').onclick = () => setDhT(false); $('rvDh1').onclick = () => setDhT(true);
  // v0.31・SQL 129：顧客から選ぶ（お店の朝礼で、そのお客様のメモを確認するため）。候補に無い時は名前だけ
  const candPaint = L => { const b = $('rvCands'); if(!b) return;
    if(cid){ b.innerHTML = `<div class="sm" style="margin-top:6px;color:var(--ok);font-weight:700">✓ 顧客から選択</div>`; return; }
    b.innerHTML = L && L.length ? `<div class="muted sm" style="margin-top:8px">顧客の候補</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${L.map(x => `<button class="btn g" data-cu="${x.id}" data-nm="${esc(x.name)}" style="width:auto;padding:8px 12px">${esc(x.name)}${x.kakari?`<small class="muted">（係 ${esc(x.kakari)}）</small>`:''}</button>`).join('')}</div>` : '';
    b.querySelectorAll('[data-cu]').forEach(x => x.onclick = () => { cid = x.dataset.cu; $('rvC').value = x.dataset.nm; candPaint(); }); };
  $('rvC').oninput = () => { cid = null; clearTimeout(cTimer); const v = $('rvC').value.trim(); if(!v){ candPaint([]); return; }
    cTimer = setTimeout(async () => { const q = await sb.rpc('cast_customer_search', { p_token: TOKEN, p_q: v }); if($('rvC').value.trim() === v) candPaint(q.error ? [] : q.data); }, 300); };
  candPaint([]);
  $('rvGo').onclick = async () => {
    const d = $('rvD').value, t = $('rvT').value, c = $('rvC').value.trim().replace(/[\s　]+/g, ' '), k = $('rvK').value, n = parseInt($('rvN').value, 10), m = $('rvM').value, memo = $('rvMemo').value.trim();
    if(!d || !t){ await uiAlert('来店日と来店時刻を入力してください'); return; }
    if(!c){ await uiAlert('お客様のフルネームを入力してください'); return; }
    if(!k){ await uiAlert('係を選んでください'); return; }
    if(!(n >= 1)){ await uiAlert('人数を入力してください'); return; }
    if(dh && !m){ await uiAlert('待ち合わせの時刻を入力してください'); return; }
    const kn = $('rvK').selectedOptions[0].textContent, x = { date:d, time:t, name:c, guests:n, douhan:dh, meet:dh ? m : null, memo:memo || null };
    if(!await uiConfirm(`${resvLine(x)}\n係 ${kn}${dh?`\n同伴あり（待ち合わせ ${m}）`:''}\nこの内容で${ed?'変更':'申請'}しますか？`)) return;
    $('rvGo').disabled = true;
    const q = await sb.rpc('cast_resv_submit', { p_token: TOKEN, p_id: ed ? ed.id : null, p_date: d, p_time: t, p_name: c, p_kakari: k, p_guests: n, p_douhan: dh, p_meet: dh ? m : null, p_memo: memo || null, p_customer: cid });
    if(q.error){ $('rvGo').disabled = false; await uiAlert(q.error.message); return; }
    try{ await liff.sendMessages([{ type:'text', text: resvMsg(ed ? '予約変更' : '予約', x, kn === '自分' ? ME.name : kn, ME.name) }]); }catch(e){}
    await uiAlert(`${ed?'予約を変更しました':'予約／同伴申請を受付しました'}${q.data.notified?`\n係のキャストにも LINE で送りました`:''}`);
    resvList();
  };
}

