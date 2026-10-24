// v0.17・SQL 117：④連絡先交換の提出。日付は今日だけ。お客様はフルネーム、係を選ぶ。提出すると係に LINE。閉店作業の時に黒服へその日のまとめ（2026-10-16 オーナー）
// v0.54・SQL 185：まとめて書ける（何人でも）・「今日は交換なし」・1:00 の LINE から提出の画面を開く（?go=contact）（オーナー 2026-10-22）
async function contactList(openForm){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_contact_list', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const rows = r.data.rows || [];
  if(openForm){ contactForm(r.data.today); return; }
  const md = d => `${Number(String(d).slice(5,7))}/${Number(String(d).slice(8,10))}（${WD[new Date(d+'T00:00:00+09:00').getDay()]}）`;
  const tn = Number(r.data.today_n || 0), st = tn ? `<div class="sm" style="color:var(--ok);margin-bottom:8px">今日の提出 ${tn}人</div>` : r.data.today_none ? '<div class="sm" style="color:var(--ok);margin-bottom:8px">今日は交換なしで提出済み</div>' : '';
  show(`<div class="ttl">連絡先交換</div>${st}<button class="btn" id="cxNew" style="margin-bottom:12px">提出</button><div class="card"><div class="gh">今月 ${rows.length}人</div>${rows.map(x => `<div style="padding:8px 0;border-top:1px solid var(--line)"><div>${md(x.date)}${esc(x.name)} 様</div>
    <div class="muted sm">${KL} ${esc(x.kakari)}${x.memo?`・${esc(x.memo)}`:''}</div></div>`).join('')||'<div class="muted sm" style="padding:8px 0;border-top:1px solid var(--line)">今月の提出はありません</div>'}</div>`);
  $('cxNew').onclick = () => contactForm(r.data.today);
}
let cxRows = null;
async function contactForm(today){
  setBack(() => contactList()); show('<div class="card c muted">読み込み中…</div>');
  const st = await sb.rpc('cast_resv_staff', { p_token: TOKEN });
  if(st.error){ fail(st.error.message); return; }
  const fld = 'width:100%;height:48px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)';
  const me = (st.data||[]).find(s => s.name === ME.name);
  const d = new Date(today+'T00:00:00+09:00'), dl = `${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）`;
  const KEY = 'olive_cast_contact_rows';
  if(!cxRows){ try{ const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if(v && v.day === today && Array.isArray(v.rows) && v.rows.length) cxRows = v.rows; }catch(e){} }
  const restored = !!cxRows; if(!cxRows) cxRows = [{ n:'', k:'', m:'' }];
  const save = () => { try{ localStorage.setItem(KEY, JSON.stringify({ day: today, rows: cxRows })); }catch(e){} };
  const clear = () => { cxRows = null; try{ localStorage.removeItem(KEY); }catch(e){} };
  const opts = k => `<option value="">選んでください</option>${(st.data||[]).map(s => `<option value="${s.id}" ${k===s.id?'selected':''}>${s.id===me?.id?'自分':esc(s.name)}</option>`).join('')}<option value="unknown" ${k==='unknown'?'selected':''}>わからない</option><option value="none" ${k==='none'?'selected':''}>なし</option>`;
  const paint = () => {
    show(`<div class="ttl">${dl} 連絡先交換の提出</div>${restored?'<div class="muted sm" style="margin:0 2px 8px">途中の入力を戻しました</div>':''}
      ${cxRows.map((r, i) => `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b class="sm">${i+1}人目</b>${cxRows.length>1?`<button data-cxd="${i}" class="btn g" style="width:auto;padding:4px 10px;font-size:13px">外す</button>`:''}</div>
        <label class="f" style="margin-top:6px">お客様（フルネーム）<input data-cxn="${i}" maxlength="30" placeholder="例：孫 正義" value="${esc(r.n)}" style="${fld}"></label>
        ${i===0?'<div class="muted" style="margin-top:4px;white-space:nowrap;font-size:min(12px,calc((100vw - 58px)/25))">ニックネームではなく、フルネームで入力してください</div>':''}
        <label class="f" style="margin-top:8px">${esc(KL)}<select data-cxk="${i}" style="${fld}">${opts(r.k)}</select></label>
        <label class="f" style="margin-top:8px">メモ（任意）<input data-cxm="${i}" maxlength="300" value="${esc(r.m)}" style="${fld}"></label></div>`).join('')}
      <button class="btn g" id="cxAdd">＋ もう1人</button>
      <button class="btn" id="cxGo" style="margin-top:8px">${cxRows.length}人を提出</button><p class="muted sm" style="margin:10px 2px">提出をすると${KL}に共有されます</p>
      <button class="btn g" id="cxNone">今日は交換なし</button>`);
    $('main').querySelectorAll('[data-cxn]').forEach(e => e.oninput = () => { cxRows[+e.dataset.cxn].n = e.value; save(); });
    $('main').querySelectorAll('[data-cxk]').forEach(e => e.onchange = () => { cxRows[+e.dataset.cxk].k = e.value; save(); });
    $('main').querySelectorAll('[data-cxm]').forEach(e => e.oninput = () => { cxRows[+e.dataset.cxm].m = e.value; save(); });
    $('main').querySelectorAll('[data-cxd]').forEach(b => b.onclick = () => { cxRows.splice(+b.dataset.cxd, 1); save(); paint(); });
    $('cxAdd').onclick = () => { cxRows.push({ n:'', k:'', m:'' }); save(); paint(); window.scrollTo(0, document.body.scrollHeight); };
    $('cxGo').onclick = async () => {
      const L = cxRows.map(r => ({ n: r.n.trim().replace(/[\s　]+/g, ' '), k: r.k, m: r.m.trim() }));
      const bad = L.findIndex(r => !r.n); if(bad >= 0){ await uiAlert(`${bad+1}人目のお客様のフルネームを入力してください`); return; }
      const nk = L.findIndex(r => !r.k); if(nk >= 0){ await uiAlert(`${nk+1}人目の${KL}を選んでください`); return; }
      const lab = k => { const o = $('main').querySelector(`[data-cxk] option[value="${k}"]`); return o ? o.textContent : ''; };
      if(!await uiConfirm(`${L.map(r => `${r.n} 様　${KL} ${lab(r.k)}`).join('\n')}\nこの内容で提出しますか？`)) return;
      $('cxGo').disabled = true; let sent = 0, done = 0;
      for(const r of L){ const mode = r.k === 'unknown' || r.k === 'none' ? r.k : 'staff';
        const q = await sb.rpc('cast_contact_submit', { p_token: TOKEN, p_name: r.n, p_mode: mode, p_kakari: mode === 'staff' ? r.k : null, p_memo: r.m || null });
        if(q.error){ cxRows = cxRows.slice(done); save(); $('cxGo').disabled = false; await uiAlert(`${done}人を提出しました。\n${r.n} 様で止まりました：${q.error.message}`); paint(); return; }
        done++; if(q.data.notified) sent++; }
      clear(); await uiAlert(`${done}人を提出しました${sent?`。\n${KL}に LINE で共有しました`:''}`); contactList();
    };
    $('cxNone').onclick = async () => {
      if(!await uiConfirm('今日は連絡先の交換なしで提出しますか？')) return;
      $('cxNone').disabled = true; const q = await sb.rpc('cast_contact_none', { p_token: TOKEN });
      if(q.error){ $('cxNone').disabled = false; await uiAlert(q.error.message); return; }
      clear(); await uiAlert('今日は交換なしで提出しました'); contactList();
    };
  };
  paint();
}
