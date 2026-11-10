/* 全部のサイトで使う小さい部品（07 の B1）。前は POS・管理サイト・マイページ・顧客サイト・タイムカード・鍵にそれぞれコピーがあり、1つ直してもほかが直らなかった。
   ここを直せば全部のサイトが直る。サイトの中で同じ名前を作らない（見張り guard/count.py が数える）。タイムカードの古い Safari でも動くように ?. ?? は使わない */

/* 画面の部品を id で探す */
const $ = id => document.getElementById(id);

/* 文字を安全に画面に出す（< > & " ' をそのまま出す） */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 電波が悪い時の英語の知らせ（Failed to fetch など）を日本語に */
const jaNet = m => /Failed to fetch|Load failed|NetworkError|Network request failed|fetch failed|AuthRetryableFetchError/i.test(String(m)) ? '通信できませんでした。再度お試しください' : m;

/* 金額「78,000円」。数字でない物（前から文字で渡している所）はそのまま */
const yen = n => { const v = Number(n || 0); return (isNaN(v) ? String(n) : v.toLocaleString('ja-JP')) + '円'; };

/* フリガナ：カタカナで保存する（ひらがな・半角で入れてもカタカナに）。探す時は空白を無視 */
const kanaFix = v => String(v || '').normalize('NFKC').replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60)).replace(/\s+/g, ' ').trim();
const kanaKey = v => kanaFix(v).replace(/ /g, '');
const kanaHit = (c, q) => { const k = kanaKey(q); return !!k && kanaKey(c.kana).includes(k); };
const kanaBad = v => !!v && !/^[ァ-ヶー・ ]+$/.test(v);

/* ログインの鍵を iPad の中（IndexedDB の olive_keys）に置く・読む。POS・管理サイト・顧客サイト・タイムカードで同じ置き場を使う */
const keyDb=(mode,fn)=>new Promise(res=>{ try{ const r=indexedDB.open('olive_keys',1); r.onupgradeneeded=()=>{ r.result.createObjectStore('k'); }; r.onsuccess=()=>{ try{ const tx=r.result.transaction('k',mode), q=fn(tx.objectStore('k')); tx.oncomplete=()=>res(q&&q.result!=null?q.result:null); tx.onerror=()=>res(null); }catch(e){ res(null); } }; r.onerror=()=>res(null); }catch(e){ res(null); } });

/* 大きい部品は使う時だけ読む（開くのを速くするため）。needLib('jsqr') → QR の画像を読む・needLib('qrcode') → QR を作る。2回目からは読まない */
const needLib = (() => { const F = { jsqr: 'jsqr-1.4.0.js', qrcode: 'qrcode-1.4.4.js' }, P = {};
  return name => P[name] || (P[name] = new Promise((ok, ng) => { const s = document.createElement('script'); s.src = '../lib/' + F[name]; s.onload = ok; s.onerror = () => { delete P[name]; ng(new Error('部品を読み込めませんでした（' + name + '）')); }; document.head.appendChild(s); })); })();

/* 「係」の呼び方（店ごとに「担当」など）。kReg で画面の文字を登録し、kSet で店の呼び方に入れかえる。POS・管理サイト・顧客サイトで同じ */
let KL = '係'; const kl = s => KL === '係' ? s : String(s == null ? '' : s).replace(/係/g, KL); const KT = [];
function kReg(...os){ const walk=o=>{ for(const k of Object.keys(o)){ const v=o[k]; if(typeof v==='string'){ if(v.includes('係')) KT.push([o,k,v]); } else if(v&&typeof v==='object') walk(v); } }; os.forEach(walk); }
function kSet(v){ KL=(v&&String(v).trim())||'係'; KT.forEach(([o,k,v])=>{ o[k]=kl(v); }); }

/* 営業日「2026-11-10」（朝 8:00 までは前の日）。POS と管理サイトで同じ */
function businessDate(d=new Date()){ const x=new Date(d.getTime()-8*3600*1000); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }

/* 予約の「同伴・係・誘客」の1行（POS の朝礼・マイページの黒服の朝礼とシフト・管理サイトのシフトと予約で同じ形）。
   同伴と係は別のもの：銀座は同伴しても係にならないので、同伴の予約にも係を出す。広島は係（担当）を出さない（o.noKK）。
   誘客は同伴の子と同じ人なら出さない。r = { douhan, dh: 同伴の子の名前, by: 誘客, kakari: 係, black: 黒ドレスの子 }・o.mark = 黒ドレスのしるし・o.kl = 係の呼び方 */
function resvWho(r, o){ o = o || {}; const dh = r.douhan ? (r.dh && r.dh.length ? r.dh : [r.by]) : [], p = [];
  if(dh.length) p.push('同伴 ' + dh.map(n => esc(n) + (o.mark && n && n === r.black ? o.mark : '')).join('・'));
  if(!o.noKK) p.push((o.kl || KL) + ' ' + esc(r.kakari || '—'));
  if(r.by && dh.indexOf(r.by) < 0) p.push('誘客 ' + esc(r.by));
  return p.join('・'); }

/* 07 の B5：POS と管理サイトに1文字も同じコピーがあった部品（2026-11-11 ここへ）。
   ceil5＝来店の時刻を5分切り上げ（09:17→09:20）／guard＝押している間はボタンを押せなくする（二重送信よけ）／
   sbAll＝1000行ずつ全部読む（読めない時は読めた分と error）／logShort＝操作ログの中身を短い1行に（金額・分・人数・日付は値だけ） */
const ceil5=t=>{ const d=new Date(t); d.setSeconds(0,0); d.setMinutes(d.getMinutes()+(5-d.getMinutes()%5)%5); return d; };
function guard(btn,fn){ return async(...a)=>{ if(btn.disabled) return; btn.disabled=true; try{ await fn(...a); } finally{ btn.disabled=false; } }; }
async function sbAll(mk){ let all=[]; for(let from=0;;from+=1000){ const r=await mk().range(from,from+999); if(r.error) return {data:all.length?all:null,error:r.error}; all=all.concat(r.data||[]); if((r.data||[]).length<1000) return {data:all,error:null}; } }
const logShort=(o,KJ,val,unit)=>{ const e=Object.entries(o||{}).filter(([k,v])=>v!==null&&v!==undefined&&v!==''&&!(Array.isArray(v)&&!v.length)&&k!=='table'&&k!=='reason'); e.sort((a,b)=>(a[0]==='by'?-1:0)-(b[0]==='by'?-1:0));
  const md=v=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); return m?`${+m[2]}/${+m[3]}`:String(v); }, U={amount:'円',total:'円',total_before:'円',minutes:'分',guest_count:'名'};
  return e.map(([k,v])=>{ const n=typeof v==='number'?v.toLocaleString('ja-JP')+(U[k]||''):null;
    if(k==='by') return '操作者：'+String(v).replace(/^管理サイト：/,'');
    if(k==='date'||k==='business_date') return md(v);
    if(k==='kind'&&(v==='in'||v==='out')) return v==='in'?'入金':'出金';
    if(k==='is_auto') return v?'自動延長':'手動延長';
    if(['amount','minutes','guest_count'].includes(k)&&n!=null) return n;
    if(k==='method'||k==='name'||k==='email') return val(v);
    return `${KJ[k]||k}：${n!=null?n:val(v)}`; }).join(' ／ '); }; /* 2026-10-14：内容は短く（オーナー「長い」）。金額・分・人数・日付・入金／出金は値だけ */
