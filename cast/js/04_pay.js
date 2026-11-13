// 報酬明細：今月の途中の明細と、前の月の PDF（。前の月は毎月1日 10:30 に固めて PDF にし、伝票を直しても変わらない）
const N = v => Number(v||0), cm = v => N(v) ? N(v).toLocaleString('ja-JP') : '--';
// SQL 414 の前月精算（prev_adjust）は 468 でやめた。前にサインした明細に入っている時だけ出す
// 自動の遅刻の罰金（遅刻（シフト19:50・打刻20:05）など）は、元の名前（遅刻）の1行に合計する（管理サイトの報酬明細と同じ）
const fineBase = k => String(k).replace(/（(?:シフト|予定)\d[^）]*）$/, ''), fineSum = (x, f) => Object.entries(x.fine_items||{}).reduce((s, [k, v]) => fineBase(k) === f ? s + N(v) : s, 0);
function slipHtml(P){
  if(P.hall) return hallSlipHtml(P);
  const x = P.slip, L = (k, v, c='') => `<div class="row ${c}"><span>${esc(k)}</span><b>${v}</b></div>`, B = k => N(x.backs?.[k]?.amount);
  const ded = N(x.ctax) + N(x.fines) + N(x.quota_fine) + N(x.welfare) + N(x.special_deduct);
  const pay = [L(x.pay_type==='daily'?'報酬（日給）':'報酬（時給）', cm(x.time_pay)), L('小計バック', cm(x.kakari_back)), ...(x.seppan?[L(`折半（${N(x.seppan_pct)}%）`, cm(x.seppan_pay))]:[]), L('HC', cm(B('hc'))), L('ボトルバック', cm(B('bottle'))), L('商品バック', cm(B('other'))), L('手当など、その他', cm(N(x.allowance)+N(x.special_pay))), L('合計', cm(x.taxable), 's')];
  const dd = [L('消費税', cm(x.ctax)), ...[...new Set((P.fine_names||[]).map(fineBase))].map(f => L(f, cm(fineSum(x, f)))), L('同伴ノルマ', cm(x.quota_fine)), L('厚生費', cm(x.welfare)), L('個別控除', cm(x.special_deduct)), L('合計', cm(ded), 's')];
  const [y, mo] = String(P.month).split('-').map(Number), net = N(x.net);
  return `<div class="card"><div class="ttl">報酬支払明細書</div><div class="muted sm" style="text-align:center;margin-bottom:6px">${y}年${mo}月分　${esc(P.store_name)}　${esc(P.name)}${P.real_name?'/'+esc(P.real_name):''}</div>
      ${L('稼働日数', `${N(x.days)}日`)}${L('稼働時間', HM(x.hours))}${L(x.pay_type==='daily'?'決定日給':'決定時給', x.wage?yen(x.wage):'--')}</div>
    <div class="card"><div class="gh">支給対象</div>${pay.join('')}</div><div class="card"><div class="gh">控除対象</div>${dd.join('')}</div>
    <div class="card">${L('総支給額', cm(N(x.taxable)-ded))}${L('課税対象額', cm(x.taxable))}${L('源泉徴収', cm(x.withholding))}${L('日払（立替）', cm(x.advance))}${N(x.prev_adjust)?L('前月精算', (N(x.prev_adjust)<0?'−':'')+Math.abs(N(x.prev_adjust)).toLocaleString('ja-JP')):''}${L('残り支給額', (net<0?'−':'')+'¥'+Math.abs(net).toLocaleString('ja-JP'), 'n')}</div>`;
}
function hallSlipHtml(P){
  const x = P.slip, L = (k, v, c='') => `<div class="row ${c}"><span>${esc(k)}</span><b>${v}</b></div>`, PT = { monthly:'月給', hourly:'時給', daily:'日給' };
  const ded = N(x.ctax) + N(x.fines) + N(x.welfare) + N(x.special_deduct);
  const pay = [L(PT[x.pay_type]?`報酬（${PT[x.pay_type]}）`:'報酬', cm(x.base)), ...(N(x.late_deduct)?[L('遅刻・早退', '−'+cm(x.late_deduct))]:[]), L('ボーナス', cm(x.bonus)), L('手当など、その他', cm(N(x.allowance)+N(x.special_pay))), L('合計', cm(x.taxable), 's')];
  const dd = [L('消費税', cm(x.ctax)), L('罰金', cm(x.fines)), L('厚生費', cm(x.welfare)), L('個別控除', cm(x.special_deduct)), L('合計', cm(ded), 's')];
  const [y, mo] = String(P.month).split('-').map(Number), net = N(x.net);
  return `<div class="card"><div class="ttl">報酬支払明細書</div><div class="muted sm" style="text-align:center;margin-bottom:6px">${y}年${mo}月分　${esc(P.store_name)}　${esc(P.name)}${P.real_name?'/'+esc(P.real_name):''}</div>
      ${L('稼働日数', `${N(x.days)}日`)}${L('稼働時間', HM(x.hours))}${L(PT[x.pay_type]||'報酬', x.amount?yen(x.amount):'--')}</div>
    <div class="card"><div class="gh">支給対象</div>${pay.join('')}</div><div class="card"><div class="gh">控除対象</div>${dd.join('')}</div>
    <div class="card">${L('総支給額', cm(N(x.taxable)-ded))}${L('課税対象額', cm(x.taxable))}${L('源泉徴収', cm(x.withholding))}${L('日払（立替）', cm(x.advance))}${N(x.prev_adjust)?L('前月精算', (N(x.prev_adjust)<0?'−':'')+Math.abs(N(x.prev_adjust)).toLocaleString('ja-JP')):''}${L('残り支給額', (net<0?'−':'')+'¥'+Math.abs(net).toLocaleString('ja-JP'), 'n')}</div>`;
}

// 明細・日払・罰金を1つの枠に（オーナー「ジャンルごとに枠があって、スペースをくうし、見にくい」）。マイページと、毎月1日の PDF（Edge Function monthly-export がこのファイルを読む）で同じものを使う
function slipOne(P){
  const adv = (P.advances||[]).map(a => `<div class="row"><span>${mdW(a.date)}</span><b>${yen(a.amount)}</b></div>`).join('');
  const fl = (P.fines||[]).map(f => `<div class="row"><span>${mdDay(f.date)} ${esc(f.reason||'')}</span><b>${f.wage_pct?`時給の${f.wage_pct}%`:yen(f.amount)}</b></div>`).join('');
  return `<div class="card one">${(slipHtml(P) + `<div class="card"><div class="gh">日払（立替）</div>${adv||'<div class="muted sm">なし</div>'}</div><div class="card"><div class="gh">罰金</div>${fl||'<div class="muted sm">なし</div>'}</div>`).replace(/class="card"/g, 'class="sec"')}</div>`;
}
