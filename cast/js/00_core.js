// LINEマイページ：公式 LINE のメニュー → LINE ログイン（LIFF）→ 連携済みなら本人のページ、未連携なら4桁の番号。言葉を熟語に
// 銀座と広島で入口（LIFF）が別。?s= に店のコード
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ persistSession:false } });
const LIFF = { ginza:'2012027414-zlSsSUTA', hiroshima:'2012027414-BSyLe8IB' };
const STORE = new URLSearchParams(location.search).get('s') || (()=>{ try{ return localStorage.getItem('olive_cast_store'); }catch(e){ return null; } })() || '';
const jd = s => new Date(String(s).slice(0,10)+'T00:00:00+09:00'), mdWD = x => `${x.getMonth()+1}/${x.getDate()}（${WD[x.getDay()]}）`, mdDay = s => { const x = jd(s); return `${x.getMonth()+1}/${x.getDate()}`; }, mdW = s => mdWD(jd(s));
/* お客様のフリガナで検索（ひらがな・カタカナどちらでも。空白は無視） */
const DRESS = '<img src="../icons/dress.svg" alt="黒ドレス" style="width:15px;height:15px;vertical-align:-2px;margin-left:2px">'; /* 黒ドレスの着用者の名前の横（オーナー「イ 黒いドレスの形」。Phosphor） */
const HM = h => { const t=Math.round(Number(h||0)*60); return `${Math.floor(t/60)}時間${String(t%60).padStart(2,'0')}分`; };
let TOKEN = null, ME = null, pollT = null, SHIFT_ALL = false; /* KL（係の呼び方）は共通の部品 lib/olive/core.js */

// 入力の途中保存（ゲネプロ マイページ #4。画面を閉じて開き直すと消えていた）。この端末だけに1日まで残す。提出したら消す
function draftBind(key, ids){ const k = 'olive_cast_draft_' + key + '_' + STORE; let v = {}; try{ v = JSON.parse(localStorage.getItem(k) || '{}'); }catch(e){}
  if(!v.at || Date.now() - v.at > 86400000) v = {}; let had = false;
  const save = () => { const o = { at: Date.now() }; ids.forEach(id => { const el = $(id); if(el) o[id] = el.value; }); try{ localStorage.setItem(k, JSON.stringify(o)); }catch(e){} };
  ids.forEach(id => { const el = $(id); if(!el) return; if(v[id] != null && v[id] !== '' && v[id] !== el.value){ el.value = v[id]; had = true; } el.addEventListener('input', save); el.addEventListener('change', save); });
  return { had, clear(){ try{ localStorage.removeItem(k); }catch(e){} } }; }

/* 写真は3枚ずつ同時に送る（前は1枚ずつ。TODO は40枚まで）。one(i) で i 枚目を送る・done(k) は送り終わった枚数。失敗したら残りは送らず、送っている分を待ってから止める */
async function upPool(n, one, done){ let next = 0, fin = 0, ng = null;
  const w = async () => { while(next < n && !ng){ const i = next++; try{ await one(i); fin++; if(done) done(fin); }catch(e){ ng = ng || e; } } };
  await Promise.all(Array.from({ length: Math.min(3, n) }, w)); if(ng) throw ng; }

// ---- 画面の共通の部品（どの画面も使う：小窓・画面の入れ替え・表示できない時・戻る・読めなかった時の1行） ----
// 確認・お知らせは画面の中の窓で出す（ブラウザの窓にはサイトのアドレスが出るため。オーナー）
function dlg(msg, ok, cancel, html){ if(!html) msg = jaNet(msg); /* html は呼ぶ側でエスケープ済み（黒ドレスのしるしを出す小窓） */ return new Promise(res => { const d = document.createElement('div'); d.className = 'dlg';
  d.innerHTML = `<div class="box"><p>${html ? msg : esc(msg)}</p><div class="bt">${cancel?'<button class="btn g" data-k="no">キャンセル</button>':''}<button class="btn" data-k="ok">${esc(ok)}</button></div></div>`;
  document.body.appendChild(d); d.querySelector('[data-k=ok]').onclick = () => { d.remove(); res(true); }; const n = d.querySelector('[data-k=no]'); if(n) n.onclick = () => { d.remove(); res(false); }; }); }
UI.box = o => dlg(o.msg, o.ok, o.cancel); /* 知らせの箱の見た目（マイページの小窓）。uiAlert・uiConfirm は lib/olive/core.js */
// 見るだけの小窓は OK ではなく右上の × で閉じる（オーナー「閉じるんだったら×でいいよね」）。inner は呼ぶ側でエスケープ済み
function xBox(inner, done){ const d = document.createElement('div'); d.className = 'dlg'; d.innerHTML = `<div class="box xv"><button class="xb dx" data-k="x" aria-label="閉じる">×</button>${inner}</div>`;
  document.body.appendChild(d); d.querySelector('[data-k=x]').onclick = () => { d.remove(); if(done) done(); }; return d; }
const uiView = m => new Promise(res => xBox(`<p>${esc(m)}</p>`, res)), uiViewH = m => new Promise(res => xBox(`<p>${m}</p>`, res));
function show(html){ $('main').innerHTML = html; window.scrollTo(0,0); }
function fail(msg){ msg = jaNet(msg); show(`<div class="card c"><div class="big">表示できません</div><p class="err">${esc(msg)}</p><p class="muted sm">公式 LINE のメニューから再度開いてください</p></div>`); }

function setBack(fn){ const b=$('tBack'); b.classList.toggle('hide', !fn); $('tSub').classList.toggle('hide', !!fn); b.onclick = fn || null; backFn = fn || null; if(fn && !(history.state && history.state.ol)) { try{ history.pushState({ ol:1 }, ''); }catch(e){} } }
/* スマホ・LINE の「戻る」で、マイページから出ずに左上の「戻る」と同じ動きにする（ゲネプロ マイページ #3） */
let backFn = null;
window.addEventListener('popstate', () => { if(!backFn) return; const f = backFn; f(); if(backFn) { try{ history.pushState({ ol:1 }, ''); }catch(e){} } });

//点検 B5：読めなかった時に、ボタン・件数が黙って消えないように、画面の上に1行（1回だけ）
function loadNg(){ const m = $('main'); if(!m || m.querySelector('.ldng')) return; m.insertAdjacentHTML('afterbegin', '<p class="err sm ldng" style="margin:0 2px 8px">読み込めない項目があります。開き直してください</p>'); }
