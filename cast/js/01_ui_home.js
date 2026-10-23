// v0.11：確認・お知らせは画面の中の窓で出す（ブラウザの窓にはサイトのアドレスが出るため。オーナー 2026-10-15）
function dlg(msg, ok, cancel){ return new Promise(res => { const d = document.createElement('div'); d.className = 'dlg';
  d.innerHTML = `<div class="box"><p>${esc(msg)}</p><div class="bt">${cancel?'<button class="btn g" data-k="no">キャンセル</button>':''}<button class="btn" data-k="ok">${esc(ok)}</button></div></div>`;
  document.body.appendChild(d); d.querySelector('[data-k=ok]').onclick = () => { d.remove(); res(true); }; const n = d.querySelector('[data-k=no]'); if(n) n.onclick = () => { d.remove(); res(false); }; }); }
const uiAlert = m => dlg(m, 'OK', false), uiConfirm = (m, ok = 'OK') => dlg(m, ok, true);
function show(html){ $('main').innerHTML = html; window.scrollTo(0,0); }
function fail(msg){ show(`<div class="card c"><div class="big">表示できません</div><p class="err">${esc(msg)}</p><p class="muted sm">公式 LINE のメニューから再度開いてください</p></div>`); }

async function start(){
  if(!LIFF[STORE]){ fail('店舗を特定できません（公式 LINE のメニューから開いてください）'); return; }
  try{ localStorage.setItem('olive_cast_store', STORE); }catch(e){}
  try{ await liff.init({ liffId: LIFF[STORE] }); }catch(e){ fail('LINE の初期化に失敗しました：' + (e.message||e)); return; }
  if(!liff.isLoggedIn()){ liff.login({ redirectUri: location.href }); return; }
  await login();
}

// LINE の id_token をデータベースで認証 → 入場券、または連携用の番号
async function login(){
  const idt = liff.getIDToken();
  if(!idt){ liff.login({ redirectUri: location.href }); return; }
  const r = await sb.rpc('cast_login', { p_store: STORE, p_id_token: idt });
  if(r.error){ if(/認証|確かめ/.test(r.error.message)){ liff.logout(); liff.login({ redirectUri: location.href }); return; } fail(r.error.message); return; }
  if(r.data.status === 'link'){ showLink(r.data); return; }
  if(r.data.status === 'store'){ /* SQL 222：ほかの店で連携している人（開いたトークに欠勤・予約の LINE が届くため開かない） */
    show(`<div class="card c"><div class="big">表示できません</div><p class="err">${esc(r.data.store_name)} の公式 LINE のメニューから再度開いてください</p></div>`); return; }
  TOKEN = r.data.token; clearTimeout(pollT); await loadMe();
}

// 未連携：番号を表示し、黒服が POS で入力するのを待つ（5秒ごとに確認）
function showLink(d){
  show(`<div class="card c"><div class="big">ようこそ</div><p>この LINE は未連携です。</p><p>黒服にこの番号をお伝えください。</p>
    <div class="code">${esc(d.code)}</div><p class="muted sm">番号は10分で更新されます。連携が完了すると自動で切り替わります</p></div>`);
  clearTimeout(pollT); pollT = setTimeout(login, 5000);
}

async function loadMe(){
  { const w = await sb.rpc('cast_who', { p_token: TOKEN }); /* v0.33・SQL 133：黒服が開いた時は黒服マイページ */
    if(!w.error && w.data && w.data.kind === 'hall'){ await hallLoad(); return; }
    if(!w.error && w.data && w.data.kind !== 'cast'){ show(`<div class="card c"><div class="big">${esc(w.data.name)} さん</div><p>LINE連携は完了しています。</p><p class="muted sm">黒服マイページは準備中です。連絡先交換のまとめは、この公式 LINE に届きます</p></div>`); return; } }
  const r = await sb.rpc('cast_me', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  ME = r.data; KL = ME.kakari_label || '係';
  // v0.50：下の5つは同時に読む（ゲネプロ マイページ #11。前は1つずつ順番で、通信が遅いと待ちが何倍にもなった）
  const [d, , bm, bd, n] = await Promise.all([sb.rpc('cast_dress_info', { p_token: TOKEN }), docsLoad() /* v0.20・SQL 120：書類の未提出の数 */,
    sb.rpc('cast_bill_months', { p_token: TOKEN }) /* v0.36・SQL 134：伝票一覧の件数 */, sb.rpc('cast_birthdays', { p_token: TOKEN }) /* v0.40・SQL 150：トップに「お誕生日（前後2週間）」（オーナー 2026-10-18） */,
    sb.rpc('cast_notice_list', { p_token: TOKEN })]);
  ME.dress = d.error ? null : d.data; ME.billMonths = bm.error ? null : (bm.data || []); ME.bdays = bd.error ? [] : (bd.data || []);
  { NOTICES = n.error ? [] : (n.data || []); ME.unread = NOTICES.filter(x => !x.read).length; } /* v0.18・SQL 118：お知らせの未確認の数 */ /* v0.12・SQL 110：ドレス新調日（店が「する」の時だけボタンを出す） */
  $('tStore').textContent = ME.store_name || 'OLIVE';
  home();
  { const th = thxParam(); if(th) resvThanksById(th); const nt = urlParam('notice'); if(nt) noticeOpen(nt); else castGo(goParam()); } /* v0.16・SQL 115：係に届いた LINE の「ありがとう」から開いた時 */
}

// v0.64・SQL 221：キャストのリッチメニューのボタンから、その画面を直接開く（?go=。オーナー 2026-10-23 見本 キャストのリッチメニュー_案）。連絡先交換は LINE のリンクと同じく入力から
function castGo(k){
  if(!k) return; try{ const u = new URL(location.href); u.searchParams.delete('go'); history.replaceState(history.state, '', u.toString()); }catch(e){} /* 開き直した時にもう一度飛ばない */
  if(k === 'contact') contactList(true); else if(k === 'shift') shiftHome(); else if(k === 'sales') salesHome(); else if(k === 'resv') resvList(); else if(k === 'perf') perf();
}

// スライド表の「次の段」の文：あと○○で 時給○円
const UNIT = { sales:v=>`${Math.round(v/10000).toLocaleString('ja-JP')}万円`, points:v=>`${v}ポイント`, douhan:v=>`${v}回`, days:v=>`${v}日`, reactions:v=>`${v}回`, groups:v=>`${v}組`, guests:v=>`${v}名` };
const BASIS = { sales:()=>KL+'小計', points:()=>'ポイント', douhan:()=>'同伴', days:()=>'稼働日数', reactions:()=>'反応◎', groups:()=>KL+'の組数', guests:()=>KL+'の人数' };
function nextTxt(s){
  const u = s.unit === 'daily' ? '日給' : '時給';
  if(s.next_threshold == null) return `最上段（${u} ${yen(s.cur_amount)}）`;
  const rest = Number(s.next_threshold) - Number(s.value||0), f = UNIT[s.basis] || (v=>v);
  return `あと ${f(s.basis==='points'?Math.round(rest*10)/10:Math.ceil(rest))}で ${u} ${yen(s.next_amount)}`;
}
function wageNow(){ const st = ME.stats||{}; if(st.wage) return Number(st.wage); const a = (ME.slides||[]).map(s=>Number(s.cur_amount||0)); return a.length ? Math.max(...a) : 0; }

function setBack(fn){ const b=$('tBack'); b.classList.toggle('hide', !fn); $('tSub').classList.toggle('hide', !!fn); b.onclick = fn || null; backFn = fn || null; if(fn && !(history.state && history.state.ol)) { try{ history.pushState({ ol:1 }, ''); }catch(e){} } }
/* v0.48：スマホ・LINE の「戻る」で、マイページから出ずに左上の「戻る」と同じ動きにする（ゲネプロ マイページ #3） */
let backFn = null;
window.addEventListener('popstate', () => { if(!backFn) return; const f = backFn; f(); if(backFn) { try{ history.pushState({ ol:1 }, ''); }catch(e){} } });

function home(){
  if(ME && ME.hall){ hallHome(); return; }
  setBack(null);
  const st = ME.stats||{}, sl = (ME.slides||[]).find(s=>s.basis==='sales') || (ME.slides||[])[0];
  let top = `<div class="row"><span>今月の${esc(KL)}小計</span><b>${Math.round(Number(st.sales||0)/10000).toLocaleString('ja-JP')}万円</b></div>`;
  if(sl && sl.next_threshold != null){
    const pct = Math.max(0, Math.min(100, Number(sl.value||0) / Number(sl.next_threshold) * 100));
    top += `<div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div><div class="muted sm">${esc(nextTxt(sl))}</div>`;
  } else if(sl) top += `<div class="muted sm">${esc(nextTxt(sl))}</div>`;
  const tile = (k,t,s,on) => `<button class="tile" data-go="${k}" ${on?'':'disabled'}>${on?'':'<span class="soon">準備中</span>'}<b>${t}</b>${s?`<small>${s}</small>`:''}</button>`;
  const bdRow = b => { const cu = (b.kind_label||'お客様') === 'お客様', past = b.in < 0; return `<div class="row"${past?' style="color:var(--muted)"':''}><span><b class="${b.in===0?'err':''}" style="display:inline-block;min-width:5.6em">${b.in===0?'本日':past?(-b.in)+'日前':'あと'+b.in+'日'}</b>${esc(b.name)}${cu?' 様':''} <small class="muted">${esc(b.birthday)}</small></span><small class="muted">${cu?(b.kakari?esc(KL)+' '+esc(b.kakari):''):esc(b.kind_label)}</small></div>`; };
  const bdCard = (ME.bdays||[]).length ? `<div class="card"><div class="gh">お誕生日（前後2週間）</div>${ME.bdays.map(bdRow).join('')}</div>` : '';
  top += `<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button class="lkb" data-go="perf">詳細</button>${ME.billMonths?'<button class="lkb" data-go="bills">伝票一覧</button>':''}<button class="lkb" data-go="pay">報酬明細</button></div>`; /* v0.41・v0.44：成績・伝票一覧・報酬明細は小計の箱のボタンに（オーナー 2026-10-18「ボタンを減らせる」） */
  show(`<div class="hello">${esc(ME.name)} さん</div><div class="card">${top}</div>${bdCard}
    <div class="tiles">${tile('shift','シフト','提出・確定・打刻',true)}${tile('resv','予約／同伴','',true)}${tile('absent','欠勤連絡','',true)}${tile('contact','連絡先交換','',true)}${tile('sales','アプローチ','',true)}${ME.docs&&ME.docs.target?tile('docs','書類',ME.docs.left?`未提出 ${ME.docs.left}件`:'',true):''}${tile('card','名刺発注','',true)}${ME.dress?.enabled?tile('dress','ドレス新調日','',true):''}${tile('info','お知らせ',ME.unread?`未確認 ${ME.unread}件`:'',true)}</div>`);
  $('main').querySelector('[data-go=perf]').onclick = perf;
  $('main').querySelector('[data-go=absent]').onclick = absent;
  { const b = $('main').querySelector('[data-go=bills]'); if(b) b.onclick = () => castBills(null); }
  $('main').querySelector('[data-go=pay]').onclick = payslip;
  $('main').querySelector('[data-go=card]').onclick = cardOrder;
  { const b = $('main').querySelector('[data-go=docs]'); if(b) b.onclick = docsList; }
  $('main').querySelector('[data-go=resv]').onclick = resvList;
  $('main').querySelector('[data-go=contact]').onclick = () => contactList();
  $('main').querySelector('[data-go=sales]').onclick = salesHome;
  $('main').querySelector('[data-go=shift]').onclick = shiftHome;
  $('main').querySelector('[data-go=info]').onclick = noticeList;
  { const d = $('main').querySelector('[data-go=dress]'); if(d) d.onclick = dressReport; }
}

function perf(){
  setBack(home);
  const st = ME.stats||{}, r = (k,v,c='') => `<div class="row ${c}"><span>${k}</span><b>${v}</b></div>`;
  const [y,m] = String(ME.month).split('-').map(Number), d = Number(String(ME.business_date).slice(8,10));
  const u = ME.pay_type === 'daily' ? '日給' : '時給';
  const slides = (ME.slides||[]).map(s=>`<div class="muted sm">${esc(s.name)}：${esc(nextTxt(s))}</div>`).join('');
  const q = st.quota != null && Number(st.quota) > 0 ? Number(st.quota) : null, dh = Number(st.douhan||0);
  const dhCard = q ? `${r('同伴', `${dh}回 / ノルマ ${q}回`, dh<q?'warn':'')}${dh<q?`<div class="muted sm">あと${q-dh}回（未達の場合は月末に罰金）</div>`:'<div class="muted sm">ノルマ達成</div>'}` : r('同伴', `${dh}回`);
  const fines = (ME.fines||[]), fsum = Number(st.fines||0);
  const fl = fines.map(f=>`<div class="muted sm">${Number(String(f.date).slice(5,7))}/${Number(String(f.date).slice(8,10))} ${esc(f.reason||'')}　${f.wage_pct?`時給の${f.wage_pct}%`:yen(f.amount)}</div>`).join('');
  show(`<div class="subh">${m}月（${m}/${d} まで）</div>
    <div class="card">${r(esc(KL)+'小計', yen(st.sales))}${r(`決定${u}（今）`, wageNow()?yen(wageNow()):'—')}${slides}</div>
    <div class="card">${dhCard}</div>
    <div class="card">${r('出勤日数', `${Number(st.days||0)}日`)}${r('稼働時間', HM(st.hours))}${r('ポイント', `${Number(st.points||0)}`)}${r('反応◎', `${Number(st.reactions||0)}回`)}</div>
    <div class="card">${r('罰金（今月）', fines.length?yen(fsum):'なし')}${fl}</div>`);
}

