// v0.07・SQL 101：サインの画像を置いて、店から送信。置けなかった・送れなかった時は、次に報酬明細を開いた時に送り直す
async function pushSign(id, png, uploaded){
  try{
    if(!uploaded){ const blob = await (await fetch(png)).blob(); const up = await sb.storage.from('pay-signs').upload(`${id}.png`, blob, { contentType:'image/png', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) return false; }
    const r = await sb.rpc('cast_pay_push', { p_token: TOKEN, p_receipt: id }); return !r.error && r.data?.status === 'sent';
  }catch(e){ return false; }
}
async function payslip(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  { const pd = await sb.rpc('cast_pay_pending', { p_token: TOKEN }); if(!pd.error && pd.data) await pushSign(pd.data.id, pd.data.signature, pd.data.uploaded); }
  const r = await sb.rpc('cast_pay_slip', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const P = r.data, [y, mo] = String(P.month).split('-').map(Number);
  if(!P.slip){ show(`<div class="mon"><span></span><b>${y}年${mo}月分</b><span></span></div><div class="card c muted">${mo}月分の明細はありません</div>`); return; }
  const md = d => `${Number(String(d).slice(5,7))}/${Number(String(d).slice(8,10))}`;
  const adv = (P.advances||[]).map(a => `<div class="row"><span>${md(a.date)}（${WD[new Date(a.date+'T00:00:00+09:00').getDay()]}）</span><b>${yen(a.amount)}</b></div>`).join('');
  const fl = (P.fines||[]).map(f => `<div class="row"><span>${md(f.date)} ${esc(f.reason||'')}</span><b>${f.wage_pct?`時給の${f.wage_pct}%`:yen(f.amount)}</b></div>`).join('');
  const rc = P.receipt ? `<div class="card c"><div class="big">受取確認済み</div><p>${mo}月分　${new Date(P.receipt.signed_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p></div>`
    : P.can_sign ? `<div class="card"><div class="gh">受取確認（報酬を受け取ったらサイン）</div><canvas class="sign" id="sg"></canvas><div class="row" style="margin-top:8px;gap:8px"><button class="btn g" id="sgClr" style="width:auto;padding:10px 16px">再入力</button><button class="btn" id="sgOk" style="flex:1">受取確認</button></div></div>`
    : `<div class="card muted sm">受取確認は15日からです</div>`;
  show(`<div class="mon"><span></span><b>${y}年${mo}月分</b><span></span></div><div id="slip">${slipHtml(P)}</div>
    <div class="card"><div class="gh">日払（立替）</div>${adv||'<div class="muted sm">なし</div>'}</div><div class="card"><div class="gh">罰金</div>${fl||'<div class="muted sm">なし</div>'}</div>
    <button class="btn g" id="pdf" style="margin-bottom:10px">PDF ダウンロード</button>${rc}`);
  $('pdf').onclick = () => slipPdf(P);
  if(P.receipt || !P.can_sign) return;
  const cv = $('sg'), W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, Math.max(1, window.devicePixelRatio||1)); cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  const g = cv.getContext('2d'); g.scale(dpr, dpr); let drawn = false, down = false;
  const clear = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; drawn = false; }; clear();
  const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX-b.left)*W/b.width, (e.clientY-b.top)*H/b.height]; };
  cv.onpointerdown = e => { e.preventDefault(); down = true; try{ cv.setPointerCapture(e.pointerId); }catch(_){} const [a, b] = pos(e); g.beginPath(); g.moveTo(a, b); g.lineTo(a+0.1, b+0.1); g.stroke(); drawn = true; };
  cv.onpointermove = e => { if(!down) return; e.preventDefault(); const [a, b] = pos(e); g.lineTo(a, b); g.stroke(); };
  cv.onpointerup = cv.onpointercancel = () => { down = false; };
  $('sgClr').onclick = clear;
  $('sgOk').onclick = async () => {
    if(!drawn){ await uiAlert('サインを入力してください'); return; }
    if(!await uiConfirm(`${mo}月分の報酬を受け取りましたか？\n受取確認は取消できません`)) return;
    $('sgOk').disabled = true;
    const png = cv.toDataURL('image/png');
    const q = await sb.rpc('cast_pay_sign', { p_token: TOKEN, p_signature: png });
    if(q.error){ $('sgOk').disabled = false; await uiAlert(q.error.message); return; }
    const net = N(q.data.net), at = new Date(q.data.signed_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    try{ await liff.sendMessages([{ type:'text', text:`${y}年${mo}月分の報酬として ${(net<0?'−':'')}${Math.abs(net).toLocaleString('ja-JP')}円 を受け取りました。\n${ME.name}（${at}）` }]); }catch(e){ await uiAlert('公式 LINE への送信に失敗しました。黒服に LINE でもご連絡ください'); }
    // v0.06・SQL 100：サインの画像を保存して、店（公式 LINE）から本人のトークへ「○月分 報酬 ○円 の受取サイン」＋画像を送信
    await pushSign(q.data.id, png, false);
    payslip();
  };
}
// PDF：画面の明細をそのまま A4 縦1枚に
let pdfLib = null;
function loadJs(u){ return new Promise((ok, ng) => { const sc = document.createElement('script'); sc.src = u; sc.onload = ok; sc.onerror = () => ng(new Error('読み込みに失敗しました')); document.head.appendChild(sc); }); }
async function slipPdf(P){
  const b = $('pdf'); b.disabled = true; b.textContent = '作成中…';
  try{
    if(!pdfLib) pdfLib = Promise.all([loadJs('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'), loadJs('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')]);
    await pdfLib;
    const c = await html2canvas($('slip'), { scale: 2, backgroundColor: getComputedStyle(document.body).backgroundColor });
    const pdf = new window.jspdf.jsPDF({ unit:'mm', format:'a4' }), k = Math.min(190 / c.width, 277 / c.height), w = c.width * k, h = c.height * k;
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - w) / 2, 10, w, h);
    pdf.save(`報酬明細_${ym(P.month)}_${P.name}.pdf`);
  }catch(e){ await uiAlert('PDF を作成できませんでした：' + (e.message||e)); }
  finally{ b.disabled = false; b.textContent = 'PDF ダウンロード'; }
}

