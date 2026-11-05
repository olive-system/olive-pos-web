// v2.13・SQL 370：集計「商品集計」。注文集計（その月に会計した伝票の注文を、カテゴリー・商品ごとに数と注文額）と棚卸し（33_ab_stock.js。オーナーのみ）をタブで切り替え
// オーナー 2026-11-05「棚卸しがオーナーの欄に出てきてしまっているけど、これは集計になるんじゃない。商品集計を作って、棚卸しと、その月に出た商品の集計を出して」・見本 作業場/商品集計_案1.png
// 並びは現金管理（見出し → 切り替え → カード）。棚卸しのタブはオーナー以外には出さない（オーナー以外はタブ自体を出さない）
let psMonth=null;
const psHead=k=>`<h1>商品集計 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`+(me?.is_owner?`<div class="row" style="margin-bottom:14px"><span class="seg">${[['product_sum','注文集計'],['o_stock','棚卸し']].map(([v,n])=>`<button data-ps="${v}" class="${k===v?'on':''}">${n}</button>`).join('')}</span></div>`:'');
document.addEventListener('click',async e=>{ const b=e.target.closest('[data-ps]'); if(!b||b.dataset.ps===page||!await leaveOk()) return; go(b.dataset.ps); });
PAGES.product_sum=async()=>{ const st=storeId, now=csNowMonth(); if(!psMonth) psMonth=now; const m=psMonth, mOpts=Array.from({length:13},(_,i)=>csAddMonth(now,-i));
  $('main').innerHTML=psHead('product_sum')+`<div class="card"><select id="psM" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel(x)}</option>`).join('')}</select><div id="psBox" class="muted" style="margin-top:10px">読み込み中…</div></div>`;
  $('psM').onchange=()=>{ psMonth=$('psM').value; PAGES.product_sum(); };
  const r=await sb.rpc('admin_product_sales',{p_store:st,p_month:m}); if(page!=='product_sum'||storeId!==st||psMonth!==m) return;
  if(r.error){ $('psBox').innerHTML=`<span class="err">${esc(/admin_product_sales/.test(r.error.message)?'SQL 370 が未実行です：':'読み込めません：')}${esc(r.error.message)}</span>`; return; }
  const L=r.data||[], R='style="text-align:right;font-variant-numeric:tabular-nums"'; $('psBox').className='';
  if(!L.length){ $('psBox').innerHTML='<div class="muted">この月の注文はありません</div>'; return; }
  const cats=[...new Set(L.map(x=>x.cat))];
  $('psBox').innerHTML=`<table class="t"><tr><th>商品</th><th ${R}>数</th><th ${R}>注文額</th></tr>${cats.map(c=>`<tr><td colspan="3" style="font-weight:700;padding-top:14px">${esc(c)}</td></tr>${L.filter(x=>x.cat===c).map(x=>`<tr><td>${esc(x.name)}</td><td ${R}>${Number(x.qty)}</td><td ${R}>${yen(x.amount)}</td></tr>`).join('')}`).join('')}
    <tr style="font-weight:700"><td>合計</td><td ${R}>${L.reduce((a,x)=>a+Number(x.qty),0)}</td><td ${R}>${yen(L.reduce((a,x)=>a+Number(x.amount),0))}</td></tr></table><div class="muted" style="font-size:13px;margin-top:6px">会計済の伝票の注文です（取消は除く）</div>`;
};
