// v1.27・SQL 365：お誕生日のカレンダー（オーナー 2026-11-05「タップするとお客様のお誕生日一覧をカレンダーで表示」見本 マイページ_お誕生日カレンダー_案3。
//   ホームの「お誕生日（3日間）」の［カレンダー］から。お客様はホームと同じ顔ぶれ（台帳の全員・SQL 360）。広島は係を出さない（関数が kakari を null）
//   マスは3人まで名前（空白を除いて4文字まで）・4人からは2人＋「他○人」（オーナー「3人ぐらいまでは名前」「せめて4文字位まで」）。マスを押すと上の箱がその日。今日のしるしは営業日（関数の today＝business_date_of）
let BDC = null;
// v1.40・SQL 378：本日の箱の右に［登録］と虫めがね（オーナー 2026-11-06「名前で検索」「“登録”でいいね。検索マークは右」「検索と申請をごっちゃにしないで」見本 作業場/お誕生日登録申請_案.png）
//   虫めがね＝お誕生日検索（表示のみ。未登録は「未登録」）・［登録］＝お誕生日が未登録のお客様を選んで申請 → 黒服が開店作業「お誕生日登録申請」で登録／却下
const BD_MG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="display:block"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>';
const bdKey = s => String(s || '').replace(/[\s　]+/g, '');
function bdPop(title, body){ const d = document.createElement('div'); d.className = 'dlg'; d.style.alignItems = 'flex-start'; d.style.paddingTop = '60px';
  d.innerHTML = `<div class="box" style="max-height:calc(100vh - 90px);overflow-y:auto"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>${title}</b><button class="xb" data-k="x" aria-label="閉じる" style="font-size:20px">×</button></div>${body}</div>`;
  document.body.appendChild(d); d.querySelector('[data-k=x]').onclick = () => d.remove(); return d; }
const bdFld = 'width:100%;height:44px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)';
// SQL 379：未登録のお客様（両店とも 5,000人ほど）は押した時だけ読む。[id, 名前] の並び
async function bdLoad(force){ if(BDC.nobd && !force) return true; const r = await sb.rpc('cast_bday_nobd', { p_token: TOKEN }); if(r.error){ await uiAlert(r.error.message); return false; }
  BDC.nobd = (r.data.nobd || []).map(([id, name, kana]) => ({ id, name, kana })); /* v1.41・SQL 386：フリガナ */ BDC.pend = r.data.pend || []; return true; }
async function bdayFind(){ if(!await bdLoad()) return;
  const d = bdPop('お誕生日検索', `<input id="bdQ" type="search" placeholder="名前・フリガナで検索" style="${bdFld}"><div id="bdR" style="margin-top:6px"></div>`);
  const A = BDC.rows.map(x => ({ ...x, k: bdKey(x.name), kn: kanaKey(x.kana) })).concat((BDC.nobd || []).map(x => ({ name: x.name, k: bdKey(x.name), kn: kanaKey(x.kana) })));
  const q = d.querySelector('#bdQ'); q.oninput = () => { const k = bdKey(q.value), L = k ? A.filter(x => x.k.includes(k) || (!!kanaKey(k) && x.kn.includes(kanaKey(k)))).slice(0, 50) : [];
    d.querySelector('#bdR').innerHTML = L.map(x => `<div style="display:flex;align-items:center;gap:8px;padding:10px 2px;border-top:1px solid var(--line)"><span style="flex:1">${esc(x.name)} 様</span>${x.birthday
      ? `<b style="min-width:3.2em;text-align:right">${esc(x.birthday)}</b><small class="muted" style="min-width:4.6em">${x.kakari ? esc(KL) + ' ' + esc(x.kakari) : ''}</small>` : '<small class="muted" style="min-width:8em">未登録</small>'}</div>`).join('')
      || (k ? '<div class="muted sm" style="padding:8px 2px">該当なし</div>' : ''); };
  setTimeout(() => q.focus(), 50);
}
async function bdayReq(){ if(!await bdLoad()) return;
  const P = BDC.pend || [], pid = new Set(P.map(x => x.customer_id)), A = (BDC.nobd || []).filter(x => !pid.has(x.id)).map(x => ({ ...x, k: bdKey(x.name), kn: kanaKey(x.kana) }));
  const opt = (n, a, u) => `<option value="">${u}</option>` + Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}${a}</option>`).join('');
  const sel = 'height:44px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 8px;background:var(--card);color:var(--ink);width:96px';
  const d = bdPop('お誕生日登録申請', `<input id="bdQ" type="search" placeholder="名前・フリガナで検索" style="${bdFld}"><div id="bdR" style="max-height:240px;overflow-y:auto;margin-top:2px"></div>
    <div style="display:flex;gap:8px;margin-top:10px"><select id="bdM" style="${sel}">${opt(12, '月', '月')}</select><select id="bdD" style="${sel}">${opt(31, '日', '日')}</select></div>
    <button class="btn" id="bdGo" style="margin-top:10px">申請</button>
    ${P.length ? `<div class="gh" style="margin-top:14px">申請中</div>${P.map(x => `<div class="row"><span>${esc(x.name)} 様</span><small class="muted">${esc(x.birthday)}</small></div>`).join('')}` : ''}`);
  let pick = null; const q = d.querySelector('#bdQ'); setTimeout(() => q.focus(), 50);
  const paint = () => { const k = bdKey(q.value), L = k ? A.filter(x => x.k.includes(k) || (!!kanaKey(k) && x.kn.includes(kanaKey(k)))).slice(0, 100) : [];
    d.querySelector('#bdR').innerHTML = L.map(x => `<label style="display:flex;align-items:center;gap:8px;border:1px solid ${pick === x.id ? 'var(--ink)' : 'var(--line)'};border-radius:8px;padding:9px 10px;margin-top:6px">
      <input type="radio" name="bdC" value="${x.id}" ${pick === x.id ? 'checked' : ''} style="width:20px;height:20px;flex:none;margin:0;accent-color:var(--pri)"><span style="flex:1">${esc(x.name)} 様</span></label>`).join('')
      || (k ? '<div class="muted sm" style="padding:8px 2px">該当なし</div>' : '');
    d.querySelectorAll('[name=bdC]').forEach(r => r.onchange = () => { pick = r.value; paint(); }); };
  q.oninput = paint; paint();
  d.querySelector('#bdGo').onclick = async () => { const m = d.querySelector('#bdM').value, dd = d.querySelector('#bdD').value, b = d.querySelector('#bdGo');
    if(!pick){ await uiAlert('お客様を選択してください'); return; } if(!m || !dd){ await uiAlert('お誕生日を選択してください'); return; }
    b.disabled = true; const r = await sb.rpc('cast_bday_req', { p_token: TOKEN, p_customer: pick, p_birthday: `${m}/${dd}` });
    if(r.error){ b.disabled = false; await uiAlert(r.error.message); return; }
    d.remove(); await uiAlert('申請しました'); await bdLoad(true); };
}
async function bdayCal(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_bday_cal', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const td = String(r.data.today || shToday()).slice(0, 10);
  BDC = { rows: r.data.rows || [], nobd: null, pend: [], today: td, sel: td, ym: td.slice(0, 7) };
  bdayCalShow();
}
// 誕生日（月/日）をその年の日付に。2/29 は、うるう年でない年は 2/28 のマスに出す
function bdayIso(bd, y){ const m = /^(\d{1,2})\/(\d{1,2})$/.exec(bd || ''); if(!m) return null; let mo = Number(m[1]), d = Number(m[2]); const n = new Date(y, mo, 0).getDate();
  if(mo < 1 || mo > 12 || d < 1) return null; if(d > n){ if(mo === 2 && d === 29) d = 28; else return null; } return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function bdayCalShow(){
  const B = BDC, y = Number(B.ym.slice(0, 4)), D = {};
  B.rows.forEach(x => { const iso = bdayIso(x.birthday, y); if(iso && iso.slice(0, 7) === B.ym) (D[iso] = D[iso] || []).push(x); });
  if(B.sel.slice(0, 7) !== B.ym) B.sel = B.today.slice(0, 7) === B.ym ? B.today : `${B.ym}-01`;
  const selD = new Date(B.sel + 'T00:00:00+09:00'), L = D[B.sel] || [];
  const head = `${B.sel === B.today ? '本日 ' : ''}${selD.getMonth()+1}/${selD.getDate()}（${WD[selD.getDay()]}） ${L.length}人`;
  const rows = L.map(x => `<div class="row"><span>${esc(x.name)} 様</span><small class="muted">${x.kakari ? esc(KL)+' '+esc(x.kakari) : ''}</small></div>`).join('') || '<div class="muted sm">該当なし</div>';
  const box = 'border:1px solid var(--line);border-radius:6px;text-align:left;padding:5px 2px 5px 3px;font-size:13px;line-height:1.25;min-height:44px';
  const nm = (t, mu) => `<small style="display:block;font-size:9.5px;letter-spacing:-.05em;font-weight:400;white-space:nowrap;overflow:hidden;color:var(--${mu?'muted':'ink'})">${esc(t)}</small>`;
  const cell = (iso, d) => { const P = D[iso] || [], sel = iso === B.sel;
    const names = (P.length <= 3 ? P : P.slice(0, 2)).map(x => nm(String(x.name || '').replace(/[\s　]/g, '').slice(0, 4))).join('') + (P.length > 3 ? nm(`他${P.length - 2}人`, 1) : '');
    return `<div data-bd="${iso}" style="${box};cursor:pointer;${P.length?'background:var(--gold-soft);font-weight:700;':''}${sel?'outline:2px solid var(--pri);outline-offset:-1px;':''}">${d}${names}</div>`; };
  const mo = Number(B.ym.slice(5, 7));
  show(`<div class="ttl">お誕生日</div><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><div class="gh" style="margin:0">${head}</div><span style="display:flex;gap:6px;flex:none"><button class="lkb" id="bdReq">登録</button><button class="lkb" id="bdFind" aria-label="検索" style="padding:5px 10px">${BD_MG}</button></span></div>${rows}</div>
    <div class="card"><div class="mon"><button data-mv="-1" aria-label="前月">‹</button><b>${mo}月</b><button data-mv="1" aria-label="翌月">›</button></div>${calGrid(B.ym + '-01', cell).replace('<div class="tdy" ', '<div ').replace(`<div data-bd="${B.today}"`, `<div class="tdy" data-bd="${B.today}"`)}<div class="muted sm" style="margin-top:6px">タップで詳細表示</div></div>`);
  $('bdFind').onclick = bdayFind; $('bdReq').onclick = () => bdayReq();
  $('main').querySelectorAll('[data-bd]').forEach(e => e.onclick = () => { BDC.sel = e.dataset.bd; bdayCalShow(); });
  $('main').querySelectorAll('[data-mv]').forEach(e => e.onclick = () => { const d = new Date(Number(BDC.ym.slice(0, 4)), Number(BDC.ym.slice(5, 7)) - 1 + Number(e.dataset.mv), 1);
    BDC.ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; bdayCalShow(); });
}
