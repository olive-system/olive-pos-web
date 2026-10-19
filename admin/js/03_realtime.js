// ---------- リアルタイム v0.26・SQL 067：この店の設定・伝票がほかで変わったら、今の画面を読み直す ----------
// 入力の途中・確認の画面が出ている時は読み直さず、上に「最新にする」を出す。自分で保存した直後（5秒）は読み直さない。つながらない時も、これまでどおり使える
let rtCh=null, rtSt=null, rtT=0, rtOwn=0, mainDirty=false, rtWait=false;
const RT_SKIP=new Set(['o_perms','o_share','o_ids','pw','none','cust']); // v0.37：顧客サイトは中の画面が自分で読み直す
function rtSub(){ if(rtCh&&rtSt===storeId) return; if(rtCh){ sb.removeChannel(rtCh); rtCh=null; } rtSt=storeId; if(!storeId) return;
  try{ rtCh=sb.channel('olive:'+storeId).on('broadcast',{event:'chg'},m=>rtKick(m.payload)).subscribe(); }catch(e){ console.warn('realtime',e); } }
function rtKick(p){ if(!page||RT_SKIP.has(page)) return; clearTimeout(rtT); rtT=setTimeout(rtRefresh,p?.kind==='bill'?4000:1200); }
function rtBar(on){ let b=$('rtBar'); if(!on){ if(b) b.remove(); return; } if(b) return; b=document.createElement('div'); b.id='rtBar'; b.className='alertbar'; b.style.cssText='position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:40;background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.2)';
  b.innerHTML='<span>ほかで変更がありました</span><button class="primary sm">最新にする</button>'; document.body.appendChild(b); b.querySelector('button').onclick=()=>{ mainDirty=false; rtBar(false); rtRefresh(true); }; }
const RT_HEAVY=new Set(['summary','pl','cast_sales']); // v0.63：重い集計は自動で読み直さない（営業中に POS まで遅くなるため）。「最新にする」を出す
function rtRefresh(force){ if(!page||RT_SKIP.has(page)||!PAGES[page]) return;
  if(!force&&RT_HEAVY.has(page)){ if(Date.now()-rtOwn>=5000) rtBar(true); return; }
  if(document.visibilityState!=='visible'){ rtWait=true; return; }
  if(!force&&Date.now()-rtOwn<5000){ rtT=setTimeout(rtRefresh,5000); return; }
  if(!force&&(mainDirty||document.querySelector('.modal')||(page==='set_cast'&&csDetail))){ rtBar(true); return; }
  rtBar(false); $('siBox')?.removeAttribute('data-st'); const y=window.scrollY, my=$('main').scrollTop; if(page==='set_cast'&&csDetail) csDetail=null;
  Promise.resolve(PAGES[page](page)).then(()=>{ window.scrollTo(0,y); $('main').scrollTop=my; }).catch(e=>console.warn('refresh',e)); }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&rtWait){ rtWait=false; rtRefresh(); } });
$('main').addEventListener('input',()=>{ mainDirty=true; }); $('main').addEventListener('change',()=>{ mainDirty=true; });
// v1.22：保存忘れのお知らせ（オーナー 2026-10-17「編集したのに保存を押し忘れて次に行こうとした時に、保存してないけど進みますか、すぐ保存できるポップアップ」）
// 入力を変えた所の近くに「保存」ボタンがあれば、それを覚える。保存して画面が描き直されるとボタンが消える＝保存済み。月や店の切り替えの選択は数えない
let unsavedBtn=null;
const UNSAVED_SKIP=/^(plM|shM|ssM|csM|smM|ntM|stM|cuM|plDate)$/;
function unsavedMark(e){ const t=e.target; if(!t||t.closest('.modal')||UNSAVED_SKIP.test(t.id||'')||t.dataset?.nodirty!=null) return; if(t.type==='search') return;
  let el=t.parentElement; while(el&&el!==$('main')){ const b=[...el.querySelectorAll('button')].find(x=>/^保存$/.test(x.textContent.trim())); if(b){ unsavedBtn=b; return; } el=el.parentElement; } }
$('main').addEventListener('input',unsavedMark,true); $('main').addEventListener('change',unsavedMark,true);
const unsavedNow=()=>!!(unsavedBtn&&unsavedBtn.isConnected&&!unsavedBtn.disabled);
async function leaveOk(){ if(!unsavedNow()) return true;
  const ans=await new Promise(res=>{ const m=modal(`<h2 style="margin:0">保存していない変更があります</h2>
      <div style="display:flex;flex-direction:column;gap:8px"><button class="primary" data-v="save">保存して進む</button><button class="ghost" data-v="go">保存せずに進む</button><button class="ghost" data-v="" style="border:none;color:var(--muted)">戻る</button></div>`);
    m.querySelectorAll('button').forEach(b=>b.onclick=()=>{ m.remove(); res(b.dataset.v); }); });
  if(!ans) return false;
  if(ans==='go'){ unsavedBtn=null; return true; }
  const b=unsavedBtn; b.click();
  // 保存が終わるのを待つ（確認の小窓は人が押す）。ボタンが消えたら保存済み。小窓が無いのにボタンが残ったら、保存できなかった
  for(let i=0,idle=0;i<1200;i++){ await new Promise(r=>setTimeout(r,100)); if(!b.isConnected){ unsavedBtn=null; return true; } if(document.querySelector('.modal')||b.disabled) idle=0; else if(++idle>15) return false; }
  return false; }
window.addEventListener('beforeunload',e=>{ if(unsavedNow()){ e.preventDefault(); e.returnValue=''; } });
new MutationObserver(()=>{ mainDirty=false; rtBar(false); }).observe($('main'),{childList:true});

