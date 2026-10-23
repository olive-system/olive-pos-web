// ---------- 表示設定（オーナー） ----------
PAGES.o_perms=()=>{
  const s=stSet(); const perms={...(s.perms||{})}; if(!perms.pl&&(perms.pl_day||perms.pl_month)) perms.pl=perms.pl_day||perms.pl_month; if(!perms.register&&perms.register_month) perms.register=perms.register_month;
  const rows=SCREENS.filter(x=>!x.alias).map(x=>x.grp?`<tr><th colspan="2" style="padding-top:14px;color:var(--ink);font-weight:700">${esc(x.grp)}</th></tr>`
    :`<tr class="pr"><td>${esc(x.k==='set_open'?'開店作業・閉店作業':x.n)}</td><td style="text-align:right"><span class="seg" data-pk="${x.k}">${['none','view','edit'].map(v=>`<button data-v="${v}" class="${(perms[x.k]||'none')===v?'on':''}">${PERM_LABEL[v]}</button>`).join('')}</span></td></tr>`).join('');
  $('main').innerHTML=`<h1>表示設定 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  <div class="card"><h2>オーナー以外の人が使える画面</h2><div class="muted" style="font-size:14px;margin-bottom:8px">この店舗のオーナー以外の人、全員に同じ設定が使われます。オーナーはいつでも全部の画面を使えます</div>
  <table class="t perm">${rows}</table></div>
  <div class="row"><button class="primary" id="permSave">保存</button></div>`;
  $('main').querySelectorAll('.seg').forEach(g=>g.querySelectorAll('button').forEach(b=>b.onclick=()=>{ perms[g.dataset.pk]=b.dataset.v; g.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); }));
  $('permSave').onclick=guard($('permSave'),async()=>{
    const n=Number(s.nippo_days??3); // v0.40：日報登録をなくしたので「日報のさかのぼり」は出さない（前の値をそのまま送る）
    const clean={}; SCREENS.forEach(x=>{ if(x.k&&perms[x.k]&&perms[x.k]!=='none') clean[x.k]=perms[x.k]; });
    const r=await rpc('admin_save_store_settings',{p_store:storeId,p_perms:clean,p_nippo_days:n}); if(!r.ok) return;
    me=await loadMe()||me; toast('保存しました'); renderNav(); });
};

