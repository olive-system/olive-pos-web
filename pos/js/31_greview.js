// POS：保証の期限の話し合いの結果（SQL 802・見本 保証の期限の話し合い_2（11-28））。在籍リストの［保証の期限］から
// 継続＝新しい保証時給・保証の期限・次の期間の目標（給率 ○%↓。給率が届かない月は ｱﾌﾟﾛｰﾁ・交換提出・平均人数）／終了＝保証の期限の後はスライド時給
// 保存すると、本人へ LINE のカード・日報に「保証条件」・担当の黒服と店長の TODO は完了
async function grLoad(){ const r = await sb.rpc('pos_guarantee_reviews'); S.grev = new Map((r.error ? [] : (r.data || [])).map(x => [x.staff_id, x])); }
async function grOpen(sid){ const g = S.grev && S.grev.get(sid); if(!g) return;
  const r = await sb.rpc('pos_guarantee_review_info', { p_review: g.id }); if(r.error){ await uiAlert(r.error.message); return; }
  const I = r.data, m = mkModal(), fld = 'height:44px;border:1px solid var(--line);border-radius:10px;padding:0 10px;font:inherit;font-size:16px;background:var(--card);color:var(--ink)';
  const num = (k, w, v) => `<input type="number" inputmode="decimal" data-g="${k}" value="${v == null ? '' : v}" style="${fld};width:${w}px">`, lab = t => `<span class="muted" style="font-size:15px">${t}</span>`;
  const pg = k => (I.rows || []).find(x => x.k === k)?.goal;   /* 前に決めた目標を初めの値に */
  m.innerHTML = `<div class="box" style="max-width:980px;width:96vw"><div style="font-size:16px"><b>${esc(I.name)}　保証の期限</b></div><div class="muted" style="font-size:13px;margin:2px 0 14px">担当 ${esc(I.manager || '未選択')}・${grInfoHead(I).replace('<br>', '・')}</div>
    <div style="display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);gap:18px;align-items:start"><div>${grTableHtml(I, 15)}</div>
    <div style="display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center">${lab('結果')}<span style="display:flex;gap:8px"><button type="button" class="sm ghost" data-res="continue" style="padding:0 18px;height:44px">継続</button><button type="button" class="sm ghost" data-res="end" style="padding:0 18px;height:44px">終了</button></span>
      <span class="gr-c">${lab('保証時給')}</span><span class="gr-c">${num('wage', 100, I.wage)} 円</span>
      <span class="gr-c">${lab('保証の期限')}</span><span class="gr-c" style="display:flex;align-items:center;gap:10px"><input type="date" data-g="until" style="${fld}"><label style="font-size:15px;display:flex;align-items:center;gap:4px"><input type="checkbox" data-g="forever">無期限</label></span>
      <span class="gr-c">${lab('目標')}</span><span class="gr-c" style="font-size:15px;line-height:2.6"><span class="muted">給率</span> ${num('ratio', 64, pg('ratio'))} %↓<br><span class="muted" style="font-size:13px">給率が届かない月は</span><br>${APR_HK} ${num('ap', 64, pg('ap'))} %↑　<span class="muted">交換提出</span> ${num('cx', 64, pg('cx'))} %↑<br><span class="muted">平均人数</span> ${num('pp', 64, pg('pp'))} 人/日↑</span>
      <span class="gr-e" style="display:none"></span><span class="gr-e muted" style="display:none;font-size:15px">${I.until ? (Number(String(I.until).slice(5, 7)) % 12 + 1) + '月以降 スライド時給' : ''}</span></div></div>
    <div style="display:flex;gap:10px;margin-top:16px"><button type="button" class="ghost" data-x>キャンセル</button><button type="button" class="primary" data-save>保存</button></div></div>`;
  document.body.appendChild(m);
  const q = k => m.querySelector(`[data-g="${k}"]`); let res = 'continue';
  const paint = () => { m.querySelectorAll('[data-res]').forEach(b => { const on = b.dataset.res === res; b.style.border = on ? '2px solid var(--head)' : '1px solid var(--line)'; b.style.fontWeight = on ? '700' : '400'; }); m.querySelectorAll('.gr-c').forEach(e => e.style.display = res === 'continue' ? '' : 'none'); m.querySelectorAll('.gr-e').forEach(e => e.style.display = res === 'end' ? '' : 'none'); };
  m.querySelectorAll('[data-res]').forEach(b => b.onclick = () => { res = b.dataset.res; paint(); }); paint();
  q('forever').onchange = () => { q('until').disabled = q('forever').checked; };
  m.querySelector('[data-x]').onclick = () => m.remove();
  m.querySelector('[data-save]').onclick = async () => {
    const n = k => q(k).value === '' ? null : Number(q(k).value), until = q('forever').checked ? '9999-12-31' : (q('until').value || null);
    if(res === 'continue'){ if(!(n('wage') > 0)){ await uiAlert('保証時給を入れてください'); return; } if(!until){ await uiAlert('保証の期限を入れるか、「無期限」を選んでください'); return; } }
    const hs = S.staffAll.filter(x => x.kind === 'hall' && x.is_active); const by = await uiPick('操作者（黒服）', hs.map(h => ({ label: h.display_name, value: h.display_name }))); if(!by) return;
    const b = m.querySelector('[data-save]'); b.disabled = true;
    const s = await sb.rpc('pos_guarantee_review_save', { p_review: g.id, p_result: res, p_wage: res === 'continue' ? Math.round(n('wage')) : null, p_until: res === 'continue' ? until : null,
      p_goal_ratio: n('ratio'), p_goal_ap: n('ap'), p_goal_cx: n('cx'), p_goal_pp: n('pp'), p_by: by });
    if(s.error){ b.disabled = false; await uiAlert(s.error.message); return; }
    m.remove(); toast(s.data && s.data.sent ? '保存しました（本人に LINE を送りました）' : '保存しました'); renderCasts(); };
}
