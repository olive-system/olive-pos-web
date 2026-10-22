// v0.55・SQL 194：開店作業（オーナー 2026-10-22「毎日同じ作業の開店作業と、TODO とを一緒にしないで」「1タスクごとに完了ボタン、その人がやったことを記録」）
// 黒服だけ。タスクごとに「完了」→ 押した人と時刻が残る。写真が要るタスクは写真を選ばないと完了できない。取り消しは完了した人だけ
let opShots = {};
async function hallOpen(){
  setBack(hallHome); show('<div class="muted" style="padding:20px">読み込み中…</div>');
  const r = await sb.rpc('hall_open_tasks', { p_token: TOKEN }); if(r.error){ show(`<div class="card">${esc(r.error.message)}</div>`); return; }
  const D = r.data, L = D.items || [], d = new Date(D.day + 'T00:00:00+09:00'), nd = L.filter(x => x.status === 'done').length;
  const hm = t => new Date(t).toLocaleTimeString('ja-JP', { timeZone:'Asia/Tokyo', hour:'2-digit', minute:'2-digit', hour12:false });
  const row = (x, i) => `<div style="display:flex;align-items:center;gap:8px;padding:11px 2px;border-top:1px solid var(--line)">
    <div style="flex:1;line-height:1.4">${esc(x.name)}${x.need_photo && x.status !== 'done' ? `<div class="muted sm">写真${opShots[x.id] ? `（${opShots[x.id].length}枚 選びました）` : ''}</div>` : ''}</div>
    ${x.status === 'done'
      ? `<b style="color:var(--pri);font-size:13px;white-space:nowrap">済 ${esc(x.by || '')} ${x.at ? hm(x.at) : ''}</b>${x.staff_id === D.me ? `<button class="btn g" data-opu="${i}" style="display:inline-block;width:auto;flex:none;padding:6px 10px;font-size:13px">取消</button>` : ''}`
      : `${x.need_photo ? `<label class="btn g" style="display:inline-block;width:auto;flex:none;padding:7px 12px;font-size:14px;margin:0">写真<input type="file" accept="image/*" multiple data-opp="${i}" style="display:none"></label>` : ''}<button class="btn" data-opd="${i}" style="display:inline-block;width:auto;flex:none;padding:7px 14px;font-size:14px">完了</button>`}</div>`;
  show(`<div class="ttl">開店作業　${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）</div>
    <div class="card"><div class="muted sm" style="margin-bottom:4px">済 ${nd}／${L.length}。だれかが完了すると、ほかの黒服の画面にも出ます</div>${L.map(row).join('') || '<div class="muted">開店作業の項目がありません（管理サイトの「開店作業」で足します）</div>'}</div>`);
  $('main').querySelectorAll('[data-opp]').forEach(inp => inp.onchange = () => { const x = L[+inp.dataset.opp]; const f = [...inp.files].slice(0, 10); if(f.length) opShots[x.id] = f; hallOpen(); });
  $('main').querySelectorAll('[data-opd]').forEach(b => b.onclick = async () => { const x = L[+b.dataset.opd]; b.disabled = true;
    try{
      if(x.need_photo){ const f = opShots[x.id] || []; if(!f.length){ await uiAlert('写真を選んでから「完了」を押してください'); b.disabled = false; return; }
        const p = await sb.rpc('hall_open_photos', { p_token: TOKEN, p_task: x.id, p_count: f.length }); if(p.error) throw p.error;
        for(let i = 0; i < f.length; i++){ const blob = await shrinkJpeg(f[i]); const up = await sb.storage.from('todo-photos').upload(`${p.data[i]}.jpg`, blob, { contentType:'image/jpeg', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error; } }
      const q = await sb.rpc('hall_open_done', { p_token: TOKEN, p_task: x.id }); if(q.error) throw q.error;
      delete opShots[x.id]; hallOpen();
    }catch(e){ b.disabled = false; await uiAlert(e.message || String(e)); hallOpen(); } });
  $('main').querySelectorAll('[data-opu]').forEach(b => b.onclick = async () => { const x = L[+b.dataset.opu]; if(!await uiConfirm(`「${x.name}」の完了を取り消しますか？`)) return;
    const q = await sb.rpc('hall_open_undo', { p_token: TOKEN, p_task: x.id }); if(q.error){ await uiAlert(q.error.message); return; } hallOpen(); });
}
