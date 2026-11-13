// ---------- 朝礼（オーナー「本日来店予定のお客様のメモは必ず確認。パーソナライズされたサービスが OLIVE の命。お客様に何度も言わせない」）
// 朝礼は黒服だけ。お客様を押すとメモが開き、読んだら「確認」（説明の文は オーナー「未確認をタップで顧客メモを確認してください。」）。天気は Open-Meteo（20時〜翌1時。降水確率50%以上で傘の準備）
let chOpen=new Set();
/* 天気はアイコン（Meteocons・MIT）＋小さい言葉（オーナー「“晴”はパッとみでわからん」「絵文字やめて、ちゃんと探して」→ ア）。20時〜翌1時なので夜のアイコン */
const WX=c=>WXT(c)[0];
async function chWeather(C){ if(C.lat==null||C.lon==null) return '<div class="muted">店の場所が未設定です</div>';
  try{ const u=`https://api.open-meteo.com/v1/forecast?latitude=${C.lat}&longitude=${C.lon}&hourly=weather_code,precipitation_probability,temperature_2m&timezone=Asia%2FTokyo&forecast_days=3`;
    const j=await (await fetch(u)).json(); const H=j.hourly; const nx=(()=>{ /* 端末の時刻で1日足してから toISOString にすると UTC で前の日に戻り、24時・1時が当日の 0時・1時になっていた */ const [y,m,dd]=C.date.split('-').map(Number); return new Date(Date.UTC(y,m-1,dd+1)).toISOString().slice(0,10); })();
    const want=[[C.date,20],[C.date,21],[C.date,22],[C.date,23],[nx,0],[nx,1]].map(([d,h])=>{ const k=`${d}T${String(h).padStart(2,'0')}:00`, i=H.time.indexOf(k); return {h:h===0?24:h, c:H.weather_code[i], p:H.precipitation_probability[i], t:H.temperature_2m[i]}; });
    const rain=want.find(x=>(x.p??0)>=50);
    return `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;text-align:center">${want.map(x=>`<div style="border:1px solid var(--line);border-radius:8px;padding:6px 0;line-height:1.4;${(x.p??0)>=50?'background:var(--warn-soft)':''}"><div class="muted" style="font-size:13px">${x.h===25?'1':x.h}時</div>${WXI(x.c,44)}<div style="font-size:12px;white-space:nowrap">${WX(x.c)}</div><div style="font-size:14px;${(x.p??0)>=50?'color:var(--warn);font-weight:700':''}">${x.p??'—'}%</div><div class="muted" style="font-size:13px">${x.t==null?'—':Math.round(x.t)+'℃'}</div></div>`).join('')}</div>
      ${rain?`<div style="background:var(--warn-soft);color:var(--warn);font-weight:700;border-radius:8px;padding:8px 10px;margin-top:8px">傘の準備（${rain.h}時から${/雪/.test(WX(rain.c))?'雪':'雨'}）</div>`:''}`;
  }catch(e){ return '<div class="muted">天気を読み込めません</div>'; } }
/* 売上予測（目標・現在・予測。昨日まで。「今月」の行はこの表の「現在」に入れた。 オーナー・見本 作業場/売上予測_案7.png） */
function chFc(F){ const md=mdS, no='<span class="muted">—</span>', g=n=>n==null?no:`${n}組`, y=n=>n==null?no:yen(n);
  const th='color:var(--muted);font-weight:700;font-size:13px;text-align:right;padding:4px 0 4px 8px;border-top:1px solid var(--line)', td='padding:4px 0 4px 8px;border-top:1px solid var(--line);font-weight:700;text-align:right;white-space:nowrap', tl='padding:4px 0;border-top:1px solid var(--line);font-weight:700', big=';font-size:17px';
  const kv=(a,b)=>`<span class="muted">${a}</span><b style="text-align:right">${b}</b>`;
  return `<div style="font-size:13px;color:var(--muted);font-weight:700;margin:10px 0 2px">${F.month}月（${md(F.from)}〜${md(F.to)}）　営業日数 ${F.done} / ${F.days}日</div>
    <table style="border-collapse:collapse;width:100%;font-size:14px"><tr><th style="${th}"></th><th style="${th}">目標</th><th style="${th}">現在</th><th style="${th}">予測</th></tr>
    <tr><td style="${tl}">売上</td><td style="${td}">${y(F.target)}</td><td style="${td}">${yen(F.sales)}</td><td style="${td}${big}">${y(F.fc_sales)}</td></tr>
    <tr><td style="${tl}">組数</td><td style="${td}">${g(F.tgt_groups)}</td><td style="${td}">${F.groups}組</td><td style="${td}${big}">${g(F.fc_groups)}</td></tr></table>
    <div style="display:grid;grid-template-columns:auto 1fr auto 1fr;gap:3px 10px;margin-top:8px;font-size:14px;align-items:baseline">${kv('1日平均売上',y(F.avg))}${kv('1日必要組数',g(F.need))}${kv('平均客単価',y(F.unit))}</div>`; }
async function renderChorei(){ const box=$('setList'); box.innerHTML='<div class="muted">読み込み中…</div>';
  if(!S.staffAll?.length) await loadStaffAll(); const [cr,ar,sr]=await Promise.all([sb.rpc('pos_chorei'), sb.rpc('pos_absences',{p_date:businessDate()}), sb.rpc('pos_sales_today')]);
  if(S.setCur!=='chorei') return;
  if(cr.error){ box.innerHTML=`<div class="err">${/pos_chorei/.test(cr.error.message)?'SQL 129 が未実行です：':'読み込めません：'}${esc(cr.error.message)}</div>`; return; }
  const V=chPrep(cr,ar,sr); V.guest=g=>chGuest(V,g);
  box.innerHTML=chHtmlTop(V)+chHtmlSide(V);
  chBind(V,box);
  const wx=await chWeather(V.C); if($('chWx')) $('chWx').outerHTML=`<div>${wx}</div>`;
}
/* 朝礼の中身：日付・カードと行の形・お客様・出勤・アプローチ・書類・ドレス */
function chPrep(cr,ar,sr){
  const C=cr.data, G=C.guests||[], d=new Date(C.date+'T00:00:00+09:00'), md=x=>`${mdS(x)}（${wdS(x)}）`;
  const card=(t,inner,extra='')=>`<div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--card)"><div style="font-size:15px;color:var(--muted);font-weight:700;margin-bottom:8px">${t}${extra}</div>${inner}</div>`;
  const row=(a,b,st='')=>`<div style="display:flex;gap:10px;padding:5px 0;border-top:1px solid var(--line);${st}">${a}${b}</div>`;
  const tag='<span style="display:inline-block;background:var(--pri);color:#fff;border-radius:4px;padding:1px 6px;font-size:14px;font-weight:700;line-height:1.4;vertical-align:2px">同伴</span> ';
  const left=G.filter(g=>g.customer&&!g.ok_at).length; const TB=C.tables||[];
  const SH={}; (C.shifts||[]).forEach(x=>{ const dh=Number(x.douhan)>0||x.time==='同伴', k=dh?'同伴':esc(x.time); (SH[k]=SH[k]||[]).push(esc(x.name)+(x.black?FX('dress',15):'')+(dh?`（${Math.max(1,Number(x.douhan)||0)}件）`:'')); }); /* 黒ドレスのしるし */ /* 同伴がある人は「同伴」の行に件数だけ（マイページと同じ・オーナー 案ア）。黒服は出さない */
  const abs=(ar.error?[]:ar.data||[]);
  const sl=(sr.error?[]:sr.data.rows||[]).filter(x=>x.worked&&x.count==null).map(x=>esc(S.staffAll.find(z=>z.id===x.staff_id)?.display_name||'')).filter(Boolean);
  const todo=[sl.length?row('<span style="min-width:110px">アプローチ</span>',`<span>${sl.join('・')} <small class="muted">（未連絡）</small></span>`):'',
    ...(C.docs||[]).length?[row('<span style="min-width:110px">書類未提出</span>',`<span>${C.docs.map(x=>`<div><b style="font-weight:400;white-space:nowrap">${esc(x.name)}</b> <small class="muted">${esc(x.miss)}</small></div>`).join('')}</span>` /* 1人1行。名前を途中で割らない */)]:[],
    (C.dress||[]).length?row('<span style="min-width:110px">ドレス新調日</span>',`<span>${C.dress.map(x=>esc(x.name)).join('・')} <small class="muted">${md(C.dress[0].due).replace(/（.）/,'')} まで・未提出</small></span>`):''].join('');
  const y=new Date(d); y.setDate(y.getDate()-1);
  return {C,G,d,md,card,row,tag,left,TB,SH,abs,sl,todo,y,ar}; }
/* 来店予定のお客様の1組（見出しと、開いた時の中身） */
function chGuestHead(V,g){ const {C,G,d,md,card,row,tag,left,TB,SH,abs,sl,todo,y,guest,ar}=V; const cu=g.customer, op=chOpen.has(g.id)&&cu;
    const st=!cu?'<span class="muted" style="font-size:14px">顧客未登録（はじめて）</span>':g.ok_at?`<span class="muted" style="font-size:14px">確認済 ${new Date(g.ok_at).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false})}${g.ok_by&&g.ok_by!=='POS'?'・'+esc(g.ok_by):''}</span>`:'<span style="color:var(--warn);font-weight:700;font-size:14px">未確認</span>';
    const head=`<div ${cu?`data-cho="${g.id}"`:''} style="display:flex;align-items:center;gap:10px;${cu?'cursor:pointer':''}"><b style="font-size:18px;min-width:56px">${esc(g.time)}</b><div style="flex:1;font-size:18px;font-weight:700">${g.douhan?tag:''}${g.vip?tag.replace('同伴',esc(g.vip)):''}${esc(g.name)} 様 ${g.guests}名 <small class="muted" style="font-weight:400">${resvWho(g,{noKK:S.store?.customer_mode==='yukyaku',mark:FX('dress',15)})}</small></div><span style="flex:none;white-space:nowrap">${st}</span><select data-chs="${g.id}" style="height:40px;width:auto;border:1px solid var(--line);border-radius:8px;padding:0 4px 0 8px;font:inherit;font-size:16px;background:var(--card);color:var(--ink)"><option value="">卓</option>${TB.map(t=>`<option value="${t.id}"${t.id===g.seat?' selected':''}>${esc(t.name)}</option>`).join('')}</select>`+
    `<button class="sm ghost" data-chx="${g.id}" style="color:var(--warn)">取消</button><span class="muted" style="font-size:20px;min-width:20px;${cu?'':'visibility:hidden'}">${op?'▲':'▼'}</span></div>`; /* 同伴の取消（操作者を選ぶ・申請した子と同伴の子に LINE）。広島は担当を出さない（オーナー）。卓（POS の卓から選ぶ・VIP 希望は最初から VIP）と、同伴でない予約の取消（オーナー 見本 朝礼_卓_案2）。卓の欄がそろうように ▼ の場所を決めておく。しるしは卓の左（オーナー「しるしを卓の左に寄せて」。名前の欄が伸びるので、卓・取消の位置はそろう） */
  return head; }
function chGuest(V,g){ const {C,G,d,md,card,row,tag,left,TB,SH,abs,sl,todo,y,guest,ar}=V; const cu=g.customer, op=chOpen.has(g.id)&&cu, head=chGuestHead(V,g);
    if(!op) return `<div style="border-top:1px solid var(--line);padding:12px 0">${head}</div>`;
    const bd=cu.birthday?`${esc(cu.birthday)}${cu.bday_in===0?'（本日お誕生日）':cu.bday_in!=null&&cu.bday_in<=7?`（あと${cu.bday_in}日）`:''}`:'—';
    const bt=(cu.bottles||[]).map(b=>`${esc(b.name)}（残り ${b.remaining}/10${b.share?'・共同 '+esc(b.share)+' 様':''}）`).join('、')||'—'; /* 共同ボトル */
    const ls=cu.last?`${md(cu.last.date)} ${cu.last.guests}名${cu.last.casts?'・'+esc(cu.last.casts):''}`:'—';
    return `<div style="border-top:1px solid var(--line);padding:12px 0">${head}<div style="margin-left:66px">
      <div style="display:grid;grid-template-columns:80px 1fr 90px 1fr;gap:2px 10px;font-size:14px;margin-top:6px"><span class="muted">誕生日</span><span ${cu.bday_in!=null&&cu.bday_in<=7?'style="color:var(--warn);font-weight:700"':''}>${bd}</span><span class="muted">反応◎</span><span>${esc(cu.good||'—')}</span><span class="muted">ボトル</span><span>${bt}</span><span class="muted">前回の来店</span><span>${ls}</span><span class="muted">タバコ</span><span style="white-space:pre-line">${esc(cu.tobacco||'—')}</span><span class="muted">配車</span><span style="white-space:pre-line">${esc(cu.haisha||'—')}</span></div>
      <div style="background:var(--gold-soft);border-radius:8px;padding:8px 10px;margin-top:6px;font-size:15px;line-height:1.7;white-space:pre-wrap"><span class="muted" style="font-size:13px">メモ</span>\n${esc(cu.memo||'なし')}</div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">${g.ok_at?`<button class="sm" data-chu="${g.id}">確認の取消</button>`:`<button class="primary" data-chk="${g.id}" style="padding:0 48px;height:52px;font-size:17px">確認</button>`}</div></div></div>`;
}
function chHtmlTop(V){ const {C,G,d,md,card,row,tag,left,TB,SH,abs,sl,todo,y,guest,ar}=V; return `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px"><b style="font-size:22px">${md(C.date)}</b>${C.event?'<span style="background:var(--gold-soft);border:1px solid var(--line);border-radius:4px;padding:1px 8px;font-size:14px">イベント日</span>':''}${C.off?'<span style="background:var(--soft);border:1px solid var(--line);border-radius:4px;padding:1px 8px;font-size:14px">休</span>':''}</div>
    ${card(`本日来店予定のお客様 ${G.length}組`,G.length?G.map(guest).join('')+'<div class="muted" style="font-size:13px;margin-top:6px">未確認をタップで顧客メモを確認してください。</div>':'<div class="muted">なし</div>',left?`　<span style="color:var(--warn)">未確認 ${left}組</span>`:'')}`; }
function chHtmlSide(V){ const {C,G,d,md,card,row,tag,left,TB,SH,abs,sl,todo,y,guest,ar}=V; return `
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:14px;align-items:start">
      <div style="display:flex;flex-direction:column;gap:14px">${card(`天気（${esc(C.place||'')}）`,'<div id="chWx" class="muted">読み込み中…</div>')}
        ${card(`本日の出勤 ${(C.shifts||[]).length}人`,(Object.keys(SH).sort().map(t=>row(`<b style="min-width:52px">${t}</b>`,`<span>${SH[t].join('・')}</span>`)).join('')||'<div class="muted">シフトなし</div>')+abs.map(a=>row('<b style="min-width:52px;color:var(--warn)">欠勤</b>',`<span style="color:var(--warn);font-weight:700">${esc(S.staffAll.find(z=>z.id===a.staff_id)?.display_name||'')}（${hmJst(a.at)}・${esc(a.reason)}）</span>`)).join('')+(ar.error?RDERR:''))}</div>
      <div style="display:flex;flex-direction:column;gap:14px">${card('売上',row(`<span style="flex:1">昨日 ${y.getMonth()+1}/${y.getDate()}（${WD[y.getDay()]}）</span>`,`<b>${yen(C.sales_y||0)}</b>`)+(C.fc?chFc(C.fc):C.sales_m==null?'':row(`<span style="flex:1">今月（${d.getMonth()+1}/1〜${y.getMonth()+1}/${y.getDate()}）</span>`,`<b>${yen(C.sales_m)}</b>`)))}
        ${/* 前後1週間（キャストのトップと同じ） */''}${card('お誕生日（前後1週間）',(C.bdays||[]).map(b=>row(`<b style="min-width:64px;${b.in===0?'color:var(--warn)':b.in<0?'color:var(--muted)':''}">${b.in===0?'本日':b.in<0?(-b.in)+'日前':'あと'+b.in+'日'}</b>`,`<span style="flex:1;${b.in<0?'color:var(--muted)':''}">${esc(b.name)}${(b.kind_label||'お客様')==='お客様'?' 様':''} <small class="muted">${esc(b.birthday)}</small></span><span class="muted">${(b.kind_label||'お客様')==='お客様'?(b.kakari?KL+' '+esc(b.kakari):''):esc(b.kind_label)}</span>`)).join('')||'<div class="muted">なし</div>')}
        ${card('キャストのやること',todo||'<div class="muted">なし</div>')}</div></div>`; }
/* 押した時の動き：お客様を開く・卓・予約の取消・確認 */
function chBind(V,box){ const {C,G,d,md,card,row,tag,left,TB,SH,abs,sl,todo,y,guest,ar}=V;
  box.querySelectorAll('[data-cho]').forEach(h=>h.onclick=()=>{ const k=h.dataset.cho; chOpen.has(k)?chOpen.delete(k):chOpen.add(k); renderChorei(); });
  box.querySelectorAll('[data-chs]').forEach(x=>{ x.onclick=e=>e.stopPropagation(); x.onchange=async()=>{ const id=x.dataset.chs, g=G.find(g=>String(g.id)===id), was=g?.seat||''; x.disabled=true; /* 選ぶとすぐ保存 */
    const q=await sb.rpc('pos_resv_seat',{p_id:id,p_table:x.value||null}); x.disabled=false; if(q.error){ x.value=was; await uiAlert(q.error.message); return; } if(g) g.seat=x.value||null; toast('保存しました'); }; });
  box.querySelectorAll('[data-chx]').forEach(b=>b.onclick=async e=>{ e.stopPropagation(); const g=G.find(x=>String(x.id)===b.dataset.chx); /* 同伴の取消。同伴でない予約も（pos_resv_cancel） */
    const hs=S.staffAll.filter(x=>x.kind==='hall'&&x.is_active); const by=await uiPick('操作者（黒服）',hs.map(h=>({label:h.display_name,value:h.display_name}))); if(!by) return;
    if(!await uiConfirm(g?.douhan?`${g?.name||''} 様の同伴を取り消しますか？\n申請した子と同伴の子に LINE で知らせます`:`${g?.name||''} 様の予約を取り消しますか？\n${S.store?.customer_mode==='yukyaku'?'申請した子':'申請した子と'+KL}に LINE で知らせます`)) return; b.disabled=true;
    const q=await sb.rpc('pos_resv_cancel',{p_id:b.dataset.chx,p_by:by}); if(q.error){ b.disabled=false; await uiAlert(q.error.message); return; } toast('取り消しました'); renderChorei(); });
  box.querySelectorAll('[data-chk],[data-chu]').forEach(b=>b.onclick=async e=>{ e.stopPropagation(); const ok=!!b.dataset.chk, id=b.dataset.chk||b.dataset.chu; b.disabled=true;
    const q=await sb.rpc('pos_chorei_ok',{p_resv:id,p_ok:ok}); if(q.error){ b.disabled=false; await uiAlert(q.error.message); return; } if(ok) chOpen.delete(id); renderChorei(); });
}
