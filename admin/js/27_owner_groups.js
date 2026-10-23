// ---------- オーナーのタブをまとめる（admin v1.39・オーナー 2026-10-21「これだけのために1つタブを作るのは嫌」→ ア：4つ） ----------
// 中の画面は今のまま。まとめたタブを開くと最初の画面を出し、上の切り替えでほかの画面へ（page は中の画面の名前のまま＝今までの確かめがそのまま動く）
const OWNER_GROUPS={o_view:['o_perms','o_share'] /* v1.45：「顧客情報の共有」は「OLIVE 顧客情報」（アクセスの許可。SQL 197・オーナー 2026-10-22） */,o_idpw:['o_ids','pw'],o_link:['o_square','o_daily','o_line'] /* v1.53：LINE メニュー（SQL 219） */};
const ownerGroupOf=k=>Object.keys(OWNER_GROUPS).find(g=>OWNER_GROUPS[g].includes(k))||'';
Object.keys(OWNER_GROUPS).forEach(g=>{ PAGES[g]=()=>go(OWNER_GROUPS[g][0]); });
Object.values(OWNER_GROUPS).flat().forEach(k=>{ const f=PAGES[k]; if(!f) return;
  PAGES[k]=async(...a)=>{ const r=await f(...a); if(page!==k) return r; const L=OWNER_GROUPS[ownerGroupOf(k)], m=$('main');
    if(m&&L.length>1&&!m.querySelector(':scope > .ownSub')){ m.insertAdjacentHTML('afterbegin',`<div class="seg ownSub" style="margin-bottom:14px">${L.map(x=>`<button data-sub="${x}" class="${x===k?'on':''}">${esc(nameOf(x))}</button>`).join('')}</div>`);
      m.querySelectorAll(':scope > .ownSub [data-sub]').forEach(b=>b.onclick=async()=>{ if(b.dataset.sub===page||!await leaveOk()) return; go(b.dataset.sub); }); }
    return r; }; });
