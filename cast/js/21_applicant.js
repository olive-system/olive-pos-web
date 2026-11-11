// v1.18・SQL 347：応募から入店（2026-11-04 オーナー。決まり 仕様書/応募から入店の動線（2026-11-04）.md・見本 作業場/応募者_シフトにまとめる_案6.png・応募者_マイページ_案4.png）
//   ［応募者］のボタンは作らない。シフト（全員）の面接・体験の名前を押すと、その人のページ（全員のシフトを見られる人＝黒服・ママ）
//   一番上にバストアップ写真と担当・区分・電話。面接（面接結果・体験日と報酬・ヒアリングシートとバストアップ写真）→ 体験（体験結果・よかった点・気になった点）→ 入店（契約書は対面で［開始］）／辞退（次回連絡日）
//   写真は公開の置き場に置かない（顔とヒアリングシート）。ap_photo で1枚ずつ読む
const AP_PT = ['給料', '人間関係（キャスト）', '人間関係（黒服）', '雰囲気', '客層', '時間', 'その他'];
const AP_FS = 'width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)';
// 体験の人のしるし：名前を丸で囲む。外側の線（outline）で描くので、文字の大きさ・行の高さ・幅はほかの名前と同じ（オーナー 2026-11-04「体験の子だけスペース食ってない？」）
// v1.43：応募者が無い体験の子（シフトの［追加］→ 体験で登録）も押せる形にして、押したら案内（2026-11-06 オーナー「押しても何も起きない」）
const apRing = (name, id) => `<span data-ap="${id || ''}" style="white-space:nowrap;border-radius:999px;outline:1.5px solid var(--pri);outline-offset:2px;cursor:pointer">${esc(name)}</span>`;
const apOpen = (id, store, back) => id ? apPage(id, store, back) : uiAlert('応募者ページはありません\n入店は POS の編集で、区分を体験からキャストに変更してください');
const apLegend = () => `<span style="margin-left:12px;font-weight:400;white-space:nowrap"><span style="display:inline-block;width:1.8em;height:1.1em;border:1.5px solid var(--pri);border-radius:999px;vertical-align:-0.2em;box-sizing:border-box"></span> 体験</span>`;
const apDt = iso => { if(!iso) return '未定'; const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return `${d.getUTCMonth()+1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`; };
const apIsoDay = iso => iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10) : '';
const apIsoTime = iso => iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(11, 16) : '20:00';
// v1.21：シフトの時刻と同じく 19:50 と 20:00〜23:00（PR #343）
const AP_T = ['19:50', ...Array.from({ length: 13 }, (_, i) => `${20 + Math.floor(i / 4)}:${String(i % 4 * 15).padStart(2, '0')}`)];
const AP_IV_T = Array.from({ length: 24 }, (_, i) => `${12 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`); // 面接の時刻 12:00〜23:30
const apSel = (opts, v, attr) => `<select ${attr} style="${AP_FS}">${opts.map(([k, n]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
const apChk = (k, name, on) => `<label style="display:flex;align-items:center;gap:6px;padding:7px 0;font-size:14px;white-space:nowrap;color:var(--ink);margin:0"><input type="checkbox" data-${k}="${esc(name)}" ${on ? 'checked' : ''} style="width:18px;height:18px;margin:0;accent-color:var(--pri)">${esc(name)}</label>`;
const apGrid = (k, on) => `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:6px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:8px">${AP_PT.map(t => apChk(k, t, (on || []).includes(t))).join('')}</div>`;
const apSeg = (k, opts, v) => `<div class="seg" data-seg="${k}">${opts.map(([x, n]) => `<button type="button" data-v="${x}" class="${x === v ? 'on' : ''}" style="white-space:nowrap;padding:9px 4px">${n}</button>`).join('')}</div>`;

async function apPhotoUrl(store, id){ const r = await sb.rpc('ap_photo', { p_token: TOKEN, p_store: store || null, p_photo: id }); return r.error ? '' : r.data; }
const apBlob64 = blob => new Promise((ok, ng) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = ng; f.readAsDataURL(blob); });
// 写真を撮る（カメラ）→ 縮めて送る（09_dress.js の shrinkJpeg）
// v1.34：入力欄を画面に置いてから開く（画面に無い入力欄は、iPhone の LINE でカメラから戻った時に写真が届かないことがある。2026-11-05 広島で1回あった）
function apShoot(store, id, kind, done){ document.querySelectorAll('input[data-apshoot]').forEach(x => x.remove());
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment'; i.dataset.apshoot = '1'; i.style.display = 'none'; document.body.appendChild(i);
  i.onchange = async () => { const f = i.files && i.files[0]; i.remove(); if(!f) return; try{ const d = await apBlob64(await shrinkJpeg(f));
    const r = await sb.rpc('ap_photo_add', { p_token: TOKEN, p_store: store || null, p_id: id, p_kind: kind, p_data: d }); if(r.error){ await uiAlert(r.error.message); return; } done(); }catch(e){ await uiAlert('写真を送信できませんでした'); } };
  i.click(); }
// 写真を大きく表示（削除もここ）
async function apPhotoBig(store, id, src, done){ /* v1.39：閉じるは右上の × */
  const w = xBox(`<img src="${src}" style="width:100%;border-radius:8px;display:block;margin-top:16px"><div class="bt" style="margin-top:12px"><button class="btn g" data-k="del" style="color:var(--warn)">削除</button></div>`);
  w.querySelector('[data-k=del]').onclick = async () => { if(!await uiConfirm('この写真を削除しますか？', '削除')) return; const r = await sb.rpc('ap_photo_del', { p_token: TOKEN, p_store: store || null, p_photo: id }); w.remove(); if(r.error){ await uiAlert(r.error.message); return; } done(); }; }

async function apPage(id, store, back){
  setBack(back); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('ap_get', { p_token: TOKEN, p_store: store || null, p_id: id }); if(r.error){ fail(r.error.message); return; }
  const A = r.data, again = () => apPage(id, store, back), ivOpen = ['applied', 'interview', 'trial', 'declined', 'rejected'].includes(A.status) && !A.joined;
  const P = apParts({ id, store, back, A, again, ivOpen });
  show(`<div class="ttl">${esc(A.name || A.line_name || '（名前なし）')}</div>${apTop(P)}${apIv(P)}${apTr(P)}${apRest(P)}`);
  apBindBase(P); apBindIv(P); apBindTr(P); apBindDocs(P); }
/* 画面の部品（写真の小さい絵・見出しと値・面接と体験の結果の今の選択・ヒアリングシート） */
function apParts(P){ const { A } = P;
  const thumb = (p, w, h) => `<img data-ph="${p.id}" alt="" style="flex:none;width:${w}px;height:${h}px;object-fit:cover;border:1px solid var(--line);border-radius:8px;background:var(--soft);cursor:pointer">`;
  const bust = (A.photos || []).filter(p => p.kind === 'bust'), sheet = (A.photos || []).filter(p => p.kind === 'sheet');
  const kv = (k, v) => `<div style="display:flex;gap:8px;padding:6px 0;align-items:baseline"><span class="muted" style="flex:none;width:3em">${k}</span><span style="min-width:0">${v}</span></div>`;
  const kindTxt = A.kind === 'hall' ? '黒服' : 'キャスト';
  const ivRes = ({ trial: 'trial', considering: 'trial', joined: 'joined', declined: 'declined', rejected: 'rejected' })[A.status] || '';
  /* v1.33：バストアップの撮影は左上の四角だけ（同じ撮影が2か所で迷う。オーナー 2026-11-05「直感的に操作したい」） */
  /* v1.33：バストアップの撮影は左上の四角だけ（同じ撮影が2か所で迷う。オーナー 2026-11-05「直感的に操作したい」） */
  const photos = `<div style="margin-top:12px"><div class="f">ヒアリングシート</div><div style="display:flex;gap:6px;flex-wrap:wrap">${sheet.map(p => thumb(p, 64, 86)).join('')}<button type="button" class="btn g" data-shoot="sheet" style="width:64px;height:86px;padding:0">撮影</button></div></div>`;
  const hl = sheetLines(A.hearing); /* v1.21・SQL 350：本人が LINE で入力したヒアリングシート */
  const hs = `<div style="display:flex;align-items:center;gap:8px;margin-top:14px;border-top:1px solid var(--line);padding-top:10px"><b style="flex:1">ヒアリングシートの入力内容</b><button class="btn g" id="apSh" style="width:auto;padding:8px 16px">編集</button></div>` + (hl.length ? `<div class="sm" style="line-height:1.8;padding-top:6px">${hl.map(([k, v]) => `<div style="display:flex;gap:8px"><span class="muted" style="flex:none;width:45%">${esc(k)}</span><span style="min-width:0">${esc(v)}</span></div>`).join('')}</div>` : '');
  /* v1.42・SQL 388：体験結果に不採用。ジャッジが不採用なら最初から選択。辞退・不採用は理由が必須（オーナー 2026-11-06「入店にならなかった場合、その理由を強制的に」） */
  const trRes = ({ joined: 'joined', considering: 'considering', declined: 'declined', rejected: 'rejected' })[A.status] || (A.status === 'trial' && A.judge === 'not' ? 'rejected' : '');
  return { ...P, thumb, bust, sheet, kv, kindTxt, ivRes, photos, hl, hs, trRes }; }
function apTop(P){ const { id, store, back, A, again, ivOpen, thumb, bust, sheet, kv, kindTxt, ivRes, photos, hl, hs, trRes } = P; return `<div class="card"><div style="display:flex;gap:12px;align-items:flex-start">
      ${bust.length ? thumb(bust[0], 84, 112) : `<button type="button" data-shoot="bust" style="flex:none;width:84px;height:112px;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--muted);font:inherit;font-size:12px;padding:0;white-space:nowrap;cursor:pointer">バストアップ</button>`}
      <div style="flex:1;min-width:0"><label class="f">担当黒服${apSel([['', '未定'], ...(A.halls || []).map(h => [h.id, h.name])], A.hall_staff_id || '', 'id="apHall"')}</label>
      ${A.trial_name || A.joined ? kv('区分', kindTxt) : `<div style="margin-top:6px">${apSel([['cast', 'キャスト'], ['hall', '黒服']], A.kind, 'id="apKind"')}</div>`}
      ${A.phone ? kv('電話', `<span style="white-space:nowrap">${esc(A.phone)}</span>`) : ''}</div></div>
      ${A.line ? '' : `<div style="display:flex;align-items:center;gap:8px;margin-top:10px;border-top:1px solid var(--line);padding-top:10px"><b style="flex:1">LINE</b><span class="muted" style="flex:none">未追加</span><button class="btn" id="apQr" style="width:auto;padding:8px 16px">QR表示</button></div>`}</div>`; }
// 面接
function apIv(P){ const { id, store, back, A, again, ivOpen, thumb, bust, sheet, kv, kindTxt, ivRes, photos, hl, hs, trRes } = P; return `<div class="card"><div class="gh">面接　${esc(apDt(A.interview_at))}</div>
    ${ivOpen ? `<div class="f">面接結果</div>${apSeg('iv', [['trial', '体験'], ['joined', '入店'], ['declined', '辞退'], ['rejected', '不採用']], ivRes)}
      <div id="apTrialIn" style="${ivRes === 'trial' ? '' : 'display:none'}">
        <div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:8px"><label class="f">体験日<input id="apTd" type="date" value="${apIsoDay(A.trial_at)}" min="${A.today}" style="${AP_FS}"></label><label class="f">時刻${apSel(AP_T.map(t => [t, t]), apIsoTime(A.trial_at), 'id="apTt"')}</label></div>
        <label class="f" style="margin-top:8px">体験の報酬</label><div style="display:flex;gap:8px"><select id="apTp" style="${AP_FS};width:auto;flex:none">${[['hourly', '時給'], ['daily', '日給']].map(([k, n]) => `<option value="${k}" ${k === (A.trial_pay_type || 'daily') ? 'selected' : ''}>${n}</option>`).join('')}</select><input id="apTa" type="number" inputmode="numeric" min="1" placeholder="円" value="${A.trial_pay_amount || ''}" style="${AP_FS};flex:1;min-width:0"></div>
        ${A.name ? '' : `<label class="f" style="margin-top:8px">名前<input id="apNm" maxlength="30" style="${AP_FS}"></label>`}
        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin-top:8px"><label class="f">本名<input id="apRn" maxlength="60" value="${esc(A.real_name || '')}" style="${AP_FS}"></label><label class="f">希望源氏名<input id="apGn" maxlength="30" placeholder="例）サヤ・ハル" value="${esc(A.trial_name && A.trial_name !== A.name ? A.trial_name : '')}" style="${AP_FS}"></label></div></div>
      ${photos}<button class="btn" id="apIvOk" style="margin-top:14px">保存</button>` : `<div style="padding:4px 0">面接結果　${esc(({ trial: '体験', considering: '体験', joined: '入店', declined: '辞退', rejected: '不採用' })[A.status] || '')}</div>${photos}`}${hs}</div>`; }
// 体験
function apTr(P){ const { id, store, back, A, again, ivOpen, thumb, bust, sheet, kv, kindTxt, ivRes, photos, hl, hs, trRes } = P; return A.trial_name ? `<div class="card"><div class="gh">体験　${esc(apDt(A.trial_at))}</div>
    ${A.joined ? '<div style="padding:4px 0">体験結果　入店</div>' : `<div class="f">体験結果</div>${apSeg('tr', [['joined', '入店'], ['considering', '検討中'], ['declined', '辞退'], ['rejected', '不採用']], trRes)}`}
    <div class="f">よかった点</div>${apGrid('good', A.good)}<div class="f" style="margin-top:8px">気になった点</div>${apGrid('concern', A.concern)}
    <div id="apRsIn" style="${['declined', 'rejected'].includes(trRes) ? '' : 'display:none'}"><label class="f" style="margin-top:8px">理由<span style="color:var(--warn)">（必須）</span></label><textarea id="apRs" maxlength="500" style="min-height:70px">${esc(A.trial_reason || '')}</textarea></div>
    <button class="btn" id="apTrOk" style="margin-top:12px">保存</button></div>` : ''; }
/* 体験のあと：ご感想・入店（契約書は対面）・辞退（次回連絡日）・メモ */
function apRest(P){ const { id, store, back, A, again, ivOpen, thumb, bust, sheet, kv, kindTxt, ivRes, photos, hl, hs, trRes } = P;
  const jn = A.joined ? `<div class="card"><div style="display:flex;align-items:center;gap:8px"><b style="flex:1">契約書</b>${A.docs_hold ? '<span class="muted" style="flex:none">未開始</span><button class="btn" id="apDoc" style="width:auto;padding:8px 16px">開始</button>' : '<span class="muted">開始済</span>'}</div></div>` : '';
  const dc = A.status === 'declined' ? `<div class="card"><label class="f">次回連絡日<input id="apNx" type="date" value="${A.next_contact || ''}" style="${AP_FS}"></label></div>` : '';
  const vc = A.voice ? `<div class="card"><div class="gh">ご感想（${esc(apDt(A.voice_at))}）</div><div class="sm" style="line-height:1.7">よかった点：${esc((A.voice.good || []).join('・') || 'なし')}<br>気になった点：${esc((A.voice.concern || []).join('・') || 'なし')}${A.voice.text ? `<br>ひとこと：${esc(A.voice.text)}` : ''}</div></div>` : '';
  const memo = `<div class="card"><label class="f">メモ<textarea id="apMemo" maxlength="500">${esc(A.memo || '')}</textarea></label></div>`;
  return `${vc}${jn}${dc}${memo}`; }
/* 押した時の動き：区切りのボタン・担当黒服・区分・メモ・次回連絡日・写真 */
function apBindBase(P){ const { id, store, back, A, again, ivOpen, thumb, bust, sheet, kv, kindTxt, ivRes, photos, hl, hs, trRes } = P; const M = $('main'); const save = p => apSave(P, p);
  M.querySelectorAll('[data-seg]').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => { s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); if(s.dataset.seg === 'iv' && $('apTrialIn')) $('apTrialIn').style.display = b.dataset.v === 'trial' ? '' : 'none'; if(s.dataset.seg === 'tr' && $('apRsIn')) $('apRsIn').style.display = ['declined', 'rejected'].includes(b.dataset.v) ? '' : 'none'; }));
  $('apHall').onchange = () => save({ hall_staff_id: $('apHall').value });
  if($('apKind')) $('apKind').onchange = () => save({ kind: $('apKind').value });
  $('apMemo').onchange = () => save({ memo: $('apMemo').value });
  if($('apNx')) $('apNx').onchange = () => save({ next_contact: $('apNx').value });
  M.querySelectorAll('[data-shoot]').forEach(b => b.onclick = () => apShoot(store, id, b.dataset.shoot, again));
  M.querySelectorAll('img[data-ph]').forEach(async im => { const src = await apPhotoUrl(store, im.dataset.ph); if(src) im.src = src; im.onclick = () => im.src && apPhotoBig(store, im.dataset.ph, im.src, again); });
}
/* 1つの項目を保存（読めない時は知らせて開き直す） */
async function apSave(P, p){ const { id, store, again } = P; const q = await sb.rpc('ap_save', { p_token: TOKEN, p_store: store || null, p_id: id, p }); if(q.error){ await uiAlert(q.error.message); again(); return false; } return true; }
function apSegV(k){ const b = $('main').querySelector(`[data-seg="${k}"] button.on`); return b ? b.dataset.v : ''; }
/* 面接の結果の保存 */
function apBindIv(P){ const { id, store, back, A, again, ivOpen, thumb, bust, sheet, kv, kindTxt, ivRes, photos, hl, hs, trRes } = P; const M = $('main'); const segV = apSegV, save = p => apSave(P, p);
  /* 本名がそのままシフトに出ないように。カタカナにそろえる（ひらがなで入れてもカタカナに） */
  if($('apGn')) $('apGn').onblur = () => { $('apGn').value = kanaKey($('apGn').value); };
  if($('apIvOk')) $('apIvOk').onclick = async e => { const v = segV('iv'); if(!v){ await uiAlert('面接結果を選んでください'); return; }
    if($('apNm')){ const n = $('apNm').value.trim(); if(!n){ await uiAlert('名前を入力してください'); return; } if(!await save({ name: n })) return; }
    if(v === 'joined' && !await uiConfirm('入店にしますか？\n在籍に追加して、LINE も連携します', '入店')) return;
    if(v === 'rejected' && !await uiConfirm('不採用にしますか？', '不採用')) return;
    e.target.disabled = true;
    const q = await sb.rpc('ap_interview_result', { p_token: TOKEN, p_store: store || null, p_id: id, p_result: v, p_day: v === 'trial' ? $('apTd').value || null : null, p_time: v === 'trial' ? $('apTt').value : null,
      p_pay_type: v === 'trial' ? $('apTp').value : null, p_amount: v === 'trial' ? (parseInt($('apTa').value || '0', 10) || 0) : null, p_real: v === 'trial' ? $('apRn').value.trim() : null, p_genji: v === 'trial' ? kanaKey($('apGn').value) || null : null });
    if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; } again(); };
}
/* 体験の結果の保存 */
function apBindTr(P){ const { id, store, back, A, again, ivOpen, thumb, bust, sheet, kv, kindTxt, ivRes, photos, hl, hs, trRes } = P; const M = $('main'); const segV = apSegV;
  if($('apTrOk')) $('apTrOk').onclick = async e => { const v = A.joined ? 'joined' : segV('tr'); if(!v){ await uiAlert('体験結果を選んでください'); return; }
    if(v === 'joined' && !A.joined && !await uiConfirm('入店にしますか？\n在籍に追加して、LINE も連携します', '入店')) return;
    const pick = k => [...M.querySelectorAll(`[data-${k}]`)].filter(x => x.checked).map(x => x.dataset[k]);
    const rs = ['declined', 'rejected'].includes(v) ? $('apRs').value.trim() : null; if(rs === ''){ await uiAlert('理由を入力してください'); return; }
    e.target.disabled = true;
    const q = await sb.rpc('ap_trial_result', { p_token: TOKEN, p_store: store || null, p_id: id, p_result: v, p_good: pick('good'), p_concern: pick('concern'), p_memo: $('apMemo').value, p_reason: rs });
    if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; } again(); };
}
/* ヒアリングシートの編集・LINE の QR・契約書 */
function apBindDocs(P){ const { id, store, back, A, again, ivOpen, thumb, bust, sheet, kv, kindTxt, ivRes, photos, hl, hs, trRes } = P; const M = $('main');
  $('apSh').onclick = () => sheetStaff(id, store, again); /* v1.21：お店が書き込む */
  if($('apQr')) $('apQr').onclick = async e => { e.target.disabled = true; const q = await sb.rpc('ap_qr', { p_token: TOKEN, p_store: store || null, p_id: id }); e.target.disabled = false; if(q.error){ await uiAlert(q.error.message); return; } /* v1.19・SQL 348：15分の間の友だち追加をこの人につなぐ */
    await needLib('qrcode'); const qr = qrcode(0, 'M'); qr.addData(q.data); qr.make(); /* QR の部品は使う時だけ読む（07 の S1） */ xBox(`<p style="font-weight:700;margin:0 0 10px">${esc(STORE === 'hiroshima' ? 'OLIVE 広島' : 'OLIVE 銀座')}　公式 LINE</p><div style="display:flex;justify-content:center">${qr.createSvgTag(6, 8)}</div>`, again); }; /* v1.39：閉じるは右上の × */
  if($('apDoc')) $('apDoc').onclick = async e => { if(!await uiConfirm('契約書を開始しますか？\n本人のマイページに「書類」が表示されます', '開始')) return; e.target.disabled = true;
    const q = await sb.rpc('ap_docs_open', { p_token: TOKEN, p_store: store || null, p_id: id }); if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; } again(); };
}

// シフトの［追加］→「面接」（スカウトの紹介でいきなり面接の時。オーナー 2026-11-04）
function apIvAddDlg(w, iso, store, back, done){ const d = new Date(iso + 'T00:00:00+09:00'), lb = t => `<div class="muted sm" style="margin:10px 0 4px">${t}</div>`, fs = 'width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card)';
  w.innerHTML = `<div class="box"><p style="font-weight:700;margin-bottom:4px">面接　${mdWD(d)}</p>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px"><div>${lb('名前')}<input id="ivN" maxlength="30" style="${fs}"></div><div>${lb('時刻')}<select id="ivT" style="${fs}">${AP_IV_T.map(t => `<option ${t === '19:00' ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    ${lb('区分')}<select id="ivK" style="${fs}"><option value="cast">キャスト</option><option value="hall">黒服</option></select>
    <div class="bt" style="margin-top:14px"><button class="btn g" data-k="no">戻る</button><button class="btn" data-k="ok">追加</button></div></div>`;
  w.querySelector('[data-k=no]').onclick = back;
  w.querySelector('[data-k=ok]').onclick = async e => { const n = w.querySelector('#ivN').value.trim(); if(!n){ await uiAlert('名前を入力してください'); return; } e.target.disabled = true;
    const q = await sb.rpc('ap_iv_add', { p_token: TOKEN, p_store: store || null, p_day: iso, p_name: n, p_time: w.querySelector('#ivT').value, p_kind: w.querySelector('#ivK').value });
    if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; } done(); };
}

// v1.19・SQL 348：応募の人に届く LINE のボタン（LINE連携していない人も開く）。［面接予約］は押した時刻を残して予約ページへ・［ご感想］は体験の翌日
async function apLiff(go){
  if($('tSub')) $('tSub').textContent = ''; document.title = STORE === 'hiroshima' ? 'OLIVE 広島' : 'OLIVE 銀座'; /* 応募の人に「LINEマイページ」は出さない */
  const idt = liff.getIDToken(); if(!idt){ liff.login({ redirectUri: location.href }); return; }
  show('<div class="card c muted">読み込み中…</div>');
  if(go === 'book'){ const r = await sb.rpc('applicant_book', { p_store: STORE, p_id_token: idt }); if(r.error){ fail(r.error.message); return; }
    show('<div class="card c muted">面接予約のページを表示しています…</div>'); try{ liff.openWindow({ url: r.data, external: false }); }catch(e){ location.href = r.data; } return; }
  if(go === 'judge'){ document.title = '体験のジャッジ'; await judgeLiff(idt); return; } /* v1.23・SQL 355（24_judge.js） */
  if(go === 'sheet'){ await sheetForm(idt); return; } /* v1.21・SQL 350（22_sheet.js） */
  const g = await sb.rpc('applicant_voice_get', { p_store: STORE, p_id_token: idt }); if(g.error){ fail(g.error.message); return; }
  if(!g.data.ok){ fail('表示できません'); return; }
  if(g.data.sent){ show('<div class="card">ご感想は送信済です。<br>ありがとうございました🙇‍♀️</div>'); return; }
  show(`<div class="ttl">ご感想</div><div class="card"><div class="f">よかった点</div>${apGrid('good', [])}<div class="f" style="margin-top:12px">気になった点</div>${apGrid('concern', [])}
    <label class="f" style="margin-top:10px">ひとこと（任意）<textarea id="vcT" maxlength="500"></textarea></label><button class="btn" id="vcOk" style="margin-top:14px">送信</button></div>`);
  $('vcOk').onclick = async e => { const M = $('main'), pick = k => [...M.querySelectorAll(`[data-${k}]`)].filter(x => x.checked).map(x => x.dataset[k]); e.target.disabled = true;
    const q = await sb.rpc('applicant_voice_save', { p_store: STORE, p_id_token: idt, p_good: pick('good'), p_concern: pick('concern'), p_text: $('vcT').value });
    if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; }
    show('<div class="card">送信しました。<br>ありがとうございました🙇‍♀️</div>'); };
}
