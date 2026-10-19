// v0.09・SQL 105：名刺発注。v0.10・SQL 107：印刷する名前は苗字と名前（両方必須）、「前回と同じ」ボタンで前回の名前を入れる。店の Gmail から印刷屋さんへメール。名刺代は報酬から控除
async function cardOrder(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_card_info', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const C = r.data, ds = t => new Date(t).toLocaleDateString('ja-JP', { timeZone:'Asia/Tokyo', month:'numeric', day:'numeric' });
  const hist = (C.history||[]).map(h => `<div class="row"><span>${ds(h.at)}　${esc(h.print_name)}</span><b>${h.qty}枚</b></div>`).join('');
  if(!C.ready){ show(`<div class="card c muted">名刺発注は準備中です</div>${hist?`<div class="card"><div class="gh">発注履歴</div>${hist}</div>`:''}`); return; }
  const lf = C.last_family || '', lg = C.last_given || '', fld = 'width:100%;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card);color:var(--ink)';
  show(`<div class="card"><div class="row"><span>依頼者</span><b>${esc(C.name)}</b></div>
      <div class="row" style="margin-top:10px"><span>印刷する名前（フルネーム）</span>${lf?'<button class="btn g" id="cnLast" style="width:auto;padding:6px 12px;font-size:14px">前回と同じ</button>':''}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px"><label class="f">苗字<input id="cnF" maxlength="20" placeholder="例：一ノ瀬" style="${fld}"></label><label class="f">名前<input id="cnG" maxlength="20" placeholder="例：美緒" style="${fld}"></label></div>
      <div class="row" style="margin-top:10px"><span>枚数</span><b>${C.qty}枚 ${yen(C.price)}</b></div></div>
    <div class="err sm" style="margin:0 2px 12px">名刺代 ${yen(C.price)}は、報酬から控除されます。</div>
    <button class="btn" id="cnGo">名刺発注</button>${hist?`<div class="card" style="margin-top:12px"><div class="gh">発注履歴</div>${hist}</div>`:''}`);
  if(lf) $('cnLast').onclick = () => { $('cnF').value = lf; $('cnG').value = lg; }; /* 初回は出さない（オーナー 2026-10-15） */
  $('cnGo').onclick = async () => {
    const f = $('cnF').value.trim(), g = $('cnG').value.trim(), nm = `${f}　${g}`;
    if(!f || !g){ await uiAlert('苗字と名前を両方入力してください'); return; }
    if(!await uiConfirm(`名刺 ${C.qty}枚（${nm}）を発注しますか？\n名刺代 ${yen(C.price)}は報酬から控除されます`)) return;
    $('cnGo').disabled = true;
    const q = await sb.rpc('cast_card_order', { p_token: TOKEN, p_family: f, p_given: g });
    if(q.error){ $('cnGo').disabled = false; await uiAlert(q.error.message); return; }
    show(`<div class="card c"><div class="big">送信完了</div><p>名刺 ${q.data.qty}枚（${esc(nm)}）の発注を受付しました。</p>${q.data.sent?'':'<p class="err sm">印刷屋さんへのメールの送信に失敗しました。黒服にご連絡ください</p>'}</div><button class="btn g" id="cnHome">ホーム</button>`);
    $('cnHome').onclick = home;
  };
}

