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
let TOKEN = null, ME = null, KL = '係', pollT = null, SHIFT_ALL = false;

// v0.50：入力の途中保存（ゲネプロ マイページ #4。画面を閉じて開き直すと消えていた）。この端末だけに1日まで残す。提出したら消す
function draftBind(key, ids){ const k = 'olive_cast_draft_' + key + '_' + STORE; let v = {}; try{ v = JSON.parse(localStorage.getItem(k) || '{}'); }catch(e){}
  if(!v.at || Date.now() - v.at > 86400000) v = {}; let had = false;
  const save = () => { const o = { at: Date.now() }; ids.forEach(id => { const el = $(id); if(el) o[id] = el.value; }); try{ localStorage.setItem(k, JSON.stringify(o)); }catch(e){} };
  ids.forEach(id => { const el = $(id); if(!el) return; if(v[id] != null && v[id] !== '' && v[id] !== el.value){ el.value = v[id]; had = true; } el.addEventListener('input', save); el.addEventListener('change', save); });
  return { had, clear(){ try{ localStorage.removeItem(k); }catch(e){} } }; }
