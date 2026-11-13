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
        await upPool(f.length, async i => { const blob = await shrinkJpeg(f[i]); const up = await sb.storage.from('todo-photos').upload(`${p.data[i]}.jpg`, blob, { contentType:'image/jpeg', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error; }); } /* 3枚ずつ同時に送る */
      const q = await sb.rpc('hall_open_done', { p_token: TOKEN, p_task: x.id, ...(x.need_comment ? { p_comment: opNotes[x.id] || '' } : {}) }); if(q.error) throw q.error;
      delete opShots[x.id]; delete opChecks[x.id]; delete opNotes[x.id]; again();
    }catch(e){ b.disabled = false; await uiAlert(e.message || String(e)); again(); } });
  $('main').querySelectorAll('[data-opu]').forEach(b => b.onclick = async () => { const x = at(b); if(!await uiConfirm(`「${x.name}」の完了を取り消しますか？`, '取消')) return;
    const q = await sb.rpc('hall_open_undo', { p_token: TOKEN, p_task: x.id }); if(q.error){ await uiAlert(q.error.message); return; } again(); });
}

const shRows = {};   // 仕入れの入力中の行（追加・× で描き直しても残す）
const drOut = {};   // 配達・買い出しの入力中の本数
// 発注一覧の文（LINE・メールにそのまま貼る。発注が1以上の品だけ。オーナー「挨拶の言葉も入れて」・見本 作業場/見本の画像/発注一覧のコピーと照合_案.png）
const drText = (R, T, O) => { const L = T.map(a => [a.name, Math.max(0, a.qty - (+O[a.id] || 0))]).filter(([, n]) => n > 0).map(([m, n]) => `${m}　${n}`);
  return `お世話になっております。\n${R.store || ''} です。\n${R.day ? mdW(R.day) : ''}の発注をお願いいたします。\n\n${L.join('\n') || 'なし'}\n\nよろしくお願いいたします。`; };
// 開店作業の仕入れの上に、前の日までの発注と、入力中の入荷のくらべ（合わない品は赤）
const shCheck = (D, R) => { const th = 'font-weight:400;color:var(--muted);padding:5px 4px;border-bottom:1px solid var(--line)', td = 'padding:6px 4px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums';
  const L = (D.orders || []).map(o => { const v = R.filter(r => !r.free && r.pid === o.id).reduce((s, r) => s + (+r.qty || 0), 0); return { name: o.name, o: o.ordered, v, d: v - o.ordered }; }), n = L.filter(a => a.d).length;
  return `<div style="margin-bottom:4px"><b>発注と入荷</b>　<span class="muted sm">${D.order_day ? mdW(D.order_day) + 'までの発注' : ''}</span></div>${n ? `<div style="color:var(--warn);font-weight:700;font-size:14px;margin-bottom:2px">差あり ${n}品</div>` : ''}
    <table style="border-collapse:collapse;width:100%;font-size:14px"><tr><th style="text-align:left;${th}">品</th>${['発注', '入荷', '差'].map(h => `<th style="text-align:right;${th}">${h}</th>`).join('')}</tr>
    ${L.map(a => `<tr style="${a.d ? 'color:var(--warn);font-weight:700' : ''}"><td style="${td};text-align:left">${esc(a.name)}</td><td style="${td}">${a.o}</td><td style="${td}">${a.v}</td><td style="${td}">${a.d ? (a.d > 0 ? '+' : '−') + Math.abs(a.d) : 0}</td></tr>`).join('')}</table>`; };
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
  hcPhotoBox(x, s);
  if(HC_WIRE[k]) HC_WIRE[k](H, again);
  if(s) s.onclick = () => hcSave(x, ph, s, getData); }
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
function hcBodyCheck(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    const c = v => esc(v || '');
    body = `<div class="card"><div class="muted sm" style="margin-bottom:6px">今日の伝票　${D.length}枚</div>${D.length ? `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr>${['卓', 'お客様', KL, '同伴', '反応◎'].map(h => `<th style="text-align:left;font-weight:400;color:var(--muted);padding:5px 4px;border-bottom:1px solid var(--line);white-space:nowrap">${h}</th>`).join('')}</tr>
      ${D.map(b => `<tr>${[b.table, b.customers, b.kakari, b.douhan, b.good].map(v => `<td style="padding:6px 4px;border-bottom:1px solid var(--line)">${c(v)}</td>`).join('')}</tr>`).join('')}</table></div>` : '<div class="muted">今日の伝票はありません</div>'}
      <div class="muted sm" style="margin-top:8px">誤りは POS の伝票で修正します</div></div>${sv('確認')}`;
  return { body, getData }; }
function hcBodyKimono(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    body = `<div class="card">${D.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${D.map((c, i) => `<button class="btn${c.kimono ? '' : ' g'}" data-km="${i}" ${c.done || c.other_day ? 'disabled' : ''} style="display:inline-block;width:auto;padding:8px 12px;font-size:14px">${esc(c.name)}${c.kimono ? '　着物' : ''}${c.done ? '<br><small>新調済</small>' : ''}${c.other_day ? `<br><small>着物 ${td(c.other_day)}</small>` : ''}</button>`).join('')}</div>` : '<div class="muted">今日出勤したキャストがいません</div>'}
      <div class="muted sm" style="margin-top:8px">着物で出勤したキャストを選んで保存します（いない日はそのまま保存）</div></div>${sv()}`;
  return { body, getData }; }
// ワイン・シャンパン・ボトルキープは配達・買い出しの本数を入力。発注＝販売−配達・買い出し（オーナー見本 作業場/発注の照合_案2.png）
function hcBodyDrinks(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    const T = D.flatMap(g => g.items.filter(a => a.track)), cnt = 'width:36px;text-align:right;font-variant-numeric:tabular-nums';
    if(!drOut[x.id]) drOut[x.id] = Object.fromEntries(T.map(a => [a.id, a.out ? String(a.out) : '0']));
    const O = drOut[x.id], hd = `<div style="display:flex;align-items:flex-end;gap:8px;font-size:12px;color:var(--muted);padding:0 2px 4px"><span style="flex:1"></span><span style="${cnt}">販売</span><span style="width:64px;text-align:center;font-size:11px;line-height:1.2">配達・<br>買い出し</span><span style="${cnt}">発注</span></div>`;
    const tr = a => `<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;border-top:1px solid var(--line)"><span style="flex:1;line-height:1.4">${esc(a.name)}</span><b style="${cnt}">${a.qty}</b>
      <input data-dro="${a.id}" inputmode="numeric" maxlength="3" value="${esc(O[a.id] ?? '0')}" style="width:64px;text-align:right;font:inherit;font-size:16px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;box-sizing:border-box"><b data-drn="${a.id}" style="${cnt}">${Math.max(0, a.qty - (+O[a.id] || 0))}</b></div>`;
    body = `<div class="card">${D.map((g, i) => { const t = g.items.filter(a => a.track), o = g.items.filter(a => !a.track);
      return `<div style="padding:9px 2px 2px;${i ? 'border-top:1px solid var(--line)' : ''}">${t.length ? `<b>${esc(g.cat)}</b>${hd}${t.map(tr).join('')}` : ''}${o.length ? `<div style="display:flex;gap:4px 12px;flex-wrap:wrap;padding:${t.length ? '8px 2px 6px;border-top:1px solid var(--line)' : '0 0 6px'}">${t.length ? '' : `<b>${esc(g.cat)}</b>`}${o.map(a => `<span>${esc(a.name)} ×${a.qty}</span>`).join('')}</div>` : ''}</div>`; }).join('') || '<div class="muted">なし</div>'}
      <div class="muted sm" style="margin-top:8px">${T.length ? '配達・買い出しで用意した本数を入力します。発注＝販売−配達・買い出し。' : ''}発注に回したら保存します</div></div>
      ${T.length ? `<div class="card"><div style="display:flex;align-items:center;margin-bottom:6px"><b style="flex:1">発注一覧</b><button class="btn g" id="drCp" style="display:inline-block;width:auto;padding:6px 12px;font-size:14px">コピー</button></div>
        <div id="drTx" style="white-space:pre-wrap;line-height:1.7;background:var(--soft);border-radius:8px;padding:8px 10px;user-select:text;-webkit-user-select:text">${esc(drText(r.data, T, O))}</div></div>` : ''}${sv()}`;
    getData = () => ({ rows: T.map(a => ({ id: a.id, out: (O[a.id] ?? '0').trim() })) });
  return { body, getData }; }
// オールアップ確認（オーナー「必ず1時までには女の子を上がらせたい」）。遅い順に3名・未退勤は保存不可・1:00 超過は理由が必須。基準を 1:05 に（オーナー「1時ではなく1時5分に。広島も銀座も」）
function hcBodyAllup(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    const R = D.rows || [], np = D.pending > 0;
    body = `<div class="card"><div class="muted sm" style="margin-bottom:4px">退勤の遅い順（3名）</div>${R.map(c => `<div style="display:flex;align-items:center;gap:8px;padding:9px 2px;border-top:1px solid var(--line);font-size:15px${c.pending || c.over ? ';color:var(--warn)' : ''}"><div style="flex:1">${esc(c.name)}</div>
      <b style="font-variant-numeric:tabular-nums">${c.pending ? '未退勤' : esc(c.out)}</b><span style="width:76px;text-align:right;font-size:13px">${c.over ? `${c.over}分超過` : ''}</span></div>`).join('') || '<div class="muted">今日出勤したキャストがいません</div>'}</div>
      ${np ? `<div class="muted sm err" style="margin:0 2px 8px">未退勤のキャストがいます。退勤の打刻後に保存します（押し忘れは POS で修正）</div><button class="btn" disabled>保存</button>`
        : D.over ? `<div class="card"><div style="font-weight:700;color:var(--warn);font-size:14px;margin-bottom:6px">1:05 超過の理由（必須）</div><textarea id="clWhy" rows="3" maxlength="500" style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px"></textarea></div>${sv('', '理由は日報メールと操作ログに残ります')}`
        : sv('', R.length ? '全員 1:05 以前に退勤しています' : '')}`;
    getData = () => ({ reason: $('clWhy') ? $('clWhy').value : '' });
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
// 開店作業の仕入れ（入荷した品を全部。AB棚の品は理論在庫に加算。オーナー見本 作業場/棚卸し_案2.png）
function hcBodyShiire(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    const P = D.products || [], cats = [...new Set(P.map(p => p.cat))], ab = id => (P.find(p => p.id === id) || {}).ab;
    if(!shRows[x.id]) shRows[x.id] = (D.rows || []).length ? D.rows.map(r => ({ pid: r.product_id || '', name: r.product_id ? '' : r.name, qty: String(r.qty), free: !r.product_id }))
      : (D.orders || []).map(o => ({ pid: o.id, name: '', qty: '', free: false, ord: true }));   // 前の日までの発注を数は空欄で並べる
    const R = shRows[x.id], fs = 'font:inherit;font-size:16px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;box-sizing:border-box';
    const opts = r => `<option value="">選択</option>${cats.map(c => `<optgroup label="${esc(c)}">${P.filter(p => p.cat === c).map(p => `<option value="${p.id}" ${!r.free && r.pid === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}<option value="free" ${r.free ? 'selected' : ''}>品名入力</option>`;
    body = `${(D.orders || []).length ? `<div class="card" id="shCk">${shCheck(D, R)}</div>` : ''}<div class="card"><div style="display:flex;align-items:center;margin-bottom:2px"><b style="flex:1">仕入れ</b><button class="btn g" id="shAdd" style="display:inline-block;width:auto;padding:6px 12px;font-size:14px">追加</button></div>
      ${R.map((r, i) => `<div style="padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="display:flex;align-items:center;gap:8px"><select data-shp="${i}" style="flex:1;min-width:0;${fs}">${opts(r)}</select>
        <input data-shq="${i}" inputmode="numeric" maxlength="3" value="${esc(r.qty)}" style="width:64px;text-align:right;${fs}"><span class="muted sm">本</span><button class="xb" data-shx="${i}" aria-label="削除">×</button></div>
        <input data-shn="${i}" maxlength="60" placeholder="品名" value="${esc(r.name)}" style="display:${r.free ? 'block' : 'none'};width:100%;margin-top:6px;${fs}">
        <span data-sha="${i}" style="display:${!r.free && ab(r.pid) ? 'inline-block' : 'none'};margin-top:4px;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:1px 6px;color:var(--muted)">AB棚</span></div>`).join('') || '<div class="muted" style="padding:9px 2px">入荷なし</div>'}
      <div class="muted sm" style="margin-top:8px">入荷した品を全部入力します。品は POS のメニューから選び、メニューに無い品は品名入力です。AB棚の品は在庫に加算されます</div></div>${sv()}`;
    getData = () => ({ rows: R.filter(r => !(r.ord && r.pid && (r.qty === '' || r.qty === '0'))).map(r => r.free ? { name: r.name, qty: r.qty } : { product_id: r.pid, qty: r.qty }) });   // 届かなかった発注の品（空欄・0）は仕入れに入れない
  return { body, getData }; }
function hcBodyDayMemo(H){ const {x, ph, r, k, D, td, sv} = H; let body = '', getData = () => ({});
    body = `<div class="card"><textarea id="clMemo" rows="4" maxlength="1000" style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px">${esc(D.memo || '')}</textarea>
      <div class="muted sm" style="margin-top:6px">管理サイトの収支の Excel（日次の「メモ」）に入ります。精算の後も修正できます</div></div>${sv()}`;
    getData = () => ({ memo: $('clMemo').value });
  return { body, getData }; }
const HC_BODY = { bottle: hcBodyBottle, memo_req: hcBodyMemoReq, bday_req: hcBodyBdayReq, check: hcBodyCheck, kimono: hcBodyKimono, drinks: hcBodyDrinks, allup: hcBodyAllup, contact_check: hcBodyContactCheck, contact_pending: hcBodyContactPending, trial_judge: hcBodyTrialJudge, shiire: hcBodyShiire, day_memo: hcBodyDayMemo };
/* 作業の種類ごとの、押した時の動き */
function hcWireDrinks(H, again){ const {x, ph, r, k, D, td, sv} = H;
  { const T = D.flatMap(g => g.items.filter(a => a.track));
    $('main').querySelectorAll('[data-dro]').forEach(b => b.oninput = () => { const O = drOut[x.id], a = T.find(i => i.id === b.dataset.dro); O[b.dataset.dro] = b.value;
      $('main').querySelector(`[data-drn="${b.dataset.dro}"]`).textContent = Math.max(0, a.qty - (+b.value || 0)); $('drTx').textContent = drText(r.data, T, drOut[x.id]); });
    if($('drCp')) $('drCp').onclick = () => copyText(drText(r.data, T, drOut[x.id])); }
}
function hcWireShiire(H, again){ const {x, ph, r, k, D, td, sv} = H;
  { const R = shRows[x.id], ab = id => ((D.products || []).find(p => p.id === id) || {}).ab, q = (a, i) => $('main').querySelector(`[data-${a}="${i}"]`);
    $('shAdd').onclick = () => { R.push({ pid: '', name: '', qty: '', free: false }); again(); };
    $('main').querySelectorAll('[data-shx]').forEach(b => b.onclick = () => { R.splice(+b.dataset.shx, 1); again(); });
    $('main').querySelectorAll('[data-shp]').forEach(b => b.onchange = () => { const i = +b.dataset.shp, r = R[i]; r.free = b.value === 'free'; r.pid = r.free ? '' : b.value;
      q('shn', i).style.display = r.free ? 'block' : 'none'; q('sha', i).style.display = !r.free && ab(r.pid) ? 'inline-block' : 'none'; if($('shCk')) $('shCk').innerHTML = shCheck(D, R); });
    $('main').querySelectorAll('[data-shq]').forEach(b => b.oninput = () => { R[+b.dataset.shq].qty = b.value.trim(); if($('shCk')) $('shCk').innerHTML = shCheck(D, R); });
    $('main').querySelectorAll('[data-shn]').forEach(b => b.oninput = () => { R[+b.dataset.shn].name = b.value; }); }
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
  judgeWire($('main'), async (id, v) => { const z = await sb.rpc('tj_vote_staff', { p_token: TOKEN, p_ap: id, p_vote: v }); if(z.error){ await uiAlert(z.error.message); } again(); });
  $('main').querySelectorAll('[data-jtr]').forEach(b => b.onclick = () => apPage(b.dataset.jtr, null, again)); /* その人のページの「体験」で体験結果 */
}
function hcWireKimono(H, again){ const {x, ph, r, k, D, td, sv} = H;
  $('main').querySelectorAll('[data-km]').forEach(b => b.onclick = async () => { const c = D[+b.dataset.km]; b.disabled = true;
    const z = await sb.rpc('hall_close_kimono', { p_token: TOKEN, p_task: x.id, p_staff: c.id, p_on: !c.kimono }); if(z.error){ await uiAlert(z.error.message); } again(); });
}
const HC_WIRE = { drinks: hcWireDrinks, shiire: hcWireShiire, memo_req: hcWireMemoReq, bday_req: hcWireBdayReq, trial_judge: hcWireTrialJudge, kimono: hcWireKimono };
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
async function hcSave(x, ph, s, getData){ s.disabled = true;
    try{
      if(x.need_photo){ const f = opShots[x.id] || []; if(!f.length){ s.disabled = false; await uiAlert('写真を撮ってください'); return; }
        const p = await sb.rpc('hall_open_photos', { p_token: TOKEN, p_task: x.id, p_count: f.length }); if(p.error) throw p.error;
        await upPool(f.length, async i => { const blob = await shrinkJpeg(f[i]); const up = await sb.storage.from('todo-photos').upload(`${p.data[i]}.jpg`, blob, { contentType:'image/jpeg', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error; }); } /* 3枚ずつ同時に送る */
      const z = await sb.rpc('hall_close_save', { p_token: TOKEN, p_task: x.id, p_data: { ...getData(), ...(x.need_comment ? { comment: opNotes[x.id] || '' } : {}) } }); if(z.error) throw z.error;
      delete opShots[x.id]; delete opNotes[x.id]; delete shRows[x.id]; delete drOut[x.id]; hallTasks(ph);
    }catch(e){ s.disabled = false; await uiAlert(e.message || String(e)); }
}
