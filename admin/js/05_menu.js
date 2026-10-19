// ---------- メニュー ----------
function renderNav(){
  const items=[...SCREENS,...(me.is_owner?OWNER_SCREENS:[])];
  let html='', pendingGrp=null;
  for(const s of items){
    if(s.grp){ pendingGrp=s.grp; continue; }
    if(!visible(s.k)||s.nav===false) continue;
    if(pendingGrp){ html+=`<div class="grp">${esc(pendingGrp)}</div>`; pendingGrp=null; }
    const p=perm(s.k), tag=(!me.is_owner&&SCREENS.some(x=>x.k===s.k)&&p==='view')?'<span class="tag">閲覧</span>':'';
    html+=`<a data-go="${s.k}" class="${s.k===page?'on':''}">${esc(s.n)}${tag}</a>`;
  }
  $('nav').innerHTML=html;
  $('nav').querySelectorAll('[data-go]').forEach(a=>a.onclick=async()=>{ $('nav').classList.remove('open'); if(!await leaveOk()) return; go(a.dataset.go); });
}
function go(k){ page=k; $('nav').querySelectorAll('[data-go]').forEach(a=>a.classList.toggle('on',a.dataset.go===(k==='set_shift'?'shift':k)));
  const f=PAGES[k]||pagePending; f(k); $('main').scrollTop=0; window.scrollTo(0,0); }
const nameOf=k=>[...SCREENS,...OWNER_SCREENS].find(s=>s.k===k)?.n||'';

