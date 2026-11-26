/* 全部のサイトで使う小さい部品（07 の B1）。前は POS・管理サイト・マイページ・顧客サイト・タイムカード・鍵にそれぞれコピーがあり、1つ直してもほかが直らなかった。
   ここを直せば全部のサイトが直る。サイトの中で同じ名前を作らない（見張り guard/count.py が数える）。タイムカードの古い Safari でも動くように ?. ?? は使わない */

/* 画面の部品を id で探す */
const $ = id => document.getElementById(id);

/* データベースのアドレスと公開の鍵（全部のサイトで同じ。前は6か所にコピー）。練習用サイトはこの行を書きかえる。管理サイトの preview.html の注釈の鍵は、店の Apps Script「日報フォーム送信」が読むので別に残す */
const SUPABASE_URL = 'https://gjqaxenwvvazhjtziusf.supabase.co', SUPABASE_KEY = 'sb_publishable_pPfJUvJd6iJeHBNiD7XkWA_2RKF7JYw';

/* 文字を安全に画面に出す（< > & " ' をそのまま出す） */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 空・null を 0 にして数にする（金額や人数の足し算で使う。マイページと管理サイトで同じ）
const N = v => Number(v||0);

/* 電波が悪い時の英語の知らせ（Failed to fetch など）を日本語に */
const jaNet = m => /Failed to fetch|Load failed|NetworkError|Network request failed|fetch failed|AuthRetryableFetchError/i.test(String(m)) ? '通信できませんでした。再度お試しください' : m;

/* 画面の金額「78,000」（円は付けない。2026-11-24 オーナー）。数字でない物（前から文字で渡している所）はそのまま */
const yen = n => { const v = Number(n || 0); return isNaN(v) ? String(n) : v.toLocaleString('ja-JP'); };
/* 単位の「円」を付ける物：領収書の印刷・データベースに残す文（今までと同じ「78,000円」） */
const yenU = n => yen(n) + '円';

/* フリガナ：カタカナで保存する（ひらがな・半角で入れてもカタカナに）。探す時は空白を無視 */
/* ひらがなとカタカナは文字の番号が 0x60 ずつ離れているので、足してカタカナにそろえる */
const kanaFix = v => String(v || '').normalize('NFKC').replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60)).replace(/\s+/g, ' ').trim();
const kanaKey = v => kanaFix(v).replace(/ /g, '');
const kanaHit = (c, q) => { const k = kanaKey(q); return !!k && kanaKey(c.kana).includes(k); };
const kanaBad = v => !!v && !/^[ァ-ヶー・ ]+$/.test(v);

/* ログインの鍵を iPad の中（IndexedDB の olive_keys）に置く・読む。POS・管理サイト・顧客サイト・タイムカードで同じ置き場を使う */
const keyDb=(mode,fn)=>new Promise(res=>{ try{ const r=indexedDB.open('olive_keys',1); r.onupgradeneeded=()=>{ r.result.createObjectStore('k'); }; r.onsuccess=()=>{ try{ const tx=r.result.transaction('k',mode), q=fn(tx.objectStore('k')); tx.oncomplete=()=>res(q&&q.result!=null?q.result:null); tx.onerror=()=>res(null); }catch(e){ res(null); } }; r.onerror=()=>res(null); }catch(e){ res(null); } });
// ログインを2つの引き出し（localStorage と IndexedDB）に入れておく置き場。片方が消えても、もう片方から戻す（管理サイト・顧客サイト・POS の supabase のログインと、POS の店の切り替え）
const dualStore={ getItem:async k=>{ let v=null; try{ v=localStorage.getItem(k); }catch(e){} if(v!=null) return v; const b=await keyDb('readonly',s=>s.get(k)); if(b!=null){ try{ localStorage.setItem(k,b); }catch(e){} } return b; }, setItem:async (k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} await keyDb('readwrite',s=>s.put(v,k)); }, removeItem:async k=>{ try{ localStorage.removeItem(k); }catch(e){} await keyDb('readwrite',s=>s.delete(k)); } };

/* 大きい部品は使う時だけ読む（開くのを速くするため）。needLib('jsqr') → QR の画像を読む・needLib('qrcode') → QR を作る。2回目からは読まない */
const needLib = (() => { const F = { jsqr: 'jsqr-1.4.0.js', qrcode: 'qrcode-1.4.4.js' }, P = {};
  return name => P[name] || (P[name] = new Promise((ok, ng) => { const s = document.createElement('script'); s.src = '../lib/' + F[name]; s.onload = ok; s.onerror = () => { delete P[name]; ng(new Error('部品を読み込めませんでした（' + name + '）')); }; document.head.appendChild(s); })); })();

/* 「係」の呼び方（店ごとに「担当」など）。kReg で画面の文字を登録し、kSet で店の呼び方に入れかえる。POS・管理サイト・顧客サイトで同じ */
let KL = '係'; const kl = s => KL === '係' ? s : String(s == null ? '' : s).replace(/係/g, KL); const KT = [];
function kReg(...os){ const walk=o=>{ for(const k of Object.keys(o)){ const v=o[k]; if(typeof v==='string'){ if(v.includes('係')) KT.push([o,k,v]); } else if(v&&typeof v==='object') walk(v); } }; os.forEach(walk); }
function kSet(v){ KL=(v&&String(v).trim())||'係'; KT.forEach(([o,k,v])=>{ o[k]=kl(v); }); }

/* ---- 日付 ----
   jstDay・jstS・businessDate・douhanRoleAt は「日本時間」で考える（お店の iPad の時計の地域がずれていても、日本の日付・時刻になる）。
   ymdOf・dayAdd は「日付の文字どうしの計算」用で、時差は考えない（入れる物も出る物も 2026-11-19 の形の日付だけなので、時差が入る所が無い）。 */
const JST_MS = 9*3600e3;          /* 日本時間は世界時間 +9 時間。日本時間にする所は、手で +9 時間を書かずにこれを使う */
const BD_START_MS = 8*3600e3;     /* 営業日の変わり目＝朝 8:00。夜中（営業 〜1:00・閉店作業 〜2:00・その後の退勤の打刻）を前の日の営業に入れるため。データベースの business_date_of と同じ */
function ymdOf(x){ return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; } /* Date を「2026-11-19」の形の文字に（dayAdd の中で使う） */
const jstDay=(d=new Date())=>{ const t=new Date(d).getTime(); return isNaN(t)?'':new Date(t+JST_MS).toISOString().slice(0,10); };  /* 日本時間の日付「2026-11-19」。日付でない物は空（画面を止めない） */
function businessDate(d=new Date()){ return jstDay(new Date(d).getTime()-BD_START_MS); } /* 営業日「2026-11-19」：朝 8:00 より前は前の日。POS と管理サイトで同じ */
/* 伝票を作った時刻（日本時間）から、同伴の係の役を返す。お金の段 douhan_tier（データベース）と同じ区切り：
   〜7:59 段なし（douhan）／8:00〜20:30 同伴①（douhan1）／20:31〜21:00 同伴②（douhan2）／21:01〜 段なし（douhan） */
function douhanRoleAt(ts){
  const t=new Date(new Date(ts||Date.now()).getTime()+JST_MS), m=t.getUTCHours()*60+t.getUTCMinutes(); /* 日本時間の 0:00 からの分 */
  if(m<8*60) return 'douhan';
  if(m<=20*60+30) return 'douhan1';
  if(m<=21*60) return 'douhan2';
  return 'douhan';
}
/* 営業日 d（YYYY-MM-DD）の始まりの時刻（朝8時・日本の時刻）。POS と管理サイトで、その日の支払い・打刻を読む範囲に使う（07 の B3 ここへ） */
const bdStart = d => new Date(d + 'T08:00:00+09:00').toISOString();
const dayAdd=(d,n)=>{ const x=new Date(d+'T00:00:00'); x.setDate(x.getDate()+n); return ymdOf(x); }; /* 日付（2026-11-19 の形）を n 日ずらす */

/* 予約の「同伴・係・誘客」の1行（POS の朝礼・マイページの黒服の朝礼とシフト・管理サイトのシフトと予約で同じ形）。
   同伴と係は別のもの：銀座は同伴しても係にならないので、同伴の予約にも係を出す。広島は係（担当）を出さない（o.noKK）。
   誘客は同伴の子と同じ人なら出さない。r = { douhan, dh: 同伴の子の名前, by: 誘客, kakari: 係, black: 黒ドレスの子 }・o.mark = 黒ドレスのしるし・o.kl = 係の呼び方 */
function resvWho(r, o){ o = o || {}; const dh = r.douhan ? (r.dh && r.dh.length ? r.dh : [r.by]) : [], p = [];
  if(dh.length) p.push('同伴 ' + dh.map(n => esc(n) + (o.mark && n && n === r.black ? o.mark : '')).join('・'));
  if(!o.noKK) p.push((o.kl || KL) + ' ' + esc(r.kakari || '—'));
  if(r.by && dh.indexOf(r.by) < 0) p.push('誘客 ' + esc(r.by));
  return p.join('・'); }

/* 07 の B5：POS と管理サイトに1文字も同じコピーがあった部品（ここへ）。
   ceil5＝来店の時刻を5分切り上げ（09:17→09:20）／guard＝押している間はボタンを押せなくする（二重送信よけ）／
   sbAll＝1000行ずつ全部読む（読めない時は読めた分と error）／logShort＝操作ログの中身を短い1行に（金額・分・人数・日付は値だけ） */
const ceil5=t=>{ const d=new Date(t); d.setSeconds(0,0); d.setMinutes(d.getMinutes()+(5-d.getMinutes()%5)%5); return d; };
function guard(btn,fn){ return async(...a)=>{ if(btn.disabled) return; btn.disabled=true; try{ await fn(...a); } finally{ btn.disabled=false; } }; }
/* 横に広い表の箱（o-hscroll・olive.css）：続きのある側に印（o-more-r・o-more-l）を付け外しする。動かした時・画面の大きさが変わった時・中身が入れ替わった時に見直す */
function oHint(el){ const rest=el.scrollWidth-el.clientWidth-el.scrollLeft; el.classList.toggle('o-more-r',rest>2); el.classList.toggle('o-more-l',el.scrollLeft>2); }
const oHintAll=()=>document.querySelectorAll('.o-hscroll').forEach(oHint);
if(typeof document!=='undefined'&&document.addEventListener&&typeof MutationObserver!=='undefined'){ /* 画面のある時だけ（共通の部品のテストは画面なしで読む） */
  document.addEventListener('scroll',e=>{ if(e.target.classList&&e.target.classList.contains('o-hscroll')) oHint(e.target); },true); addEventListener('resize',oHintAll);
  let q=0; new MutationObserver(()=>{ if(!q){ q=1; requestAnimationFrame(()=>{ q=0; oHintAll(); }); } }).observe(document.documentElement,{childList:true,subtree:true}); }
/* 入口の関数（1つの画面の中身をまとめて返すデータベースの関数）の答えから1項目を、1つずつ読んだ時と同じ形 {data,error} で取り出す。読めなかった項目は {error:{message}} */
function entryPart(D,k){ const v=(D||{})[k]; return v&&!Array.isArray(v)&&typeof v==='object'&&typeof v.error==='string'?{data:null,error:{message:v.error}}:{data:v===undefined?null:v,error:null}; }
/* データベースは1回に 1,000 行までしか返さないので、1,000 行ずつ続けて全部読む */
async function sbAll(mk){ let all=[]; for(let from=0;;from+=1000){ const r=await mk().range(from,from+999); if(r.error) return {data:all.length?all:null,error:r.error}; all=all.concat(r.data||[]); if((r.data||[]).length<1000) return {data:all,error:null}; } }
/* 操作ログの中身（o）を短い1行の文にする。KJ＝項目の名前の表（例：{price:'金額'}）、val＝値を画面の文字にする関数。金額・分・人数・日付・入金／出金は値だけ出す */
const logShort=(o,KJ,val)=>{ const e=Object.entries(o||{}).filter(([k,v])=>v!==null&&v!==undefined&&v!==''&&!(Array.isArray(v)&&!v.length)&&k!=='table'&&k!=='reason'); e.sort((a,b)=>(a[0]==='by'?-1:0)-(b[0]==='by'?-1:0));
  const md=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v))?mdS(v):String(v), U={amount:'円',total:'円',total_before:'円',minutes:'分',guest_count:'名'}; /* U＝数の後ろに付ける単位 */
  return e.map(([k,v])=>{ const n=typeof v==='number'?v.toLocaleString('ja-JP')+(U[k]||''):null;
    if(k==='by') return '操作者：'+String(v).replace(/^管理サイト：/,'');
    if(k==='date'||k==='business_date') return md(v);
    if(k==='kind'&&(v==='in'||v==='out')) return v==='in'?'入金':'出金';
    if(k==='is_auto') return v?'自動延長':'手動延長';
    if(['amount','minutes','guest_count'].includes(k)&&n!=null) return n;
    if(k==='method'||k==='name'||k==='email') return val(v);
    return `${KJ[k]||k}：${n!=null?n:val(v)}`; }).join(' ／ '); }; /* 内容は短く（オーナー「長い」）。金額・分・人数・日付・入金／出金は値だけ */

/* 曜日の名前（POS・管理サイト・マイページ・タイムカード。07 の B3） */
const WD = ['日','月','火','水','木','金','土'];
/* 日付の文字「…」を「11/3」と曜日「火」に。文字のまま読む（端末の時刻の地域に左右されない） */
function mdS(s){ return `${+String(s).slice(5,7)}/${+String(s).slice(8,10)}`; }
function wdS(s){ return WD[new Date(String(s).slice(0,10)+'T00:00:00Z').getUTCDay()]; }
function mdW(s){ return `${mdS(s)}（${wdS(s)}）`; }
/* 時刻（ISO）を日本の時刻の文字「2026-11-03T20:30…」に（端末の時刻の地域に左右されない）。読めない時は空 */
function jstS(iso){ const t = new Date(iso).getTime(); return isNaN(t) ? '' : new Date(t + JST_MS).toISOString(); }
function mdwHm(iso){ const j = jstS(iso); return j ? mdW(j) + j.slice(11,16) : ''; }

/* 連休明けの日に、休日分の TODO を知らせる箱（POS の閉店作業・黒服マイページの開店作業。07 の B5 ここへ）。日付は文字のまま読む（端末の時刻の地域に左右されない） */
/* 連休明けの日に、休みの間の TODO（期限 17:00）をまとめて出す箱。A＝{next_day:連休明けの日, days:休みの日, items:TODO} */
const aheadHtml = A => { if(!A || !A.items || !A.items.length) return ''; const md = mdW, ms = s => `${mdS(s)} ${wdS(s)}`, D = A.days || [];
  return `<div style="background:var(--warn-soft);border-radius:12px;padding:10px 12px;margin:8px 0;font-size:14px;line-height:1.6"><b style="color:var(--warn)">連休明け ${md(A.next_day)} は休日分の TODO が ${A.items.length}件あります</b><div class="muted" style="font-size:13px">${md(D[0])}〜${md(D[D.length-1])}の${D.length}日間が休みです。期限 17:00</div><div style="margin-top:4px;font-size:13px">${A.items.map((x,i) => `${i+1}. ${esc(x.name)}（${ms(x.day)}）`).join('<br>')}</div></div>`; };

/* 短い知らせ（POS・管理サイト・顧客サイト。07 の B2 ここへ）。通信の英語は日本語に。続けて出した時は、あとの知らせの時間だけ出す
   TOAST.ms＝出しておく時間（サイトで決める）。TOAST.big＝true を返したら知らせの箱で出した（POS の失敗の知らせ） */
const TOAST = { ms: 2000, big: null };
function toast(m){ m = jaNet(m); if(TOAST.big && TOAST.big(m)) return; const t = $('toast'); if(!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function(){ t.classList.remove('on'); }, TOAST.ms); }

/* 知らせの箱（07 の B2 ここへ）。uiAlert（OK だけ）・uiConfirm（OK とキャンセル）・uiPrompt（文を入れる）の受け取り方と返し方はここ1つ。
   見た目は各サイトの UI.box（POS・管理サイト・マイページ・顧客サイトの今の小窓）が作る。UI.box({msg, ok, cls, cancel, input, def, need, pw, ph}) → OK＝true か入れた文・キャンセル＝false か null */
const UI = { box: null, input: false }; /* input＝そのサイトの箱に入力の欄がある（POS・顧客サイト） */
function uiAlert(msg){ return UI.box({ msg: jaNet(msg), ok: 'OK', cls: 'primary', cancel: false }); }
function uiConfirm(msg, ok, cls){ return UI.box({ msg: jaNet(msg), ok: ok || 'OK', cls: cls || 'primary', cancel: true }); }
function uiPrompt(msg, def, opt){ opt = opt || {}; if(!UI.input) throw new Error('このサイトの知らせの箱には入力の欄がありません'); return UI.box({ msg: jaNet(msg), ok: opt.ok || 'OK', cls: 'primary', cancel: true, input: true, def: def == null ? '' : def, need: opt.need, pw: opt.pw, ph: opt.ph }); }

/* ほかの端末の変更を受け取る（07 の B1 ここへ）。データベースが店ごとのチャンネル olive:店 に「chg」を送る。on には中身（kind など）を渡す。つなげない時は null */
function rtJoin(client, storeId, on){ try{ return client.channel('olive:' + storeId).on('broadcast', { event: 'chg' }, function(m){ on(m.payload || {}); }).subscribe(); }catch(e){ console.warn('realtime', e); return null; } }

/* 入力欄の全角の英数字と記号（０-９・Ａ-Ｚ・．／－：など）と全角の空白を半角にする。入力欄を読む所は全部ここを通す（所ごとに読む文字がちがっていたため。07 の B3） */
/* 全角の英数字・記号は、半角と文字の番号が 0xFEE0 離れている。全角の空白だけは別に半角の空白へ */
const toHan = v => String(v == null ? '' : v).replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');

/* 入力欄の数（全角の数字も読む・数字のほかは捨てる・空や読めない時は 0）。POS・管理サイト（07 の B3） */
function numIn(v){ return Math.max(0, parseInt(toHan(v).replace(/[^0-9]/g, '') || '0', 10) || 0); }
/* 金種：POS の閉店作業と管理サイトのレジで数える札と硬貨（同じ並びで数えるので1つに） */
const DENOMS=[[10000,'1万円札'],[5000,'5千円札'],[2000,'2千円札'],[1000,'千円札'],[500,'500円玉'],[100,'100円玉'],[50,'50円玉'],[10,'10円玉'],[5,'5円玉'],[1,'1円玉']];

/* 時刻を日本の時刻で「21:05」（夜中は「00:30」）。空なら ''（POS・管理サイト・マイページ。07 の B3） */
function hmJst(t){ return t ? new Date(t).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }) : ''; }
/* 当日欠勤の連絡時刻の選ぶもの：その営業日の 8:00 から今までの5分ごと（マイページの日のシフト・管理サイトのシフトの「本人都合」） */
function absContactTimes(){ const now = Date.now(), T = []; for(let t = new Date(businessDate() + 'T08:00:00+09:00').getTime(); t <= now; t += 5 * 60000) T.push(hmJst(new Date(t)).replace(/^0/, '')); return T.length ? T : [hmJst(new Date(now)).replace(/^0/, '')]; } /* 時の頭の 0 は付けない（言葉の決まり） */
/* 調整率・不足率・在籍の行（管理サイトのシフト・黒服のマイページのシフト（全員）・確定の箱）と、人員（調整率・不足率・離職率・在籍期間。朝礼）・離職率と在籍期間（管理サイトの収支）。見本 ⑯-9
   1行＝見出し（期間は右に小さく1語）｜数（目安）人数。目安は1本の線。赤は目安から外れた物だけ。分かりきった期間（今月・〜11/25）は出さない（オーナー 11/26「今月で分かるでしょ」）
   H＝shift_health の答え（ret＝shift_retention）。ch＝朝礼（不足率は前の営業日・在籍の行は出さない）。bd＝今日の営業日 */
const hpct = v => String(+Number(v).toFixed(1));
function healthRows(H, ch, bd){ if(!H) return []; const p = v => v == null ? '—' : Number(v).toFixed(1) + '%', R = [];
  R.push({ l: '調整率', v: p(H.adj), red: H.adj != null && H.adj < H.adj_min, t: `${hpct(H.adj_min)}%↑`, x: H.hire ? `採用 あと${H.hire}人` : '', xr: !!H.hire });
  if(ch){ const y = new Date(new Date(bd + 'T00:00:00Z').getTime() - 864e5).toISOString().slice(0, 10);
    R.push({ l: '不足率', per: H.yday ? (H.yday === y ? '昨日' : mdS(H.yday)) : '', v: p(H.yday_short), red: H.yday_short != null && H.yday_short > H.short_max, t: `${hpct(H.short_max)}%↓` }); }
  else { R.push({ l: '不足率', v: p(H.short), red: H.short != null && H.short > H.short_max, t: `${hpct(H.short_max)}%↓` });
    R.push({ l: '在籍', v: `${H.staff}人`, red: (H.staff || 0) < (H.staff_min || 0), t: `${H.staff_min}人↑`, x: R[0].x, xr: R[0].xr }); R[0].x = ''; }   /* 採用の人数は在籍の後ろ（オーナーの例「在籍 22人（20人↑）採用 あと8人」） */
  return R; }
/* 離職率と在籍期間（T＝shift_retention の答え）。在籍期間は区分ごとの物（sub） */
function retentionRows(T){ if(!T || !T.tenure) return []; const n = T.regular || 0, pc = k => n ? Math.round(100 * (T.tenure[k] || 0) / n) : 0, R = [];
  R.push({ l: '離職率', per: '半年', v: T.turnover == null ? '—' : `${T.turnover}%`, red: T.turnover != null && T.turnover > T.turnover_max, t: `${hpct(T.turnover_max)}%↓`, x: `${T.turnover_n}／${T.turnover_avg}人` });
  R.push({ head: '在籍期間', per: 'レギュラー' });
  [['y2', '2年〜'], ['y1', '1〜2年'], ['h', '半年〜1年']].forEach(([k, l]) => R.push({ sub: 1, l, v: `${pc(k)}%`, red: n > 0 && pc(k) < T.ten_min[k], t: `${hpct(T.ten_min[k])}%↑`, x: `${T.tenure[k] || 0}人` }));
  R.push({ sub: 1, l: '〜半年', v: `${pc('h0')}%`, red: n > 0 && pc('h0') > T.ten_max.h0, t: `${hpct(T.ten_max.h0)}%↓`, x: `${T.tenure.h0 || 0}人` });
  return R; }
const hNum = r => `<b style="display:inline-block;min-width:2.6em;font-size:12px;${r.red ? 'color:var(--warn)' : ''}">${esc(r.v)}</b><small class="muted" style="font-size:11px">（${esc(r.t)}）</small>${r.x ? `<small style="font-size:11px;margin-left:3px;${r.xr ? 'color:var(--warn);font-weight:700' : 'color:var(--muted)'}">${esc(r.x)}</small>` : ''}`;
const healthRowHtml = r => r.head
  ? `<div class="muted" style="font-size:13px;padding:1px 0;white-space:nowrap">${esc(r.head)}<small style="font-size:11px;margin-left:4px">${esc(r.per)}</small></div>`
  : `<div style="display:grid;grid-template-columns:88px auto;gap:4px;align-items:baseline;font-variant-numeric:tabular-nums;padding:1px 0"><span class="muted" style="font-size:13px;${r.sub ? 'padding-left:1em' : ''}">${esc(r.l)}${r.per ? `<small style="font-size:11px;margin-left:4px">${esc(r.per)}</small>` : ''}</span><span style="white-space:nowrap">${hNum(r)}</span></div>`;
/* 行を html に。広い画面は横に並べて行を減らし、せまい画面（マイページ）は1行に1つ（オーナー 11/26「右側にスペースがある。1列にしよう」）。
   1マス最小 200px の格子：幅に合わせて列の数が決まり、どの行でも列の始まり（数字の始まり）が縦にそろう。見出し（在籍期間）は前の行の空いたマスに置き、区分の4つは次の行の頭から（行を減らす。オーナー 11/26） */
function healthRowsHtml(R){
  const it = (r, i) => r.head
    ? `<span style="color:var(--muted);font-size:13px;white-space:nowrap">${esc(r.head)}<small style="font-size:11px;margin-left:4px">${esc(r.per)}</small></span>`
    : `<span style="display:flex;align-items:baseline;gap:4px;white-space:nowrap;${r.sub && !(R[i - 1] || {}).sub ? 'grid-column-start:1' : ''}"><span class="muted" style="flex:0 0 88px;box-sizing:border-box;${r.sub ? 'padding-left:13px;' : ''}font-size:13px">${esc(r.l)}${r.per ? `<small style="font-size:11px;margin-left:4px">${esc(r.per)}</small>` : ''}</span>${hNum(r)}</span>`;
  return R.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));column-gap:16px;font-variant-numeric:tabular-nums;padding:1px 0">${R.map(it).join('')}</div>` : ''; }
function healthHtml(H){ return H ? `<div style="font-size:14px;line-height:1.5;padding:2px 0 6px;margin-bottom:6px;border-bottom:1px solid var(--line)">${healthRowsHtml(healthRows(H))}</div>` : ''; }
/* 自動作成・確定の箱に出す、目安から外れた行だけ（無ければ空） */
function healthWarnHtml(H){ const R = healthRows(H).filter(r => r.red); return R.length ? `<div style="text-align:left;background:var(--warn-soft);border-radius:8px;padding:6px 12px;margin:10px 0 14px;font-size:14px">${R.map(healthRowHtml).join('')}</div>` : ''; }
/* 朝礼の「人員」（POS の朝礼・黒服のマイページの朝礼）。調整率は今月、不足率は前の営業日 */
function healthChoreiHtml(H, bd){ return H ? healthRowsHtml(healthRows(H, true, bd).concat(retentionRows(H.ret))) : ''; }
/* 人員の目安から外れた数（黒服のマイページの閉じた時の見出しに出す） */
function healthChoreiMiss(H, bd){ return H ? healthRows(H, true, bd).concat(retentionRows(H.ret)).filter(r => r.red).length : 0; }
/* 管理サイトの収支の「人員」（離職率と在籍期間） */
function retentionHtml(T){ return T ? healthRowsHtml(retentionRows(T)) : ''; }
// 伝票の品の並び順（オーナー 2026-11-17「セット 延長 VIP ボトル系 ドリンク系 BC HC にしよう」。どの画面・印刷でもこの1か所を使う）
// 品の種類：メニューの分類で見る（名前で見ない）。BC・HC＝集計の分類 HC の品（BC は料金設定の自動 BC の品）／ボトル系＝キープできる品か、分類がワイン・シャンパン・ボトル…／ドリンク系＝分類にドリンク／それ以外（フード・その他・立替金など）はドリンク系の後・BC の前
const ITEM_RANK={bottle:0,drink:1,other:2,bc:3,hc:4};
function itemKind(p,cat,st){ p=p||{}; const cn=(cat&&cat.name)||''; if(p.agg_category==='HC') return p.id===(st&&st.auto_bc_product_id)?'bc':'hc'; if(p.is_keepable||/シャンパン|ワイン|ボトル|焼酎|ウイスキー|ウィスキー|ブランデー/.test(cn)) return 'bottle'; return /ドリンク/.test(cn)?'drink':'other'; } /* 共通の部品は古い Safari（iPad）でも読めるよう ?. ?? を使わない */
// items を並び順に（同じ種類の中は今の順のまま）。kindOf(品)→itemKind の答え
function itemsInOrder(items,kindOf){ return (items||[]).map(function(x,i){ const r=ITEM_RANK[kindOf(x)]; return [x,i,r==null?2:r]; }).sort(function(a,b){ return a[2]-b[2]||a[1]-b[1]; }).map(function(a){ return a[0]; }); }
// 伝票の品 i の種類（products・categories は画面が持っているメニューと分類の一覧。st は料金設定）
function billItemKind(i,products,cats,st){ const p=(products||[]).find(function(x){ return x.id===i.product_id; })||null, cid=i.category_id||(p&&p.category_id); return itemKind(p,(cats||[]).find(function(c){ return c.id===cid; }),st); }
// データベースが品に付けた並び順の番号 rank（bill_item_rank：0 ボトル系・1 ドリンク系・2 それ以外・3 BC・4 HC）で並べる（管理サイトのように画面に分類が無い所）
function itemsByRank(items){ const kinds=Object.keys(ITEM_RANK); /* 並び順の番号 → 種類（ITEM_RANK の逆。表を2つ持たない） */ return itemsInOrder(items,function(i){ return kinds[i.rank]||'other'; }); }

/* 小窓の外枠（POS・管理サイト。07 の B2）。z＝重なりの順（無い時はサイトの CSS のまま）。html を渡すと箱に入れて画面に出す。渡さない時は呼ぶ側が中身を入れて出す */
function mkModal(z, html){ const m = document.createElement('div'); m.className = 'modal on'; if(z) m.style.zIndex = z; if(html != null){ m.innerHTML = `<div class="box">${html}</div>`; document.body.appendChild(m); } return m; }

/* 絵文字の代わりの絵（icons/ の svg。POS・管理サイト・タイムカード。07 の B5 ここへ） */
const FX = (n, px = 18) => `<img src="../icons/${n}.svg" alt="" style="width:${px}px;height:${px}px;vertical-align:-3px">`;

/* 入口の関数（pos_rows_add など。行の集まりを JSON で返す）の返しから1行目を取る。.single を付けると返しが {"pgrst_scalar":…} の形になり id が読めなかった（PR #423 の全体テスト）。行が無い時は失敗として返す */
function oneRow(r){ const d = r.data && r.data.length ? r.data[0] : null; return { data: d, error: r.error || (d ? null : { message: '保存できませんでした' }) }; }

/* 天気の番号（Open-Meteo）→ 言葉と絵（Meteocons）。POS の朝礼とマイページの黒服のホームで同じものを使う（07 の B5） */
const WXT=c=>c==null?['—',null]:c<=1?['晴れ','clear-night']:c===2?['晴れ時々くもり','partly-cloudy-night']:c===3?['くもり','overcast-night']:c<=48?['霧','fog-night']:c<=57?['霧雨','drizzle']:c<=67?['雨','rain']:c<=77?['雪','snow']:c<=82?['にわか雨','partly-cloudy-night-rain']:c<=86?['にわか雪','partly-cloudy-night-snow']:['雷雨','thunderstorms-night-rain'];
const WXI=(c,px)=>{ const [t,n]=WXT(c); return n?`<img src="https://cdn.jsdelivr.net/npm/@bybas/weather-icons@2.0.0/production/fill/all/${n}.svg" alt="${t}" style="width:${px}px;height:${px}px;display:block;margin:0 auto">`:'—'; };

/* レジの月の表の日ごとの並び：精算の記録がある日・まだ来ていない日・精算の無い日（前の日から続けて理論値＝繰越＋現金売上＋入金−出金）。管理サイトの月次と POS の閉店作業の月の表で同じ計算を使う（表の見た目と言葉はそれぞれ） */
function regDays(mo,last,today,byD,sum,carry){ const out=[];
  for(let i=1;i<=last;i++){ const dd=`${mo}-${String(i).padStart(2,'0')}`; const x=byD[dd];
    if(x){ out.push({dd,x}); carry=Number(x.next_float != null ? x.next_float : (x.counted-x.deposit))||0; continue; }
    if(dd>today){ out.push({dd,future:true}); continue; }
    const t=sum[dd]||{sales:0,cin:0,cout:0}; const exp=carry+t.sales+t.cin-t.cout; out.push({dd,t,exp,carry,idle:!t.sales&&!t.cin&&!t.cout}); carry=exp; }
  return out; }

/* その日のレジの材料は、データベースの cash_days の行から取る（POS の閉店作業と管理サイトの現金管理で同じ計算を使う。画面ごとに足し直さない）
   regDayCash：1日分の行 → 現金売上。regGap：前回の精算の翌日〜前日の行と、精算した日 → 未精算の日の現金の動き（現金売上＋入金−出金−日払）の合計と日付 */
function regDayCash(rows,d){ const x=(rows||[]).find(r=>r.business_date===d); return x?Number(x.sales)||0:0; }
function regGap(rows,doneDays){ const done=new Set(doneDays||[]), net={}; (rows||[]).forEach(x=>{ if(done.has(x.business_date)) return; const n=(Number(x.sales)||0)+(Number(x.cash_in)||0)-(Number(x.cash_out)||0)-(Number(x.advances)||0); if(n) net[x.business_date]=n; });
  const days=Object.keys(net).sort(); return {net:days.reduce((s,k)=>s+net[k],0),days}; }
/* 「○/○ が未精算です」を探し始める日（その次の日から前日までを見る）：前回の精算の日。ただし 32日より前なら 32日前（＝31日前から見る）。POS の閉店作業と管理サイトの現金管理で同じ（オーナー 2026-11-20） */
function regWarnFrom(d,prev){ const lo=dayAdd(d,-32); return prev&&prev>lo?prev:lo; }

/* レジ金合わせの式（POS の閉店作業と管理サイトの現金管理で同じ計算を使う）：理論値＝本日釣銭＋現金売上＋入金−出金・過不足＝数えた額−理論値・翌日釣銭準備金＝数えた額−預金。
   精算済の日（s＝精算の記録）は記録の値、まだの日は今の値（c）。本日釣銭が無い時（初回で未入力＝null）は理論値と過不足も null */
function regTotals(s,c){ const opening=s?s.opening_float:c.opening, sales=s?s.cash_sales:c.sales, cin=s?s.cash_in:c.cin, cout=s?s.cash_out:c.cout, counted=s?s.counted:c.counted, deposit=s?s.deposit:c.deposit;
  const expected=opening==null?null:opening+sales+cin-cout; return {opening,sales,cin,cout,expected,counted,deposit,diff:expected==null?null:counted-expected,next:counted-deposit}; }

/* 指で書く署名の板（マイページの報酬の受取のサイン・契約書の署名、POS の体験の報酬の受け取りのサイン）。clear：白紙に戻す／drawn：1回でも書いたか */
function signPad(cv){
  const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, Math.max(1, window.devicePixelRatio||1)); cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  const g = cv.getContext('2d'); g.scale(dpr, dpr); let drawn = false, down = false;
  const clear = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; drawn = false; }; clear();
  const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX-b.left)*W/b.width, (e.clientY-b.top)*H/b.height]; };
  cv.onpointerdown = e => { e.preventDefault(); down = true; try{ cv.setPointerCapture(e.pointerId); }catch(_){} const [a, b] = pos(e); g.beginPath(); g.moveTo(a, b); g.lineTo(a+0.1, b+0.1); g.stroke(); drawn = true; };
  cv.onpointermove = e => { if(!down) return; e.preventDefault(); const [a, b] = pos(e); g.lineTo(a, b); g.stroke(); };
  cv.onpointerup = cv.onpointercancel = () => { down = false; };
  return { clear, drawn: () => drawn };
}

/* 操作ログの名前の見せ方：「伝票取消」は「伝票削除」と見せる（記録の名前は変えない）。POS と管理サイトの操作ログで使う */
const actL=a=>kl(a==='伝票取消'?'伝票削除':a);

/* メニューを足す時のバック・ポイントのはじめの値（オーナー 2026-11-19：入れまちがいがあるので、広島はワイン・シャンパンだけ販売価格の10%・ポイントは販売価格÷1,000、ほかは0）。
   黒服が変えられる。POS の［設定］のメニュー追加とマイページのメニュー追加で使う */
const menuBackInit=(store,cat,price)=>{ const p=Math.max(0,Math.floor(Number(price)||0)); return store==='hiroshima'&&['ワイン','シャンパン'].includes(cat)?{back:Math.round(p/10),points:p/1000}:{back:0,points:0}; };

/* 「アプローチ」の半角の見出し（オーナー 11/25「アプローチを半角カタカナにできない？」。POS・管理サイト・黒服のマイページ。キャストのマイページは全角のまま）。
   半角は全角の見出しより小さく細く見えるので1割大きく、半角の「ﾟ」は1文字分の場所を取って「ｱﾌﾟ ﾛｰﾁ」と割れて見えるので後ろを詰める（olive.css の .hk） */
const APR_HK = '<span class="hk">ｱﾌ<i>ﾟ</i>ﾛｰﾁ</span>';
/* NG キャスト（SQL 745・オーナー 11/26「お客様が嫌いと言った女性が二度とつかないように」）：朝礼・来店予定・伝票で同じ1行。
   「NG」の字はうすい字、名前だけ赤（見本の OK）。list は [{name, active}]。キャストのマイページには出さない */
const ngNames = list => (list || []).map(x => esc(x.name) + (x.active === false ? '（退店）' : '')).join('・');
const ngLine = list => list && list.length ? `<span class="muted">NG</span> <span style="color:var(--warn)">${ngNames(list)}</span>` : '';
