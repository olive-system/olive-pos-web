// このファイルは2つ：前半はキャストの伝票一覧（castBills・blPaint）、後半は黒服のマイページのホーム（hallLoad から下）。どちらも「自分の分を読んで並べる」画面で、ファイルを分けた時に同じ所に置いた
// 伝票一覧（自分が係の伝票。今月の分・前月の分は翌月3日まで＝見せる月の決まりは cast_bill_months の側。下の画面の文はその説明）。お客様を押すと明細が開く
let billOpen = new Set(); /* 明細を開いている伝票の id（月を変えても開いたまま。id は伝票ごとにちがうので、ほかの月の伝票には効かない） */
const PAYN = { /* 支払い方法の名前（ここに無い方法は、そのまま出す） */ cash:'現金', card:'カード', invoice:'請求書', oki:'置き' };
let blD = null; /* 伝票一覧の今の中身：M＝月ごとの件数・m＝開いている月・B＝その月の伝票（明細を開く・閉じる時は読み直さない） */
async function castBills(month){
  setBack(home); if(!$('blBox')) show('<div class="card c muted">読み込み中…</div>');
  /* 月がわかる時（月のボタン・トップで読んだ件数の最初の月）は、件数と伝票を同時に読む（前は順番に待っていた）。
     g＝先に読み始めた月。件数を読んだ後に開く月 m が g とちがう時（トップの後に月が変わった）だけ、m で読み直す（先に読んだ pB は使わない）。
     件数が0件で m も無い時は、p_month が null のまま呼び、関数は0件を返す */
  const g = month || (ME && ME.billMonths && ME.billMonths[0] && ME.billMonths[0].month) || null;
  const pM = sb.rpc('cast_bill_months', { p_token: TOKEN }), pB = g ? sb.rpc('cast_bills', { p_token: TOKEN, p_month: g }) : null;
  const ms = await pM; if(ms.error){ fail(ms.error.message); return; }
  const M = ms.data || [], m = month || (M[0] && M[0].month);
  const r = await (pB && m === g ? pB : sb.rpc('cast_bills', { p_token: TOKEN, p_month: m })); if(r.error){ fail(r.error.message); return; }
  blD = { M, m, B: r.data || [] }; blPaint();
}
function blPaint(){
  /* L＝明細の1行。セット・延長は VIP 卓の分（vip_set・vip_ext）も同じ行に足して出す */
  const { M, m, B } = blD, mo = x => `${Number(String(x).slice(5,7))}月`, tm = t => t ? new Date(t).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}) : '';
  const L = (k, v, c='') => `<div class="row ${c}" style="font-size:14px"><span>${k}</span><span>${v}</span></div>`;
  const bill = b => { const c = b.calc || {}, op = billOpen.has(b.id), d = new Date(b.date+'T00:00:00+09:00');
    let h = `<div class="card" data-bl="${b.id}" style="cursor:pointer"><div class="row"><b>${esc(b.customers||'お客様')} 様</b><b>${yen(c.amount_due)}</b></div>
      <div class="muted sm">${mdWD(d)}　${esc(b.table||'')}${b.table?'・':''}${N(b.guests)}名　${tm(b.open)}〜${tm(b.close)}</div>`;
    if(op){ const items = (b.items||[]).map(i => L(`${esc(i.name)}${N(i.qty)>1?` ×${N(i.qty)}`:''}`, (N(i.qty)*N(i.price)).toLocaleString('ja-JP'))).join('');
      h += `<div style="border-top:1px solid var(--line);margin-top:8px;padding-top:6px">${N(c.set)+N(c.vip_set)?L(`セット${c.set_guests?` ${N(c.set_guests)}名`:''}`, (N(c.set)+N(c.vip_set)).toLocaleString('ja-JP')):''}${N(c.extension)+N(c.vip_ext)?L('延長', (N(c.extension)+N(c.vip_ext)).toLocaleString('ja-JP')):''}${items}
        ${N(c.adjustment)?L(N(c.adjustment)<0?'値引':'値増', N(c.adjustment).toLocaleString('ja-JP')):''}${N(c.service)?L(`サービス料${c.service_rate?`（${N(c.service_rate)}%）`:''}`, N(c.service).toLocaleString('ja-JP')):''}${N(c.tax)?L('消費税', N(c.tax).toLocaleString('ja-JP')):''}
        ${L('<b>合計</b>', `<b>${yen(c.amount_due)}</b>`, 's')}<div class="row muted sm"><span>お支払い</span><span>${(b.pays||[]).map(p => `${PAYN[p.method]||esc(p.method)} ${yen(p.amount)}`).join('・')||'—'}</span></div></div>`; }
    return h + '</div>'; };
  show(`<div id="blBox"><div class="ttl">伝票一覧</div>
    ${M.length > 1 ? `<div style="display:flex;gap:6px;margin-bottom:8px">${M.map(x => `<button class="btn ${x.month===m?'':'g'}" data-bm="${x.month}" style="flex:1;padding:8px">${mo(x.month)} ${N(x.count)}件</button>`).join('')}</div>` : ''}
    <div class="muted sm" style="margin:0 2px 8px">${esc(KL)}の伝票・前月分は翌月3日まで</div>
    ${B.map(bill).join('') || '<div class="card c muted">伝票はありません</div>'}</div>`);
  $('main').querySelectorAll('[data-bm]').forEach(b => b.onclick = () => castBills(b.dataset.bm));
  $('main').querySelectorAll('[data-bl]').forEach(e => e.onclick = () => { const k = e.dataset.bl; billOpen.has(k) ? billOpen.delete(k) : billOpen.add(k); const y = window.scrollY; blPaint(); window.scrollTo(0, y); }); /* 読み直さない */
}
// ---------- 黒服マイページ （オーナー）：日報（今の Google フォーム）・報酬明細（キャストと同じ形・受取確認）・担当キャスト・朝礼
async function hallLoad(pre){ /* hall_me は castLoadMe で先に読み始めている */
  const r = await (pre || sb.rpc('hall_me', { p_token: TOKEN })); if(r.error){ fail(r.error.message); return; }
  ME = { ...r.data, hall: true }; KL = ME.kakari_label || '係'; $('tStore').textContent = ME.store_name || 'OLIVE'; hallHome();
  hallGo(goParam());
}
// 日本時間で 22時〜朝8時（営業日の切り替え）か。リッチメニューの［開店・閉店作業］と黒服のトップのボタンが、この間は閉店作業になる
function hallNight(){ const h = Number(new Date().toLocaleString('en-US', { timeZone:'Asia/Tokyo', hour:'numeric', hour12:false })) % 24; return h >= 22 || h < 8; }
// リッチメニューのボタンから、その画面を直接開く（?go=。オーナー 案3）
function hallGo(k){
  if(!k) return; goClear();
  if(k === 'chorei') hallChorei(); else if(k === 'todo') hallTodo(); else if(k === 'cs') hallCs();
  else if(k === 'work'){ opSwitch = true; hallTasks(hallNight() ? 'close' : 'open'); } /* opSwitch（17_open.js）＝作業の画面の上に［開店作業］［閉店作業］の切り替えを出す */
  else if(k === 'memo') memoList(); /* 退店の LINE（要変更）から */
  else if(k === 'ap'){ const a = jgParam('a'); if(a) apPage(a, null, hallHome); } /* 【ヒアリングシート】の LINE から、その人のページ */
  else if(k === 'daily'){ const b = $('main').querySelector('[data-go=daily]'); if(b && ME.form) b.click(); } /* 日報のボタンの動き（Safari で開く）を1か所にするため、ボタンを押す。フォームの無い店はボタンも無いので何もしない */
}
/* 黒服のトップの数（開店・閉店作業の完了・TODO・書類・ミーティング）は60秒まで覚えておく（ほとんどの画面の「戻る」がトップで、そのたびに5つ読んでいた）。
   読むだけの関数（HC_READ）のほかを呼んだら（保存・完了・取消など）すぐ忘れる */
let HC = null;
const HC_READ = new Set(['cast_memo_list', 'cast_memo_get', 'hall_me', 'hall_tasks', 'hall_todos', 'hall_chorei_trials', 'hall_tsuke_staff', 'hall_todo_ahead', 'hall_meeting_get', 'hall_chorei', 'hall_casts', 'hall_close_data', 'hall_kpb_review_list', 'hall_cs_session', 'cast_docs_info', 'cast_who', 'cast_me',
  'cast_shift_all', 'cast_shift_health', 'cast_shift_day', 'cast_shift_day_absent', 'cast_shift_day_recruit', 'cast_recruit_info', 'cast_recruit_pending', 'cast_shift_info', 'cast_meeting_get', 'cast_pay_slip', 'cast_pay_pending', 'cast_card_info', 'cast_absence_info', 'cast_attendance', 'cast_off_days', 'cast_link_poll',
  'cast_key_my' /* 鍵のタイル（20_key.js）が読むだけ。前は入っておらず、トップを開いた直後に60秒のためおきが消えていた */]);
{ const rpc0 = sb.rpc.bind(sb); sb.rpc = (fn, ...a) => { if(!HC_READ.has(fn)) HC = null; return rpc0(fn, ...a); }; } /* マイページのどの画面の呼び出しもここを通る（このファイルは1回だけ読む）。読むだけの関数を新しく作った時は HC_READ にも足す（足さないと60秒の覚えがすぐ消えるだけで、まちがった数は出ない） */
function hcGet(){
  if(HC && Date.now() - HC.at < 60000) return HC;
  /* q＝1つ読む。失敗した時は覚えを消して、次にトップを開いた時に読み直す（まだ h が今の覚えの時だけ） */
  const q = fn => Promise.resolve(fn()).then(r => { if(r && r.error && HC === h) HC = null; return r; }, e => { if(HC === h) HC = null; return { error: e }; }); /* 読めなかった分は次にもう一度 */
  const h = { at: Date.now() };
  h.open = q(() => sb.rpc('hall_tasks', { p_token: TOKEN, p_phase: 'open' })); h.close = q(() => sb.rpc('hall_tasks', { p_token: TOKEN, p_phase: 'close' }));
  h.todos = q(() => sb.rpc('hall_todos', { p_token: TOKEN })); h.mtg = q(() => sb.rpc('hall_meeting_get', { p_token: TOKEN }));
  h.docs = q(() => docsLoad().then(ok => ok ? { data: ME.docs } : { error: true }));
  HC = h; return h;
}
function hallHome(){
  setBack(null); opSwitch = false; const H = hcGet();
  const tile = homeTile;
  /* トップの整理（オーナー「必要のないボタンを整理整頓したい」見本 マイページ整理_案4「この整理で進める」）。見出しで4つに分ける。
     開店作業・閉店作業は1つ（リッチメニューと同じく 22時〜朝8時は閉店作業。閉店作業を POS でする店は開店作業のみ）。ミーティングはシフトの中（全員のシフトの一番上）。書類は未提出の時だけ */
  const night = hallNight();
  const sh = t => `<div class="sm" style="font-weight:700;color:var(--muted);margin:14px 2px 6px">${t}</div>`;
  show(`<div class="hello">${esc(ME.name)} さん</div>${sh('本日の業務')}<div class="tiles">${tile('chorei','朝礼','来店予定・メモ',true)}${tile('work',night?'閉店作業':'開店作業','',true)}${tile('todo','TODO','今日の分',true)}${tile('daily','日報','',!!ME.form)}</div>
    ${sh('キャスト')}<div class="tiles">${tile('hcasts','担当キャスト',ME.casts?`${ME.casts}人`:'',true)}${tile('shift','シフト','全員',true)}</div>
    ${sh('店舗情報')}<div class="tiles" data-info="1">${tile('cs','顧客サイト','',true)}</div>
    ${sh('個人')}<div class="tiles" data-me="1">${tile('late','欠勤・遅刻連絡','',true)}${tile('pay','報酬明細','明細・受取確認',true)}${tile('docs','書類','',true)}${tile('card','名刺発注','',true)}</div>`);
  hallHomeWire(H, night); hallRecruitAsk(); /* 出勤募集の送信（承認者だけ・16_shift_recruit.js） */
}
/* 黒服のホームのボタンをつなぐ */
function hallHomeWire(H, night){
  $('main').querySelector('[data-go=todo]').onclick = hallTodo;
  keyTile(); /* 鍵（20_key.js）。店と更衣室 */
  memoTile(); /* 共有メモ（共有された時だけ。22_memo.js） */
  hallWorkTile(H, night);
  H.todos.then(r => { const b = $('main').querySelector('[data-go=todo] small'); if(!b) return; if(r.error){ loadNg(); return; } /* 読めなかった時は1行の知らせ */ const L = r.data.items || [], n = L.filter(x => x.status === 'open').length, nc = L.filter(x => x.carry && x.status === 'open').length; /* 休日分 */ const sk = L.filter(x => x.status === 'skip').length; b.textContent = L.length ? (nc ? `休日分 ${nc}` : n ? `未完了 ${n}` : sk ? `完了（できない ${sk}）` : '全部完了') : 'なし'; /* できないが混ざっていたら全部済にしない */ if(n) b.style.color = 'var(--warn)'; });
  $('main').querySelector('[data-go=chorei]').onclick = hallChorei;
  $('main').querySelector('[data-go=hcasts]').onclick = hallCasts;
  $('main').querySelector('[data-go=pay]').onclick = payslip;
  $('main').querySelector('[data-go=card]').onclick = cardOrder;
  $('main').querySelector('[data-go=docs]').onclick = docsList; /* 黒服も自分の書類（契約書は黒服の条文。オーナー「その人の契約書をその人のマイページで」） */
  H.docs.then(r => { const ok = !r.error; if(ok) ME.docs = r.data; const b = $('main').querySelector('[data-go=docs]'); if(!b) return; if(!ok || !ME.docs || !ME.docs.target || !ME.docs.left){ b.remove(); /* 未提出の時だけ */ if(!ok) loadNg(); /*点検 B5 */ return; } b.insertAdjacentHTML('beforeend', `<small>未完了 ${ME.docs.left}件</small>`); });
  $('main').querySelector('[data-go=cs]').onclick = hallCs;
  $('main').querySelector('[data-go=late]').onclick = hallAbsent; /* 欠勤・遅刻連絡（キャストと同じく欠勤から。上で遅刻に切り替え。承認者に公式 LINE） */
  mtHallTile(H.mtg); /* ミーティング（担当の子の割当）。ボタンはシフトの中。未申請はシフトのボタンに */
  $('main').querySelector('[data-go=shift]').onclick = () => shiftAll(); /* キャスト全員のシフト（4段目の右の空きに） */
  { const b = $('main').querySelector('[data-go=daily]'); if(b && ME.form) b.onclick = () => { const u = encodeURI(ME.form); try{ liff.openWindow({ url: u, external: true }); }catch(e){ location.href = u; } }; } /* 名前（日本語）を URL の形に。フォームは Google のログインが要る（写真のアップロード）ので、LINE の中ではなくスマホのブラウザで開く */
}
/* 開店作業・閉店作業のボタン（夜は閉店作業。済んだ数を出す） */
function hallWorkTile(H, night){
  { const b = $('main').querySelector('[data-go=work]'); let ph = night ? 'close' : 'open', closeOn = true; /* 開店作業。閉店作業（管理サイトで「マイページで する」の店だけ） */
    b.onclick = async () => { await H.close.catch(() => {}); /* 閉店作業をする店かの答えが来るまで待つ（前は答えの前に押すと、閉店作業をしない店でも切り替えが出た） */ opSwitch = closeOn; hallTasks(ph); };
    const cnt = r => { b.querySelector('small')?.remove(); const L = r.data.items || []; if(L.length) b.insertAdjacentHTML('beforeend', `<small>完了 ${L.filter(x => x.status === 'done').length}／${L.length}</small>`); };
    H.close.then(rc => { if(rc.error){ loadNg(); return; } /*点検 B5：読めなかった時は1行 */ closeOn = !!rc.data.on;
      if(night && closeOn){ cnt(rc); return; } ph = 'open'; b.querySelector('b').textContent = '開店作業';
      H.open.then(ro => { if(ro.error){ loadNg(); return; } cnt(ro); }); }); }
}

// 顧客サイト（オーナー「黒服のマイページにも顧客サイトを」→ パスワードなしで開く）。管理サイトの中と同じく、顧客サイトをこの画面の中に出して入場券を渡す（#hall）。編集は顧客サイトのメニューから編集パスワードで
let csMsg = null;
function hallCs(){
  setBack(home);
  show(`<iframe id="csFrame" src="../customer/preview.html#hall" title="顧客サイト" style="display:block;width:100%;height:calc(100vh - 110px);min-height:420px;border:1px solid var(--line);border-radius:12px;background:#fff"></iframe>`);
  if(csMsg) window.removeEventListener('message', csMsg);
  csMsg = async e => { const f = $('csFrame'); if(!f || e.source !== f.contentWindow || e.origin !== location.origin || !e.data || e.data.type !== 'olive-cs-need') return;
    const r = await sb.rpc('hall_cs_session', { p_token: TOKEN }); if(!$('csFrame')) return;
    const d = r.error ? { error: r.error.message } : (r.data || {});
    f.contentWindow.postMessage({ type: 'olive-cs-auth', ...d }, location.origin); };
  window.addEventListener('message', csMsg);
}
