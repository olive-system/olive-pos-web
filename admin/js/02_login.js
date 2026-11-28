// ---------- ログイン ----------
$('loginForm').onsubmit=async e=>{ e.preventDefault(); $('loginErr').textContent='';
  const id=$('lid').value.trim().toLowerCase(), pw=$('lpw').value;
  if(!id||!pw){ $('loginErr').textContent='IDとパスワードを入力してください'; return; }
  const btn=e.submitter; if(btn) btn.disabled=true;
  try{ let error=null; try{ ({ error }=await sb.auth.signInWithPassword({email:id+EMAIL_DOMAIN,password:pw})); }catch(ex){ error=ex||{}; }
    if(error){ $('loginErr').textContent=loginErrText(error); return; }
    $('lpw').value=''; await start(); } finally{ if(btn) btn.disabled=false; } };
/* （点検 B1）：通信の失敗・回数の制限でも「IDかパスワードが違います」と出ていた → 原因ごとに出す */
function loginErrText(e){ const st=Number(e?.status||0), c=String(e?.code||''), m=String(e?.message||'');
  if(st===429||/rate_limit/.test(c)||/rate limit/i.test(m)) return 'ログインの回数が多いため、しばらく待ってから再度お試しください';
  if(c==='invalid_credentials'||/invalid login credentials/i.test(m)) return 'IDかパスワードが違います';
  if(!st||st>=500||e?.name==='AuthRetryableFetchError'||/fetch|network/i.test(m)) return '通信できませんでした。再度お試しください';
  return 'ログインに失敗しました。再度お試しください'; }
$('logoutBtn').onclick=async()=>{ if(!await uiConfirm('ログアウトしますか？')) return; await sb.auth.signOut(); location.reload(); };
$('menuBtn').onclick=()=>$('nav').classList.toggle('open');
function adminShowLogin(msg){ clearInterval(start.t); start.t=null; /* ログインの画面の間は1分ごとの確かめを止める（ログインが切れたタブが毎分 admin_me を呼び続けていた） */ $('vApp').classList.add('hide'); $('vLogin').classList.remove('hide'); $('loginErr').textContent=msg||''; }

/* 戻り値：入れる人の情報／null＝止められた・パスワードが変わった（ログアウト）／undefined＝通信の失敗・ログインの期限切れ（ログアウトしない）
   オーナー「同じ端末、同じブラウザなのに毎回ログイン求められるのはなぜ？」→ スリープ明けなどの失敗でログアウトしていた */
async function loadMe(){ loadMe.out=false; let r=await sb.rpc('admin_me'); if(r.error){ let re=null; try{ re=(await sb.auth.refreshSession()).error; }catch(e){ re=e; } if(re&&/refresh.?token|not found|invalid|expired/i.test(re.message||'')) return null; /* ログインの記録そのものが無効 */ r=await sb.rpc('admin_me'); } if(r.error&&r.status===401){ loadMe.out=true; return null; } /* 読み直した後も 401＝ログインが切れた（通信の失敗とは分ける。前は「通信の失敗」として5秒・1分ごとに読み続けた） */ if(r.error) return undefined; const m=r.data||null;
  /* オーナー以外：連携した黒服（自分の報酬だけ出す）と黒服報酬「全員」か（SQL 662）。1分ごとの読み直しでも消えないように、ここで一緒に読む（関数が無い時は undefined＝今までどおり） */
  if(m&&!m.is_owner){ const [ms,pa]=await Promise.all([sb.rpc('admin_my_staff'),sb.rpc('admin_hall_pay_all')]); m.staff_id=ms.error?undefined:ms.data; m.pay_all=!pa.error&&pa.data===true; }
  return m; }
async function start(){
  const { data:{ session } }=await sb.auth.getSession(); if(!session){ adminShowLogin(); return; }
  me=await loadMe();
  if(me===undefined){ adminShowLogin('通信を確認しています…'); clearTimeout(start.r); start.r=setTimeout(start,5000); return; }
  if(!me){ await sb.auth.signOut(); adminShowLogin(loadMe.out?'ログインが切れました。再度ログインしてください':'このIDでは管理サイトにログインできません（停止中か、パスワードが変更されました）'); return; }
  const saved=(()=>{ try{ return localStorage.getItem('olive_admin_store'); }catch(e){ return null; } })();
  storeId=me.is_owner ? (stores().some(s=>s.id===saved)?saved:stores()[0]?.id) : me.store_id;
  $('vLogin').classList.add('hide'); $('vApp').classList.remove('hide');
  $('who').textContent=`${me.name||me.login_id}（ID：${me.login_id}）`;
  renderStoreSel(); renderAll();
  clearInterval(start.t); start.t=setInterval(refreshMe,60000);
}
// 1分ごとに読み直す（止められた・パスワードが変わった時はログアウト。警告も最新にする）
/* 画面が見えていない時（裏のタブ・画面オフ）は読まない。開きっぱなしのタブが1分ごとに読み、データベースのメモリを使っていた。画面に戻った時にすぐ読む */
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&start.t) refreshMe(); });
async function refreshMe(){ if(document.visibilityState!=='visible') return; const m=await loadMe(); if(m===undefined) return; /* 通信の失敗は次の1分でまた確かめる */ if(!m){ await sb.auth.signOut(); adminShowLogin('ログインが切れました。再度ログインしてください'); return; } me=m; renderAlert(); }
function renderStoreSel(){
  if(me.is_owner){ $('storeSel').classList.remove('hide'); $('storeName').classList.add('hide');
    $('storeSel').innerHTML=stores().map(s=>`<option value="${s.id}" ${s.id===storeId?'selected':''}>${esc(s.name)}</option>`).join('');
    $('storeSel').onchange=async()=>{ const v=$('storeSel').value; $('storeSel').value=storeId; if(!await leaveOk()) return; $('storeSel').value=v; storeId=v; try{ localStorage.setItem('olive_admin_store',storeId); }catch(e){} renderAll(); };
  } else { $('storeSel').classList.add('hide'); $('storeName').classList.remove('hide'); $('storeName').textContent=curStore()?.name||''; }
}
function renderAll(){ kSet(curStore()?.kakari_label); renderAlert(); renderNav(); const ok=page&&visible(page); go(ok?page:firstPage()); rtSub(); }

