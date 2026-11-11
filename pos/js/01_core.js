// v11.25・SQL 080：店ごとの「係」の名称（stores.kakari_label。空なら「係」）。画面の「係」は KL を差し込む。見出しの一覧は kReg に入れておき、kSet で付け直す。操作ログに残す操作の名前は「係」のまま（表示の時に kl で読み替える）
const actL=a=>kl(a==='伝票取消'?'伝票削除':a); /* v11.28：操作ログの「伝票取消」は「伝票削除」と表示（記録の名前は変えない） */
function kDom(){ const a=$('castAddBtn'); if(a) a.textContent='＋ '+KL+'／同伴'; const t=$('castAddTtl'); if(t) t.textContent=KL+'／同伴を追加'; const c=document.querySelector('#castRole [data-cr=kakari]'); if(c) c.textContent=KL; }
document.addEventListener('click',e=>{ const q=e.target.closest&&e.target.closest('.hint .qm'); if(q){ e.preventDefault(); e.stopPropagation(); q.closest('.hint').classList.toggle('open'); } },true); /* 15番：「？」で詳しい説明を開く・閉じる */
/* 2026-10-24（SQL 233 と同じ考え）：ログインの記録も2つの引き出し（localStorage と IndexedDB）にしまう。片方が消えてもログインし直さずに済む。ログアウトは両方から消す（オーナー「セキュリティが守れるなら同じようにしてほしい」） */
const dualStore={ getItem:async k=>{ let v=null; try{ v=localStorage.getItem(k); }catch(e){} if(v!=null) return v; const b=await keyDb('readonly',s=>s.get(k)); if(b!=null){ try{ localStorage.setItem(k,b); }catch(e){} } return b; }, setItem:async (k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} await keyDb('readwrite',s=>s.put(v,k)); }, removeItem:async k=>{ try{ localStorage.removeItem(k); }catch(e){} await keyDb('readwrite',s=>s.delete(k)); } };
/* v12.20・SQL 278：すべての通信に端末の合鍵を付ける（データベースが「登録した端末」かを確かめる。点検 2026-10-28） */
const posFetch=(u,o={})=>{ let k=null; try{ k=localStorage.getItem('olive_pos_terminal'+SLOT); }catch(e){} if(!k) return fetch(u,o); const h=new Headers(o.headers||{}); h.set('x-olive-term',k); return fetch(u,{...o,headers:h}); };
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { global:{ fetch:posFetch }, auth:{ lock: async (n,t,fn)=>await fn() /* 2026-10-22：裏で開いたままのタブがあってもログインが止まらないように */, storage:dualStore, storageKey:'olive-pos-auth'+((new URLSearchParams(location.search).get('slot')||'').replace(/[^a-z0-9]/gi,'') ? '-'+new URLSearchParams(location.search).get('slot').replace(/[^a-z0-9]/gi,'') : '') } }) /* 2026-10-18：POS とタイムカードを同じブラウザで同時に使えるように */;
/* v12.72・SQL 380：お客様のフリガナ（カタカナで保存。ひらがな・半角で入れてもカタカナに）。検索はひらがな・カタカナどちらでも（顧客サイトと同じ） */
// v11.45：来店の時刻は5分切り上げ（09:17→09:20）。セットの始まり（set_start）も切り上げた時刻で記録し、セットの終わり・延長もそこから数える。来店の記録（opened_at）と退店（closed_at）は実際の時刻（オーナー 2026-10-15）
const hm5=t=>hmJst(ceil5(t));
const ROLE = { douhan1:'同伴①', douhan2:'同伴②', douhan:'同伴', none:'' };
const isDouhan=r=>r==='douhan1'||r==='douhan2'||r==='douhan';
const METHOD = { cash:'現金', card:'カード', invoice:'請求書', oki:'置き' };
/* v11.96：?slot= で同じブラウザに2店を開いても、端末に残す設定が混ざらないように */ const SLOT=((new URLSearchParams(location.search).get('slot')||'').replace(/[^a-z0-9]/gi,'')?'-'+new URLSearchParams(location.search).get('slot').replace(/[^a-z0-9]/gi,''):'');
let store, settings, modes=[], tables=[], categories=[], products=[], staff=[], customers=[], openBills=[], cur=null, payMethod='cash', billFrom='hall';
/* 2026-11-08 構造をシンプルに（2回目）：小窓の箱（class modal on・重なりの順番）を作る3つの手順を1つに（前は同じ3つが18か所） */
/* 2026-11-08 オーナー「通信切れならしょうがない。その場合は表示させて」：失敗の知らせ（〜できません：・〜エラー：・失敗・通信できませんでした）は、1.8秒で消さず OK を押すまで残す箱で出す。ほかの箱が開いている時は今までどおり下に出す */
const TOAST_NG=/(できません|エラー|読めません|出せません|取り消せません|外せません)：|読み込めません|失敗|通信できませんでした/;
TOAST.ms=1800; TOAST.big=m=>{ if(TOAST_NG.test(String(m))&&typeof uiAlert==='function'&&!$('uiDlg').classList.contains('on')){ uiAlert(String(m)); return true; } return false; }; /* POS は失敗の知らせを見落とさないように、知らせの箱で出す */
function show(v){ document.querySelectorAll('.view').forEach(x=>x.classList.remove('on')); $(v).classList.add('on'); if(v==='v-hall'&&rtMastWait) setTimeout(rtMasters,0); }
/* 同じ働きの書き方が画面ごとにあり、全角の数字を 0 と読む所があったので1つにする */
/* 営業日の始まり（その日の 8:00・日本時間）。端末の時刻の設定に左右されないように +09:00 を付ける */
setInterval(()=>{ const d=new Date(); $('clock').textContent=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; const bd=businessDate(d); $('hdDate').textContent=`${+bd.slice(5,7)}月${+bd.slice(8,10)}日`; /* v11.95：0時〜朝8時は前の日の営業日を出す（ゲネプロ #59） */ },1000);

$('loginForm').addEventListener('submit', async e => { e.preventDefault(); $('loginErr').textContent='';
  /* 2026-10-22：押しても何も出ずに止まることがあった（タイムカード）。止まった理由を必ず画面に出す */
  const btn=e.target.querySelector('button[type=submit],button'); if(btn) btn.disabled=true;
  const slow=setTimeout(()=>{ if(!$('loginErr').textContent) $('loginErr').textContent='返事がありません。ほかのタブで開いている POS を閉じて、このページを開き直してください'; },15000);
  try { const { error } = await sb.auth.signInWithPassword({ email:$('email').value.trim(), password:$('pw').value });
    if (error) { $('loginErr').textContent=/Invalid login credentials/.test(error.message)?'メールアドレスかパスワードが違います（自動で入った文字は消して、打ち直してください）':'ログインできません：'+jaNet(error.message); return; }
    const { data:{ session } } = await sb.auth.getSession(); if(!session){ $('loginErr').textContent='ログインの記録が残りませんでした。プライベートブラウズを切ってから、再度お試しください'; return; }
    await start(); }
  catch(ex){ $('loginErr').textContent='ログインできません：'+jaNet(ex&&ex.message||ex)+'（ほかのタブで開いている POS を閉じてから、再度お試しください）'; }
  finally{ clearTimeout(slow); if(btn) btn.disabled=false; } });
const PT_KEY='olive_pos_terminal'+SLOT; const ptGet=()=>{ try{ return localStorage.getItem(PT_KEY); }catch(e){ return null; } };
/* v12.11・SQL 233：合鍵は2つの引き出し（localStorage と IndexedDB）にしまう。片方が空なら、もう片方から戻す。合わない時も捨てない（オーナー 2026-10-24「また同じように再登録しないといけないの？」） */
const ptSet=v=>{ try{ localStorage.setItem(PT_KEY,v); }catch(e){} keyDb('readwrite',s=>s.put(v,PT_KEY)); };
const ptLoad=async()=>{ const a=ptGet(); if(a) return [a,null]; const b=await keyDb('readonly',s=>s.get(PT_KEY)); if(b){ try{ localStorage.setItem(PT_KEY,b); }catch(e){} return [b,'restored']; } return ['',null]; };
$('posRegForm').addEventListener('submit', async e => { e.preventDefault(); const err=$('posRegErr'); err.textContent=''; const code=$('posRegCode').value.trim();
  if(!/^\d{6}$/.test(code)){ err.textContent='登録コードは6桁の数字です'; return; }
  const { data, error } = await sb.rpc('pos_term_register',{p_code:code}); if(error){ err.textContent=error.message; return; }
  ptSet(data.token); $('posReg').style.display='none'; if(hallOn){ location.reload(); return; } start(); }); /* 点検 2026-11-02：開いている途中で登録し直した時は読み直す（1分ごとの処理が二重にならないように） */
$('posRegOut').onclick=async()=>{ await storeSwDrop(); await sb.auth.signOut(); location.reload(); }; /* v12.43：登録の画面からログアウト（点検 2026-11-02 B6）。端末の合鍵は消さない */
/* v12.44：オーナーの端末は、上の店名を押して銀座・広島を切り替える（オーナー 2026-11-02「いちいち消してログインし直すのが嫌」）。店ごとのログインは ?slot= で別々に残る（v11.96）。
   この端末で開いた店を olive_pos_stores（2つの引き出し）に控え、2店ある時だけ店名で、もう1店へ。2店目は設定の「店舗追加」から（その店のログイン＋登録コード。登録コードはオーナーだけが発行） */
const STORES_KEY='olive_pos_stores', SLOT_RAW=SLOT.slice(1); let posStores={}, termSwitch=false; /* v12.45・SQL 322：「店舗追加」は管理サイトで「店舗切替」をオンにした端末だけ（オーナー「店の iPad では出さない」） */
const slotUrl=s=>location.pathname+(s?'?slot='+encodeURIComponent(s):'');
async function storeSwLoad(){ try{ posStores=JSON.parse(await dualStore.getItem(STORES_KEY)||'{}')||{}; }catch(e){ posStores={}; } }
const storeSwSave=()=>dualStore.setItem(STORES_KEY,JSON.stringify(posStores));
const storeSwOther=()=>Object.entries(posStores).find(([k,v])=>k!==store?.id&&v.slot!==SLOT_RAW)?.[1]||null;
async function storeSwRec(){ if(!store) return; await storeSwLoad(); for(const k of Object.keys(posStores)) if(posStores[k].slot===SLOT_RAW) delete posStores[k]; posStores[store.id]={name:store.name||'',slot:SLOT_RAW}; await storeSwSave(); storeSwShow(); }
async function storeSwDrop(){ await storeSwLoad(); for(const k of Object.keys(posStores)) if(posStores[k].slot===SLOT_RAW) delete posStores[k]; await storeSwSave(); }
function storeSwShow(){ const o=storeSwOther(); $('storeName').style.cursor=o?'pointer':''; $('loginBack').style.display=$('posRegBack').style.display=o?'':'none'; }
$('storeName').onclick=()=>{ const o=storeSwOther(); if(o) location.href=slotUrl(o.slot); };
$('loginBack').onclick=$('posRegBack').onclick=()=>{ const o=storeSwOther(); if(o) location.href=slotUrl(o.slot); }; /* ログインの画面から、控えのある店へ戻る */
storeSwLoad().then(storeSwShow);
/* 点検 2026-11-02・SQL 313：端末のログインと合鍵を確かめる。パスワードが変わった（古いログイン）→ ログイン画面へ。合鍵が外れた → 登録の画面へ。前は古いログインでも「この端末を登録」になり、登録しても断られた／開いたまま登録が外れると会計の締めなどが黙って0行で終わった */
async function posTermLost(){ try{ const [tk]=await ptLoad(); const pt=await sb.rpc('pos_term_check',{p_token:tk}); if(pt.error||!pt.data) return false;
  if(pt.data.stale){ await sb.auth.signOut(); await uiAlert('パスワードが変わりました。新しいパスワードでログインしてください'); location.reload(); return true; }
  if(pt.data.ok===false){ $('posReg').style.display='flex'; $('posRegCode').value=''; return true; } }catch(e){} return false; }
/* 起動で通信が通らない時は「通信を確認しています…」を出し、5秒ごとに自動でやり直す（管理サイト・タイムカードと同じ）。ログインしたまま待つ間は入力欄を出さない。
   20秒たっても返事が無い時も、最初からやり直す。前は赤い文字が出るだけで止まり、通信が戻っても開かず、入力欄が出て「ログインできない」と思わせた（2026-11-11 広島） */
let startRun=0;
const loginWait=(on,msg)=>{ $('loginForm').classList.toggle('waiting',on); $('loginErr').textContent=msg||''; };
async function start(){ const run=++startRun; clearTimeout(start.r); clearTimeout(start.slow);
  const live=()=>run===startRun&&!hallOn; const retry=()=>{ if(!live()) return; loginWait(true,'通信を確認しています…'); clearTimeout(start.r); start.r=setTimeout(start,5000); };
  start.slow=setTimeout(retry,20000);
  try{ const { data:{ session } } = await sb.auth.getSession(); if(!live()) return; if (!session){ loginWait(false); return; }
  if(!$('loginErr').textContent) loginWait(true,'');
  /* v11.31・SQL 084：タイムカード専用の ID では POS を開かない。伝票の削除・入金の取消・入出金の削除・罰金の取消の操作ログは、データベースが書く（関数が無い時は今までどおり画面が書く） */
  try{ const tc=await sb.rpc('is_timecard_user'); if(!live()) return; if(tc.data===true){ await sb.auth.signOut(); loginWait(false,'タイムカード専用IDでは、POS は開けません'); return; }
    const dl=await sb.rpc('db_logs_on'); DBLOG=dl.data===true; }catch(e){}
  if(!live()) return;
  /* v12.01・SQL 186：登録した端末だけ開く。v12.20：確認できない時（通信の失敗など）も開かない */
  { const [tk,note]=await ptLoad(); if(tk&&!ptGet()) ptSet(tk); else if(tk) keyDb('readwrite',s=>s.put(tk,PT_KEY)); /* もう片方の引き出しにも入れておく */
    const pt=await sb.rpc('pos_term_check',{p_token:tk,p_note:note}); if(!live()) return;
    if(pt.error||!pt.data){ retry(); return; }
    if(pt.data.stale){ await sb.auth.signOut(); loginWait(false,'パスワードが変わりました。新しいパスワードでログインしてください'); return; } /* 点検 2026-11-02・SQL 313 */
    if(pt.data.ok===false){ loginWait(false); $('login').classList.add('hidden'); $('posReg').style.display='flex'; $('posRegCode').value=''; return; } termSwitch=pt.data.store_switch===true; }
  await loadMasters(true,true); if(!live()) return; if(!store){ retry(); return; } /* 店の設定が読めない時も開かずにやり直す（開くと店が空のまま動かない） */
  hallOn=true; loginWait(false); $('login').classList.add('hidden'); checkVersion(); storeSwRec(); rtSub(); await loadHall(true); setInterval(hallTick,60000); show('v-hall');
  }finally{ if(run===startRun) clearTimeout(start.slow); /* 返事が来た時は止める。待ったまま返事が無い時だけ 20秒でやり直す */ } } /* v12.30：1分ごとは画面の描き直しだけ（全部の読み直しは5分ごと・画面を開いていない間は止める） */

async function loadMasters(withCust,quiet){ /* v12.30：お客様は最初だけ全部読む（あとは cuPull で変わった分だけ） */
  /* v13.04・SQL 427：店の設定（店・POS設定・料金・卓・分類・商品・在籍・閉店時刻）は入口の関数1回で読む（前は表を1つずつ8回） */
  const [m,cu] = await Promise.all([sb.rpc('pos_masters'), withCust?cuLoadAll():null]);
  { const e=[m,cu].find(x=>x&&x.error); if(e&&!quiet) toast('店の設定を読み込めません。再度開いてください：'+e.error.message); } /* 通しチェック3：読めないと後でボタンが黙って止まった */
  if(m.error&&store) return; /* 読み直しで読めなかった時は、前に読んだ店の設定のまま（空にすると、次の読み直しまで store.id で止まった） */
  const d=m.data||{};
  store=d.store||undefined; kSet(store?.kakari_label); kDom(); settings=d.settings||undefined; modes=d.modes||[]; tables=d.tables||[]; categories=d.categories||[]; products=d.products||[]; staff=d.staff||[]; if(withCust){ customers=(cu.data||[]).map(cuK); if(!cu.error) cuMark(true); }
  $('storeName').textContent = store?.name || '店舗未設定';
  // v11.16・SQL 065：閉店時間（管理サイト「POS設定」の店の情報）。体験の時給の打ち止めに使う。読めない時は 1:00
  if(store&&/^\d{2}:\d{2}$/.test(d.close_time||'')) closeHM=d.close_time;
  await expireTrials();
}
// 体験キャストは1日限り：登録した営業日の翌営業日になったら自動で「削除済」にする（記録は残る）
// v12.18・SQL 273：マイページのシフトから前もって登録した体験の人は、体験の日（trial_day）に在籍に出し、その次の営業日に削除済にする
let trialSweepDay=null; let salesM={};
async function expireTrials(){ const bd=businessDate(); if(trialSweepDay===bd||!store) return; try{ { const a=await sb.rpc('pos_trial_activate',{p_bd:bd}); for(const x of (a.data||[])) await logOp('体験キャストの在籍',{name:x.display_name,day:bd},null,true); }
  const r=await sb.from('staff').select('id,display_name,created_at,trial_day').eq('is_trial',true).eq('is_active',true); if(r.error) return; const old=(r.data||[]).filter(x=>(x.trial_day||businessDate(new Date(x.created_at)))<bd); const done=[]; for(const x of old){ const u=await sb.rpc('pos_row_update',{p_table:'staff',p_id:x.id,p:{is_active:false}}); if(!u.error){ done.push(x.id); await logOp('体験キャストの自動削除',{name:x.display_name,registered:businessDate(new Date(x.created_at))},null,true); } } if(done.length) staff=staff.filter(z=>!done.includes(z.id)); trialSweepDay=bd; }catch(e){ console.warn('expireTrials',e); } }

// ---------- リアルタイム v11.18・SQL 067：設定・伝票がほかで変わったら、すぐ読み直す（つながらない時は、これまでどおり1分ごと） ----------
// 設定：ホール・伝票を見ている時に読み直す（メニュー登録・注文・設定・顧客の画面の間は、ホールに戻った時）。伝票：ホールは読み直し、開いている伝票は
// もう1台で変わった時だけ最新にして「もう1台で変更されました」。この端末で触った直後（3秒）と確認の画面が出ている間は待つ
let rtCh=null, rtMastT=0, rtHallT=0, rtBillT=0, rtTap=0, rtMastWait=false, billFp='';
const fpOf=b=>JSON.stringify(b,(k,v)=>k==='depPays'||k==='totals'?undefined:v);
document.addEventListener('pointerdown',()=>{ rtTap=Date.now(); },true);
const rtBusy=()=>!!document.querySelector('.modal.on');
const onView=v=>$(v).classList.contains('on');
function rtSub(){ if(rtCh||!store) return; rtCh=rtJoin(sb,store.id,rtOn); }
let rtSide=false;
function rtOn(p){ if(p.kind==='settings'){ hallDropAll(); clearTimeout(rtMastT); rtMastT=setTimeout(rtMasters,1500); return; }
  /* v12.30：変わった伝票の金額だけ計算し直す。置き・お預かり品は伝票・入金・お預かりが変わった時だけ読む */ if(p.bill) hallDrop(p.bill); else hallDropAll(); if(!p.table||['bills','payments','bill_tags'].includes(p.table)) rtSide=true;
  clearTimeout(rtHallT); rtHallT=setTimeout(()=>{ if(onView('v-hall')&&!rtBusy()){ const sd=rtSide; rtSide=false; loadHall({side:sd}); } },1200);
  if(cur&&p.bill===cur.id){ clearTimeout(rtBillT); rtBillT=setTimeout(rtBillCheck,Math.max(800,rtTap+3000-Date.now())); } }
async function rtMasters(){ if(!(onView('v-hall')||onView('v-bill'))||rtBusy()){ rtMastWait=true; return; } rtMastWait=false;
  try{ await loadMasters(); hallDropAll(); checkPwAlert(); if(onView('v-hall')&&!rtBusy()) loadHall(); else if(onView('v-bill')&&cur&&!rtBusy()) openBill(cur.id); }catch(e){ console.warn('rtMasters',e); } }
async function rtBillCheck(){ if(!cur||!(onView('v-bill')||onView('v-pay'))) return;
  if(rtBusy()||Date.now()-rtTap<3000||document.activeElement?.tagName==='INPUT'&&onView('v-pay')){ clearTimeout(rtBillT); rtBillT=setTimeout(rtBillCheck,1500); return; }
  const id=cur.id, r=await sb.from('bills').select(BILL_SEL).eq('id',id).single(); if(r.error||!cur||cur.id!==id) return;
  if(fpOf(r.data)===billFp) return;
  const onPay=onView('v-pay'); await openBill(id); if(onPay&&cur.status==='open'){ renderPay(); show('v-pay'); } toast('ほかの端末で変更されました'); }


// v12.32：在籍リスト・閉店作業の時刻の前のしるし（同じ幅。アフター・シフトは2行）
/* v12.43：読めなかった項目は黙って消さず・0件として通さず、この1行を出す（点検 2026-11-02 B5） */ const RDERR_T='読み込めない項目があります。開き直してください', RDERR=`<div style="color:var(--warn);font-weight:700;font-size:14px;margin:2px 2px 8px;line-height:1.6">${RDERR_T}</div>`;
const PL_IN='<span class="pl">出</span>', PL_OUT='<span class="pl">退</span>', PL_AF='<span class="pl af">アフ<br>ター</span>', PL_SH='<span class="pl af">シフ<br>ト</span>'; const PL_DH='<span class="pl af">同<br>伴</span>'; // 出退勤確認：同伴で出勤した子は「出」の代わり（オーナー 2026-11-10「一マスに同伴」）
// v12.70：伝票の同じ注文を1行にまとめる（データは注文ごとのまま。見た目だけ）。品・単価・係小計の価格・バック額・ポイント・バックの人が同じもの
function groupItems(items){ const out=[], by=new Map();
  items.forEach(i=>{ const who=[...new Set((i.bill_item_splits||[]).filter(s=>(s.back_amount||0)>0||Number(s.back_points||0)>0).map(s=>s.staff_id))].sort().join(',');
    const k=[i.product_id,i.name,i.category_id,i.unit_price,i.cast_subtotal_price,i.back_amount,Number(i.back_points||0),!!i.is_service_target,!!i.is_keep,who].join('|');
    let g=by.get(k); if(!g){ g={...i,qty:0,rows:[],bill_item_splits:[]}; by.set(k,g); out.push(g); } g.rows.push(i); g.qty+=i.qty;
    (i.bill_item_splits||[]).forEach(s=>{ const e=g.bill_item_splits.find(z=>z.staff_id===s.staff_id); if(e){ e.back_amount=(e.back_amount||0)+(s.back_amount||0); e.back_points=Number(e.back_points||0)+Number(s.back_points||0); } else g.bill_item_splits.push({...s}); }); });
  out.forEach(g=>{ g.ids=g.rows.map(r=>r.id); g.rows.sort((a,b)=>String(a.added_at||'').localeCompare(String(b.added_at||''))); }); return out; }
