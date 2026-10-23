// v0.36・SQL 134：伝票一覧（自分が係の伝票。今月の分・前月の分は翌月3日まで。オーナー 2026-10-17）。お客様を押すと明細が開く
let billOpen = new Set();
const PAYN = { cash:'現金', card:'カード', invoice:'請求書', oki:'置き' };
async function castBills(month){
  setBack(home); if(!$('blBox')) show('<div class="card c muted">読み込み中…</div>');
  const ms = await sb.rpc('cast_bill_months', { p_token: TOKEN }); if(ms.error){ fail(ms.error.message); return; }
  const M = ms.data || [], m = month || (M[0] && M[0].month);
  const r = await sb.rpc('cast_bills', { p_token: TOKEN, p_month: m }); if(r.error){ fail(r.error.message); return; }
  const B = r.data || [], mo = x => `${Number(String(x).slice(5,7))}月`, tm = t => t ? new Date(t).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}) : '';
  const L = (k, v, c='') => `<div class="row ${c}" style="font-size:14px"><span>${k}</span><span>${v}</span></div>`;
  const bill = b => { const c = b.calc || {}, op = billOpen.has(b.id), d = new Date(b.date+'T00:00:00+09:00');
    let h = `<div class="card" data-bl="${b.id}" style="cursor:pointer"><div class="row"><b>${esc(b.customers||'お客様')} 様</b><b>${yen(c.amount_due)}</b></div>
      <div class="muted sm">${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）　${esc(b.table||'')}${b.table?'・':''}${N(b.guests)}名　${tm(b.open)}〜${tm(b.close)}</div>`;
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
  $('main').querySelectorAll('[data-bl]').forEach(e => e.onclick = () => { const k = e.dataset.bl; billOpen.has(k) ? billOpen.delete(k) : billOpen.add(k); const y = window.scrollY; castBills(m).then(() => window.scrollTo(0, y)); });
}
// ---------- 黒服マイページ v0.33・SQL 133（オーナー 2026-10-17）：日報（今の Google フォーム）・報酬明細（キャストと同じ形・受取確認）・担当キャスト・朝礼
async function hallLoad(){
  const r = await sb.rpc('hall_me', { p_token: TOKEN }); if(r.error){ fail(r.error.message); return; }
  ME = { ...r.data, hall: true }; KL = ME.kakari_label || '係'; $('tStore').textContent = ME.store_name || 'OLIVE'; hallHome();
}
function hallHome(){
  setBack(null);
  const tile = (k,t,s,on) => `<button class="tile" data-go="${k}" ${on?'':'disabled'}>${on?'':'<span class="soon">準備中</span>'}<b>${t}</b>${s?`<small>${s}</small>`:''}</button>`;
  show(`<div class="hello">${esc(ME.name)} さん</div><div class="tiles">${tile('chorei','朝礼','来店予定・メモ',true)}${tile('hcasts','担当キャスト',ME.casts?`${ME.casts}人`:'',true)}${tile('open','開店作業','',true)}${tile('todo','TODO','今日の分',true)}${tile('close','閉店作業','',true)}${tile('daily','日報','',!!ME.form)}${tile('pay','報酬明細','明細・受取確認',true)}${tile('card','名刺発注','',true)}</div>`); /* v0.51：黒服にも名刺発注（キャストと同じ画面・名刺代は報酬から。オーナー 2026-10-21）。v0.60：並びを 朝礼・担当キャスト／開店作業・TODO／閉店作業・日報／報酬明細・名刺発注 に（オーナー 2026-10-23） */
  $('main').querySelector('[data-go=todo]').onclick = hallTodo;
  $('main').querySelector('[data-go=open]').onclick = hallOpen; /* v0.55：開店作業 */
  $('main').querySelector('[data-go=close]').onclick = hallClose; /* v0.57・SQL 209：閉店作業（管理サイトで「マイページで する」の店だけ） */
  ['open', 'close'].forEach(ph => sb.rpc('hall_tasks', { p_token: TOKEN, p_phase: ph }).then(r => { const b = $('main').querySelector(`[data-go=${ph}]`); if(!b) return; if(r.error){ if(ph === 'close') b.remove(); return; } if(!r.data.on){ b.remove(); return; } const L = r.data.items || []; if(!L.length) return; b.insertAdjacentHTML('beforeend', `<small>完了 ${L.filter(x => x.status === 'done').length}／${L.length}</small>`); }));
  sb.rpc('hall_todos', { p_token: TOKEN }).then(r => { const b = $('main').querySelector('[data-go=todo] small'); if(!b || r.error) return; const L = r.data.items || [], n = L.filter(x => x.status === 'open').length; const sk = L.filter(x => x.status === 'skip').length; b.textContent = L.length ? (n ? `未 ${n}` : sk ? `済（できない ${sk}）` : '全部済') : 'なし'; /* v0.47：できないが混ざっていたら全部済にしない（ゲネプロ マイページ #7） */ if(n) b.style.color = 'var(--warn)'; });
  $('main').querySelector('[data-go=chorei]').onclick = hallChorei;
  $('main').querySelector('[data-go=hcasts]').onclick = hallCasts;
  $('main').querySelector('[data-go=pay]').onclick = payslip;
  $('main').querySelector('[data-go=card]').onclick = cardOrder;
  { const b = $('main').querySelector('[data-go=daily]'); if(b && ME.form) b.onclick = () => { const u = encodeURI(ME.form); try{ liff.openWindow({ url: u, external: true }); }catch(e){ location.href = u; } }; } /* 名前（日本語）を URL の形に。フォームは Google のログインが要る（写真のアップロード）ので、LINE の中ではなくスマホのブラウザで開く */
}
