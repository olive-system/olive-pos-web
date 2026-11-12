// v0.07・SQL 101：サインの画像を置いて、店から送信。置けなかった・送れなかった時は、次に報酬明細を開いた時に送り直す
async function pushSign(id, png, uploaded){
  try{
    if(!uploaded){ const blob = await (await fetch(png)).blob(); const up = await sb.storage.from('pay-signs').upload(`${id}.png`, blob, { contentType:'image/png', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) return false; }
    const r = await sb.rpc('cast_pay_push', { p_token: TOKEN, p_receipt: id }); return !r.error && r.data?.status === 'sent';
  }catch(e){ return false; }
}
async function payslip(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  { const pd = await sb.rpc('cast_pay_pending', { p_token: TOKEN }); if(!pd.error && pd.data) await pushSign(pd.data.id, pd.data.signature, pd.data.uploaded); }
  const r = await sb.rpc('cast_pay_slip', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  // SQL 468：上に今月の途中の明細、下に前の月（毎月1日 10:30 に固めた PDF と受取確認）
  const P = r.data, Q = P.prev || {}, [, mo] = String(P.month).split('-').map(Number), [py, pmo] = String(Q.month).split('-').map(Number);
  const at = t => new Date(t).toLocaleString('ja-JP', { timeZone:'Asia/Tokyo', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
  const now = P.leaving ? '' : `<div class="mon"><span></span><b>${String(P.month).slice(0,4)}年${mo}月分（${mdDay(P.today)} まで）</b><span></span></div>${P.slip ? slipOne(P) : `<div class="card c muted">${mo}月分の明細はありません</div>`}`;
  const pdf = Q.pdf ? `<a class="btn g" href="${esc(Q.pdf)}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">報酬支払明細書（PDF）</a><div class="muted sm" style="margin:4px 0 12px">表示期限 ${at(Q.until)}</div>`
    : Q.made ? '' : new Date(Q.make_at) > new Date() ? `<div class="muted sm" style="margin-bottom:12px">PDF 作成予定 ${at(Q.make_at)}</div>` : '';
  const rc = Q.receipt ? `<div class="big" style="margin-top:6px">受取確認済</div><div class="muted sm">${at(Q.receipt.signed_at)}</div>`
    : Q.can_sign ? `<div class="gh">受取確認（報酬を受け取ったらサイン）</div><canvas class="sign" id="sg"></canvas><div class="row" style="margin-top:8px;gap:8px"><button class="btn g" id="sgClr" style="width:auto;padding:10px 16px">再入力</button><button class="btn" id="sgOk" style="flex:1">受取確認</button></div>`
    : `<div class="muted sm">受取確認は15日からです</div>`;
  show(`${now}${pdf || Q.receipt || Q.can_sign || Q.made || P.leaving ? `<div class="card"><div class="gh">${pmo}月分</div>${pdf}${rc}</div>` : ''}`);
  if(Q.receipt || !Q.can_sign) return;
  const cv = $('sg'), pad = signPad(cv);
  $('sgClr').onclick = pad.clear;
  $('sgOk').onclick = async e => {
    if(!pad.drawn()){ await uiAlert('サインを入力してください'); return; }
    if(!await uiConfirm(`${pmo}月分の報酬を受け取りましたか？\n受取確認は取消できません`)) return;
    e.target.disabled = true;
    const png = cv.toDataURL('image/png');
    const q = await sb.rpc('cast_pay_sign', { p_token: TOKEN, p_signature: png });
    if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; }
    const net = N(q.data.net);
    try{ await liff.sendMessages([{ type:'text', text:`${py}年${pmo}月分の報酬として ${(net<0?'−':'')}${Math.abs(net).toLocaleString('ja-JP')}円 を受け取りました。\n${ME.name}（${at(q.data.signed_at)}）` }]); }catch(e){ await uiAlert('公式 LINE への送信に失敗しました。黒服に LINE でもご連絡ください'); }
    // v0.06・SQL 100：サインの画像を保存して、店（公式 LINE）から本人のトークへ「○月分 報酬 ○円 の受取サイン」＋画像を送信
    await pushSign(q.data.id, png, false);
    payslip();
  };
}

