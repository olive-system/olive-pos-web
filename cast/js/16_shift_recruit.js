/* 出勤募集（見本 当日欠勤ですぐ呼ぶ（11-26）⑦⑧⑨・当日欠勤の記録（11-26）③）
   当日欠勤で目安人数を下回った日に、シフトの無い子へ公式 LINE（SQL 739）。キャストはホームの一番上の「出勤募集」で［出勤可］。
   黒服は日のシフトの「出勤可」の並びから［追加］→ 補充（急な出勤の手当。SQL 740）。ふつうの［追加］は補充にしない */

/* キャストのホーム：一番上の「出勤募集」の箱 */
async function homeRecruit(){ const r = await sb.rpc('cast_recruit_info', { p_token: TOKEN }); if(r.error || !r.data) return;
  const R = r.data, h = $('main').querySelector('.hello'); if(!h || $('rcBox')) return;
  const paint = () => `<div class="row" style="padding:0"><b>出勤募集</b><span class="sm muted">${esc(mdW(R.day))}</span></div><div style="height:10px"></div>
    ${R.ok_at ? `<div class="row" style="padding:0"><span>出勤可</span><b>${hmJst(R.ok_at).replace(/^0/, '')} 送信済</b></div><div class="muted sm" style="margin-top:4px">出勤時刻は黒服からご連絡します</div>` : '<button class="btn" id="rcOk">出勤可</button>'}`;
  h.insertAdjacentHTML('afterend', `<div class="card" id="rcBox" style="background:var(--gold-soft)">${paint()}</div>`);
  const wire = () => { const b = $('rcOk'); if(!b) return; b.onclick = async () => { b.disabled = true; const q = await sb.rpc('cast_recruit_ok', { p_token: TOKEN, p_recruit: R.id });
    if(q.error){ b.disabled = false; await uiAlert(q.error.message); return; } R.ok_at = q.data.ok_at; $('rcBox').innerHTML = paint(); }; };
  wire(); }

/* 黒服の日のシフト：当日欠勤の箱の中の「補充」の行（③）と「出勤可」の並び（⑨）。RC＝cast_shift_day_recruit の答え */
function sdRefillRow(a){ return a.refill ? `<div class="sm" style="margin-top:2px"><b style="color:var(--pri)">補充</b> ${esc(a.refill)}　<span class="muted">出勤可 ${hmJst(a.refill_at).replace(/^0/, '')}</span></div>` : ''; }
function sdRecruitHtml(RC){ if(!RC) return ''; const g = 'display:grid;grid-template-columns:4.5em 3em minmax(0,1fr) auto;gap:8px', OK = RC.ok || [];
  return `<div class="gh" style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px">出勤可 ${OK.length}人</div>
    <div class="sm muted">出勤募集 ${RC.sent_at ? hmJst(RC.sent_at).replace(/^0/, '') + ' 送信済' : '送信中'} ${RC.sent}人</div>
    ${OK.length ? `<div class="sm muted" style="${g};padding:6px 2px 0"><span></span><span>連絡</span><span>今週 出勤／希望</span><span style="width:4.6em"></span></div>` : ''}
    ${OK.map((x, i) => `<div style="${g};align-items:center;padding:8px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name)}</span><span class="sm muted">${hmJst(x.ok_at).replace(/^0/, '')}</span><span class="sm muted">${Number(x.week) || 0}日／${x.want == null ? '—' : Number(x.want) + '日'}</span><button class="btn g" data-rca="${i}" style="width:auto;padding:6px 16px;margin:0">追加</button></div>`).join('')}`; }

/* ［追加］：時刻を選んで補充にする（追加するとキャストに【シフトの追加】の LINE。急な出勤の手当が付く） */
function sdRecruitBind(RC, iso, store, tin, again){ if(!RC) return;
  $('main').querySelectorAll('[data-rca]').forEach(b => b.onclick = () => { const x = (RC.ok || [])[+b.dataset.rca], w = document.createElement('div'); w.className = 'dlg';
    w.innerHTML = `<div class="box"><p style="margin-bottom:10px">${esc(x.name)}</p>${tin('21:00', 'id="rcTm"', 'width:100%;font:inherit;font-size:18px;padding:8px;border:1px solid var(--line);border-radius:8px;margin-bottom:14px;background:var(--card)')}<div class="bt"><button class="btn g" data-k="no">キャンセル</button><button class="btn" data-k="ok">追加</button></div></div>`;
    document.body.appendChild(w); w.querySelector('[data-k=no]').onclick = () => w.remove();
    w.querySelector('[data-k=ok]').onclick = async e => { e.target.disabled = true; const q = await sb.rpc('cast_recruit_add', { p_token: TOKEN, p_store: store || null, p_recruit: RC.id, p_staff: x.staff_id, p_time: w.querySelector('#rcTm').value });
      w.remove(); if(q.error){ await uiAlert(q.error.message); return; } again(); }; }); }
