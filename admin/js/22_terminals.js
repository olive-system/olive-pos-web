// ---------- タイムカードの端末 v0.23・SQL 063（オーナーだけ）：登録した端末だけ打刻できる ----------
let tcHasId=false; /* v0.68：タイムカード専用の ID がもうある時は「作る」を出さない（1つの店に1つで足りる） */
async function tcCard(){ const box=$('tcBox'); if(!box) return; const st=storeId;
  const r=await sb.rpc('admin_tc_list',{p_store:st}); if(page!=='pw'||storeId!==st||!$('tcBox')) return;
  if(r.error){ box.innerHTML=`<h2>タイムカードの端末</h2><div class="err">${esc(/admin_tc_list/.test(r.error.message)?'SQL 063 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const L=r.data||[];
  box.innerHTML=`<h2>タイムカードの端末</h2>    <table class="t"><tr><th>端末</th><th>状態</th><th>最終打刻</th><th></th></tr>
    ${L.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.registered?'<span class="badge k">登録済</span>':x.code_expires_at?`<span class="badge warnb">コード待ち</span><br><small class="muted">${esc(fmtDT(x.code_expires_at))} まで</small>`:'<span class="badge gray">未登録</span>'}</td>
      <td>${x.last_used_at?esc(fmtDT(x.last_used_at)):'—'}</td><td style="text-align:right;white-space:nowrap"><button class="ghost sm" data-tcre="${x.id}" data-l="${esc(x.label)}">再登録</button> <button class="ghost sm" data-tcdel="${x.id}" data-l="${esc(x.label)}">削除</button></td></tr>`).join('')||'<tr><td class="muted" colspan="4">まだありません</td></tr>'}</table>
    <div style="margin-top:10px;display:grid;grid-template-columns:auto 1fr auto;column-gap:10px;row-gap:4px;align-items:center"><span class="muted" style="font-size:13px">① タイムカード専用ID</span><span class="muted" style="font-size:13px">② 端末名</span><span></span>
      <span style="height:44px;display:flex;align-items:center">${tcHasId?'<span class="badge k">作成済</span>':'<button class="ghost" id="tcIdAdd">作成</button>'}</span><input id="tcLabel" placeholder="例：入口の iPad" maxlength="30" style="height:44px;margin:0"><button class="primary" id="tcAdd" style="height:44px">登録コード発行</button></div>`; /* v0.77：① と ② の見出しと中身の行をそろえる（オーナー「列がそろってない」） */
  /* v0.66・SQL 084：タイムカードの端末でログインするための ID（POS のデータは読めない・書けない）。作った ID とパスワードは上の「今のパスワード」に出る */
  /* v1.37・SQL 157：POS の ID もここで作る（2026-10-18 ゲネプロ。広島に POS の ID が無かった） */
  { const ph=await sb.rpc('admin_pos_account_has',{p_store:st}); if(!ph.error&&page==='pw'&&$('tcBox')){ const d=document.createElement('div'); d.style.cssText='margin-top:14px;display:flex;align-items:center;gap:10px'; d.innerHTML=`<span class="muted" style="font-size:13px">POS の ID</span>${ph.data?'<span class="badge k">作成済</span>':'<button class="ghost" id="posIdAdd">作成</button>'}`; $('tcBox').appendChild(d);
    const pa=$('posIdAdd'); if(pa) pa.onclick=guard(pa,async()=>{ if(!await uiConfirm('この店の POS の ID を作成しますか？','作成')) return; const x=await sb.rpc('admin_pos_account_create',{p_store:st}); if(x.error){ await uiAlert(/admin_pos_account_create/.test(x.error.message)?'SQL 157 が未実行です':x.error.message); return; }
      await uiAlert(`POS の ID を作成しました\n\nログイン用メール：${x.data.email}\nパスワード：${x.data.pw}`); if(page==='pw') PAGES.pw(); }); } }
  const ia=$('tcIdAdd'); if(ia) ia.onclick=guard(ia,async()=>{ if(!await uiConfirm('タイムカード専用IDを作成しますか？','作成')) return;
    const x=await sb.rpc('admin_tc_account_create',{p_store:st}); if(x.error){ await uiAlert(/admin_tc_account_create/.test(x.error.message)?'SQL 084 が未実行です':x.error.message); return; }
    await uiAlert(`IDを作成しました\n\nログイン用メール：${x.data.email}\nパスワード：${x.data.pw}`); if(page==='pw') PAGES.pw(); });
  const show=(label,code)=>new Promise(res=>{ const m=modal(`<h2 style="margin:0">登録コード</h2><div>${esc(label)}</div><div class="tccode">${esc(code)}</div><div class="muted" style="font-size:14px">この端末のタイムカードを開いて入力してください（30分有効・1回だけ使えます）</div><div class="bar"><button class="primary" data-k="ok">閉じる</button></div>`); m.querySelector('[data-k=ok]').onclick=()=>{ m.remove(); res(); }; });
  const add=$('tcAdd'); add.onclick=guard(add,async()=>{ const lb=$('tcLabel').value.trim(); if(!lb){ await uiAlert('端末名を入力してください'); return; }
    const x=await rpc('admin_tc_code',{p_store:st,p_id:null,p_label:lb}); if(!x.ok) return; await show(lb,x.data.code); tcCard(); });
  box.querySelectorAll('[data-tcre]').forEach(b=>b.onclick=guard(b,async()=>{ if(!await uiConfirm(`${b.dataset.l} を再登録しますか？\n今の登録は無効になり、新しい登録コードを入れるまで、この端末では打刻できません`)) return;
    const x=await rpc('admin_tc_code',{p_store:st,p_id:b.dataset.tcre,p_label:null}); if(!x.ok) return; await show(b.dataset.l,x.data.code); tcCard(); }));
  box.querySelectorAll('[data-tcdel]').forEach(b=>b.onclick=guard(b,async()=>{ if(!await uiConfirm(`${b.dataset.l} を削除しますか？\nこの端末では打刻できなくなります`,'削除','danger')) return;
    const x=await rpc('admin_tc_delete',{p_id:b.dataset.tcdel}); if(!x.ok) return; toast('削除しました'); tcCard(); })); }


// ---------- POS の端末 v1.41・SQL 186（オーナーだけ）：登録した端末だけ POS を開く（タイムカードと同じ形。オーナー 2026-10-22） ----------
async function ptCard(){ const box=$('ptBox'); if(!box) return; const st=storeId;
  const r=await sb.rpc('admin_pos_term_list',{p_store:st}); if(page!=='pw'||storeId!==st||!$('ptBox')) return;
  if(r.error){ box.innerHTML=`<h2>POS の端末</h2><div class="err">${esc(/admin_pos_term_list/.test(r.error.message)?'SQL 186 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const L=r.data||[];
  box.innerHTML=`<h2>POS の端末</h2><table class="t"><tr><th>端末</th><th>状態</th><th>最後に開いた</th><th></th></tr>
    ${L.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.registered?'<span class="badge k">登録済</span>':x.code_expires_at?`<span class="badge warnb">コード待ち</span><br><small class="muted">${esc(fmtDT(x.code_expires_at))} まで</small>`:'<span class="badge gray">未登録</span>'}</td>
      <td>${x.last_used_at?esc(fmtDT(x.last_used_at)):'—'}</td><td style="text-align:right;white-space:nowrap"><button class="ghost sm" data-ptre="${x.id}" data-l="${esc(x.label)}">再登録</button> <button class="ghost sm" data-ptdel="${x.id}" data-l="${esc(x.label)}">削除</button></td></tr>`).join('')||'<tr><td class="muted" colspan="4">まだありません</td></tr>'}</table>
    <div style="margin-top:10px;display:flex;gap:10px;align-items:center"><input id="ptLabel" placeholder="例：レジの iPad" maxlength="30" style="height:44px;margin:0;flex:1"><button class="primary" id="ptAdd" style="height:44px">登録コード発行</button></div>`;
  const show=(label,code)=>new Promise(res=>{ const m=modal(`<h2 style="margin:0">登録コード</h2><div>${esc(label)}</div><div class="tccode">${esc(code)}</div><div class="muted" style="font-size:14px">この端末の POS でログインしてから入力してください（30分有効・1回だけ使えます）</div><div class="bar"><button class="primary" data-k="ok">閉じる</button></div>`); m.querySelector('[data-k=ok]').onclick=()=>{ m.remove(); res(); }; });
  const add=$('ptAdd'); add.onclick=guard(add,async()=>{ const lb=$('ptLabel').value.trim(); if(!lb){ await uiAlert('端末名を入力してください'); return; }
    const x=await rpc('admin_pos_term_code',{p_store:st,p_id:null,p_label:lb}); if(!x.ok) return; await show(lb,x.data.code); ptCard(); });
  box.querySelectorAll('[data-ptre]').forEach(b=>b.onclick=guard(b,async()=>{ if(!await uiConfirm(`${b.dataset.l} を再登録しますか？\n今の登録は無効になり、新しい登録コードを入れるまで、この端末では POS を開けません`)) return;
    const x=await rpc('admin_pos_term_code',{p_store:st,p_id:b.dataset.ptre,p_label:null}); if(!x.ok) return; await show(b.dataset.l,x.data.code); ptCard(); }));
  box.querySelectorAll('[data-ptdel]').forEach(b=>b.onclick=guard(b,async()=>{ if(!await uiConfirm(`${b.dataset.l} を削除しますか？\nこの端末では POS を開けなくなります`,'削除','danger')) return;
    const x=await rpc('admin_pos_term_delete',{p_id:b.dataset.ptdel}); if(!x.ok) return; toast('削除しました'); ptCard(); })); }
