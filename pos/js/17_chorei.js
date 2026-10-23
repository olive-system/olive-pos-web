// ---------- 朝礼 v11.58・SQL 129（オーナー 2026-10-16「本日来店予定のお客様のメモは必ず確認。パーソナライズされたサービスが OLIVE の命。お客様に何度も言わせない」）
// 朝礼は黒服だけ。お客様を押すとメモが開き、読んだら「確認」。天気は Open-Meteo（20時〜翌1時。降水確率50%以上で傘の準備）
let chOpen=new Set();
/* v11.73：天気はアイコン（Meteocons・MIT）＋小さい言葉（オーナー 2026-10-18「“晴”はパッとみでわからん」「絵文字やめて、ちゃんと探して」→ ア）。20時〜翌1時なので夜のアイコン */
const WXT=c=>c==null?['—',null]:c<=1?['晴れ','clear-night']:c===2?['晴れ時々くもり','partly-cloudy-night']:c===3?['くもり','overcast-night']:c<=48?['霧','fog-night']:c<=57?['霧雨','drizzle']:c<=67?['雨','rain']:c<=77?['雪','snow']:c<=82?['にわか雨','partly-cloudy-night-rain']:c<=86?['にわか雪','partly-cloudy-night-snow']:['雷雨','thunderstorms-night-rain'];
const WX=c=>WXT(c)[0], WXI=(c,px)=>{ const [t,n]=WXT(c); return n?`<img src="https://cdn.jsdelivr.net/npm/@bybas/weather-icons@2.0.0/production/fill/all/${n}.svg" alt="${t}" style="width:${px}px;height:${px}px;display:block;margin:0 auto">`:'—'; };
async function chWeather(C){ if(C.lat==null||C.lon==null) return '<div class="muted">店の場所が未設定です</div>';
  try{ const u=`https://api.open-meteo.com/v1/forecast?latitude=${C.lat}&longitude=${C.lon}&hourly=weather_code,precipitation_probability,temperature_2m&timezone=Asia%2FTokyo&forecast_days=3`;
    const j=await (await fetch(u)).json(); const H=j.hourly; const nx=(()=>{ const d=new Date(C.date+'T00:00:00+09:00'); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
    const want=[[C.date,20],[C.date,21],[C.date,22],[C.date,23],[nx,0],[nx,1]].map(([d,h])=>{ const k=`${d}T${String(h).padStart(2,'0')}:00`, i=H.time.indexOf(k); return {h:h===0?24:h, c:H.weather_code[i], p:H.precipitation_probability[i], t:H.temperature_2m[i]}; });
    const rain=want.find(x=>(x.p??0)>=50);
    return `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;text-align:center">${want.map(x=>`<div style="border:1px solid var(--line);border-radius:8px;padding:6px 0;line-height:1.4;${(x.p??0)>=50?'background:var(--warn-soft)':''}"><div class="muted" style="font-size:13px">${x.h===25?'1':x.h}時</div>${WXI(x.c,44)}<div style="font-size:12px;white-space:nowrap">${WX(x.c)}</div><div style="font-size:14px;${(x.p??0)>=50?'color:var(--warn);font-weight:700':''}">${x.p??'—'}%</div><div class="muted" style="font-size:13px">${x.t==null?'—':Math.round(x.t)+'℃'}</div></div>`).join('')}</div>
      ${rain?`<div style="background:var(--warn-soft);color:var(--warn);font-weight:700;border-radius:8px;padding:8px 10px;margin-top:8px">傘の準備（${rain.h}時から${/雪/.test(WX(rain.c))?'雪':'雨'}）</div>`:''}`;
  }catch(e){ return '<div class="muted">天気を読み込めません</div>'; } }
async function renderChorei(){ const box=$('setList'); box.innerHTML='<div class="muted">読み込み中…</div>';
  if(!staffAll?.length) await loadStaffAll(); const [cr,ar,sr]=await Promise.all([sb.rpc('pos_chorei'), sb.rpc('pos_absences',{p_date:businessDate()}), sb.rpc('pos_sales_today')]);
  if(setCur!=='chorei') return;
  if(cr.error){ box.innerHTML=`<div class="err">${/pos_chorei/.test(cr.error.message)?'SQL 129 が未実行です：':'読み込めません：'}${esc(cr.error.message)}</div>`; return; }
  const C=cr.data, G=C.guests||[], d=new Date(C.date+'T00:00:00+09:00'), WD='日月火水木金土', md=x=>{ const t=new Date(x+'T00:00:00+09:00'); return `${t.getMonth()+1}/${t.getDate()}（${WD[t.getDay()]}）`; };
  const card=(t,inner,extra='')=>`<div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--card)"><div style="font-size:15px;color:var(--muted);font-weight:700;margin-bottom:8px">${t}${extra}</div>${inner}</div>`;
  const row=(a,b,st='')=>`<div style="display:flex;gap:10px;padding:5px 0;border-top:1px solid var(--line);${st}">${a}${b}</div>`;
  const tag='<span style="display:inline-block;background:var(--pri);color:#fff;border-radius:4px;padding:1px 6px;font-size:14px;font-weight:700;line-height:1.4;vertical-align:2px">同伴</span> ';
  const left=G.filter(g=>g.customer&&!g.ok_at).length;
  const guest=g=>{ const cu=g.customer, op=chOpen.has(g.id)&&cu;
    const st=!cu?'<span class="muted" style="font-size:14px">顧客未登録（はじめて）</span>':g.ok_at?`<span class="muted" style="font-size:14px">確認済み ${new Date(g.ok_at).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false})}${g.ok_by&&g.ok_by!=='POS'?'・'+esc(g.ok_by):''}</span>`:'<span style="color:var(--warn);font-weight:700;font-size:14px">未確認</span>';
    const head=`<div ${cu?`data-cho="${g.id}"`:''} style="display:flex;align-items:center;gap:10px;${cu?'cursor:pointer':''}"><b style="font-size:18px;min-width:56px">${g.time}</b><div style="flex:1;font-size:18px;font-weight:700">${g.douhan?tag:''}${esc(g.name)} 様 ${g.guests}名 <small class="muted" style="font-weight:400">${g.douhan?'同伴 '+esc(g.by):'係 '+esc(g.kakari||'—')+(g.by&&g.by!==g.kakari?'・誘客 '+esc(g.by):'')}</small></div>${st}${cu?`<span class="muted" style="font-size:20px">${op?'▲':'▼'}</span>`:''}</div>`;
    if(!op) return `<div style="border-top:1px solid var(--line);padding:12px 0">${head}</div>`;
    const bd=cu.birthday?`${esc(cu.birthday)}${cu.bday_in===0?'（本日お誕生日）':cu.bday_in!=null&&cu.bday_in<=7?`（あと${cu.bday_in}日）`:''}`:'—';
    const bt=(cu.bottles||[]).map(b=>`${esc(b.name)}（残り ${b.remaining}/10）`).join('、')||'—';
    const ls=cu.last?`${md(cu.last.date)} ${cu.last.guests}名${cu.last.casts?'・'+esc(cu.last.casts):''}`:'—';
    return `<div style="border-top:1px solid var(--line);padding:12px 0">${head}<div style="margin-left:66px">
      <div style="display:grid;grid-template-columns:80px 1fr 90px 1fr;gap:2px 10px;font-size:14px;margin-top:6px"><span class="muted">誕生日</span><span ${cu.bday_in!=null&&cu.bday_in<=7?'style="color:var(--warn);font-weight:700"':''}>${bd}</span><span class="muted">反応◎</span><span>${esc(cu.good||'—')}</span><span class="muted">ボトル</span><span>${bt}</span><span class="muted">前回の来店</span><span>${ls}</span></div>
      <div style="background:var(--gold-soft);border-radius:8px;padding:8px 10px;margin-top:6px;font-size:15px;line-height:1.7;white-space:pre-wrap"><span class="muted" style="font-size:13px">メモ</span>\n${esc(cu.memo||'なし')}</div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">${g.ok_at?`<button class="sm" data-chu="${g.id}">確認の取消</button>`:`<button class="primary" data-chk="${g.id}" style="padding:0 48px;height:52px;font-size:17px">確認</button>`}</div></div></div>`; };
  const SH={}; (C.shifts||[]).forEach(x=>{ (SH[x.time]=SH[x.time]||[]).push(esc(x.name)+(x.douhan?'（同伴）':'')); });
  const abs=(ar.error?[]:ar.data||[]), hm=t=>new Date(t).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false});
  const sl=(sr.error?[]:sr.data.rows||[]).filter(x=>x.worked&&x.count==null).map(x=>esc(staffAll.find(z=>z.id===x.staff_id)?.display_name||'')).filter(Boolean);
  const todo=[sl.length?row('<span style="min-width:110px">アプローチ</span>',`<span>${sl.join('・')} <small class="muted">（未連絡）</small></span>`):'',
    ...(C.docs||[]).length?[row('<span style="min-width:110px">書類未提出</span>',`<span>${C.docs.map(x=>`<div><b style="font-weight:400;white-space:nowrap">${esc(x.name)}</b> <small class="muted">${esc(x.miss)}</small></div>`).join('')}</span>` /* v11.79：1人1行。名前を途中で割らない */)]:[],
    (C.dress||[]).length?row('<span style="min-width:110px">ドレス新調日</span>',`<span>${C.dress.map(x=>esc(x.name)).join('・')} <small class="muted">${md(C.dress[0].due).replace(/（.）/,'')} まで・未提出</small></span>`):''].join('');
  const y=new Date(d); y.setDate(y.getDate()-1);
  box.innerHTML=`<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px"><b style="font-size:22px">${md(C.date)}</b>${C.event?'<span style="background:var(--gold-soft);border:1px solid var(--line);border-radius:4px;padding:1px 8px;font-size:14px">イベント日</span>':''}${C.off?'<span style="background:var(--soft);border:1px solid var(--line);border-radius:4px;padding:1px 8px;font-size:14px">休</span>':''}</div>
    ${card(`本日来店予定のお客様 ${G.length}組`,G.length?G.map(guest).join('')+'<div class="muted" style="font-size:13px;margin-top:6px">お客様を押すとメモが開きます。読んだら「確認」</div>':'<div class="muted">なし</div>',left?`　<span style="color:var(--warn)">未確認 ${left}組</span>`:'')}
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:14px;align-items:start">
      <div style="display:flex;flex-direction:column;gap:14px">${card(`天気（${esc(C.place||'')}）`,'<div id="chWx" class="muted">読み込み中…</div>')}
        ${card(`本日の出勤 ${(C.shifts||[]).length}人`,(Object.keys(SH).sort().map(t=>row(`<b style="min-width:52px">${t}</b>`,`<span>${SH[t].join('・')}</span>`)).join('')||'<div class="muted">シフトなし</div>')+abs.map(a=>row('<b style="min-width:52px;color:var(--warn)">欠勤</b>',`<span style="color:var(--warn);font-weight:700">${esc(staffAll.find(z=>z.id===a.staff_id)?.display_name||'')}（${hm(a.at)}・${esc(a.reason)}）</span>`)).join(''))}</div>
      <div style="display:flex;flex-direction:column;gap:14px">${card('売上',row(`<span style="flex:1">昨日 ${y.getMonth()+1}/${y.getDate()}（${WD[y.getDay()]}）</span>`,`<b>${yen(C.sales_y||0)}</b>`)+(C.sales_m==null?'':row(`<span style="flex:1">今月（${d.getMonth()+1}/1〜${y.getMonth()+1}/${y.getDate()}）</span>`,`<b>${yen(C.sales_m)}</b>`)))}
        ${card('2週間以内のお誕生日',(C.bdays||[]).map(b=>row(`<b style="min-width:64px;${b.in===0?'color:var(--warn)':''}">${b.in===0?'本日':'あと'+b.in+'日'}</b>`,`<span style="flex:1">${esc(b.name)}${(b.kind_label||'お客様')==='お客様'?' 様':''} <small class="muted">${esc(b.birthday)}</small></span><span class="muted">${(b.kind_label||'お客様')==='お客様'?(b.kakari?'係 '+esc(b.kakari):''):esc(b.kind_label)}</span>`)).join('')||'<div class="muted">なし</div>')}
        ${card('キャストのやること',todo||'<div class="muted">なし</div>')}</div></div>`;
  box.querySelectorAll('[data-cho]').forEach(h=>h.onclick=()=>{ const k=h.dataset.cho; chOpen.has(k)?chOpen.delete(k):chOpen.add(k); renderChorei(); });
  box.querySelectorAll('[data-chk],[data-chu]').forEach(b=>b.onclick=async e=>{ e.stopPropagation(); const ok=!!b.dataset.chk, id=b.dataset.chk||b.dataset.chu; b.disabled=true;
    const q=await sb.rpc('pos_chorei_ok',{p_resv:id,p_ok:ok}); if(q.error){ b.disabled=false; await uiAlert(q.error.message); return; } if(ok) chOpen.delete(id); renderChorei(); });
  const wx=await chWeather(C); if($('chWx')) $('chWx').outerHTML=`<div>${wx}</div>`;
}
// v12.06・SQL 209：マイページの閉店作業（完了・作業中）。黒服マイページで開始・保存する
function clMpHtml(L,H){ const hm=t=>{ const x=new Date(t); return `${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`; }, n=L.filter(x=>x.status==='done').length;
  return `${H(`② マイページの閉店作業　<small class="muted" style="font-weight:400">完了 ${n}／${L.length}</small>`)}<div id="clMp" class="list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));column-gap:18px">${L.map(x=>`<div class="item"><span class="n">${esc(x.name)}</span>${x.status==='done'?`<b style="color:var(--ok);white-space:nowrap">完了 ${x.kind==='todo'?'':`${esc(x.by||'')} ${x.at?hm(x.at):''}`}</b>`:x.kind==='todo'?`<b style="color:var(--warn)">未完了 ${x.todo_open}</b>`:x.wip_by?`<b style="background:var(--gold-soft);border-radius:6px;padding:2px 7px;white-space:nowrap">作業中 ${esc(x.wip_by)}</b>`:'<b style="color:var(--warn)">未完了</b>'}</div>`).join('')||'<div class="muted">項目がありません</div>'}</div>
  <div class="muted" style="font-size:13px;margin-top:6px">黒服マイページの「閉店作業」で開始・保存します。全部完了で精算できます</div>`; }
async function renderClosing(){ const today=businessDate(); if(!clDate){ clDate=today; } if(!clMonth) clMonth=clDate.slice(0,7); const d=clDate; const box=$('setList'); box.innerHTML='<div class="muted">読み込み中…</div>'; const [from,to]=clRange(d);
  const [mv,adv,pay,cls,prev,bc,rq,od,lat,ctk]=await Promise.all([
    sb.from('cash_movements').select('*').eq('store_id',store.id).eq('business_date',d).order('created_at'),
    sb.from('daily_advances').select('staff_id,amount').eq('store_id',store.id).eq('business_date',d),
    sb.from('payments').select('amount,bills!inner(status,store_id)').eq('method','cash').gte('paid_at',from).lt('paid_at',to),
    sb.from('register_closings').select('*').eq('store_id',store.id).eq('business_date',d).maybeSingle(),
    sb.from('register_closings').select('business_date,next_float').eq('store_id',store.id).lt('business_date',d).order('business_date',{ascending:false}).limit(1),
    sb.from('bill_customers').select('customer_id,bills!inner(business_date,status,store_id)').eq('bills.business_date',d),
    sb.from('customer_note_requests').select('*').eq('store_id',store.id).eq('status','pending').order('created_at'),
    sb.from('bill_items').select('product_id,name,qty,category_id,bills!inner(business_date,status,store_id)').eq('bills.business_date',d).eq('bills.store_id',store.id).neq('bills.status','void').eq('is_void',false),
    sb.from('register_closings').select('business_date').eq('store_id',store.id).gt('business_date',d).limit(1),
    sb.rpc('pos_close_tasks',{p_day:d}) ]);
  /* v12.06・SQL 209：閉店作業をマイページでする店は、②〜⑦・⑨をマイページへ。ここは完了・作業中の一覧（全部完了でないと精算できない。オーナー 2026-10-23） */
  const mp=!ctk.error&&ctk.data?.on, mpL=mp?(ctk.data.items||[]):[];
  if(setCur!=='closing') return;
  if(mv.error||cls.error){ box.innerHTML=`<div class="muted">SQL 018 が未適用の可能性があります：${esc((mv.error||cls.error).message)}</div>`; return; }
  { const e=[adv,pay,prev,lat,ctk].find(x=>x.error); if(e){ box.innerHTML=`<div class="muted">閉店作業を読み込めません。再度開いてください：${esc(e.error.message)}</div>`; return; } } /* 通しチェック3：日払い・現金売上が読めないと0円のまま精算できた */
  const moves=mv.data||[]; const outSum=moves.filter(m=>m.kind==='out').reduce((a,m)=>a+m.amount,0), inSum=moves.filter(m=>m.kind==='in').reduce((a,m)=>a+m.amount,0);
  const advRows=(adv.data||[]).filter(a=>a.amount>0); const advSum=advRows.reduce((a,x)=>a+x.amount,0);
  const cashSales=(pay.data||[]).filter(p=>p.bills&&p.bills.store_id===store.id&&p.bills.status!=='void').reduce((a,p)=>a+(p.amount||0),0);
  const saved=cls.data||null; const prevRow=(prev.data||[])[0]||null; const hasPrev=!!prevRow;
  // v10.43：前回の精算から今日までに未精算の日があれば、その日の現金の動きも本日釣銭に含める（未精算の日のお金はレジに残っているため）。後の日の精算がある日・未来の日は保存できない
  const gp=(!saved&&prevRow)?await clGap(prevRow.business_date,d):{net:0,days:[]}; if(setCur!=='closing'||clDate!==d) return; if(gp.error){ box.innerHTML=`<div class="muted">閉店作業を読み込めません。再度開いてください：${esc(gp.error.message)}</div>`; return; } const later=(lat.data||[]).length>0, future=d>today;
  clCtx={d,outSum,inSum,advSum,cashSales,saved,hasPrev,prevFloat:prevRow?prevRow.next_float+gp.net:0}; const clIdle=!saved&&d<today&&!outSum&&!inSum&&!advSum&&!cashSales; // v10.43：休みなどで動きがない過去の日は「精算済（変動なし自動繰越）」
  const custIds=[...new Set((bc.data||[]).filter(x=>x.bills&&x.bills.store_id===store.id&&x.bills.status!=='void').map(x=>x.customer_id))];
  let bottles=[]; if(custIds.length){ const bt=await sb.from('customer_bottles').select('*').in('customer_id',custIds).eq('is_finished',false); bottles=(bt.data||[]).filter(b=>!b.expired_on); }
  if(setCur!=='closing') return;
  const nm=id=>staffAll.find(x=>x.id===id)?.display_name||staff.find(x=>x.id===id)?.display_name||''; const cn=id=>customers.find(c=>c.id===id)?.name||'';
  const H=t=>`<h2 style="margin:18px 0 8px">${t}</h2>`;
  const cnt=saved?(saved.counts||{}):clCounts;
  const clOldMid=mp?'':`  ${H('② ボトル残量（今日ご来店のお客様のキープボトル）')}
  <div class="list">${bottles.map(b=>`<div class="item"><span class="n">${esc(b.name)}<br><small>${esc(cn(b.customer_id))} 様${esc(knLabel(b,cn(b.customer_id)))}</small></span><select data-clrem="${b.id}">${[10,9,8,7,6,5,4,3,2,1,0].map(n=>`<option value="${n}" ${b.remaining===n?'selected':''}>${n}/10</option>`).join('')}</select></div>`).join('')||'<div class="muted">該当なし（伝票に「＋お客様」で登録された方のボトルが出ます）</div>'}</div>
  ${H('③ 顧客メモの更新申請')}
  ${rq.error?`<div class="muted">${esc(rq.error.message)}</div>`:`<div class="list">${(rq.data||[]).map(r=>`<div class="item" style="flex-wrap:wrap;gap:6px"><span class="n" style="flex:1 1 100%">${esc(cn(r.customer_id))} 様　<small>${esc(reqMd(r.business_date))}　${esc(nm(r.author_staff_id))}</small><br><span style="white-space:pre-wrap">${esc(r.body)}</span></span><button class="ok sm" data-clrqok="${r.id}">メモに追記</button><button class="ghost sm" data-clrqno="${r.id}">却下</button></div>`).join('')||'<div class="muted">申請なし</div>'}</div>`}
  ${H('④ '+KL+'・同伴・反応◎の確認')}
  <div id="clChk"><div class="muted">読み込み中…</div></div>
  <div id="clKmBox"></div>
  ${H('⑥ 今日出たお酒・ドリンク（発注用）')}
  ${clOrderHtml(od)}
  ${H('⑦ TODO')}<div id="clTodo" style="flex-shrink:0;margin-bottom:12px"><div class="muted">読み込み中…</div></div>`;
  box.innerHTML=`<div id="clWarn"></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:18px">閉店作業</b><input type="date" id="clDateIn" value="${d}"><span class="badge ${saved||clIdle?'k':'warnb'}">${saved?'精算済':clIdle?'（変動なし自動繰越）':'未精算'}</span></div>
  <div id="clRe"></div>
  ${H('① 入出金の登録（経費の現金払い・立替など）')}
  ${saved?'<div class="muted" style="margin-bottom:6px">精算済のため変更できません</div>':`<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><select id="clKind"><option value="out">出金</option><option value="in">入金</option></select><input id="clAmt" type="number" inputmode="numeric" placeholder="金額" style="width:130px;text-align:right"><select id="clMemoSel"></select><input id="clMemo" placeholder="内容を入力" style="flex:1;min-width:160px;display:none"><button class="ok sm" id="clAdd">追加</button></div>`}
  <div class="list">${moves.map(m=>`<div class="item"><span class="badge ${m.kind==='out'?'gray':''}">${m.kind==='out'?'出金':'入金'}</span><span class="n">${esc(m.memo||'')}</span><span class="amt">${yen(m.amount)}</span>${saved?'':`<button class="ghost sm" data-mvdel="${m.id}">削除</button>`}</div>`).join('')||'<div class="muted">登録なし</div>'}
  <div class="item"><span class="badge gray">出金</span><span class="n">日払（立替）合計 <small>${advRows.length?esc(advRows.map(a=>nm(a.staff_id)+' '+a.amount.toLocaleString()).join('、')):'なし'}（在籍リストで入力）</small></span><span class="amt">${yen(advSum)}</span></div></div>
  <div class="bar" style="margin-top:10px"><button class="ghost" id="clMail">${FX('envelope')} 領収書をメールで送る</button></div>
  ${mp?clMpHtml(mpL,H):clOldMid}
  ${H(mp?'③ レジ金合わせ':'⑧ レジ金合わせ')}
  <div id="clCard" style="margin-bottom:12px"></div>
  <div style="display:grid;grid-template-columns:minmax(260px,1fr) minmax(280px,1fr);gap:18px;align-items:start">
    <div><div style="display:grid;grid-template-columns:1fr 90px 1fr;gap:6px;align-items:center"><b>金種</b><b style="text-align:center">枚数</b><b style="text-align:right">金額</b>${DENOMS.map(([v,n])=>`<span>${n}</span><input type="number" inputmode="numeric" min="0" data-den="${v}" value="${cnt[v]??''}" ${saved?'disabled':''} style="text-align:right"><span class="right" data-denamt="${v}"></span>`).join('')}<b>合計金額</b><span></span><b class="right" id="clCounted"></b></div></div>
    <div class="totals" style="display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center">
      <span>本日釣銭${gp.days.length?`<br><small class="muted">${gp.days.map(x=>`${+x.slice(5,7)}/${+x.slice(8,10)}`).join('・')} の未精算分 ${gp.net>=0?'+':''}${yen(gp.net)} を含む</small>`:''}</span>${saved||hasPrev?`<span class="right" id="clOpenTxt"></span>`:`<input id="clOpenIn" type="number" inputmode="numeric" value="${clOpening||''}" placeholder="初回のみ入力" style="width:150px;text-align:right">`}
      <span>現金売上 <small class="muted">その日に受け取った現金</small></span><span class="right"><span id="clSales"></span> <small class="muted" id="clSalesWas"></small></span>
      <span>入金合計</span><span class="right" id="clIn"></span>
      <span>出金合計 <small class="muted">日払（立替）を含む</small></span><span class="right" id="clOut"></span>
      <span>レジ内現金（理論値）</span><span class="right" id="clExp"></span>
      <span>レジ内現金</span><span class="right" id="clCnt2"></span>
      <b>現金過不足</b><b class="right" id="clDiff"></b>
      <span>預金金額</span>${saved?`<span class="right" id="clDepTxt"></span>`:`<input id="clDepIn" type="number" inputmode="numeric" value="${clDeposit||''}" style="width:150px;text-align:right">`}
      <span>翌日釣銭準備金</span><span class="right" id="clNext"></span>
    </div></div>
  <div class="bar" style="margin-top:12px">${saved||future?'':later?'<span class="muted">後の日の精算があるため保存できません</span>':`<button class="primary" id="clSave">精算を保存</button>`}</div>
  ${mp?'':`  ${H('⑨ その日のメモ')}<div class="muted" style="font-size:14px;margin-bottom:6px">管理サイトの収支の Excel（日次の「メモ」）に入ります。精算の後でも修正できます</div>
  <textarea id="clDayMemo" rows="3" maxlength="1000" style="width:100%;min-height:96px;flex-shrink:0;box-sizing:border-box;font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px"></textarea>
  <div class="muted" id="clDayMemoSt" style="font-size:13px;margin-top:4px;min-height:1.4em"></div>`}
  ${H('月間一覧')}<div style="margin-bottom:8px"><input type="month" id="clMonthIn" value="${clMonth}"></div><div id="clMonthBox" style="overflow-x:auto;flex-shrink:0"></div>`;
  $('clDateIn').onchange=e=>{ if(e.target.value){ clDate=e.target.value; clCounts={}; clDeposit=0; renderClosing(); } };
  $('clMonthIn').onchange=e=>{ if(e.target.value){ clMonth=e.target.value; clRenderMonth(); } };
  box.querySelectorAll('[data-den]').forEach(i=>i.oninput=()=>{ clCounts[i.dataset.den]=clNum(i.value); clRecalc(); });
  if($('clDepIn')) $('clDepIn').oninput=e=>{ clDeposit=clNum(e.target.value); clRecalc(); };
  if($('clOpenIn')) $('clOpenIn').oninput=e=>{ clOpening=clNum(e.target.value); clRecalc(); };
  $('clMail').onclick=async()=>{ const hs=staff.filter(x=>x.kind==='hall'); const list=(hs.length?hs:staff).map(x=>({label:x.display_name,value:x.display_name})); const who=await uiPick('閉店作業の担当者を選んでください',list); if(!who) return; location.href=clMailUrl(who); };
  // v11.24・SQL 077：入金・出金の項目は管理サイトの POS設定 で決める（「その他」は自由に書ける）
  if($('clKind')){ const items=k=>{ const v=settings?.['cash_'+k+'_items']; return Array.isArray(v)?v:(k==='out'?['領収書精算','支払い']:[]); };
    const fill=()=>{ const k=$('clKind').value; $('clMemoSel').innerHTML=items(k).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')+'<option value="__other">その他</option>'; };
    const mv=()=>{ const out=$('clKind').value==='out'; $('clMemo').style.display=$('clMemoSel').value==='__other'?'':'none'; $('clMemo').placeholder=out?'内容を入力':'内容（例：両替、釣銭補充）'; }; fill(); $('clKind').onchange=()=>{ fill(); mv(); }; $('clMemoSel').onchange=()=>{ mv(); if($('clMemoSel').value==='__other') $('clMemo').focus(); }; mv(); }
  if($('clAdd')) $('clAdd').onclick=async()=>{ const amount=clNum($('clAmt').value), kind=$('clKind').value, memo=$('clMemoSel').value!=='__other'?$('clMemoSel').value:$('clMemo').value.trim(); if(!amount){ toast('金額を入力してください'); return; } if(!memo){ toast('内容を入力してください'); return; } if(await askBy()===null) return; $('clAdd').disabled=true; const r=await sb.from('cash_movements').insert({store_id:store.id,business_date:d,kind,amount,memo}); if(r.error){ toast(r.error.message); $('clAdd').disabled=false; return; } await logOp(kind==='out'?'レジ出金の登録':'レジ入金の登録',{date:d,amount,memo},null,true); renderClosing(); };
  box.querySelectorAll('[data-mvdel]').forEach(x=>x.onclick=async()=>{ const m=moves.find(z=>z.id===x.dataset.mvdel); if(!m||!await uiConfirm(`${m.kind==='out'?'出金':'入金'} ${yen(m.amount)}（${m.memo}）を削除しますか？`))return; const r=await sb.from('cash_movements').delete().eq('id',m.id); if(r.error){ toast(r.error.message); return; } if(!DBLOG) await logOp('レジ入出金の削除',{date:d,kind:m.kind,amount:m.amount,memo:m.memo},null,true); renderClosing(); });
  box.querySelectorAll('[data-clrem]').forEach(x=>x.onchange=async()=>{ const b=bottles.find(z=>z.id===x.dataset.clrem); const v=Number(x.value); const r=await sb.from('customer_bottles').update({remaining:v,updated_at:new Date().toISOString()}).eq('id',b.id); if(r.error){ toast(r.error.message); return; } await logOp('ボトル残量変更',{customer:cn(b.customer_id),bottle:b.name,before:b.remaining,after:v},null,true); b.remaining=v; toast('残量を保存しました'); });
  clChkRender(d); // v10.61
  clKmRender(d); // v11.59
  clTodoRender(d); // v11.71・SQL 145
  clCardRender(d,false); // v11.60
  // v11.22・SQL 073：その日のメモ（店・営業日ごとに1つ。管理サイトの収支の Excel の日次「メモ」に入る）
  sb.from('daily_memos').select('memo').eq('store_id',store.id).eq('business_date',d).maybeSingle().then(r=>{ if(setCur!=='closing'||clDate!==d||!$('clDayMemo')) return; if(r.error){ $('clDayMemo').placeholder=/daily_memos/.test(r.error.message)?'SQL 073 が未実行です':r.error.message; return; } $('clDayMemo').value=r.data?.memo||''; });
  // v11.72：その日のメモは打つと自動で保存（オーナー 2026-10-18「メモを保存っていらないように」）
  if($('clDayMemo')){ let tm=null, last=null; const memoSave=async()=>{ clearTimeout(tm); const el=$('clDayMemo'); if(!el) return; const v=el.value.trim(); if(v===last) return; const st=$('clDayMemoSt'); if(st) st.textContent='保存中…';
      const r=await sb.from('daily_memos').upsert({store_id:store.id,business_date:d,memo:v,updated_at:new Date().toISOString()},{onConflict:'store_id,business_date'});
      if(r.error){ if(st) st.textContent=''; toast((/daily_memos/.test(r.error.message)?'SQL 073 が未実行です：':'')+r.error.message); return; } last=v; if($('clDayMemoSt')) $('clDayMemoSt').textContent='保存しました'; };
    $('clDayMemo').addEventListener('input',()=>{ clearTimeout(tm); const st=$('clDayMemoSt'); if(st) st.textContent=''; tm=setTimeout(memoSave,1200); }); $('clDayMemo').addEventListener('blur',memoSave); /* 別の所を押すと、その前に保存 */ }
  box.querySelectorAll('[data-clrqok]').forEach(x=>x.onclick=async()=>{ const q=(rq.data||[]).find(z=>z.id===x.dataset.clrqok); x.disabled=true; if(await reqResolve(q,'applied')) toast('メモに追記しました'); renderClosing(); });
  box.querySelectorAll('[data-clrqno]').forEach(x=>x.onclick=async()=>{ const q=(rq.data||[]).find(z=>z.id===x.dataset.clrqno); if(!await uiConfirm('この申請を却下しますか？')) return; if(await reqResolve(q,'rejected')) toast('却下しました'); renderClosing(); });
  if($('clSave')) $('clSave').onclick=async()=>{ const v=clRecalc(); /* v12.06・SQL 209：マイページの閉店作業が全部完了でないと精算できない */ if(mp){ const q=await sb.rpc('pos_close_tasks',{p_day:d}); const L=q.error?[]:(q.data.items||[]).filter(x=>x.status!=='done'); if(q.error){ await uiAlert(q.error.message); return; } if(L.length){ await uiAlert(`マイページの閉店作業が完了していません（${L.map(x=>x.name).join('・')}）`); $('clMp')?.scrollIntoView({block:'center'}); return; } } else /* v11.96：④ の確認をしていないと精算を保存できない（オーナー 2026-10-19。ゲネプロ #62） */ { const ck=await sb.from('pos_audit_log').select('id').eq('store_id',store.id).eq('action',CL_CHK).eq('detail->>business_date',d).limit(1); if(!ck.error&&!(ck.data||[]).length){ await uiAlert(`④ ${KL}・同伴・反応◎の確認がまだです\n伝票一覧で確かめて、確認者を記録してください`); $('clChk')?.scrollIntoView({block:'center'}); return; } } { const tq=await sb.rpc('pos_todos',{p_day:d}); const n=tq.error?0:(tq.data||[]).filter(x=>x.status==='open').length; if(n){ await uiAlert(`終わっていない TODO が ${n}つあります（⑦ TODO）\n黒服マイページで済ませるか、できない理由を入れてください`); $('clTodo')?.scrollIntoView({block:'center'}); return; } } /* v12.00：会計していない伝票があると精算できない（締め忘れると、その伝票の分が抜けたまま精算され、自動の延長も足され続ける。オーナー 2026-10-20） */ { const ob=await sb.from('bills').select('table_id').eq('store_id',store.id).eq('status','open').lte('business_date',d); const L=ob.error?[]:(ob.data||[]); if(L.length){ const nm=L.map(b=>tables.find(t=>t.id===b.table_id)?.name||'卓なし').join('・'); await uiAlert(`まだ会計していない伝票が ${L.length}枚あります（${nm}）\nホールで会計してから精算してください`); return; } } /* v11.94・SQL 164：数えた人を選ぶ（日報メールに出る。オーナー 2026-10-19） */ const hs=staff.filter(x=>x.kind==='hall'); const cb=hs.length?await uiPick('レジのお金を数えた人',hs.map(h=>({label:h.display_name,value:h.display_name}))):''; if(hs.length&&!cb) return; /* v11.95：過不足がある時は理由を必ず聞き、その日のメモに足す（日報メールに出る。ゲネプロ #62） */ let dw=''; if(v.diff){ const w=await uiPrompt(`レジの過不足 ${v.diff>0?'+':''}${yen(v.diff)}\n理由を入力してください（必須・その日のメモに入ります）`,''); if(w===null) return; if(!w.trim()){ toast('理由を入力してください'); return; } dw=w.trim(); } if(!await uiConfirm(`${d} のレジ精算を保存しますか？\nレジ内現金 ${yen(v.counted)}／過不足 ${v.diff>0?'+':''}${yen(v.diff)}${cb?`\n数えた人 ${cb}`:''}`))return; $('clSave').disabled=true; const r=await sb.from('register_closings').insert({store_id:store.id,business_date:d,counts:clCounts,opening_float:v.opening,cash_sales:cashSales,cash_in:inSum,cash_out:outSum+advSum,expected:v.expected,counted:v.counted,diff:v.diff,deposit:v.deposit,next_float:v.next,...(cb?{counted_by:cb}:{})}); if(r.error){ toast(/counted_by/.test(r.error.message)?'SQL 164 が未実行です':r.error.message); $('clSave').disabled=false; return; } await logOp('レジ精算を保存',{date:d,expected:v.expected,counted:v.counted,diff:v.diff,deposit:v.deposit,next_float:v.next,...(cb?{by:cb}:{})},dw||null,true); if(dw){ const mm=await sb.from('daily_memos').select('memo').eq('store_id',store.id).eq('business_date',d).maybeSingle(); const line=`レジ過不足 ${v.diff>0?'+':''}${yen(v.diff)}：${dw}${cb?`（${cb}）`:''}`; await sb.from('daily_memos').upsert({store_id:store.id,business_date:d,memo:[(mm.data?.memo||'').trim(),line].filter(Boolean).join('\n'),updated_at:new Date().toISOString()},{onConflict:'store_id,business_date'}); } toast('精算を保存しました'); clCounts={}; clDeposit=0; renderClosing(); };
  clRecalc(); clRenderMonth(); clRenderWarn(d,prevRow?prevRow.business_date:null);
  /* v12.07・SQL 220：精算の取消の後は、レジ金合わせを再度（取消の時刻・理由・取消前の現金売上） */ if(!saved) sb.from('pos_audit_log').select('created_at,reason,detail').eq('store_id',store.id).eq('action','レジ精算の取消').eq('detail->>date',d).order('created_at',{ascending:false}).limit(1).then(q=>{ const x=(q.data||[])[0]; if(!x||setCur!=='closing'||clDate!==d||!$('clRe')) return; const t=new Date(x.created_at);
    $('clRe').innerHTML=`<div style="background:var(--warn-soft);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.6"><b style="color:var(--warn)">精算の取消　${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}</b>　${esc(x.reason||'')}<br>レジ金合わせを再度行い、「精算を保存」を押してください</div>`;
    if(x.detail?.cash_sales!=null&&$('clSalesWas')) $('clSalesWas').textContent=`（取消前 ${yen(x.detail.cash_sales)}）`; }); }
// 領収書メール：端末のメールアプリを開く（写真はメールアプリ側で添付する）
function clMailUrl(who){ const to=String(settings?.receipt_mail_to||'').trim(); const subject=`【${store?.name||''}】現金払い（名前→${who}）`; const body='添付（クリップの印）→書類をスキャン→フィルタ→白黒　で送信'; return `mailto:${encodeURIComponent(to).replace(/%40/g,'@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }
// v10.43：前回の精算の翌日〜前日のうち、未精算の日の現金の動き（現金売上＋入金−出金−日払い）の合計
async function clGap(after,d){ const [mv,adv,pay,cl]=await Promise.all([ sbAll(()=>sb.from('cash_movements').select('business_date,kind,amount').eq('store_id',store.id).gt('business_date',after).lt('business_date',d).order('id')), /* v11.30：1000行で切れないように分けて読む */
    sbAll(()=>sb.from('daily_advances').select('business_date,amount').eq('store_id',store.id).gt('business_date',after).lt('business_date',d).order('id')),
    sbAll(()=>sb.from('payments').select('amount,paid_at,bills!inner(status,store_id)').eq('method','cash').gte('paid_at',new Date(`${after}T08:00:00+09:00`).toISOString()).lt('paid_at',new Date(`${d}T08:00:00+09:00`).toISOString()).order('id')),
    sb.from('register_closings').select('business_date').eq('store_id',store.id).gt('business_date',after).lt('business_date',d) ]);
  { const e=[mv,adv,pay,cl].find(x=>x.error); if(e) return {net:0,days:[],error:e.error}; }
  const done=new Set((cl.data||[]).map(r=>r.business_date)); const net={}; const add=(k,v)=>{ if(!done.has(k)) net[k]=(net[k]||0)+v; };
  (mv.data||[]).forEach(r=>add(r.business_date,r.kind==='in'?Number(r.amount):-Number(r.amount))); (adv.data||[]).filter(r=>r.amount>0).forEach(r=>add(r.business_date,-Number(r.amount)));
  (pay.data||[]).filter(p=>p.bills&&p.bills.store_id===store.id&&p.bills.status!=='void'&&p.amount).forEach(p=>{ const b=businessDate(new Date(p.paid_at)); if(b>after&&b<d) add(b,Number(p.amount)); });
  const days=Object.keys(net).filter(k=>net[k]).sort(); return {net:days.reduce((s,k)=>s+net[k],0),days}; }
function clRecalc(){ const c=clCtx; if(!c) return {}; const s=c.saved; const cnt=s?(s.counts||{}):clCounts; let counted=0; DENOMS.forEach(([v])=>{ const a=v*clNum(cnt[v]); counted+=a; const el=document.querySelector(`[data-denamt="${v}"]`); if(el) el.textContent=yen(a); });
  const opening=s?s.opening_float:(c.hasPrev?c.prevFloat:clOpening); const sales=s?s.cash_sales:c.cashSales, cin=s?s.cash_in:c.inSum, cout=s?s.cash_out:(c.outSum+c.advSum); const expected=opening+sales+cin-cout; if(s) counted=s.counted; const diff=counted-expected; const deposit=s?s.deposit:clDeposit; const next=counted-deposit;
  const T=(id,t)=>{ const e=$(id); if(e) e.textContent=t; }; T('clCounted',yen(counted)); T('clOpenTxt',yen(opening)); T('clSales',yen(sales)); T('clIn',yen(cin)); T('clOut',yen(cout)); T('clExp',yen(expected)); T('clCnt2',yen(counted)); T('clDiff',(diff>0?'+':'')+yen(diff)); T('clDepTxt',yen(deposit)); T('clNext',yen(next)); const de=$('clDiff'); if(de) de.style.color=diff===0?'':'var(--warn)';
  return {opening,expected,counted,diff,deposit,next}; }
// v10.43：前回の精算の翌日〜前日までに、動き（現金売上・入出金・日払い）があったのに精算していない日を赤で出す。日付を押すとその日を開く
async function clRenderWarn(d,after){ const el=$('clWarn'); if(!el) return; const x=new Date(d+'T00:00:00'); x.setDate(x.getDate()-31); const lo=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; const from=after&&after>lo?after:lo;
  const [mv,adv,pay,cl]=await Promise.all([ sb.from('cash_movements').select('business_date').eq('store_id',store.id).gt('business_date',from).lt('business_date',d),
    sb.from('daily_advances').select('business_date,amount').eq('store_id',store.id).gt('business_date',from).lt('business_date',d),
    sb.from('payments').select('amount,paid_at,bills!inner(status,store_id)').eq('method','cash').gte('paid_at',new Date(`${from}T08:00:00`).toISOString()).lt('paid_at',new Date(`${d}T08:00:00`).toISOString()),
    sb.from('register_closings').select('business_date').eq('store_id',store.id).gt('business_date',from).lt('business_date',d) ]);
  if($('clWarn')!==el||clDate!==d) return; const done=new Set((cl.data||[]).map(r=>r.business_date)); const act=new Set();
  (mv.data||[]).forEach(r=>act.add(r.business_date)); (adv.data||[]).filter(r=>r.amount>0).forEach(r=>act.add(r.business_date));
  (pay.data||[]).filter(p=>p.bills&&p.bills.store_id===store.id&&p.bills.status!=='void'&&p.amount).forEach(p=>{ const b=businessDate(new Date(p.paid_at)); if(b>from&&b<d) act.add(b); });
  const days=[...act].filter(x=>!done.has(x)).sort(); if(!days.length){ el.innerHTML=''; return; }
  const md=x=>`${+x.slice(5,7)}/${+x.slice(8,10)}`; el.innerHTML=`<div class="alert">${days.map(x=>`<a href="#" data-clw="${x}" style="color:inherit">${md(x)}</a>`).join('・')} が未精算です</div>`;
  el.querySelectorAll('[data-clw]').forEach(a=>a.onclick=e=>{ e.preventDefault(); clDate=a.dataset.clw; clCounts={}; clDeposit=0; renderClosing(); }); }
async function clRenderMonth(){ const el=$('clMonthBox'); if(!el) return; const [y,m]=clMonth.split('-').map(Number); const last=new Date(y,m,0).getDate(); const d1=`${clMonth}-01`, dN=`${clMonth}-${String(last).padStart(2,'0')}`; const nx=m===12?`${y+1}-01-01`:`${y}-${String(m+1).padStart(2,'0')}-01`;
  // v10.43：動きがない日も含めて全日を表示。精算記録がない日は、前日から引き継いだ釣銭・現金売上・入出金（日払い含む）から計算して出す。動きがない過去の日はレジ内現金＝理論値・過不足0円・預金0円で「精算済（変動なし自動繰越）」、動きがあったのに精算していない日は「未精算」
  const [r,pv,mv,adv,pay]=await Promise.all([ sb.from('register_closings').select('*').eq('store_id',store.id).gte('business_date',d1).lte('business_date',dN),
    sb.from('register_closings').select('next_float').eq('store_id',store.id).lt('business_date',d1).order('business_date',{ascending:false}).limit(1),
    sb.from('cash_movements').select('business_date,kind,amount').eq('store_id',store.id).gte('business_date',d1).lte('business_date',dN),
    sb.from('daily_advances').select('business_date,amount').eq('store_id',store.id).gte('business_date',d1).lte('business_date',dN),
    sb.from('payments').select('amount,paid_at,bills!inner(status,store_id)').eq('method','cash').gte('paid_at',new Date(`${d1}T08:00:00`).toISOString()).lt('paid_at',new Date(`${nx}T08:00:00`).toISOString()) ]);
  if(!$('clMonthBox')) return; const er=r.error||mv.error||adv.error||pay.error; if(er){ el.innerHTML=`<div class="muted">${esc(er.message)}</div>`; return; }
  const byD={}; (r.data||[]).forEach(x=>byD[x.business_date]=x); const sum={}; const add=(dd,k,v)=>{ (sum[dd]=sum[dd]||{sales:0,cin:0,cout:0})[k]+=Number(v)||0; };
  (mv.data||[]).forEach(x=>add(x.business_date,x.kind==='in'?'cin':'cout',x.amount)); (adv.data||[]).filter(x=>x.amount>0).forEach(x=>add(x.business_date,'cout',x.amount));
  (pay.data||[]).filter(p=>p.bills&&p.bills.store_id===store.id&&p.bills.status!=='void').forEach(p=>add(businessDate(new Date(p.paid_at)),'sales',p.amount));
  const W=['日','月','火','水','木','金','土']; const today=businessDate(); const td='style="padding:6px 5px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap"'; const C=v=>`<td ${td}>${v}</td>`; const CS=v=>`<td style="padding:6px 5px;border-bottom:1px solid var(--line);font-size:12px;white-space:nowrap;line-height:1.3">${v}</td>`; // 状態の列は折り返して全部見せる
  let carry=Number((pv.data||[])[0]?.next_float)||0; const rows=[];
  for(let i=1;i<=last;i++){ const dd=`${clMonth}-${String(i).padStart(2,'0')}`; const dl=`${dd.slice(5).replace('-','/')}（${W[new Date(dd+'T00:00:00').getDay()]}）`; const x=byD[dd];
    if(x){ rows.push(`<tr data-cld="${dd}" style="cursor:pointer">${C(dl)}${C(yen(x.opening_float))}${C(yen(x.cash_sales))}${C(yen(x.cash_in))}${C(yen(x.cash_out))}${C(yen(x.expected))}${C(yen(x.counted))}${C((x.diff>0?'+':'')+yen(x.diff))}${C(yen(x.deposit))}${CS('精算済')}</tr>`); carry=Number(x.next_float??(x.counted-x.deposit))||0; continue; }
    if(dd>today){ rows.push(`<tr style="color:var(--muted)">${C(dl)}${C('').repeat(9)}</tr>`); continue; }
    const t=sum[dd]||{sales:0,cin:0,cout:0}; const exp=carry+t.sales+t.cin-t.cout; const idle=!t.sales&&!t.cin&&!t.cout;
    rows.push(`<tr data-cld="${dd}" style="cursor:pointer;color:var(--muted)">${C(dl)}${C(yen(carry))}${C(yen(t.sales))}${C(yen(t.cin))}${C(yen(t.cout))}${C(yen(exp))}${idle?C(yen(exp))+C(yen(0))+C(yen(0))+CS(dd<today?'精算済<br>（変動なし自動繰越）':''):C('')+C('')+C('')+CS('<span style="color:var(--warn)">未精算</span>')}</tr>`); carry=exp; }
  el.innerHTML=`<table style="border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:13px"><tr>${['日付','本日釣銭','現金売上','入金合計','出金合計','理論値','レジ内現金','過不足','預金','状態'].map(h=>`<th ${td}>${h}</th>`).join('')}</tr>${rows.join('')}</table>`;
  el.querySelectorAll('[data-cld]').forEach(t=>t.onclick=()=>{ clDate=t.dataset.cld; clCounts={}; clDeposit=0; renderClosing(); }); }
function setRows(def){ if(def.single) return [settings]; let r=({tables,categories,products,customers})[def.key]; if(def.key==='products'&&setCatFilter) r=r.filter(p=>p.category_id===setCatFilter); return r; }
async function renderSettings(key, keepSel){ if(key!==setCur){ setSel=null; setEditMode=false; setCatFilter=null; $('setFilter').value=''; } setCur=key; await loadMasters(); const def=SET.find(s=>s.key===key);
  $('setMenu').innerHTML=SET.map(s=>`<button class="${s.key===key?'on':''}" data-k="${s.key}">${s.name}</button>`).join('')+'<button class="ghost" id="setLogout">ログアウト</button>';
  $('setMenu').querySelectorAll('button[data-k]').forEach(b=>b.onclick=()=>renderSettings(b.dataset.k));
  $('setLogout').onclick=async()=>{ if(!await uiConfirm('ログアウトしますか？')) return; await sb.auth.signOut(); location.reload(); };
  $('setList').parentElement.style.gridColumn=(def.audit||def.bills||def.closing||def.chorei)?'2 / 4':''; $('setForm').parentElement.style.display=(def.audit||def.bills||def.closing||def.chorei)?'none':'';
  $('setAdd').style.display=def.single?'none':''; $('setEdit').style.display=(def.single||def.nosort)?'none':''; $('setEdit').textContent=setEditMode?'完了':'編集'; $('setEdit').classList.toggle('on',setEditMode);
  $('setFilter').style.display=def.single?'none':'';
  if (def.local) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setList').innerHTML='';
    $('setForm').innerHTML=`<label>印刷方法<select id="pmSel"><option value="tmpa" ${PRINT.method==='tmpa'?'selected':''}>プリンター（Epson TM Print Assistant）</option><option value="browser" ${PRINT.method==='browser'?'selected':''}>ブラウザ印刷（PDF）</option></select></label><div class="muted hint">プリンター印刷には「Epson TM Print Assistant」アプリが要ります<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">プリンター印刷はタブレットに「Epson TM Print Assistant」アプリを入れ、TM-m30IIIとBluetoothまたはWi-Fiで接続しておく必要があります。設定はこの端末だけに保存されます。</div></div>`;
    $('pmSel').onchange=e=>{ PRINT.method=e.target.value; localStorage.setItem('print_method'+SLOT,PRINT.method); toast('保存しました'); }; return; }
  if (def.chorei) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setForm').innerHTML=''; await renderChorei(); return; }
  if (def.closing) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setForm').innerHTML=''; await renderClosing(); return; }
  if (def.bills) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setForm').innerHTML=''; $('setList').innerHTML='<div class="muted">読み込み中…</div>';
    const today=businessDate(); const BSEL='id,status,table_id,guest_count,opened_at,closed_at,business_date,bill_customers(customer_id),bill_casts(id,staff_id,role,is_kakari),payments(method,amount,received_at,revenue_date)';
    const q1 = await sb.from('bills').select(BSEL).eq('business_date',today).order('opened_at',{ascending:false}); const error=q1.error;
    if(error){ $('setList').innerHTML=`<div class="muted">${esc(error.message)}</div>`; return; }
    const pr=await sb.from('payments').select('bill_id').eq('revenue_date',today).gt('amount',0).not('received_at','is',null); const have=new Set((q1.data||[]).map(b=>b.id)); const ids=[...new Set((pr.data||[]).map(p=>p.bill_id))].filter(i=>!have.has(i));
    const q2=ids.length?await sb.from('bills').select(BSEL).in('id',ids):{data:[]};
    // 置き：未入金の間はどの日の一覧にも載せない。全額の入金を受けた日の伝票として載せる
    const data=[...(q1.data||[]),...(q2.data||[])].filter(b=>{ if(b.status!=='closed') return b.business_date===today; if((b.payments||[]).some(p=>p.method==='oki'&&p.amount>0&&!p.received_at)) return false; return billDay(b)===today; });
    const tot={}; await Promise.all((data||[]).map(async b=>{ const r=await sb.rpc('calc_bill',{p_bill:b.id}); tot[b.id]=r.data?.amount_due??null; }));
    const SJ={open:'<span class="badge">来店中</span>',closed:'<span class="badge k">会計済</span>',void:'<span class="badge gray">削除</span>'};
    const grl=data.length?await sb.from('good_reactions').select('bill_id,staff_id').in('bill_id',data.map(b=>b.id)):{data:[]}; const grm={}; (grl.data||[]).forEach(g=>(grm[g.bill_id]=grm[g.bill_id]||[]).push(g.staff_id)); if(!staffAll.length) await loadStaffAll();
    const live=(data||[]).filter(b=>b.status==='closed'); const sum=live.reduce((a,b)=>a+(tot[b.id]||0),0);
    $('setList').innerHTML=`<div class="muted" style="margin-bottom:6px">本日（${businessDate()}）　会計済 ${live.length}件・${yen(sum)}</div>`+((data||[]).map(b=>{ const cn=(b.bill_customers||[]).map(c=>customers.find(x=>x.id===c.customer_id)?.name).filter(Boolean).join('・'); const pm=[...new Set((b.payments||[]).filter(p=>p.amount>0).map(p=>METHOD[p.method]+(p.method==='oki'&&!p.received_at?'(未入金)':'')))].join('・');
      return `<div class="row" data-bill="${b.id}" style="cursor:pointer">${SJ[b.status]||''}<span class="nm">${esc(tables.find(t=>t.id===b.table_id)?.name||'')}　${hm5(b.opened_at)}${b.closed_at?'〜'+hm(b.closed_at):''}　${b.guest_count}名　${esc(cn)} <small class="muted">${esc(pm)}${b.business_date&&b.business_date!==today?`（ご来店日 ${jmd(b.business_date)}）`:''}</small></span>${billPeopleChips(b,grm[b.id]||[],b.status==='closed'&&billDay(b)===today)}<b>${tot[b.id]!=null?yen(tot[b.id]):''}</b></div>`; }).join('')||'<div class="muted">本日の伝票はまだありません</div>');
    $('setList').querySelectorAll('[data-bill]').forEach(r=>r.onclick=()=>{ billFrom='bills'; openBill(r.dataset.bill); });
    $('setList').querySelectorAll('[data-bpe]').forEach(x=>x.onclick=async e=>{ e.stopPropagation(); await billPeopleEdit(x.dataset.bpe); renderSettings('bills'); }); return; }
  if (def.audit) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setForm').innerHTML='';
    const ad=auDate||(auDate=businessDate()), an=new Date(ad+'T00:00:00'); an.setDate(an.getDate()+1); const ad2=`${an.getFullYear()}-${String(an.getMonth()+1).padStart(2,'0')}-${String(an.getDate()).padStart(2,'0')}`; // v11.30：営業日（朝8時で区切る）を選んで、その日の分を全部
    const { data, error } = await sbAll(()=>sb.from('pos_audit_log').select('*').eq('store_id',store.id).gte('created_at',ad+'T08:00:00+09:00').lt('created_at',ad2+'T08:00:00+09:00').order('created_at',{ascending:false}).order('id'));
    if(error){ $('setList').innerHTML=`<div class="muted">操作ログを読めません（SQL 010 が未適用の可能性）：${esc(error.message)}</div>`; return; }
    const f=d=>{ const x=new Date(d); return `${x.getMonth()+1}/${x.getDate()} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`; };
    const KJ={amount:'金額',minutes:'分',is_auto:'自動延長',before:'変更前',after:'変更後',item:'商品',qty:'数量',total:'請求額',guest_count:'客数',items:'注文',name:'名前',fields:'内容',customer:'お客様',bottle:'ボトル',kind:'種別',reason:'理由',total_before:'切替前の請求額',method:'支払方法',payments:'支払',kakari:''+KL+'',tag_no:'タグ番号',by:'操作者',date:'営業日',memo:'摘要'}; // v11.08：管理サイトの現金管理から入れた操作は「操作者：管理サイト：名前」
    const vj=v=>v===true?'はい':v===false?'いいえ':Array.isArray(v)?v.join('、'):(typeof v==='number'?v.toLocaleString():v);
    const dt=o=>logShort(o,KJ,vj);
    $('setList').innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><input type="date" id="auD" value="${ad}" style="width:auto"><small class="muted">${(data||[]).length}件</small></div>`+((data||[]).map(l=>`<div class="item" style="display:block"><b>${esc(actL(l.action))}</b> <small>${f(l.created_at)}　${esc(l.detail?.table||'')}</small><br><small>${esc(dt(l.detail))}</small>${l.reason?`<br><small>理由：${esc(l.reason)}</small>`:''}</div>`).join('')||'<div class="muted">この日の記録はありません</div>');
    $('auD').onchange=()=>{ if($('auD').value){ auDate=$('auD').value; renderSettings('audit'); } }; return; }
  if (def.single) { $('setList').innerHTML=''; setSel=settings; renderForm(def); return; }
  const rows=setRows(def);
  if(setSel) setSel=rows.find(r=>r.id===setSel.id)||null; // 保存後は読み直した最新の行を表示する（古い値が残らないように）
  let head='';
  if (key==='products') head=`<select id="setCat" style="margin-bottom:6px"><option value="">--- すべて ---</option>${categories.map(c=>`<option value="${c.id}" ${setCatFilter===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`;
  const _st=$('setList').dataset.key===key?$('setList').scrollTop:0; $('setList').dataset.key=key;
  $('setList').innerHTML=head+rows.map(r=>`<div class="row ${setSel?.id===r.id?'on':''}" data-id="${r.id}">${setEditMode?`<button class="danger sm" data-del="${r.id}">削除</button>`:''}<span class="nm">${esc(def.label(r))}${def.sub?` <small class="muted">${def.sub(r)}</small>`:''}${r.is_visible===false?' <small class="muted">（非表示）</small>':''}</span>${setEditMode&&!def.nosort?'<span class="hd">≡</span>':''}</div>`).join('');
  if (key==='products') $('setCat').onchange=e=>{ setCatFilter=e.target.value||null; renderSettings(key,true); };
  $('setList').querySelectorAll('.row').forEach(row=>{ row.onclick=e=>{ if(e.target.dataset.del||e.target.classList.contains('hd'))return; setSel=rows.find(r=>r.id===row.dataset.id); renderSettings(key,true); }; });
  $('setList').querySelectorAll('[data-del]').forEach(b=>b.onclick=async e=>{ e.stopPropagation(); const r=rows.find(x=>x.id===b.dataset.del); if(!await uiConfirm(`「${def.label(r)}」を削除しますか？`))return;
    const { error } = await sb.from(def.table).delete().eq('id',b.dataset.del); if(error){ toast('使用中のため削除できません。非表示にしてください'); return; } await logOp('設定の削除',{kind:def.name,name:def.label(r)},null,true); setSel=null; renderSettings(key,true); });
  $('setList').scrollTop=_st; { const q=$('setFilter').value.trim(); if(q) $('setList').querySelectorAll('.row').forEach(r=>{ r.style.display=r.textContent.includes(q)?'':'none'; }); const on=$('setList').querySelector('.row.on'); if(on){ const a=on.getBoundingClientRect(), l=$('setList').getBoundingClientRect(); if(a.top<l.top+40||a.bottom>l.bottom) on.scrollIntoView({block:'center'}); } }
  if (setEditMode && !def.nosort) enableDrag(def);
  renderForm(def);
}
function renderForm(def){ const r=setSel; const f=$('setForm');
  if(!r){ f.innerHTML='<div class="muted">左の一覧から選ぶか「追加」</div>'; return; }
  if(def.ro){ renderFormRo(def,r); return; }
  f.innerHTML=def.cols.map(([k,label,type])=>{
    if(type==='bool') return `<label class="sw"><input type="checkbox" data-k="${k}" ${r[k]?'checked':''}>${label}</label>`;
    if(type==='prod') return `<label>${label}<select data-k="${k}"><option value="">なし</option>${products.filter(p=>p.agg_category==='HC').map(p=>`<option value="${p.id}" ${r[k]===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`;
    if(type==='cat') return `<label>${label}<select data-k="${k}">${categories.map(c=>`<option value="${c.id}" ${r[k]===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`;
    return `<label>${label}<input type="${type}" data-k="${k}" value="${esc(r[k]??'')}"></label>`; }).join('')+(def.key==='pos'?`<h3 style="margin:16px 0 4px">VIP料金（卓ごと。0＝通常卓）</h3><div class="muted" style="font-size:12px">VIP代＝部屋につき1回／VIP延長＝延長${settings.ext_minutes}分ごとに加算。人数は掛けません</div><table style="width:100%;margin-top:6px"><tr><th style="text-align:left">卓</th><th>VIP代</th><th>VIP${settings.ext_minutes}分延長</th></tr>${tables.map(t=>`<tr><td>${esc(t.name)}</td><td><input type="number" data-vipset="${t.id}" value="${t.vip_set_fee||0}"></td><td><input type="number" data-vipext="${t.id}" value="${t.vip_ext_fee||0}"></td></tr>`).join('')}</table>`:'')+`<div class="bar"><button class="primary" id="setSave">保存</button></div>`;
  $('setSave').onclick=async()=>{ const o={}; def.cols.forEach(([k,,type])=>{ const el=f.querySelector(`[data-k="${k}"]`); o[k]=type==='bool'?el.checked:type==='number'?Number(el.value||0):(type==='prod'?(el.value||null):el.value); });
    const q = def.single ? sb.from('pos_settings').update(o).eq('store_id',settings.store_id) : sb.from(def.table).update(o).eq('id',r.id);
    let { error } = await q;
    if(!error){ const ch=def.cols.filter(([k])=>String(r[k]??'')!==String(o[k]??'')).map(([k,label])=>`${label.split('（')[0].split('：')[0]}:${r[k]??''}→${o[k]??''}`); if(ch.length) await logOp('設定変更',{kind:def.name,name:def.single?null:def.label(r),fields:ch},null,true); }
    if(!error&&def.key==='pos'){ for(const t of tables){ const a=Number(f.querySelector(`[data-vipset="${t.id}"]`)?.value||0), b=Number(f.querySelector(`[data-vipext="${t.id}"]`)?.value||0); if(a!==(t.vip_set_fee||0)||b!==(t.vip_ext_fee||0)){ const r=await sb.from('tables').update({vip_set_fee:a,vip_ext_fee:b}).eq('id',t.id); if(r.error){ error=r.error; break; } await logOp('設定変更',{kind:'VIP料金',name:t.name,fields:[`VIP代:${t.vip_set_fee||0}→${a}`,`VIP延長:${t.vip_ext_fee||0}→${b}`]},null,true); } } }
    toast(error?error.message:'保存しました'); if(!error) renderSettings(def.key,true); };
}
// v11.13：料金設定は見るだけ（変えるのは管理サイト：料金は「POS設定」、日払の上限・源泉・ポイント・同伴の準備時間は「報酬・罰金項目」）
function renderFormRo(def,r){ const f=$('setForm'); const val=(k,type)=>type==='bool'?(r[k]?'する':'しない'):type==='amt'?(r[k]>0?yen(r[k]):'付けない'):(r[k]??'');
  f.innerHTML=`<div class="muted hint" style="margin-bottom:10px">ここでは閲覧のみです<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">料金は管理サイト「POS設定」、日払（立替）の上限・体験の源泉・ポイント・同伴の準備時間は「報酬・罰金項目」で設定します</div></div>`+def.cols.map(([k,label,type])=>`<label>${label}<input value="${esc(String(val(k,type)))}" disabled></label>`).join('')+
    `<h3 style="margin:16px 0 4px">VIP料金（卓ごと。0＝通常卓）</h3><table style="width:100%;margin-top:6px"><tr><th style="text-align:left">卓</th><th>VIP代</th><th>VIP${settings.ext_minutes}分延長</th></tr>${tables.map(t=>`<tr><td>${esc(t.name)}</td><td><input value="${t.vip_set_fee||0}" disabled></td><td><input value="${t.vip_ext_fee||0}" disabled></td></tr>`).join('')}</table>`; }
$('setAdd').onclick=async()=>{ const def=SET.find(s=>s.key===setCur); const rows=setRows(def); const row=def.newRow(); if(!def.nosort) row.sort_order=(Math.max(0,...rows.map(r=>r.sort_order||0))+1); if(def.key==='products'&&setCatFilter) row.category_id=setCatFilter;
  const { data, error } = await sb.from(def.table).insert(row).select().single(); if(error){toast(error.message);return;} await logOp('設定の追加',{kind:def.name,name:def.label(data)},null,true); setSel=data; renderSettings(setCur,true); };
$('setEdit').onclick=()=>{ setEditMode=!setEditMode; renderSettings(setCur,true); };
$('setFilter').oninput=e=>{ const q=e.target.value.trim(); $('setList').querySelectorAll('.row').forEach(r=>{ r.style.display=!q||r.textContent.includes(q)?'':'none'; }); };
// 長押しドラッグ並び替え
function enableDrag(def){ dragSort($('setList'),'.row',async ids=>{ const rs=await Promise.all(ids.map((id,i)=>sb.from(def.table).update({sort_order:(i+1)*10}).eq('id',id))); const er=rs.find(r=>r.error); toast(er?('並び順を保存できませんでした：'+er.error.message):'並び順を保存しました'); renderSettings(def.key,true); }); }
// 行を動かすと指の追跡が切れるため、動き・離すは画面全体で受ける
// v12.04：上下の端まで持っていくと、リストが自分で動く（オーナー 2026-10-22「並び変えできない」。在籍リストは画面に入りきらない）
function dragSort(list,sel,onDone){
  const scroller=()=>{ for(let e=list;e&&e!==document.body;e=e.parentElement){ const cs=getComputedStyle(e); if(/(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight) return e; } return document.scrollingElement||document.documentElement; };
  list.querySelectorAll(sel).forEach(row=>{ const h=row.querySelector('.hd'); if(!h)return;
    h.onpointerdown=e=>{ e.preventDefault(); let dragging=null, moved=false, lastX=e.clientX, lastY=e.clientY, raf=0; const sc=scroller();
      const timer=setTimeout(()=>{ dragging=row; row.classList.add('drag'); raf=requestAnimationFrame(auto); },150);
      const place=(x,y)=>{ const el=document.elementsFromPoint(x,y).map(z=>z.closest(sel)).find(z=>z&&z.parentElement===list); /* 上に重なっている物があっても下の行を見る */ if(!el||el===dragging||el.parentElement!==list)return; const r=el.getBoundingClientRect(); const before=y<r.top+r.height/2; const ref=before?el:el.nextSibling; if(ref===dragging||ref===dragging.nextSibling)return; list.insertBefore(dragging,ref); moved=true; };
      const auto=()=>{ if(!dragging)return; const box=sc===document.scrollingElement||sc===document.documentElement?{top:0,bottom:window.innerHeight}:sc.getBoundingClientRect(); const edge=70;
        let v=0; if(lastY<box.top+edge) v=-Math.ceil((box.top+edge-lastY)/4); else if(lastY>box.bottom-edge) v=Math.ceil((lastY-(box.bottom-edge))/4);
        if(v){ sc.scrollTop+=v; place(lastX,Math.min(Math.max(lastY,box.top+12),box.bottom-12)); } /* 指がリストの外に出ても、内側の一番近い行で入れ替える */ raf=requestAnimationFrame(auto); };
      const move=ev=>{ if(!dragging)return; ev.preventDefault(); lastX=ev.clientX; lastY=ev.clientY; place(lastX,lastY); };
      const end=async()=>{ clearTimeout(timer); cancelAnimationFrame(raf); window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',end); window.removeEventListener('pointercancel',end); if(!dragging)return; dragging.classList.remove('drag'); dragging=null; if(moved) await onDone([...list.querySelectorAll(sel)].map(r=>r.dataset.id)); };
      window.addEventListener('pointermove',move,{passive:false}); window.addEventListener('pointerup',end); window.addEventListener('pointercancel',end); }; }); }

kReg(SET,CUF);
start();
