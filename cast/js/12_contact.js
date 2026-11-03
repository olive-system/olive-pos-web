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
    ${RV_NOKK() ? (x.memo ? `<div class="muted sm">${esc(x.memo)}</div>` : '') : `<div class="muted sm">${KL} ${esc(x.kakari)}${x.memo?`・${esc(x.memo)}`:''}</div>`}</div>`).join('') /* v1.05・点検 2026-11-02 D2：広島は担当を出さない */||'<div class="muted sm" style="padding:8px 0;border-top:1px solid var(--line)">今月の提出はありません</div>'}</div>`);
  $('cxNew').onclick = () => contactForm(r.data.today);
}
let cxRows = null;
async function contactForm(today){
  setBack(() => contactList()); show('<div class="card c muted">読み込み中…</div>');
  const T = await sb.rpc('cast_contact_today', { p_token: TOKEN }); /* v1.15・SQL 343：LINE で聞く店は、本日来店のお客様から選ぶ（SQL が未実行・しない の店は今までの画面） */
  if(!T.error && T.data && T.data.ask !== 'off'){ contactPick(T.data); return; }
  const st = await sb.rpc('cast_resv_staff', { p_token: TOKEN });
  if(st.error){ fail(st.error.message); return; }
  const fld = 'width:100%;height:48px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)';
  const me = (st.data||[]).find(s => s.name === ME.name);
  const d = new Date(today+'T00:00:00+09:00'), dl = `${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）`;
  const KEY = 'olive_cast_contact_rows';
  const NK = RV_NOKK(); /* v1.05・点検 2026-11-02 D2：広島は担当（係）が無い（オーナー「広島は担当は無い。係じゃないんだから」）。担当の欄を出さず、「なし」で提出する（cast_contact_submit は「なし」を受け付ける） */
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
        ${NK ? '' : `<label class="f" style="margin-top:8px">${esc(KL)}<select data-cxk="${i}" style="${fld}">${opts(r.k)}</select></label>`}
        <label class="f" style="margin-top:8px">メモ（任意）<input data-cxm="${i}" maxlength="300" value="${esc(r.m)}" style="${fld}"></label></div>`).join('')}
      <button class="btn g" id="cxAdd">＋ もう1人</button>
      <button class="btn" id="cxGo" style="margin-top:8px">${cxRows.length}人を提出</button>${NK ? '' : `<p class="muted sm" style="margin:10px 2px">提出をすると${KL}に共有されます</p>`}
      <button class="btn g" id="cxNone">今日は交換なし</button>`);
    $('main').querySelectorAll('[data-cxn]').forEach(e => e.oninput = () => { cxRows[+e.dataset.cxn].n = e.value; save(); });
    $('main').querySelectorAll('[data-cxk]').forEach(e => e.onchange = () => { cxRows[+e.dataset.cxk].k = e.value; save(); });
    $('main').querySelectorAll('[data-cxm]').forEach(e => e.oninput = () => { cxRows[+e.dataset.cxm].m = e.value; save(); });
    $('main').querySelectorAll('[data-cxd]').forEach(b => b.onclick = () => { cxRows.splice(+b.dataset.cxd, 1); save(); paint(); });
    $('cxAdd').onclick = () => { cxRows.push({ n:'', k:'', m:'' }); save(); paint(); window.scrollTo(0, document.body.scrollHeight); };
    $('cxGo').onclick = async () => {
      const L = cxRows.map(r => ({ n: r.n.trim().replace(/[\s　]+/g, ' '), k: NK ? 'none' : r.k, m: r.m.trim() }));
      const bad = L.findIndex(r => !r.n); if(bad >= 0){ await uiAlert(`${bad+1}人目のお客様のフルネームを入力してください`); return; }
      const nk = L.findIndex(r => !r.k); if(nk >= 0){ await uiAlert(`${nk+1}人目の${KL}を選んでください`); return; }
      const lab = k => { const o = $('main').querySelector(`[data-cxk] option[value="${k}"]`); return o ? o.textContent : ''; };
      if(!await uiConfirm(`${L.map(r => NK ? `${r.n} 様` : `${r.n} 様　${KL} ${lab(r.k)}`).join('\n')}\nこの内容で提出しますか？`)) return;
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

// v1.15・SQL 343：連絡先交換を LINE で聞く（オーナー 2026-11-03）。本日来店のお客様から選ぶ。係はお客様の台帳から（無ければ係確認中。黒服が閉店作業で入力）。女の子は係を選ばない
//   一覧にいないお客様は「その他」にフルネーム。広島は係が無いので出さない
let cpState = null;
function contactPick(T){
  setBack(() => contactList());
  const fld = 'width:100%;height:48px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)';
  const d = new Date(T.day + 'T00:00:00+09:00'), dl = `${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）`;
  const L = T.customers || [], NK = RV_NOKK(), KEY = 'olive_cast_contact_pick';
  if(!cpState){ try{ const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if(v && v.day === T.day && v.sel && Array.isArray(v.rows)) cpState = v; }catch(e){} }
  if(!cpState) cpState = { day: T.day, sel: {}, rows: [{ n:'', m:'' }] };
  const S = cpState; if(!S.rows.length) S.rows.push({ n:'', m:'' }); Object.keys(S.sel).forEach(id => { if(!L.some(c => c.id === id && !c.sent)) delete S.sel[id]; });
  const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} };
  const clear = () => { cpState = null; try{ localStorage.removeItem(KEY); }catch(e){} };
  const kk = c => NK ? '' : c.sent ? '提出済み' : c.kakari ? `${KL} ${esc(c.kakari)}` : `${KL}確認中`;
  const cnt = () => Object.keys(S.sel).length + S.rows.filter(r => r.n.trim()).length;
  const paint = () => {
    show(`<div class="ttl">${dl} 連絡先交換の提出</div>
      ${L.length ? `<div class="card"><div class="gh">本日来店（敬称略）　${L.length}名（伝票順）</div>
        <input id="cpQ" type="search" placeholder="名前で検索" style="${fld};margin:6px 0 8px">
        ${L.map(c => { const on = S.sel[c.id] !== undefined; return `<div data-cpr="${esc(c.name.replace(/[\s　]+/g, ''))}"><label style="display:flex;align-items:center;gap:8px;border:1px solid ${on ? 'var(--ink)' : 'var(--line)'};border-radius:8px;padding:10px;margin-bottom:6px;${c.sent ? 'opacity:.5' : ''}">
          <input type="checkbox" data-cpc="${c.id}" ${on ? 'checked' : ''} ${c.sent ? 'disabled' : ''} style="width:20px;height:20px;flex:none"><span style="flex:1">${esc(c.name)}</span><span class="muted sm" style="width:6.5em;flex:none">${kk(c)}</span></label>
          ${on ? `<input data-cpm="${c.id}" maxlength="300" placeholder="メモ（任意）" value="${esc(S.sel[c.id])}" style="${fld};height:40px;margin:-2px 0 8px 28px;width:calc(100% - 28px)">` : ''}</div>`; }).join('')}</div>` : ''}
      <div class="card"><div class="gh">その他</div>${S.rows.map((r, i) => `<div style="${i ? 'border-top:1px solid var(--line);margin-top:10px;padding-top:4px' : ''}">${S.rows.length > 1 ? `<div style="text-align:right"><button data-cpd="${i}" class="btn g" style="width:auto;padding:4px 10px;font-size:13px">外す</button></div>` : ''}
        <label class="f" style="margin-top:6px">お客様（フルネーム）<input data-cpn="${i}" maxlength="30" placeholder="例：孫 正義" value="${esc(r.n)}" style="${fld}"></label>
        ${i === 0 ? '<div class="muted" style="margin-top:4px;white-space:nowrap;font-size:min(12px,calc((100vw - 58px)/25))">ニックネームではなく、フルネームで入力してください</div>' : ''}
        <label class="f" style="margin-top:8px">メモ（任意）<input data-cpo="${i}" maxlength="300" value="${esc(r.m)}" style="${fld}"></label></div>`).join('')}</div>
      <button class="btn g" id="cxAdd">＋ もう1人</button>
      <button class="btn" id="cxGo" style="margin-top:8px">${cnt()}人を提出</button>${NK ? '' : `<p class="muted sm" style="margin:10px 2px">提出をすると${KL}に共有されます</p>`}
      <button class="btn g" id="cxNone">今日は交換なし</button>`);
    const m = $('main'), go = () => { $('cxGo').textContent = `${cnt()}人を提出`; };
    if($('cpQ')) $('cpQ').oninput = e => { const q = e.target.value.replace(/[\s　]+/g, ''); m.querySelectorAll('[data-cpr]').forEach(x => { x.style.display = !q || x.dataset.cpr.includes(q) ? '' : 'none'; }); };
    m.querySelectorAll('[data-cpc]').forEach(e => e.onchange = () => { if(e.checked) S.sel[e.dataset.cpc] = ''; else delete S.sel[e.dataset.cpc]; save(); const q = $('cpQ') ? $('cpQ').value : ''; paint(); if(q && $('cpQ')){ $('cpQ').value = q; $('cpQ').oninput({ target: $('cpQ') }); } });
    m.querySelectorAll('[data-cpm]').forEach(e => e.oninput = () => { S.sel[e.dataset.cpm] = e.value; save(); });
    m.querySelectorAll('[data-cpn]').forEach(e => e.oninput = () => { S.rows[+e.dataset.cpn].n = e.value; save(); go(); });
    m.querySelectorAll('[data-cpo]').forEach(e => e.oninput = () => { S.rows[+e.dataset.cpo].m = e.value; save(); });
    m.querySelectorAll('[data-cpd]').forEach(b => b.onclick = () => { S.rows.splice(+b.dataset.cpd, 1); save(); paint(); });
    $('cxAdd').onclick = () => { S.rows.push({ n:'', m:'' }); save(); paint(); window.scrollTo(0, document.body.scrollHeight); };
    $('cxGo').onclick = async () => {
      const P = Object.keys(S.sel).map(id => { const c = L.find(x => x.id === id); return { id, n: c.name, m: S.sel[id].trim(), k: c.kakari }; })
        .concat(S.rows.filter(r => r.n.trim()).map(r => ({ id: null, n: r.n.trim().replace(/[\s　]+/g, ' '), m: r.m.trim(), k: null })));
      if(!P.length){ await uiAlert('お客様を選ぶか、フルネームを入力してください'); return; }
      if(!await uiConfirm(`${P.map(r => NK ? `${r.n} 様` : `${r.n} 様　${r.k ? `${KL} ${r.k}` : `${KL}確認中`}`).join('\n')}\nこの内容で提出しますか？`)) return;
      $('cxGo').disabled = true; let sent = 0, done = 0;
      for(const r of P){
        const q = await sb.rpc('cast_contact_pick', { p_token: TOKEN, p_customer: r.id, p_name: r.id ? null : r.n, p_memo: r.m || null });
        if(q.error){ save(); $('cxGo').disabled = false; await uiAlert(`${done}人を提出しました。\n${r.n} 様で止まりました：${q.error.message}`); contactForm(T.day); return; }
        done++; if(r.id) delete S.sel[r.id]; else S.rows.splice(S.rows.indexOf(S.rows.find(x => x.n.trim().replace(/[\s　]+/g, ' ') === r.n)), 1); if(q.data.notified) sent++; }
      clear(); await uiAlert(`${done}人を提出しました${sent ? `。\n${KL}に LINE で共有しました` : ''}`); contactList();
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
