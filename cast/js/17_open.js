// 開店作業（オーナー「毎日同じ作業の開店作業と、TODO とを一緒にしないで」「1タスクごとに完了ボタン、その人がやったことを記録」）
// 閉店作業も同じ画面（オーナー「閉店作業も黒服のマイページに」「保存した人がやったことに」「誰が作業中かの表示」）
// 項目の中の確認（checks。名刺の Eight 登録＝登録済みの確認・変更の確認）。全部に印を付けると「完了」を押せる（オーナー「登録済みか確認のチェックボタンを中に」）
// コメントが「要る」の項目は、作業中にコメントの欄（書くのは任意。オーナー「相違があれば、コメントで報告」）。完了の後はコメントをほかの黒服にも出す
// 決まった画面の項目（ボトル残量など）も、写真「要る」なら写真を撮って保存・コメント「要る」ならコメントの欄（オーナー「全部編集できるようにして」）
// 開始 → 作業中（ほかの黒服の画面にも出る）→ 完了（写真の項目は写真を撮って完了・決まった画面の項目は保存）。ほかの人が作業中の時は「交代」。対象が「限定」の項目は、限定項目「可」の黒服だけ
let opShots = {}, opChecks = {}, opNotes = {}, opSwitch = false; /* リッチメニューの「開店・閉店作業」から開いた時だけ、上に開店作業・閉店作業の切り替え */
const TASK_TTL = { open:'開店作業', close:'閉店作業' };
const tBtn = (k, i, t, g) => `<button class="btn${g ? ' g' : ''}" data-${k}="${i}" style="display:inline-block;width:auto;flex:none;padding:7px 14px;font-size:14px">${t}</button>`;
const wipTag = n => `<b style="background:var(--gold-soft);color:var(--ink);border-radius:6px;padding:2px 7px;font-size:13px;white-space:nowrap">${esc(n || '')} 作業中</b>`; // 「名前 時刻 完了」「名前 作業中」の順（POS と同じ。完了・作業中の位置をそろえる。オーナー）
const ckAll = x => (x.checks || []).every((c, j) => (opChecks[x.id] || []).includes(j));
const opWip = x => `作業中（あなた）${x.need_photo ? `　写真${opShots[x.id] ? `${opShots[x.id].length}枚` : ''}` : ''}`;
// 撮った写真を TODO と同じく3列で並べ、右上の［×］で1枚ずつ外す（オーナー）
const opUrls = new Map(), opUrl = f => { if(!opUrls.has(f)) opUrls.set(f, URL.createObjectURL(f)); return opUrls.get(f); };
const opGrid = (x, key) => (opShots[x.id] || []).length ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px">${opShots[x.id].map((f, k) => `<div style="position:relative"><img src="${opUrl(f)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block"><button class="xb img" data-opx="${key}:${k}" aria-label="外す">×</button></div>`).join('')}</div>` : '';
const opDrop = (x, k) => { const f = (opShots[x.id] || [])[k]; if(!f) return; if(opUrls.has(f)){ URL.revokeObjectURL(opUrls.get(f)); opUrls.delete(f); } opShots[x.id].splice(k, 1); if(!opShots[x.id].length) delete opShots[x.id]; };
async function hallTasks(ph){
  setBack(hallHome); show('<div class="muted" style="padding:20px">読み込み中…</div>');
  const [r, tq] = await Promise.all([sb.rpc('hall_tasks', { p_token: TOKEN, p_phase: ph }), ph === 'close' ? sb.rpc('hall_todos', { p_token: TOKEN }) : null]); if(r.error){ show(`<div class="card">${esc(r.error.message)}</div>`); return; }
  const D = r.data, L = D.items || [], d = new Date(D.day + 'T00:00:00+09:00');
  const nil = x => x.kind === 'todo' && !x.todo_open && tq && !tq.error && !(tq.data.items || []).length; /* TODO が1件も無い日（休みの日など）は「完了」ではなく「なし」と出す（終わらせた人がいないのに完了に見えるため） */
  const nd = L.filter(x => x.status === 'done' && !nil(x)).length, nAll = L.filter(x => !nil(x)).length;
  const sw = opSwitch ? `<div style="display:flex;gap:8px;margin-bottom:10px">${['open', 'close'].map(k => `<button class="btn${k === ph ? '' : ' g'}" data-opsw="${k}" style="flex:1">${TASK_TTL[k]}</button>`).join('')}</div>` : '';
  const swWire = () => $('main').querySelectorAll('[data-opsw]').forEach(b => b.onclick = () => { if(b.dataset.opsw !== ph) hallTasks(b.dataset.opsw); });
  if(!D.on){ show(`${sw}<div class="ttl">${TASK_TTL[ph]}</div><div class="card muted">閉店作業は POS で行います</div>`); swWire(); return; }
  const row = (x, i) => htRow({ D, nil }, x, i);
  show(`${sw}<div class="ttl">${TASK_TTL[ph]}　${mdWD(d)}</div><div id="opAhead"></div>
    <div class="card"><div class="muted sm" style="margin-bottom:4px">完了 ${nd}／${nAll}。開始・完了は、ほかの黒服の画面にも出ます</div>${L.map(row).join('') || `<div class="muted">${TASK_TTL[ph]}の項目がありません（管理サイトの「${TASK_TTL[ph]}」で追加します）</div>`}</div>`);
  swWire();
  if(ph === 'close') sb.rpc('hall_todo_ahead', { p_token: TOKEN }).then(q => { const el = $('opAhead'); if(el && !q.error) el.innerHTML = aheadHtml(q.data); }); /* 連休前の日の閉店作業に、連休明けの休日分を知らせる（オーナー） */
  const again = () => hallTasks(ph), at = b => L[+b.dataset[Object.keys(b.dataset)[0]]];
  const K = { ph, r, tq, D, L, d, nil, nd, nAll, sw, swWire, again, at }; htBindA(K); htBindB(K); }
/* 作業の1行（右の欄：なし・完了・未完了・対象外・交代・開始・写真と完了・表示） */
function htRow(K, x, i){ const { D, nil } = K; const mine = x.wip_id === D.me, other = x.wip_id && !mine, simple = x.kind === 'simple', na = x.limited && !D.limited_ok;
    let right;
    if(nil(x)) right = '<span class="muted sm">なし</span>';
    else if(x.status === 'done') right = x.kind === 'todo' ? '<b style="color:var(--ok);font-size:13px">完了</b>'
      : `<b style="color:var(--ok);font-size:13px;white-space:nowrap">${esc(x.by || '')} ${x.at ? hmJst(x.at) : ''} 完了</b>${simple && x.staff_id === D.me ? tBtn('opu', i, '取消', true) : ''}`;
    else if(x.kind === 'shift_none' && !x.sn_open && x.leave_wait) right = `<b style="color:var(--warn);font-size:13px;white-space:nowrap">退店処理待ち ${x.leave_wait}</b>`; /* 退店を選んだ子の退店処理（POS）が終わると自動で完了 */
    else if(x.kind === 'todo') right = `<b style="color:var(--warn);font-size:13px">未完了 ${x.todo_open}</b>${tBtn('optd', i, '表示', true)}`;
    else if(na) right = `${x.wip_by ? wipTag(x.wip_by) : ''}<span class="muted sm">対象外</span>`;
    else if(other) right = `${wipTag(x.wip_by)}${tBtn('opt', i, '交代', true)}`;
    else if(!mine) right = tBtn('ops', i, '開始');
    else if(simple) right = `${x.need_photo ? `<label class="btn g" data-opl="${i}" style="display:${(opShots[x.id] || []).length < 10 ? 'inline-block' : 'none'};width:auto;flex:none;padding:7px 12px;font-size:14px;margin:0">写真<input type="file" accept="image/*" capture="environment" data-opp="${i}" style="display:none"></label>` : ''}${tBtn('opd', i, '完了').replace('<button', ckAll(x) ? '<button' : '<button disabled')}`;
    else right = `${wipTag(x.wip_by)}${tBtn('opv', i, '表示')}`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:11px 2px;border-top:1px solid var(--line)">
    <div style="flex:1;line-height:1.4">${esc(x.name)}${x.status === 'done' && x.detail && x.detail.comment ? `<div class="sm" style="white-space:pre-wrap;margin-top:2px">コメント：${esc(x.detail.comment)}</div>` : ''}${mine && simple && x.status !== 'done' ? `<div class="muted sm" data-opn="${i}">${opWip(x)}</div>${(x.checks || []).map((c, j) => `<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:15px"><input type="checkbox" data-opc="${i}:${j}"${(opChecks[x.id] || []).includes(j) ? ' checked' : ''} style="width:22px;height:22px;flex:none;margin:0;accent-color:var(--pri)">${esc(c)}</label>`).join('')}<div data-opg="${i}">${opGrid(x, i)}</div>${x.need_comment ? `<textarea data-opk="${i}" rows="3" maxlength="500" placeholder="コメント（なければ空のまま）" style="display:block;width:100%;margin-top:8px;font:inherit;font-size:15px;padding:8px;border:1px solid var(--line);border-radius:8px">${esc(opNotes[x.id] || '')}</textarea>` : ''}` : ''}</div>${right}</div>`;
}
/* 押した時の動き：チェック・書く欄・開始・交代・表示・TODO */
function htBindA(K){ const { ph, r, tq, D, L, d, nil, nd, nAll, sw, swWire, again, at } = K;
  $('main').querySelectorAll('[data-opc]').forEach(c => c.onchange = () => { const [i, j] = c.dataset.opc.split(':').map(Number), x = L[i], a = new Set(opChecks[x.id] || []);
    c.checked ? a.add(j) : a.delete(j); opChecks[x.id] = [...a]; const d = $('main').querySelector(`[data-opd="${i}"]`); if(d) d.disabled = !ckAll(x); });
  $('main').querySelectorAll('[data-opk]').forEach(t => t.oninput = () => { opNotes[L[+t.dataset.opk].id] = t.value; });
  const start = async (x, take) => { const q = await sb.rpc('hall_task_start', { p_token: TOKEN, p_task: x.id, p_take: !!take }); if(q.error){ await uiAlert(q.error.message); again(); return false; } return true; };
  $('main').querySelectorAll('[data-ops]').forEach(b => b.onclick = async () => { const x = at(b); b.disabled = true; if(!await start(x)) return; if(x.kind === 'simple') again(); else hallCloseTask(x, ph); });
  $('main').querySelectorAll('[data-opt]').forEach(b => b.onclick = async () => { const x = at(b); if(!await uiConfirm(`${x.wip_by}さんが作業中です。\n交代しますか？`, '交代')) return; if(!await start(x, true)) return; if(x.kind === 'simple') again(); else hallCloseTask(x, ph); });
  $('main').querySelectorAll('[data-opv]').forEach(b => b.onclick = () => hallCloseTask(at(b), ph));
  $('main').querySelectorAll('[data-optd]').forEach(b => b.onclick = hallTodo);
}
/* 押した時の動き：写真・完了・取消 */
function htBindB(K){ const { ph, r, tq, D, L, d, nil, nd, nAll, sw, swWire, again, at } = K;
  const opRow = i => { const x = L[+i], q = a => $('main').querySelector(`[${a}="${i}"]`), n = (opShots[x.id] || []).length; /* その行だけ直す（前は全部読み直していた）・写真の並びと［×］も */
    if(!q('data-opn') || !q('data-opg')) return again(); q('data-opn').textContent = opWip(x); q('data-opg').innerHTML = opGrid(x, i); if(q('data-opl')) q('data-opl').style.display = n < 10 ? 'inline-block' : 'none';
    q('data-opg').querySelectorAll('[data-opx]').forEach(b => b.onclick = () => { opDrop(x, +b.dataset.opx.split(':')[1]); opRow(i); }); };
  $('main').querySelectorAll('[data-opg]').forEach(g => opRow(g.dataset.opg));
  $('main').querySelectorAll('[data-opp]').forEach(inp => inp.onchange = () => { const x = at(inp); const f = inp.files[0]; inp.value = ''; if(!f) return; opShots[x.id] = [...(opShots[x.id] || []), f].slice(0, 10); opRow(inp.dataset.opp); }); /* カメラで1枚ずつ撮って足す（10枚まで） */
  $('main').querySelectorAll('[data-opd]').forEach(b => b.onclick = async () => { const x = at(b); if(!ckAll(x)) return; b.disabled = true;
    try{
      if(x.need_photo){ const f = opShots[x.id] || []; if(!f.length){ await uiAlert('写真を撮ってください'); b.disabled = false; return; }
        const p = await sb.rpc('hall_open_photos', { p_token: TOKEN, p_task: x.id, p_count: f.length }); if(p.error) throw p.error;
        await todoPhotosUp(p.data, f); } /* 3枚ずつ同時に送る */
      const q = await sb.rpc('hall_open_done', { p_token: TOKEN, p_task: x.id, ...(x.need_comment ? { p_comment: opNotes[x.id] || '' } : {}) }); if(q.error) throw q.error;
      delete opShots[x.id]; delete opChecks[x.id]; delete opNotes[x.id]; again();
    }catch(e){ b.disabled = false; await uiAlert(e.message || String(e)); again(); } });
  $('main').querySelectorAll('[data-opu]').forEach(b => b.onclick = async () => { const x = at(b); if(!await uiConfirm(`「${x.name}」の完了を取り消しますか？`, '取消')) return;
    const q = await sb.rpc('hall_open_undo', { p_token: TOKEN, p_task: x.id }); if(q.error){ await uiAlert(q.error.message); return; } again(); });
}

const shRows = {};   // 仕入れの入力中の行（追加・× で描き直しても残す）
const drOut = {};   // 発注一覧の入力中の本数（初めの値は本日の販売数）
// 品の選択肢（POS のメニューのカテゴリーごと・最後に品名入力）。仕入れと返品で同じ
const prodOpts = (P, r) => `<option value="">選択</option>${[...new Set(P.map(p => p.cat))].map(c => `<optgroup label="${esc(c)}">${P.filter(p => p.cat === c).map(p => `<option value="${p.id}" ${!r.free && r.pid === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}<option value="free" ${r.free ? 'selected' : ''}>品名入力</option>`;
const rtRows = {};   // 返品の入力中の行（納品物と今日出たお酒・ドリンクで同じ日の返品を1つの記録として見せる）
// 返品のカード（仕入れと同じ形：品は POS のメニューから選ぶ・メニューに無い品は品名入力。オーナー見本 作業場/見本の画像/返品の行（11-18）/）
const rtInit = (x, r) => { const T = r.data.returns || {}; if(!rtRows[x.id]) rtRows[x.id] = (T.rows || []).map(a => ({ pid: a.product_id || '', name: a.product_id ? '' : (a.name || ''), qty: String(a.qty), free: !a.product_id })); return rtRows[x.id]; };
const rtCard = (x, r) => { if(!r.data.returns) return ''; const R = rtInit(x, r), P = r.data.returns.products || [], fs = 'font:inherit;font-size:16px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;box-sizing:border-box';
  const opts = a => prodOpts(P, a);
  return `<div class="card"><div style="display:flex;align-items:center;margin-bottom:2px"><b style="flex:1">返品</b><button class="btn g" id="rtAdd" style="display:inline-block;width:auto;padding:6px 12px;font-size:14px">追加</button></div>
    ${R.map((a, i) => `<div style="padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="display:flex;align-items:center;gap:8px"><select data-rtp="${i}" style="flex:1;min-width:0;${fs}">${opts(a)}</select>
      <input data-rtq="${i}" inputmode="numeric" maxlength="3" value="${esc(a.qty)}" style="width:64px;text-align:right;${fs}"><span class="muted sm">本</span><button class="xb" data-rtx="${i}" aria-label="削除">×</button></div>
      <input data-rtn="${i}" maxlength="60" placeholder="品名" value="${esc(a.name)}" style="display:${a.free ? 'block' : 'none'};width:100%;margin-top:6px;${fs}"></div>`).join('') || '<div class="muted" style="padding:9px 2px">返品なし</div>'}</div>`; };
const rtData = x => rtRows[x.id] ? { returns: rtRows[x.id].filter(a => a.pid || a.name.trim() || a.qty !== '').map(a => a.free ? { name: a.name.trim(), qty: a.qty } : { product_id: a.pid, qty: a.qty }) } : {};   // 何も入れていない行は送らない
const rtWire = (x, again) => { const R = rtRows[x.id]; if(!R || !$('rtAdd')) return;
  $('rtAdd').onclick = () => { R.push({ pid: '', name: '', qty: '', free: false }); again(); };
  $('main').querySelectorAll('[data-rtx]').forEach(b => b.onclick = () => { R.splice(+b.dataset.rtx, 1); again(); });
  $('main').querySelectorAll('[data-rtp]').forEach(b => b.onchange = () => { const a = R[+b.dataset.rtp]; a.free = b.value === 'free'; a.pid = a.free ? '' : b.value; $('main').querySelector(`[data-rtn="${b.dataset.rtp}"]`).style.display = a.free ? 'block' : 'none'; });
  $('main').querySelectorAll('[data-rtq]').forEach(b => b.oninput = () => { R[+b.dataset.rtq].qty = b.value.trim(); });
  $('main').querySelectorAll('[data-rtn]').forEach(b => b.oninput = () => { R[+b.dataset.rtn].name = b.value; }); };
const shClr = {};   // 差の内訳（入荷待ち・未開封戻し・当日購入）の入力中の値（品ごと）
const SH_KIND = { wait: '入荷待ち', unopened: '未開封戻し', bought: '当日購入' };
// 発注一覧の文（LINE・メールにそのまま貼る。発注が1以上の品だけ。オーナー「挨拶の言葉も入れて」・見本 作業場/見本の画像/発注一覧のコピーと照合_案.png）
const drText = (R, T, O) => { const L = T.map(a => [a.name, Math.max(0, +O[a.id] || 0)]).filter(([, n]) => n > 0).map(([m, n]) => `${m}　${n}`);
  return `お世話になっております。\n${R.store || ''} です。\n${R.day ? mdW(R.day) : ''}の発注をお願いいたします。\n\n${L.join('\n') || 'なし'}\n\nよろしくお願いいたします。`; };
// 開店作業の仕入れの上に、前の日までの発注と、入力中の入荷のくらべ（合わない品は赤）
const shCheck = (D, R, C = {}) => { const th = 'font-weight:400;color:var(--muted);padding:5px 4px;border-bottom:1px solid var(--line)', td = 'padding:6px 4px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums';
  const L = (D.orders || []).map(o => { const v = R.filter(r => !r.free && r.pid === o.id).reduce((s, r) => s + (+r.qty || 0), 0), c = C[o.id], cl = c && c.kind !== 'wait' && v < o.ordered ? Math.min(+c.qty || 0, o.ordered - v) : 0;
    return { name: o.name, o: o.ordered, v, d: v + cl - o.ordered, note: cl ? `${SH_KIND[c.kind]} ${cl}` : '' }; }), n = L.filter(a => a.d).length;
  return `<div style="margin-bottom:4px"><b>発注と入荷</b>　<span class="muted sm">${D.order_day ? mdW(D.order_day) + 'までの発注' : ''}</span></div>${n ? `<div style="color:var(--warn);font-weight:700;font-size:14px;margin-bottom:2px">差あり ${n}品</div>` : ''}
    <table style="border-collapse:collapse;width:100%;font-size:14px"><tr><th style="text-align:left;${th}">品</th>${['発注', '入荷', '差'].map(h => `<th style="text-align:right;${th}">${h}</th>`).join('')}</tr>
    ${L.map(a => `<tr style="${a.d ? 'color:var(--warn);font-weight:700' : ''}"><td style="${td};text-align:left">${esc(a.name)}${a.note ? `<div class="muted sm" style="font-weight:400">${esc(a.note)}</div>` : ''}</td><td style="${td}">${a.o}</td><td style="${td}">${a.v}</td><td style="${td}">${a.d ? (a.d > 0 ? '+' : '−') + Math.abs(a.d) : 0}</td></tr>`).join('')}</table>`; };
// 差の内訳：入荷が発注より少ない品に、本数と「入荷待ち・未開封戻し・当日購入」（はじめは入荷待ち）。入荷待ちのままなら、届くまで毎日出る
const shShort = (D, R) => (D.orders || []).map(o => ({ id: o.id, name: o.name, n: o.ordered - R.filter(r => !r.free && r.pid === o.id).reduce((s, r) => s + (+r.qty || 0), 0) })).filter(a => a.n > 0);
const shClear = (D, R, C) => { const S = shShort(D, R), fs = 'font:inherit;font-size:16px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;box-sizing:border-box';
  S.forEach(a => { if(!C[a.id]) C[a.id] = { kind: 'wait', qty: String(a.n) }; if(C[a.id].kind === 'wait') C[a.id].qty = String(a.n); });
  return S.length ? `<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:8px"><b>差の内訳</b>${S.map(a => `<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;border-top:1px solid var(--line)"><span style="flex:1;min-width:0;line-height:1.4">${esc(a.name)}</span>
    <input data-scq="${a.id}" inputmode="numeric" maxlength="3" value="${esc(C[a.id].qty)}" style="width:56px;text-align:right;${fs}"><span class="muted sm">本</span>
    <select data-sck="${a.id}" style="width:auto;${fs}">${Object.entries(SH_KIND).map(([k, t]) => `<option value="${k}" ${C[a.id].kind === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`).join('')}</div>` : ''; };
// LINE の中のブラウザでは navigator.clipboard が断られることがあるので、選んだ文字のコピーでも試す
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); await uiAlert('コピーしました'); return; }catch(e){}
  const a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(a); a.select(); a.setSelectionRange(0, t.length);
  let ok = false; try{ ok = document.execCommand('copy'); }catch(e){} a.remove();
  await uiAlert(ok ? 'コピーしました' : 'コピーできませんでした。文字を長押しして選択してください'); }
// 閉店作業の決まった画面（ボトル残量・顧客メモの更新申請・係・同伴・反応◎の確認・着物・今日出たお酒・ドリンク・オールアップ確認・その日のメモ）と、開店作業の「連絡先交換の係の確認」「お誕生日登録申請」
async function hallCloseTask(x, ph){
  setBack(() => hallTasks(ph)); show('<div class="muted" style="padding:20px">読み込み中…</div>');
  const r = await sb.rpc('hall_close_data', { p_token: TOKEN, p_task: x.id }); if(r.error){ show(`<div class="card">${esc(r.error.message)}</div>`); return; }
  const k = r.data.kind, D = r.data.data, td = d => { const m = String(d || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : ''; };
  const head = `<div class="ttl">${esc(x.name)}</div><div style="background:var(--gold-soft);border-radius:8px;padding:6px 10px;font-weight:700;font-size:14px;margin-bottom:10px">作業中 ${esc(ME.name)}（あなた）</div>`;
  const sv = (t, note) => `${note ? `<div class="muted sm" style="margin:0 2px 8px">${note}</div>` : ''}<button class="btn" id="clSv">${t || '保存'}</button>`;
  const H = { x, ph, r, k, D, td, sv }, { body, getData } = (HC_BODY[k] || (() => ({ body: '', getData: () => ({}) })))(H);
  show(head + body);
  const again = () => hallCloseTask(x, ph), s = $('clSv');
  const nh = k === 'shiire' || k === 'kaidashi';   /* 納品物・配達・買い出しの写真は、箱の中の撮影（26_nohin.js）。下の写真の欄は出さない */
  hcPhotoBox(nh ? { ...x, need_photo: false } : x, s);
  if(HC_WIRE[k]) HC_WIRE[k](H, again);
  if(s) s.onclick = () => hcSave(x, ph, s, getData, k, D); }
/* 作業の種類ごとの中身（body）と、保存で送るもの（getData） */
function hcBodyBottle(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    body = `<div class="card">${D.map((b, i) => `<div style="display:flex;align-items:center;gap:8px;padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="flex:1;line-height:1.4">${esc(b.name)}<div class="muted sm">${esc(b.customer || '')} 様</div></div>
      <select data-bt="${i}" style="width:auto;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px">${[10,9,8,7,6,5,4,3,2,1,0].map(n => `<option value="${n}" ${b.remaining === n ? 'selected' : ''}>${n}/10</option>`).join('')}</select></div>`).join('') || '<div class="muted">今日ご来店のお客様のキープボトルはありません</div>'}</div>${sv()}`;
    getData = () => ({ rows: D.map((b, i) => ({ id: b.id, remaining: +$('main').querySelector(`[data-bt="${i}"]`).value })) });
  return { body, getData }; }
function hcBodyMemoReq(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    body = `<div class="card">${D.map((q, i) => `<div style="padding:9px 2px;line-height:1.5;${i ? 'border-top:1px solid var(--line)' : ''}"><b>${esc(q.customer || '')} 様</b> <span class="muted sm">${td(q.day)} ${esc(q.author || '')}</span>
      <div style="white-space:pre-wrap">${esc(q.body)}</div><div style="display:flex;gap:8px;margin-top:6px">${tBtn('rqa', i, '追記')}${tBtn('rqr', i, '却下', true)}</div></div>`).join('') || '<div class="muted">申請はありません</div>'}</div>
      ${sv('', D.length ? '全件「追記」か「却下」の後に保存します' : '')}`;
  return { body, getData }; }
// 開店作業「お誕生日登録申請」（顧客メモの更新申請と同じ形。オーナー見本 作業場/お誕生日登録申請_案.png）
function hcBodyBdayReq(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    body = `<div class="card">${D.map((q, i) => `<div style="padding:9px 2px;line-height:1.5;${i ? 'border-top:1px solid var(--line)' : ''}"><b>${esc(q.customer || '')} 様</b> <span class="muted sm">${td(q.day)} ${esc(q.author || '')}</span>
      <div>お誕生日 ${esc(q.birthday)}</div><div style="display:flex;gap:8px;margin-top:6px">${tBtn('bqa', i, '登録')}${tBtn('bqr', i, '却下', true)}</div></div>`).join('') || '<div class="muted">申請はありません</div>'}</div>
      ${sv('', D.length ? '全件「登録」か「却下」の後に保存します' : '')}`;
  return { body, getData }; }
// 係・同伴・反応◎の確認：伝票1枚ずつ［確認］か［修正］（SQL 655・オーナー 2026-11-20「甘い」）。係（広島は誘客）が無い伝票は「なし」（付け忘れに黒服が気づけるように）。1枚は2行（1行目 卓・お客様・印、2行目 係・同伴・反応◎。係相違の時は「係 ルナ　伝票 ママ・ルナ」＝お客様に登録してある係と伝票の係）。印のある伝票を上に、確認済みを下に
const ckBadge = t => `<span style="flex:none;font-size:11px;padding:1px 6px;border-radius:999px;white-space:nowrap;${t === '修正待ち' ? 'background:var(--gold-soft);color:var(--ink)' : 'background:var(--warn-soft);color:var(--warn)'}">${esc(kl(t))}</span>`;
const ckBtn = (k, i, t, g) => tBtn(k, i, t, g).replace('padding:7px 14px;font-size:14px', 'padding:0 10px;font-size:13px;min-height:0;height:36px;line-height:36px');
function hcBodyCheck(H){ const {D, sv, r, td} = H; let body = '', getData = () => ({});
    const dd = D[0]?.day && r?.data?.day && D[0].day !== r.data.day ? D[0].day : null;   /* 前営業日の確認（SQL 656）は、その日の伝票 */
    const ord = b => b.state === 'ok' ? 2 : ((b.marks || []).length || b.state === 'fix') ? 0 : 1, L = D.map((b, i) => ({ ...b, i })).sort((a, b) => ord(a) - ord(b) || a.i - b.i), left = D.filter(b => b.state !== 'ok').length;
    const row = (b, j) => { const mk = [...(b.marks || []), ...(b.state === 'fix' ? ['修正待ち'] : [])];
      return `<div style="display:flex;align-items:center;gap:6px;padding:8px 0;${j ? 'border-top:1px solid var(--line)' : ''}"><span style="flex:none;width:2.2em;font-weight:700">${esc(b.table || '')}</span>
      <div style="flex:1;min-width:0;line-height:1.5"><div style="display:flex;align-items:center;gap:4px;min-width:0"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.customers || '')}</span>${mk.map(ckBadge).join('')}</div>
      <div class="muted sm">${[b.reg ? `${KL} ${esc(b.reg)}</span>　<span style="white-space:nowrap">伝票 ${esc(b.kakari || 'なし')}` : `${KL} ${esc(b.kakari || 'なし')}`, b.note ? esc(b.note) : '', b.douhan ? `同伴 ${esc(b.douhan)}` : '', b.good ? `反応◎ ${esc(b.good)}` : ''].filter(Boolean).map(t => `<span style="white-space:nowrap">${t}</span>`).join('　')}</div></div>
      ${b.state === 'ok' ? `<span class="muted sm" style="flex:none">${esc(b.at || '')} 確認済</span>` : `<div style="display:flex;gap:8px;flex:none">${ckBtn('cka', b.i, '確認')}${ckBtn('ckf', b.i, '修正', true)}</div>`}</div>`; };
    body = `<div class="card"><div class="muted sm" style="margin-bottom:6px">${dd ? `${td(dd)} の伝票` : '今日の伝票'}　${D.length}枚${D.length ? `・未確認 ${left}枚` : ''}</div>${L.map(row).join('') || '<div class="muted">今日の伝票はありません</div>'}</div>
      ${left ? sv('', '全件「確認」の後に保存します').replace('id="clSv"', 'id="clSv" disabled style="opacity:.5"') : sv()}`;   /* 未確認が残る間は押せない（データベースでも止める） */
  return { body, getData }; }
function hcBodyKimono(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    body = `<div class="card">${D.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${D.map((c, i) => `<button class="btn${c.kimono ? '' : ' g'}" data-km="${i}" ${c.done || c.other_day ? 'disabled' : ''} style="display:inline-block;width:auto;padding:8px 12px;font-size:14px">${esc(c.name)}${c.kimono ? '　着物' : ''}${c.done ? '<br><small>新調済</small>' : ''}${c.other_day ? `<br><small>着物 ${td(c.other_day)}</small>` : ''}</button>`).join('')}</div>` : '<div class="muted">今日出勤したキャストがいません</div>'}
      <div class="muted sm" style="margin-top:8px">着物で出勤したキャストを選んで保存します（いない日はそのまま保存）</div></div>${sv()}`;
  return { body, getData }; }
// ワイン・シャンパン・ボトルキープは発注の本数を入力（初めの値は本日の販売数・黒服が修正して［コピー］・記録しない。図4）。配達・買い出しは閉店作業「今日の配達・買い出しの確認」へ移した（決め15・SQL 644）
// 毎日依頼（SQL 645・オーナー「ア 黒服が押す」）：入荷待ちの品は、売れていない日も発注一覧に出す。前の日からの入荷待ちは、その本数を発注の初めの値に足す
const drWaits = (r, T) => { const W = r.data.waits || [];
  return { W, wt: id => W.find(w => w.id === id), extra: W.filter(w => !T.some(a => a.id === w.id)).map(w => ({ id: w.id, name: w.name, qty: 0, track: true })) }; };
const drCnt = 'width:36px;text-align:right;font-variant-numeric:tabular-nums';
const drHead = `<div style="display:flex;align-items:flex-end;gap:8px;font-size:12px;color:var(--muted);padding:0 2px 4px"><span style="flex:1"></span><span style="${drCnt}">販売</span><span style="width:64px;text-align:center">発注</span><span style="width:84px"></span></div>`;
const drRow = (a, O, w, on = w) => `<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;border-top:1px solid var(--line)"><span style="flex:1;min-width:0;line-height:1.4">${esc(a.name)}${w ? '<div class="muted sm">入荷待ち</div>' : ''}</span><b style="${drCnt}">${a.qty}</b>
  <input data-dro="${a.id}" inputmode="numeric" maxlength="3" value="${esc(O[a.id] ?? '')}" style="width:64px;text-align:right;font:inherit;font-size:16px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;box-sizing:border-box">
  <button class="btn g" data-drw="${a.id}" style="display:inline-block;width:84px;padding:6px 0;font-size:13px;margin:0">${on ? '解除' : '毎日依頼'}</button></div>`;
function hcBodyDrinks(H){ const {x, r, D, sv} = H; let body = '', getData = () => ({});
    const T = D.flatMap(g => g.items.filter(a => a.track)), { wt, extra } = drWaits(r, T), T2 = [...T, ...extra];
    if(!drOut[x.id]) drOut[x.id] = Object.fromEntries(T2.map(a => { const w = wt(a.id); return [a.id, String(a.qty + (w && w.since < r.data.day ? w.qty : 0))]; }));
    const O = drOut[x.id], tr = a => drRow(a, O, wt(a.id) && !extra.includes(a) ? 1 : 0, wt(a.id));   // 「入荷待ち」の見出しの下では、品名の下の「入荷待ち」は出さない
    body = `<div class="card">${D.map((g, i) => { const t = g.items.filter(a => a.track), o = g.items.filter(a => !a.track);
      return `<div style="padding:9px 2px 2px;${i ? 'border-top:1px solid var(--line)' : ''}">${t.length ? `<b>${esc(g.cat)}</b>${drHead}${t.map(tr).join('')}` : ''}${o.length ? `<div style="display:flex;gap:4px 12px;flex-wrap:wrap;padding:${t.length ? '8px 2px 6px;border-top:1px solid var(--line)' : '0 0 6px'}">${t.length ? '' : `<b>${esc(g.cat)}</b>`}${o.map(a => `<span>${esc(a.name)} ×${a.qty}</span>`).join('')}</div>` : ''}</div>`; }).join('') || (extra.length ? '' : '<div class="muted">なし</div>')}
      ${extra.length ? `<div style="padding:9px 2px 2px;${D.length ? 'border-top:1px solid var(--line)' : ''}"><b>入荷待ち</b>${drHead}${extra.map(tr).join('')}</div>` : ''}</div>
      ${rtCard(x, r)}${T2.length ? `<div class="card"><div style="display:flex;align-items:center;margin-bottom:6px"><b style="flex:1">発注一覧</b><button class="btn g" id="drCp" style="display:inline-block;width:auto;padding:6px 12px;font-size:14px">コピー</button></div>
        <div id="drTx" style="white-space:pre-wrap;line-height:1.7;background:var(--soft);border-radius:8px;padding:8px 10px;user-select:text;-webkit-user-select:text">${esc(drText(r.data, T2, O))}</div></div>` : ''}${sv()}`;
    getData = () => ({ ...rtData(x) });   // 発注は記録しない（図4）
  return { body, getData }; }
// オールアップ確認（オーナー「必ず1時までには女の子を上がらせたい」）。遅い順に3名・未退勤は保存不可・1:05 超過は理由が必須。基準を 1:05 に（オーナー「1時ではなく1時5分に。広島も銀座も」）
// 閉店時刻を1分でも過ぎた会計も出し、その時は会計の理由も必須（SQL 530・531）。理由の枠は、超過のある箱の一番下にだけ出す（オーナー「退勤の下に理由、会計の下に理由」「超過の時だけ、理由の枠がでる」）
function hcBodyAllup(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    const R = D.rows || [], B = D.bills || [], np = D.pending > 0;
    const line = (n, t, ov, warn) => `<div style="display:flex;align-items:center;gap:8px;padding:9px 2px;border-top:1px solid var(--line);font-size:15px${warn ? ';color:var(--warn)' : ''}"><div style="flex:1">${esc(n)}</div>
      <b style="font-variant-numeric:tabular-nums">${t}</b><span style="width:76px;text-align:right;font-size:13px">${ov ? `${ov}分超過` : ''}</span></div>`;
    const why = id => np ? '' : `<div style="border-top:1px solid var(--line);padding-top:10px;margin-top:2px"><div style="font-weight:700;color:var(--warn);font-size:14px;margin-bottom:6px">超過理由（必須）</div><textarea id="${id}" rows="3" maxlength="500" style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px"></textarea></div>`;
    body = `<div class="card"><div class="muted sm" style="margin-bottom:4px">退勤の遅い順（3名）</div>${R.map(c => line(c.name, c.pending ? '未退勤' : esc(c.out), c.over, c.pending || c.over)).join('') || '<div class="muted">今日出勤したキャストがいません</div>'}${D.over ? why('clWhy') : ''}</div>
      <div class="card"><div class="muted sm" style="margin-bottom:4px">閉店時刻後の会計</div>${B.map(b => line(b.name, esc(b.at), b.over, 1)).join('') || '<div class="muted" style="padding:9px 2px;border-top:1px solid var(--line);font-size:15px">なし</div>'}${D.bill_over ? why('clWhyB') : ''}</div>
      ${np ? `<div class="muted sm err" style="margin:0 2px 8px">未退勤のキャストがいます。退勤の打刻後に保存します（押し忘れは POS で修正）</div><button class="btn" disabled>保存</button>`
        : sv('', D.over || D.bill_over ? '理由は日報メールと操作ログに残ります' : R.length ? '全員 1:05 以前に退勤しています' : '')}`;
    getData = () => ({ reason: $('clWhy') ? $('clWhy').value : '', bill_reason: $('clWhyB') ? $('clWhyB').value : '' });
  return { body, getData }; }
// 開店作業「連絡先交換の係の確認」（前の営業日の連絡先交換の係を選び直す。提出したキャストへ LINE・正しい係へは次の朝のまとめで。オーナー）
function hcBodyContactCheck(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    const R = D.rows || [], C = D.casts || [], dd = D.day ? new Date(D.day + 'T00:00:00+09:00') : null;
    const opt = r => `${r.mode === 'staff' && r.kakari && !C.some(c => c.id === r.kakari) ? `<option value="${r.kakari}" selected>（退店）</option>` : ''}${C.map(c => `<option value="${c.id}" ${r.mode === 'staff' && r.kakari === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="unknown" ${r.mode === 'unknown' ? 'selected' : ''}>わからない</option><option value="none" ${r.mode === 'none' ? 'selected' : ''}>なし</option>`;
    body = `<div class="card"><div class="muted sm" style="margin-bottom:4px">${dd ? `${mdWD(dd)}の連絡先交換　${R.length}件` : '前の営業日の伝票がありません'}</div>${R.map((r, i) => `<div style="display:flex;align-items:center;gap:8px;padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="flex:1;line-height:1.4">${esc(r.customer)} 様<div class="muted sm">交換 ${esc(r.by)}</div></div>
      <select data-ck="${i}" style="width:auto;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px">${opt(r)}</select></div>`).join('') || (dd ? '<div class="muted">連絡先交換はありません</div>' : '')}</div>
      ${sv('', R.length ? `${KL}を変更して保存すると、提出したキャストに LINE が届きます。正しい${KL}には次の朝のまとめで届きます` : '')}`;
    getData = () => ({ rows: R.map((r, i) => ({ id: r.id, kakari: $('main').querySelector(`[data-ck="${i}"]`).value })) });
  return { body, getData }; }
// 閉店作業「連絡先交換の係の確認」（係確認中を黒服が入力。入力した係へは次の朝のまとめで。台帳に係が無いお客様は台帳にも。オーナー）
function hcBodyContactPending(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    const R = D.rows || [], C = D.casts || [];
    body = `<div class="card"><div class="muted sm" style="margin-bottom:4px">${KL}確認中　${R.length}件</div>${R.map((r, i) => `<div style="display:flex;align-items:center;gap:8px;padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="flex:1;line-height:1.4">${esc(r.customer)} 様<div class="muted sm">${mdW(r.day)}　交換 ${esc(r.by)}</div></div>
      <select data-ck="${i}" style="width:auto;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px"><option value="">選んでください</option>${C.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}<option value="none">なし</option></select></div>`).join('') || `<div class="muted">${KL}確認中はありません</div>`}</div>
      ${sv('', R.length ? `入力した${KL}には、次の朝のまとめで届きます` : '')}`;
    getData = () => ({ rows: R.map((r, i) => ({ id: r.id, kakari: $('main').querySelector(`[data-ck="${i}"]`).value })) });
  return { body, getData }; }
// 閉店作業「体験のジャッジ」（体験の子が来た日だけ。出勤した黒服が全員押すまで完了にできない）
function hcBodyTrialJudge(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    body = `${(D.items || []).map(it => judgeCard(it, true)).join('') || '<div class="card muted">本日の体験はありません</div>'}${sv()}`;
    getData = () => ({});
  return { body, getData }; }
// 開店作業の仕入れ（納品物）は 26_nohin.js の hcBodyShiire・hcWireShiire
function hcBodyDayMemo(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    body = `<div class="card"><textarea id="clMemo" rows="4" maxlength="1000" style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px">${esc(D.memo || '')}</textarea>
      <div class="muted sm" style="margin-top:6px">管理サイトの収支の Excel（日次の「メモ」）に入ります。精算の後も修正できます</div></div>${sv()}`;
    getData = () => ({ memo: $('clMemo').value });
  return { body, getData }; }
/* シフト未定の確認（SQL 619）：明日以降シフト未登録の在籍キャストを1人ずつ 在籍／退店 で選ぶ。全員を選ぶまで［保存］は出さない（本日ボトル提案と同じ形）。
   在籍 → TODO「シフト決めの連絡」（シフトが入ると自動で完了）。退店 → POS の在籍リストの行に［退店］。退店処理が終わるまで未完了 */
const SN_CH = { '在籍': 'stay', 'スポット': 'spot', '退店': 'leave' };   /* スポット：シフトを出さずにたまに来る子（SQL 628・626 staff_spot_set） */
function hcBodyShiftNone(H){ const {D, sv} = H; const L = D || [];
  const body = `<div class="muted sm" style="margin:0 2px 8px;line-height:1.7">明日以降シフト未登録の在籍キャスト</div><div class="card">${L.map((c, i) => `<div style="padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0;font-weight:700">${esc(c.name)}</div>
    <select data-sn="${i}" style="width:auto;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px"><option value="">選択</option>${Object.keys(SN_CH).map(w => `<option ${c.choice === SN_CH[w] ? 'selected' : ''}>${w}</option>`).join('')}</select></div>
    <div class="muted sm" style="line-height:1.6">${[c.joined ? `入店 ${esc(c.joined)}` : '', `担当黒服 ${esc(c.manager || '未選択')}`].filter(Boolean).join('・')}<br>最終出勤 ${esc(c.last || 'なし')}</div><div data-snm="${i}"></div></div>`).join('') || '<div class="muted">対象のキャストはいません</div>'}</div>
    <div class="muted sm" id="snHint" style="margin:8px 2px">全員を選ぶと［保存］が表示されます</div>${sv()}`;
  return { body, getData: () => ({ rows: L.map((c, i) => ({ id: c.id, choice: SN_CH[$('main').querySelector(`[data-sn="${i}"]`).value] })) }) }; }
function hcWireShiftNone(H){ const L = H.D || [], M = $('main'), s = $('clSv'), hint = $('snHint'); if(!s) return;
  const box = t => `<div class="sm" style="margin-top:6px;line-height:1.7;background:var(--gold-soft);border-radius:8px;padding:6px 10px">${t}</div>`;
  const sync = () => { L.forEach((c, i) => { const v = M.querySelector(`[data-sn="${i}"]`).value;
      M.querySelector(`[data-snm="${i}"]`).innerHTML = v === '在籍' ? box(`保存すると、TODO に「シフト決めの連絡　${esc(c.name)}」が入ります`)
        : v === 'スポット' ? box(`保存すると、${esc(c.name)}の在籍区分がスポットに変更されます`)
        : v === '退店' ? box(`POS の［在籍リスト］で、${esc(c.name)}の行に［退店］が表示されます。押すと退店処理の小窓が開きます<br>退店処理の完了まで、この確認は未完了です`) : ''; });
    const all = L.every((c, i) => M.querySelector(`[data-sn="${i}"]`).value); s.style.display = all ? '' : 'none'; if(hint) hint.style.display = all || !L.length ? 'none' : ''; };
  M.querySelectorAll('[data-sn]').forEach(e => e.onchange = sync); sync(); }
/* 保証条件の確認（SQL 635）：毎月15日から。週○日以上の条件に届かない見込みの子を 本人都合／店都合 で選ぶ（黒服に選ばせるのはこの2つだけ・オーナー）。
   1人分は2段（名前と選択／出勤日数／必要出勤日数）＋選んだ後の結果の1行。店都合で70%に届かない子は［条件再設定］→ 期限と担当黒服の1行 */
const GC_CH = { '本人都合': 'self', '店都合': 'store' };
function hcBodyGuarantee(H){ const {D, sv} = H; const L = (D && D.rows) || [], HL = (D && D.halls) || [];
  const fld = 'font:inherit;font-size:14px;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;padding:0 8px;background:#fff';
  const body = `<div class="muted sm" style="margin:0 2px 8px;line-height:1.7">保証条件 未達見込み（${D.month}月）</div><div class="card">${L.map((c, i) => `<div style="padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0;font-weight:700">${esc(c.name)}</div>
    <select data-gc="${i}" style="width:auto;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px"><option value="">選択</option>${Object.keys(GC_CH).map(w => `<option ${c.reason === GC_CH[w] ? 'selected' : ''}>${w}</option>`).join('')}</select></div>
    <div class="muted sm" style="line-height:1.6;font-variant-numeric:tabular-nums">出勤日数／必要出勤日数　${c.plan}日／${c.need}日（あと${c.need - c.plan}日）</div>
    <div class="sm" data-gcr="${i}" style="line-height:1.6;display:flex;align-items:center;gap:8px"></div>
    <div data-gcs="${i}" style="display:none;align-items:center;gap:8px;margin-top:6px;white-space:nowrap"><span class="muted sm">期限</span><input type="date" data-gcd="${i}" value="${esc(c.deadline || D.due)}" style="${fld};flex:1;min-width:0;height:40px">
      <span class="muted sm" style="margin-left:6px">担当</span><select data-gca="${i}" style="${fld};width:auto;height:40px">${HL.map(h => `<option value="${h.id}" ${h.id === (c.assignee || c.manager) ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></div></div>`).join('') || '<div class="muted">対象のキャストはいません</div>'}</div>
    <div class="muted sm" id="gcHint" style="margin:8px 2px">全員を選ぶと［保存］が表示されます</div>${sv()}`;
  const q = (k, i) => $('main').querySelector(`[data-${k}="${i}"]`);
  return { body, getData: () => ({ rows: L.map((c, i) => ({ id: c.id, reason: GC_CH[q('gc', i).value], deadline: q('gcd', i).value, assignee: q('gca', i).value })) }) }; }
function hcWireGuarantee(H){ const L = (H.D && H.D.rows) || [], D = H.D || {}, s = $('clSv'), hint = $('gcHint'); if(!s) return;
  const q = (k, i) => $('main').querySelector(`[data-${k}="${i}"]`), open = new Set(L.map((c, i) => c.deadline ? i : -1));
  const reset = (c, i) => q('gc', i).value === '店都合' && c.plan < c.min;
  const sync = () => { L.forEach((c, i) => { const v = q('gc', i).value, r = q('gcr', i), sl = c.daily ? 'スライド日給' : 'スライド時給', gw = c.daily ? '保証日給' : '保証時給';
      const t = v === '本人都合' ? `${sl}・スポットへ変更` : v === '店都合' ? (reset(c, i) ? sl : gw) : '';
      r.style.color = v && (v === '本人都合' || reset(c, i)) ? 'var(--warn)' : 'var(--muted)';
      r.innerHTML = t ? `<span style="flex:1">→ ${D.month}月　${t}</span>${reset(c, i) ? `<button type="button" data-gco="${i}" style="font:inherit;font-size:14px;height:40px;margin-top:4px;padding:0 12px;white-space:nowrap;background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:8px">条件再設定</button>` : ''}` : '';
      q('gcs', i).style.display = reset(c, i) && open.has(i) ? 'flex' : 'none';
      const b = r.querySelector('[data-gco]'); if(b) b.onclick = () => { open.add(i); sync(); }; });
    const all = L.every((c, i) => q('gc', i).value && (!reset(c, i) || open.has(i)));
    s.style.display = all ? '' : 'none'; if(hint){ hint.style.display = all || !L.length ? 'none' : ''; hint.textContent = L.some((c, i) => reset(c, i) && !open.has(i)) ? '［条件再設定］で期限と担当を選ぶと［保存］が表示されます' : '全員を選ぶと［保存］が表示されます'; } };
  L.forEach((c, i) => q('gc', i).onchange = sync); sync(); }
const HC_BODY = { shift_none: hcBodyShiftNone, guarantee: hcBodyGuarantee, bottle: hcBodyBottle, memo_req: hcBodyMemoReq, bday_req: hcBodyBdayReq, check: hcBodyCheck, check2: hcBodyCheck, check_prev: hcBodyCheck, kimono: hcBodyKimono, drinks: hcBodyDrinks, allup: hcBodyAllup, contact_check: hcBodyContactCheck, contact_pending: hcBodyContactPending, trial_judge: hcBodyTrialJudge, shiire: H => hcBodyShiire(H), kaidashi: H => hcBodyKaidashi(H),   /* 26_nohin.js の関数は開いた時に探す（古い index.html の端末で 17_open.js 全体が止まらないように） */
  day_memo: hcBodyDayMemo };
/* 作業の種類ごとの、押した時の動き */
function hcWireDrinks(H, again){ const {x, r, D} = H;
  { const T = D.flatMap(g => g.items.filter(a => a.track)), T2 = [...T, ...drWaits(r, T).extra];
    $('main').querySelectorAll('[data-dro]').forEach(b => b.oninput = () => { drOut[x.id][b.dataset.dro] = b.value.trim(); $('drTx').textContent = drText(r.data, T2, drOut[x.id]); });
    $('main').querySelectorAll('[data-drw]').forEach(b => b.onclick = async () => { const id = b.dataset.drw, on = drWaits(r, T).wt(id); b.disabled = true;   /* 押したらすぐ印を付ける・外す（保存を待たない） */
      const q = await sb.rpc('hall_order_wait', { p_token: TOKEN, p_task: x.id, p_product: id, p_qty: on ? 0 : Math.max(1, +drOut[x.id][id] || 0) });
      if(q.error){ b.disabled = false; await uiAlert(q.error.message); return; } again(); });
    if($('drCp')) $('drCp').onclick = () => copyText(drText(r.data, T2, drOut[x.id])); }
  rtWire(x, again);
}
function hcWireCheck(H, again){ const {x, D} = H;
  [['cka', 'ok'], ['ckf', 'fix']].forEach(([a, st]) => $('main').querySelectorAll(`[data-${a}]`).forEach(b => b.onclick = async () => { const q = D[+b.dataset[a]]; b.disabled = true;
    const z = await sb.rpc('hall_close_check_mark', { p_token: TOKEN, p_task: x.id, p_bill: q.id, p_state: st }); if(z.error){ await uiAlert(z.error.message); again(); return; }
    if(st === 'fix') await uiAlert(`POS［設定］→［伝票一覧］${q.day && q.day !== H.r?.data?.day ? `で ${H.td(q.day)} を選び` : ''}→\n${q.table || ''}［編集］で修正してください\n修正後、ここで［確認］を押してください`); again(); }));
}
function hcWireMemoReq(H, again){ const {x, ph, r, k, D, td, sv} = H;
  [['rqa', 'applied'], ['rqr', 'rejected']].forEach(([a, st]) => $('main').querySelectorAll(`[data-${a}]`).forEach(b => b.onclick = async () => { const q = D[+b.dataset[a]];
    if(st === 'rejected' && !await uiConfirm('この申請を却下しますか？', '却下')) return; b.disabled = true;
    const z = await sb.rpc('hall_close_memo_req', { p_token: TOKEN, p_task: x.id, p_req: q.id, p_status: st }); if(z.error){ await uiAlert(z.error.message); } again(); }));
}
function hcWireBdayReq(H, again){ const {x, ph, r, k, D, td, sv} = H;
  [['bqa', 'applied'], ['bqr', 'rejected']].forEach(([a, st]) => $('main').querySelectorAll(`[data-${a}]`).forEach(b => b.onclick = async () => { const q = D[+b.dataset[a]];
    if(st === 'rejected' && !await uiConfirm('この申請を却下しますか？', '却下')) return; b.disabled = true;
    const z = await sb.rpc('hall_bday_req', { p_token: TOKEN, p_task: x.id, p_req: q.id, p_status: st }); if(z.error){ await uiAlert(z.error.message); } again(); }));
}
function hcWireTrialJudge(H, again){ const {x, ph, r, k, D, td, sv} = H;
  judgeWire($('main'), async (id, v) => { const z = await sb.rpc('cast_tj_vote_staff', { p_token: TOKEN, p_ap: id, p_vote: v }); if(z.error){ await uiAlert(z.error.message); } again(); });
  $('main').querySelectorAll('[data-jtr]').forEach(b => b.onclick = () => apPage(b.dataset.jtr, null, again)); /* その人のページの「体験」で体験結果 */
}
function hcWireKimono(H, again){ const {x, ph, r, k, D, td, sv} = H;
  $('main').querySelectorAll('[data-km]').forEach(b => b.onclick = async () => { const c = D[+b.dataset.km]; b.disabled = true;
    const z = await sb.rpc('hall_close_kimono', { p_token: TOKEN, p_task: x.id, p_staff: c.id, p_on: !c.kimono }); if(z.error){ await uiAlert(z.error.message); } again(); });
}
/* 本日ボトル提案の振り返り（SQL 589・銀座）：その日に本日ボトル提案が出て、ニューボトルが入らなかった卓に理由を1つ選ぶ。ボトルの残りの下に出す。
   全部選ぶまで［保存］は出さない（押しても完了にならないため）。帰りの残りは、上で選んでいる残りをそのまま出す */
async function hcWireBottle(H){ const {x, ph, D} = H; const s = $('clSv'); if(!s) return; s.style.display = 'none';
  const r = await sb.rpc('hall_kpb_review_list', { p_token: TOKEN, p_task: x.id }); const L = r.error ? [] : (r.data || []);
  if(!L.length){ s.style.display = ''; return; }
  const M = $('main'), why = ['お断り', '次回ご注文', '未提案', '残量あり'], cur = id => { const i = D.findIndex(b => b.id === id), e = i < 0 ? null : M.querySelector(`[data-bt="${i}"]`); return e ? `${e.value}/10` : '—'; };
  const card = M.querySelector('.card'); if(!card) return;
  card.insertAdjacentHTML('afterend', `<div style="font-weight:700;margin:16px 2px 8px">本日ボトル提案</div><div class="card">${L.map((t, i) => `<div style="padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0"><span style="display:inline-block;width:42px;font-weight:700">${esc(t.table_name || '')}</span>${esc(t.customer || '')} 様</div>
    <select data-kb="${i}" style="width:auto;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px"><option value="">選択</option>${why.map(w => `<option ${t.reason === w ? 'selected' : ''}>${w}</option>`).join('')}</select></div><div class="muted sm" data-kbl="${i}" style="padding-left:42px;line-height:1.6"></div></div>`).join('')}</div>`);
  const sel = i => M.querySelector(`[data-kb="${i}"]`).value;
  const draw = () => L.forEach((t, i) => { M.querySelector(`[data-kbl="${i}"]`).innerHTML = [...(t.bottles || []).map(b => `${esc(b.name)} ${b.arr}/10 → ${cur(b.id)}`), `提案 ${hmJst(t.at)}・係 ${esc(t.kakari || '—')}`].join('<br>'); });
  const kbSync = () => { s.style.display = L.every((t, i) => sel(i)) ? '' : 'none'; };
  M.querySelectorAll('[data-bt]').forEach(e => e.addEventListener('change', draw)); M.querySelectorAll('[data-kb]').forEach(e => e.onchange = kbSync); draw(); kbSync();
  s.onclick = async () => { s.disabled = true; const q = await sb.rpc('hall_kpb_review_save', { p_token: TOKEN, p_task: x.id, p_rows: L.map((t, i) => ({ bill_id: t.bill_id, reason: sel(i) })) });
    if(q.error){ s.disabled = false; await uiAlert(q.error.message); return; } s.disabled = false; hcSave(x, ph, s, hcBodyBottle(H).getData); };
}
const HC_WIRE = { shift_none: hcWireShiftNone, guarantee: hcWireGuarantee, bottle: hcWireBottle, drinks: hcWireDrinks, shiire: (H, a) => hcWireShiire(H, a), kaidashi: (H, a) => hcWireKaidashi(H, a), memo_req: hcWireMemoReq, bday_req: hcWireBdayReq, trial_judge: hcWireTrialJudge, kimono: hcWireKimono, check: hcWireCheck, check2: hcWireCheck, check_prev: hcWireCheck };
/* 写真とコメントの欄（その作業に要る時だけ） */
function hcPhotoBox(x, s){
  if(s && (x.need_photo || x.need_comment)) s.insertAdjacentHTML('beforebegin', `<div class="card">${x.need_photo ? `<div style="display:flex;align-items:center;gap:8px"><span style="flex:1" id="clPhN">写真${opShots[x.id] ? `　${opShots[x.id].length}枚` : ''}</span><label class="btn g" id="clPl" style="display:inline-block;width:auto;flex:none;padding:7px 12px;font-size:14px;margin:0">写真<input type="file" accept="image/*" capture="environment" id="clPh" style="display:none"></label></div><div id="clPg"></div>` : ''}
    ${x.need_comment ? `<textarea id="clCm" rows="3" maxlength="500" placeholder="コメント（なければ空のまま）" style="display:block;width:100%;box-sizing:border-box;${x.need_photo ? 'margin-top:8px;' : ''}font:inherit;font-size:15px;padding:8px;border:1px solid var(--line);border-radius:8px">${esc(opNotes[x.id] || '')}</textarea>` : ''}</div>`);
  const clShots = () => { const n = (opShots[x.id] || []).length; $('clPhN').textContent = `写真${n ? `　${n}枚` : ''}`; $('clPl').style.display = n < 10 ? 'inline-block' : 'none'; $('clPg').innerHTML = opGrid(x, 'c'); /* 写真の並びと［×］ */
    $('clPg').querySelectorAll('[data-opx]').forEach(b => b.onclick = () => { opDrop(x, +b.dataset.opx.split(':')[1]); clShots(); }); };
  if($('clPh')){ clShots(); $('clPh').onchange = () => { const f = $('clPh').files[0]; $('clPh').value = ''; if(!f) return; opShots[x.id] = [...(opShots[x.id] || []), f].slice(0, 10); clShots(); }; } /* カメラで1枚ずつ足す */
  if($('clCm')) $('clCm').oninput = () => { opNotes[x.id] = $('clCm').value; };
}
/* 保存（写真を縮めて送ってから、作業の中身を保存） */
async function hcSave(x, ph, s, getData, k, D){ s.disabled = true; const nh = k === 'shiire' || k === 'kaidashi';
    try{
      const f = nh ? nhFiles(x) : x.need_photo ? opShots[x.id] || [] : []; let ids = [];   /* 納品物は納品書の写真（26_nohin.js） */
      if(x.need_photo && (nh ? !nhShot(x) : !f.length)){ s.disabled = false; await uiAlert(nh ? '納品書を撮影してください' : '写真を撮ってください'); return; }
      if(f.length){ const p = await sb.rpc('hall_open_photos', { p_token: TOKEN, p_task: x.id, p_count: f.length }); if(p.error) throw p.error;
        ids = p.data; await todoPhotosUp(ids, f); } /* 3枚ずつ同時に送る */
      if(k === 'kaidashi') await nhReceipts(x, D.suppliers);   /* 現金のレシートは PDF で領収書の置き場へ（SQL 644） */
      const z = await sb.rpc('hall_close_save', { p_token: TOKEN, p_task: x.id, p_data: { ...getData(ids), ...(x.need_comment ? { comment: opNotes[x.id] || '' } : {}) } }); if(z.error) throw z.error;
      delete opShots[x.id]; delete nhSlips[x.id]; delete opNotes[x.id]; delete shRows[x.id]; delete shClr[x.id]; delete drOut[x.id]; delete rtRows[x.id]; hallTasks(ph);
    }catch(e){ s.disabled = false; await uiAlert(e.message || String(e)); }
}
