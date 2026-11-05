// v0.37・SQL 145：黒服の TODO（オーナー 2026-10-18。TimeTree の「todoリスト写メ報告」の代わり）。その日の出勤の黒服がやる。写真が要る項目は撮らないと完了にならない。できない時は理由
const TODO_SLOT = { open:'開店作業', close:'閉店作業', by17:'17時まで', none:'' };
async function hallTodo(){
  setBack(hallHome); show('<div class="muted" style="padding:20px">読み込み中…</div>');
  const [r, ab] = await Promise.all([sb.rpc('hall_todos', { p_token: TOKEN }), sb.rpc('hall_ab_items', { p_token: TOKEN })]); if(r.error){ show(`<div class="card">${esc(r.error.message)}</div>`); return; }
  tdAB = ab.error ? null : ab.data; /* v1.25・SQL 364：AB棚の棚卸し */
  const D = r.data, L = D.items || [], d = new Date(D.day+'T00:00:00+09:00');
  const st = x => x.status === 'done' ? `<b style="color:var(--ok)">完了　${esc(x.by||'')} ${x.at?new Date(x.at).toTimeString().slice(0,5):''}</b>${x.late?' <b style="color:var(--warn)">17:00 超過</b>':''}` : x.status === 'skip' ? `<b style="color:var(--muted)">できない　${esc(x.by||'')} ${x.at?new Date(x.at).toTimeString().slice(0,5):''}</b>` : `<b style="color:var(--warn)">未完了${x.late?'　17:00 超過':''}</b>`;
  /* v0.69・SQL 234：休日分（休みの日の TODO を次の営業日に。オーナー 2026-10-25「営業日初日に全部やる」「長い連休は17時まで」）。言葉は用語集：休日分・本日分・期限 閉店・期限 17:00 */
  const md = s => { const x = new Date(s+'T00:00:00+09:00'); return `${x.getMonth()+1}/${x.getDate()} ${WD[x.getDay()]}`; };
  const tag = t => `<small class="muted" style="border:1px solid var(--line);border-radius:6px;padding:1px 6px;white-space:nowrap">${t}</small>`;
  const card = (x,i) => `<button class="card" data-td="${i}" style="display:block;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(x.name)}</b>${x.carry ? tag(md(x.day)) : TODO_SLOT[x.slot] ? tag(TODO_SLOT[x.slot]) : ''}</div>
    <div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px;font-size:14px"><span class="muted">${[x.need_photo?'写真':'', x.need_note?'書く':''].filter(Boolean).join('・')}</span>${st(x)}</div></button>`;
  const C = L.map((x,i) => [x,i]).filter(([x]) => x.carry), T = L.map((x,i) => [x,i]).filter(([x]) => !x.carry), cd = D.carry_days || [], late17 = D.deadline === '17:00';
  const sec = (t, right, warn) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:12px 2px 6px;font-weight:700;${warn?'color:var(--warn)':''}"><span>${t}</span>${right||''}</div>`;
  show(`<div class="ttl">TODO　${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）</div>
    ${C.length ? sec(`休日分（${cd.length>2 ? `${md(cd[0])}〜${md(cd[cd.length-1])}` : cd.map(md).join('・')}）`, `<span style="${late17?'background:var(--warn-soft);color:var(--warn);':'color:var(--muted);font-weight:400;'}border-radius:6px;padding:2px 8px;font-size:13px;white-space:nowrap">期限 ${esc(D.deadline||'閉店')}</span>`, late17) + C.map(([x,i]) => card(x,i)).join('') + sec('本日分') : ''}
    ${T.map(([x,i]) => card(x,i)).join('') || '<div class="card muted">本日分の TODO はありません</div>'}`);
  $('main').querySelectorAll('[data-td]').forEach(b => b.onclick = () => hallTodoOne(L[+b.dataset.td]));
}
// v0.87・SQL 276：写真は40枚まで（広島の黒服の報告 2026-10-28「充電の写真は24枚上げる必要があるが10枚までしか送れない」）
// v0.52：写真は10枚まで（並べて見て × で外せる）・完了の後も精算までは「やり直す」（黒服の報告 2026-10-22 → オーナー「この形でよい」「精算までは直せる」・SQL 176）
let tdShots = [];
/* v1.25・SQL 364：AB棚の棚卸し（オーナー 2026-11-05「先入観なくできる棚卸しで」）。数える人には理論在庫も前回の数も出さない。空欄から入力 */
let tdAB = null, tdAbVals = {};
const tdAbOk = v => /^\d{1,3}$/.test(String(v ?? '').trim());
/* v1.28・SQL 367：AB棚の下にワイン・シャンパンも品ごと（オーナー 2026-11-05「ア 品ごと」・見本 作業場/棚卸し_ワイン・シャンパン_案.png） */
const tdAbGroups = () => (tdAB && tdAB.groups) || (tdAB ? [{ title: 'AB棚', products: tdAB.products || [] }] : []);
const tdAbCnt = P => { const n = P.filter(p => tdAbOk(tdAbVals[p.id])).length; return `入力済み ${n}品・未入力 ${P.length - n}品`; };
function tdAbHtml(x, done){
  if(!tdAB || tdAB.item !== x.id || !(tdAB.products || []).length) return '';
  const G = tdAbGroups().filter(g => (g.products || []).length), C = tdAB.counts || {}, row = (p, i, r) => `<div style="display:flex;align-items:center;gap:8px;padding:9px 2px;${i ? 'border-top:1px solid var(--line)' : ''}"><div style="flex:1;line-height:1.4">${esc(p.name)}</div>${r}<span class="muted sm" style="width:1.5em">本</span></div>`;
  if(done) return Object.keys(C).length ? G.map(g => `<div class="card"><b>${esc(g.title)}</b>${g.products.map((p, i) => row(p, i, `<b>${C[p.id] ?? ''}</b>`)).join('')}</div>`).join('') : '';
  return G.map((g, gi) => `<div class="card"><div style="display:flex;align-items:baseline;margin-bottom:2px"><b style="flex:1">${esc(g.title)}</b><span class="muted sm" data-abn="${gi}">${tdAbCnt(g.products)}</span></div>
    ${g.products.map((p, i) => row(p, i, `<input data-ab="${p.id}" data-abg="${gi}" inputmode="numeric" maxlength="3" value="${esc(tdAbVals[p.id] ?? '')}" style="width:64px;text-align:right;font:inherit;font-size:16px;padding:6px 8px;border:1px solid var(--line);border-radius:8px">`)).join('')}</div>`).join('');
}
function hallTodoOne(x, keep){
  setBack(hallTodo); if(!keep){ tdShots = []; tdAbVals = {}; }
  const fld = 'width:100%;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card);color:var(--ink);box-sizing:border-box';
  const done = x.status === 'done', ph = (x.photos && x.photos.length) ? x.photos : (x.photo ? [x.photo] : []);
  const grid = L => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px">${L}</div>`;
  show(`<div class="ttl">${esc(x.name)}</div><div class="card">${TODO_SLOT[x.slot]?`<div class="muted" style="font-size:13px;margin-bottom:6px">${TODO_SLOT[x.slot]}</div>`:''}<div style="white-space:pre-wrap;line-height:1.7">${esc(x.steps||'手順なし')}</div></div>
    ${done ? `<div class="card"><b style="color:var(--pri)">済　${esc(x.by||'')}</b>${ph.length?` <small class="muted">（写真 ${ph.length}枚）</small>`:''}${x.note?`<div style="white-space:pre-wrap;margin-top:6px">${esc(x.note)}</div>`:''}${ph.length?grid(ph.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block"></a>`).join('')):''}</div>${tdAbHtml(x, true)}
    <button class="btn g" id="tdRedo">やり直す</button><div class="muted sm" style="text-align:center;margin-top:4px">その日の精算を保存するまで直せます</div>` : `
    ${x.status === 'skip' ? `<div class="card"><b class="muted">できない　${esc(x.by||'')}</b><div style="margin-top:4px">${esc(x.reason||'')}</div></div>` : ''}
    ${tdAbHtml(x)}
    ${x.need_note ? `<label class="f" style="display:block;margin-top:8px">${esc(x.note_hint||'内容')}<textarea id="tdN" maxlength="2000" style="${fld};min-height:120px">${esc(keep&&keep.note!=null?keep.note:(x.note||''))}</textarea></label>` : ''}
    ${x.need_photo ? `<div id="tdPs">${grid(tdShots.map((f,i)=>`<div style="position:relative"><img src="${f.url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block"><button data-tdx="${i}" aria-label="外す" style="position:absolute;top:4px;right:4px;width:28px;height:28px;border-radius:14px;border:none;background:var(--ink);color:var(--card);font-size:16px;line-height:1;padding:0">×</button></div>`).join('') + (tdShots.length<40?`<label style="display:flex;align-items:center;justify-content:center;aspect-ratio:1;border:1px dashed var(--line);border-radius:8px;cursor:pointer;color:var(--muted)">＋撮る<input type="file" id="tdP" accept="image/*" capture="environment" style="display:none"></label>`:''))}<div class="muted sm" style="text-align:center;margin-top:4px">${tdShots.length?`写真 ${tdShots.length}枚`:'写真を撮ってください'}${tdShots.length>=40?'（40枚まで）':''}</div></div>` : ''}
    <button class="btn" id="tdGo">${x.need_photo ? '写真を送って完了' : '完了'}</button><button class="btn g" id="tdNo" style="margin-top:8px">できない（理由を書く）</button>`}`);
  if(done){ $('tdRedo').onclick = async () => { if(!await uiConfirm('やり直しますか？\nこの TODO は「未」に戻ります。もう一度送ってください')) return;
      $('tdRedo').disabled = true; const q = await sb.rpc('hall_todo_redo', { p_token: TOKEN, p_item: x.id , ...(x.carry ? { p_day: x.day } : {}) }); if(q.error){ $('tdRedo').disabled = false; await uiAlert(q.error.message); return; }
      hallTodoOne({ ...x, status: 'open', photos: [], photo: null }); }; return; }
  const redraw = () => hallTodoOne(x, { note: $('tdN') ? $('tdN').value : null });
  const abP = tdAB && tdAB.item === x.id ? tdAB.products || [] : [];
  $('main').querySelectorAll('[data-ab]').forEach(b => b.oninput = () => { tdAbVals[b.dataset.ab] = b.value.trim(); const g = tdAbGroups().filter(g => (g.products || []).length)[+b.dataset.abg]; $('main').querySelector(`[data-abn="${b.dataset.abg}"]`).textContent = tdAbCnt(g.products); });
  if($('tdP')) $('tdP').onchange = () => { const f = $('tdP').files[0]; if(!f) return; tdShots.push({ file: f, url: URL.createObjectURL(f) }); redraw(); };
  $('main').querySelectorAll('[data-tdx]').forEach(b => b.onclick = () => { const k = +b.dataset.tdx; URL.revokeObjectURL(tdShots[k].url); tdShots.splice(k, 1); redraw(); });
  $('tdGo').onclick = async () => {
    const note = $('tdN') ? $('tdN').value.trim() : null;
    if(x.need_note && !note){ await uiAlert(`${x.note_hint||'内容'}を書いてください`); return; }
    if(abP.some(p => !tdAbOk(tdAbVals[p.id]))){ await uiAlert('未入力の品があります'); return; }
    if(x.need_photo && !tdShots.length){ await uiAlert('写真を撮ってください'); return; }
    $('tdGo').disabled = true;
    try{
      if(abP.length){ const c = await sb.rpc('hall_ab_count', { p_token: TOKEN, p_item: x.id, p_rows: Object.fromEntries(abP.map(p => [p.id, tdAbVals[p.id]])), ...(x.carry ? { p_day: x.day } : {}) }); if(c.error) throw c.error; }
      if(x.need_photo){ const p = await sb.rpc('hall_todo_photos', { p_token: TOKEN, p_item: x.id, p_count: tdShots.length , ...(x.carry ? { p_day: x.day } : {}) }); if(p.error) throw p.error;
        const n = tdShots.length; $('tdGo').textContent = `送っています（0/${n}）`; /* v0.94：3枚ずつ同時に送る。数は送り終わった枚数 */
        await upPool(n, async i => { const blob = await shrinkJpeg(tdShots[i].file); const up = await sb.storage.from('todo-photos').upload(`${p.data[i]}.jpg`, blob, { contentType:'image/jpeg', upsert:false }); if(up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error; },
          k => { $('tdGo').textContent = `送っています（${k}/${n}）`; }); }
      const q = await sb.rpc('hall_todo_done', { p_token: TOKEN, p_item: x.id, p_note: note , ...(x.carry ? { p_day: x.day } : {}) }); if(q.error) throw q.error;
      tdShots.forEach(f => URL.revokeObjectURL(f.url)); tdShots = []; tdAbVals = {};
      await uiAlert('完了しました'); hallTodo();
    }catch(e){ $('tdGo').disabled = false; $('tdGo').textContent = x.need_photo ? '写真を送って完了' : '完了'; await uiAlert(e.message || String(e)); }
  };
  $('tdNo').onclick = () => {
    show(`<div class="ttl">${esc(x.name)}</div><label class="f" style="display:block">できない理由<textarea id="tdR" maxlength="500" style="${fld};min-height:100px">${esc(x.reason||'')}</textarea></label><button class="btn" id="tdRGo">送る</button>`);
    setBack(() => hallTodoOne(x, {}));
    $('tdRGo').onclick = async () => { const rs = $('tdR').value.trim(); if(!rs){ await uiAlert('理由を書いてください'); return; }
      $('tdRGo').disabled = true; const q = await sb.rpc('hall_todo_skip', { p_token: TOKEN, p_item: x.id, p_reason: rs , ...(x.carry ? { p_day: x.day } : {}) }); if(q.error){ $('tdRGo').disabled = false; await uiAlert(q.error.message); return; } await uiAlert('送りました'); hallTodo(); };
  };
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
    <div class="card">${L('総支給額', cm(N(x.taxable)-ded))}${L('課税対象額', cm(x.taxable))}${L('源泉徴収', cm(x.withholding))}${L('日払（立替）', cm(x.advance))}${L('残り支給額', (net<0?'−':'')+'¥'+Math.abs(net).toLocaleString('ja-JP'), 'n')}</div>`;
}
const hm2 = t => t ? new Date(t).toLocaleTimeString('ja-JP', { timeZone:'Asia/Tokyo', hour:'2-digit', minute:'2-digit', hour12:false }) : '';
const mdj = d => { const t = new Date(d+'T00:00:00+09:00'); return `${t.getMonth()+1}/${t.getDate()}（${WD[t.getDay()]}）`; };
async function hallCasts(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('hall_casts', { p_token: TOKEN }); if(r.error){ fail(r.error.message); return; }
  const C = r.data.casts || [];
  // 10人まで並ぶので、1人2行（1行目：名前・当日欠勤／2行目：成績・未提出）
  show(`<div class="ttl">担当キャスト ${C.length}人</div>${C.length ? `<div class="card" style="padding:4px 12px">${C.map((c, i) => { const st = c.stats || {};
    const att = c.absent ? `<b class="err">当日欠勤</b>` : '';   // 出退勤の時刻は閉店作業で確かめる（オーナー 2026-10-17）
    const todo = [c.sales_left ? 'アプローチ' : '', c.docs ? esc(c.docs) : '', c.dress ? `ドレス ${mdj(c.dress).replace(/（.）/,'')}まで` : ''].filter(Boolean);
    return `<div style="padding:8px 0;${i?'border-top:1px solid var(--line)':''}"><div class="row" style="padding:0"><b>${esc(c.name)}</b><span class="sm">${att}</span></div>
      <div class="sm muted" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>${esc(KL)}小計 ${Math.round(N(st.sales)/10000).toLocaleString('ja-JP')}万・同伴${N(st.douhan)}・反応◎${N(st.reactions)}</span>${todo.length?`<span class="err">未提出：${todo.join('・')}</span>`:''}</div>
      ${c.absent?`<div class="sm err">${hm2(c.absent.at)}・${esc(c.absent.reason||'')}</div>`:''}</div>`; }).join('')}</div>` : '<div class="card c muted">担当キャストがいません</div>'}`);
}
let hcOpen = new Set();
/* v0.38：天気はアイコン（Meteocons・MIT）＋小さい言葉（オーナー 2026-10-18「“晴”はパッとみでわからん」「絵文字やめて、ちゃんと探して」→ ア）。20時〜翌1時なので夜のアイコン */
const WXT=c=>c==null?['—',null]:c<=1?['晴れ','clear-night']:c===2?['晴れ時々くもり','partly-cloudy-night']:c===3?['くもり','overcast-night']:c<=48?['霧','fog-night']:c<=57?['霧雨','drizzle']:c<=67?['雨','rain']:c<=77?['雪','snow']:c<=82?['にわか雨','partly-cloudy-night-rain']:c<=86?['にわか雪','partly-cloudy-night-snow']:['雷雨','thunderstorms-night-rain'];
const WXN=c=>WXT(c)[0], WXI=(c,px)=>{ const [t,n]=WXT(c); return n?`<img src="https://cdn.jsdelivr.net/npm/@bybas/weather-icons@2.0.0/production/fill/all/${n}.svg" alt="${t}" style="width:${px}px;height:${px}px;display:block;margin:0 auto">`:'—'; };
/* v1.16・SQL 344：売上予測（目標・現在・予測。昨日まで。POS の朝礼と同じ。2026-11-04 オーナー・見本 作業場/売上予測_案7.png） */
function hcFc(F){ const md = x => { const t = new Date(x+'T00:00:00+09:00'); return `${t.getMonth()+1}/${t.getDate()}`; }, no = '<span class="muted">—</span>', g = n => n==null ? no : `${n}組`, y = n => n==null ? no : yen(n);
  const th = 'color:var(--muted);font-weight:700;font-size:12px;text-align:right;padding:4px 0 4px 6px;border-top:1px solid var(--line)', td = 'padding:4px 0 4px 6px;border-top:1px solid var(--line);font-weight:700;text-align:right;white-space:nowrap', tl = 'padding:4px 0;border-top:1px solid var(--line);font-weight:700';
  return `<div class="gh" style="margin-top:8px">${F.month}月（${md(F.from)}〜${md(F.to)}）　営業日数 ${F.done} / ${F.days}日</div>
    <table style="border-collapse:collapse;width:100%;font-size:14px"><tr><th style="${th}"></th><th style="${th}">目標</th><th style="${th}">現在</th><th style="${th}">予測</th></tr>
    <tr><td style="${tl}">売上</td><td style="${td}">${y(F.target)}</td><td style="${td}">${yen(F.sales)}</td><td style="${td}">${y(F.fc_sales)}</td></tr>
    <tr><td style="${tl}">組数</td><td style="${td}">${g(F.tgt_groups)}</td><td style="${td}">${F.groups}組</td><td style="${td}">${g(F.fc_groups)}</td></tr></table>
    <div class="row" style="font-size:14px"><span class="muted">1日平均売上</span><b>${y(F.avg)}</b></div><div class="row" style="font-size:14px"><span class="muted">1日必要組数</span><b>${g(F.need)}</b></div><div class="row" style="font-size:14px"><span class="muted">平均客単価</span><b>${y(F.unit)}</b></div>`; }
/* v0.94：朝礼のデータと天気は覚えておき、お客様を開く・閉じる時は読み直さない（前は押すたびに hall_chorei と天気を読み直していた）。読み直すのは開いた時と「確認」「確認の取消」の後（天気はそのまま） */
let hcD = null, hcWx = null;
async function hallChorei(keepWx){
  setBack(home); if(!$('hcBox')) show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('hall_chorei', { p_token: TOKEN }); if(r.error){ fail(r.error.message); return; }
  hcD = r.data; if(keepWx !== true) hcWx = null; hcPaint(); /* トップのボタンからは event が来るので true の時だけ */
  if(!hcWx) await hcWeather(hcD);
}
function hcPaint(){
  const C = hcD, G = C.guests || [], left = G.filter(g => g.customer && !g.ok_at).length;
  const tag = '<span style="display:inline-block;background:var(--pri);color:#fff;border-radius:4px;padding:0 5px;font-size:12px;font-weight:700">同伴</span> ';
  const guest = g => { const cu = g.customer, op = hcOpen.has(g.id) && cu;
    const st = !cu ? '<small class="muted">はじめて</small>' : g.ok_at ? `<small class="muted">確認済み ${hm2(g.ok_at)}${g.ok_by?'・'+esc(g.ok_by):''}</small>` : '<small class="err" style="font-weight:700">未確認</small>';
    let h = `<div ${cu?`data-hc="${g.id}"`:''} style="padding:10px 0;border-top:1px solid var(--line);${cu?'cursor:pointer':''}"><div class="row" style="padding:0"><b>${g.time}　${g.douhan?tag:''}${g.vip?tag.replace('同伴',esc(g.vip)):''}${esc(g.name)} 様 ${g.guests}名</b>${st}</div><div class="row" style="padding:0;align-items:center"><span class="muted sm">${g.douhan?'同伴 '+(g.dh&&g.dh.length?g.dh:[g.by]).map(n=>esc(n)+(n===g.black?DRESS:'')).join('・'):STORE==='hiroshima'?'誘客 '+esc(g.by||'—'):`${esc(KL)} ${esc(g.kakari||'—')}${g.by&&g.by!==g.kakari?'・誘客 '+esc(g.by):''}`}</span><select data-hs="${g.id}" style="height:36px;width:auto;border:1px solid var(--line);border-radius:8px;padding:0 4px 0 8px;font:inherit;font-size:15px;background:var(--card);color:var(--ink)"><option value="">卓</option>${(C.tables||[]).map(t=>`<option value="${t.id}"${t.id===g.seat?' selected':''}>${esc(t.name)}</option>`).join('')}</select></div></div>`; /* v0.91：広島は担当を出さない（2026-10-29 オーナー）。v0.98・SQL 298：卓（POS の朝礼と同じ。選ぶとすぐ保存） */
    if(!op) return h;
    const bd = cu.birthday ? `${esc(cu.birthday)}${cu.bday_in===0?'（本日）':cu.bday_in!=null&&cu.bday_in<=7?`（あと${cu.bday_in}日）`:''}` : '—';
    return h + `<div style="padding:0 0 10px"><div class="row"><span class="muted">誕生日</span><span>${bd}</span></div><div class="row"><span class="muted">反応◎</span><span>${esc(cu.good||'—')}</span></div>
      <div class="row"><span class="muted">ボトル</span><span style="text-align:right">${(cu.bottles||[]).map(b=>`${esc(b.name)}（${b.remaining}/10${b.share?'・共同 '+esc(b.share)+' 様':''}）`).join('、')||'—'}</span></div>
      <div class="row"><span class="muted">前回の来店</span><span>${cu.last?`${mdj(cu.last.date)} ${cu.last.guests}名`:'—'}</span></div>
      <div class="row"><span class="muted">タバコ</span><span style="text-align:right;white-space:pre-line">${esc(cu.tobacco||'—')}</span></div><div class="row"><span class="muted">配車</span><span style="text-align:right;white-space:pre-line">${esc(cu.haisha||'—')}</span></div>
      <div style="background:var(--gold-soft);border-radius:8px;padding:8px 10px;margin-top:6px;white-space:pre-wrap;line-height:1.7">${esc(cu.memo||'メモなし')}</div>
      ${g.ok_at?`<button class="btn g" data-hu="${g.id}" style="margin-top:8px">確認の取消</button>`:`<button class="btn" data-hk="${g.id}" style="margin-top:8px">確認</button>`}</div>`; };
  const SH = {}; (C.shifts||[]).forEach(x => { (SH[x.time] = SH[x.time] || []).push(esc(x.name) + (x.black?DRESS:'') + (x.douhan?'（同伴）':'')); }); /* v1.30・SQL 368：黒ドレスのしるし */
  const y = new Date(C.date+'T00:00:00+09:00'); y.setDate(y.getDate()-1);
  show(`<div id="hcBox"><div class="ttl">朝礼　${mdj(C.date)}${C.event?' <small class="muted">イベント日</small>':''}</div>
    <div class="card"><div class="gh">本日来店予定のお客様 ${G.length}組${left?`　<span class="err">未確認 ${left}組</span>`:''}</div>${G.map(guest).join('')||'<div class="muted sm">なし</div>'}${G.length?'<div class="muted sm" style="margin-top:6px">未確認をタップで顧客メモを確認してください。</div>':''}</div>
    <div class="card"><div class="gh">天気</div><div id="hcWx" class="${hcWx ? hcWx.c : 'muted sm'}">${hcWx ? hcWx.h : '読み込み中…'}</div></div>
    <div class="card"><div class="gh">本日の出勤 ${(C.shifts||[]).length}人</div>${Object.keys(SH).sort().map(t => `<div class="row" style="justify-content:flex-start"><b>${t}</b><span>${SH[t].join('・')}</span></div>`).join('')||'<div class="muted sm">シフトなし</div>'}</div>
    <div class="card"><div class="gh">売上</div><div class="row"><span>昨日 ${mdj(y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0'))}</span><b>${yen(C.sales_y)}</b></div>${C.fc?hcFc(C.fc):C.sales_m==null?'':`<div class="row"><span>今月（〜${y.getMonth()+1}/${y.getDate()}）</span><b>${yen(C.sales_m)}</b></div>`}</div>
    <div class="card"><div class="gh">お誕生日（前後1週間）</div>${(C.bdays||[]).map(b => { const cu = (b.kind_label||'お客様') === 'お客様', past = b.in < 0; /* v1.24・SQL 361：前後1週間（キャストのトップと同じ） */ return `<div class="row"${past?' style="color:var(--muted)"':''}><span><b class="${b.in===0?'err':''}">${b.in===0?'本日':past?(-b.in)+'日前':'あと'+b.in+'日'}</b>　${esc(b.name)}${cu?' 様':''}</span><small class="muted">${cu?(b.kakari?esc(KL)+' '+esc(b.kakari):''):esc(b.kind_label)}</small></div>`; }).join('')||'<div class="muted sm">なし</div>'}</div></div>`);
  $('main').querySelectorAll('[data-hc]').forEach(e => e.onclick = () => { const k = e.dataset.hc; hcOpen.has(k) ? hcOpen.delete(k) : hcOpen.add(k); const y0 = window.scrollY; hcPaint(); window.scrollTo(0, y0); }); /* v0.94：読み直さない */
  $('main').querySelectorAll('[data-hs]').forEach(x => { x.onclick = e => e.stopPropagation(); x.onchange = async () => { const id = x.dataset.hs, g = G.find(g => String(g.id) === id), was = g?.seat || ''; x.disabled = true;
    const q = await sb.rpc('hall_resv_seat', { p_token: TOKEN, p_id: id, p_table: x.value || null }); x.disabled = false; if(q.error){ x.value = was; await uiAlert(q.error.message); return; } if(g) g.seat = x.value || null; }; });
  $('main').querySelectorAll('[data-hk],[data-hu]').forEach(b => b.onclick = async () => { const ok = !!b.dataset.hk, id = b.dataset.hk || b.dataset.hu; b.disabled = true;
    const q = await sb.rpc('hall_chorei_ok', { p_token: TOKEN, p_resv: id, p_ok: ok }); if(q.error){ b.disabled = false; await uiAlert(q.error.message); return; } if(ok) hcOpen.delete(id); const y0 = window.scrollY; await hallChorei(true); window.scrollTo(0, y0); });
}
// 天気（20時〜翌1時・降水確率50%以上で傘の準備）。v0.94：できた中身は hcWx に覚えておく
async function hcWeather(C){
  if(C.lat != null) try{ const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${C.lat}&longitude=${C.lon}&hourly=weather_code,precipitation_probability,temperature_2m&timezone=Asia%2FTokyo&forecast_days=3`)).json(), H = j.hourly;
    const nx = (() => { const d = new Date(C.date+'T00:00:00+09:00'); d.setDate(d.getDate()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    const W = [[C.date,20],[C.date,21],[C.date,22],[C.date,23],[nx,0],[nx,1]].map(([d,h]) => { const i = H.time.indexOf(`${d}T${String(h).padStart(2,'0')}:00`); return { h: h===0?24:h, c: H.weather_code[i], p: H.precipitation_probability[i], t: H.temperature_2m[i] }; });
    const rain = W.find(x => (x.p??0) >= 50);
    hcWx = { c: '', h: `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;text-align:center;font-size:12px">${W.map(x => `<div style="border:1px solid var(--line);border-radius:6px;padding:4px 0;line-height:1.4;${(x.p??0)>=50?'background:var(--warn-soft)':''}"><div class="muted">${x.h}時</div>${WXI(x.c,34)}<div style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${WXN(x.c)}</div><div class="${(x.p??0)>=50?'err':''}">${x.p??'—'}%</div><div class="muted">${x.t==null?'—':Math.round(x.t)+'℃'}</div></div>`).join('')}</div>${rain?`<div class="err" style="font-weight:700;background:var(--warn-soft);border-radius:6px;padding:6px 8px;margin-top:6px">傘の準備（${rain.h}時から雨）</div>`:''}` };
  }catch(e){ hcWx = { c: 'muted sm', h: '天気を読み込めません' }; }
  const el = $('hcWx'); if(el && hcWx){ el.className = hcWx.c; el.innerHTML = hcWx.h; }
}
