// v0.03・SQL 098：当日欠勤。理由は自由入力。罰金のルールは本人の報酬（時給／日給）の分だけ出し、今の時刻に当たる行を赤くする
const WD = ['日','月','火','水','木','金','土'];
const dTxt = d => { const x = new Date(d + 'T00:00:00+09:00'); return `${x.getMonth()+1}月${x.getDate()}日（${WD[x.getDay()]}）`; };
const tTxt = t => new Date(t).toLocaleTimeString('ja-JP', { timeZone:'Asia/Tokyo', hour:'2-digit', minute:'2-digit', hour12:false });
const fineTxt = (f, pt) => !f ? '—' : f.calc === 'hourly_pct' ? `時給の${f.value}%` : f.calc === 'daily_pct' ? `日給の${f.value}%` : f.calc === 'yen' ? yen(f.value) : '—';
async function absent(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_absence_info', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const A = r.data;
  if(A.sent){ absentDone(A.date, A.sent.at, A.sent.fine_name, true); return; }
  const t = A.types || {}, rows = [['13時までの連絡', t.early, false], ['13時以降・金曜日・イベント日', t.late, true]].filter(x => x[1]);
  const rule = rows.length ? `<div class="warnbox"><b class="t">当日欠勤の罰金</b><table>${rows.map(x => `<tr class="${x[2]===!!A.is_late?'hi':''}"><td>${x[0]}</td><td>${esc(fineTxt(x[1], t.pay_type))}</td></tr>`).join('')}</table>
    <div class="now">現在の連絡は「${A.is_late ? '13時以降・金曜日・イベント日' : '13時までの連絡'}」に該当します</div></div>` : '';
  show(`<div class="subh">${dTxt(A.date)} ${tTxt(A.now)}</div>
    <div class="card"><label class="f" for="abR">理由</label><textarea id="abR" maxlength="300"></textarea></div>${rule}
    <button class="btn" id="abGo">欠勤連絡</button><p class="muted sm" style="margin:10px 2px">送信内容は公式 LINE のトークにも送信されます</p>`);
  $('abGo').onclick = async () => {
    const rs = $('abR').value.trim(); if(!rs){ await uiAlert('理由を入力してください'); return; }
    if(!await uiConfirm(`${dTxt(A.date)}の欠勤連絡を送信しますか？`)) return;
    $('abGo').disabled = true;
    const q = await sb.rpc('cast_absence_submit', { p_token: TOKEN, p_reason: rs });
    if(q.error){ $('abGo').disabled = false; await uiAlert(q.error.message); return; }
    let lineOk = true;
    try{ await liff.sendMessages([{ type:'text', text:`【当日欠勤】${dTxt(q.data.date)} ${tTxt(q.data.at)}\n${ME.name}\n理由：${rs}` }]); }catch(e){ lineOk = false; }
    absentDone(q.data.date, q.data.at, q.data.fine_name, false, lineOk);
  };
}
function absentDone(date, at, fine, already, lineOk = true){
  setBack(home);
  show(`<div class="card c"><div class="big">${already ? '送信済み' : '送信完了'}</div><p>${dTxt(date)}の欠勤連絡を受付しました。</p>
    <div class="row" style="text-align:left"><span>連絡時刻</span><b>${tTxt(at)}</b></div><div class="row" style="text-align:left"><span>罰金</span><b>${esc(fine || 'なし')}</b></div>
    <div class="muted sm">取消は黒服にご連絡ください</div>${lineOk ? '' : '<p class="err sm">公式 LINE への送信に失敗しました。黒服に LINE でもご連絡ください</p>'}</div>
    <button class="btn g" id="abHome">ホーム</button>`);
  $('abHome').onclick = home;
}

