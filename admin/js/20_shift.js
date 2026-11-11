// ---------- シフト（月のカレンダー・日の詳細） ----------
// v1.06・SQL 127：目安より少ない日は「3／6人」を赤（オーナー 2026-10-16「足りない日は 3/6 の部分を赤くして警告」）
// v1.05・SQL 126：同伴の申請があればシフトに自動で入るので、赤の札（同伴なのにシフトなし）は外した。色の見本は実際と同じ形（オーナー 2026-10-16）
// v1.03・SQL 124：曜日別の目安人数は「シフト設定」へ（オーナー 2026-10-16「設定から行くように」）。「下書き作成」→「自動作成」。色の見本をカレンダーの上に
// v1.00・SQL 122：⑧シフト（オーナーにヒアリングして決めた形 2026-10-16）。上に本日の出勤・同伴・予約、下に月のカレンダー（名前だけ・人数／目安・19:50〜20:15 の不足・予約と同伴の数）。
//   日を押すとその日の詳細（名前と出勤時刻の変更・出勤できる人の追加・出勤できない人・予約と同伴・目安人数・イベント日）。曜日別の目安人数 → 下書き作成 → 直す → 確定（マイページに出る）
let shMonth=null; const SH_TIMES=['19:50',...Array.from({length:13},(_,i)=>`${20+Math.floor(i/4)}:${String(i%4*15).padStart(2,'0')}`)] /* 2026-11-04：シフトの時刻と出勤可能時間は 19:50 と 20:00〜23:00 の15分ごと（オーナー「22時の選択肢がない」「23時まで可能。変更して全部」）。前は 19:50・20:15・20:30・20:45・21:00 だけ */;
PAGES.shift=async()=>{ const st=storeId, ed=perm('shift')==='edit', now=csNowMonth(); if(!shMonth) shMonth=csAddMonth(now,1); const m=shMonth;
  const mOpts=[csAddMonth(now,-1),now,csAddMonth(now,1),csAddMonth(now,2)];
  const head=shSwitch('shift')+`<h1>シフト <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const [tr,mr,ir]=await Promise.all([sb.rpc('admin_shift_today',{p_store:st}), sb.rpc('admin_shift_month',{p_store:st,p_month:m}), sb.rpc('admin_shift_iv',{p_store:st,p_month:m})]);
  if(page!=='shift'||storeId!==st||shMonth!==m) return;
  if(mr.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(mr.error.message)}</div>`; return; }
  const T=tr.error?null:tr.data, M=mr.data, IV=ir.error?{}:ir.data||{} /* v2.06・SQL 353：日ごとの面接の数 */, C=M.casts||[], cName=id=>C.find(c=>c.id===id)?.name||'';
  // 本日
  let today='';
  if(T){ const byT={}; (T.shifts||[]).forEach(x=>(byT[x.time]=byT[x.time]||[]).push(x.name)); const early=(T.shifts||[]).filter(x=>x.time<='20:15').length;
    const dh=(T.resv||[]).filter(r=>r.douhan), rv=(T.resv||[]).filter(r=>!r.douhan);
    today=`<div class="card"><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><b>本日 ${mdW(T.day)}</b><small class="muted">出勤 ${(T.shifts||[]).length}人・19:50〜20:15 ${early}人／${T.early}人</small></div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:16px;margin-top:8px;font-size:14px;line-height:1.7">
      <div><div class="muted" style="font-size:12px">出勤</div>${Object.keys(byT).sort().map(t=>`<div><b>${t}</b>　${byT[t].map(esc).join('・')}</div>`).join('')||'<div class="muted">確定したシフトがありません</div>'}</div>
      <div><div class="muted" style="font-size:12px">同伴</div>${dh.map(r=>`<div>${r.time}　${esc(r.name)} 様 ${r.guests}名（${resvWho(r,{noKK:rvNoKK(),mark:FX('dress',15)})}${r.vip?'・'+esc(r.vip):''}）</div>`).join('')||'<div class="muted">なし</div>'}
        <div class="muted" style="font-size:12px;margin-top:4px">予約</div>${rv.map(r=>`<div>${r.time}　${esc(r.name)} 様 ${r.guests}名（${resvWho(r,{noKK:rvNoKK()})}${r.vip?'・'+esc(r.vip):''}）</div>`).join('')||'<div class="muted">なし</div>'}</div></div></div>`; }
  // 月
  const S={}; (M.shifts||[]).forEach(x=>(S[x.day]=S[x.day]||[]).push(x)); const NG={}; (M.ng||[]).forEach(x=>(NG[x.day]=NG[x.day]||new Set()).add(x.staff_id)); const EV=new Set(M.events||[]), OFF=new Set(M.offs||[]);
  const tg=d=>M.day_targets?.[d]??M.targets?.[String(new Date(d+'T00:00:00+09:00').getDay())]??0;
  const y=Number(m.slice(0,4)), mo=Number(m.slice(5,7)), first=new Date(y,mo-1,1).getDay(), nd=new Date(y,mo,0).getDate(), iso=d=>`${m.slice(0,8)}${String(d).padStart(2,'0')}`;
  const ord=x=>C.findIndex(c=>c.id===x.staff_id);
  // v1.01・SQL 123：マスには主要メンバー（その月の出勤日数が多い子 → 在籍期間の長い子）を4人まで、残りは「他○名」（オーナー 2026-10-16）
  const mCnt={}; (M.shifts||[]).forEach(x=>{ mCnt[x.staff_id]=(mCnt[x.staff_id]||0)+1; }); const since=id=>C.find(c=>c.id===id)?.since||'9999-12-31';
  const mainOrd=(a,b)=>(mCnt[b.staff_id]||0)-(mCnt[a.staff_id]||0)||since(a.staff_id).localeCompare(since(b.staff_id))||ord(a)-ord(b);
  let cal='<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">'+WJ.map(w=>`<div class="muted" style="text-align:center;font-size:12px">${w}</div>`).join('')+'<div></div>'.repeat(first);
  for(let d=1;d<=nd;d++){ const k=iso(d);
    if(OFF.has(k)){ cal+=`<div style="border:1px solid var(--line);border-radius:8px;padding:4px 3px;min-height:96px;font-size:12px;line-height:1.5;background:var(--soft);color:var(--muted)"><b style="color:var(--ink)">${d}</b><div style="font-size:13px;margin-top:4px">休</div></div>`; continue; } // v1.07・SQL 128：お店の休み
    const L=(S[k]||[]).slice().sort((a,b)=>a.time.localeCompare(b.time)||ord(a)-ord(b)), e=L.filter(x=>x.time<='20:15').length, need=M.early?.[k]??2, R=M.resv?.[k]||[], dn=R.filter(r=>r.douhan).length;
    // v2.06・SQL 353：数は1行ずつ、言葉を先に（出勤・19:50 不足・同伴・予約・面接）。前は「予約○・同伴○」「○／○人」「19:50 不足○人」が横に並び、スマホで折れて読めなかった（オーナー 2026-11-04「面接が何人なんかキャストが何人なんか注意が何人なんかが分かんない」→ 見本 作業場/シフトのマス_案1.png）
    cal+=`<div data-shd="${k}" style="border:1px solid var(--line);border-radius:8px;padding:4px 3px;min-height:96px;font-size:12px;line-height:1.5;cursor:pointer;overflow:hidden;${EV.has(k)?'background:var(--gold-soft)':''}">
      <b>${d}</b><div style="font-size:10px;letter-spacing:-.3px;white-space:nowrap;color:var(--muted)">
        <div${L.length<tg(k)?' style="color:var(--warn);font-weight:700"':''}>出勤${L.length}${tg(k)?'/'+tg(k):''}</div>${e<need&&tg(k)>0?`<div style="color:var(--warn);font-weight:700">19:50<br>不足${need-e}人</div>`:''}
        <div style="color:var(--ok)">同伴${dn}</div><div>予約${R.length-dn}</div><div>面接${IV[k]||0}</div></div>
      <div style="font-size:11px;word-break:keep-all">${(()=>{ const DH=new Set(R.filter(r=>r.douhan).flatMap(r=>r.dh&&r.dh.length?r.dh:[r.by])) /* v1.63・SQL 265：同伴の子も */, isD=x=>DH.has(cName(x.staff_id)), BK=new Set(R.map(r=>r.black).filter(Boolean)) /* v2.15・SQL 368：月のマスにも黒ドレスのしるし（オーナー 2026-11-05「付ける」） */, bk=x=>BK.has(cName(x.staff_id))?FX('dress',11):''; const P=L.slice().sort((a,b)=>(isD(b)-isD(a))||mainOrd(a,b));
        return (P.slice(0,4).map(x=>(isD(x)?`<b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 3px">${esc(cName(x.staff_id))}</b>`:esc(cName(x.staff_id)))+bk(x))).join('・')+(P.length>4?`<span class="muted">　他${P.length-4}名</span>`:''); })()}</div></div>`; }
  cal+='</div>';
  const sub=C.filter(c=>c.submitted).length;
  $('main').innerHTML=head+today+`<div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><select id="shM" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel?csMLabel(x):x}</option>`).join('')}</select>
      <small class="muted">提出 ${sub}／${C.length}人・${M.fixed?'確定済':'確定前'}</small><span style="flex:1"></span>
      ${visible('set_shift')?'<button class="ghost sm" id="shSet">設定</button>':''}<button class="ghost sm" id="shNg">休希望</button>${ed?`${M.fixed?'':'<button class="ghost sm" id="shDr">自動作成</button>'}<button class="${M.fixed?'ghost':'primary'} sm" id="shFx">${M.fixed?'確定の取消':'確定'}</button>`:''}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--muted);margin-bottom:8px">
      <span style="background:var(--gold-soft);border:1px solid var(--line);border-radius:4px;padding:1px 6px;color:var(--ink)">イベント日</span>
      <span style="background:var(--soft);border:1px solid var(--line);border-radius:4px;padding:1px 6px">休</span>
      <b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 4px">同伴</b>
      ${Object.keys(M.targets||{}).length?'':'<button class="ghost sm" id="shGoSet">目安人数の入力（シフト設定）</button>'}</div>${cal}
    <div class="muted" style="font-size:12px;margin-top:6px">タップで詳細表示</div></div>`;
  $('shM').onchange=()=>{ shMonth=$('shM').value; PAGES.shift(); };
  $('main').querySelectorAll('[data-shd]').forEach(b=>b.onclick=()=>shiftDayEdit(st,M,b.dataset.shd,ed));
  if($('shGoSet')) $('shGoSet').onclick=()=>{ setMonth=m; go('set_shift'); };
  if($('shSet')) $('shSet').onclick=()=>{ setMonth=m; go('set_shift'); };
  if(!ed) return;
  /* v1.44：休希望（オーナー 2026-10-22「キャストからの休み希望を見れるボタンが欲しい」→ 並びは「休希望・自動作成・確定」）。提出した人を上、未提出を下 */
  $('shNg').onclick=()=>{ const by={}; (M.ng||[]).forEach(x=>(by[x.staff_id]=by[x.staff_id]||[]).push(x.day)); const pm=csAddMonth(m,-1);
    const row=c=>`<div style="display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:14px;line-height:1.6"><b style="min-width:4.5em">${esc(c.name)}</b>${c.submitted?`<span>${c.week?`週${c.week}日・`:''}出勤できない日：${(by[c.id]||[]).sort().map(d=>`${Number(d.slice(8))}（${wdJ(d)}）`).join('・')||'なし'}</span>`:'<span style="color:var(--warn)">未提出</span>'}</div>`;
    const L=C.filter(c=>c.submitted).concat(C.filter(c=>!c.submitted));
    const w=mkModal(null,`<button class="xb dx" data-k="ok" aria-label="閉じる">×</button><h2 style="margin:0">${mo}月の休み希望</h2><div class="muted" style="font-size:13px">提出 ${sub}／${C.length}人（締切 ${Number(pm.slice(5,7))}/10）</div><div style="max-height:60vh;overflow:auto">${L.map(row).join('')||'<div class="muted">キャストがいません</div>'}</div>`);
    w.querySelector('[data-k=ok]').onclick=()=>w.remove(); };
  if($('shDr')) $('shDr').onclick=guard($('shDr'),async()=>{ if(!await uiConfirm(`${mo}月のシフトを自動作成しますか？\n希望出勤日数・出勤できない日・目安人数から作成します。今の${mo}月のシフトは作り直しになります`)) return; const q=await rpc('admin_shift_draft',{p_store:st,p_month:m}); if(!q.ok) return; toast(`自動作成しました（${q.data}件）`); PAGES.shift(); });
  $('shFx').onclick=guard($('shFx'),async()=>{ const fx=!M.fixed; if(!await uiConfirm(fx?`${mo}月のシフトを確定しますか？\nマイページに表示します`:`${mo}月のシフトの確定を取り消しますか？\nマイページに表示しなくなります`)) return; const q=await rpc('admin_shift_fix',{p_store:st,p_month:m,p_fix:fx}); if(!q.ok) return; toast(fx?'確定しました':'確定を取り消しました'); PAGES.shift(); }); };
// 日の詳細（出勤の名前と時刻の変更・出勤できる人の追加・出勤できない人・予約と同伴・目安人数・イベント日）
function shiftDayEdit(st,M,day,ed){ const C=M.casts||[], x=new Date(day+'T00:00:00+09:00');
  const L=(M.shifts||[]).filter(s=>s.day===day), on=new Set(L.map(s=>s.staff_id)), ng=new Set((M.ng||[]).filter(n=>n.day===day).map(n=>n.staff_id)), R=M.resv?.[day]||[];
  const canAdd=C.filter(c=>!on.has(c.id)&&!ng.has(c.id)), tgv=M.day_targets?.[day]??'', ev=(M.events||[]).includes(day);
  const box=mkModal(null,`<button class="xb dx" data-x aria-label="閉じる">×</button><div style="display:flex;gap:8px;align-items:baseline"><h2 style="margin:0">${mdW(day)}</h2><small class="muted">出勤 ${L.length}人</small></div>
    ${ed?`<div style="display:flex;gap:12px;align-items:center;margin-top:8px;flex-wrap:wrap"><label style="display:flex;gap:6px;align-items:center;margin:0">目安人数<input type="number" inputmode="numeric" min="0" id="sdT" value="${tgv}" placeholder="曜日別" style="width:80px;text-align:center"></label><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="sdE" ${ev?'checked':''} style="width:auto">イベント日</label><button class="ghost sm" id="sdS">保存</button></div>`:''}
    <div class="muted" style="font-size:12px;margin-top:10px">出勤</div>
    ${L.sort((a,b)=>a.time.localeCompare(b.time)).map(s=>{ const c=C.find(z=>z.id===s.staff_id)||{}; return `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding:5px 0"><span>${esc(c.name||'')}${rkTag(c.rank)}${c.daily?' <small class="muted">日給</small>':''}</span>${ed?`<select data-sdt="${s.staff_id}" style="width:auto"><option value="">出勤なし</option>${(SH_TIMES.includes(s.time)?SH_TIMES:[s.time,...SH_TIMES]).map(t=>`<option ${t===s.time?'selected':''}>${t}</option>`).join('')}</select>`:`<b>${s.time}</b>`}</div>`; }).join('')||'<div class="muted">なし</div>'}
    ${ed?`<div class="muted" style="font-size:12px;margin-top:10px">出勤できる人（押すと追加）</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${canAdd.map(c=>`<button class="ghost sm" data-sda="${c.id}">${esc(c.name)}${rkTag(c.rank)}${c.week?` <small class="muted">週${c.week}</small>`:''}${c.earliest?` <small class="muted">${c.earliest}〜</small>`:''}</button>`).join('')||'<span class="muted">なし</span>'}</div>`:''}
    <div class="muted" style="font-size:12px;margin-top:10px">出勤できない日</div><div>${[...ng].map(id=>esc(C.find(c=>c.id===id)?.name||'')).join('・')||'<span class="muted">なし</span>'}</div>
    <div class="muted" style="font-size:12px;margin-top:10px">予約・同伴</div>${R.map(r=>`<div style="font-size:14px">${r.time}　${esc(r.name)} 様 ${r.guests}名（${resvWho(r,{noKK:rvNoKK(),mark:FX('dress',15)})}${r.vip?'・'+esc(r.vip):''}）</div>`).join('')||'<div class="muted">なし</div>'}`);
  let changed=false; const close=()=>{ box.remove(); if(changed) PAGES.shift(); }; box.querySelector('[data-x]').onclick=close;
  if(!ed) return;
  box.querySelectorAll('[data-sdt]').forEach(sel=>sel.onchange=async()=>{ const q=await rpc('admin_shift_set',{p_store:st,p_staff:sel.dataset.sdt,p_day:day,p_time:sel.value||null}); if(!q.ok) return; changed=true;
    /* v1.75：手元の M.shifts も直す（出勤なしにした後に「追加」で開き直すと、前の出勤が残って見えた。点検 2026-10-30） */
    M.shifts=(M.shifts||[]).filter(s=>!(s.staff_id===sel.dataset.sdt&&s.day===day)).concat(sel.value?[{staff_id:sel.dataset.sdt,day,time:sel.value}]:[]);
    toast(sel.value?`${sel.value} にしました`:'出勤なしにしました'); });
  box.querySelectorAll('[data-sda]').forEach(b=>b.onclick=guard(b,async()=>{ /* v1.75：2回押しで2回送らない */ const c=C.find(z=>z.id===b.dataset.sda); const t=c.daily?'19:50':(c.earliest&&c.earliest>'20:30'?c.earliest:(c.earliest||'20:30')); const q=await rpc('admin_shift_set',{p_store:st,p_staff:c.id,p_day:day,p_time:t}); if(!q.ok) return; changed=true; box.remove(); M.shifts=(M.shifts||[]).concat([{staff_id:c.id,day,time:t}]); shiftDayEdit(st,M,day,ed); }));
  box.querySelector('#sdS').onclick=async()=>{ const v=box.querySelector('#sdT').value; const q=await rpc('admin_shift_day_save',{p_store:st,p_day:day,p_count:v===''?null:Number(v),p_event:box.querySelector('#sdE').checked}); if(!q.ok) return; changed=true; toast('保存しました'); }; }
