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
