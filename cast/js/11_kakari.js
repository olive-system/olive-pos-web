// 係から誘客したキャストへ「ありがとう」（決まった文＋ひとこと。1つの予約に1回。 オーナー）
function thxParam(){
  const q = new URLSearchParams(location.search); let t = q.get('thanks');
  if(!t){ const st = q.get('liff.state'); if(st) t = new URLSearchParams(st.replace(/^[^?]*\?/, '')).get('thanks'); }
  return /^[0-9a-f-]{36}$/.test(t || '') ? t : null;
}
/* 取消・送信済みを最新で判定するため、予約を引き直してから開く */
async function resvThanksById(id){
  const r = await sb.rpc('cast_resv_list', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  RESV = r.data || []; const x = RESV.find(v => v.id === id);
  if(!x){ await uiAlert('この予約は取消されたか、来店日を過ぎています'); resvList(); return; }
  if(x.thanked){ if(STORE === 'ginza') await thxSentView(x); else await uiAlert('ありがとうは送信済です'); resvList(); return; }
  resvThanks(x);
}
/* ありがとう 送信済み：送ったありがとうを小窓で（銀座。控えの文を LINE で送らない代わり。見本 作業場/見本の画像/同伴変更とありがとう_1枚のカード（11-17）.png のア） */
function thxSentView(x){
  let first = true;
  const row = (k, v) => { const top = first ? '' : 'border-top:1px solid var(--line);'; first = false; return `<div style="display:flex;gap:12px;padding:8px 0;${top}text-align:left"><span class="muted" style="flex:none;width:4.5em">${k}</span><span style="min-width:0;white-space:pre-line">${v}</span></div>`; };
  const at = x.thanked_at ? new Date(x.thanked_at) : null, tm = at ? `${mdWD(at)}${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}` : '';
  const names = String(x.name || '').split(/[、,]/).map(n => n.trim()).filter(Boolean).map(n => `${n} 様`).join('\n');
  return new Promise(res => xBox(`<p style="font-weight:700;margin-bottom:6px">ありがとう 送信済み</p>${row('お客様', esc(`${resvLine(x).split('　')[0]}　${x.guests}名\n${names}`))}${row('送信先', '誘客 ' + esc(x.by || ''))}${tm ? row('送信', tm) : ''}${x.thanks_note ? row('ひとこと', esc(x.thanks_note)) : ''}`, res));
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
    if(q.error){ if($('thGo')) $('thGo').disabled = false; await uiAlert(q.error.message); return; }
    /*点検 A3・未連携と送信失敗で文を分ける。送信失敗の時は記録せず、送り直せる */
    if(!q.data?.sent && q.data?.linked === true){ if($('thGo')) $('thGo').disabled = false; await uiAlert('ありがとうの送信に失敗しました。再度お試しください'); return; }
    await uiAlert(q.data?.sent ? `${x.by}さんにありがとうを送信しました` : `ありがとうを記録しました。\n${x.by}さんは LINE 未連携のため、LINE は届いていません`);
    resvList();
  };
}
/* LINE の送信に失敗した時は、欠勤連絡と同じ文を一覧の上に出す（前は何も出さなかった） */
async function resvListNg(lineOk, what){ await resvList(); if(!lineOk) $('main').insertAdjacentHTML('afterbegin', lineNg(what, '黒服')); }
/* 取消は先に確定する。LINE が失敗しても取消は戻さず、一覧の上に出す */
async function resvCancel(x, b){
  if(!await uiConfirm(`${resvLine(x)}\nこの予約を取り消しますか？`, '取消')) return;
  if(b) b.disabled = true; /* 送っている間は押せない（2回押し） */
  const q = await sb.rpc('cast_resv_cancel', { p_token: TOKEN, p_id: x.id });
  if(q.error){ if(b) b.disabled = false; await uiAlert(q.error.message); return; }
  const lineOk = await lineSend(resvMsg('予約取消', x, x.kakari_name || '', ME.name), '予約取消');
  await uiAlert('予約を取り消しました');
  resvListNg(lineOk, '予約取消');
}
// 予約の申請・変更の画面（lib/olive/resv_form.js の resvFormOpen）を、女性のマイページ・黒服のマイページ（hall）から開く
/* 画面側の呼び名を、女性・黒服のどちらからでも使う rpc 名に置き換える表 */
const RV_RPC = { staff: 'cast_resv_staff', day: 'cast_resv_day', search: 'cast_customer_search', offs: 'cast_off_days', same: 'cast_customer_same_name', vip: 'cast_resv_vip_check', shift: 'cast_shift_request' };
const castResvA = hall => ({ mode: hall ? 'hall' : 'cast', NK: RV_NOKK(), meName: ME.name, draft: !hall,
  rpc: (n, a) => sb.rpc(n === 'submit' ? (hall ? 'hall_resv_submit' : 'cast_resv_submit') : RV_RPC[n], { p_token: TOKEN, ...a }),
  open: () => setBack(hall ? hallChorei : resvList), show, fail, note: () => hall ? '' : lineOutNote(),
  done: async (R, q, x, kn) => { const NK = R.NK;
    if(hall){ await uiAlert(`予約を変更しました${q.data.notified?`\n${NK?'':KL+'・'}同伴のキャストにも LINE で送りました`:''}`); hallChorei(true); return; }
  const { ed } = R, lineOk = await lineSend(resvMsg(ed ? '予約変更' : '予約', x, kn === '自分' ? ME.name : kn, ME.name), ed ? '予約変更' : '予約申請');
  let srMsg = ''; if(rvSrOn(R)){ const w = await R.A.rpc('shift', { p_resv: q.data.id, p_time: $('rvST').value });
    srMsg = w.error ? `\n出勤希望：${w.error.message}` : w.data?.auto ? '\n出勤のシフトが入りました' /* シフトが未確定の月は承認なしで出勤 */ : w.data?.sent ? '\n出勤希望は、承認者に LINE で送りました' : '\n出勤希望の LINE が承認者に届いていません。お店にご連絡ください'; }
  await uiAlert(`${ed?'予約を変更しました':'予約／同伴申請を受付しました'}${q.data.notified?`\n${NK?'':KL+'・'}同伴のキャストにも LINE で送りました`:''}${srMsg}`);
  resvListNg(lineOk, ed ? '予約変更' : '予約'); } });
async function castResvForm(ed, hall){ return resvFormOpen(ed, castResvA(hall)); }
