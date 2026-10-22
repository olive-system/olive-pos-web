// ---------- OLIVE 顧客情報へのアクセス（オーナー）v1.45・SQL 197（前は「顧客情報の共有」v0.06・SQL 048） ----------
// お客様は OLIVE の1つの名簿。「許可」の店は全部の店のお客様（基本情報・来店履歴・キープ）が見える。「しない」の店は自分の店のお客様だけ。データは消えない（オーナー 2026-10-22）
PAGES.o_share=()=>{
  const on=id=>!!me?.settings?.[id]?.cust_share;
  $('main').innerHTML=`<h1>OLIVE 顧客情報</h1>
  <div class="card"><div class="muted" style="font-size:14px;margin-bottom:8px">許可した店は、OLIVE の顧客情報（全部の店のお客様）にアクセスできます</div>
  <table class="t">${stores().map(st=>`<tr><td>${esc(st.name)}</td><td style="text-align:right"><span class="seg" data-st="${st.id}">${[[true,'許可'],[false,'しない']].map(([v,n])=>`<button data-v="${v}" class="${on(st.id)===v?'on':''}">${n}</button>`).join('')}</span></td></tr>`).join('')}</table></div>`;
  $('main').querySelectorAll('.seg').forEach(g=>g.querySelectorAll('button').forEach(b=>b.onclick=guard(b,async()=>{
    const v=b.dataset.v==='true', st=stores().find(x=>x.id===g.dataset.st); if(on(st.id)===v) return;
    if(!await uiConfirm(v?`${st.name}：OLIVE 顧客情報へのアクセスを許可しますか？`:`${st.name}：アクセスを「しない」にしますか？\n自分の店のお客様だけになります`)) return;
    const r=await rpc('admin_set_cust_share',{p_store:st.id,p_on:v}); if(!r.ok) return;
    me=await loadMe()||me; toast('保存しました'); PAGES.o_share(); })));
};
