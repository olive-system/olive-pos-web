// データの削除（SQL 470・2026-11-12 オーナー「情報漏洩が気になる。DL してるからデータベースに残す必要もない」）
// 前の月までの伝票・給与・現金管理を、★★★ に保存した後にオーナーだけが消す。保存が済んでいない時はボタンを出さない
PAGES.o_purge=async()=>{ const st=storeId, head=`<h1>データの削除 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="muted">読み込み中…</div>';
  const r=await sb.rpc('admin_purge_info',{p_store:st}); if(page!=='o_purge'||st!==storeId) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card">${esc(r.error.message)}</div>`; return; }
  const I=r.data, [y,mo]=String(I.month).split('-').map(Number), ok=!!I.saved_at, n=v=>Number(v||0).toLocaleString('ja-JP');
  const at=I.saved_at?new Date(I.saved_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  const R=[['bills','伝票',`入金済み ${n(I.bills)}件`,`未入金 ${n(I.bills_keep)}件（置き・請求）`,Number(I.bills)],
    ['pay','給与',`日払い ${n(I.advances)}件・罰金 ${n(I.fines)}件`,'受取のサイン・出勤の打刻',Number(I.advances)+Number(I.fines)],
    ['cash','現金管理',`入出金 ${n(I.cash)}件・レジの精算 ${n(I.closings)}件`,'最新の精算 1件',Number(I.cash)+Number(I.closings)]];
  $('main').innerHTML=head+`<div class="card" style="max-width:640px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px"><b>${y}年${mo}月まで</b><span class="muted" style="font-size:13px">${ok?`★★★ 保存済み ${at}`:`★★★ 未保存（${mo}月分）`}</span></div>
    <div style="margin-top:8px">${R.map(([k,t,c,keep,cnt])=>`<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line)">
      <div style="flex:1;min-width:0"><div style="font-weight:600">${t}</div><div class="muted" style="font-size:13px;margin-top:2px">${c}　／　残す：${keep}</div></div>
      ${ok&&cnt?`<button class="ghost sm" data-purge="${k}">削除</button>`:''}</div>`).join('')}</div></div>`;
  $('main').querySelectorAll('[data-purge]').forEach(b=>b.onclick=async()=>{ const x=R.find(z=>z[0]===b.dataset.purge);
    if(!await uiConfirm(`${y}年${mo}月までの${x[1]} ${n(x[4])}件を削除しますか？\n削除すると元に戻せません`,'削除','danger')) return;
    b.disabled=true; const q=await sb.rpc('admin_purge',{p_store:st,p_kind:x[0]});
    if(q.error){ b.disabled=false; await uiAlert(q.error.message); return; }
    toast(`${x[1]}を削除しました`); PAGES.o_purge(); }); };
