// v0.21・SQL 121：⑦アプローチ（オーナーにヒアリングして決めた形 2026-10-16）。提案はあくまで目安（連絡先交換のお客様から30名・最後の来店が古い順・名前だけ・敬称略）
//   →「次へ（連絡済リスト共有）」→ 連絡したお客様を選ぶ（提案と同じ並び・提案以外も可・一覧にないお客様はフルネーム）→ ランダムで1名のスクショを送信 → 係（本人が係なら担当黒服）へ。スクショは次の日に消える
let SALES = null;
const g2 = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 10px';
async function salesLoad(){ const r = await sb.rpc('cast_sales_today', { p_token: TOKEN }); if(r.error){ fail(r.error.message); return false; } SALES = r.data; return true; }
async function salesHome(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  if(!await salesLoad()) return;
  const S = SALES, R = S.report;
  if(R){ salesShot(); return; }
  if(S.off){ show('<div class="ttl">アプローチ</div><div class="card c muted">本日は出勤日ではありません</div>'); return; } /* v0.22・SQL 122：シフトが確定した月は出勤の日だけ */
  show(`<div class="ttl">アプローチ</div><div class="card"><div class="gh">${mdDay(S.date)}（${WD[new Date(S.date+'T00:00:00+09:00').getDay()]}）の提案 ${S.plan.length}名（敬称略）</div>
    ${S.plan.length?`<div style="${g2}">${S.plan.map(n => `<div style="padding:6px 0;border-bottom:1px solid var(--line);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n)}</div>`).join('')}</div>`:((S.contacts||[]).length?'<div class="muted sm" style="padding:6px 0">今日の提案はありません。「次へ」の連絡済リストから選べます</div>':'<div class="muted sm" style="padding:6px 0">連絡先交換の提出がありません</div>') /* v0.47：連絡先があるのに「提出がありません」と出ていた（ゲネプロ マイページ #2） */}</div>
    <button class="btn" id="slNext">次へ（連絡済リスト共有）</button>`);
  $('slNext').onclick = salesPick;
}
function salesPick(){
  setBack(salesHome);
  const on = new Set(), extra = [];
  const paint = () => {
    show(`<div class="ttl">連絡済リスト</div><div class="card"><div class="gh">連絡先交換のお客様（敬称略）　選択 ${on.size + extra.length}名</div>
      ${SALES.contacts.length?`<div style="${g2}">${SALES.contacts.map(c => `<button class="btn g" data-sc="${c.id}" style="padding:9px 6px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${on.has(c.id)?'background:var(--ink);color:#fff;border-color:var(--ink)':''}">${esc(c.name)}</button>`).join('')}</div>`:'<div class="muted sm">連絡先交換の提出がありません</div>'}
      <div class="gh" style="margin-top:12px">一覧にないお客様</div>
      ${extra.length?`<div style="${g2};margin-bottom:6px">${extra.map((n, i) => `<button class="btn g" data-sx="${i}" style="padding:9px 6px;font-size:14px;background:var(--ink);color:#fff;border-color:var(--ink)">${esc(n)}</button>`).join('')}</div>`:''}
      <div style="display:flex;gap:8px"><input id="slX" maxlength="30" placeholder="フルネーム" style="flex:1;min-width:0;height:48px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)"><button class="btn g" id="slAdd" style="width:auto;padding:0 16px">追加</button></div></div>
      <button class="btn" id="slGo">連絡済リスト共有</button>`);
    $('main').querySelectorAll('[data-sc]').forEach(b => b.onclick = () => { const id = b.dataset.sc; on.has(id) ? on.delete(id) : on.add(id); const y = window.scrollY; paint(); window.scrollTo(0, y); });
    $('main').querySelectorAll('[data-sx]').forEach(b => b.onclick = () => { extra.splice(+b.dataset.sx, 1); const y = window.scrollY; paint(); window.scrollTo(0, y); });
    $('slAdd').onclick = () => { const v = $('slX').value.trim().replace(/[\s　]+/g, ' '); if(!v) return; extra.push(v); const y = window.scrollY; paint(); window.scrollTo(0, y); };
    $('slGo').onclick = async () => {
      const n = on.size + extra.length; if(!n){ await uiAlert('連絡したお客様を選んでください'); return; }
      if(!await uiConfirm(`連絡済リスト ${n}名を共有しますか？`)) return;
      $('slGo').disabled = true;
      const q = await sb.rpc('cast_sales_report', { p_token: TOKEN, p_ids: [...on], p_extra: extra });
      if(q.error){ $('slGo').disabled = false; await uiAlert(q.error.message); return; }
      SALES = q.data; salesShot();
    };
  };
  paint();
}
function salesShot(){
  setBack(home);
  const R = SALES.report;
  show(`<div class="ttl">アプローチ</div><div class="card"><div class="c" style="padding:6px;color:var(--ok);font-weight:700">連絡済リスト共有済み ${R.count}名</div></div>
    <div class="card"><div class="gh">スクショ</div><div style="font-weight:700;font-size:17px">${esc(R.pick)}</div>
    ${R.sent?`<div class="sm" style="color:var(--ok);margin-top:8px">送信済み${R.to?`（${esc(R.to)}）`:''}</div>`:`<label class="btn g" style="display:block;text-align:center;margin-top:10px"><span id="slPt">スクショを選ぶ</span><input type="file" id="slP" accept="image/*" style="display:none"></label><div class="muted sm" style="margin-top:6px">${R.kind==='kakari'?esc(KL):'担当黒服'}${R.to?`（${esc(R.to)}）`:''}に LINE で届きます。写真はシステムに残りません</div>`}</div>
    ${R.sent?'':'<button class="btn" id="slShot">送信</button>'}`);
  if(R.sent) return;
  $('slP').onchange = () => { $('slPt').textContent = $('slP').files[0] ? 'スクショを選びました（選び直す）' : 'スクショを選ぶ'; };
  $('slShot').onclick = async () => {
    const file = $('slP').files[0]; if(!file){ await uiAlert('スクショの写真を選んでください'); return; }
    $('slShot').disabled = true;
    try{
      const blob = await shrinkJpeg(file);
      const up = await sb.storage.from('sales-shots').upload(`${R.shot}.jpg`, blob, { contentType:'image/jpeg', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error;
      const q = await sb.rpc('cast_sales_shot', { p_token: TOKEN }); if(q.error) throw q.error;
      await uiAlert(q.data.sent ? `スクショを送信しました（${q.data.to}）` : 'スクショを受付しました。\n送り先が LINE 未連携のため、LINE は届いていません');
      await salesLoad(); salesShot();
    }catch(e){ $('slShot').disabled = false; await uiAlert(e.message || String(e)); }
  };
}

