/* 日のシフトの当日欠勤（見本 当日欠勤の記録（11-26）①②）
   欠勤の行がある子は、出勤の数と一覧から外して、一覧の上の箱に「名前　連絡 13:10・理由」で出す（同じ欠勤を2か所に出さない）
   当日（今の営業日）の出勤を × で取り消す時だけ「本人都合／店都合」を選ぶ。本人都合＝当日欠勤（罰金はマイページの欠勤連絡と同じ判定）。店都合＝今までどおり消すだけ（オーナー 11/26「当日に削除する時のみにしてね」） */

/* 日の画面の読み込み：その日のシフトと当日欠勤の一覧（当日欠勤が読めない時は空で続ける） */
async function sdDayLoad(iso, store){ const a = { p_token: TOKEN, p_store: store || null, p_day: iso };
  const [r, ab, rc] = await Promise.all([sb.rpc('cast_shift_day', a), sb.rpc('cast_shift_day_absent', a), sb.rpc('cast_shift_day_recruit', a)]); return [r, ab.error ? [] : ab.data || [], rc.error ? null : rc.data]; }
/* 一覧の上に当日欠勤の箱を入れる */
function sdAbsWire(AB, RC, L){ if(AB.length || RC) $('main').querySelector('.card').insertAdjacentHTML('beforebegin', sdAbsBox(AB, RC));
  const RF = new Set(AB.map(a => a.refill).filter(Boolean)); /* 補充の子は一覧の名前の横に「補充」（見本③） */
  if(RF.size) $('main').querySelectorAll('[data-sdx]').forEach(b => { const x = L[+b.dataset.sdx], sp = b.parentElement.querySelector('span'); if(x && RF.has(x.name) && sp) sp.insertAdjacentHTML('beforeend', '<b class="sm" style="margin-left:6px;color:var(--pri)">補充</b>'); }); }
/* 一覧の上の箱。理由は長い文のことがあるので1行で切る */
function sdAbsBox(AB, RC){ if(!AB.length && !RC) return ''; /* RC＝出勤募集（16_shift_recruit.js）。補充の行と「出勤可」の並びも同じ箱に */
  return `<div class="card" style="background:var(--gold-soft)"><div class="gh">当日欠勤 ${AB.length}人</div>${AB.map(a => `<div style="display:flex;gap:8px;min-width:0"><span style="flex:none">${esc(a.name)}</span><span class="sm muted" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">連絡 ${hmJst(a.at).replace(/^0/, '')}・${esc(String(a.reason || '').replace(/\s+/g, ' '))}</span></div>${sdRefillRow(a)}`).join('')}${sdRecruitHtml(RC)}</div>`; }

/* 当日の取消の小窓。答え：null（キャンセル）・{ self:false }（店都合）・{ self:true, time, reason }（本人都合） */
function sdAbsDlg(x){ return new Promise(res => { const d = document.createElement('div'); d.className = 'dlg'; let self = true; const T = absContactTimes();
  const f = 'font:inherit;font-size:16px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--card);height:40px;box-sizing:border-box;width:100%';
  d.innerHTML = `<div class="box"><p>${esc(`${x.name}さんの ${x.time} の出勤を\n取消しますか？`)}</p>
    <div style="text-align:left;margin:10px 0 14px"><div class="seg" style="margin-bottom:10px"><button type="button" data-ab="1" class="on">本人都合</button><button type="button" data-ab="0">店都合</button></div>
    <div id="abIn" style="display:flex;gap:8px"><div style="flex:none;width:6.5em"><label class="f">連絡時刻</label><select id="abT" style="${f}">${T.map((t, i) => `<option ${i === T.length - 1 ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div style="flex:1;min-width:0"><label class="f">理由</label><input id="abR" maxlength="300" style="${f}"></div></div></div>
    <div class="bt"><button class="btn g" data-k="no">キャンセル</button><button class="btn" data-k="ok">取消</button></div></div>`;
  document.body.appendChild(d);
  const seg = () => { d.querySelectorAll('[data-ab]').forEach(b => b.classList.toggle('on', (b.dataset.ab === '1') === self)); d.querySelector('#abIn').style.display = self ? 'flex' : 'none'; };
  d.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => { self = b.dataset.ab === '1'; seg(); });
  d.querySelector('[data-k=no]').onclick = () => { d.remove(); res(null); };
  d.querySelector('[data-k=ok]').onclick = async () => { if(!self){ d.remove(); res({ self: false }); return; }
    const r = d.querySelector('#abR').value.trim(); if(!r){ await uiAlert('理由を入力してください'); return; }
    d.remove(); res({ self: true, time: d.querySelector('#abT').value, reason: r }); }; }); }

/* × を押した時：当日なら小窓で本人都合／店都合、前の日までは今までどおりの確かめ。終わったら true */
async function sdAbsCancel(x, iso, store, set){
  if(iso !== businessDate()){ if(!await uiConfirm(`${x.name}さんの ${x.time} の出勤を取消しますか？`, '取消')) return false; return set(x.staff_id, null); }
  const a = await sdAbsDlg(x); if(!a) return false;
  if(!a.self) return set(x.staff_id, null);
  const q = await sb.rpc('cast_shift_absent', { p_token: TOKEN, p_store: store || null, p_staff: x.staff_id, p_day: iso, p_time: a.time, p_reason: a.reason });
  if(q.error){ await uiAlert(q.error.message); return false; }
  return true; }
