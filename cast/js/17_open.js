// v0.55・SQL 194：開店作業（オーナー 2026-10-22「毎日同じ作業の開店作業と、TODO とを一緒にしないで」「1タスクごとに完了ボタン、その人がやったことを記録」）
// v0.57・SQL 209：閉店作業も同じ画面（オーナー 2026-10-23「閉店作業も黒服のマイページに」「保存した人がやったことに」「誰が作業中かの表示」）
// 開始 → 作業中（ほかの黒服の画面にも出る）→ 完了（写真の項目は写真を選んで完了・決まった画面の項目は保存）。ほかの人が作業中の時は「交代」。対象が「限定」の項目は、限定項目「可」の黒服だけ
let opShots = {};
const TASK_TTL = { open:'開店作業', close:'閉店作業' };
const hm = t => new Date(t).toLocaleTimeString('ja-JP', { timeZone:'Asia/Tokyo', hour:'2-digit', minute:'2-digit', hour12:false });
const tBtn = (k, i, t, g) => `<button class="btn${g ? ' g' : ''}" data-${k}="${i}" style="display:inline-block;width:auto;flex:none;padding:7px 14px;font-size:14px">${t}</button>`;
const wipTag = n => `<b style="background:var(--gold-soft);color:var(--ink);border-radius:6px;padding:2px 7px;font-size:13px;white-space:nowrap">作業中 ${esc(n || '')}</b>`;
function hallOpen(){ return hallTasks('open'); }
function hallClose(){ return hallTasks('close'); }
async function hallTasks(ph){
  setBack(hallHome); show('<div class="muted" style="padding:20px">読み込み中…</div>');
  const r = await sb.rpc('hall_tasks', { p_token: TOKEN, p_phase: ph }); if(r.error){ show(`<div class="card">${esc(r.error.message)}</div>`); return; }
  const D = r.data, L = D.items || [], d = new Date(D.day + 'T00:00:00+09:00'), nd = L.filter(x => x.status === 'done').length;
  if(!D.on){ show(`<div class="ttl">${TASK_TTL[ph]}</div><div class="card muted">閉店作業は POS で行います</div>`); return; }
  const row = (x, i) => { const mine = x.wip_id === D.me, other = x.wip_id && !mine, simple = x.kind === 'simple', na = x.limited && !D.limited_ok;
    let right;
    if(x.status === 'done') right = x.kind === 'todo' ? '<b style="color:var(--ok);font-size:13px">完了</b>'
      : `<b style="color:var(--ok);font-size:13px;white-space:nowrap">完了 ${esc(x.by || '')} ${x.at ? hm(x.at) : ''}</b>${simple && x.staff_id === D.me ? tBtn('opu', i, '取消', true) : ''}`;
    else if(x.kind === 'todo') right = `<b style="color:var(--warn);font-size:13px">未完了 ${x.todo_open}</b>${tBtn('optd', i, '表示', true)}`;
    else if(na) right = `${x.wip_by ? wipTag(x.wip_by) : ''}<span class="muted sm">対象外</span>`;
    else if(other) right = `${wipTag(x.wip_by)}${tBtn('opt', i, '交代', true)}`;
    else if(!mine) right = tBtn('ops', i, '開始');
    else if(simple) right = `${x.need_photo ? `<label class="btn g" style="display:inline-block;width:auto;flex:none;padding:7px 12px;font-size:14px;margin:0">写真<input type="file" accept="image/*" multiple data-opp="${i}" style="display:none"></label>` : ''}${tBtn('opd', i, '完了')}`;
    else right = `${wipTag(x.wip_by)}${tBtn('opv', i, '表示')}`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:11px 2px;border-top:1px solid var(--line)">
    <div style="flex:1;line-height:1.4">${esc(x.name)}${mine && simple && x.status !== 'done' ? `<div class="muted sm">作業中（あなた）${x.need_photo ? `　写真${opShots[x.id] ? `${opShots[x.id].length}枚` : ''}` : ''}</div>` : ''}</div>${right}</div>`; };
  show(`<div class="ttl">${TASK_TTL[ph]}　${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）</div>
    <div class="card"><div class="muted sm" style="margin-bottom:4px">完了 ${nd}／${L.length}。開始・完了は、ほかの黒服の画面にも出ます</div>${L.map(row).join('') || `<div class="muted">${TASK_TTL[ph]}の項目がありません（管理サイトの「${TASK_TTL[ph]}」で追加します）</div>`}</div>`);
  const again = () => hallTasks(ph), at = b => L[+b.dataset[Object.keys(b.dataset)[0]]];
  const start = async (x, take) => { const q = await sb.rpc('hall_task_start', { p_token: TOKEN, p_task: x.id, p_take: !!take }); if(q.error){ await uiAlert(q.error.message); again(); return false; } return true; };
  $('main').querySelectorAll('[data-ops]').forEach(b => b.onclick = async () => { const x = at(b); b.disabled = true; if(!await start(x)) return; if(x.kind === 'simple') again(); else hallCloseTask(x, ph); });
  $('main').querySelectorAll('[data-opt]').forEach(b => b.onclick = async () => { const x = at(b); if(!await uiConfirm(`${x.wip_by}さんが作業中です。\n交代しますか？`, '交代')) return; if(!await start(x, true)) return; if(x.kind === 'simple') again(); else hallCloseTask(x, ph); });
  $('main').querySelectorAll('[data-opv]').forEach(b => b.onclick = () => hallCloseTask(at(b), ph));
  $('main').querySelectorAll('[data-optd]').forEach(b => b.onclick = hallTodo);
  $('main').querySelectorAll('[data-opp]').forEach(inp => inp.onchange = () => { const x = at(inp); const f = [...inp.files].slice(0, 10); if(f.length) opShots[x.id] = f; again(); });
  $('main').querySelectorAll('[data-opd]').forEach(b => b.onclick = async () => { const x = at(b); b.disabled = true;
    try{
      if(x.need_photo){ const f = opShots[x.id] || []; if(!f.length){ await uiAlert('写真を選んでから「完了」を押してください'); b.disabled = false; return; }
        const p = await sb.rpc('hall_open_photos', { p_token: TOKEN, p_task: x.id, p_count: f.length }); if(p.error) throw p.error;
        for(let i = 0; i < f.length; i++){ const blob = await shrinkJpeg(f[i]); const up = await sb.storage.from('todo-photos').upload(`${p.data[i]}.jpg`, blob, { contentType:'image/jpeg', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error; } }
      const q = await sb.rpc('hall_open_done', { p_token: TOKEN, p_task: x.id }); if(q.error) throw q.error;
      delete opShots[x.id]; again();
    }catch(e){ b.disabled = false; await uiAlert(e.message || String(e)); again(); } });
  $('main').querySelectorAll('[data-opu]').forEach(b => b.onclick = async () => { const x = at(b); if(!await uiConfirm(`「${x.name}」の完了を取り消しますか？`, '取消')) return;
    const q = await sb.rpc('hall_open_undo', { p_token: TOKEN, p_task: x.id }); if(q.error){ await uiAlert(q.error.message); return; } again(); });
}

// 閉店作業の決まった画面（ボトル残量・顧客メモの更新申請・係・同伴・反応◎の確認・着物・今日出たお酒・ドリンク・その日のメモ）
async function hallCloseTask(x, ph){
  setBack(() => hallTasks(ph)); show('<div class="muted" style="padding:20px">読み込み中…</div>');
  const r = await sb.rpc('hall_close_data', { p_token: TOKEN, p_task: x.id }); if(r.error){ show(`<div class="card">${esc(r.error.message)}</div>`); return; }
  const k = r.data.kind, D = r.data.data, td = d => { const m = String(d || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : ''; };
  const head = `<div class="ttl">${esc(x.name)}</div><div style="background:var(--gold-soft);border-radius:8px;padding:6px 10px;font-weight:700;font-size:14px;margin-bottom:10px">作業中 ${esc(ME.name)}（あなた）</div>`;
  const sv = (t, note) => `${note ? `<div class="muted sm" style="margin:0 2px 8px">${note}</div>` : ''}<button class="btn" id="clSv">${t || '保存'}</button>`;
  let body = '', getData = () => ({});
  if(k === 'bottle'){
    body = `<div class="card">${D.map((b, i) => `<div style="display:flex;align-items:center;gap:8px;padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="flex:1;line-height:1.4">${esc(b.name)}<div class="muted sm">${esc(b.customer || '')} 様</div></div>
      <select data-bt="${i}" style="width:auto;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px">${[10,9,8,7,6,5,4,3,2,1,0].map(n => `<option value="${n}" ${b.remaining === n ? 'selected' : ''}>${n}/10</option>`).join('')}</select></div>`).join('') || '<div class="muted">今日ご来店のお客様のキープボトルはありません</div>'}</div>${sv()}`;
    getData = () => ({ rows: D.map((b, i) => ({ id: b.id, remaining: +$('main').querySelector(`[data-bt="${i}"]`).value })) });
  } else if(k === 'memo_req'){
    body = `<div class="card">${D.map((q, i) => `<div style="padding:9px 2px;line-height:1.5;${i ? 'border-top:1px solid var(--line)' : ''}"><b>${esc(q.customer || '')} 様</b> <span class="muted sm">${td(q.day)} ${esc(q.author || '')}</span>
      <div style="white-space:pre-wrap">${esc(q.body)}</div><div style="display:flex;gap:8px;margin-top:6px">${tBtn('rqa', i, '追記')}${tBtn('rqr', i, '却下', true)}</div></div>`).join('') || '<div class="muted">申請はありません</div>'}</div>
      ${sv('', D.length ? '全件「追記」か「却下」の後に保存します' : '')}`;
  } else if(k === 'check'){
    const c = v => esc(v || '');
    body = `<div class="card"><div class="muted sm" style="margin-bottom:6px">今日の伝票　${D.length}枚</div>${D.length ? `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr>${['卓', 'お客様', '係', '同伴', '反応◎'].map(h => `<th style="text-align:left;font-weight:400;color:var(--muted);padding:5px 4px;border-bottom:1px solid var(--line);white-space:nowrap">${h}</th>`).join('')}</tr>
      ${D.map(b => `<tr>${[b.table, b.customers, b.kakari, b.douhan, b.good].map(v => `<td style="padding:6px 4px;border-bottom:1px solid var(--line)">${c(v)}</td>`).join('')}</tr>`).join('')}</table></div>` : '<div class="muted">今日の伝票はありません</div>'}
      <div class="muted sm" style="margin-top:8px">誤りは POS の伝票で修正します</div></div>${sv('確認')}`;
  } else if(k === 'kimono'){
    body = `<div class="card">${D.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${D.map((c, i) => `<button class="btn${c.kimono ? '' : ' g'}" data-km="${i}" ${c.done || c.other_day ? 'disabled' : ''} style="display:inline-block;width:auto;padding:8px 12px;font-size:14px">${esc(c.name)}${c.kimono ? '　着物' : ''}${c.done ? '<br><small>新調済み</small>' : ''}${c.other_day ? `<br><small>着物 ${td(c.other_day)}</small>` : ''}</button>`).join('')}</div>` : '<div class="muted">今日出勤したキャストがいません</div>'}
      <div class="muted sm" style="margin-top:8px">着物で出勤したキャストを選んで保存します（いない日はそのまま保存）</div></div>${sv()}`;
  } else if(k === 'drinks'){
    body = `<div class="card">${D.map((g, i) => `<div style="display:flex;gap:4px 12px;flex-wrap:wrap;padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><b>${esc(g.cat)}</b>${g.items.map(a => `<span>${esc(a.name)} ×${a.qty}</span>`).join('')}</div>`).join('') || '<div class="muted">なし</div>'}
      <div class="muted sm" style="margin-top:8px">発注に回したら保存します</div></div>${sv()}`;
  } else if(k === 'day_memo'){
    body = `<div class="card"><textarea id="clMemo" rows="4" maxlength="1000" style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px">${esc(D.memo || '')}</textarea>
      <div class="muted sm" style="margin-top:6px">管理サイトの収支の Excel（日次の「メモ」）に入ります。精算の後も修正できます</div></div>${sv()}`;
    getData = () => ({ memo: $('clMemo').value });
  }
  show(head + body);
  const again = () => hallCloseTask(x, ph);
  if(k === 'memo_req') [['rqa', 'applied'], ['rqr', 'rejected']].forEach(([a, st]) => $('main').querySelectorAll(`[data-${a}]`).forEach(b => b.onclick = async () => { const q = D[+b.dataset[a]];
    if(st === 'rejected' && !await uiConfirm('この申請を却下しますか？', '却下')) return; b.disabled = true;
    const z = await sb.rpc('hall_close_memo_req', { p_token: TOKEN, p_task: x.id, p_req: q.id, p_status: st }); if(z.error){ await uiAlert(z.error.message); } again(); }));
  if(k === 'kimono') $('main').querySelectorAll('[data-km]').forEach(b => b.onclick = async () => { const c = D[+b.dataset.km]; b.disabled = true;
    const z = await sb.rpc('hall_close_kimono', { p_token: TOKEN, p_task: x.id, p_staff: c.id, p_on: !c.kimono }); if(z.error){ await uiAlert(z.error.message); } again(); });
  const s = $('clSv'); if(s) s.onclick = async () => { s.disabled = true;
    const z = await sb.rpc('hall_close_save', { p_token: TOKEN, p_task: x.id, p_data: getData() }); if(z.error){ s.disabled = false; await uiAlert(z.error.message); return; }
    hallTasks(ph); };
}
