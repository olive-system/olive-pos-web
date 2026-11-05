// ---------- メニュー ----------
function renderNav(){
  const items=[...SCREENS,...(me.is_owner?OWNER_SCREENS:[])];
  let html='', pendingGrp=null;
  for(const s of items){
    if(s.grp){ pendingGrp=s.grp; continue; }
    if(!(visible(s.k)||(s.k==='register'&&visible('hist_cash')))||s.nav===false) continue; /* v2.16：入出金履歴だけ見られる人にも現金管理を出す */
    if(pendingGrp){ html+=`<div class="grp">${esc(pendingGrp)}</div>`; pendingGrp=null; }
    const p=s.k==='register'&&!visible('register')?perm('hist_cash'):perm(s.k), tag=(!me.is_owner&&SCREENS.some(x=>x.k===s.k)&&p==='view')?'<span class="tag">閲覧</span>':'';
    html+=`<a data-go="${s.k}" class="${s.k===page?'on':''}">${esc(s.n)}${tag}</a>`;
  }
  $('nav').innerHTML=html;
  $('nav').querySelectorAll('[data-go]').forEach(a=>a.onclick=async()=>{ $('nav').classList.remove('open'); if(!await leaveOk()) return; go(a.dataset.go); });
}
function go(k){ if(k==='register'&&!visible('register')&&visible('hist_cash')) k='hist_cash'; page=k; $('nav').querySelectorAll('[data-go]').forEach(a=>a.classList.toggle('on',a.dataset.go===((k==='set_shift'||k==='resv')?'shift':k==='o_stock'?'product_sum' /* v2.13 */:k==='hist_cash'?'register' /* v2.16 */:(typeof ownerGroupOf==='function'&&ownerGroupOf(k))||k)));
  const f=PAGES[k]||pagePending; f(k); $('main').scrollTop=0; window.scrollTo(0,0); }
const nameOf=k=>[...SCREENS,...OWNER_SCREENS].find(s=>s.k===k)?.n||'';

