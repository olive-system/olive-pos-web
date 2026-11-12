/* 契約書の中身（条文と同意・本人情報・署名）。LINEマイページの PDF の控えと、POS・管理サイトの「書類」の小窓で同じ形にするため1つにした。
   C：cast_contract_copy・pos_staff_contract・admin_staff_contract の答え。kp＝印刷物（PDF。白と黒・見出しは中央） */
function contractHtml(C, kp){
  const ln = kp ? '#999' : 'var(--line)', td = `border:1px solid ${ln};padding:6px 10px${kp ? '' : ';text-align:left;vertical-align:top'}`;
  const at = new Date(C.at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `<div style="${kp ? 'text-align:center;' : ''}font-size:18px;font-weight:700;margin-bottom:14px">${esc(C.title)}</div><div style="white-space:pre-wrap">${esc(C.preamble)}</div>
    ${(C.articles || []).map(a => `<div style="margin-top:12px"><b>${esc(a.title)}</b><div style="white-space:pre-wrap">${esc(a.body)}</div><div>☑ 同意</div></div>`).join('')}
    <div style="margin-top:14px">☑ ${esc(C.oath)}</div>
    <table style="margin-top:18px;border-collapse:collapse;width:100%">${[['店舗', C.store], ['氏名', C.name], ['住所', C.address], ['電話番号', C.phone], ['メールアドレス', C.email], ['同意日時', at]].map(([k, v]) => `<tr><td style="${td};width:130px">${k}</td><td style="${td}">${esc(v)}</td></tr>`).join('')}
    <tr><td style="${td}">署名</td><td style="${td}"><img src="${C.signature}" alt="署名" style="height:90px${kp ? '' : ';background:#fff;border-radius:4px'}"></td></tr></table>`;
}

// 署名入りの契約書の PDF（A4 縦・左右 10mm）。字の大きさは今の控えのまま（13px）なので、条文が多いと2枚になる。
// ページは条・本人情報の行の切れ目で送る（前は A4 の高さで機械的に切っていて、文の行の途中で切れることがあった）
let contractLibs = null;
const contractJs = u => new Promise((ok, ng) => { const sc = document.createElement('script'); sc.src = u; sc.onload = ok; sc.onerror = () => ng(new Error('読み込みに失敗しました')); document.head.appendChild(sc); });
async function contractPdfMake(C){
  if(!window.html2canvas || !window.jspdf){ if(!contractLibs) contractLibs = Promise.all([contractJs('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'), contractJs('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')]); await contractLibs; }
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:720px;padding:36px 40px;background:#fff;color:#111;font-family:"Zen Kaku Gothic New",-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;font-size:13px;line-height:1.75'; /* .kp：印刷物（白と黒） */
  box.innerHTML = contractHtml(C, true); document.body.appendChild(box);
  try{
    await new Promise(ok => { const im = box.querySelector('img'); if(!im || im.complete) ok(); else { im.onload = ok; im.onerror = ok; } });
    const c = await html2canvas(box, { scale: 2, backgroundColor: '#ffffff' });
    const sc = c.height / box.getBoundingClientRect().height, top = box.getBoundingClientRect().top;
    const cuts = [...box.querySelectorAll(':scope > div, tr')].map(e => Math.round((e.getBoundingClientRect().bottom - top) * sc)).sort((a, b) => a - b);
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), pw = 190, ph = 277, k = pw / c.width, pageH = Math.floor(ph / k);
    for(let y = 0, i = 0; y < c.height; i++){
      let e = Math.min(c.height, y + pageH);
      if(e < c.height){ const b = cuts.filter(v => v > y && v <= e).pop(); if(b) e = b; }
      const h = e - y, p = document.createElement('canvas'); p.width = c.width; p.height = h;
      p.getContext('2d').drawImage(c, 0, y, c.width, h, 0, 0, c.width, h);
      if(i) pdf.addPage(); pdf.addImage(p.toDataURL('image/jpeg', 0.92), 'JPEG', 10, 10, pw, h * k); y = e;
    }
    return pdf;
  } finally { box.remove(); }
}
// POS・管理サイト：押したら PDF を新しいタブで表示（iPad は押した時に開いたタブでないと止められるので、先に開いてから中身を入れる）
async function contractPdfOpen(load){
  const w = window.open('', '_blank'); if(w) w.document.write('<p style="font-family:sans-serif;padding:16px">読み込み中…</p>');
  try{ const r = await load(); if(r.error) throw new Error(r.error.message);
    const u = (await contractPdfMake(r.data)).output('bloburl'); if(w) w.location.href = u; else window.open(u, '_blank');
  }catch(e){ if(w) w.close(); await uiAlert('契約書を表示できません：' + (e && e.message || e)); } }
