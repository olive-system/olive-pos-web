// 体験のジャッジ（オーナー。見本 作業場/応募者_体験のジャッジ_案1.png）
// 体験の子が出勤した時に、その日の黒服とオーナーへ LINE（［採用］［不採用］［ヒアリングシート］→ ?go=judge&a=&v=）。閉店作業「体験のジャッジ」でも押せる
// 面接した人のメモは出さない（バイアス）。だれがどちらを押したかは締めまで出さない（押した人の名前だけ）
const jgParam = k => { const q = new URLSearchParams(location.search); let v = q.get(k); if(!v){ const st = q.get('liff.state'); if(st) v = new URLSearchParams(st.replace(/^[^?]*\?/, '')).get(k); } return v; };
// 1人分の箱（写真・名前・時刻・あなたの判断・ヒアリングシート・押した人／まだ）
function judgeCard(it, cl){ /* 閉店作業では、ジャッジの後に体験結果がまだなら［体験結果］（cl） */
  const hl = sheetLines(it.hearing, SH_HR()).filter(([k]) => k !== '17点確認');
  const res = it.closed && it.result ? `<div style="margin-top:8px;font-weight:700">採用 ${it.result.yes}・不採用 ${it.result.no}　→ ${it.result.result === 'hired' ? '採用' : '不採用'}</div>` : '';
  return `<div class="card" data-jg="${it.id}"><div style="display:flex;gap:12px;align-items:flex-start">
    ${it.photo ? `<img src="${it.photo}" alt="" style="flex:none;width:84px;height:112px;object-fit:cover;border:1px solid var(--line);border-radius:8px">` : '<div style="flex:none;width:84px;height:112px;border:1px solid var(--line);border-radius:8px;background:var(--soft)"></div>'}
    <div style="flex:1;min-width:0"><b>${esc(it.name)}</b><div class="muted sm">体験 ${esc(it.time || '')}〜</div>
      ${it.closed ? res + (cl && it.status === 'trial' ? `<div style="display:flex;align-items:center;gap:8px;margin-top:8px"><span style="flex:1;color:var(--warn);font-weight:700">体験結果　未入力</span><button type="button" class="btn" data-jtr="${it.id}" style="width:auto;padding:8px 16px">体験結果</button></div>` : '') : `<div class="f" style="margin-top:8px">あなたの判断</div><div class="seg" style="margin-bottom:0">${[['yes', '採用'], ['no', '不採用']].map(([v, n]) => `<button type="button" data-jv="${v}" class="${it.mine === v ? 'on' : ''}" style="white-space:nowrap;padding:9px 4px">${n}</button>`).join('')}</div>`}</div></div>
    ${it.voted || it.missing ? `<div class="sm" style="border-top:1px solid var(--line);margin-top:10px;padding-top:8px;line-height:1.7"><div style="display:flex;gap:8px"><span class="muted" style="flex:none;width:4em">押した人</span><span>${esc((it.voted || []).join('・') || 'なし')}</span></div>${(it.missing || []).length ? `<div style="display:flex;gap:8px"><span class="muted" style="flex:none;width:4em">まだ</span><span style="color:var(--warn);font-weight:700">${esc(it.missing.join('・'))}</span></div>` : ''}</div>` : ''}
    ${hl.length ? `<details style="margin-top:8px"><summary class="sm" style="cursor:pointer">ヒアリングシート</summary><div class="sm" style="line-height:1.8;padding-top:6px">${hl.map(([k, v]) => `<div style="display:flex;gap:8px"><span class="muted" style="flex:none;width:45%">${esc(k)}</span><span style="min-width:0">${esc(v)}</span></div>`).join('')}</div></details>` : ''}</div>`;
}
function judgeWire(M, vote){ M.querySelectorAll('[data-jg]').forEach(c => c.querySelectorAll('[data-jv]').forEach(b => b.onclick = async () => { c.querySelectorAll('[data-jv]').forEach(x => x.disabled = true); await vote(c.dataset.jg, b.dataset.jv); })); }

// LINE のボタンから（黒服は LINE連携、オーナーはオーナー連携の LINE）
async function judgeLiff(idt){
  const a = jgParam('a'), v0 = jgParam('v'); if(!a){ fail('表示できません'); return; }
  const go = async v => { const r = await sb.rpc('tj_liff', { p_store: STORE, p_id_token: idt, p_ap: a, p_vote: v || null }); if(r.error){ if(v){ await uiAlert(r.error.message); return go(null); } fail(r.error.message); return; }
    show(`<div class="ttl">体験のジャッジ</div>${judgeCard({ ...r.data, voted: null, missing: null })}`);
    judgeWire($('main'), (id, vv) => go(vv)); };
  await go(v0 === 'yes' || v0 === 'no' ? v0 : null);
}
