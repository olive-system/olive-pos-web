// v0.93・SQL 287：月初ミーティング（オーナー 2026-10-29 見本 ミーティング申請_案「作って」）。相手は担当黒服。日は月初の営業日2日・時間帯は店で1つ（管理サイトのシフト設定）
//   キャスト：来月のシフトが確定したら、担当黒服の空き枠を押して申請＝確定。前月の末日まで取消・変更。退勤後の枠はその日に出勤する時だけ
//   黒服：自分の担当の子と担当黒服が未選択の子を空き枠に割当。締切後の変更・取消も黒服
const mtHm = v => String(v || '').replace(/^0(\d)/, '$1');
const mtDay = iso => { const d = new Date(iso + 'T00:00:00+09:00'); return `${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）`; };
const mtMd = iso => `${Number(String(iso).slice(5,7))}/${Number(String(iso).slice(8,10))}`;
const mtMo = iso => `${Number(String(iso).slice(5,7))}月分`;
const mtSlot = (x, on, attr) => `<button ${attr} style="border:1px solid ${on==='me'?'var(--pri)':on==='x'?'var(--soft)':'var(--line)'};border-radius:8px;padding:8px 0;font:inherit;font-size:15px;background:${on==='me'?'var(--pri)':on==='x'?'var(--soft)':'var(--card)'};color:${on==='me'?'#fff':on==='x'?'var(--muted)':'var(--ink)'};${on==='me'?'font-weight:700;':''}${on?'':'cursor:pointer'}" ${on==='x'?'disabled':''}>${mtHm(x.at)}</button>`;

// トップのタイル（キャスト）：申請できる時か、申請済みの枠がある時だけ出す
function mtTile(){
  const b = $('main').querySelector('[data-go=mtg]'); if(!b) return;
  sb.rpc('cast_meeting_get', { p_token: TOKEN }).then(r => { const t = $('main').querySelector('[data-go=mtg]'); if(!t) return;
    if(r.error || !r.data.show){ t.remove(); return; }
    t.onclick = mtCast; if(r.data.open && !r.data.mine) t.insertAdjacentHTML('beforeend', '<small style="color:var(--warn)">未申請</small>'); });
}

async function mtCast(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_meeting_get', { p_token: TOKEN }); if(r.error){ fail(r.error.message); return; }
  mtCastPaint(r.data);
}
function mtCastPaint(M){
  const mine = M.mine, cur = M.now;
  const grp = (d, post) => { const L = (d.slots || []).filter(x => !!x.post === post); if(!L.length) return '';
    return `<div class="gh" style="margin-top:6px">${post ? '退勤後' : '出勤前'}</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${L.map(x => {
      const me = mine && mine.day === d.day && mine.at === x.at; return mtSlot(x, me ? 'me' : x.taken ? 'x' : '', me || x.taken ? '' : `data-mt="${d.day}|${x.at}"`); }).join('')}</div>`; };
  show(`<div class="ttl">ミーティング</div>
    ${cur ? `<div class="card"><div class="gh">${mtMo(cur.day)}</div><b>${mtDay(cur.day)} ${mtHm(cur.at)}</b><div class="muted sm">担当黒服 ${esc(cur.hall)}</div></div>` : ''}
    ${mine || M.open ? `<div class="card"><div class="gh">${mtMo(M.month)}${M.hall ? `　担当黒服 ${esc(M.hall)}` : ''}</div>
      ${mine ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${mtDay(mine.day)} ${mtHm(mine.at)}</b><button class="lkb" id="mtX">取消</button></div>` : '<b class="err">未申請</b>'}
      <div class="muted sm">締切 ${mtMd(M.deadline)}</div></div>` : ''}
    ${M.open ? ((M.days || []).length ? (M.days || []).map(d => `<div class="card"><b>${mtDay(d.day)}</b>${grp(d, false)}${grp(d, true)}</div>`).join('') : '<div class="card muted">ミーティングの枠はありません</div>') : ''}`);
  $('main').querySelectorAll('[data-mt]').forEach(b => b.onclick = async () => { const [d, at] = b.dataset.mt.split('|');
    if(!await uiConfirm(mine ? `${mtDay(mine.day)} ${mtHm(mine.at)} → ${mtDay(d)} ${mtHm(at)}\nミーティングを変更しますか？` : `${mtDay(d)} ${mtHm(at)}\nミーティングを申請しますか？`, mine ? '変更' : '申請')) return;
    const q = await sb.rpc('cast_meeting_book', { p_token: TOKEN, p_day: d, p_at: at }); if(q.error){ await uiAlert(q.error.message); mtCast(); return; }
    const y = window.scrollY; mtCastPaint(q.data); window.scrollTo(0, y); });
  if($('mtX')) $('mtX').onclick = async () => { if(!await uiConfirm(`${mtDay(mine.day)} ${mtHm(mine.at)}\nミーティングを取消しますか？`, '取消')) return;
    const q = await sb.rpc('cast_meeting_cancel', { p_token: TOKEN }); if(q.error){ await uiAlert(q.error.message); mtCast(); return; } mtCastPaint(q.data); };
}

// シフトのカレンダー（確定）に自分のミーティングを出す
async function mtShiftMarks(S, pre){ /* v0.94：pre＝シフトと同時に読み始めた分 */
  let r = null; try{ r = await (pre || sb.rpc('cast_meeting_get', { p_token: TOKEN })); }catch(e){} if(!r || r.error) return;
  [r.data.now, r.data.mine].filter(Boolean).forEach(b => { const F = (S.fixed || []).find(f => String(f.month).slice(0,7) === String(b.day).slice(0,7)); if(F) (F.marks = F.marks || []).push({ day: b.day, kind: 'ミーティング', time: mtHm(b.at) }); });
}

// ---------- 黒服マイページ ----------
function mtHallTile(pre){ /* v0.94：黒服のトップは60秒覚えておいた分（hcGet） */
  (pre || sb.rpc('hall_meeting_get', { p_token: TOKEN })).then(r => { const t = $('main').querySelector('[data-go=mtg]'); if(!t || r.error) return;
    const n = (r.data.todo || []).filter(x => x.mine).length; if(n) t.insertAdjacentHTML('beforeend', `<small style="color:var(--warn)">未申請 ${n}人</small>`); });
}
async function mtHall(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('hall_meeting_get', { p_token: TOKEN }); if(r.error){ fail(r.error.message); return; }
  mtHallPaint(r.data);
}
function mtHallPaint(D){
  const td = D.today || '', T = D.todo || [], mine = T.filter(x => x.mine), nm = T.filter(x => !x.mine);
  const row = (d, x, i) => { const live = d.day >= td;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><span style="width:3.2em">${mtHm(x.at)}</span><span style="flex:1" class="${x.id ? '' : 'muted'}">${x.id ? esc(x.name) : '空き'}</span>${x.post ? '<small class="muted">退勤後</small>' : ''}
      ${live ? (x.id ? `<button class="lkb" data-mx="${x.id}" style="color:var(--warn)">取消</button>` : `<button class="lkb" data-ma="${d.day}|${x.at}|${x.post ? 1 : 0}">割当</button>`) : ''}</div>`; };
  show(`<div class="ttl">ミーティング　${mtMo(D.month)}</div>
    ${T.length ? `<div class="card">${mine.length ? `<b>未申請 ${mine.length}人</b><div>${esc(mine.map(x => x.name).join('・'))}</div>` : ''}${nm.length ? `<div class="muted sm" style="${mine.length ? 'margin-top:4px' : ''}">担当黒服 未選択　${esc(nm.map(x => x.name).join('・'))}</div>` : ''}</div>` : ''}
    ${(D.days || []).map(d => `<div class="card"><b>${mtDay(d.day)}</b>${(d.slots || []).map((x, i) => row(d, x, i)).join('') || '<div class="muted sm">枠なし</div>'}</div>`).join('') || '<div class="card muted">ミーティングの日はありません</div>'}`);
  $('main').querySelectorAll('[data-ma]').forEach(b => b.onclick = () => { const [d, at, post] = b.dataset.ma.split('|'); mtHallPick(D, d, at, post === '1'); });
  $('main').querySelectorAll('[data-mx]').forEach(b => b.onclick = async () => { const x = (D.days || []).flatMap(d => (d.slots || []).map(s => ({ ...s, day: d.day }))).find(s => s.id === b.dataset.mx); if(!x) return;
    if(!await uiConfirm(`${mtDay(x.day)} ${mtHm(x.at)}　${x.name}\nミーティングを取消しますか？`, '取消')) return;
    const q = await sb.rpc('hall_meeting_cancel', { p_token: TOKEN, p_id: x.id }); if(q.error){ await uiAlert(q.error.message); mtHall(); return; } const y = window.scrollY; mtHallPaint(q.data); window.scrollTo(0, y); });
}
// 割当：未申請の子から選ぶ（退勤後の枠は、その日に出勤する子だけ）
function mtHallPick(D, day, at, post){
  setBack(mtHall);
  const on = new Set((D.shifts || []).filter(x => x.day === day).map(x => x.id)), L = (D.todo || []).filter(x => !post || on.has(x.id));
  show(`<div class="ttl">${mtDay(day)} ${mtHm(at)}　割当</div><div class="card">${L.map((x, i) => `<button data-mp="${x.id}" style="display:flex;width:100%;gap:8px;align-items:center;text-align:left;font:inherit;color:var(--ink);background:none;border:0;padding:10px 2px;cursor:pointer;${i ? 'border-top:1px solid var(--line)' : ''}"><span style="flex:1">${esc(x.name)}</span>${x.mine ? '' : '<small class="muted">担当黒服 未選択</small>'}</button>`).join('') || `<div class="muted sm">${post ? 'この日に出勤する未申請の子はいません' : '未申請の子はいません'}</div>`}</div>`);
  $('main').querySelectorAll('[data-mp]').forEach(b => b.onclick = async () => { const x = L.find(c => c.id === b.dataset.mp);
    if(!await uiConfirm(`${mtDay(day)} ${mtHm(at)}　${x.name}\nミーティングを割当しますか？`, '割当')) return;
    const q = await sb.rpc('hall_meeting_assign', { p_token: TOKEN, p_cast: x.id, p_day: day, p_at: at }); if(q.error){ await uiAlert(q.error.message); mtHall(); return; }
    setBack(home); mtHallPaint(q.data); });
}
