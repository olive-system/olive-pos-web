// v1.27・SQL 365：お誕生日のカレンダー（オーナー 2026-11-05「タップするとお客様のお誕生日一覧をカレンダーで表示」見本 マイページ_お誕生日カレンダー_案3。
//   ホームの「お誕生日（3日間）」の［カレンダー］から。お客様はホームと同じ顔ぶれ（台帳の全員・SQL 360）。広島は係を出さない（関数が kakari を null）
//   マスは3人まで名前（空白を除いて4文字まで）・4人からは2人＋「他○人」（オーナー「3人ぐらいまでは名前」「せめて4文字位まで」）。マスを押すと上の箱がその日。今日のしるしは営業日（関数の today＝business_date_of）
let BDC = null;
async function bdayCal(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_bday_cal', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const td = String(r.data.today || shToday()).slice(0, 10);
  BDC = { rows: r.data.rows || [], today: td, sel: td, ym: td.slice(0, 7) };
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
  show(`<div class="ttl">お誕生日</div><div class="card"><div class="gh">${head}</div>${rows}</div>
    <div class="card"><div class="mon"><button data-mv="-1" aria-label="前月">‹</button><b>${mo}月</b><button data-mv="1" aria-label="翌月">›</button></div>${calGrid(B.ym + '-01', cell).replace('<div class="tdy" ', '<div ').replace(`<div data-bd="${B.today}"`, `<div class="tdy" data-bd="${B.today}"`)}<div class="muted sm" style="margin-top:6px">タップで詳細表示</div></div>`);
  $('main').querySelectorAll('[data-bd]').forEach(e => e.onclick = () => { BDC.sel = e.dataset.bd; bdayCalShow(); });
  $('main').querySelectorAll('[data-mv]').forEach(e => e.onclick = () => { const d = new Date(Number(BDC.ym.slice(0, 4)), Number(BDC.ym.slice(5, 7)) - 1 + Number(e.dataset.mv), 1);
    BDC.ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; bdayCalShow(); });
}
