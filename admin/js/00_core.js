const FX=(n,px=18)=>`<img src="../icons/${n}.svg" alt="" style="width:${px}px;height:${px}px;vertical-align:-3px">`; /* 絵文字の代わり（Firefox の絵柄。オーナー 2026-10-18） */
// v0.57・SQL 080：店ごとの「係」の名称（stores.kakari_label。空なら「係」）。画面の「係」は KL を差し込む。見出しの一覧は kReg に入れておき、kSet で付け直す。操作ログに残す操作の名前は「係」のまま（表示の時に kl で読み替える）
let KL='係'; const kl=s=>KL==='係'?s:String(s??'').replace(/係/g,KL); const actL=a=>kl(a==='伝票取消'?'伝票削除':a); /* v0.64：操作ログの「伝票取消」は「伝票削除」と表示（記録の名前は変えない） */ const KT=[];
function kReg(...os){ const walk=o=>{ for(const k of Object.keys(o)){ const v=o[k]; if(typeof v==='string'){ if(v.includes('係')) KT.push([o,k,v]); } else if(v&&typeof v==='object') walk(v); } }; os.forEach(walk); }
function kSet(v){ KL=(v&&String(v).trim())||'係'; KT.forEach(([o,k,v])=>{ o[k]=kl(v); }); }
document.addEventListener('click',e=>{ const q=e.target.closest&&e.target.closest('.hint .qm'); if(q){ e.preventDefault(); e.stopPropagation(); q.closest('.hint').classList.toggle('open'); } },true); /* 15番：「？」で詳しい説明を開く・閉じる */
const SUPABASE_URL='https://gjqaxenwvvazhjtziusf.supabase.co', SUPABASE_KEY='sb_publishable_pPfJUvJd6iJeHBNiD7XkWA_2RKF7JYw';
// POS・タイムカードと同じサイト上にあるので、ログイン情報は別の場所にしまう（POSのログインを横取りしない）
/* 2026-10-24（SQL 233 と同じ考え）：ログインの記録も2つの引き出し（localStorage と IndexedDB）にしまう。片方が消えてもログインし直さずに済む。ログアウトは両方から消す（オーナー「セキュリティが守れるなら同じようにしてほしい」） */
const keyDb=(mode,fn)=>new Promise(res=>{ try{ const r=indexedDB.open('olive_keys',1); r.onupgradeneeded=()=>{ r.result.createObjectStore('k'); }; r.onsuccess=()=>{ try{ const tx=r.result.transaction('k',mode), q=fn(tx.objectStore('k')); tx.oncomplete=()=>res(q&&q.result!=null?q.result:null); tx.onerror=()=>res(null); }catch(e){ res(null); } }; r.onerror=()=>res(null); }catch(e){ res(null); } });
const dualStore={ getItem:async k=>{ let v=null; try{ v=localStorage.getItem(k); }catch(e){} if(v!=null) return v; const b=await keyDb('readonly',s=>s.get(k)); if(b!=null){ try{ localStorage.setItem(k,b); }catch(e){} } return b; }, setItem:async (k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} await keyDb('readwrite',s=>s.put(v,k)); }, removeItem:async k=>{ try{ localStorage.removeItem(k); }catch(e){} await keyDb('readwrite',s=>s.delete(k)); } };
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:'olive-admin-auth',storage:dualStore}});
const EMAIL_DOMAIN='@admin.olive.local';
const $=id=>document.getElementById(id);
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function toast(m){ const t=$('toast'); t.textContent=m; t.classList.add('on'); clearTimeout(toast.h); toast.h=setTimeout(()=>t.classList.remove('on'),2000); }
function guard(btn,fn){ return async(...a)=>{ if(btn.disabled) return; btn.disabled=true; try{ await fn(...a); } finally{ btn.disabled=false; } }; }
function modal(html){ const m=document.createElement('div'); m.className='modal'; m.innerHTML=`<div class="box">${html}</div>`; document.body.appendChild(m); return m; }
function uiAlert(msg){ return new Promise(res=>{ const m=modal(`<div style="white-space:pre-wrap">${esc(msg)}</div><div class="bar"><button class="primary" data-k="ok">OK</button></div>`); m.querySelector('[data-k=ok]').onclick=()=>{ m.remove(); res(); }; }); }
function uiConfirm(msg,okLabel='OK',cls='primary'){ return new Promise(res=>{ const m=modal(`<div style="white-space:pre-wrap">${esc(msg)}</div><div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="${cls}" data-k="ok">${esc(okLabel)}</button></div>`); m.querySelector('[data-k=no]').onclick=()=>{ m.remove(); res(false); }; m.querySelector('[data-k=ok]').onclick=()=>{ m.remove(); res(true); }; }); }
/* v0.86：表を横に流しても、左の列（No・状態・営業日・お客様・係）は動かさない。どの伝票の行かがわかるように */
function stickCols(tb,n){ if(!tb) return; const hr=tb.querySelector('tr'); if(!hr) return; const L=[]; let x=0; [...hr.children].slice(0,n).forEach(c=>{ L.push(x); x+=c.getBoundingClientRect().width; });
  tb.querySelectorAll('tr').forEach(tr=>[...tr.children].slice(0,n).forEach((c,i)=>{ c.style.position='sticky'; c.style.left=L[i]+'px'; c.style.zIndex='1'; c.style.background='var(--card)'; if(i===n-1) c.style.borderRight='1px solid var(--line)'; })); }
/* v0.86：開いたままのタブでも、新しい版が出たら知らせる（古い版のままで見ていて、並びが違って見えたため） */
const MY_VER=(document.head.innerHTML.match(/admin (v[\d.]+)/)||[])[1]||'';
async function verCheck(){ try{ const h=await fetch(location.pathname+'?v='+Date.now(),{cache:'no-store'}).then(r=>r.text()); const v=(h.match(/admin (v[\d.]+)/)||[])[1]; if(v&&MY_VER&&v!==MY_VER&&!document.getElementById('verBar')){
  const b=document.createElement('div'); b.id='verBar'; b.style.cssText='position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:60;background:var(--head);color:#fff;border-radius:12px;padding:10px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,.25)';
  b.innerHTML='<span>新しい版があります</span><button class="primary sm" id="verGo" style="background:var(--brand);color:#fff">更新</button>'; document.body.appendChild(b); $('verGo').onclick=()=>location.reload(); } }catch(e){} }
setInterval(verCheck,60000); document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') verCheck(); });
async function rpc(fn,args){ rtOwn=Date.now(); const r=await sb.rpc(fn,args||{}); rtOwn=Date.now(); if(r.error){ await uiAlert(r.error.message); return {ok:false}; } return {ok:true,data:r.data}; }
function genPw(n=10){ const c='abcdefghjkmnpqrstuvwxyz23456789'; const a=crypto.getRandomValues(new Uint8Array(n)); return [...a].map(x=>c[x%c.length]).join(''); }
const fmtDT=t=>t?new Date(t).toLocaleString('ja-JP',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';

