// LINEマイページ v0.01（SQL 096）：公式 LINE のメニュー → LINE ログイン（LIFF）→ 連携済みなら本人のページ、未連携なら4桁の番号。v0.02：言葉を熟語に
// 銀座と広島で入口（LIFF）が別。?s= に店のコード
const SUPABASE_URL = 'https://gjqaxenwvvazhjtziusf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pPfJUvJd6iJeHBNiD7XkWA_2RKF7JYw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ persistSession:false } });
const LIFF = { ginza:'2012027414-zlSsSUTA', hiroshima:'2012027414-BSyLe8IB' };
const STORE = new URLSearchParams(location.search).get('s') || (()=>{ try{ return localStorage.getItem('olive_cast_store'); }catch(e){ return null; } })() || '';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen = n => Number(n||0).toLocaleString('ja-JP') + '円';
const HM = h => { const t=Math.round(Number(h||0)*60); return `${Math.floor(t/60)}時間${String(t%60).padStart(2,'0')}分`; };
let TOKEN = null, ME = null, KL = '係', pollT = null;

