// 黒服のマイページ：店長の TODO 2つ（SQL 818・見本 強化リストのTODO（11-28）・連絡先連携のTODO（11-28））。店長だけに出る（精算は止めない）
// 並びは月1回の TODO「スポットの棚卸し」と同じ（名前を太字・右に選ぶ物・下にうすい字）

/* 来月の強化リスト（毎月22日）：先月の確定の売上の順に並ぶ。チェックを付け外しして［完了］（オーナー「黒服が手で強化リストを強化したい。お客様を選択するだけ」）
   上位10名の下の「11位以下を表示」で全員。上位10名に入らない強化のお客様は「その他の強化」に同じ並びで出す */
function hallKyokaTodo(x){ setBack(hallTodo); const K = x.kyoka || {}, R = K.rows || [], on = new Set(R.filter(r => r.on).map(r => r.id)); let all = false;
  const rk = R.filter(r => r.rk != null), top = () => all ? rk : rk.slice(0, 10);
  const NUM = 'display:inline-block;width:26px;font-weight:400;color:var(--muted);font-variant-numeric:tabular-nums';
  const box = r => r.id ? `<button data-ky="${esc(r.id)}" aria-label="強化" style="flex:none;width:28px;height:28px;padding:0;border-radius:6px;border:1.5px solid ${on.has(r.id) ? 'var(--pri)' : 'var(--line)'};background:${on.has(r.id) ? 'var(--pri)' : '#fff'};color:#fff;font-size:15px;line-height:1">${on.has(r.id) ? '✓' : ''}</button>` : '';
  const sub = r => [r.visits ? `${yen(r.amt)}円・来店 ${r.visits}回` : '来店なし', r.kakari ? `係 ${esc(r.kakari)}` : ''].filter(Boolean).join('・');
  const row = (r, i) => `<div style="padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0;font-weight:700"><span style="${NUM}">${r.rk != null ? r.rk : ''}</span>${esc(r.name)}</div>${box(r)}</div>
    <div class="muted sm" style="line-height:1.6;padding-left:26px;font-variant-numeric:tabular-nums">${sub(r)}</div></div>`;
  const draw = () => { const T = top(), shown = new Set(T.map(r => r.id)), O = R.filter(r => r.id && on.has(r.id) && !shown.has(r.id));
    show(`<div class="ttl">${esc(x.name)}</div>
      <div class="card"><div class="muted sm" style="margin-bottom:4px">${K.month}月の売上　${all || rk.length <= 10 ? '' : '上位10名／'}${rk.length}名</div>${T.map(row).join('') || '<div class="muted">先月の売上の記録はありません</div>'}
        ${!all && rk.length > 10 ? '<button id="kyAll" class="muted sm" style="display:block;width:100%;background:none;border:0;border-top:1px solid var(--line);padding:10px 0 2px;font:inherit;font-size:13px;color:var(--muted)">11位以下を表示</button>' : ''}</div>
      ${O.length ? `<div class="card"><div class="muted sm" style="margin-bottom:4px">その他の強化　${O.length}名</div>${O.map(row).join('')}</div>` : ''}
      <button class="btn" id="tdGo">完了</button><button class="btn g" id="tdNo" style="margin-top:8px">できない（理由を書く）</button>`);
    $('main').querySelectorAll('[data-ky]').forEach(b => b.onclick = () => { const id = b.dataset.ky; on.has(id) ? on.delete(id) : on.add(id); const y = window.scrollY; draw(); window.scrollTo(0, y); });
    if($('kyAll')) $('kyAll').onclick = () => { all = true; const y = window.scrollY; draw(); window.scrollTo(0, y); };
    $('tdNo').onclick = () => hallTodoSkip(x, 'width:100%;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card);color:var(--ink);box-sizing:border-box');
    $('tdGo').onclick = async () => { $('tdGo').disabled = true;
      const q = await sb.rpc('hall_kyoka_save', { p_token: TOKEN, p_item: x.id, p_ids: [...on] });
      if(q.error){ if($('tdGo')) $('tdGo').disabled = false; await uiAlert(q.error.message); return; }
      toast(`強化リスト ${q.data.count}名`); hallTodo(); }; };
  draw();
}

/* 連絡先連携（毎日・候補のある日だけ）：名前だけでは1人に決まらない連絡先交換を、お客様の候補から押して連携。候補にいなければ［該当なし］
   1日20件まで。全部選ぶと［完了］（オーナー「TODO に入れたらできるじゃないの？」） */
function hallClinkTodo(x){ setBack(hallTodo); const L = x.clink || [];
  const chip = (r, c) => { const pk = r.pick === c.id, dis = r.pick || r.none;
    return `<button data-cl="${esc(r.id)}" data-cu="${esc(c.id)}" ${dis ? 'disabled' : ''} style="font:inherit;text-align:left;line-height:1.35;padding:6px 10px;border-radius:8px;border:1px solid ${pk ? 'var(--pri)' : 'var(--line)'};background:${pk ? 'var(--pri)' : '#fff'};color:${pk ? '#fff' : 'var(--ink)'};${dis && !pk ? 'opacity:.45' : ''}"><b style="font-size:14px">${esc(c.name)}</b><div style="font-size:12px;${pk ? '' : 'color:var(--muted)'}">${[c.kakari ? '係 ' + esc(c.kakari) : '', c.last ? '来店 ' + esc(c.last) : '来店なし'].filter(Boolean).join('・')}</div></button>`; };
  const none = r => `<button data-cl="${esc(r.id)}" data-cu="" ${r.pick || r.none ? 'disabled' : ''} style="flex:none;font:inherit;font-size:13px;padding:4px 10px;border-radius:8px;border:1px solid ${r.none ? 'var(--pri)' : 'var(--line)'};background:${r.none ? 'var(--pri)' : '#fff'};color:${r.none ? '#fff' : 'var(--muted)'};${r.pick ? 'opacity:.45' : ''}">該当なし</button>`;
  show(`<div class="ttl">${esc(x.name)}</div>
    <div class="card">${L.map((r, i) => `<div style="padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}">
      <div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0;font-weight:700">${esc(r.name)}</div>${none(r)}</div>
      <div class="muted sm" style="line-height:1.6">${esc(r.cast)}・${esc(r.day)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${(r.cands || []).map(c => chip(r, c)).join('')}</div></div>`).join('') || '<div class="muted">今日の連絡先はありません</div>'}</div>
    <button class="btn" id="tdGo">完了</button><button class="btn g" id="tdNo" style="margin-top:8px">できない（理由を書く）</button>`);
  const again = async () => { const r = await sb.rpc('hall_todos', { p_token: TOKEN }); const y = !r.error && (r.data.items || []).find(z => z.id === x.id); if(y && y.clink){ const s = window.scrollY; hallClinkTodo(y); window.scrollTo(0, s); } else hallTodo(); };
  $('main').querySelectorAll('[data-cl]').forEach(b => b.onclick = async () => { const r = L.find(z => z.id === b.dataset.cl), c = (r.cands || []).find(z => z.id === b.dataset.cu);
    if(!await uiConfirm(c ? `${r.name}（${r.cast}）の連絡先を\n${c.name} 様に連携しますか？` : `${r.name}（${r.cast}）の連絡先を\n該当なしにしますか？`)) return;
    b.disabled = true; const q = await sb.rpc('hall_contact_link', { p_token: TOKEN, p_contact: r.id, p_customer: c ? c.id : null });
    if(q.error){ b.disabled = false; await uiAlert(q.error.message); return; } again(); });
  $('tdNo').onclick = () => hallTodoSkip(x, 'width:100%;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card);color:var(--ink);box-sizing:border-box');
  $('tdGo').onclick = async () => { if(L.some(r => !r.pick && !r.none)){ await uiAlert('全部の連絡先を選んでください'); return; }
    $('tdGo').disabled = true; const q = await sb.rpc('hall_contact_link_done', { p_token: TOKEN, p_item: x.id });
    if(q.error){ if($('tdGo')) $('tdGo').disabled = false; await uiAlert(q.error.message); return; } hallTodo(); };
}
