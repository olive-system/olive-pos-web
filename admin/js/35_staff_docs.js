// SQL 445：スタッフの画面の［書類］のタブ（2026-11-11 オーナー「注文集計の右にもう一つタブ」）。閲覧のみ（撮影・削除は POS の在籍キャストの［編集］）。
//   見られるのはスタッフ設定を見られる人（admin_staff_docs が確かめる）。部品は lib/olive/staff_docs.js（POS と同じ）
async function csDocsTab(st, s){ const box = $('csDoc'), t = csTab;
  const r = await sb.rpc('admin_staff_docs', { p_store: st, p_staff: s.id }); if(page !== 'set_cast' || csDetail?.s !== s || csTab !== t || !box.isConnected) return;
  if(r.error){ box.innerHTML = `<span class="err">読み込めません：${esc(r.error.message)}</span>`; return; }
  const D = r.data || {}, hr = curStore()?.code === 'hiroshima';
  box.innerHTML = SD_KINDS.map(([k, n, f], i) => { const P = sdPhotos(D, k);
    const body = sdHear(D, k) ? `<span style="font-size:13px">LINEマイページで入力　${sdYmd(D.hearing_at)}　<a data-sdh="1">入力内容</a></span>`
      : sdSign(D, k) && !P.length ? `<span style="font-size:13px">LINEマイページで署名　${sdYmd(D.signed.at)}（版${esc(String(D.signed.no ?? ''))}）　<a data-sdc="1">契約内容</a></span>`
      : k === 'contract' ? '<span class="muted" style="font-size:13px">LINEマイページで署名</span>'
      : P.length ? P.map(p => `<img data-sdp="${p.id}" data-ap="${p.ap ? 1 : 0}" alt="" style="width:60px;height:80px;object-fit:cover;border-radius:6px;background:var(--soft);cursor:pointer">`).join('')
      : '<span class="muted" style="font-size:13px">写真なし</span>';
    return `<div style="display:flex;gap:12px;padding:10px 0;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="width:130px;flex:none"><b>${n}</b><div style="font-size:13px;margin-top:2px;display:flex;flex-direction:column">${sdStateHtml(sdState(D, k, f))}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">${body}</div></div>`; }).join('');
  const h = box.querySelector('[data-sdh]'); if(h) h.onclick = () => sdModal(sdHearHtml(s.display_name, D, hr));
  const c = box.querySelector('[data-sdc]'); if(c) c.onclick = () => sdContract(s.display_name, D, () => sb.rpc('admin_staff_contract', { p_store: st, p_staff: s.id }));
  await sdFill(box, (id, ap) => sb.rpc('admin_staff_doc_photo', { p_store: st, p_id: id, p_ap: ap }));
}
