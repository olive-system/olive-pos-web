// ---------- ログイン ----------
$('loginForm').onsubmit=async e=>{ e.preventDefault(); $('loginErr').textContent='';
  const id=$('lid').value.trim().toLowerCase(), pw=$('lpw').value;
  if(!id||!pw){ $('loginErr').textContent='IDとパスワードを入力してください'; return; }
  const btn=e.submitter; if(btn) btn.disabled=true;
  try{ const { error }=await sb.auth.signInWithPassword({email:id+EMAIL_DOMAIN,password:pw});
    if(error){ $('loginErr').textContent='IDかパスワードが違います'; return; }
    $('lpw').value=''; await start(); } finally{ if(btn) btn.disabled=false; } };
$('logoutBtn').onclick=async()=>{ if(!await uiConfirm('ログアウトしますか？')) return; await sb.auth.signOut(); location.reload(); };
$('menuBtn').onclick=()=>$('nav').classList.toggle('open');
function showLogin(msg){ $('vApp').classList.add('hide'); $('vLogin').classList.remove('hide'); $('loginErr').textContent=msg||''; }

/* 戻り値：入れる人の情報／null＝止められた・パスワードが変わった（ログアウト）／undefined＝通信の失敗・ログインの期限切れ（ログアウトしない）
   オーナー 2026-10-24「同じ端末、同じブラウザなのに毎回ログイン求められるのはなぜ？」→ スリープ明けなどの失敗でログアウトしていた */
async function loadMe(){ let r=await sb.rpc('admin_me'); if(r.error){ let re=null; try{ re=(await sb.auth.refreshSession()).error; }catch(e){ re=e; } if(re&&/refresh.?token|not found|invalid|expired/i.test(re.message||'')) return null; /* ログインの記録そのものが無効 */ r=await sb.rpc('admin_me'); } if(r.error) return undefined; return r.data||null; }
async function start(){
  const { data:{ session } }=await sb.auth.getSession(); if(!session){ showLogin(); return; }
  me=await loadMe();
  if(me===undefined){ showLogin('通信を確かめています…'); clearTimeout(start.r); start.r=setTimeout(start,5000); return; }
  if(me&&!me.is_owner){ const ms=await sb.rpc('admin_my_staff'); me.staff_id=ms.error?undefined:ms.data; } /* v0.68・SQL 087：結びつけた黒服。黒服の報酬は自分の分だけ出す（関数が無い時は undefined＝今までどおり） */
  if(!me){ await sb.auth.signOut(); showLogin('このIDでは管理サイトに入れません（止められたか、パスワードが変わりました）'); return; }
  const saved=(()=>{ try{ return localStorage.getItem('olive_admin_store'); }catch(e){ return null; } })();
  storeId=me.is_owner ? (stores().some(s=>s.id===saved)?saved:stores()[0]?.id) : me.store_id;
  $('vLogin').classList.add('hide'); $('vApp').classList.remove('hide');
  $('who').textContent=`${me.name||me.login_id}（ID：${me.login_id}）`;
  renderStoreSel(); renderAll();
  clearInterval(start.t); start.t=setInterval(refreshMe,60000);
}
// 1分ごとに読み直す（止められた・パスワードが変わった時はログアウト。警告も最新にする）
async function refreshMe(){ const m=await loadMe(); if(m===undefined) return; /* 通信の失敗は次の1分でまた確かめる */ if(!m){ await sb.auth.signOut(); showLogin('ログインが切れました。再度ログインしてください'); return; } me=m; renderAlert(); }
function renderStoreSel(){
  if(me.is_owner){ $('storeSel').classList.remove('hide'); $('storeName').classList.add('hide');
    $('storeSel').innerHTML=stores().map(s=>`<option value="${s.id}" ${s.id===storeId?'selected':''}>${esc(s.name)}</option>`).join('');
    $('storeSel').onchange=async()=>{ const v=$('storeSel').value; $('storeSel').value=storeId; if(!await leaveOk()) return; $('storeSel').value=v; storeId=v; try{ localStorage.setItem('olive_admin_store',storeId); }catch(e){} renderAll(); };
  } else { $('storeSel').classList.add('hide'); $('storeName').classList.remove('hide'); $('storeName').textContent=curStore()?.name||''; }
}
function renderAll(){ kSet(curStore()?.kakari_label); renderAlert(); renderNav(); const ok=page&&visible(page); go(ok?page:firstPage()); rtSub(); }
function visible(k){ if(OWNER_SCREENS.some(s=>s.k===k)) return me.is_owner; return perm(k)!=='none'; }
function firstPage(){ return SCREENS.find(s=>s.k&&visible(s.k))?.k||(me.is_owner?'pw':'none'); }

