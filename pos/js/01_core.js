const FX=(n,px=18)=>`<img src="../icons/${n}.svg" alt="" style="width:${px}px;height:${px}px;vertical-align:-3px">`; /* 絵文字の代わり（Firefox の絵柄。オーナー 2026-10-18） */
// v11.25・SQL 080：店ごとの「係」の名称（stores.kakari_label。空なら「係」）。画面の「係」は KL を差し込む。見出しの一覧は kReg に入れておき、kSet で付け直す。操作ログに残す操作の名前は「係」のまま（表示の時に kl で読み替える）
let KL='係'; const kl=s=>KL==='係'?s:String(s??'').replace(/係/g,KL); const actL=a=>kl(a==='伝票取消'?'伝票削除':a); /* v11.28：操作ログの「伝票取消」は「伝票削除」と表示（記録の名前は変えない） */ const KT=[];
function kReg(...os){ const walk=o=>{ for(const k of Object.keys(o)){ const v=o[k]; if(typeof v==='string'){ if(v.includes('係')) KT.push([o,k,v]); } else if(v&&typeof v==='object') walk(v); } }; os.forEach(walk); }
function kSet(v){ KL=(v&&String(v).trim())||'係'; KT.forEach(([o,k,v])=>{ o[k]=kl(v); }); }
function kDom(){ const a=$('castAddBtn'); if(a) a.textContent='＋ '+KL+'／同伴'; const t=$('castAddTtl'); if(t) t.textContent=KL+'／同伴を追加'; const c=document.querySelector('#castRole [data-cr=kakari]'); if(c) c.textContent=KL; }
document.addEventListener('click',e=>{ const q=e.target.closest&&e.target.closest('.hint .qm'); if(q){ e.preventDefault(); e.stopPropagation(); q.closest('.hint').classList.toggle('open'); } },true); /* 15番：「？」で詳しい説明を開く・閉じる */
const SUPABASE_URL='https://gjqaxenwvvazhjtziusf.supabase.co', SUPABASE_KEY='sb_publishable_pPfJUvJd6iJeHBNiD7XkWA_2RKF7JYw';
/* 2026-10-24（SQL 233 と同じ考え）：ログインの記録も2つの引き出し（localStorage と IndexedDB）にしまう。片方が消えてもログインし直さずに済む。ログアウトは両方から消す（オーナー「セキュリティが守れるなら同じようにしてほしい」） */
const keyDb=(mode,fn)=>new Promise(res=>{ try{ const r=indexedDB.open('olive_keys',1); r.onupgradeneeded=()=>{ r.result.createObjectStore('k'); }; r.onsuccess=()=>{ try{ const tx=r.result.transaction('k',mode), q=fn(tx.objectStore('k')); tx.oncomplete=()=>res(q&&q.result!=null?q.result:null); tx.onerror=()=>res(null); }catch(e){ res(null); } }; r.onerror=()=>res(null); }catch(e){ res(null); } });
const dualStore={ getItem:async k=>{ let v=null; try{ v=localStorage.getItem(k); }catch(e){} if(v!=null) return v; const b=await keyDb('readonly',s=>s.get(k)); if(b!=null){ try{ localStorage.setItem(k,b); }catch(e){} } return b; }, setItem:async (k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} await keyDb('readwrite',s=>s.put(v,k)); }, removeItem:async k=>{ try{ localStorage.removeItem(k); }catch(e){} await keyDb('readwrite',s=>s.delete(k)); } };
/* v12.20・SQL 278：すべての通信に端末の合鍵を付ける（データベースが「登録した端末」かを確かめる。点検 2026-10-28） */
const posFetch=(u,o={})=>{ let k=null; try{ k=localStorage.getItem('olive_pos_terminal'+SLOT); }catch(e){} if(!k) return fetch(u,o); const h=new Headers(o.headers||{}); h.set('x-olive-term',k); return fetch(u,{...o,headers:h}); };
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { global:{ fetch:posFetch }, auth:{ lock: async (n,t,fn)=>await fn() /* 2026-10-22：裏で開いたままのタブがあってもログインが止まらないように */, storage:dualStore, storageKey:'olive-pos-auth'+((new URLSearchParams(location.search).get('slot')||'').replace(/[^a-z0-9]/gi,'') ? '-'+new URLSearchParams(location.search).get('slot').replace(/[^a-z0-9]/gi,'') : '') } }) /* 2026-10-18：POS とタイムカードを同じブラウザで同時に使えるように */;
const $ = id => document.getElementById(id);
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const yen = n => (n ?? 0).toLocaleString('ja-JP') + '円';
// v11.45：来店の時刻は5分切り上げ（09:17→09:20）。セットの始まり（set_start）も切り上げた時刻で記録し、セットの終わり・延長もそこから数える。来店の記録（opened_at）と退店（closed_at）は実際の時刻（オーナー 2026-10-15）
const ceil5=t=>{ const d=new Date(t); d.setSeconds(0,0); d.setMinutes(d.getMinutes()+(5-d.getMinutes()%5)%5); return d; };
const hm5=t=>hm(ceil5(t));
const hm = t => { const d=new Date(t); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const ROLE = { douhan1:'同伴①', douhan2:'同伴②', douhan:'同伴', none:'' };
const isDouhan=r=>r==='douhan1'||r==='douhan2'||r==='douhan';
const METHOD = { cash:'現金', card:'カード', invoice:'請求書', oki:'置き' };
/* v11.96：?slot= で同じブラウザに2店を開いても、端末に残す設定が混ざらないように */ const SLOT=((new URLSearchParams(location.search).get('slot')||'').replace(/[^a-z0-9]/gi,'')?'-'+new URLSearchParams(location.search).get('slot').replace(/[^a-z0-9]/gi,''):'');
let store, settings, modes=[], tables=[], categories=[], products=[], staff=[], customers=[], openBills=[], cur=null, payMethod='cash', billFrom='hall';
function toast(m){ const t=$('toast'); t.textContent=m; t.classList.add('on'); setTimeout(()=>t.classList.remove('on'),1800); }
function show(v){ document.querySelectorAll('.view').forEach(x=>x.classList.remove('on')); $(v).classList.add('on'); if(v==='v-hall'&&rtMastWait) setTimeout(rtMasters,0); }
function businessDate(d=new Date()){ const x=new Date(d.getTime()-8*3600*1000); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
setInterval(()=>{ const d=new Date(); $('clock').textContent=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; const bd=businessDate(d); $('hdDate').textContent=`${+bd.slice(5,7)}月${+bd.slice(8,10)}日`; /* v11.95：0時〜朝8時は前の日の営業日を出す（ゲネプロ #59） */ },1000);

$('loginForm').addEventListener('submit', async e => { e.preventDefault(); $('loginErr').textContent='';
  /* 2026-10-22：押しても何も出ずに止まることがあった（タイムカード）。止まった理由を必ず画面に出す */
  const btn=e.target.querySelector('button[type=submit],button'); if(btn) btn.disabled=true;
  const slow=setTimeout(()=>{ if(!$('loginErr').textContent) $('loginErr').textContent='返事がありません。ほかのタブで開いている POS を閉じて、このページを開き直してください'; },15000);
  try { const { error } = await sb.auth.signInWithPassword({ email:$('email').value.trim(), password:$('pw').value });
    if (error) { $('loginErr').textContent=/Invalid login credentials/.test(error.message)?'メールアドレスかパスワードが違います（自動で入った文字は消して、打ち直してください）':'ログインできません：'+error.message; return; }
    const { data:{ session } } = await sb.auth.getSession(); if(!session){ $('loginErr').textContent='ログインの記録が残りませんでした。プライベートブラウズを切ってから、もう一度'; return; }
    await start(); }
  catch(ex){ $('loginErr').textContent='ログインできません：'+(ex&&ex.message||ex)+'（ほかのタブで開いている POS を閉じてから、もう一度）'; }
  finally{ clearTimeout(slow); if(btn) btn.disabled=false; } });
const PT_KEY='olive_pos_terminal'+SLOT; const ptGet=()=>{ try{ return localStorage.getItem(PT_KEY); }catch(e){ return null; } };
/* v12.11・SQL 233：合鍵は2つの引き出し（localStorage と IndexedDB）にしまう。片方が空なら、もう片方から戻す。合わない時も捨てない（オーナー 2026-10-24「また同じように再登録しないといけないの？」） */
const ptSet=v=>{ try{ localStorage.setItem(PT_KEY,v); }catch(e){} keyDb('readwrite',s=>s.put(v,PT_KEY)); };
const ptLoad=async()=>{ const a=ptGet(); if(a) return [a,null]; const b=await keyDb('readonly',s=>s.get(PT_KEY)); if(b){ try{ localStorage.setItem(PT_KEY,b); }catch(e){} return [b,'restored']; } return ['',null]; };
$('posRegForm').addEventListener('submit', async e => { e.preventDefault(); const err=$('posRegErr'); err.textContent=''; const code=$('posRegCode').value.trim();
  if(!/^\d{6}$/.test(code)){ err.textContent='登録コードは6けたの数字です'; return; }
  const { data, error } = await sb.rpc('pos_term_register',{p_code:code}); if(error){ err.textContent=error.message; return; }
  ptSet(data.token); $('posReg').style.display='none'; start(); });
async function start(){ const { data:{ session } } = await sb.auth.getSession(); if (!session) return;
  /* v11.31・SQL 084：タイムカード専用の ID では POS を開かない。伝票の削除・入金の取消・入出金の削除・罰金の取消の操作ログは、データベースが書く（関数が無い時は今までどおり画面が書く） */
  try{ const tc=await sb.rpc('is_timecard_user'); if(tc.data===true){ await sb.auth.signOut(); $('loginErr').textContent='タイムカード専用IDでは、POS は開けません'; return; }
    const dl=await sb.rpc('db_logs_on'); DBLOG=dl.data===true; }catch(e){}
  /* v12.01・SQL 186：登録した端末だけ開く。v12.20：確認できない時（通信の失敗など）も開かない */
  { const [tk,note]=await ptLoad(); if(tk&&!ptGet()) ptSet(tk); else if(tk) keyDb('readwrite',s=>s.put(tk,PT_KEY)); /* もう片方の引き出しにも入れておく */
    const pt=await sb.rpc('pos_term_check',{p_token:tk,p_note:note});
    if(pt.error||!pt.data){ $('loginErr').textContent='端末を確認できません。通信を確認して、再度開いてください'; return; }
    if(pt.data.ok===false){ $('login').classList.add('hidden'); $('posReg').style.display='flex'; $('posRegCode').value=''; return; } }
  $('login').classList.add('hidden'); checkVersion(); await loadMasters(); rtSub(); await loadHall(); setInterval(loadHall,60000); show('v-hall'); }

async function loadMasters(){
  const [s,st,pm,tb,ca,pr,sf,cu] = await Promise.all([
    sb.from('stores').select('*').limit(1), sb.from('pos_settings').select('*').limit(1),
    sb.from('pricing_modes').select('*').eq('is_active',true).order('sort_order').order('id'), sb.from('tables').select('*').order('sort_order').order('id'),
    sb.from('categories').select('*').order('sort_order').order('id'), sb.from('products').select('*').order('sort_order').order('id'),
    sb.from('staff').select('id,display_name,kind').eq('is_active',true).order('sort_order').order('id'), cuLoadAll()]);
  { const e=[s,st,pm,tb,ca,pr,sf,cu].find(x=>x&&x.error); if(e) toast('店の設定を読み込めません。再度開いてください：'+e.error.message); } /* 通しチェック3：読めないと後でボタンが黙って止まった */
  store=s.data?.[0]; kSet(store?.kakari_label); kDom(); settings=st.data?.[0]; modes=pm.data||[]; tables=tb.data||[]; categories=ca.data||[]; products=pr.data||[]; staff=sf.data||[]; customers=(cu.data||[]).map(cuK);
  $('storeName').textContent = store?.name || '店舗未設定';
  // v11.16・SQL 065：閉店時間（管理サイト「POS設定」の店の情報）。体験の時給の打ち止めに使う。読めない時は 1:00
  if(store){ const r=await sb.rpc('store_close_time',{p_store:store.id}); if(!r.error&&/^\d{2}:\d{2}$/.test(r.data||'')) closeHM=r.data; }
  await expireTrials();
}
// 体験キャストは1日限り：登録した営業日の翌営業日になったら自動で「削除済」にする（記録は残る）
// v12.18・SQL 273：マイページのシフトから前もって登録した体験の人は、体験の日（trial_day）に在籍に出し、その次の営業日に削除済にする
let trialSweepDay=null; let salesM={};
async function expireTrials(){ const bd=businessDate(); if(trialSweepDay===bd||!store) return; try{ { const a=await sb.from('staff').update({is_active:true}).eq('is_trial',true).eq('is_active',false).eq('trial_day',bd).select('id,display_name'); for(const x of (a.data||[])) await logOp('体験キャストの在籍',{name:x.display_name,day:bd},null,true); }
  const r=await sb.from('staff').select('id,display_name,created_at,trial_day').eq('is_trial',true).eq('is_active',true); if(r.error) return; const old=(r.data||[]).filter(x=>(x.trial_day||businessDate(new Date(x.created_at)))<bd); const done=[]; for(const x of old){ const u=await sb.from('staff').update({is_active:false}).eq('id',x.id); if(!u.error){ done.push(x.id); await logOp('体験キャストの自動削除',{name:x.display_name,registered:businessDate(new Date(x.created_at))},null,true); } } if(done.length) staff=staff.filter(z=>!done.includes(z.id)); trialSweepDay=bd; }catch(e){ console.warn('expireTrials',e); } }

// ---------- リアルタイム v11.18・SQL 067：設定・伝票がほかで変わったら、すぐ読み直す（つながらない時は、これまでどおり1分ごと） ----------
// 設定：ホール・伝票を見ている時に読み直す（メニュー登録・注文・設定・顧客の画面の間は、ホールに戻った時）。伝票：ホールは読み直し、開いている伝票は
// もう1台で変わった時だけ最新にして「もう1台で変更されました」。この端末で触った直後（3秒）と確認の画面が出ている間は待つ
let rtCh=null, rtMastT=0, rtHallT=0, rtBillT=0, rtTap=0, rtMastWait=false, billFp='';
const fpOf=b=>JSON.stringify(b,(k,v)=>k==='depPays'||k==='totals'?undefined:v);
document.addEventListener('pointerdown',()=>{ rtTap=Date.now(); },true);
const rtBusy=()=>!!document.querySelector('.modal.on');
const onView=v=>$(v).classList.contains('on');
function rtSub(){ if(rtCh||!store) return; try{ rtCh=sb.channel('olive:'+store.id).on('broadcast',{event:'chg'},m=>rtOn(m.payload||{})).subscribe(); }catch(e){ console.warn('realtime',e); } }
function rtOn(p){ if(p.kind==='settings'){ clearTimeout(rtMastT); rtMastT=setTimeout(rtMasters,1500); return; }
  clearTimeout(rtHallT); rtHallT=setTimeout(()=>{ if(onView('v-hall')&&!rtBusy()) loadHall(); },1200);
  if(cur&&p.bill===cur.id){ clearTimeout(rtBillT); rtBillT=setTimeout(rtBillCheck,Math.max(800,rtTap+3000-Date.now())); } }
async function rtMasters(){ if(!(onView('v-hall')||onView('v-bill'))||rtBusy()){ rtMastWait=true; return; } rtMastWait=false;
  try{ await loadMasters(); if(onView('v-hall')&&!rtBusy()) loadHall(); else if(onView('v-bill')&&cur&&!rtBusy()) openBill(cur.id); }catch(e){ console.warn('rtMasters',e); } }
async function rtBillCheck(){ if(!cur||!(onView('v-bill')||onView('v-pay'))) return;
  if(rtBusy()||Date.now()-rtTap<3000||document.activeElement?.tagName==='INPUT'&&onView('v-pay')){ clearTimeout(rtBillT); rtBillT=setTimeout(rtBillCheck,1500); return; }
  const id=cur.id, r=await sb.from('bills').select(BILL_SEL).eq('id',id).single(); if(r.error||!cur||cur.id!==id) return;
  if(fpOf(r.data)===billFp) return;
  const onPay=onView('v-pay'); await openBill(id); if(onPay&&cur.status==='open'){ renderPay(); show('v-pay'); } toast('ほかの端末で変更されました'); }

