// v0.04・SQL 099：報酬明細（前月分だけ。管理サイトの報酬支払明細書と同じ中身）・PDF・受取確認（15日から、手書きサイン）
const N = v => Number(v||0), cm = v => N(v) ? N(v).toLocaleString('ja-JP') : '--';
function slipHtml(P){
  if(P.hall) return hallSlipHtml(P);
  const x = P.slip, L = (k, v, c='') => `<div class="row ${c}"><span>${esc(k)}</span><b>${v}</b></div>`, B = k => N(x.backs?.[k]?.amount);
  const ded = N(x.ctax) + N(x.fines) + N(x.quota_fine) + N(x.welfare) + N(x.special_deduct);
  const pay = [L(x.pay_type==='daily'?'報酬（日給）':'報酬（時給）', cm(x.time_pay)), L('小計バック', cm(x.kakari_back)), ...(x.seppan?[L(`折半（${N(x.seppan_pct)}%）`, cm(x.seppan_pay))]:[]), L('HC', cm(B('hc'))), L('ボトルバック', cm(B('bottle'))), L('商品バック', cm(B('other'))), L('手当など、その他', cm(N(x.allowance)+N(x.special_pay))), L('合計', cm(x.taxable), 's')];
  const dd = [L('消費税', cm(x.ctax)), ...(P.fine_names||[]).map(f => L(f, cm(x.fine_items?.[f]))), L('同伴ノルマ', cm(x.quota_fine)), L('厚生費', cm(x.welfare)), L('個別控除', cm(x.special_deduct)), L('合計', cm(ded), 's')];
  const [y, mo] = String(P.month).split('-').map(Number), net = N(x.net);
  return `<div class="card"><div class="ttl">報酬支払明細書</div><div class="muted sm" style="text-align:center;margin-bottom:6px">${y}年${mo}月分　${esc(P.store_name)}　${esc(P.name)}${P.real_name?'/'+esc(P.real_name):''}</div>
      ${L('稼働日数', `${N(x.days)}日`)}${L('稼働時間', HM(x.hours))}${L(x.pay_type==='daily'?'決定日給':'決定時給', x.wage?yen(x.wage):'--')}</div>
    <div class="card"><div class="gh">支給対象</div>${pay.join('')}</div><div class="card"><div class="gh">控除対象</div>${dd.join('')}</div>
    <div class="card">${L('総支給額', cm(N(x.taxable)-ded))}${L('課税対象額', cm(x.taxable))}${L('源泉徴収', cm(x.withholding))}${L('日払（立替）', cm(x.advance))}${L('残り支給額', (net<0?'−':'')+'¥'+Math.abs(net).toLocaleString('ja-JP'), 'n')}</div>`;
}
