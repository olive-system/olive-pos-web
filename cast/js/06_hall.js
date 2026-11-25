// 黒服の TODO（オーナー。TimeTree の「todoリスト写メ報告」の代わり）。その日の出勤の黒服がやる。写真が要る項目は撮らないと完了にならない。できない時は理由
const TODO_SLOT = { open:'開店作業', close:'閉店作業', by17:'17時まで', none:'' };
async function hallTodo(){
  setBack(hallHome); show('<div class="muted" style="padding:20px">読み込み中…</div>');
  const [r, ab] = await Promise.all([sb.rpc('hall_todos', { p_token: TOKEN }), sb.rpc('hall_ab_items', { p_token: TOKEN })]); if(r.error){ show(`<div class="card">${esc(r.error.message)}</div>`); return; }
  tdAB = ab.error ? null : ab.data; /* AB棚の棚卸し */
  const D = r.data, L = D.items || [], d = new Date(D.day+'T00:00:00+09:00');
  const st = x => x.status === 'done' ? `<b style="color:var(--ok)">完了　${esc(x.by||'')} ${x.at?new Date(x.at).toTimeString().slice(0,5):''}</b>${x.late?' <b style="color:var(--warn)">17:00 超過</b>':''}` : x.status === 'skip' ? `<b style="color:var(--muted)">できない　${esc(x.by||'')} ${x.at?new Date(x.at).toTimeString().slice(0,5):''}</b>` : `<b style="color:var(--warn)">未完了${x.late?'　17:00 超過':''}</b>`;
  /* 休日分（休みの日の TODO を次の営業日に。オーナー「営業日初日に全部やる」「長い連休は17時まで」）。言葉は用語集：休日分・本日分・期限 閉店・期限 17:00 */
  const md = s => `${mdDay(s)} ${WD[jd(s).getDay()]}`;
  const tag = t => `<small class="muted" style="border:1px solid var(--line);border-radius:6px;padding:1px 6px;white-space:nowrap">${t}</small>`;
  const card = (x,i) => `<button class="card" data-td="${i}" style="display:block;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(x.name)}</b>${x.carry ? tag(md(x.day)) : TODO_SLOT[x.slot] ? tag(TODO_SLOT[x.slot]) : ''}</div>
    <div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px;font-size:14px"><span class="muted">${x.sub ? esc(x.sub) : [x.need_photo?'写真':'', x.need_note?'書く':''].filter(Boolean).join('・')}</span>${st(x)}</div></button>`;
  const C = L.map((x,i) => [x,i]).filter(([x]) => x.carry), T = L.map((x,i) => [x,i]).filter(([x]) => !x.carry), cd = D.carry_days || [], late17 = D.deadline === '17:00';
  const sec = (t, right, warn) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:12px 2px 6px;font-weight:700;${warn?'color:var(--warn)':''}"><span>${t}</span>${right||''}</div>`;
  show(`<div class="ttl">TODO　${mdWD(d)}</div>
    ${C.length ? sec(`休日分（${cd.length>2 ? `${md(cd[0])}〜${md(cd[cd.length-1])}` : cd.map(md).join('・')}）`, `<span style="${late17?'background:var(--warn-soft);color:var(--warn);':'color:var(--muted);font-weight:400;'}border-radius:6px;padding:2px 8px;font-size:13px;white-space:nowrap">期限 ${esc(D.deadline||'閉店')}</span>`, late17) + C.map(([x,i]) => card(x,i)).join('') + sec('本日分') : ''}
    ${T.map(([x,i]) => card(x,i)).join('') || '<div class="card muted">本日分の TODO はありません</div>'}`);
  $('main').querySelectorAll('[data-td]').forEach(b => b.onclick = () => hallTodoOne(L[+b.dataset.td]));
}
// 写真は40枚まで（広島の黒服の報告「充電の写真は24枚上げる必要があるが10枚までしか送れない」）
// 写真は10枚まで（並べて見て × で外せる）・完了の後も精算までは「やり直す」（黒服の報告 → オーナー「この形でよい」「精算までは直せる」）
let tdShots = [];
/* 高級酒の在庫確認（オーナー「先入観なくできる棚卸しで」）。数える人には理論在庫も前回の数も出さない。空欄から入力 */
/* 理論在庫と違う品は、本数を見せずに「違う」と出して再度数えてもらい、再度数えても違えば品の下に理由（オーナー「違うという表示に。なので数え直せ」「相違があれば理由を下に」）
   tdDiff：step 1＝再度数える品（空欄に戻す）・step 2＝理由を入れる品。tdWhy：品ごとの理由 */
let tdAB = null, tdAbVals = {}, tdDiff = null, tdWhy = {};
const tdAbOk = v => /^\d{1,3}$/.test(String(v ?? '').trim());
/* 見出しはメニューの分け方（ワイン・シャンパン・ボトルキープ）。データベースの「AB棚」はボトルキープの数える品なので、名前を変えて一番下へ（オーナー「AB棚はややこしい」） */
const tdAbGroups = () => { const G = (tdAB && tdAB.groups) || (tdAB ? [{ title: 'AB棚', products: tdAB.products || [] }] : []);
  return [...G.filter(g => g.title !== 'AB棚'), ...G.filter(g => g.title === 'AB棚').map(g => ({ ...g, title: 'ボトルキープ' }))]; };
const tdAbCnt = P => { const n = P.filter(p => tdAbOk(tdAbVals[p.id])).length; return `入力済 ${n}品・未入力 ${P.length - n}品`; };
// 前の週に在庫確認を数えた黒服は、次の週は対象外（SQL 642。入力欄と［完了］を出さない）
const tdAbNg = x => !!(tdAB && tdAB.item === x.id && tdAB.prev_me);
function tdAbHtml(x, done){
  if(!tdAB || tdAB.item !== x.id || !(tdAB.products || []).length) return '';
  const G = tdAbGroups().filter(g => (g.products || []).length), C = tdAB.counts || {}, D = new Set(!done && tdDiff ? tdDiff.ids : []), why = !done && tdDiff && tdDiff.step === 2;
  const row = (p, i, r) => `<div style="padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;line-height:1.4">${esc(p.name)}${D.has(p.id) ? '　<span style="color:var(--warn);font-weight:700;font-size:13px;white-space:nowrap">違う</span>' : ''}</div>${r}<span class="muted sm" style="width:1.5em">本</span></div>
    ${why && D.has(p.id) ? `<input data-abw="${p.id}" maxlength="200" placeholder="理由" value="${esc(tdWhy[p.id] ?? '')}" style="width:100%;box-sizing:border-box;margin-top:6px;font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">` : ''}</div>`;
  const box = D.size ? `<div class="warnbox" style="padding:12px 16px"><b class="t" style="margin-bottom:2px">違う ${D.size}品</b>${why ? '再度数えても違う品は、理由を入力してください' : '再度数えてください'}</div>` : '';
  if(done) return Object.keys(C).length ? G.map(g => `<div class="card"><b>${esc(g.title)}</b>${g.products.map((p, i) => row(p, i, `<b>${C[p.id] ?? ''}</b>`)).join('')}</div>`).join('') : '';
  return box + G.map((g, gi) => `<div class="card"><div style="display:flex;align-items:baseline;margin-bottom:2px"><b style="flex:1">${esc(g.title)}</b><span class="muted sm" data-abn="${gi}">${tdAbCnt(g.products)}</span></div>
    ${g.products.map((p, i) => row(p, i, `<input data-ab="${p.id}" data-abg="${gi}" inputmode="numeric" maxlength="3" value="${esc(tdAbVals[p.id] ?? '')}" style="width:64px;text-align:right;font:inherit;font-size:16px;padding:6px 8px;border:1px solid ${D.has(p.id) ? 'var(--warn)' : 'var(--line)'};border-radius:8px">`)).join('')}</div>`).join('') + tdAddHtml();
}
/* メニュー追加（オーナー「黒服のスマホから」「販売価格と小計額、ポイントも」「縦に長くするな」「棚卸しに集中させたい」）。3行：メニュー名｜本数・販売価格｜小計・バック｜ポイント（はじめの値は menuBackInit。2026-11-19 オーナー「バックの初期値は銀座0円、広島10%」）
   カテゴリーは上の切り替え（ボトルキープは、数える品がある店＝銀座だけ）。略称は出さない（POS で空欄でよい欄）。足した品はすぐ一覧に出て、入れた本数が基準 */
const TD_ADD = [['name', 'メニュー名'], ['qty', '本数'], ['price', '販売価格'], ['sub', '小計'], ['back', 'バック'], ['points', 'ポイント']];
let tdAddCat = 'ワイン';
function tdAddHtml(){
  const fs = 'flex:1;min-width:0;box-sizing:border-box;font:inherit;font-size:16px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)';
  const cats = ['ワイン', 'シャンパン', ...(tdAbGroups().some(g => g.title === 'ボトルキープ' && (g.products || []).length) ? ['ボトルキープ'] : [])];
  if(!cats.includes(tdAddCat)) tdAddCat = 'ワイン';
  const f = (k, u) => { const t = TD_ADD.find(x => x[0] === k)[1], n = k === 'name';
    return `<input data-tda="${k}" placeholder="${t}" ${n ? 'maxlength="60"' : `inputmode="${k === 'points' ? 'decimal' : 'numeric'}" maxlength="${k === 'qty' ? 3 : 9}"`} style="${fs}${n ? '' : ';text-align:right'}${k === 'qty' ? ';flex:0 0 64px' : ''}">${u ? `<span class="muted sm" style="width:1.5em">${u}</span>` : ''}`; };
  const line = h => `<div style="display:flex;align-items:center;gap:8px;margin-top:8px">${h}</div>`;
  return `<div class="card"><b>メニュー追加</b><div class="seg" style="margin:8px 0 0">${cats.map((c, i) => `<button type="button" data-tdc="${c}" class="${c === tdAddCat ? 'on' : ''}" style="padding:8px 4px;white-space:nowrap;font-size:15px${i ? ';border-left:1px solid var(--pri)' : ''}">${c}</button>`).join('')}</div>
    ${line(f('name') + f('qty', '本'))}${line(f('price', '円') + f('sub', '円'))}${line(f('back', '円') + f('points', 'pt'))}
    <button class="btn g" id="tdAddGo" style="margin-top:12px">追加</button></div>`;
}
function tdAddWire(x){ if(!$('tdAddGo')) return;
  /* バック・ポイントのはじめの値（広島のワイン・シャンパンは販売価格の10%・÷1,000。ほかは0。変えられる。lib/olive/core.js の menuBackInit） */
  const q = k => $('main').querySelector(`[data-tda="${k}"]`), fill = () => { const v = menuBackInit(STORE, tdAddCat, q('price')?.value); if(q('back')) q('back').value = v.back; if(q('points')) q('points').value = v.points; };
  fill(); q('price')?.addEventListener('input', fill);
  $('main').querySelectorAll('[data-tdc]').forEach(b => b.onclick = () => { tdAddCat = b.dataset.tdc; $('main').querySelectorAll('[data-tdc]').forEach(x => x.classList.toggle('on', x === b)); fill(); });
  $('tdAddGo').onclick = async () => { const v = { ...Object.fromEntries([...$('main').querySelectorAll('[data-tda]')].map(e => [e.dataset.tda, e.value.trim()])), cat: tdAddCat };
    const miss = TD_ADD.find(([k]) => !v[k]); if(miss){ await uiAlert(`${miss[1]}を入力してください`); return; }
    $('tdAddGo').disabled = true;
    const r = await sb.rpc('hall_menu_add', { p_token: TOKEN, p_item: x.id, p_row: v, ...(x.carry ? { p_day: x.day } : {}) });
    if(r.error){ if($('tdAddGo')) $('tdAddGo').disabled = false; await uiAlert(r.error.message); return; }
    const ab = await sb.rpc('hall_ab_items', { p_token: TOKEN }); if(!ab.error) tdAB = ab.data;
    tdAbVals[r.data.id] = v.qty; await uiAlert(`${v.name}を追加しました`); hallTodoOne(x, { note: $('tdN') ? $('tdN').value : null }); }; }
/* 数える品の入力：打つたびに、その仲間の入れた数を出し直す */
function tdAbWire(){ $('main').querySelectorAll('[data-abw]').forEach(b => b.oninput = () => { tdWhy[b.dataset.abw] = b.value; });
  $('main').querySelectorAll('[data-ab]').forEach(b => b.oninput = () => { tdAbVals[b.dataset.ab] = b.value.trim(); const g = tdAbGroups().filter(g => (g.products || []).length)[+b.dataset.abg]; $('main').querySelector(`[data-abn="${b.dataset.abg}"]`).textContent = tdAbCnt(g.products); }); }
/* 在庫確認の［完了］：数と理由を送る。違う品があれば画面を描き直して false（1回目は空欄に戻して再度数える。再度数えても違えば理由） */
async function tdStockCheck(x, abP){
  if(tdDiff && tdDiff.step === 2 && tdDiff.ids.some(id => !String(tdWhy[id] ?? '').trim())){ $('tdGo').disabled = false; await uiAlert('理由を入力してください'); return false; }
  const c = await sb.rpc('hall_stock_check', { p_token: TOKEN, p_item: x.id, p_rows: Object.fromEntries(abP.map(p => [p.id, tdAbVals[p.id]])), p_reasons: tdDiff && tdDiff.step === 2 ? tdWhy : {}, ...(x.carry ? { p_day: x.day } : {}) }); if(c.error) throw c.error;
  if(!(c.data && c.data.status === 'diff')) return true;
  const ids = c.data.items || [];
  if(!tdDiff){ ids.forEach(id => { delete tdAbVals[id]; }); tdDiff = { step: 1, ids }; } else tdDiff = { step: 2, ids };
  hallTodoOne(x, { note: $('tdN') ? $('tdN').value : null }); window.scrollTo(0, 0); return false;
}
/* TODO の1件の画面の文（済・できない・数える品・内容・写真・ボタン） */
function hallTodoHtml(x, keep, done, ph, grid, fld){ return `<div class="ttl">${esc(x.name)}</div><div class="card">${TODO_SLOT[x.slot]?`<div class="muted" style="font-size:13px;margin-bottom:6px">${TODO_SLOT[x.slot]}</div>`:''}<div style="white-space:pre-wrap;line-height:1.7">${esc(x.steps||'手順なし')}</div></div>
    ${done ? `<div class="card"><b style="color:var(--pri)">済　${esc(x.by||'')}</b>${ph.length?` <small class="muted">（写真 ${ph.length}枚）</small>`:''}${x.note?`<div style="white-space:pre-wrap;margin-top:6px">${esc(x.note)}</div>`:''}${ph.length?grid(ph.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block"></a>`).join('')):''}</div>${tdAbHtml(x, true)}
    <button class="btn g" id="tdRedo">やり直す</button><div class="muted sm" style="text-align:center;margin-top:4px">その日の精算を保存するまで修正できます</div>` : `
    ${x.status === 'skip' ? `<div class="card"><b class="muted">できない　${esc(x.by||'')}</b><div style="margin-top:4px">${esc(x.reason||'')}</div></div>` : ''}
    ${tdAbNg(x) ? `<div class="card"><b>対象外</b><div class="muted sm" style="margin-top:4px">前回の在庫確認の担当（${mdW(tdAB.prev_day)}）</div></div>` : tdAbHtml(x)}
    ${x.need_note ? `<label class="f" style="display:block;margin-top:8px">${esc(x.note_hint||'内容')}<textarea id="tdN" maxlength="2000" style="${fld};min-height:120px">${esc(keep&&keep.note!=null?keep.note:(x.note||''))}</textarea></label>` : ''}
    ${x.need_photo ? `<div id="tdPs">${grid(tdShots.map((f,i)=>`<div style="position:relative"><img src="${f.url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block"><button class="xb img" data-tdx="${i}" aria-label="外す">×</button></div>`).join('') + (tdShots.length<40?`<label style="display:flex;align-items:center;justify-content:center;aspect-ratio:1;border:1px dashed var(--line);border-radius:8px;cursor:pointer;color:var(--muted)">＋撮る<input type="file" id="tdP" accept="image/*" capture="environment" style="display:none"></label>`:''))}<div class="muted sm" style="text-align:center;margin-top:4px">${tdShots.length?`写真 ${tdShots.length}枚`:'写真を撮ってください'}${tdShots.length>=40?'（40枚まで）':''}</div></div>` : ''}
    ${tdAbNg(x) ? '' : `<button class="btn" id="tdGo">${x.need_photo ? '写真を送って完了' : '完了'}</button><button class="btn g" id="tdNo" style="margin-top:8px">できない（理由を書く）</button>`}`}`; }
/* 済の TODO の［やり直す］ */
function hallTodoRedo(x){ $('tdRedo').onclick = async () => { if(!await uiConfirm('やり直しますか？\nこの TODO は「未」に戻ります。もう一度送ってください')) return;
      $('tdRedo').disabled = true; const q = await sb.rpc('hall_todo_redo', { p_token: TOKEN, p_item: x.id , ...(x.carry ? { p_day: x.day } : {}) }); if(q.error){ if($('tdRedo')) $('tdRedo').disabled = false; await uiAlert(q.error.message); return; }
      hallTodoOne({ ...x, status: 'open', photos: [], photo: null }); }; }
/* ［できない］：理由を書く画面 */
function hallTodoSkip(x, fld){
    show(`<div class="ttl">${esc(x.name)}</div><label class="f" style="display:block">できない理由<textarea id="tdR" maxlength="500" style="${fld};min-height:100px">${esc(x.reason||'')}</textarea></label><button class="btn" id="tdRGo">送る</button>`);
    setBack(() => hallTodoOne(x, {}));
    $('tdRGo').onclick = async () => { const rs = $('tdR').value.trim(); if(!rs){ await uiAlert('理由を書いてください'); return; }
      $('tdRGo').disabled = true; const q = await sb.rpc('hall_todo_skip', { p_token: TOKEN, p_item: x.id, p_reason: rs , ...(x.carry ? { p_day: x.day } : {}) }); if(q.error){ if($('tdRGo')) $('tdRGo').disabled = false; await uiAlert(q.error.message); return; } await uiAlert('送りました'); hallTodo(); };
}
/* 体験の「○○ 応募情報登録」：ヒアリングシートと写真（バストアップ）を撮る所だけ。そろうと自動で完了（オーナー「ア この形で作る」） */
function hallTrialTodo(x){ setBack(hallTodo); const T = x.trial;
  const st = n => n ? `<span class="sm" style="color:var(--ok)">撮影済 ${n}枚</span>` : '<span class="sm" style="color:var(--warn)">未撮影</span>';
  const row = (k, lab, n) => `<div class="row" style="align-items:center;gap:10px"><span style="flex:1">${lab}</span>${st(n)}<button class="btn g" data-tts="${k}" style="width:auto;flex:none;margin:0;padding:0 16px;height:36px">撮影</button></div>`;
  show(`<div class="ttl">${esc(x.name)}</div><div class="card"><div class="muted sm" style="margin-bottom:6px">期限 開店作業　対応黒服 ${esc(x.assignee || '未選択')}</div>${row('sheet', 'ヒアリングシート', T.sheet)}${row('bust', '写真（バストアップ）', T.bust)}</div>`);
  $('main').querySelectorAll('[data-tts]').forEach(b => b.onclick = () => { const k = b.dataset.tts;
    apPick(k, f => apSendPhoto(k, f, d => sb.rpc('hall_trial_photo_add', { p_token: TOKEN, p_staff: T.staff_id, p_kind: k, p_data: d }), async () => { toast('保存しました');
      const r = await sb.rpc('hall_todos', { p_token: TOKEN }); const y = !r.error && (r.data.items || []).find(z => z.id === x.id); if(y && y.trial && y.status !== 'done') hallTrialTodo(y); else hallTodo(); })); }); }
function hallTodoOne(x, keep){
  if(x.trial){ hallTrialTodo(x); return; }
  setBack(hallTodo); if(!keep){ tdShots = []; tdAbVals = {}; tdDiff = null; tdWhy = {}; }
  const fld = 'width:100%;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card);color:var(--ink);box-sizing:border-box';
  const done = x.status === 'done', ph = (x.photos && x.photos.length) ? x.photos : (x.photo ? [x.photo] : []);
  const grid = L => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px">${L}</div>`;
  show(hallTodoHtml(x, keep, done, ph, grid, fld));
  if(done){ hallTodoRedo(x); return; }
  const redraw = () => hallTodoOne(x, { note: $('tdN') ? $('tdN').value : null });
  const abP = tdAB && tdAB.item === x.id ? tdAB.products || [] : [];
  tdAbWire(); tdAddWire(x);
  if($('tdP')) $('tdP').onchange = () => { const f = $('tdP').files[0]; if(!f) return; tdShots.push({ file: f, url: URL.createObjectURL(f) }); redraw(); };
  $('main').querySelectorAll('[data-tdx]').forEach(b => b.onclick = () => { const k = +b.dataset.tdx; URL.revokeObjectURL(tdShots[k].url); tdShots.splice(k, 1); redraw(); });
  if(!$('tdGo')) return;   /* 在庫確認の対象外（前回の担当）は［完了］が無い */
  $('tdGo').onclick = async () => {
    const note = $('tdN') ? $('tdN').value.trim() : null;
    if(x.need_note && !note){ await uiAlert(`${x.note_hint||'内容'}を書いてください`); return; }
    if(abP.some(p => !tdAbOk(tdAbVals[p.id]))){ await uiAlert('未入力の品があります'); return; }
    if(x.need_photo && !tdShots.length){ await uiAlert('写真を撮ってください'); return; }
    $('tdGo').disabled = true;
    try{
      if(abP.length && !await tdStockCheck(x, abP)) return;
      if(x.need_photo){ const p = await sb.rpc('hall_todo_photos', { p_token: TOKEN, p_item: x.id, p_count: tdShots.length , ...(x.carry ? { p_day: x.day } : {}) }); if(p.error) throw p.error;
        const n = tdShots.length; $('tdGo').textContent = `送っています（0/${n}）`; /* 3枚ずつ同時に送る。数は送り終わった枚数 */
        await todoPhotosUp(p.data, tdShots.map(s => s.file), k => { $('tdGo').textContent = `送っています（${k}/${n}）`; }); }
      const q = await sb.rpc('hall_todo_done', { p_token: TOKEN, p_item: x.id, p_note: note , ...(x.carry ? { p_day: x.day } : {}) }); if(q.error) throw q.error;
      tdShots.forEach(f => URL.revokeObjectURL(f.url)); tdShots = []; tdAbVals = {}; tdDiff = null; tdWhy = {};
      await uiAlert('完了しました'); hallTodo();
    }catch(e){ if($('tdGo')) $('tdGo').disabled = false; if($('tdGo')) $('tdGo').textContent = x.need_photo ? '写真を送って完了' : '完了'; await uiAlert(e.message || String(e)); }
  };
  $('tdNo').onclick = () => hallTodoSkip(x, fld);
}
async function hallCasts(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('hall_casts', { p_token: TOKEN }); if(r.error){ fail(r.error.message); return; }
  const C = r.data.casts || [];
  // 10人まで並ぶので、1人2行（1行目：名前・当日欠勤／2行目：成績・未提出）
  show(`<div class="ttl">担当キャスト ${C.length}人</div>${C.length ? `<div class="card" style="padding:4px 12px">${C.map((c, i) => { const st = c.stats || {};
    const att = c.absent ? `<b class="err">当日欠勤</b>` : '';   // 出退勤の時刻は閉店作業で確かめる（オーナー）
    const todo = [c.sales_left ? APR_HK : '', c.docs ? esc(c.docs) : '', c.dress ? `ドレス ${mdDay(c.dress)}まで` : ''].filter(Boolean);
    return `<div style="padding:8px 0;${i?'border-top:1px solid var(--line)':''}"><div class="row" style="padding:0"><b>${esc(c.name)}</b><span class="sm">${att}</span></div>
      <div class="sm muted" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>${esc(KL)}小計 ${Math.round(N(st.sales)/10000).toLocaleString('ja-JP')}万・同伴${N(st.douhan)}・反応◎${N(st.reactions)}</span>${todo.length?`<span class="err">未提出：${todo.join('・')}</span>`:''}</div>
      ${c.absent?`<div class="sm err">${hmJst(c.absent.at)}・${esc(c.absent.reason||'')}</div>`:''}</div>`; }).join('')}</div>` : '<div class="card c muted">担当キャストがいません</div>'}`);
}
let hcOpen = new Set();
/* 天気はアイコン（Meteocons・MIT）＋小さい言葉（オーナー「“晴”はパッとみでわからん」「絵文字やめて、ちゃんと探して」→ ア）。20時〜翌1時なので夜のアイコン */
const WXN=c=>WXT(c)[0];
/* 売上予測（目標・現在・予測。昨日まで。POS の朝礼と同じ。 オーナー・見本 作業場/売上予測_案7.png） */
function hcFc(F){ const no = '<span class="muted">—</span>', g = n => n==null ? no : `${n}組`, y = n => n==null ? no : yen(n);
  const th = 'color:var(--muted);font-weight:700;font-size:12px;text-align:right;padding:4px 0 4px 6px;border-top:1px solid var(--line)', td = 'padding:4px 0 4px 6px;border-top:1px solid var(--line);font-weight:700;text-align:right;white-space:nowrap', tl = 'padding:4px 0;border-top:1px solid var(--line);font-weight:700';
  return `<div class="gh" style="margin-top:8px">${F.month}月（${mdDay(F.from)}〜${mdDay(F.to)}）　営業日数 ${F.done} / ${F.days}日</div>
    <table style="border-collapse:collapse;width:100%;font-size:14px"><tr><th style="${th}"></th><th style="${th}">目標</th><th style="${th}">現在</th><th style="${th}">予測</th></tr>
    <tr><td style="${tl}">売上</td><td style="${td}">${y(F.target)}</td><td style="${td}">${yen(F.sales)}</td><td style="${td}">${y(F.fc_sales)}</td></tr>
    <tr><td style="${tl}">組数</td><td style="${td}">${g(F.tgt_groups)}</td><td style="${td}">${F.groups}組</td><td style="${td}">${g(F.fc_groups)}</td></tr></table>
    <div class="row" style="font-size:14px"><span class="muted">1日平均売上</span><b>${y(F.avg)}</b></div><div class="row" style="font-size:14px"><span class="muted">1日必要組数</span><b>${g(F.need)}</b></div><div class="row" style="font-size:14px"><span class="muted">平均客単価</span><b>${y(F.unit)}</b></div>`; }
/* 朝礼のデータと天気は覚えておき、お客様を開く・閉じる時は読み直さない（前は押すたびに hall_chorei と天気を読み直していた）。読み直すのは開いた時と「確認」「確認の取消」の後（天気はそのまま） */
let hcD = null, hcWx = null;
/* 本日の体験：対応黒服を選ぶとすぐ保存（オーナー「担当黒服ではなく対応黒服」。選ぶまでは赤字で出し続ける） */
let hcT = null;
function hcTrialHtml(){ const T = hcT && hcT.trials || []; if(!T.length) return '';
  const opt = (x) => `<option value="">対応黒服 未選択</option>${(hcT.halls || []).map(h => `<option value="${h.id}" ${h.id === x.host ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}`;
  return `<div class="card"><div class="gh">本日の体験 ${T.length}人</div>${T.map(x => `<div class="row" style="justify-content:flex-start;gap:10px;align-items:center"><b>${esc(x.time || '')}</b><span style="flex:1">${esc(x.name)}${x.noap ? ' <span class="err sm">応募情報なし</span>' : ''}</span><select data-th="${x.id}" style="width:auto;font:inherit;font-size:15px;padding:4px 6px;border:1px solid var(--line);border-radius:8px;background:#fff;color:${x.host ? 'var(--ink)' : 'var(--warn)'}">${opt(x)}</select></div>`).join('')}</div>`; }
function hcTrialBind(){ $('main').querySelectorAll('[data-th]').forEach(x => x.onchange = async () => { x.disabled = true;
  const r = await sb.rpc('hall_trial_host_set', { p_token: TOKEN, p_staff: x.dataset.th, p_hall: x.value || null }); x.disabled = false;
  if(r.error){ await uiAlert(r.error.message); hallChorei(true); return; } const t = hcT.trials.find(z => z.id === x.dataset.th); if(t) t.host = x.value || null; x.style.color = x.value ? 'var(--ink)' : 'var(--warn)'; toast('保存しました'); }); }
/* 付け回し担当（SQL 701・延長の確認の LINE を受ける黒服）：自動延長しない店（広島）だけ・必須。POS の朝礼と同じ形（選ぶとすぐ保存・選ぶまで赤字） */
let hcK = null;
function hcTsukeHtml(){ if(!hcK || !hcK.required) return ''; const v = hcK.staff_id || '';
  return `<div class="card"><div class="row" style="align-items:center;padding:0"><span class="gh" style="margin:0;flex:1">付け回し担当</span><select data-tk style="width:auto;font:inherit;font-size:15px;padding:4px 6px;border:1px solid var(--line);border-radius:8px;background:#fff;color:${v ? 'var(--ink)' : 'var(--warn)'}"><option value="">未選択</option>${(hcK.halls || []).map(h => `<option value="${h.id}" ${h.id === v ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></div></div>`; }
function hcTsukeBind(){ $('main').querySelectorAll('[data-tk]').forEach(x => x.onchange = async () => { x.disabled = true;
  const r = await sb.rpc('hall_tsuke_staff_set', { p_token: TOKEN, p_staff: x.value || null }); x.disabled = false;
  if(r.error){ await uiAlert(r.error.message); hallChorei(true); return; } hcK.staff_id = x.value || null; x.style.color = x.value ? 'var(--ink)' : 'var(--warn)'; toast('保存しました'); }); }
async function hallChorei(keepWx){
  setBack(home); if(!$('hcBox')) show('<div class="card c muted">読み込み中…</div>');
  const [r, t, k] = await Promise.all([sb.rpc('hall_chorei', { p_token: TOKEN }), sb.rpc('hall_chorei_trials', { p_token: TOKEN }), sb.rpc('hall_tsuke_staff', { p_token: TOKEN })]); if(r.error){ fail(r.error.message); return; }
  hcT = t.error ? null : t.data; hcK = k.error ? null : k.data;
  hcD = r.data; if(keepWx !== true) hcWx = null; hcPaint(); /* トップのボタンからは event が来るので true の時だけ */
  if(!hcWx) await hcWeather(hcD);
}
function hcPaint(){
  const C = hcD, G = C.guests || [], left = G.filter(g => g.customer && !g.ok_at).length;
  const tag = '<span style="display:inline-block;background:var(--pri);color:#fff;border-radius:4px;padding:0 5px;font-size:12px;font-weight:700">同伴</span> ';
  const V = { C, G, left, tag }; V.guest = g => hcGuest(V, g);
  const SH = {}; (C.shifts||[]).forEach(x => { (SH[x.time] = SH[x.time] || []).push(esc(x.name) + (x.black?DRESS:'') + (x.douhan?'（同伴）':'')); }); /* 黒ドレスのしるし */
  const y = new Date(C.date+'T00:00:00+09:00'); y.setDate(y.getDate()-1);
  V.SH = SH; V.y = y; show(hcHtml(V)); hcBind(V); }
/* 来店予定のお客様の1組（開くと誕生日・ボトル・前回・タバコ・メモ） */
function hcGuest(V, g){ const { C, G, left, tag, guest, SH, y } = V; const cu = g.customer, op = hcOpen.has(g.id) && cu;
    const st = !cu ? '<small class="muted">はじめて</small>' : g.ok_at ? `<small class="muted">確認済 ${hmJst(g.ok_at)}${g.ok_by?'・'+esc(g.ok_by):''}</small>` : '<small class="err" style="font-weight:700">未確認</small>';
    let h = `<div ${cu?`data-hc="${g.id}"`:''} style="padding:10px 0;border-top:1px solid var(--line);${cu?'cursor:pointer':''}"><div class="row" style="padding:0"><b>${g.time}　${g.douhan?tag:''}${g.vip?tag.replace('同伴',esc(g.vip)):''}${esc(g.names||g.name)} 様 ${g.guests}名</b>${st}</div><div class="row" style="padding:0;align-items:center"><span class="muted sm">${resvWho(g,{noKK:(ME&&ME.customer_mode)==='yukyaku',mark:DRESS})}</span><select data-hs="${g.id}" style="height:36px;width:auto;border:1px solid var(--line);border-radius:8px;padding:0 4px 0 8px;font:inherit;font-size:15px;background:var(--card);color:var(--ink)"><option value="">卓</option>${(C.tables||[]).map(t=>`<option value="${t.id}"${t.id===g.seat?' selected':''}>${esc(t.name)}</option>`).join('')}</select></div></div>`; /* 広島は担当を出さない（オーナー）。卓（POS の朝礼と同じ。選ぶとすぐ保存） */
    if(!op) return h;
    const bd = cu.birthday ? `${esc(cu.birthday)}${cu.bday_in===0?'（本日）':cu.bday_in!=null&&cu.bday_in<=7?`（あと${cu.bday_in}日）`:''}` : '—';
    return h + `<div style="padding:0 0 10px"><div class="row"><span class="muted">誕生日</span><span>${bd}</span></div><div class="row"><span class="muted">反応◎</span><span>${esc(cu.good||'—')}</span></div>
      <div class="row"><span class="muted">ボトル</span><span style="text-align:right">${(cu.bottles||[]).map(b=>`${esc(b.name)}（${b.remaining}/10${b.share?'・共同 '+esc(b.share)+' 様':''}）`).join('、')||'—'}</span></div>
      <div class="row"><span class="muted">前回の来店</span><span>${cu.last?`${mdW(cu.last.date)} ${cu.last.guests}名`:'—'}</span></div>
      <div class="row"><span class="muted">タバコ</span><span style="text-align:right;white-space:pre-line">${esc(cu.tobacco||'—')}</span></div><div class="row"><span class="muted">配車</span><span style="text-align:right;white-space:pre-line">${esc(cu.haisha||'—')}</span></div>
      <div style="background:var(--gold-soft);border-radius:8px;padding:8px 10px;margin-top:6px;white-space:pre-wrap;line-height:1.7">${esc(cu.memo||'メモなし')}</div>
      ${g.ok_at?`<button class="btn g" data-hu="${g.id}" style="margin-top:8px">確認の取消</button>`:`<button class="btn" data-hk="${g.id}" style="margin-top:8px">確認</button>`}</div>`;
}
/* キャスト・黒服の遅刻連絡・無断遅刻・欠勤（SQL 661 の notes）。本日の出勤の箱の一番下に、うすい小さな字で1人1行（POS の朝礼と同じ）。黒服の行だけ左に「黒服」。「黒服」は時刻（00:00）と同じ幅の枠に重ねて、2列目の始まりをそろえる */
function hcHallLate(C){ return (C.notes || (C.hall_late||[]).map(x => ({ ...x, who: '黒服' }))).map(x => `<div class="row" style="justify-content:flex-start"><b style="position:relative"><span style="visibility:hidden">00:00</span><span class="muted" style="position:absolute;left:0;bottom:1px;font-weight:400;font-size:14px">${x.who === '黒服' ? '黒服' : ''}</span></b><span ${x.kind === '欠勤' ? 'style="color:var(--warn);font-weight:700;' : 'class="muted" style="font-size:14px;'}flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.kind)}　${esc(x.name)} ${esc(x.time||'')}${x.reason ? '　' + esc(x.reason) : ''}</span></div>`).join(''); }
/* 朝礼の画面（お客様・天気・出勤・売上・お誕生日） */
function hcHtml(V){ const { C, G, left, tag, guest, SH, y } = V; return `<div id="hcBox"><div class="ttl">朝礼　${mdW(C.date)}${C.event?' <small class="muted">イベント日</small>':''}</div>
    <div class="card"><div class="gh">本日来店予定のお客様 ${G.length}組${left?`　<span class="err">未確認 ${left}組</span>`:''}</div>${G.map(guest).join('')||'<div class="muted sm">なし</div>'}${G.length?'<div class="muted sm" style="margin-top:6px">未確認をタップで顧客メモを確認してください。</div>':''}</div>
    <div class="card"><div class="gh">天気</div><div id="hcWx" class="${hcWx ? hcWx.c : 'muted sm'}">${hcWx ? hcWx.h : '読み込み中…'}</div></div>
    <div class="card"><div class="gh">本日の出勤 ${(C.shifts||[]).length}人</div>${Object.keys(SH).sort().map(t => `<div class="row" style="justify-content:flex-start"><b>${t}</b><span>${SH[t].join('・')}</span></div>`).join('')||'<div class="muted sm">シフトなし</div>'}${hcHallLate(C)}</div>
    ${hcTsukeHtml()}${hcTrialHtml()}
    <div class="card"><div class="gh">売上</div><div class="row"><span>昨日 ${mdWD(y)}</span><b>${yen(C.sales_y)}</b></div>${C.fc?hcFc(C.fc):C.sales_m==null?'':`<div class="row"><span>今月（〜${y.getMonth()+1}/${y.getDate()}）</span><b>${yen(C.sales_m)}</b></div>`}</div>
    <div class="card"><div class="gh">お誕生日（前後1週間）</div>${(C.bdays||[]).map(b => { const cu = (b.kind_label||'お客様') === 'お客様', past = b.in < 0; /* 前後1週間（キャストのトップと同じ） */ return `<div class="row"${past?' style="color:var(--muted)"':''}><span><b class="${b.in===0?'err':''}">${b.in===0?'本日':past?(-b.in)+'日前':'あと'+b.in+'日'}</b>　${esc(b.name)}${cu?' 様':''}</span><small class="muted">${cu?(b.kakari?esc(KL)+' '+esc(b.kakari):''):esc(b.kind_label)}</small></div>`; }).join('')||'<div class="muted sm">なし</div>'}</div></div>`; }
/* 押した時の動き：お客様を開く・卓・確認 */
function hcBind(V){ const { C, G, left, tag, guest, SH, y } = V; hcTrialBind(); hcTsukeBind();
  $('main').querySelectorAll('[data-hc]').forEach(e => e.onclick = () => { const k = e.dataset.hc; hcOpen.has(k) ? hcOpen.delete(k) : hcOpen.add(k); const y0 = window.scrollY; hcPaint(); window.scrollTo(0, y0); }); /* 読み直さない */
  $('main').querySelectorAll('[data-hs]').forEach(x => { x.onclick = e => e.stopPropagation(); x.onchange = async () => { const id = x.dataset.hs, g = G.find(g => String(g.id) === id), was = g?.seat || ''; x.disabled = true;
    const q = await sb.rpc('hall_resv_seat', { p_token: TOKEN, p_id: id, p_table: x.value || null }); x.disabled = false; if(q.error){ x.value = was; await uiAlert(q.error.message); return; } if(g) g.seat = x.value || null; }; });
  $('main').querySelectorAll('[data-hk],[data-hu]').forEach(b => b.onclick = async () => { const ok = !!b.dataset.hk, id = b.dataset.hk || b.dataset.hu; b.disabled = true;
    const q = await sb.rpc('hall_chorei_ok', { p_token: TOKEN, p_resv: id, p_ok: ok }); if(q.error){ b.disabled = false; await uiAlert(q.error.message); return; } if(ok) hcOpen.delete(id); const y0 = window.scrollY; await hallChorei(true); window.scrollTo(0, y0); });
}
// 天気（20時〜翌1時・降水確率50%以上で傘の準備）。できた中身は hcWx に覚えておく
async function hcWeather(C){
  if(C.lat != null) try{ const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${C.lat}&longitude=${C.lon}&hourly=weather_code,precipitation_probability,temperature_2m&timezone=Asia%2FTokyo&forecast_days=3`)).json(), H = j.hourly;
    const nx = dayAdd(C.date, 1);
    const W = [[C.date,20],[C.date,21],[C.date,22],[C.date,23],[nx,0],[nx,1]].map(([d,h]) => { const i = H.time.indexOf(`${d}T${String(h).padStart(2,'0')}:00`); return { h: h===0?24:h, c: H.weather_code[i], p: H.precipitation_probability[i], t: H.temperature_2m[i] }; });
    const rain = W.find(x => (x.p??0) >= 50);
    hcWx = { c: '', h: `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;text-align:center;font-size:12px">${W.map(x => `<div style="border:1px solid var(--line);border-radius:6px;padding:4px 0;line-height:1.4;${(x.p??0)>=50?'background:var(--warn-soft)':''}"><div class="muted">${x.h}時</div>${WXI(x.c,34)}<div style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${WXN(x.c)}</div><div class="${(x.p??0)>=50?'err':''}">${x.p??'—'}%</div><div class="muted">${x.t==null?'—':Math.round(x.t)+'℃'}</div></div>`).join('')}</div>${rain?`<div class="err" style="font-weight:700;background:var(--warn-soft);border-radius:6px;padding:6px 8px;margin-top:6px">傘の準備（${rain.h}時から雨）</div>`:''}` };
  }catch(e){ hcWx = { c: 'muted sm', h: '天気を読み込めません' }; }
  const el = $('hcWx'); if(el && hcWx){ el.className = hcWx.c; el.innerHTML = hcWx.h; }
}
