// ---------- パスワード ----------
PAGES.pw=async()=>{
  if(!me.is_owner){ PAGES.none(); return; }
  const own=`<div class="card"><h2>自分のパスワード（ID：${esc(me.login_id)}）</h2>
    <div class="grid2"><label>新しいパスワード（8文字以上）<input id="myPw1" type="password" autocomplete="new-password"></label><label>再入力<input id="myPw2" type="password" autocomplete="new-password"></label><div><button class="primary" id="mySave" style="width:100%">変更</button></div></div>
    <div class="muted" style="font-size:14px;margin-top:8px">変更すると、ほかの端末でこのIDでログインしている分はログアウトされます</div></div>`;
  $('main').innerHTML=`<h1>パスワード <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>${own}<div class="card muted">読み込み中…</div>`; bindOwn();
  const [r,ta]=await Promise.all([sb.rpc('admin_credentials',{p_store:storeId}), sb.rpc('admin_tc_accounts',{p_store:storeId})]); if(page!=='pw') return;
  const TA={}; if(!ta.error) (ta.data||[]).forEach(x=>{ TA[x.user_id]=x; }); /* v0.73・SQL 089：タイムカード専用ID は、ログインした日時と「削除」を出す */
  if(r.error){ $('main').lastElementChild.outerHTML=`<div class="card err">${esc(r.error.message)}</div>`; return; }
  const d=r.data||{}; tcHasId=(d.devices||[]).some(x=>x.label==='タイムカード専用');
  const pwCell=pw=>pw?`<span class="pwv" data-pwv="${esc(pw)}">••••••••</span> <button class="ghost sm eye" data-show aria-label="表示"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>`:'<small class="muted">変更すると表示されます</small>';
  const O=true; // v0.21：この画面はオーナーだけ（SQL 061 で関数もオーナーだけにする）
  const row=(label,sub,key,pw,extra)=>`<tr><td>${label}${sub?`<br><small class="muted">${sub}</small>`:''}</td><td>${pwCell(pw)}</td><td style="text-align:right;white-space:nowrap">${extra||''}${O?`<button class="ghost sm" data-pw="${esc(key)}" data-label="${esc(label.replace(/<[^>]*>/g,''))}">変更</button>`:''}</td></tr>`;
  $('main').lastElementChild.outerHTML=(O?`
  <div class="card"><div class="row" style="justify-content:space-between;gap:10px;align-items:center"><div style="font-size:14px;line-height:1.7">更新されるもの：POS・タイムカードの端末／タイムカード専用ID／顧客サイト（閲覧用・編集用）<br><span class="muted">黒服が辞めた時に使います。管理サイトのIDは変わりません</span></div><button class="danger" id="rotAll" style="flex:none">全パスワード更新</button></div></div>`:'')+`
  <div class="card"><h2>今のパスワード</h2><div class="muted" style="font-size:14px;margin-bottom:6px">「変更」で、任意のパスワードに変更できます（自動作成も可）</div><table class="t">
    <tr><th>どこの</th><th>パスワード</th><th></th></tr>
    ${(d.devices||[]).map(x=>{ const t=TA[x.user_id]; return row(x.label==='タイムカード専用'?'タイムカード専用ID':`POS・タイムカード：${esc(x.label||'端末')}`,`ログイン用メール ${esc(x.email||'')}`+(t?`／ログイン：${t.last_sign_in_at?esc(fmtDT(t.last_sign_in_at)):'なし'}`:''),`dev:${x.user_id}`,x.pw,t?`<button class="ghost sm" data-tcid="${esc(x.user_id)}" data-em="${esc(x.email||'')}">削除</button> `:''); }).join('')||'<tr><td class="muted" colspan="3">POS・タイムカードの端末がありません</td></tr>'}
    ${(d.cs||[]).map(x=>row(esc(CS_KIND[x.kind]||x.kind),'',`cs:${x.kind}`,x.pw)).join('')}
    ${(d.accounts||[]).map(x=>row(`管理サイト：${esc(x.login_id)}`,esc(x.name)+(x.is_owner&&x.name!=='オーナー'?'（オーナー）':'')+(x.is_active?'':'（停止中）'),x.login_id===me.login_id?'own:':`acc:${x.id}`,x.pw)).join('')}
  </table></div>`;
  $('main').querySelectorAll('[data-tcid]').forEach(b=>b.onclick=guard(b,async()=>{ if(!await uiConfirm(`タイムカード専用ID（${b.dataset.em}）を削除しますか？\nこのIDでログインしている端末は使えなくなります`,'削除','danger')) return;
    const x=await rpc('admin_tc_account_delete',{p_user:b.dataset.tcid}); if(!x.ok) return; toast('削除しました'); PAGES.pw(); }));
  $('main').querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>{ const v=b.previousElementSibling; const on=!b.classList.contains('on'); v.textContent=on?v.dataset.pwv:'••••••••'; b.classList.toggle('on',on); b.innerHTML=on?EYEOFF:EYE; b.setAttribute('aria-label',on?'非表示':'表示'); });
  $('main').insertAdjacentHTML('beforeend','<div class="card" id="tcBox"><h2>タイムカードの端末</h2><div class="muted">読み込み中…</div></div>'); tcCard();
  if(O) $('rotAll').onclick=guard($('rotAll'),()=>rotateAll());
  $('main').querySelectorAll('[data-pw]').forEach(b=>b.onclick=()=>{ if(b.dataset.pw==='own:'){ $('myPw1').focus(); window.scrollTo(0,0); return; } changeOne(b.dataset.pw,b.dataset.label); });
};
function bindOwn(){ $('mySave').onclick=guard($('mySave'),async()=>{
  const a=$('myPw1').value, b=$('myPw2').value;
  if(a.length<8){ await uiAlert('パスワードは8文字以上にしてください'); return; }
  if(a!==b){ await uiAlert('2つのパスワードが違います'); return; }
  const r=await rpc('admin_set_own_pw',{p_pw:a}); if(!r.ok) return;
  $('myPw1').value=''; $('myPw2').value=''; toast('パスワードを変更しました'); if(page==='pw') PAGES.pw(); }); }
async function changeOne(key,label){
  const [kind,id]=[key.slice(0,key.indexOf(':')),key.slice(key.indexOf(':')+1)];
  const m=modal(`<h2 style="margin:0">パスワードの変更</h2><div>${esc(label)}</div>
    <label>新しいパスワード（8文字以上）<input data-k="pw" autocapitalize="off" spellcheck="false"></label>
    <div class="muted" style="font-size:14px">${kind==='acc'?'このIDでログインしている分はログアウトされます':'この端末・サイトでログインしている分は全部ログアウトされます'}</div>
    <div class="bar"><button class="ghost" data-k="gen">自動作成</button><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">変更</button></div>`);
  const q=k=>m.querySelector(`[data-k=${k}]`);
  q('gen').onclick=()=>{ q('pw').value=genPw(10); };
  q('no').onclick=()=>m.remove();
  q('ok').onclick=guard(q('ok'),async()=>{ const pw=q('pw').value;
    if(pw.length<8){ await uiAlert('パスワードは8文字以上にしてください'); return; }
    const r= kind==='dev'?await rpc('admin_set_device_pw',{p_user:id,p_pw:pw})
           : kind==='cs'?await rpc('admin_set_cs_pw',{p_store:storeId,p_kind:id,p_pw:pw})
           : await rpc('admin_set_account_pw',{p_id:id,p_pw:pw});
    if(!r.ok) return; m.remove(); toast('変更しました'); PAGES.pw(); });
}

kReg(PL_COLS,SLIDE_DEF,ST_BASIS,KS_COLS,BL_COLS,BL_XLS_COLS,HI_KJ);
start();
