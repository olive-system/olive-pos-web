/* LINE QR（SQL 758）：本人の LINE の友だち追加の URL を登録する。お店がカードに印刷して本人に渡す（POS の在籍の詳細の［印刷］）
   名刺発注の画面のいちばん上に箱を出す。登録は、LINE の「マイQRコード」のスクショを選ぶ（画面の中で QR を読み URL だけ送る）か、URL を貼る
   入力欄は画面の中の label の中に置く（画面に置かずに click すると、iPhone の LINE で選んだ画像が届かないことがある） */
const LQ_RE = /^https:\/\/line\.me\/(R\/)?ti\/p\/[A-Za-z0-9_~%@.\-]+\/?$/;
const LQ_TAG = 'font-size:11px;color:var(--warn);border:1px solid var(--line);border-radius:999px;padding:1px 7px;white-space:nowrap';
/* ホームの「名刺発注」の札に、未登録の時だけ「LINE QR 未登録」。1回読んだら ME.lqr に置く */
async function homeLineQr(){
  if(ME.lqr === undefined){ const q = await sb.rpc('cast_line_qr', { p_token: TOKEN }); if(q.error) return; ME.lqr = q.data?.url || null; }
  const t = $('main').querySelector('[data-go=card]'); if(!t || ME.lqr || t.querySelector('small')) return;
  t.insertAdjacentHTML('beforeend', '<small style="color:var(--warn)">LINE QR 未登録</small>');
}
/* 名刺発注の画面の上に箱を出す（cardOrder の show の後に呼ぶ） */
async function lqMount(){
  const m = $('main'); if(!m || $('lqBox')) return; m.insertAdjacentHTML('afterbegin', '<div class="card" id="lqBox"><div class="muted sm">読み込み中…</div></div>');
  const q = await sb.rpc('cast_line_qr', { p_token: TOKEN }); if(!$('lqBox')) return;
  if(q.error){ $('lqBox').innerHTML = `<div class="err sm">${esc(q.error.message)}</div>`; return; }
  ME.lqr = q.data?.url || null; lqPaint();
}
async function lqPaint(){ const b = $('lqBox'); if(!b) return; const u = ME.lqr;
  let qr = ''; if(u){ try{ await needLib('qrcode'); const q = qrcode(0, 'M'); q.addData(u); q.make(); qr = `<div style="display:flex;gap:14px;align-items:center;margin:8px 0 4px"><div style="background:#fff;padding:6px;border-radius:8px;line-height:0">${q.createSvgTag({ cellSize: 3, margin: 2 })}</div><b style="color:var(--ink)">登録済み</b></div>`; }catch(_){ qr = '<div style="margin:8px 0 4px"><b style="color:var(--ink)">登録済み</b></div>'; } }
  const fld = 'width:100%;box-sizing:border-box;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card);color:var(--ink)';
  b.innerHTML = `<div class="row" style="min-height:44px;align-items:center"><span class="gh" style="margin:0">LINE QR</span>${u ? '<button class="btn g" id="lqDel" style="width:auto;padding:6px 12px;font-size:14px">削除</button>' : `<small style="${LQ_TAG}">未登録</small>`}</div>${qr}
    <label class="btn g" style="margin-top:10px">画像選択<input type="file" accept="image/*" id="lqF" style="display:none"></label>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:10px"><input id="lqU" inputmode="url" autocomplete="off" style="${fld}" placeholder="https://line.me/ti/p/…"><button class="btn" id="lqS" style="width:auto;padding:0 16px">保存</button></div>`;
  $('lqF').onchange = lqPick; $('lqS').onclick = () => lqSave($('lqU').value.trim());
  if($('lqDel')) $('lqDel').onclick = async () => { if(!await uiConfirm('LINE QR を削除しますか？', '削除')) return; lqSave(''); };
}
/* 選んだ画像の中の QR を読む。スクショに別の QR が写っていても、LINE の友だち追加の QR を探す（読めた別の QR は白で消して探し直す） */
async function lqPick(e){ const f = e.target.files && e.target.files[0]; e.target.value = ''; if(!f) return;
  let u = null;
  try{ await needLib('jsqr'); const im = await createImageBitmap(f), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    for(let i = 0; i < 5 && !u; i++){ const d = x.getImageData(0, 0, c.width, c.height), r = window.jsQR && jsQR(d.data, c.width, c.height); if(!r) break;
      if(LQ_RE.test(r.data)) u = r.data; else { const L = r.location, xs = [L.topLeftCorner.x, L.topRightCorner.x, L.bottomLeftCorner.x, L.bottomRightCorner.x], ys = [L.topLeftCorner.y, L.topRightCorner.y, L.bottomLeftCorner.y, L.bottomRightCorner.y];
        const x0 = Math.min(...xs), y0 = Math.min(...ys), m = (Math.max(...xs) - x0) * .2; x.fillStyle = '#fff'; x.fillRect(x0 - m, y0 - m, Math.max(...xs) - x0 + 2 * m, Math.max(...ys) - y0 + 2 * m); } } }
  catch(_){ await uiAlert('画像を読み取れません。再度お試しください'); return; }
  if(!u){ await uiAlert('LINE の友だち追加の QR が見つかりません。\nLINE の「マイQRコード」の画面のスクショを選択してください'); return; }
  lqSave(u);
}
async function lqSave(u){
  if(u && !LQ_RE.test(u)){ await uiAlert('LINE の友だち追加の URL（https://line.me/ti/p/…）を入力してください'); return; }
  const s = $('lqS'); if(s) s.disabled = true;
  const q = await sb.rpc('cast_line_qr_set', { p_token: TOKEN, p_url: u });
  if(q.error){ if(s) s.disabled = false; await uiAlert(q.error.message); return; }
  ME.lqr = q.data?.url || null; toast(u ? '保存しました' : '削除しました'); lqPaint();
}
