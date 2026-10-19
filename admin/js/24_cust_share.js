// ---------- 顧客情報の共有（オーナー）v0.06・SQL 048 ----------
// 「共有する」にした店舗どうしで、お客様の基本情報・来店履歴・キープ中のボトル（閲覧のみ）を見せ合う。「しない」に戻してもデータは消えない
PAGES.o_share=()=>{
  const on=id=>!!me?.settings?.[id]?.cust_share;
  $('main').innerHTML=`<h1>顧客情報の共有</h1>
  <div class="card"><div class="muted hint" style="font-size:14px;margin-bottom:8px">「共有する」にした店舗どうしで、お客様の情報を見せ合います<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">「共有する」にした店舗どうしで、お客様の基本情報（閲覧・編集）・来店履歴・キープ中のボトル（閲覧のみ）を共有します。${KL}はそれぞれの店舗で決めます。<br>「しない」に戻しても、データは消えません（ほかの店舗から見えなくなるだけです）</div></div>
  <table class="t">${stores().map(st=>`<tr><td>${esc(st.name)}</td><td style="text-align:right"><span class="seg" data-st="${st.id}">${[[true,'共有する'],[false,'しない']].map(([v,n])=>`<button data-v="${v}" class="${on(st.id)===v?'on':''}">${n}</button>`).join('')}</span></td></tr>`).join('')}</table></div>`;
  $('main').querySelectorAll('.seg').forEach(g=>g.querySelectorAll('button').forEach(b=>b.onclick=guard(b,async()=>{
    const v=b.dataset.v==='true', st=stores().find(x=>x.id===g.dataset.st); if(on(st.id)===v) return;
    if(!await uiConfirm(v?`${st.name} の顧客情報を「共有する」にしますか？\n「共有する」のほかの店舗から見えるようになります`:`${st.name} の顧客情報を「しない」にしますか？\nデータは消えません。ほかの店舗から見えなくなります`)) return;
    const r=await rpc('admin_set_cust_share',{p_store:st.id,p_on:v}); if(!r.ok) return;
    me=await loadMe()||me; toast('保存しました'); PAGES.o_share(); })));
};

