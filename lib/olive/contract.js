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
