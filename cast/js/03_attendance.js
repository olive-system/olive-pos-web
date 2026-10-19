// v0.04・SQL 099：勤怠（月ごとの打刻の履歴。時刻は丸め後＝報酬計算と同じ）
const ym = d => String(d).slice(0,7), mAdd = (m, n) => { const [y, mo] = m.split('-').map(Number); const x = new Date(y, mo - 1 + n, 1); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-01`; };
async function attend(month){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_attendance', { p_token: TOKEN, p_month: month });
  if(r.error){ fail(r.error.message); return; }
  const A = r.data, m = String(A.month), cur = String(ME.month), [y, mo] = m.split('-').map(Number);
  const prevOk = m > mAdd(cur, -12), nextOk = m < cur;
  const rows = (A.days||[]).map(d => `<tr><td>${Number(d.date.slice(5,7))}/${Number(d.date.slice(8,10))}（${WD[new Date(d.date+'T00:00:00+09:00').getDay()]}）</td><td>${d.in?tTxt(d.in):'—'}</td><td>${d.out?tTxt(d.out):'—'}</td><td>${d.hours!=null?HM(d.hours).replace('時間',':').replace('分',''):'—'}</td><td class="mk">${[d.douhan?'同伴':'', d.after?'アフター':''].filter(Boolean).join('・')}</td></tr>`).join('');
  show(`<div class="mon"><button id="mP" ${prevOk?'':'disabled'} aria-label="前の月">‹</button><b>${y}年${mo}月</b><button id="mN" ${nextOk?'':'disabled'} aria-label="次の月">›</button></div>
    <div class="card"><div class="row"><span>出勤日数</span><b>${Number(A.total_days)}日</b></div><div class="row"><span>稼働時間</span><b>${HM(A.total_hours)}</b></div></div>
    <div class="card" style="padding:0;overflow:hidden">${rows?`<table class="t"><tr><th>日付</th><th>出勤</th><th>退勤</th><th>稼働</th><th></th></tr>${rows}</table>`:'<div class="muted" style="padding:12px">打刻はありません</div>'}<div class="muted sm" style="padding:8px 10px">時刻は15分丸め後（報酬計算と同じ）</div></div>`);
  $('mP').onclick = () => attend(mAdd(m, -1)); $('mN').onclick = () => attend(mAdd(m, 1));
}

