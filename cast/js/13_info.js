// v0.18・SQL 118：⑤お知らせ。補助として、過去のお知らせの置き場所（オーナー 2026-10-16「基本は公式 LINE に送信。過去のトークを遡るのが大変だから、一覧の置き場所」）。管理サイトで掲載、キャストは「確認」を押す
function urlParam(k){
  const q = new URLSearchParams(location.search); let v = q.get(k);
  if(!v){ const st = q.get('liff.state'); if(st) v = new URLSearchParams(st.replace(/^[^?]*\?/, '')).get(k); }
  return /^[0-9a-f-]{36}$/.test(v || '') ? v : null;
}
// v0.54：LINE のリンクから開く画面（?go=contact）。決まった名前だけ
function goParam(){ const q = new URLSearchParams(location.search); let v = q.get('go'); if(!v){ const st = q.get('liff.state'); if(st) v = new URLSearchParams(st.replace(/^[^?]*\?/, '')).get('go'); } return ['contact','shift','sales','resv','perf','chorei','work','todo','daily','cs'].includes(v) ? v : null; } /* v0.64・SQL 221：リッチメニューのボタン（キャスト：shift・sales・resv・contact・perf／黒服：chorei・work・todo・daily・cs） */
const noticeDay = a => { const d = new Date(new Date(a).getTime() + 9*3600e3); return `${d.getUTCMonth()+1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）`; };
async function noticeLoad(){ const n = await sb.rpc('cast_notice_list', { p_token: TOKEN }); if(n.error){ fail(n.error.message); return false; } NOTICES = n.data || []; ME.unread = NOTICES.filter(x => !x.read).length; return true; }
async function noticeList(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  if(!await noticeLoad()) return;
  show(`<div class="ttl">お知らせ</div><div class="card">${NOTICES.map((x, i) => `<button data-nt="${i}" style="display:block;width:100%;text-align:left;background:none;border:0;border-top:${i?'1px solid var(--line)':'0'};padding:10px 0;font:inherit;color:var(--ink);cursor:pointer">
      <div class="row" style="padding:0"><span style="${x.read?'':'font-weight:700'}">${esc(x.title)}</span><span class="sm" style="white-space:nowrap;color:${x.read?'var(--ok)':'var(--warn)'}">${x.read?'確認済み':'未確認'}</span></div>
      <div class="muted sm">${noticeDay(x.at)} 掲載</div></button>`).join('') || '<div class="muted sm" style="padding:8px 0">お知らせはありません</div>'}</div>`);
  $('main').querySelectorAll('[data-nt]').forEach(b => b.onclick = () => noticeShow(NOTICES[b.dataset.nt]));
}
async function noticeOpen(id){
  if(!await noticeLoad()) return;
  const x = NOTICES.find(v => v.id === id);
  if(!x){ await uiAlert('このお知らせは削除されています'); noticeList(); return; }
  noticeShow(x);
}
function noticeShow(x){
  setBack(noticeList);
  show(`<div class="card"><div class="gh">${noticeDay(x.at)} 掲載</div><div style="font-weight:700;font-size:17px">${esc(x.title)}</div>${x.body?`<div style="margin-top:10px;line-height:1.7;white-space:pre-wrap">${esc(x.body)}</div>`:''}</div>
    ${x.read?'<div class="c sm" style="color:var(--ok);padding:8px">確認済み</div>':'<button class="btn" id="ntOk">確認</button>'}`);
  const b = $('ntOk'); if(b) b.onclick = async () => {
    b.disabled = true;
    const q = await sb.rpc('cast_notice_read', { p_token: TOKEN, p_id: x.id });
    if(q.error){ b.disabled = false; await uiAlert(q.error.message); return; }
    x.read = true; ME.unread = Math.max(0, (ME.unread || 0) - 1); noticeList();
  };
}

