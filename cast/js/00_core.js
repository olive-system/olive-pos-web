// LINEマイページ v0.01（SQL 096）：公式 LINE のメニュー → LINE ログイン（LIFF）→ 連携済みなら本人のページ、未連携なら4桁の番号。v0.02：言葉を熟語に
// 銀座と広島で入口（LIFF）が別。?s= に店のコード
const SUPABASE_URL = 'https://gjqaxenwvvazhjtziusf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pPfJUvJd6iJeHBNiD7XkWA_2RKF7JYw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ persistSession:false } });
const LIFF = { ginza:'2012027414-zlSsSUTA', hiroshima:'2012027414-BSyLe8IB' };
const STORE = new URLSearchParams(location.search).get('s') || (()=>{ try{ return localStorage.getItem('olive_cast_store'); }catch(e){ return null; } })() || '';
const $ = id => document.getElementById(id);
const WD = ['日','月','火','水','木','金','土'];
const jd = s => new Date(String(s).slice(0,10)+'T00:00:00+09:00'), mdWD = x => `${x.getMonth()+1}/${x.getDate()}（${WD[x.getDay()]}）`, mdDay = s => { const x = jd(s); return `${x.getMonth()+1}/${x.getDate()}`; }, mdW = s => mdWD(jd(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* v1.41・SQL 380：お客様のフリガナで検索（ひらがな・カタカナどちらでも。空白は無視） */
const kanaKey = v => String(v || '').normalize('NFKC').replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60)).replace(/\s+/g, '');
const DRESS = '<img src="../icons/dress.svg" alt="黒ドレス" style="width:15px;height:15px;vertical-align:-2px;margin-left:2px">'; /* v1.30・SQL 368：黒ドレスの着用者の名前の横（オーナー 2026-11-05「イ 黒いドレスの形」。Phosphor） */
const yen = n => Number(n||0).toLocaleString('ja-JP') + '円';
const HM = h => { const t=Math.round(Number(h||0)*60); return `${Math.floor(t/60)}時間${String(t%60).padStart(2,'0')}分`; };
let TOKEN = null, ME = null, KL = '係', pollT = null, SHIFT_ALL = false;

// v0.50：入力の途中保存（ゲネプロ マイページ #4。画面を閉じて開き直すと消えていた）。この端末だけに1日まで残す。提出したら消す
function draftBind(key, ids){ const k = 'olive_cast_draft_' + key + '_' + STORE; let v = {}; try{ v = JSON.parse(localStorage.getItem(k) || '{}'); }catch(e){}
  if(!v.at || Date.now() - v.at > 86400000) v = {}; let had = false;
  const save = () => { const o = { at: Date.now() }; ids.forEach(id => { const el = $(id); if(el) o[id] = el.value; }); try{ localStorage.setItem(k, JSON.stringify(o)); }catch(e){} };
  ids.forEach(id => { const el = $(id); if(!el) return; if(v[id] != null && v[id] !== '' && v[id] !== el.value){ el.value = v[id]; had = true; } el.addEventListener('input', save); el.addEventListener('change', save); });
  return { had, clear(){ try{ localStorage.removeItem(k); }catch(e){} } }; }

/* v0.94：写真は3枚ずつ同時に送る（前は1枚ずつ。TODO は40枚まで）。one(i) で i 枚目を送る・done(k) は送り終わった枚数。失敗したら残りは送らず、送っている分を待ってから止める */
async function upPool(n, one, done){ let next = 0, fin = 0, ng = null;
  const w = async () => { while(next < n && !ng){ const i = next++; try{ await one(i); fin++; if(done) done(fin); }catch(e){ ng = ng || e; } } };
  await Promise.all(Array.from({ length: Math.min(3, n) }, w)); if(ng) throw ng; }
// 指で書く署名の板（報酬の受取のサイン 07_sign・契約書の署名 14_docs）。前は同じものが2つのファイルにあった（2026-11-08 コード整理）
// clear()：白紙に戻す／drawn()：1回でも書いたか
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
