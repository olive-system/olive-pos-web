// v0.12・SQL 110：ドレス新調日。決められた日までに、新しいドレスの金額とレシートの写真を提出。前月の決定時給×3時間未満なら罰金（自動）
async function shrinkJpeg(file){ const img = await new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85)); }
async function dressReport(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_dress_info', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const D = r.data; if(!D.enabled){ home(); return; }
  const due = dTxt(D.due), rp = D.report, f = D.fine, unit = D.pay_type === 'daily' ? '日給' : '時給';
  const fineTxt2 = !f ? '—' : f.calc === 'hourly_pct' ? `時給 × ${f.value/100}時間` : f.calc === 'daily_pct' ? `日給の${f.value}%` : f.calc === 'yen' ? yen(f.value) : '—';
  const rule = `<div class="warnbox"><b class="t">新調日の決まり</b>${D.threshold?`ドレスの金額が 前月の決定${unit} × 3時間（<b>${yen(D.threshold)}</b>）以上なら罰金なし。`:'前月の決定時給がないため、金額の判定はありません。'}足りない時・期限までに提出がない時は 罰金（${esc(fineTxt2)}）</div>`;
  const RES = { ok:'罰金なし', short:'罰金あり', missing:'提出なし（罰金あり）', nojudge:'判定なし', kimono:'罰金なし（着物）' }; // v0.32・SQL 130：着物で免除
  if(rp && rp.status !== 'pending_photo'){ show(`<div class="card"><div class="row"><span>新調日</span><b>${due}</b></div></div><div class="card c"><div class="big">${rp.status==='kimono'?'着物で免除':'提出済み'}</div>${rp.amount?`<div class="row" style="text-align:left"><span>金額</span><b>${yen(rp.amount)}</b></div>`:''}<div class="row" style="text-align:left"><span>判定</span><b class="${rp.status==='ok'?'':'err'}">${RES[rp.status]||''}</b></div></div>${rule}`); return; }
  const fld = 'width:100%;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card);color:var(--ink);text-align:right';
  show(`<div class="card"><div class="row"><span>新調日（提出の期限）</span><b>${due}</b></div><div class="muted sm">この日までに新しいドレスを買って、金額と写真2枚（ドレス・レシート）を提出します</div></div>
    <div class="card"><label class="f" for="drA">ドレスの金額（円）</label><input id="drA" inputmode="numeric" placeholder="例：58000" style="${fld}">
      <label class="f" style="margin-top:10px">写真</label><div style="display:flex;gap:10px">${[['drD','ドレス'],['drP','レシート']].map(([id,n])=>`<label style="flex:1;text-align:center;font-size:13px;cursor:pointer"><div id="${id}v" style="height:96px;border:1px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:26px;margin-bottom:4px;background:var(--card) center/cover no-repeat">＋</div><span id="${id}n">${n}</span><input type="file" id="${id}" accept="image/*" style="display:none"></label>`).join('')}</div>
      <div class="muted sm" style="margin-top:6px">レシートは金額が見えるように撮ります（ネットで買った時は注文の画面）</div></div>
    ${rule}<button class="btn" id="drGo">提出</button>`);
  /* v0.58・SQL 210：写真は2枚（ドレス・レシート。オーナー 2026-10-23「1枚に収めるのが難しい」） */
  [['drD','ドレス'],['drP','レシート']].forEach(([id,n]) => $(id).onchange = () => { const f = $(id).files[0], v = $(id+'v');
    if(f){ v.style.backgroundImage = `url(${URL.createObjectURL(f)})`; v.style.borderStyle = 'solid'; v.textContent = ''; $(id+'n').textContent = `${n}　選択済み`; } });
  $('drGo').onclick = async () => {
    const a = Number(String($('drA').value).replace(/[^0-9]/g, '')), file = $('drP').files[0], dfile = $('drD').files[0];
    if(!(a > 0)){ await uiAlert('ドレスの金額を入力してください'); return; }
    if(!dfile){ await uiAlert('ドレスの写真を選んでください'); return; }
    if(!file){ await uiAlert('レシートの写真を選んでください'); return; }
    if(!await uiConfirm(`ドレス ${yen(a)} を提出しますか？\n提出は1回だけです`)) return;
    $('drGo').disabled = true;
    try{
      const q = await sb.rpc('cast_dress_submit', { p_token: TOKEN, p_amount: a }); if(q.error) throw q.error;
      const blob = await shrinkJpeg(file);
      const up = await sb.storage.from('dress-receipts').upload(`${q.data.id}.jpg`, blob, { contentType:'image/jpeg', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error;
      const up2 = await sb.storage.from('dress-receipts').upload(`${q.data.id}_dress.jpg`, await shrinkJpeg(dfile), { contentType:'image/jpeg', upsert:false }); if(up2.error && !/exists|Duplicate/i.test(up2.error.message)) throw up2.error;
      const d = await sb.rpc('cast_dress_done', { p_token: TOKEN, p_report: q.data.id }); if(d.error) throw d.error;
      /* SQL 111：記録は店の公式 LINE から本人へ（金額＋レシートの写真）。キャストからの文は送らない */
      dressReport();
    }catch(e){ $('drGo').disabled = false; await uiAlert(e.message || String(e)); }
  };
}

