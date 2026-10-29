// v0.14・SQL 113：予約／同伴申請と予約一覧（自分が取った予約＋自分が係の予約）。お客様はフルネーム1つの欄・係はキャストから選ぶ・変更と取消は取った本人がその場で（承認なし。2026-10-15 オーナー）
//   申請・変更・取消をすると、お店（公式 LINE のトーク）と係のキャストに LINE が届く。POS に出す所は後で
const resvLine = r => `${Number(String(r.date).slice(5,7))}/${Number(String(r.date).slice(8,10))}（${WD[new Date(r.date+'T00:00:00+09:00').getDay()]}）${r.time}　${r.name} 様 ${r.guests}名`;
// LINE の文（SQL 114 の resv_text と同じ形。2026-10-15 オーナーの見本：【同伴】／日時　人数／お客様 様　係／誘客／メモ）。2026-10-23：待ち合わせは外した（オーナー「待ち合わせの時刻いらない」）
// v0.79・SQL 265：同伴の子（申請した子だけでない時）と VIPルームの行（オーナー 2026-10-27「VIPルームの希望を伝える何か」「同伴が2名3名の時はお客様の数までキャストを選ぶ」）
const rvDh = (x, by) => { const L = x.dh_names || x.dh || []; return x.douhan && (L.length > 1 || (L.length === 1 && L[0] !== (by ?? x.by))) ? '同伴 ' + L.join('・') : ''; };
const resvMsg = (head, x, kn, by) => `【${x.douhan?head.replace('予約','同伴'):head}】\n${resvLine(x).split('　')[0]}　${x.guests}名\n${x.name} 様${RV_NOKK()?'':`　${KL} ${kn}`}\n誘客 ${by}${rvDh(x, by)?`\n${rvDh(x, by)}`:''}${x.vip?`\n${x.vip} 希望`:''}${x.memo?`\nメモ：${x.memo}`:''}`;
// v0.79：予約のしるし（同伴・VIPルーム）は右の決まった列に（オーナー 2026-10-27「VIP、VIP同伴の表示の列がバラバラで見にくい」）
const rvTag = v => v ? `<b style="color:var(--ok);font-size:12px;white-space:nowrap">${esc(v)}</b>` : '';
const rvTags = x => `<span>${rvTag(x.douhan && '同伴')}</span><span>${rvTag(x.vip)}</span>`;
const rvRow = (x, sub, i) => { const s = [rvDh(x), sub].filter(Boolean).join('・');
  return `<div style="padding:6px 0;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="display:grid;grid-template-columns:3.2em minmax(0,1fr) 2.4em 3.4em;gap:6px;align-items:baseline"><b>${esc(x.time)}</b><span>${esc(x.name)} 様 ${Number(x.guests)||0}名</span>${rvTags(x)}</div>${s ? `<div class="muted sm" style="padding-left:calc(3.2em + 6px)">${esc(s)}</div>` : ''}</div>`; };
// v0.86：広島はお店のお客様で、女の子に担当は無い（POS の担当は誘客した子を報酬に付ける印だけ。2026-10-28 オーナー）→ 予約画面に担当を出さない。担当は申請した子（誘客）
const RV_NOKK = () => STORE === 'hiroshima'; /* v0.92：女の子の LINE から送る文（resvMsg）にも担当を出さない（2026-10-29 オーナー「まだあるけど？」）。お店・同伴の子に届く文は SQL 288 */
let RESV = [], NOTICES = [];
async function resvList(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_resv_list', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  RESV = r.data || [];
  // v0.79：同伴の子にも出す（誘客・係のほかに）。ありがとうは係だけ
  const rows = RESV.map((x, i) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="row" style="padding:0"><span>${esc(resvLine(x))}</span>${x.douhan||x.vip?`<span style="display:grid;grid-template-columns:2.4em 3.4em;gap:6px;flex:none">${rvTags(x)}</span>`:''}</div>
    <div class="muted sm">${RV_NOKK()?`誘客 ${x.mine?'自分':esc(x.by)}`:x.mine?`誘客 自分・${KL} ${x.kakari_name===ME.name?'自分':esc(x.kakari_name||'')}`:x.is_kakari?`誘客 ${esc(x.by)}・${KL} 自分`:`誘客 ${esc(x.by)}・${KL} ${esc(x.kakari_name||'')}`}${rvDh(x)?`・${esc(rvDh(x))}`:''}${x.memo?`・${esc(x.memo)}`:''}</div>
    ${x.mine&&x.thanked?`<div class="sm" style="color:var(--ok);margin-top:2px">ありがとう ${esc(x.kakari_name||'')}${x.thanks_note?`「${esc(x.thanks_note)}」`:''}</div>`:''}
    ${!x.mine&&x.is_kakari?(x.thanked?`<button data-thv="${i}" style="display:block;background:none;border:none;padding:2px 0 0;font:inherit;font-size:13px;color:var(--ok);text-align:left">ありがとう済み ›</button>`:`<div style="margin-top:6px"><button class="btn g" data-th="${i}" style="width:auto;padding:6px 16px">ありがとう</button></div>`):''}
    ${x.mine?`<div style="display:flex;gap:8px;margin-top:6px"><button class="btn g" data-ed="${i}" style="width:auto;padding:6px 16px">変更</button><button class="btn g" data-cx="${i}" style="width:auto;padding:6px 16px;color:var(--warn)">取消</button></div>`:''}</div>`).join('');
  show(`<button class="btn" id="rvNew" style="margin-bottom:12px">予約／同伴申請</button><div class="card"><div class="gh">予約一覧</div>${rows||'<div class="muted sm" style="padding:8px 0">予約はありません</div>'}</div>`);
  $('rvNew').onclick = () => resvForm(null);
  $('main').querySelectorAll('[data-ed]').forEach(b => b.onclick = () => resvForm(RESV[b.dataset.ed]));
  $('main').querySelectorAll('[data-cx]').forEach(b => b.onclick = () => resvCancel(RESV[b.dataset.cx]));
  $('main').querySelectorAll('[data-th]').forEach(b => b.onclick = () => resvThanks(RESV[b.dataset.th]));
  /* v0.77：「ありがとう済み」を押すと、送ったありがとうの文を小窓で（オーナー 2026-10-27「なんてありがとうを送ったのかがわかるように。小窓で良い」）。文は SQL 113 の cast_resv_thanks と同じ形 */
  $('main').querySelectorAll('[data-thv]').forEach(b => b.onclick = () => { const x = RESV[b.dataset.thv]; uiAlert(`${x.by}さんに送ったありがとう\n\n【ありがとう】${ME.name}\n${resvLine(x).split('　')[0]}　${x.guests}名\n${x.name} 様${x.thanks_note ? `\nひとこと：${x.thanks_note}` : ''}`); });
}
