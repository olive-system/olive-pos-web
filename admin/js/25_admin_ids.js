// ---------- 管理サイトのID（オーナー） ----------
PAGES.o_ids=async()=>{
  $('main').innerHTML=`<h1>管理サイトのID</h1><div class="card muted">読み込み中…</div>`;
  const [ra,rh]=await Promise.all([sb.rpc('admin_accounts_list'),sb.rpc('admin_hall_staff',{p_store:storeId})]);
  if(page!=='o_ids') return;
  if(ra.error||rh.error){ $('main').innerHTML=`<h1>管理サイトのID</h1><div class="card err">${esc((ra.error||rh.error).message)}</div>`; return; }
  const halls=rh.data||[], sName=id=>stores().find(s=>s.id===id)?.name||'';
  const list=(ra.data||[]).filter(a=>a.is_owner||a.store_id===storeId);
  $('main').innerHTML=`<h1>管理サイトのID <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  <div class="card"><h2>IDの一覧</h2><table class="t"><tr><th>ID</th><th>名前</th><th>店舗</th><th>黒服</th><th>状態</th><th></th></tr>
  ${list.map(a=>`<tr><td><b>${esc(a.login_id)}</b></td><td>${esc(a.name)}</td><td>${a.is_owner?'全店舗':esc(sName(a.store_id))}</td><td>${esc(a.staff_name||'—')}</td>
    <td>${a.is_owner?'<span class="badge">オーナー</span>':a.is_active?'使える':'<span class="badge gray">停止中</span>'}</td>
    <td style="text-align:right">${a.is_owner?'':`<button class="ghost sm" data-ed="${a.id}">変更</button>`}</td></tr>`).join('')}
  </table></div>
  <div class="card"><h2>IDの作成</h2>
    <div class="grid2">
      <label>ID（半角の小文字・数字 3〜20文字）<input id="nId" autocapitalize="off" spellcheck="false"></label>
      <label>黒服と連携<select id="nStaff"><option value="">連携なし</option>${halls.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></label>
      <label id="nNameBox">名前<input id="nName"></label>
      <label>最初のパスワード（8文字以上）<input id="nPw" autocapitalize="off" spellcheck="false"></label>
    </div>
    <div class="row" style="margin-top:10px"><button class="ghost" id="nGen">パスワードを自動作成</button><button class="primary" id="nSave">作成</button></div>
    <div class="muted hint" style="font-size:14px;margin-top:8px">黒服と連携すると、POSでその黒服を削除した時に、このIDも自動で使えなくなります<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">店舗は上で選んでいる「${esc(curStore()?.name||'')}」になります</div></div>
  </div>`;
  $('nGen').onclick=()=>{ $('nPw').value=genPw(10); };
  /* 黒服を選んだら、名前はその黒服の名前（名前の枠は「結びつけない」の時だけ。オーナー） */
  const nSync=()=>{ $('nNameBox').style.display=$('nStaff').value?'none':''; }; $('nStaff').onchange=nSync; nSync();
  $('nSave').onclick=guard($('nSave'),async()=>{
    const id=$('nId').value.trim().toLowerCase(), pw=$('nPw').value;
    if(!/^[a-z0-9_-]{3,20}$/.test(id)){ await uiAlert('IDは半角の小文字・数字で3〜20文字にしてください'); return; }
    if(pw.length<8){ await uiAlert('パスワードは8文字以上にしてください'); return; }
    const r=await rpc('admin_account_create',{p_login:id,p_pw:pw,p_name:$('nStaff').value?(halls.find(h=>h.id===$('nStaff').value)?.name||''):$('nName').value.trim(),p_store:storeId,p_staff:$('nStaff').value||null}); if(!r.ok) return;
    await uiAlert(`IDを作成しました\n\nID：${id}\nパスワード：${pw}\n\n本人に伝えてください`); PAGES.o_ids(); });
  $('main').querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>editAccount(list.find(a=>a.id===b.dataset.ed),halls));
};
async function editAccount(a,halls){ if(!a) return;
  const m=mkModal(null,`<h2 style="margin:0">IDの変更：${esc(a.login_id)}</h2>
    <label>名前<input data-k="name" value="${esc(a.name)}"></label>
    <label>黒服と連携<select data-k="staff"><option value="">連携なし</option>${halls.map(h=>`<option value="${h.id}" ${h.id===a.staff_id?'selected':''}>${esc(h.name)}</option>`).join('')}${a.staff_id&&!halls.some(h=>h.id===a.staff_id)?`<option value="${a.staff_id}" selected>${esc(a.staff_name||'（削除済の黒服）')}</option>`:''}</select></label>
    <label>状態<select data-k="active"><option value="1" ${a.is_active?'selected':''}>使える</option><option value="0" ${a.is_active?'':'selected'}>停止（ログイン不可）</option></select></label>
    <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  const q=k=>m.querySelector(`[data-k=${k}]`);
  q('no').onclick=()=>m.remove();
  q('ok').onclick=guard(q('ok'),async()=>{ const act=q('active').value==='1';
    if(a.is_active&&!act&&!await uiConfirm(`「${a.login_id}」を停止します。ログイン中でもすぐに使えなくなります`,'停止','danger')) return;
    const r=await rpc('admin_account_update',{p_id:a.id,p_name:q('name').value.trim(),p_staff:q('staff').value||null,p_active:act}); if(!r.ok) return;
    m.remove(); toast('保存しました'); PAGES.o_ids(); });
}

