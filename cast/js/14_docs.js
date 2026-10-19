// v0.20・SQL 120：⑥書類（オーナーにヒアリングして決めた形 2026-10-16）。3点セット＝契約書・本人確認書類（本籍地入りの住民票またはパスポートのコピー。原本は店で保管）・従業者名簿
//   提出期限は最初の報酬の受取。提出済みは POS で黒服がチェック。契約書はここで条ごとに同意・本人情報・署名（今の Google フォームを作り直したもの）。PDF で控え
let DOCS = null;
async function docsLoad(){ const r = await sb.rpc('cast_docs_info', { p_token: TOKEN }); DOCS = r.error ? null : r.data; ME.docs = DOCS ? { target: DOCS.target, left: [DOCS.contract, DOCS.id_doc, DOCS.roster].filter(x => !x).length } : null; return !r.error; }
const mdDay = d => { const x = new Date(String(d).slice(0,10)+'T00:00:00+09:00'); return `${x.getMonth()+1}/${x.getDate()}`; };
async function docsList(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  if(!await docsLoad()){ fail('書類を表示できません'); return; }
  const D = DOCS, st = ok => `<span class="sm" style="color:${ok?'var(--ok)':'var(--warn)'}">${ok?'提出済み':'未提出'}</span>`, left = ME.docs.left;
  const ag = D.agreed ? new Date(D.agreed.at) : null;
  show(`<div class="ttl">書類</div><div class="card">${left?`<div class="sm" style="color:var(--warn);font-weight:700;padding-bottom:8px">提出期限 ${D.due?mdDay(D.due)+'（最初の報酬の受取）':'最初の報酬の受取'}</div>`:''}
    <div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row" style="padding:0"><b>契約書</b>${st(D.contract)}</div>
      ${D.contract?(ag?`<div class="muted sm">${ag.getMonth()+1}/${ag.getDate()} 同意</div><button class="btn g" id="dcPdf" style="width:auto;padding:6px 16px;margin-top:8px">PDF ダウンロード</button>`:''):'<button class="btn g" id="dcGo" style="width:auto;padding:6px 18px;margin-top:8px">同意</button>'}</div>
    <div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row" style="padding:0"><b>本人確認書類</b>${st(D.id_doc)}</div>${D.id_doc?'':'<div class="muted sm">本籍地入りの住民票、またはパスポートのコピー。店に提出してください</div>'}</div>
    <div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row" style="padding:0"><b>従業者名簿</b>${st(D.roster)}</div>${D.roster?'':'<div class="muted sm">店に提出してください</div>'}</div></div>
    ${left?'<div class="muted sm" style="margin:0 2px">提出がないと、報酬を受け取れません</div>':''}`);
  if($('dcGo')) $('dcGo').onclick = contractForm;
  if($('dcPdf')) $('dcPdf').onclick = contractPdf;
}
function contractForm(){
  setBack(docsList);
  const V = DOCS.version, fld = 'width:100%;height:48px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)';
  const ck = (id, t) => `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:15px"><input type="checkbox" class="dcCk" id="${id}" style="width:22px;height:22px;flex:none;margin:0;accent-color:var(--pri)">${t}</label>`;
  show(`<div class="ttl">${esc(V.title)}</div><div class="card"><div class="muted sm" style="white-space:pre-wrap;line-height:1.7">${esc(V.preamble)}</div>
    ${(V.articles||[]).map((a, i) => `<div style="padding:10px 0;border-top:1px solid var(--line);margin-top:10px"><b>${esc(a.title)}</b><div style="white-space:pre-wrap;line-height:1.7;font-size:14px;margin-top:4px">${esc(a.body)}</div>${ck('dcA'+i,'同意')}</div>`).join('')}
    <div class="f" style="margin-top:14px">本人情報</div>
    <input id="dcN" maxlength="40" placeholder="氏名" value="${esc(DOCS.real_name||'')}" style="${fld}">
    <input id="dcAd" maxlength="200" placeholder="住所" style="${fld};margin-top:8px">
    <input id="dcPh" type="tel" maxlength="20" placeholder="電話番号" style="${fld};margin-top:8px">
    <input id="dcEm" type="email" maxlength="100" placeholder="メールアドレス" style="${fld};margin-top:8px">
    <div class="f" style="margin-top:14px">署名</div><canvas class="sign" id="dcSg"></canvas><div style="margin-top:6px"><button class="btn g" id="dcClr" style="width:auto;padding:8px 16px">再入力</button></div>
    ${ck('dcOath', esc(V.oath))}</div>
    <button class="btn" id="dcOk">同意</button>`);
  const cv = $('dcSg'), W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, Math.max(1, window.devicePixelRatio||1)); cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  const g = cv.getContext('2d'); g.scale(dpr, dpr); let drawn = false, down = false;
  const clear = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; drawn = false; }; clear();
  const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX-b.left)*W/b.width, (e.clientY-b.top)*H/b.height]; };
  cv.onpointerdown = e => { e.preventDefault(); down = true; try{ cv.setPointerCapture(e.pointerId); }catch(_){} const [a, b] = pos(e); g.beginPath(); g.moveTo(a, b); g.lineTo(a+0.1, b+0.1); g.stroke(); drawn = true; };
  cv.onpointermove = e => { if(!down) return; e.preventDefault(); const [a, b] = pos(e); g.lineTo(a, b); g.stroke(); };
  cv.onpointerup = cv.onpointercancel = () => { down = false; };
  $('dcClr').onclick = clear;
  $('dcOk').onclick = async () => {
    const off = [...document.querySelectorAll('.dcCk')].filter(x => !x.checked);
    if(off.length){ await uiAlert('全ての条項と誓約に同意してください'); off[0].scrollIntoView({ block:'center' }); return; }
    const n = $('dcN').value.trim(), ad = $('dcAd').value.trim(), ph = $('dcPh').value.trim(), em = $('dcEm').value.trim();
    if(!n || !ad || !ph || !em){ await uiAlert('本人情報を全て入力してください'); return; }
    if(!drawn){ await uiAlert('署名を入力してください'); return; }
    if(!await uiConfirm(`${V.title}\nこの内容で同意しますか？\n同意は取消できません`)) return;
    $('dcOk').disabled = true;
    const q = await sb.rpc('cast_contract_agree', { p_token: TOKEN, p_version: V.id, p_name: n, p_address: ad, p_phone: ph, p_email: em, p_signature: cv.toDataURL('image/png') });
    if(q.error){ $('dcOk').disabled = false; await uiAlert(q.error.message); return; }
    await uiAlert('契約書に同意しました。\n控えは PDF で保存できます');
    docsList();
  };
}
// 契約書の控え：同意した版の文・本人情報・署名を A4 縦（長い時は複数ページ）
async function contractPdf(){
  const b = $('dcPdf'); b.disabled = true; b.textContent = '作成中…';
  try{
    const r = await sb.rpc('cast_contract_copy', { p_token: TOKEN }); if(r.error) throw new Error(r.error.message);
    const C = r.data, at = new Date(C.at).toLocaleString('ja-JP', { timeZone:'Asia/Tokyo', year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
    if(!pdfLib) pdfLib = Promise.all([loadJs('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'), loadJs('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')]);
    await pdfLib;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:720px;padding:36px 40px;background:#fff;color:#111;font-family:"Zen Kaku Gothic New",-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;font-size:13px;line-height:1.75'; /* .kp：印刷物（契約書の PDF・白と黒） */
    box.innerHTML = `<div style="text-align:center;font-size:18px;font-weight:700;margin-bottom:14px">${esc(C.title)}</div><div style="white-space:pre-wrap">${esc(C.preamble)}</div>
      ${(C.articles||[]).map(a => `<div style="margin-top:12px"><b>${esc(a.title)}</b><div style="white-space:pre-wrap">${esc(a.body)}</div><div>☑ 同意</div></div>`).join('')}
      <div style="margin-top:14px">☑ ${esc(C.oath)}</div>
      <table style="margin-top:18px;border-collapse:collapse;width:100%">${[['店舗',C.store],['氏名',C.name],['住所',C.address],['電話番号',C.phone],['メールアドレス',C.email],['同意日時',at]].map(([k,v]) => `<tr><td style="border:1px solid #999;padding:6px 10px;width:130px">${k}</td><td style="border:1px solid #999;padding:6px 10px">${esc(v)}</td></tr>`).join('')}<!-- .kp：印刷物（契約書の PDF・白と黒） -->
      <tr><td style="border:1px solid #999;padding:6px 10px">署名</td><td style="border:1px solid #999;padding:6px 10px"><img src="${C.signature}" style="height:90px"></td></tr></table>`; /* .kp：印刷物（契約書の PDF・白と黒） */
    document.body.appendChild(box);
    try{
      await new Promise(ok => { const im = box.querySelector('img'); if(im.complete) ok(); else { im.onload = ok; im.onerror = ok; } });
      const c = await html2canvas(box, { scale: 2, backgroundColor: '#ffffff' });
      const pdf = new window.jspdf.jsPDF({ unit:'mm', format:'a4' }), pw = 190, ph = 277, k = pw / c.width, pageH = Math.floor(ph / k);
      for(let y = 0, i = 0; y < c.height; y += pageH, i++){
        const h = Math.min(pageH, c.height - y), p = document.createElement('canvas'); p.width = c.width; p.height = h;
        p.getContext('2d').drawImage(c, 0, y, c.width, h, 0, 0, c.width, h);
        if(i) pdf.addPage(); pdf.addImage(p.toDataURL('image/jpeg', 0.92), 'JPEG', 10, 10, pw, h * k);
      }
      pdf.save(`契約書_${ME.name}.pdf`);
    } finally { box.remove(); }
  }catch(e){ await uiAlert('PDF を作成できませんでした：' + (e.message||e)); }
  finally{ b.disabled = false; b.textContent = 'PDF ダウンロード'; }
}

