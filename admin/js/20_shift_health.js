/* 自動作成・確定の確かめの箱に、目安から外れた調整率・不足率・在籍を赤で出す（止めない。オーナー 11/26「ア 確定できる（箱に赤で出すだけ）」・見本 ⑥）
   warn は healthWarnHtml（lib/olive/core.js）が作った HTML。空ならふつうの確かめの箱と同じ */
function shConfirmWarn(msg, warn){ return new Promise(res => { const m = mkModal(null, `<div style="white-space:pre-wrap">${esc(msg)}</div>${warn || ''}<div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">OK</button></div>`);
  m.querySelector('[data-k=no]').onclick = () => { m.remove(); res(false); }; m.querySelector('[data-k=ok]').onclick = () => { m.remove(); res(true); }; }); }
