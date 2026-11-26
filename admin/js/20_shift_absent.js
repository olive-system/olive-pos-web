/* シフトの日の詳細で、当日（今の営業日）の出勤を「出勤なし」にする時だけ「本人都合／店都合」を選ぶ（マイページの日のシフトと同じ決まり。見本 当日欠勤の記録（11-26）②）
   本人都合＝当日欠勤（連絡時刻と理由。罰金はマイページの欠勤連絡と同じ判定）。店都合＝今までどおり消すだけ（オーナー 11/26「当日に削除する時のみにしてね」） */
/* 答え：null（キャンセル）・{ self:false }（店都合）・{ self:true, time, reason }（本人都合） */
function shAbsAsk(name, time){ return new Promise(res => { let self = true; const T = absContactTimes();
  const m = mkModal(null, `<div style="white-space:pre-wrap">${esc(`${name}さんの ${time} の出勤を\n取消しますか？`)}</div>
    <div style="display:flex;margin:12px 0 10px;border:1px solid var(--line);border-radius:8px;overflow:hidden"><button type="button" data-ab="1" style="flex:1;border:0;border-radius:0">本人都合</button><button type="button" data-ab="0" style="flex:1;border:0;border-radius:0">店都合</button></div>
    <div id="abIn" style="display:flex;gap:8px"><label style="flex:none;width:7em;margin:0">連絡時刻<select id="abT">${T.map((t, i) => `<option ${i === T.length - 1 ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label style="flex:1;min-width:0;margin:0">理由<input id="abR" maxlength="300"></label></div>
    <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">取消</button></div>`);
  const seg = () => { m.querySelectorAll('[data-ab]').forEach(b => { const on = (b.dataset.ab === '1') === self; b.className = on ? 'primary' : 'ghost'; }); m.querySelector('#abIn').style.display = self ? 'flex' : 'none'; };
  m.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => { self = b.dataset.ab === '1'; seg(); }); seg();
  m.querySelector('[data-k=no]').onclick = () => { m.remove(); res(null); };
  m.querySelector('[data-k=ok]').onclick = async () => { if(!self){ m.remove(); res({ self: false }); return; }
    const r = m.querySelector('#abR').value.trim(); if(!r){ await uiAlert('理由を入力してください'); return; }
    m.remove(); res({ self: true, time: m.querySelector('#abT').value, reason: r }); }; }); }
/* 「出勤なし」を選んだ時。当日なら本人都合／店都合を聞く。false＝取りやめ（選ぶものを元に戻す）・'self'＝本人都合で記録して消した・'shop'＝店都合（呼んだ側が今までどおり消す） */
async function shAbsPick(st, staffId, name, time, day){
  if(day !== businessDate()) return 'shop';
  const a = await shAbsAsk(name, time); if(!a) return false; if(!a.self) return 'shop';
  const q = await rpc('admin_shift_absent', { p_store: st, p_staff: staffId, p_day: day, p_time: a.time, p_reason: a.reason }); if(!q.ok) return false;
  return 'self'; }
