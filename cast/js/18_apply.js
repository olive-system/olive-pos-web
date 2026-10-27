// v0.85・SQL 274：LINE「予約状況の確認」（2026-10-27 オーナー「自分の予約見れるようにならないの？」）。みんな用のメニューから ?go=apply で開く。LINE連携していない人も使う
// 面接予約は今の Google カレンダーの予約ページのまま。初回だけ電話番号を入力 → 店の Apps Script がカレンダーの予約を探す。見つかったら次からは入力なし
const RESV_PAGE = { ginza:'https://calendar.app.google/7Zg64LLXU3Ne4MWR7', hiroshima:'https://calendar.app.google/T4RLsbyLuuaXeFEX6' };
const apDay = iso => { const d = new Date(new Date(iso).getTime() + 9*3600e3); return `${d.getUTCMonth()+1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`; };

// 予約の場所（1行目は店の名前・2行目が住所）から住所だけ。「日本、」と郵便番号は外す
const apAddr = p => String(p || '').split(/\n/).slice(1).join(' ').replace(/日本、/g, '').replace(/〒\d{3}-\d{4}\s*/g, '').trim();

async function applyStart(phone){
  if($('tSub')) $('tSub').textContent = ''; document.title = 'OLIVE 予約状況'; /* 応募の人に「LINEマイページ」は出さない */
  const idt = liff.getIDToken();
  if(!idt){ liff.login({ redirectUri: location.href }); return; }
  if(!phone) show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('applicant_status', { p_store: STORE, p_id_token: idt, p_phone: phone || null });
  if(r.error){
    if(/認証/.test(r.error.message)){ liff.logout(); liff.login({ redirectUri: location.href }); return; }
    if(phone){ await uiAlert(r.error.message); if($('apOk')) $('apOk').disabled = false; return; }
    fail(r.error.message); return;
  }
  if(r.data.status === 'phone'){ applyPhone(); return; }
  applyShow(r.data);
}

function applyPhone(){
  show(`<div class="card"><div class="big">予約状況</div><div class="muted sm" style="margin:10px 0 4px">電話番号</div>
    <input id="apTel" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card)">
    <button class="btn" id="apOk" style="margin-top:12px">確認</button></div>`);
  $('apOk').onclick = async () => { const v = $('apTel').value.trim(); if(!v){ await uiAlert('電話番号を入力してください'); return; } $('apOk').disabled = true; await applyStart(v); };
}

function applyShow(d){
  const it = d.items || [];
  show(`<div class="card"><div class="big">予約状況</div>${d.name ? `<div class="muted" style="margin-bottom:10px">${esc(d.name)} 様</div>` : ''}
    ${it.length ? it.map(x => `<div class="card" style="margin-bottom:8px"><div class="muted sm" style="font-weight:700">面接予約</div><div style="font-size:22px;font-weight:700;margin:4px 0 6px">${esc(apDay(x.at))}</div>
      <div class="sm" style="line-height:1.6">${esc(d.store_name || '')}${apAddr(x.place) ? `<br>${esc(apAddr(x.place))}` : ''}</div></div>`).join('')
      : `<div class="card" style="margin-bottom:8px;font-weight:700">予約なし</div>${RESV_PAGE[STORE] ? '<button class="btn" id="apNew">面接予約</button>' : ''}`}</div>`);
  if($('apNew')) $('apNew').onclick = () => { const u = RESV_PAGE[STORE]; try{ liff.openWindow({ url: u, external: false }); }catch(e){ location.href = u; } };
}
