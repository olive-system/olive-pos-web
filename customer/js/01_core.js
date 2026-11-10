// v1.33・SQL 080：店ごとの「係」の名称（stores.kakari_label。空なら「係」）。画面の「係」は KL を差し込む。見出しの一覧は kReg に入れておき、kSet で付け直す。操作ログに残す操作の名前は「係」のまま（表示の時に kl で読み替える）
'use strict';
const SUPABASE_URL='https://gjqaxenwvvazhjtziusf.supabase.co', SUPABASE_KEY='sb_publishable_pPfJUvJd6iJeHBNiD7XkWA_2RKF7JYw';
/* v1.67・SQL 380：フリガナ（カタカナで保存。ひらがな・半角で入れてもカタカナに）。検索はひらがな・カタカナどちらでも */
/* v1.32・SQL 076：管理サイトの「顧客サイト」の中で開いた時（#admin）は、パスワードを聞かずに管理サイトから入場券をもらう。この端末の顧客サイトのログインには触らない（覚えるのはこの画面の中だけ） */
/* v1.48・SQL 218：黒服マイページの中（#hall）も、パスワードを聞かずにマイページから入場券をもらう。管理サイトの中（EA）とちがい、編集は今までどおりメニューの編集パスワードで（オーナー 2026-10-23） */
const EMB=window.parent!==window&&(location.hash==='#admin'||location.hash==='#hall'), EA=EMB&&location.hash==='#admin', MEM={}; /* v1.49・SQL 227：黒服マイページの中（#hall）も管理サイトの中と同じく、編集の入場券があれば編集パスワードを聞かない（限定項目が可の黒服。オーナー 2026-10-24）。下の EA は編集・メニューの扱いで EMB にした */
/* 2026-10-24（SQL 233 と同じ考え）：ログインの記録も2つの引き出し（localStorage と IndexedDB）にしまう。片方が消えてもログインし直さずに済む。ログアウトは両方から消す（オーナー「セキュリティが守れるなら同じようにしてほしい」） */
const dualStore={ getItem:async k=>{ let v=null; try{ v=localStorage.getItem(k); }catch(e){} if(v!=null) return v; const b=await keyDb('readonly',s=>s.get(k)); if(b!=null){ try{ localStorage.setItem(k,b); }catch(e){} } return b; }, setItem:async (k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} await keyDb('readwrite',s=>s.put(v,k)); }, removeItem:async k=>{ try{ localStorage.removeItem(k); }catch(e){} await keyDb('readwrite',s=>s.delete(k)); } };
const LS0={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ v==null?localStorage.removeItem(k):localStorage.setItem(k,v); }catch(e){} keyDb('readwrite',s=>v==null?s.delete(k):s.put(v,k)); } };
const SS0={ get(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ v==null?sessionStorage.removeItem(k):sessionStorage.setItem(k,v); }catch(e){} } };

const MEMS={ get(k){ return MEM[k]??null; }, set(k,v){ if(v==null) delete MEM[k]; else MEM[k]=String(v); } }, LS=EMB?MEMS:LS0, SS=EMB?MEMS:SS0;
let embWait=null, embEdit=null, embEditExp=0, csEdit=false, csNet=false; const setRO=()=>document.documentElement.classList.toggle('ro',EMB?!embEdit:!csEdit); setRO(); /* v1.59：「編集モード」をなくした。編集用パスワードでログインした人（csEdit）はずっと編集、閲覧用でログインした人は閲覧だけ（編集のボタンを出さない）。オーナー 2026-11-02 点検 D1 */ // v1.50：券が来るまでは出さない // 管理サイトに入場券をたのむ（返事が来るまで待つ）
function embAsk(){ if(!embWait) embWait=new Promise(res=>{ const on=e=>{ if(e.origin!==location.origin||e.source!==window.parent||!e.data||e.data.type!=='olive-cs-auth') return;
    window.removeEventListener('message',on); embWait=null; const d=e.data; token=d.token||null; embEdit=d.edit_token||null; embEditExp=d.edit_expires_at?new Date(d.edit_expires_at).getTime():0; editTok=embEdit; editExp=embEditExp; setRO(); /* v1.36：管理サイトの中では、編集の入場券があれば最初から編集できる */ try{ paintEdit(); }catch(e){} res(d); };
  window.addEventListener('message',on); window.parent.postMessage({type:'olive-cs-need'},location.origin); }); return embWait; }
let token=LS.get('olive_cs_token'), editTok=SS.get('olive_cs_edit'), editExp=Number(SS.get('olive_cs_edit_exp')||0);
let boot=null, custs=[], mode='all', monthsSel=null, curId=null, cur=null;
let fInfo=null; /* v1.60・SQL 324：強化リストの上限（cap）と、お客様ごとの連絡先の人数（contacts） */
function loadFocus(){ rpc('cs_focus_info',{p_token:token}).then(x=>{ fInfo=x; if(mode==='focus') renderList(); }).catch(()=>{}); }

// ---------- 通信 ----------
class CsError extends Error{ constructor(code,msg){ super(msg||code); this.code=code; } }
async function rpc(fn,args){
  let r; try{ r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY},body:JSON.stringify(args||{})}); }
  catch(e){ throw new CsError('NET','通信できませんでした。電波の良い所で再度お試しください'); }
  const t=await r.text(); let d=null; try{ d=t?JSON.parse(t):null; }catch(e){}
  if(!r.ok){ const m=String(d&&d.message||t||''); const c=(m.match(/^(CS_[A-Z]+)/)||[])[1];
    if(c==='CS_AUTH'){ logoutLocal(); throw new CsError(c,'再度パスワードを入力してください'); }
    if(c==='CS_EDIT'){ endEdit(true); throw new CsError(c,'編集に失敗しました。再度お試しください'); } /* v1.59：編集パスワードを聞く窓は無いので、聞く文にしない */
    if(c==='CS_INPUT') throw new CsError(c,m.replace(/^CS_INPUT:/,''));
    if(c==='CS_CONFLICT') throw new CsError(c,'ほかの人が先にこのお客様を変更しました。最新の内容を読み込み直します');
    if(c==='CS_NOTFOUND') throw new CsError(c,'見つかりません（削除された可能性があります）');
    if(c==='CS_LOCKED') throw new CsError(c,'パスワードの間違いが続いたため、15分間停止しています');
    if(c==='CS_NOEDITPW') throw new CsError(c,'編集パスワードがまだ設定されていません');
    if((d&&d.code==='PGRST202')||/^Could not find the function/.test(m)) throw new CsError('SQL','準備中です（SQL 043 が未適用）'); /* v1.59：関数が本当に無い時だけ。関数の中のエラー（does not exist など）は本当の文を出す（点検 2026-11-02 B3） */
    throw new CsError('ERR',m||('エラー '+r.status)); }
  return d; }

// ---------- ダイアログ（ブラウザ標準は使わない） ----------
function sheet(html,onOpen){ return new Promise(res=>{ const m=$('modal'), s=$('sheet'); s.innerHTML=html; m.classList.add('on'); const done=v=>{ m.classList.remove('on'); s.innerHTML=''; res(v); }; onOpen(s,done); }); }
function uiConfirm(msg,ok='OK',cls='primary'){ return sheet(`<div class="msg">${esc(msg)}</div><div class="btns"><button class="ghost" data-x>キャンセル</button><button class="${cls}" data-ok>${esc(ok)}</button></div>`,(s,done)=>{ s.querySelector('[data-x]').onclick=()=>done(false); s.querySelector('[data-ok]').onclick=()=>done(true); }); }
function uiAlert(msg){ msg=jaNet(msg); return sheet(`<div class="msg">${esc(msg)}</div><div class="btns"><button class="primary" data-ok>OK</button></div>`,(s,done)=>{ s.querySelector('[data-ok]').onclick=()=>done(true); }); }
function uiPrompt(title,val='',opt={}){ return sheet(`<h3>${esc(title)}</h3><input id="pIn" ${opt.pw?'type="password" autocomplete="off"':''} value="${esc(val)}" placeholder="${esc(opt.ph||'')}"><div class="err" id="pErr"></div><div class="btns"><button class="ghost" data-x>キャンセル</button><button class="primary" data-ok>${esc(opt.ok||'OK')}</button></div>`,(s,done)=>{ const i=s.querySelector('#pIn'); setTimeout(()=>i.focus(),50); const go=()=>done(i.value); s.querySelector('[data-x]').onclick=()=>done(null); s.querySelector('[data-ok]').onclick=go; i.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); go(); } }; }); }
let toastT=0; function toast(m){ const t=$('toast'); t.textContent=m; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),2200); }
async function fail(e){ if(e&&e.code==='CS_AUTH'){ showLogin(e.message); return; } await uiAlert(e&&e.message||String(e)); }

// ---------- 画面切り替え ----------
function show(v){ ['vLogin','vList','vDetail'].forEach(x=>$(x).classList.toggle('hide',x!==v)); window.scrollTo(0,0); }
let embTry=0;
function showLogin(msg){ if(EMB){ if(++embTry>3){ show('vLogin'); $('loginErr').textContent=EA?'顧客サイトを開けません。管理サイトを読み込み直してください':'顧客サイトを開けません。マイページを開き直してください'; return; } embAsk().then(d=>{ if(d&&d.token) start(); else { show('vLogin'); $('loginErr').textContent=d&&d.error||'顧客サイトを開けません'; } }); return; } show('vLogin'); $('loginErr').textContent=msg||''; $('pw').value=''; }
function logoutLocal(){ token=null; LS.set('olive_cs_token',null); endEdit(true); csEdit=false; setRO(); boot=null; custs=[]; }
/* v1.59：ログインの期限切れ（90日など）でも、パスワードの変更でも合う文（点検 2026-11-02 B2。cs_auth はどちらも CS_AUTH を返す） */ const CS_OUT='ログインの期限切れ、またはパスワード変更のため、ログアウトしました';
async function csOut(){ try{ await rpc('cs_logout',{p_token:token}); }catch(e){} logoutLocal(); showLogin(CS_OUT); }

// ---------- ログイン ----------
$('loginForm').onsubmit=async e=>{ e.preventDefault(); const pw=$('pw').value; if(!pw){ $('loginErr').textContent='パスワードを入力してください'; return; }
  $('loginBtn').disabled=true; $('loginErr').textContent='';
  try{ const r=await rpc('cs_login',{p_pw:pw}); if(r&&r.error){ $('loginErr').textContent='パスワードが違います'; return; }
    token=r.token; LS.set('olive_cs_token',token); $('pw').value='';
    if(r.edit_token){ editTok=r.edit_token; editExp=new Date(r.expires_at).getTime(); SS.set('olive_cs_edit',editTok); SS.set('olive_cs_edit_exp',String(editExp)); csEdit=true; setRO(); } /* v1.56・SQL 311：編集用のパスワードでも入れる（オーナー 2026-11-01「どちらでも入れる」）。v1.59：知らせは出さない（モードは無い） */
    await start(); }
  catch(err){ $('loginErr').textContent=err.message; }
  finally{ $('loginBtn').disabled=false; } };

async function start(){ if(!token){ showLogin(); return; }
  try{ boot=await rpc('cs_boot',{p_token:token}); }catch(e){ if(e.code==='CS_AUTH'){ showLogin(); return; } showLogin(e.message); return; }
  kSet(boot&&boot.store&&boot.store.kakari_label);
  $('storeName').textContent=(boot.store&&boot.store.name||'')+'　顧客'; document.title=(boot.store&&boot.store.name||'OLIVE')+' 顧客';
  if(!monthsSel) monthsSel=boot.bottle_keep_months||6;
  show('vList'); if(!EMB){ const k=await csRenew(); if(k===null) return; } paintEdit(); await loadList(); rtSub(); } /* v1.59：開くたびに、編集用でログインした人か（cs_edit_renew）を確かめる */
/* v1.29・SQL 067：リアルタイム。店の設定・伝票がほかで変わったら、すぐ読み直す（入力中・確認の画面の間は読み直さない。つながらない時は1分ごとのまま） */
let rtCh=null, rtT=0;
function rtSub(){ const sid=boot&&boot.store&&boot.store.id; if(rtCh||!sid||!window.supabase) return;
  try{ const c=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,storageKey:'olive-cs-rt'}});
    rtCh=c.channel('olive:'+sid).on('broadcast',{event:'chg'},m=>{ const k=(m.payload||{}).kind; clearTimeout(rtT); rtT=setTimeout(()=>rtRefresh(k),k==='settings'?1500:2500); }).subscribe(); }catch(e){ console.warn('realtime',e); } }
async function rtRefresh(k){ if(k==='settings'){ try{ const b=await rpc('cs_boot',{p_token:token}); if(b){ boot=b; kSet(boot.store&&boot.store.kakari_label); $('storeName').textContent=(boot.store&&boot.store.name||'')+'　顧客'; document.title=(boot.store&&boot.store.name||'OLIVE')+' 顧客'; } }catch(e){} } csRefresh(false); } /* v1.53：知らせでは開いている詳細だけ読み直す（一覧の約6,000人は1分ごとの読み直しだけ。営業中に何回も読み直して重くなるため。点検 2026-10-30） */

// ---------- 編集（v1.59：モードは無い。編集用でログインした人は、裏で編集の券を取り直し続ける） ----------
function editing(){ return !!editTok&&editExp>Date.now(); }
function endEdit(silent){ editTok=null; editExp=0; SS.set('olive_cs_edit',null); SS.set('olive_cs_edit_exp',null); paintEdit(); if(!silent&&cur) renderDetail(); }
let editTimer=0;
/* v1.57・SQL 312：編集用のパスワードでログインした人は、読み直し・30分後も編集の券を出し直す。v1.59・SQL 318：返事を分ける ok＝編集用でログイン／no＝閲覧用でログイン／pw＝編集用パスワードが変更された／net＝通信の失敗／auth＝ログアウト済 */
async function editRenew(){ if(EMB||!token) return 'no'; try{ const r=await rpc('cs_edit_renew',{p_token:token}); if(r&&r.edit_token){ editTok=r.edit_token; editExp=new Date(r.expires_at).getTime(); SS.set('olive_cs_edit',editTok); SS.set('olive_cs_edit_exp',String(editExp)); return 'ok'; } return r&&r.error==='CS_EDITPW'?'pw':'no'; }catch(e){ return e&&e.code==='CS_AUTH'?'auth':'net'; } }
/* 結果を画面に当てる。編集できる時 true、閲覧だけの時 false、ログアウトした時 null */
async function csRenew(){ const k=await editRenew(); csNet=k==='net';
  if(k==='pw'||k==='auth'){ if(k==='pw') await csOut(); else showLogin(CS_OUT); return null; } /* 編集用パスワードが変更された → ログアウト（312 と同じ扱い） */
  if(k==='ok') csEdit=true; else if(k==='no'){ csEdit=false; editTok=null; editExp=0; SS.set('olive_cs_edit',null); SS.set('olive_cs_edit_exp',null); }
  setRO(); return csEdit&&editing(); }
function paintEdit(){
  if(EMB){ clearTimeout(editTimer); if(embEdit) editTimer=setTimeout(async()=>{ if(embEditExp<Date.now()+120000){ try{ await embAsk(); }catch(e){} } paintEdit(); },30000); return; } // 管理サイトの中：帯は出さず、期限が近づいたら入場券を取り直す
  clearTimeout(editTimer); if(token) editTimer=setTimeout(async()=>{ if(token&&(csEdit?editExp<Date.now()+120000:csNet)&&await csRenew()===null) return; paintEdit(); },30000); } /* 編集用：切れる2分前に取り直す。通信の失敗で決まらなかった時も取り直す */
async function needEdit(){ if(editing()) return true;
  if(EMB){ let d=null; if(!embEdit||embEditExp<Date.now()+60000) d=await embAsk(); if(embEdit&&embEditExp>Date.now()){ editTok=embEdit; editExp=embEditExp; paintEdit(); return true; }
    await uiAlert(d&&d.error||'顧客サイトを編集する権限がありません'); return false; } // 編集モードは普通の時と同じ30分
  const k=await csRenew(); if(k) return true; if(k===false&&csNet) await uiAlert('通信できませんでした。電波の良い所で再度お試しください'); return false; } /* v1.59：編集パスワードを聞く窓は出さない（閲覧用でログインした人には編集のボタン自体を出さない） */

if(EMB) $('menuBtn').style.display='none'; /* v1.42：管理サイトの中ではメニューを出さない（中身が無いため。オーナー 2026-10-14） */
$('menuBtn').onclick=()=>sheet(`<button class="xb dx" data-x aria-label="閉じる">×</button><h3>メニュー</h3><div style="display:flex;flex-direction:column;gap:8px">${EMB?'':'<button class="ghost" data-a="out" style="color:var(--warn)">ログアウト</button>'}</div>`,(s,done)=>{
  s.querySelector('[data-x]').onclick=()=>done(); s.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{ const a=b.dataset.a; done();
    if(a==='reload') await loadList(); /* v1.59：「編集パスワードを入力」「編集モードを終了」は外した */
    else if(a==='out'){ if(!await uiConfirm('ログアウトしますか？\n次に開く時はパスワードが必要です。','ログアウト','danger')) return; try{ await rpc('cs_logout',{p_token:token}); }catch(e){} logoutLocal(); showLogin(); } }); });

