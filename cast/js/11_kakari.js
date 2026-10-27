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
  show(`<div class="ttl">${ed?'予約の変更':'予約／同伴申請'}</div><div class="card"><label class="f">来店日<input type="date" id="rvD" min="${today}" value="${ed?ed.date:today}" style="${fld}"></label><div id="rvOff" class="sm hide" style="color:var(--warn);font-weight:700;margin-top:4px"></div>
      <label class="f" style="margin-top:8px">来店時刻<input type="time" id="rvT" value="${ed?ed.time:'21:00'}" style="${fld}"></label>
      <label class="f" style="margin-top:8px">お客様（フルネーム）<input id="rvC" maxlength="30" placeholder="例：孫 正義" value="${ed?esc(ed.name):''}" style="${fld}"></label>
      <div class="muted" style="margin-top:4px;white-space:nowrap;font-size:min(12px,calc((100vw - 58px)/29))">ニックネームではなく、お客様のフルネームを入力してください</div><div id="rvCands"></div>
      <label class="f" style="margin-top:8px">${esc(KL)}<select id="rvK" style="${fld}"><option value="">選んでください</option>${opts}</select></label>
      <label class="f" style="margin-top:8px">人数<input type="number" id="rvN" inputmode="numeric" min="1" value="${ed?ed.guests:1}" style="${fld};text-align:right"></label>
      <div style="display:flex;gap:14px;margin-top:8px;align-items:flex-end"><div><div class="f">同伴</div><div style="display:flex;gap:8px"><button class="btn g" id="rvDh0" style="width:auto;padding:8px 18px">なし</button><button class="btn g" id="rvDh1" style="width:auto;padding:8px 18px">あり</button></div></div>
        <label class="f hide" id="rvVW" style="flex:1;min-width:0;margin:0">VIPルーム<select id="rvV" style="${fld}"><option value="">なし</option></select></label></div>
      <div id="rvDhC"></div><div id="rvVB" class="sm hide" style="color:var(--warn);font-weight:700;margin-top:6px"></div>
      <label class="f" style="margin-top:8px">メモ（任意）<textarea id="rvMemo" maxlength="300" style="min-height:60px">${ed&&ed.memo?esc(ed.memo):''}</textarea></label></div>
    <button class="btn" id="rvGo">${ed?'変更':'予約／同伴申請'}</button><p class="muted sm" style="margin:10px 2px">${ed?'変更':'申請'}すると、お店と${KL}・同伴のキャストに LINE が届きます</p>`);
  const setDh = v => { dh = v; $('rvDh1').style.background = v ? 'var(--ink)' : ''; $('rvDh1').style.color = v ? '#fff' : ''; $('rvDh0').style.background = v ? '' : 'var(--ink)'; $('rvDh0').style.color = v ? '' : '#fff'; };
  // 同伴ありは来店時刻 20:30、なしは 21:00（オーナー 2026-10-15。自分で時刻を変えていたら、そのまま）
  const setDhT = v => { const t = $('rvT'); if(t.value === (v ? '21:00' : '20:30')) t.value = v ? '20:30' : '21:00'; setDh(v); };
  // v0.79・SQL 265：同伴の子（お客様の人数まで・自分も外せる。オーナー 2026-10-27）と VIPルーム（POS の卓の名前に VIP。最初は「なし」）
  const ST = (st.data || []).slice().sort((a, b) => (b.id === me?.id) - (a.id === me?.id)) /* 小窓は「自分」を一番上に */, nmOf = id => id === me?.id ? '自分' : (ST.find(s => s.id === id)?.name || ''), guests = () => parseInt($('rvN').value, 10) || 1;
  let dhIds = ed && ed.douhan && ed.dh && ed.dh.length ? [...ed.dh] : (me ? [me.id] : []), DAY = { rooms: [], busy: [], shifts: {} };
  const chipPaint = () => { const b = $('rvDhC'); if(!b) return; const on = dh && (guests() > 1 || dhIds.length !== 1 || dhIds[0] !== me?.id);
    b.innerHTML = on ? `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px">${dhIds.map((id, i) => `<span style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:16px;padding:5px 10px;background:var(--card);font-size:15px">${esc(nmOf(id))}<button data-dhx="${i}" aria-label="外す" style="background:none;border:none;padding:0 2px;font:inherit;color:var(--warn)">×</button></span>`).join('')}${dhIds.length < guests() ? '<button class="btn g" id="rvDhAdd" style="width:auto;padding:6px 16px">追加</button>' : ''}</div>` : '';
    b.querySelectorAll('[data-dhx]').forEach(x => x.onclick = () => { dhIds.splice(+x.dataset.dhx, 1); chipPaint(); });
    if($('rvDhAdd')) $('rvDhAdd').onclick = () => dhPick(); };
  // 小窓：お客様の人数まで。人数を減らした時は、残す子を選ぶ（キャンセルは人数を戻す）
  const dhPick = (shrink) => { if(document.querySelector('.dlg[data-dh]')) return; const n = guests(), w = document.createElement('div'); w.className = 'dlg'; w.dataset.dh = '1'; let sel = [...dhIds]; /* 人数の欄の change が続けて来ても小窓は1つ */
    const paint = () => { w.innerHTML = `<div class="box"><b style="font-size:17px">同伴（${n}人まで）</b><div style="max-height:55vh;overflow:auto;margin:8px 0 12px">${ST.map(c => { const on = sel.includes(c.id), t = DAY.shifts[c.id];
        return `<label style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-top:1px solid var(--line)"><input type="checkbox" data-dc="${c.id}" ${on ? 'checked' : ''} ${!on && sel.length >= n ? 'disabled' : ''} style="width:20px;height:20px"><span style="flex:1">${esc(nmOf(c.id))}</span><span class="muted sm">${t ? esc(t) : '出勤なし'}</span></label>`; }).join('')}</div>
        <div class="bt"><button class="btn g" data-k="no">キャンセル</button><button class="btn" data-k="ok">選択</button></div></div>`;
      w.querySelectorAll('[data-dc]').forEach(x => x.onchange = () => { sel = x.checked ? [...sel, x.dataset.dc] : sel.filter(id => id !== x.dataset.dc); paint(); });
      w.querySelector('[data-k=no]').onclick = () => { if(shrink) $('rvN').value = dhIds.length; w.remove(); chipPaint(); };
      w.querySelector('[data-k=ok]').onclick = async () => { if(!sel.length){ await uiAlert('同伴のキャストを選んでください'); return; } dhIds = sel; w.remove(); chipPaint(); }; };
    paint(); document.body.appendChild(w); };
  $('rvN').addEventListener('change', () => { if(dh && dhIds.length > guests()) dhPick(true); else chipPaint(); });
  const vipPaint = () => { const v = $('rvV').value, b = $('rvVB'), r = DAY.rooms.find(x => x.id === v), T = DAY.busy.filter(x => x.vip === v).map(x => x.time);
    b.classList.toggle('hide', !(r && T.length)); b.textContent = r && T.length ? `${r.name}：${T.join('・')} 予約あり` : ''; };
  const dayLoad = async () => { const d = $('rvD').value; if(!d) return; const q = await sb.rpc('cast_resv_day', { p_token: TOKEN, p_date: d, p_id: ed ? ed.id : null }); if(q.error || $('rvD')?.value !== d) return;
    DAY = q.data; const v = $('rvV').value || (ed && !DAY.loaded ? ed.vip_id || '' : ''); $('rvV').innerHTML = `<option value="">なし</option>${(DAY.rooms || []).map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}`; $('rvV').value = v; DAY.loaded = true;
    $('rvVW').classList.toggle('hide', !(DAY.rooms || []).length); vipPaint(); };
  $('rvV').onchange = vipPaint; $('rvD').addEventListener('change', dayLoad); dayLoad();
  setDh(dh); $('rvDh0').onclick = () => { setDhT(false); chipPaint(); }; $('rvDh1').onclick = () => { setDhT(true); chipPaint(); }; chipPaint();
  // v0.31・SQL 129：顧客から選ぶ（お店の朝礼で、そのお客様のメモを確認するため）。候補に無い時は名前だけ
  const candPaint = L => { const b = $('rvCands'); if(!b) return;
    if(cid){ b.innerHTML = `<div class="sm" style="margin-top:6px;color:var(--ok);font-weight:700">✓ 顧客から選択</div>`; return; }
    b.innerHTML = L && L.length ? `<div class="muted sm" style="margin-top:8px">顧客の候補</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${L.map(x => `<button class="btn g" data-cu="${x.id}" data-nm="${esc(x.name)}" style="width:auto;padding:8px 12px">${esc(x.name)}${x.kakari?`<small class="muted">（${KL} ${esc(x.kakari)}）</small>`:''}</button>`).join('')}</div>` : '';
    b.querySelectorAll('[data-cu]').forEach(x => x.onclick = () => { cid = x.dataset.cu; $('rvC').value = x.dataset.nm; candPaint(); }); };
  $('rvC').oninput = () => { cid = null; clearTimeout(cTimer); const v = $('rvC').value.trim(); if(!v){ candPaint([]); return; }
    cTimer = setTimeout(async () => { const q = await sb.rpc('cast_customer_search', { p_token: TOKEN, p_q: v }); if($('rvC').value.trim() === v) candPaint(q.error ? [] : q.data); }, 300); };
  candPaint([]);
  // v0.50・SQL 173：来店日を選んだ時に、お店の休みならすぐ出す（ゲネプロ マイページ #5。前は申請を押した後にわかった）
  let offs = new Set(); const offPaint = () => { const d = $('rvD')?.value, b = $('rvOff'); if(!b) return; const on = !!d && offs.has(d); b.classList.toggle('hide', !on); b.textContent = on ? `${Number(d.slice(5,7))}/${Number(d.slice(8,10))} はお店の休みです。ほかの日を選んでください` : ''; };
  const dft = ed ? null : draftBind('resv', ['rvD','rvT','rvC','rvK','rvN','rvMemo']); if(dft?.had){ const n = document.createElement('div'); n.className = 'muted sm'; n.style.margin = '0 2px 8px'; n.textContent = '途中の入力を戻しました'; $('rvD').closest('.card').before(n); }
  $('rvD').addEventListener('change', offPaint); sb.rpc('cast_off_days', { p_token: TOKEN }).then(r => { if(!r.error){ offs = new Set(r.data || []); offPaint(); } });
  $('rvGo').onclick = async () => {
    const d = $('rvD').value, t = $('rvT').value, c = $('rvC').value.trim().replace(/[\s　]+/g, ' '), k = $('rvK').value, n = parseInt($('rvN').value, 10), memo = $('rvMemo').value.trim();
    if(!d || !t){ await uiAlert('来店日と来店時刻を入力してください'); return; }
    if(offs.has(d)){ await uiAlert(`${Number(d.slice(5,7))}/${Number(d.slice(8,10))} はお店の休みです。ほかの日を選んでください`); return; }
    if(!c){ await uiAlert('お客様のフルネームを入力してください'); return; }
    if(!k){ await uiAlert(KL + 'を選んでください'); return; }
    if(!(n >= 1)){ await uiAlert('人数を入力してください'); return; }
    if(dh && !dhIds.length){ await uiAlert('同伴のキャストを選んでください'); return; }
    if(dh && dhIds.length > n){ dhPick(true); return; }
    const vip = $('rvV').value || null, vn = vip ? (DAY.rooms.find(r => r.id === vip) || {}).name : null;
    const kn = $('rvK').selectedOptions[0].textContent, x = { date:d, time:t, name:c, guests:n, douhan:dh, meet:null, memo:memo || null, vip:vn, dh_names: dh ? dhIds.map(id => id === me?.id ? ME.name : nmOf(id)) : [] };
    if(!await uiConfirm(`${resvLine(x)}\n${KL} ${kn}${dh?`\n${rvDh(x, ME.name) || '同伴あり'}`:''}${vn?`\n${vn} 希望`:''}\nこの内容で${ed?'変更':'申請'}しますか？`)) return;
    $('rvGo').disabled = true;
    const q = await sb.rpc('cast_resv_submit', { p_token: TOKEN, p_id: ed ? ed.id : null, p_date: d, p_time: t, p_name: c, p_kakari: k, p_guests: n, p_douhan: dh, p_meet: null, p_memo: memo || null, p_customer: cid, p_vip: vip, p_dh: dh ? dhIds : null });
    if(q.error){ $('rvGo').disabled = false; await uiAlert(q.error.message); return; }
    dft?.clear();
    try{ await liff.sendMessages([{ type:'text', text: resvMsg(ed ? '予約変更' : '予約', x, kn === '自分' ? ME.name : kn, ME.name) }]); }catch(e){}
    await uiAlert(`${ed?'予約を変更しました':'予約／同伴申請を受付しました'}${q.data.notified?`\n${KL}・同伴のキャストにも LINE で送りました`:''}`);
    resvList();
  };
}

