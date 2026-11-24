// スカウト請求書（月末の公式 LINE の［あり］から開く。その店の公式 LINE に連携したオーナーだけ。SQL 698・見本 スカウト料_2）
// 金額と写真（必須）を登録する。店はその LINE の店。登録した請求書は、次の閉店作業の領収書メールに付き、黒服が確かめる（「ママがちょろまかしていると思われたくない」）
// 写真は閉店作業②「領収書精算」と同じ処理（lib/olive/scan.js：紙の四隅で切り取り・まっすぐ・白黒 → PDF。オーナー「同じ処理を通す」）。
// メールや PDF で届いた請求書も選べるよう、画面の中のカメラ（clCamWire）は使わず入力欄だけにする（iPhone は写真を撮る・写真・ファイルを選べる）。PDF はそのまま
const SC_FLD = 'width:100%;font:inherit;font-size:18px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);box-sizing:border-box;height:48px';
const SC_BOX = 'width:56px;height:48px;border:1px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:24px;background:var(--card) center/cover no-repeat';
/* 画面の文（登録済みの一覧・金額と写真の1行・登録） */
function scoutHtml(m, items){
  const row = x => `<div style="display:flex;align-items:center;gap:12px;padding:6px 0"><span style="flex:none;width:48px;height:64px;border:1px solid var(--line);border-radius:6px;display:flex;align-items:center;justify-content:center">${FX('filetext', 24)}</span><b style="flex:1;font-size:18px;font-variant-numeric:tabular-nums">${yen(x.amount)}</b>${x.mailed ? '<span style="width:28px"></span>' : `<button class="xb" data-del="${x.id}" aria-label="削除">×</button>`}</div>`;
  return `<div class="ttl">${Number(m.slice(5, 7))}月 スカウト請求書</div>
    ${items.length ? `<div class="card"><div class="f">登録済み</div>${items.map(row).join('')}</div>` : ''}
    <div class="card"><div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:1;min-width:0"><label class="f" for="scA">金額（円）</label><input id="scA" inputmode="numeric" placeholder="例：50000" style="${SC_FLD}"></div>
      <label style="flex:none;cursor:pointer"><div class="f">写真</div><div id="scV" style="${SC_BOX}">＋</div><input type="file" id="scF" accept="image/*,application/pdf" style="display:none"></label></div></div>
    <button class="btn" id="scGo" disabled>登録</button>`;
}
/* 選んだ請求書を PDF にする（写真は切り取り・白黒。PDF はそのまま）。四角に、白黒にした写真か書類のマークを出す（撮れたことがひと目でわかる） */
async function scoutPick(f, v){
  if(f.type === 'application/pdf'){ v.style.backgroundImage = ''; v.innerHTML = FX('filetext', 24); return { blob: f }; }
  const sc = await clScan(f), blob = await clScanPdf(sc); v.innerHTML = ''; v.style.backgroundImage = `url(${sc.url})`; return { blob };
}
/* 登録：置き場の名前をもらう → 置き場に上げる → 登録 */
async function scoutAdd(call, doc, amount){
  const p = await call('path'); if(p.error){ await uiAlert(p.error.message); return null; }
  const up = await sb.storage.from('receipts').upload(p.data.path, doc.blob, { contentType: 'application/pdf', upsert: false }); if(up.error){ await uiAlert('請求書を保存できません：' + up.error.message); return null; }
  const r = await call('add', { amount, path: p.data.path }); if(r.error){ await uiAlert(r.error.message); return null; }
  toast('登録しました'); return r.data;
}
async function scoutLiff(idt){
  const m = jgParam('m'); if(!/^\d{4}-\d{2}-01$/.test(m || '')){ fail('表示できません'); return; }
  const call = (op, x = {}) => sb.rpc('cast_scout_liff', { p_store: STORE, p_id_token: idt, p_month: m, p_op: op, p_amount: x.amount ?? null, p_path: x.path ?? null, p_id: x.id ?? null });
  let doc = null;
  const draw = d => { const items = d.items || []; show(scoutHtml(m, items)); doc = null;
    const can = () => { $('scGo').disabled = !(doc && Number($('scA').value) > 0); };
    $('scA').oninput = can;
    $('scF').onchange = async () => { const f = $('scF').files && $('scF').files[0]; $('scF').value = ''; if(!f) return; const v = $('scV');
      try{ doc = await scoutPick(f, v); }catch(e){ doc = null; v.style.backgroundImage = ''; v.textContent = '＋'; await uiAlert('写真を読み込めません：' + (e.message || '')); }
      can(); };
    $('scGo').onclick = guard($('scGo'), async () => { const amount = Number($('scA').value); if(!doc || !(amount > 0)) return; const nd = await scoutAdd(call, doc, amount); if(nd) draw(nd); });
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { const x = items.find(z => z.id === b.dataset.del); if(!x || !await uiConfirm(`${yen(x.amount)} を削除しますか？`, '削除', 'danger')) return;
      const r = await call('del', { id: x.id }); if(r.error){ await uiAlert(r.error.message); return; } draw(r.data); }); };
  const r = await call('list'); if(r.error){ fail(r.error.message); return; }
  draw(r.data);
}
