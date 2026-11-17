// ⑦アプローチ（オーナーにヒアリングして決めた形）。提案はあくまで目安（連絡先交換のお客様から30名・最後の来店が古い順・名前だけ・敬称略）
// →「次へ（連絡済リスト共有）」→ 連絡したお客様を選ぶ（提案と同じ並び・提案以外も可・一覧にないお客様はフルネーム）→ ランダムで1名のスクショを送信 → 係（本人が係なら担当黒服）へ。スクショは次の日に消える
let SALES = null;
const g2 = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 10px';
async function salesLoad(){ const r = await sb.rpc('cast_sales_today', { p_token: TOKEN }); if(r.error){ fail(r.error.message); return false; } SALES = r.data; return true; }
async function salesHome(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  if(!await salesLoad()) return;
  const S = SALES, R = S.report;
  if(R){ salesShot(); return; }
  if(S.store_off){ show('<div class="ttl">アプローチ</div><div class="card c muted">本日はお店の休みです</div>'); return; } /* 土日祝（広島は日祝）・休の日 */
  if(S.off){ show('<div class="ttl">アプローチ</div><div class="card c muted">本日は出勤日ではありません</div>'); return; } /* シフトが確定した月は出勤の日だけ */
  show(`<div class="ttl">アプローチ</div><div class="card"><div class="gh">${mdW(S.date)}の提案 ${S.plan.length}名（敬称略）</div>
    ${S.plan.length?`<div style="${g2}">${S.plan.map(n => `<div style="padding:6px 0;border-bottom:1px solid var(--line);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n)}</div>`).join('')}</div>`:((S.contacts||[]).length?'<div class="muted sm" style="padding:6px 0">今日の提案はありません。「次へ」の連絡済リストから選べます</div>':'<div class="muted sm" style="padding:6px 0">連絡先交換の提出がありません</div>') /* 連絡先があるのに「提出がありません」と出ていた（ゲネプロ マイページ #2） */}</div>
    <button class="btn" id="slNext">次へ（連絡済リスト共有）</button>`);
  $('slNext').onclick = salesPick;
}
// 連絡済リストの画面の文（本日の提案・スクショ読取・一覧・一覧にないお客様）。P＝選んだお客様の状態（salesPick）
const slBtn = (attr, name, v) => `<button class="btn g" ${attr} style="padding:9px 6px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${v?'background:var(--ink);color:#fff;border-color:var(--ink)':''}">${esc(name)}</button>`;
const slCBtn = (c, P) => slBtn(`data-sc="${c.id}" data-kn="${esc(kanaKey(c.kana))}"`, c.name, P.on.has(c.id)); /* 検索で絞るボタン（本日の提案と一覧） */
function slPickHtml(P){
  /* 本日の提案（朝のアプローチの LINE で送ったお客様）を一番上にボタンで（2026-11-17 オーナー「スクショ読み取りで提出したくない女の子もいる。今日提案した30名をタップで」）。
     cast_sales_today の contacts は提案の順に先頭から並ぶので、先頭の plan の数だけが提案。下の一覧には重ねて出さない */
  const pl = SALES.contacts.slice(0, SALES.plan.length), plIds = new Set(pl.map(c => c.id)), rest = SALES.contacts.filter(c => !plIds.has(c.id));
  return `<div class="ttl">連絡済リスト</div><div class="card">
      ${pl.length?`<div class="gh">本日の提案 ${pl.length}名（敬称略）</div><div style="${g2};margin-bottom:12px">${pl.map(c => slCBtn(c, P)).join('')}</div>`:''}
      <label class="btn g" style="display:block;text-align:center;margin-bottom:10px"><span id="slRt">スクショ読取</span><input type="file" id="slR" accept="image/*" multiple style="display:none"></label>
      ${P.rd?slReadHtml(P):''}
      <div class="gh">連絡先交換のお客様（敬称略）　<span id="slCnt">選択 ${P.on.size + P.extra.length}名</span></div>
      ${SALES.contacts.length?`<input id="slQ" type="search" placeholder="名前・フリガナで検索" value="${esc(P.q)}" style="width:100%;height:44px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;margin:4px 0 8px;background:var(--card);color:var(--ink)"><div class="muted sm" id="slNone" style="display:none;padding:6px 0">該当なし</div><div style="${g2}">${rest.map(c => slCBtn(c, P)).join('')}</div>`:'<div class="muted sm">連絡先交換の提出がありません</div>'}
      <div class="gh" style="margin-top:12px">一覧にないお客様</div>
      ${P.extra.length?`<div style="${g2};margin-bottom:6px">${P.extra.map((n, i) => `<button class="btn g" data-sx="${i}" style="padding:9px 6px;font-size:14px;background:var(--ink);color:#fff;border-color:var(--ink)">${esc(n)}</button>`).join('')}</div>`:''}
      <div style="display:flex;gap:8px"><input id="slX" maxlength="30" placeholder="フルネーム" style="flex:1;min-width:0;height:48px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)"><button class="btn g" id="slAdd" style="width:auto;padding:0 16px">追加</button></div></div>
      <button class="btn" id="slGo">連絡済リスト共有</button>`;
}
/* スクショ読取の結果：一致（選択済み）と候補（［追加］で決める） */
function slReadHtml(P){
  const rd = P.rd, cName = id => (SALES.contacts.find(c => c.id === id) || {}).name || '';
  return `<div class="muted sm" style="margin-bottom:6px">読取 ${rd.n}枚　一致 ${rd.hits.length}名</div>
    ${rd.hits.length?`<div style="${g2};margin-bottom:10px">${rd.hits.map(h => h.id ? slBtn(`data-sc="${h.id}"`, cName(h.id), P.on.has(h.id)) : slBtn(`data-sxh="${esc(h.name)}"`, h.name, P.extra.includes(h.name))).join('')}</div>`:''}
    ${rd.cands.length?`<div class="muted sm" style="display:flex;border-bottom:1px solid var(--line);padding-bottom:4px"><span style="flex:1">候補 ${rd.cands.length}名${rd.cands.every(c => !c.id)?'（前回の手打ち）':''}</span><span>読取／名前</span></div>
      ${rd.cands.map((c, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span class="muted" style="flex:none;width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.read)}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span><button class="btn g" data-sca="${i}" style="width:auto;padding:0 16px;height:44px;margin:0">追加</button></div>`).join('')}<div style="height:10px"></div>`:''}`;
}
/* スクショ読取（2026-11-17 オーナー）：LINE のトーク一覧の表示名（ニックネーム・記号・絵文字まじり）を、その子の一覧・前の手打ちの名前・覚えた表示名と照らす。
   同じ名前（記号・敬称を除く）か覚えた表示名＝一致（選択済みにする）。名字だけ・名前だけ＝候補（本人が［追加］で決め、次から一致になるよう覚える）。合わない名前は出さない */
const slNorm = v => String(v || '').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').replace(/(様|さま|さん|くん|君|ちゃん)$/, '').toLowerCase();
function slMatch(rows, info){
  const C = SALES.contacts.map(c => ({ id: c.id, name: c.name, k: slNorm(c.name), kn: kanaKey(c.kana) })), T = (info.typed || []).map(n => ({ name: n, k: slNorm(n) }));
  const A = {}; (info.alias || []).forEach(a => { A[a.read] = a; });
  const hits = [], cands = [], seen = new Set();
  const hit = h => { const key = h.id || 'x:' + h.name; if(seen.has(key)) return; seen.add(key); hits.push(h); };
  rows.forEach(r => { const k = slNorm(r.name), kn = kanaKey(r.kana); if(!k) return;
    const a = A[k]; if(a && (!a.id || C.some(c => c.id === a.id))){ hit(a.id ? { id: a.id } : { name: a.name }); return; }
    const c1 = C.filter(c => c.k === k); if(c1.length === 1){ hit({ id: c1[0].id }); return; }
    const t1 = T.find(t => t.k === k); if(t1){ hit({ name: t1.name }); return; }
    const c2 = kn.length >= 4 ? C.filter(c => c.kn && c.kn === kn) : []; if(c2.length === 1){ hit({ id: c2[0].id }); return; }
    if(k.length < 2) return;
    const part = x => x.k !== k && (x.k.startsWith(k) || x.k.endsWith(k));
    C.filter(c => part(c) || (kn.length >= 2 && c.kn && c.kn !== kn && (c.kn.startsWith(kn) || c.kn.endsWith(kn)))).slice(0, 3).forEach(c => cands.push({ read: r.name, key: k, id: c.id, name: c.name }));
    T.filter(part).slice(0, 3).forEach(t => cands.push({ read: r.name, key: k, name: t.name }));
  });
  return { hits, cands: cands.filter((c, i) => !seen.has(c.id || 'x:' + c.name) && cands.findIndex(x => x.key === c.key && (x.id || x.name) === (c.id || c.name)) === i) };
}
const slB64 = blob => new Promise((ok, ng) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.onerror = ng; f.readAsDataURL(blob); });
/* 写真を選んだら：小さくして読取の関数（contact-read）へ。写真はどこにも残さない。失敗は黙らずに知らせる（スキル olive-photo-shoot） */
async function slRead(P, files){
  if(!files.length) return;
  $('slRt').textContent = '読取中…'; $('slR').disabled = true;
  try{
    const images = []; for(const f of files.slice(0, 6)) images.push(await slB64(await shrinkJpeg(f)));
    const [r, inf] = await Promise.all([sb.functions.invoke('contact-read', { body: { token: TOKEN, images } }), sb.rpc('cast_contact_read_info', { p_token: TOKEN })]);
    if(inf.error) throw inf.error;
    let why = r.data?.reason || ''; if(r.error && r.error.context?.json) why = await r.error.context.json().then(j => j.reason || '').catch(() => '');
    if(r.error || !Array.isArray(r.data?.rows) || why){ await uiAlert(/まで/.test(why) ? why : 'スクショの読取に失敗しました。再度お試しください'); P.repaint(); return; }
    P.rd = { n: images.length, ...slMatch(r.data.rows, inf.data) };
    P.rd.hits.forEach(h => { if(h.id) P.on.add(h.id); else if(!P.extra.includes(h.name)) P.extra.push(h.name); });
    P.repaint();
    if(!r.data.rows.length) await uiAlert('本日のトークが見つかりません');
  }catch(e){ await uiAlert(e.message || String(e)); P.repaint(); }
}
/* 候補の［追加］：選択にして、表示名を覚える（次の読取から一致） */
async function slCand(P, b){
  const c = P.rd.cands[+b.dataset.sca]; b.disabled = true;
  const s = await sb.rpc('cast_contact_alias_save', { p_token: TOKEN, p_read: c.key, p_contact: c.id || null, p_name: c.name }); if(s.error){ b.disabled = false; await uiAlert(s.error.message); return; }
  P.rd.hits.push(c.id ? { id: c.id } : { name: c.name }); if(c.id) P.on.add(c.id); else if(!P.extra.includes(c.name)) P.extra.push(c.name);
  P.rd.cands = P.rd.cands.filter(x => x.key !== c.key && (x.id || 'x:' + x.name) !== (c.id || 'x:' + c.name)); P.repaint();
}
async function slShare(P){
  const n = P.on.size + P.extra.length; if(!n){ await uiAlert('連絡したお客様を選んでください'); return; }
  if(!await uiConfirm(`連絡済リスト ${n}名を共有しますか？`)) return;
  $('slGo').disabled = true;
  const q = await sb.rpc('cast_sales_report', { p_token: TOKEN, p_ids: [...P.on], p_extra: P.extra });
  if(q.error){ if($('slGo')) $('slGo').disabled = false; await uiAlert(q.error.message); return; }
  SALES = q.data; salesShot();
}
function salesPick(){
  setBack(salesHome);
  const P = { on: new Set(), extra: [], q: '', rd: null }; // 名前で検索（キャスト「お客様の名前を探してプッシュするのが不便」。読みが無いので、あいうえお順ではなく文字で絞り込む）
  const nz = v => String(v||'').replace(/[\s　]+/g, '');
  const filt = () => { const k = nz(P.q); let n = 0; $('main').querySelectorAll('[data-kn]').forEach(b => { const hit = !k || nz(b.textContent).includes(k) || (!!kanaKey(P.q) && (b.dataset.kn || '').includes(kanaKey(P.q))); b.style.display = hit ? '' : 'none'; if(hit) n++; }); const z = $('slNone'); if(z) z.style.display = n ? 'none' : ''; };
  P.repaint = () => { const y = window.scrollY; paint(); window.scrollTo(0, y); };
  const paint = () => {
    show(slPickHtml(P));
    $('main').querySelectorAll('[data-sc]').forEach(b => b.onclick = () => { const id = b.dataset.sc; P.on.has(id) ? P.on.delete(id) : P.on.add(id); /* 押したボタンと数だけ直す（前は一覧を全部作り直していた）。同じお客様のボタンは一緒に */
      const v = P.on.has(id); $('main').querySelectorAll(`[data-sc="${id}"]`).forEach(x => { x.style.background = v ? 'var(--ink)' : ''; x.style.color = v ? '#fff' : ''; x.style.borderColor = v ? 'var(--ink)' : ''; }); $('slCnt').textContent = `選択 ${P.on.size + P.extra.length}名`; });
    $('main').querySelectorAll('[data-sxh]').forEach(b => b.onclick = () => { const n = b.dataset.sxh, i = P.extra.indexOf(n); i >= 0 ? P.extra.splice(i, 1) : P.extra.push(n); P.repaint(); });
    $('main').querySelectorAll('[data-sca]').forEach(b => b.onclick = () => slCand(P, b));
    $('slR').onchange = () => slRead(P, [...$('slR').files]);
    const qi = $('slQ'); if(qi) qi.oninput = () => { P.q = qi.value; filt(); }; filt();
    $('main').querySelectorAll('[data-sx]').forEach(b => b.onclick = () => { P.extra.splice(+b.dataset.sx, 1); P.repaint(); });
    $('slAdd').onclick = () => { const v = $('slX').value.trim().replace(/[\s　]+/g, ' '); if(!v) return; P.extra.push(v); P.repaint(); };
    $('slGo').onclick = () => slShare(P);
  };
  paint();
}
function salesShot(){
  setBack(home);
  const R = SALES.report;
  show(`<div class="ttl">アプローチ</div><div class="card"><div class="c" style="padding:6px;color:var(--ok);font-weight:700">連絡済リスト共有済 ${R.count}名</div></div>
    <div class="card"><div class="gh">スクショ</div><div style="font-weight:700;font-size:17px">${esc(R.pick)}</div>${R.sent?'':'<div class="sm" style="color:var(--warn);margin-top:4px">19:50 までに送ってください</div>'}
    ${R.sent?`<div class="sm" style="color:var(--ok);margin-top:8px">送信済${R.to?`（${esc(R.to)}）`:''}</div>`:`<label class="btn g" style="display:block;text-align:center;margin-top:10px"><span id="slPt">スクショを選ぶ</span><input type="file" id="slP" accept="image/*" style="display:none"></label><div class="muted sm" style="margin-top:6px">${R.kind==='kakari'?esc(KL):'担当黒服'}${R.to?`（${esc(R.to)}）`:''}に LINE で届きます。写真はシステムに残りません</div>`}</div>
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
      /*点検 A1・届かなかった時は「送信済み」にしない（送信のボタンが残り、送り直せる）。文は原因ごと */
      const ng = q.data.reason === 'no_to' ? '担当黒服 未選択のため、スクショは届いていません。黒服にご連絡ください'
        : q.data.reason === 'fail' ? 'スクショの送信に失敗しました。再度お試しください'
        : `送り先${q.data.to ? `（${q.data.to}）` : ''}が LINE 未連携のため、スクショは届いていません。黒服にご連絡ください`;
      await uiAlert(q.data.sent ? `スクショを送信しました（${q.data.to}）` : ng);
      await salesLoad(); salesShot();
    }catch(e){ if($('slShot')) $('slShot').disabled = false; await uiAlert(e.message || String(e)); }
  };
}

