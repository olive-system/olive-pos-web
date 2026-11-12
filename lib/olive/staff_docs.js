/* スタッフの書類（従業者名簿・契約書・ヒアリングシート・本人確認書類・バストアップ）。SQL 445。
   POS の在籍キャストの［編集］の「書類」（撮影・削除）と、管理サイトのスタッフの画面の［書類］のタブ（閲覧のみ）で同じ部品を使う。
   写真を入れたら提出済、その書類の写真を全部消したら未提出（データベースの関数が決める）。今「済」で写真が無い人は済のまま「写真なし」と出す */
const SD_KINDS = [['roster', '従業者名簿', 'doc_roster_ok'], ['contract', '契約書', 'contract_done'], ['sheet', 'ヒアリングシート', null], ['id', '本人確認書類', 'doc_id_ok'], ['bust', 'バストアップ', null]];
const sdPhotos = (D, k) => (D.photos || []).filter(p => p.kind === k);
const sdHear = (D, k) => k === 'sheet' && D.hearing && Object.keys(D.hearing).length > 0;   // LINEマイページで入力したヒアリングシート
const sdSign = (D, k) => k === 'contract' && !!D.signed;                                     // LINEマイページの署名
// 状態：ok 提出済・sign 署名済・nophoto 提出済で写真なし・no 未提出・'' チェックなし（ヒアリングシート・バストアップ）
// 契約書は写真ではなく LINEマイページの署名で出すので、前に紙で済んだ人（写真なし）にも「写真なし」を出さない
function sdState(D, k, f){ if(!f) return ''; if(sdSign(D, k)) return 'sign'; if(D[f]) return sdPhotos(D, k).length || k === 'contract' ? 'ok' : 'nophoto'; return 'no'; }
function sdStateHtml(st){ return st === 'ok' ? '<span style="color:var(--ok);font-weight:700;white-space:nowrap">☑ 提出済</span>'
  : st === 'sign' ? '<span style="color:var(--ok);font-weight:700;white-space:nowrap">☑ 署名済</span>'
  : st === 'nophoto' ? '<span style="color:var(--ok);font-weight:700;white-space:nowrap">☑ 提出済</span><span style="color:var(--warn);font-weight:700;white-space:nowrap">写真なし</span>'
  : st === 'no' ? '<span style="color:var(--muted);white-space:nowrap">☐ 未提出</span>' : ''; }
const sdYmd = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const SD_CAM = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
// 小窓（POS・管理サイトの .modal .box と同じ形。右上の × と、外を押すと閉じる）
function sdModal(html){ const m = document.createElement('div'); m.className = 'modal on'; m.style.zIndex = 58; /* 確かめの箱（POS 60）より下・ほかの小窓より上 */
  m.innerHTML = `<div class="box" style="width:min(760px,94vw)"><button type="button" class="xb dx" aria-label="閉じる">×</button>${html}</div>`;
  const close = () => m.remove(); m.querySelector('.dx').onclick = close; m.onclick = e => { if(e.target === m) close(); };
  document.body.appendChild(m); return m; }
// 写真を全画面で
function sdBig(src){ const m = sdModal(`<img src="${src}" alt="" style="display:block;max-width:100%;max-height:80vh;margin:0 auto;border-radius:8px">`); return m; }
// ヒアリングシート（LINEマイページで入力した中身）
function sdHearHtml(name, D, hr){ const L = sheetLines(D.hearing, hr);
  return `<h3 style="margin:0 0 4px">${esc(name)}　ヒアリングシート</h3><div style="color:var(--muted);font-size:12px;margin-bottom:8px">LINEマイページで入力${D.hearing_at ? '　' + sdYmd(D.hearing_at) : ''}</div>`
    + L.map(([k, v]) => `<div style="display:flex;gap:12px;padding:5px 0;border-top:1px solid var(--line);font-size:14px;text-align:left"><span style="color:var(--muted);width:11em;flex:none">${esc(k)}</span><span style="white-space:pre-wrap">${esc(v)}</span></div>`).join(''); }
// 写真を1枚ずつ読んで <img data-sdp> に入れる（load＝rpc を呼ぶ関数。読めない時は知らせる）
async function sdFill(box, load, big = true){ for(const im of box.querySelectorAll('img[data-sdp]')){ const r = await load(im.dataset.sdp, im.dataset.ap === '1');
  if(r.error){ await uiAlert('写真を表示できません：' + r.error.message); return; } im.src = r.data; if(big) im.onclick = e => { e.stopPropagation(); sdBig(r.data); }; } }
