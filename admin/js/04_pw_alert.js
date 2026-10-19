// ---------- 黒服を削除した時の警告 ----------
function renderAlert(){
  const s=stSet(), box=$('alertBar');
  if(!s.pw_alert){ box.innerHTML=''; return; }
  // v0.21：警告はパスワードを新しくするまで全員に出し続ける。ボタンはオーナーだけ
  box.innerHTML=me.is_owner
    ? `<div class="alertbar"><span>${FX('warningsign')} 黒服（${esc(s.pw_alert_note||'')}）が削除されました。POS・タイムカード・顧客サイトのパスワードを変更してください</span><button class="danger" id="rotBtn">全パスワード更新</button></div>`
    : `<div class="alertbar"><span>${FX('warningsign')} 黒服（${esc(s.pw_alert_note||'')}）が削除されました。オーナーにPOS・タイムカード・顧客サイトのパスワードを更新してもらってください</span></div>`;
  if(me.is_owner) $('rotBtn').onclick=guard($('rotBtn'),()=>rotateAll());
}
async function rotateAll(){
  const st=curStore();
  if(!await uiConfirm(`${st?.name||''} の全パスワードを更新します。\n\n・POS・タイムカードの端末\n・タイムカード専用ID\n・顧客サイト（閲覧用・編集用）\n\n今ログインしている端末は全部ログアウトされます。営業中は注意してください。`,'更新','danger')) return;
  const r=await rpc('admin_rotate_store',{p_store:storeId}); if(!r.ok) return;
  await showNewPasswords(r.data); me=await loadMe()||me; renderAll();
}
const EYE='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>', EYEOFF='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const CS_KIND={view:'顧客サイト（閲覧用）',edit:'顧客サイト（編集用）'};
function showNewPasswords(d){ return new Promise(res=>{
  const rows=[...(d.devices||[]).map(x=>`<tr><td>${esc(x.label||'端末')}<br><small class="muted">${esc(x.email||'')}</small></td><td class="pwbox">${esc(x.pw)}</td></tr>`),
              ...(d.cs||[]).map(x=>`<tr><td>${esc(CS_KIND[x.kind]||x.kind)}</td><td class="pwbox">${esc(x.pw)}</td></tr>`)].join('');
  const m=modal(`<h2 style="margin:0">新しいパスワード</h2><div class="muted" style="font-size:14px">このパスワードは、あとからでも「パスワード」の画面で見られます</div><table class="t">${rows||'<tr><td class="muted">更新するものがありませんでした</td></tr>'}</table><div class="bar"><button class="primary" data-k="ok">閉じる</button></div>`);
  m.querySelector('[data-k=ok]').onclick=()=>{ m.remove(); res(); }; }); }

