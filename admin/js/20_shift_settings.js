// ---------- シフト設定（目安人数（曜日別・日別）・定休日・祝日） ----------
// v1.03・SQL 124：シフト設定（曜日別の目安人数を店・月ごとに。日ごとの目安はシフトのカレンダーで日を押して変更）。v1.04・SQL 125：イベント日の登録も（オーナー 2026-10-16）
let setMonth=null;
// v1.07：日本の祝日（シフト設定のカレンダーに「祝」と出すだけ。休にするかは押して決める）
function jpHolidays(y){ const H=new Set(), k=(m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, nthMon=(m,n)=>{ const f=new Date(y,m-1,1).getDay(); return 1+((8-f)%7)+(n-1)*7; };
  [[1,1],[2,11],[2,23],[4,29],[5,3],[5,4],[5,5],[8,11],[11,3],[11,23]].forEach(([m,d])=>H.add(k(m,d)));
  H.add(k(1,nthMon(1,2))); H.add(k(7,nthMon(7,3))); H.add(k(9,nthMon(9,3))); H.add(k(10,nthMon(10,2)));
  const q=Math.floor((y-1980)/4); H.add(k(3,Math.floor(20.8431+0.242194*(y-1980)-q))); H.add(k(9,Math.floor(23.2488+0.242194*(y-1980)-q)));
  const ds=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  for(let d=new Date(y,8,1);d.getMonth()===8;d.setDate(d.getDate()+1)){ const a=new Date(d), b=new Date(d); a.setDate(a.getDate()-1); b.setDate(b.getDate()+1); if(!H.has(ds(d))&&d.getDay()!==0&&H.has(ds(a))&&H.has(ds(b))) H.add(ds(d)); } // 国民の休日
  [...H].sort().forEach(x=>{ const d=new Date(x+'T00:00:00'); if(d.getDay()===0){ do d.setDate(d.getDate()+1); while(H.has(ds(d))); H.add(ds(d)); } }); // 振替休日
  return H; }
let ssMode='ev';
// v1.07・SQL 128：定休日（毎週）と、日ごとの休・営業（祝日・年末年始・定休日でも営業する日）。カレンダーは「イベント」「休」を選んで日を押す（オーナー 2026-10-16）
document.addEventListener('click',async e=>{ if(e.target&&e.target.id==='ssBack'){ if(!await leaveOk()) return; go('shift'); } }); // v1.21：シフト設定から シフトに戻る
PAGES.set_shift=async()=>{ const st=storeId, ed=perm('set_shift')==='edit'||perm('shift')==='edit', now=csNowMonth(); if(!setMonth) setMonth=csAddMonth(now,1); const m=setMonth;
  const head=`<div class="row" style="margin-bottom:12px;align-items:center"><button class="ghost" id="ssBack">← シフト</button><h1 style="margin:0">シフト設定 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1></div>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const [r,mr,dr]=await Promise.all([sb.rpc('admin_shift_settings_get',{p_store:st,p_month:m}),sb.rpc('admin_meeting_get',{p_store:st,p_month:m}),sb.rpc('admin_shift_day_targets',{p_store:st,p_month:m})]); if(page!=='set_shift'||storeId!==st||setMonth!==m) return;
  if(r.error||dr.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc((r.error||dr.error).message)}</div>`; return; }
  const DT=dr.data||{}; /* SQL 460：日ごとの目安人数 */
  const MT=mr.error?null:mr.data, MD=new Set(MT?.days||[]), hm=v=>v?String(v).replace(/^0(\d)/,'$1'):''; // v1.74・SQL 287：ミーティング（月初の営業日2日・時間帯は店で1つ）
  const T=r.data?.targets||{}, EVs=new Set(r.data?.events||[]), OFF=new Set(r.data?.offs||[]), DOW=new Set(r.data?.off_dows||[]), opts=[now,csAddMonth(now,1),csAddMonth(now,2),csAddMonth(now,3)];
  const y=Number(m.slice(0,4)), mo=Number(m.slice(5,7)), first=new Date(y,mo-1,1).getDay(), nd=new Date(y,mo,0).getDate(), iso=d=>`${m.slice(0,8)}${String(d).padStart(2,'0')}`, HOL=jpHolidays(y);
  const bx='border:1px solid var(--line);border-radius:6px;padding:6px 0;font:inherit;font-size:14px;line-height:1.25';
  const dOff=k=>OFF.has(k)||DOW.has(new Date(k+'T00:00:00').getDay()), dVal=k=>DT[k]??T[String(new Date(k+'T00:00:00').getDay())]??'';
  /* 2026-11-12 目安人数は日ごと（現場の要望・オーナー「設定を日付のカレンダーに」）。曜日別はまとめて入力する欄（変更するとその曜日の日に入る） */
  $('main').innerHTML=head+`<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>目安人数</b><select id="ssM" style="width:auto">${opts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel(x)}</option>`).join('')}</select></div>
    <div class="muted" style="font-size:12px;margin-top:12px">曜日別</div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;margin-top:4px;max-width:560px">${WD.map((w,i)=>`<label style="text-align:center">${w}<input type="number" inputmode="numeric" min="0" data-ss="${i}" value="${DOW.has(i)?'':T[String(i)]??''}" ${ed&&!DOW.has(i)?'':'disabled'} ${DOW.has(i)?'placeholder="休"':''} style="width:100%;text-align:center"></label>`).join('')}</div>
    <div class="muted" style="font-size:12px;margin-top:14px">日別</div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:4px;max-width:560px">${WD.map(w=>`<div class="muted" style="text-align:center;font-size:12px">${w}</div>`).join('')}${'<div></div>'.repeat(first)}${Array.from({length:nd},(_,i)=>{ const k=iso(i+1), off=dOff(k); return `<label style="text-align:center;font-size:12px;${off?'color:var(--muted)':''}">${i+1}<input type="number" inputmode="numeric" min="0" data-sd="${k}" data-sw="${new Date(k+'T00:00:00').getDay()}" value="${off?'':dVal(k)}" ${ed&&!off?'':'disabled'} ${off?'placeholder="休"':''} style="width:100%;text-align:center"></label>`; }).join('')}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">曜日別を変更すると、その曜日の日にまとめて入力します。シフトの自動作成で、日別の人数まで割り振ります</div>
    ${ed?'<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="primary sm" id="ssS">保存</button></div>':''}</div>
    <div class="card"><b>定休日</b>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:10px;max-width:560px">${WD.map((w,i)=>{ const on=DOW.has(i); return `<button type="button" ${ed?`data-dw="${i}"`:'disabled'} style="${bx};background:${on?'var(--soft)':'var(--card)'};color:${on?'var(--muted)':'var(--ink)'};${on?'font-weight:700':''}">${w}<small style="display:block;font-size:11px">${on?'休':'&nbsp;'}</small></button>`; }).join('')}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">押すと定休日の登録・取消（毎週）</div></div>
    ${MT?`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>ミーティング</b>${ed?'<button class="primary sm" id="mtS">保存</button>':''}</div>
    ${[['出勤前','pre','17:00','19:30'],['退勤後','post','1:00','2:00']].map(([n,k,p1,p2])=>`<div style="display:flex;gap:8px;align-items:center;margin-top:10px"><span style="width:4.5em">${n}</span><input id="mt_${k}_f" value="${hm(MT[k+'_from'])}" placeholder="${p1}" inputmode="numeric" ${ed?'':'disabled'} style="width:6em">〜<input id="mt_${k}_t" value="${hm(MT[k+'_to'])}" placeholder="${p2}" inputmode="numeric" ${ed?'':'disabled'} style="width:6em"></div>`).join('')}
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px"><span style="width:4.5em">1枠</span><input id="mt_slot" type="number" inputmode="numeric" min="10" max="120" value="${MT.slot_min||30}" ${ed?'':'disabled'} style="width:6em">分</div>
    <div class="muted" style="font-size:13px;margin-top:8px">月初の営業日2日を自動で選択します。申請の締切は前月の末日です</div></div>`:''}
    <div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${mo}月</b>${ed?`<span style="display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden">${[['ev','イベント'],['off','休'],...(MT?[['mt','ミーティング']]:[])].map(([k,n])=>`<button type="button" data-md="${k}" style="border:0;border-radius:0;height:34px;padding:0 14px;font:inherit;font-size:14px;background:${ssMode===k?'var(--pri)':'var(--card)'};color:${ssMode===k?'#fff':'var(--ink)'};${ssMode===k?'font-weight:700':''}">${n}</button>`).join('')}</span>`:''}<small class="muted">イベント ${EVs.size}日・休 ${OFF.size}日${MT?`・ミーティング ${MD.size}日`:''}</small></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:10px;max-width:560px">${WD.map(w=>`<div class="muted" style="text-align:center;font-size:12px">${w}</div>`).join('')}${'<div></div>'.repeat(first)}${Array.from({length:nd},(_,i)=>{ const k=iso(i+1), off=OFF.has(k), ev=EVs.has(k), mt=MD.has(k); return `<button type="button" ${ed?`data-ev="${k}"`:'disabled'} style="${bx};background:${off?'var(--soft)':ev?'var(--gold-soft)':'var(--card)'};color:${off?'var(--muted)':'var(--ink)'};${off||ev||mt?'font-weight:700;':''}${mt?'border:2px solid var(--pri);':''}">${i+1}<small style="display:block;font-size:10px;font-weight:400;white-space:nowrap">${off?'休':mt?'ミーティング':HOL.has(k)?'祝':'&nbsp;'}</small></button>`; }).join('')}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">「イベント」「休」${MT?'「ミーティング」':''}を選んで日を押すと登録・取消（定休日の営業も「休」で押す）。祝＝祝日</div></div>`;
  $('ssM').onchange=()=>{ setMonth=$('ssM').value; PAGES.set_shift(); };
  if(!ed) return;
  $('main').querySelectorAll('[data-ss]').forEach(x=>x.oninput=()=>$('main').querySelectorAll(`input[data-sd][data-sw="${x.dataset.ss}"]:not(:disabled)`).forEach(y=>y.value=x.value)); /* 曜日別 → その曜日の日へ */
  $('main').querySelectorAll('[data-md]').forEach(b=>b.onclick=()=>{ ssMode=b.dataset.md; PAGES.set_shift(); });
  $('main').querySelectorAll('[data-dw]').forEach(b=>b.onclick=guard(b,async()=>{ const i=Number(b.dataset.dw), on=!DOW.has(i); const q=await rpc('admin_shift_offdow_set',{p_store:st,p_dow:i,p_on:on}); if(!q.ok) return; toast(on?`${WD[i]}曜を定休日にしました`:`${WD[i]}曜の定休日を取り消しました`); PAGES.set_shift(); }));
  $('main').querySelectorAll('[data-ev]').forEach(b=>b.onclick=guard(b,async()=>{ const k=b.dataset.ev;
    if(ssMode==='off'){ const on=!OFF.has(k); const q=await rpc('admin_shift_off_set',{p_store:st,p_day:k,p_off:on}); if(!q.ok) return; toast(on?`${md(k)} を休にしました`:`${md(k)} を営業にしました`); PAGES.set_shift(); return; }
    if(ssMode==='mt'){ const on=!MD.has(k); const q=await rpc('admin_meeting_day_set',{p_store:st,p_day:k,p_on:on}); if(!q.ok) return; toast(on?`${md(k)} をミーティング日にしました`:`${md(k)} のミーティング日を取り消しました`); PAGES.set_shift(); return; }
    if(OFF.has(k)){ await uiAlert(`${md(k)} は休の日です`); return; }
    const on=!EVs.has(k); const q=await rpc('admin_shift_event_set',{p_store:st,p_day:k,p_on:on}); if(!q.ok) return; toast(on?`${md(k)} をイベント日にしました`:`${md(k)} のイベント日を取り消しました`); PAGES.set_shift(); }));
  if($('mtS')) $('mtS').onclick=guard($('mtS'),async()=>{ const v=id=>$(id).value.trim()||null; const q=await rpc('admin_meeting_save',{p_store:st,p_pre_from:v('mt_pre_f'),p_pre_to:v('mt_pre_t'),p_post_from:v('mt_post_f'),p_post_to:v('mt_post_t'),p_slot:Number($('mt_slot').value)||null}); if(!q.ok) return; toast('保存しました'); PAGES.set_shift(); });
  $('ssS').onclick=guard($('ssS'),async()=>{ const v=[...$('main').querySelectorAll('[data-ss]')].map((x,i)=>DOW.has(i)?(x.value===''?Number(T[String(i)]??0):Number(x.value)):(x.value===''?null:Number(x.value))); if(v.some(x=>x==null||!(x>=0))){ await uiAlert('目安人数を入力してください'); return; }
    const days={}; for(const x of $('main').querySelectorAll('input[data-sd]:not(:disabled)')){ if(x.value==='') continue; const n=Number(x.value); if(!(n>=0&&n<=99)){ await uiAlert(`${md(x.dataset.sd)} の目安人数を確認してください`); return; } days[x.dataset.sd]=n; }
    const q=await rpc('admin_shift_targets_save',{p_store:st,p_month:m,p_counts:v}); if(!q.ok) return;
    const q2=await rpc('admin_shift_day_targets_save',{p_store:st,p_month:m,p_days:days}); if(!q2.ok) return; toast('保存しました'); PAGES.set_shift(); }); };
