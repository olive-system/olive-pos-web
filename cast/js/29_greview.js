// 黒服のマイページ：TODO「保証の期限 名前」を押した時の話し合いのカード（SQL 802・見本 保証の期限の話し合い_1（11-28））
// 担当の黒服と店長に出る。数を見て話し合い、結果は POS の［保証の期限］で入力する（入力すると TODO は自動で完了）
async function hallGreviewTodo(x){ setBack(hallTodo); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('hall_guarantee_review', { p_token: TOKEN, p_review: x.greview }); if(r.error){ fail(r.error.message); return; }
  const I = r.data;
  show(`<div class="ttl">${esc(x.name)}</div><div class="card"><div style="font-size:14px;line-height:1.8">${grInfoHead(I)}<br><span class="muted">担当 ${esc(I.manager || '未選択')}</span></div><div style="margin-top:8px">${grTableHtml(I, 14)}</div></div>`); }
