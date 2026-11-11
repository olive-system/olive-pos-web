// SQL 445：在籍キャストの［編集］の「書類」（2026-11-11 オーナー「黒服がアップロード」「セキュリティを考えると POS」「アップロードしないとチェックが入らないように」）。
//   5つの四角：写真が無い書類は点線の四角（押すとカメラか写真から選ぶ。入力欄は画面の中の label に置く＝スキル olive-photo-shoot）、写真があれば押すと小窓（追加・削除）。
//   ヒアリングシートは LINEマイページで入力した人は入力内容、契約書は LINEマイページで署名した人は署名の日。部品は lib/olive/staff_docs.js（管理サイトと同じ）
async function posDocs(s){ const box = $('cDocs'); if(!box || cSel !== s) return;
  box.innerHTML = '<span class="muted">読み込み中…</span>';
  const r = await sb.rpc('pos_staff_docs', { p_staff: s.id }); if(cSel !== s) return;
  if(r.error){ box.innerHTML = `<span style="color:var(--warn)">書類を表示できません：${esc(r.error.message)}</span>`; return; }
  const D = r.data || {}; ['contract_done', 'doc_id_ok', 'doc_roster_ok'].forEach(k => { s[k] = D[k]; }); /* 一覧の印もそろえる */
  const W = 68, H = Math.round(W * 4 / 3), sq = `width:${W}px;height:${H}px;border-radius:8px;box-sizing:border-box`;
  const sdTile = ([k, n, f]) => { const P = sdPhotos(D, k), st = sdState(D, k, f);
    const face = sdSign(D, k) && !P.length ? `<button type="button" data-sdv="${k}" style="${sq};border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:11px;line-height:1.5;padding:6px;text-align:left">LINEマイページで署名</button>`
      : sdHear(D, k) ? `<button type="button" data-sdv="${k}" style="${sq};border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:11px;line-height:1.5;padding:6px;text-align:left">LINEマイページで入力</button>`
      : P.length ? `<button type="button" data-sdv="${k}" style="${sq};border:0;padding:0;position:relative;background:var(--soft);overflow:hidden"><img data-sdp="${P[0].id}" data-ap="${P[0].ap ? 1 : 0}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">${P.length > 1 ? `<span style="position:absolute;right:4px;bottom:4px;background:var(--ink);color:var(--card);border-radius:4px;padding:0 5px;font-size:11px">${P.length}枚</span>` : ''}</button>`
      : `<label style="${sq};border:1px dashed var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--muted);font-size:12px;cursor:pointer">${SD_CAM}撮影<input type="file" accept="image/*" data-sdadd="${k}" style="display:none"></label>`;
    return `<div style="width:${W}px;display:flex;flex-direction:column;gap:3px;font-size:12px">${face}<b style="color:var(--ink);font-weight:500;font-size:11px;line-height:1.3;min-height:2.6em;white-space:nowrap">${k === 'sheet' ? 'ヒアリング<br>シート' : n}</b>${sdStateHtml(st)}</div>`; };
  box.style.gap = '10px 4px'; box.innerHTML = SD_KINDS.map(sdTile).join('');
  posDocsWire(box, s, D);
  sdFill(box, (id, ap) => sb.rpc('pos_staff_doc_photo', { p_id: id, p_ap: ap }), false); /* 四角を押すと小窓（全画面は小窓の中で） */
}
// 撮影（入力欄は画面の中。縮めて送り、送れたらその場で四角を写真に）
async function posDocsAdd(inp, s){ const f = inp.files && inp.files[0], k = inp.dataset.sdadd, n = SD_KINDS.find(x => x[0] === k)[1]; inp.value = ''; if(!f) return false;
  try{ const d = await blob64(await shrinkJpeg(f)); const q = await sb.rpc('pos_staff_doc_add', { p_staff: s.id, p_kind: k, p_data: d });
    if(q.error){ await uiAlert('写真を保存できません：' + q.error.message); return false; }
    await logOp('書類の撮影', { name: s.display_name, doc: n }, null, true); toast(`${n}を保存しました`); return true;
  }catch(e){ await uiAlert('写真を保存できません：' + (e && e.message || e)); return false; } }
function posDocsWire(box, s, D){
  box.querySelectorAll('input[data-sdadd]').forEach(i => i.onchange = async () => { if(await posDocsAdd(i, s)) posDocs(s); });
  box.querySelectorAll('[data-sdv]').forEach(b => b.onclick = () => posDocsOpen(s, D, b.dataset.sdv));
}
// 小窓：写真（追加・削除）／ヒアリングシートの入力内容／契約書の署名
function posDocsOpen(s, D, k){ const n = SD_KINDS.find(x => x[0] === k)[1], P = sdPhotos(D, k);
  if(sdHear(D, k)){ sdModal(sdHearHtml(s.display_name, D, store?.code === 'hiroshima')); return; }
  if(sdSign(D, k) && !P.length){ sdModal(sdSignHtml(s.display_name, D)); return; }
  const m = sdModal(`<h3 style="margin:0 0 10px">${esc(s.display_name)}　${n}</h3><div style="display:flex;gap:10px;flex-wrap:wrap">
    ${P.map(p => `<div style="position:relative"><img data-sdp="${p.id}" data-ap="${p.ap ? 1 : 0}" alt="" style="width:180px;height:240px;object-fit:cover;border-radius:8px;display:block;background:var(--soft);cursor:pointer">${p.ap ? '' : `<button type="button" class="xb" data-sddel="${p.id}" aria-label="削除" style="position:absolute;right:4px;top:4px;background:var(--card)!important;border-radius:50%">×</button>`}</div>`).join('')}
    <label style="width:180px;height:240px;border:1px dashed var(--line);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--muted);cursor:pointer;box-sizing:border-box">${SD_CAM}撮影<input type="file" accept="image/*" data-sdadd="${k}" style="display:none"></label></div>
    ${P.some(p => p.ap) ? '<div style="color:var(--muted);font-size:12px;margin-top:8px">面接の時の写真</div>' : ''}`);
  sdFill(m, (id, ap) => sb.rpc('pos_staff_doc_photo', { p_id: id, p_ap: ap }));
  m.querySelector('input[data-sdadd]').onchange = async e => { if(await posDocsAdd(e.target, s)){ m.remove(); await posDocs(s); } };
  m.querySelectorAll('[data-sddel]').forEach(b => b.onclick = async e => { e.stopPropagation();
    if(!await uiConfirm(`${s.display_name} の${n}の写真を削除しますか？`, '削除', 'danger')) return; b.disabled = true;
    const q = await sb.rpc('pos_staff_doc_del', { p_id: b.dataset.sddel }); if(q.error){ b.disabled = false; await uiAlert('削除できません：' + q.error.message); return; }
    await logOp('書類の写真の削除', { name: s.display_name, doc: n }, null, true); toast('削除しました'); m.remove(); posDocs(s); });
}
