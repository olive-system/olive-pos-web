// ---------- POS設定 v0.22・SQL 062：料金（メニュー以外）はここだけで変える。POS では見るだけ ----------
// HC・BC は伝票を立ち上げた時に人数分つける。金額だけ選ぶ（伝票の名前は HC／BC）。HC は係にバック100%（振分できる）、BC は誰にもバックなし
const HCBC_OPTS=[[null,'付けない'],...Array.from({length:10},(_,i)=>[(i+1)*1000,((i+1)*1000).toLocaleString('ja-JP')+'円'])];
const vipRow=(t,ed,dis)=>`<tr data-tb="${t.id}"><td>${esc(t.name)}</td><td><input inputmode="numeric" data-v="set" value="${esc(String(t.vip_set_fee||0))}" ${dis}></td><td><input inputmode="numeric" data-v="ext" value="${esc(String(t.vip_ext_fee||0))}" ${dis}></td>${ed?'<td style="width:1%"><button class="ghost sm" data-vrm aria-label="外す">×</button></td>':''}</tr>`;
// v0.97・SQL 118：お知らせ（LINEマイページに出す。補助として、過去のお知らせの置き場所。オーナー 2026-10-16）。掲載のたびに「LINE 通知」を選べる。キャストが「確認」を押すと確認済み
// v1.76・SQL 302：宛先（全員／黒服のみ）・店舗（銀座／広島／両店。上の店のプルダウンとは別）・送信時刻（今すぐ／時刻指定・15分ごと）（オーナー 2026-10-30）
//   黒服のみ＝LINE だけ（本文まで送る・マイページには載せない）。時刻指定＝送信予定に入り、15分ごとの cron が送る（全員は指定の時刻に掲載と LINE）。送信前は編集・取消
let ntEdit=null, ntSched=null;
const NT_STORE={ginza:'銀座',hiroshima:'広島'}, ntStoreName=s=>NT_STORE[s?.code]||s?.name||'';
const ntWhen=a=>{ const d=new Date(new Date(a).getTime()+9*3600e3); return `${d.getUTCMonth()+1}/${d.getUTCDate()}（${'日月火水木金土'[d.getUTCDay()]}）${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`; };
PAGES.notice=async()=>{ const st=storeId, ed=perm('notice')==='edit';
  const head=`<h1>お知らせ <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const [r,rs]=await Promise.all([sb.rpc('admin_notice_list',{p_store:st}),sb.rpc('admin_notice_sched_list',{p_store:st})]); if(page!=='notice'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(r.error.message)}</div>`; return; }
  const L=r.data||[], E=ntEdit&&L.find(x=>x.id===ntEdit)||null; if(!E) ntEdit=null;
  const SL=rs.error?[]:(rs.data||[]), SE=ntSched&&SL.find(x=>x.id===ntSched)||null; if(!SE) ntSched=null;
  const day=a=>{ const d=new Date(new Date(a).getTime()+9*3600e3); return `${d.getUTCMonth()+1}/${d.getUTCDate()}`; };
  const S=stores(), sOpt=[...S.map(s=>[s.id,ntStoreName(s)]),...(S.length>1?[['all','両店']]:[])];
  const sv0=SE?(SE.stores.length>1?'all':SE.stores[0]):st;
  // 送信時刻：今日から60日・15分ごと（はじめは15分より先の15分の区切り）
  const now=Date.now(), first=new Date(Math.ceil((now+15*60e3)/(15*60e3))*15*60e3), j0=new Date(first.getTime()+9*3600e3);
  const sa=SE?new Date(new Date(SE.send_at).getTime()+9*3600e3):j0, ymd=d=>d.toISOString().slice(0,10), hm=d=>d.toISOString().slice(11,16);
  const dOpts=Array.from({length:60},(_,i)=>{ const d=new Date(now+9*3600e3+i*864e5); return [ymd(d),`${d.getUTCMonth()+1}/${d.getUTCDate()}（${'日月火水木金土'[d.getUTCDay()]}）`]; });
  const tOpts=Array.from({length:96},(_,i)=>`${String(Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`);
  const sel=(id,opts,v)=>`<select id="${id}" style="width:auto">${opts.map(([k,l])=>`<option value="${esc(k)}" ${k===v?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  const area=v=>`<textarea id="ntB" rows="6" maxlength="2000" style="width:100%;font:inherit;font-size:16px;line-height:1.6;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">${esc(v||'')}</textarea>`;
  const row=(l,h)=>`<div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap"><span class="muted" style="font-size:13px;width:5em">${l}</span>${h}</div>`;
  const form=!ed?'':E?`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:8px">お知らせの修正</div>
      <label>タイトル<input id="ntT" maxlength="60" value="${esc(E.title)}"></label>
      <label style="display:block;margin-top:8px">本文${area(E.body)}</label>
      <div class="fend" style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="ntP" style="width:auto">LINE 通知</label><span style="flex:1"></span><button class="ghost sm" id="ntX">キャンセル</button><button class="primary sm" id="ntS">保存</button></div></div>`
    :`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:4px" id="ntLead"></div>
      ${row('宛先',sel('ntTo',[['all','全員'],['hall','黒服のみ']],SE?.target||'all'))}
      ${row('店舗',sel('ntSt',sOpt,sv0))}
      <label style="margin-top:8px">タイトル<input id="ntT" maxlength="60" value="${esc(SE?.title||'')}"></label>
      <label style="display:block;margin-top:8px">本文${area(SE?.body)}</label>
      ${row('送信時刻',sel('ntW',SE?[['at','時刻指定']]:[['now','今すぐ'],['at','時刻指定']],SE?'at':'now')+`<span id="ntAt" style="display:${SE?'inline-flex':'none'};gap:6px">${sel('ntD',dOpts,ymd(sa))}${sel('ntH',tOpts.map(t=>[t,t]),hm(sa))}</span>`)}
      <div class="fend" style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><label id="ntPl" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="ntP" ${!SE||SE.push?'checked':''} style="width:auto">LINE 通知</label><span style="flex:1"></span>${SE?'<button class="ghost sm" id="ntX">キャンセル</button>':''}<button class="primary sm" id="ntS"></button></div></div>`;
  const stLbl=a=>a.length>1?'両店':ntStoreName(S.find(s=>s.id===a[0])||{});
  const sched=SL.length?`<div class="card"><b>送信予定</b>${SL.map(x=>`<div style="display:flex;gap:10px;align-items:center;border-top:1px solid var(--line);padding:6px 0;margin-top:6px;flex-wrap:wrap">
      <span style="width:9.5em;white-space:nowrap">${ntWhen(x.send_at)}</span><span style="width:4.5em;white-space:nowrap">${x.target==='hall'?'黒服のみ':'全員'}</span><span style="width:2.5em;white-space:nowrap">${esc(stLbl(x.stores))}</span>
      <b style="flex:1;min-width:8em">${esc(x.title)}</b>${ed?`<button class="ghost sm" data-se="${x.id}">編集</button><button class="ghost sm" data-sc="${x.id}">取消</button>`:''}</div>`).join('')}</div>`:'';
  const list=L.map(x=>`<div class="card"><div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><b>${esc(x.title)}</b> <small class="muted">${day(x.at)} 掲載${x.updated_at?'（修正済み）':''}${x.pushed?`・LINE 通知 ${x.pushed}人`:''}</small></div>
      ${ed?`<button class="ghost sm" data-ne="${x.id}">編集</button><button class="ghost sm" data-nd="${x.id}">削除</button>`:''}</div>
    ${x.body?`<div style="white-space:pre-wrap;margin-top:6px;font-size:14px;line-height:1.6">${esc(x.body)}</div>`:''}
    <div class="muted" style="font-size:13px;margin-top:8px">確認済み ${x.read}人／未確認 ${x.unread.length}人${x.unread.length?`<br>未確認：${x.unread.map(esc).join('・')}`:''}</div></div>`).join('')||'<div class="card muted">お知らせはありません</div>';
  $('main').innerHTML=head+form+sched+list;
  if(!ed) return;
  if($('ntX')) $('ntX').onclick=()=>{ ntEdit=null; ntSched=null; PAGES.notice(); };
  $('main').querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>{ ntEdit=b.dataset.ne; ntSched=null; PAGES.notice(); });
  $('main').querySelectorAll('[data-se]').forEach(b=>b.onclick=()=>{ ntSched=b.dataset.se; ntEdit=null; PAGES.notice(); });
  $('main').querySelectorAll('[data-nd]').forEach(b=>b.onclick=guard(b,async()=>{ const x=L.find(z=>z.id===b.dataset.nd); if(!await uiConfirm(`「${x.title}」を削除しますか？`,'削除','danger')) return;
    const q=await rpc('admin_notice_delete',{p_store:st,p_id:x.id}); if(!q.ok) return; toast('削除しました'); if(ntEdit===x.id) ntEdit=null; PAGES.notice(); }));
  $('main').querySelectorAll('[data-sc]').forEach(b=>b.onclick=guard(b,async()=>{ const x=SL.find(z=>z.id===b.dataset.sc); if(!await uiConfirm(`「${x.title}」の予約を取り消しますか？\n送信時刻：${ntWhen(x.send_at)}`,'取消','danger')) return;
    const q=await rpc('admin_notice_sched_cancel',{p_id:x.id}); if(!q.ok) return; toast('取り消しました'); if(ntSched===x.id) ntSched=null; PAGES.notice(); }));
  if(E){ $('ntS').onclick=guard($('ntS'),async()=>{ const t=$('ntT').value.trim(), b=$('ntB').value.trim(), push=$('ntP').checked; if(!t){ await uiAlert('タイトルを入力してください'); return; }
      if(!await uiConfirm(`「${t}」を保存しますか？${push?'\n連携したキャスト全員に LINE で通知します':''}`)) return;
      const x=await rpc('admin_notice_save',{p_store:st,p_id:E.id,p_title:t,p_body:b,p_push:push}); if(!x.ok) return;
      toast(`保存しました${push?`（LINE 通知 ${x.data.pushed}人）`:''}`); ntEdit=null; PAGES.notice(); });
    return; }
  const sync=()=>{ const hall=$('ntTo').value==='hall', at=$('ntW').value==='at'; $('ntAt').style.display=at?'inline-flex':'none'; $('ntPl').style.display=hall?'none':'flex';
    $('ntS').textContent=SE?'保存':at?'予約':hall?'送信':'掲載'; $('ntLead').textContent=SE?'送信予定の修正':hall?'黒服の LINE に送信します（マイページには掲載しません）':'LINEマイページの「お知らせ」に掲載します'; };
  ['ntTo','ntW'].forEach(k=>$(k).onchange=sync); sync();
  $('ntS').onclick=guard($('ntS'),async()=>{ const t=$('ntT').value.trim(), b=$('ntB').value.trim(), hall=$('ntTo').value==='hall', at=$('ntW').value==='at', push=hall||$('ntP').checked;
    if(!t){ await uiAlert('タイトルを入力してください'); return; }
    const sv=$('ntSt').value, ids=sv==='all'?S.map(s=>s.id):[sv], sl=sv==='all'?'両店':ntStoreName(S.find(s=>s.id===sv)), whenIso=at?`${$('ntD').value}T${$('ntH').value}:00+09:00`:null;
    if(at&&new Date(whenIso).getTime()<=Date.now()){ await uiAlert('過去の時刻は指定できません'); return; }
    const who=hall?'黒服のみ':'全員', lineMsg=hall?'連携した黒服全員に LINE で送信します':push?'連携したキャスト全員に LINE で通知します':'';
    const msg=at?`「${t}」を${SE?'保存':'予約'}しますか？\n送信時刻：${ntWhen(whenIso)}\n宛先：${who}\n店舗：${sl}${lineMsg?'\n'+lineMsg:''}`
      :`「${t}」を${hall?'送信':'掲載'}しますか？\n店舗：${sl}${lineMsg?'\n'+lineMsg:''}`;
    if(!await uiConfirm(msg)) return;
    const x=await rpc('admin_notice_send',{p_target:hall?'hall':'all',p_stores:ids,p_title:t,p_body:b,p_push:push,p_send_at:whenIso,p_sched:SE?SE.id:null}); if(!x.ok) return;
    toast(at?(SE?'保存しました':'予約しました'):`${hall?'送信':'掲載'}しました${push?`（LINE ${hall?'':'通知 '}${x.data.pushed}人）`:''}`); ntSched=null; PAGES.notice(); }); };
// v1.06・SQL 127：目安より少ない日は「3／6人」を赤（オーナー 2026-10-16「足りない日は 3/6 の部分を赤くして警告」）
// v1.05・SQL 126：同伴の申請があればシフトに自動で入るので、赤の札（同伴なのにシフトなし）は外した。色の見本は実際と同じ形（オーナー 2026-10-16）
// v1.03・SQL 124：曜日別の目安人数は「シフト設定」へ（オーナー 2026-10-16「設定から行くように」）。「下書き作成」→「自動作成」。色の見本をカレンダーの上に
// v1.00・SQL 122：⑧シフト（オーナーにヒアリングして決めた形 2026-10-16）。上に本日の出勤・同伴・予約、下に月のカレンダー（名前だけ・人数／目安・19:50〜20:15 の不足・予約と同伴の数）。
//   日を押すとその日の詳細（名前と出勤時刻の変更・出勤できる人の追加・出勤できない人・予約と同伴・目安人数・イベント日）。曜日別の目安人数 → 下書き作成 → 直す → 確定（マイページに出る）
let shMonth=null; const SH_TIMES=['19:50','20:15','20:30','20:45','21:00'], SH_WD=['日','月','火','水','木','金','土'];
PAGES.shift=async()=>{ const st=storeId, ed=perm('shift')==='edit', now=csNowMonth(); if(!shMonth) shMonth=csAddMonth(now,1); const m=shMonth;
  const mOpts=[csAddMonth(now,-1),now,csAddMonth(now,1),csAddMonth(now,2)];
  const head=shSwitch('shift')+`<h1>シフト <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const [tr,mr]=await Promise.all([sb.rpc('admin_shift_today',{p_store:st}), sb.rpc('admin_shift_month',{p_store:st,p_month:m})]);
  if(page!=='shift'||storeId!==st||shMonth!==m) return;
  if(mr.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(mr.error.message)}</div>`; return; }
  const T=tr.error?null:tr.data, M=mr.data, C=M.casts||[], cName=id=>C.find(c=>c.id===id)?.name||'';
  const md=d=>{ const x=new Date(d+'T00:00:00+09:00'); return `${x.getMonth()+1}/${x.getDate()}（${SH_WD[x.getDay()]}）`; };
  // 本日
  let today='';
  if(T){ const byT={}; (T.shifts||[]).forEach(x=>(byT[x.time]=byT[x.time]||[]).push(x.name)); const early=(T.shifts||[]).filter(x=>x.time<='20:15').length;
    const dh=(T.resv||[]).filter(r=>r.douhan), rv=(T.resv||[]).filter(r=>!r.douhan);
    today=`<div class="card"><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><b>本日 ${md(T.day)}</b><small class="muted">出勤 ${(T.shifts||[]).length}人・19:50〜20:15 ${early}人／${T.early}人</small></div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:16px;margin-top:8px;font-size:14px;line-height:1.7">
      <div><div class="muted" style="font-size:12px">出勤</div>${Object.keys(byT).sort().map(t=>`<div><b>${t}</b>　${byT[t].map(esc).join('・')}</div>`).join('')||'<div class="muted">確定したシフトがありません</div>'}</div>
      <div><div class="muted" style="font-size:12px">同伴</div>${dh.map(r=>`<div>${r.time}　${esc(r.name)} 様 ${r.guests}名（${esc((r.dh&&r.dh.length?r.dh:[r.by]).join('・'))}${r.vip?'・'+esc(r.vip):''}）</div>`).join('')||'<div class="muted">なし</div>'}
        <div class="muted" style="font-size:12px;margin-top:4px">予約</div>${rv.map(r=>`<div>${r.time}　${esc(r.name)} 様 ${r.guests}名（${rvNoKK()?'':`${KL} ${esc(r.kakari||'—')}・`}誘客 ${esc(r.by)}${r.vip?'・'+esc(r.vip):''}）</div>`).join('')||'<div class="muted">なし</div>'}</div></div></div>`; }
  // 月
  const S={}; (M.shifts||[]).forEach(x=>(S[x.day]=S[x.day]||[]).push(x)); const NG={}; (M.ng||[]).forEach(x=>(NG[x.day]=NG[x.day]||new Set()).add(x.staff_id)); const EV=new Set(M.events||[]), OFF=new Set(M.offs||[]);
  const tg=d=>M.day_targets?.[d]??M.targets?.[String(new Date(d+'T00:00:00+09:00').getDay())]??0;
  const y=Number(m.slice(0,4)), mo=Number(m.slice(5,7)), first=new Date(y,mo-1,1).getDay(), nd=new Date(y,mo,0).getDate(), iso=d=>`${m.slice(0,8)}${String(d).padStart(2,'0')}`;
  const ord=x=>C.findIndex(c=>c.id===x.staff_id);
  // v1.01・SQL 123：マスには主要メンバー（その月の出勤日数が多い子 → 在籍期間の長い子）を4人まで、残りは「他○名」（オーナー 2026-10-16）
  const mCnt={}; (M.shifts||[]).forEach(x=>{ mCnt[x.staff_id]=(mCnt[x.staff_id]||0)+1; }); const since=id=>C.find(c=>c.id===id)?.since||'9999-12-31';
  const mainOrd=(a,b)=>(mCnt[b.staff_id]||0)-(mCnt[a.staff_id]||0)||since(a.staff_id).localeCompare(since(b.staff_id))||ord(a)-ord(b);
  let cal='<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">'+SH_WD.map(w=>`<div class="muted" style="text-align:center;font-size:12px">${w}</div>`).join('')+'<div></div>'.repeat(first);
  for(let d=1;d<=nd;d++){ const k=iso(d);
    if(OFF.has(k)){ cal+=`<div style="border:1px solid var(--line);border-radius:8px;padding:5px 6px;min-height:96px;font-size:12px;line-height:1.5;background:var(--soft);color:var(--muted)"><b style="color:var(--ink)">${d}</b><div style="font-size:13px;margin-top:4px">休</div></div>`; continue; } // v1.07・SQL 128：お店の休み
    const L=(S[k]||[]).slice().sort((a,b)=>a.time.localeCompare(b.time)||ord(a)-ord(b)), e=L.filter(x=>x.time<='20:15').length, need=M.early?.[k]??2, R=M.resv?.[k]||[], dn=R.filter(r=>r.douhan).length;
    cal+=`<div data-shd="${k}" style="border:1px solid var(--line);border-radius:8px;padding:5px 6px;min-height:96px;font-size:12px;line-height:1.5;cursor:pointer;overflow:hidden;${EV.has(k)?'background:var(--gold-soft)':''}">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b>${d}</b>${R.length?`<small style="color:var(--muted);font-size:11px">予約${R.length-dn}${dn?'・同伴'+dn:''}</small>`:''}</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;column-gap:6px;font-size:11px;color:var(--muted);white-space:nowrap">${L.length<tg(k)?`<b style="color:var(--warn)">${L.length}／${tg(k)}人</b>`:`<span>${L.length}／${tg(k)}人</span>`}${e<need&&tg(k)>0?`<span style="color:var(--warn);font-weight:700">19:50 不足${need-e}人</span>`:''}</div>
      <div style="font-size:11px;word-break:keep-all">${(()=>{ const DH=new Set(R.filter(r=>r.douhan).flatMap(r=>r.dh&&r.dh.length?r.dh:[r.by])) /* v1.63・SQL 265：同伴の子も */, isD=x=>DH.has(cName(x.staff_id)); const P=L.slice().sort((a,b)=>(isD(b)-isD(a))||mainOrd(a,b));
        return (P.slice(0,4).map(x=>isD(x)?`<b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 3px">${esc(cName(x.staff_id))}</b>`:esc(cName(x.staff_id)))).join('・')+(P.length>4?`<span class="muted">　他${P.length-4}名</span>`:''); })()}</div></div>`; }
  cal+='</div>';
  const sub=C.filter(c=>c.submitted).length;
  $('main').innerHTML=head+today+`<div class="card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><select id="shM" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel?csMLabel(x):x}</option>`).join('')}</select>
      <small class="muted">提出 ${sub}／${C.length}人・${M.fixed?'確定済み':'確定前'}</small><span style="flex:1"></span>
      ${visible('set_shift')?'<button class="ghost sm" id="shSet">設定</button>':''}<button class="ghost sm" id="shNg">休希望</button>${ed?`${M.fixed?'':'<button class="ghost sm" id="shDr">自動作成</button>'}<button class="${M.fixed?'ghost':'primary'} sm" id="shFx">${M.fixed?'確定の取消':'確定'}</button>`:''}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--muted);margin-bottom:8px">
      <span style="background:var(--gold-soft);border:1px solid var(--line);border-radius:4px;padding:1px 6px;color:var(--ink)">イベント日</span>
      <span style="background:var(--soft);border:1px solid var(--line);border-radius:4px;padding:1px 6px">休</span>
      <b style="background:var(--pri);color:#fff;border-radius:4px;padding:0 4px">同伴</b>
      <b style="color:var(--warn)">19:50 不足</b>
      <span style="display:inline-flex;gap:4px;align-items:center"><b style="color:var(--ink);font-weight:400">6／8人</b>出勤人数／目安</span>
      <span style="display:inline-flex;gap:4px;align-items:center"><b style="color:var(--warn)">3／6人</b>人数不足</span>${Object.keys(M.targets||{}).length?'':'<button class="ghost sm" id="shGoSet">目安人数の入力（シフト設定）</button>'}</div>${cal}
    <div class="muted" style="font-size:12px;margin-top:6px">タップで詳細表示</div></div>`;
  $('shM').onchange=()=>{ shMonth=$('shM').value; PAGES.shift(); };
  $('main').querySelectorAll('[data-shd]').forEach(b=>b.onclick=()=>shiftDayEdit(st,M,b.dataset.shd,ed));
  if($('shGoSet')) $('shGoSet').onclick=()=>{ setMonth=m; go('set_shift'); };
  if($('shSet')) $('shSet').onclick=()=>{ setMonth=m; go('set_shift'); };
  if(!ed) return;
  /* v1.44：休希望（オーナー 2026-10-22「キャストからの休み希望を見れるボタンが欲しい」→ 並びは「休希望・自動作成・確定」）。提出した人を上、未提出を下 */
  $('shNg').onclick=()=>{ const by={}; (M.ng||[]).forEach(x=>(by[x.staff_id]=by[x.staff_id]||[]).push(x.day)); const pm=csAddMonth(m,-1);
    const row=c=>`<div style="display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:14px;line-height:1.6"><b style="min-width:4.5em">${esc(c.name)}</b>${c.submitted?`<span>${c.week?`週${c.week}日・`:''}出勤できない日：${(by[c.id]||[]).sort().map(d=>`${Number(d.slice(8))}（${SH_WD[new Date(d+'T00:00:00+09:00').getDay()]}）`).join('・')||'なし'}</span>`:'<span style="color:var(--warn)">未提出</span>'}</div>`;
    const L=C.filter(c=>c.submitted).concat(C.filter(c=>!c.submitted));
    const w=modal(`<h2 style="margin:0">${mo}月の休み希望</h2><div class="muted" style="font-size:13px">提出 ${sub}／${C.length}人（締切 ${Number(pm.slice(5,7))}/10）</div><div style="max-height:60vh;overflow:auto">${L.map(row).join('')||'<div class="muted">キャストがいません</div>'}</div><div class="bar"><button class="primary" data-k="ok">閉じる</button></div>`);
    w.querySelector('[data-k=ok]').onclick=()=>w.remove(); };
  if($('shDr')) $('shDr').onclick=guard($('shDr'),async()=>{ if(!await uiConfirm(`${mo}月のシフトを自動作成しますか？\n希望出勤日数・出勤できない日・目安人数から作成します。今の${mo}月のシフトは作り直しになります`)) return; const q=await rpc('admin_shift_draft',{p_store:st,p_month:m}); if(!q.ok) return; toast(`自動作成しました（${q.data}件）`); PAGES.shift(); });
  $('shFx').onclick=guard($('shFx'),async()=>{ const fx=!M.fixed; if(!await uiConfirm(fx?`${mo}月のシフトを確定しますか？\nマイページに表示します`:`${mo}月のシフトの確定を取消しますか？\nマイページに表示しなくなります`)) return; const q=await rpc('admin_shift_fix',{p_store:st,p_month:m,p_fix:fx}); if(!q.ok) return; toast(fx?'確定しました':'確定を取消しました'); PAGES.shift(); }); };
// 日の詳細（出勤の名前と時刻の変更・出勤できる人の追加・出勤できない人・予約と同伴・目安人数・イベント日）
function shiftDayEdit(st,M,day,ed){ const C=M.casts||[], x=new Date(day+'T00:00:00+09:00');
  const L=(M.shifts||[]).filter(s=>s.day===day), on=new Set(L.map(s=>s.staff_id)), ng=new Set((M.ng||[]).filter(n=>n.day===day).map(n=>n.staff_id)), R=M.resv?.[day]||[];
  const canAdd=C.filter(c=>!on.has(c.id)&&!ng.has(c.id)), tgv=M.day_targets?.[day]??'', ev=(M.events||[]).includes(day);
  const box=modal(`<div style="display:flex;gap:8px;align-items:baseline"><h2 style="margin:0">${x.getMonth()+1}/${x.getDate()}（${SH_WD[x.getDay()]}）</h2><small class="muted">出勤 ${L.length}人</small></div>
    ${ed?`<div style="display:flex;gap:12px;align-items:center;margin-top:8px;flex-wrap:wrap"><label style="display:flex;gap:6px;align-items:center;margin:0">目安人数<input type="number" inputmode="numeric" min="0" id="sdT" value="${tgv}" placeholder="曜日別" style="width:80px;text-align:center"></label><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="sdE" ${ev?'checked':''} style="width:auto">イベント日</label><button class="ghost sm" id="sdS">保存</button></div>`:''}
    <div class="muted" style="font-size:12px;margin-top:10px">出勤</div>
    ${L.sort((a,b)=>a.time.localeCompare(b.time)).map(s=>{ const c=C.find(z=>z.id===s.staff_id)||{}; return `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding:5px 0"><span>${esc(c.name||'')}${rkTag(c.rank)}${c.daily?' <small class="muted">日給</small>':''}</span>${ed?`<select data-sdt="${s.staff_id}" style="width:auto"><option value="">出勤なし</option>${SH_TIMES.map(t=>`<option ${t===s.time?'selected':''}>${t}</option>`).join('')}</select>`:`<b>${s.time}</b>`}</div>`; }).join('')||'<div class="muted">なし</div>'}
    ${ed?`<div class="muted" style="font-size:12px;margin-top:10px">出勤できる人（押すと追加）</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${canAdd.map(c=>`<button class="ghost sm" data-sda="${c.id}">${esc(c.name)}${rkTag(c.rank)}${c.week?` <small class="muted">週${c.week}</small>`:''}${c.earliest?` <small class="muted">${c.earliest}〜</small>`:''}</button>`).join('')||'<span class="muted">なし</span>'}</div>`:''}
    <div class="muted" style="font-size:12px;margin-top:10px">出勤できない日</div><div>${[...ng].map(id=>esc(C.find(c=>c.id===id)?.name||'')).join('・')||'<span class="muted">なし</span>'}</div>
    <div class="muted" style="font-size:12px;margin-top:10px">予約・同伴</div>${R.map(r=>`<div style="font-size:14px">${r.time}　${esc(r.name)} 様 ${r.guests}名（${r.douhan?'同伴 '+esc((r.dh&&r.dh.length?r.dh:[r.by]).join('・')):(rvNoKK()?'':KL+' '+esc(r.kakari||'—')+'・')+'誘客 '+esc(r.by)}${r.vip?'・'+esc(r.vip):''}）</div>`).join('')||'<div class="muted">なし</div>'}
    <div class="bar" style="justify-content:flex-end;margin-top:12px"><button class="ghost" data-x>閉じる</button></div>`);
  let changed=false; const close=()=>{ box.remove(); if(changed) PAGES.shift(); }; box.querySelector('[data-x]').onclick=close;
  if(!ed) return;
  box.querySelectorAll('[data-sdt]').forEach(sel=>sel.onchange=async()=>{ const q=await rpc('admin_shift_set',{p_store:st,p_staff:sel.dataset.sdt,p_day:day,p_time:sel.value||null}); if(!q.ok) return; changed=true;
    /* v1.75：手元の M.shifts も直す（出勤なしにした後に「追加」で開き直すと、前の出勤が残って見えた。点検 2026-10-30） */
    M.shifts=(M.shifts||[]).filter(s=>!(s.staff_id===sel.dataset.sdt&&s.day===day)).concat(sel.value?[{staff_id:sel.dataset.sdt,day,time:sel.value}]:[]);
    toast(sel.value?`${sel.value} にしました`:'出勤なしにしました'); });
  box.querySelectorAll('[data-sda]').forEach(b=>b.onclick=guard(b,async()=>{ /* v1.75：2回押しで2回送らない */ const c=C.find(z=>z.id===b.dataset.sda); const t=c.daily?'19:50':(c.earliest&&c.earliest>'20:30'?c.earliest:(c.earliest||'20:30')); const q=await rpc('admin_shift_set',{p_store:st,p_staff:c.id,p_day:day,p_time:t}); if(!q.ok) return; changed=true; box.remove(); M.shifts=(M.shifts||[]).concat([{staff_id:c.id,day,time:t}]); shiftDayEdit(st,M,day,ed); }));
  box.querySelector('#sdS').onclick=async()=>{ const v=box.querySelector('#sdT').value; const q=await rpc('admin_shift_day_save',{p_store:st,p_day:day,p_count:v===''?null:Number(v),p_event:box.querySelector('#sdE').checked}); if(!q.ok) return; changed=true; toast('保存しました'); }; }
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
  const [r,mr]=await Promise.all([sb.rpc('admin_shift_settings_get',{p_store:st,p_month:m}),sb.rpc('admin_meeting_get',{p_store:st,p_month:m})]); if(page!=='set_shift'||storeId!==st||setMonth!==m) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(r.error.message)}</div>`; return; }
  const MT=mr.error?null:mr.data, MD=new Set(MT?.days||[]), hm=v=>v?String(v).replace(/^0(\d)/,'$1'):''; // v1.74・SQL 287：ミーティング（月初の営業日2日・時間帯は店で1つ）
  const T=r.data?.targets||{}, EVs=new Set(r.data?.events||[]), OFF=new Set(r.data?.offs||[]), DOW=new Set(r.data?.off_dows||[]), opts=[now,csAddMonth(now,1),csAddMonth(now,2),csAddMonth(now,3)];
  const y=Number(m.slice(0,4)), mo=Number(m.slice(5,7)), first=new Date(y,mo-1,1).getDay(), nd=new Date(y,mo,0).getDate(), iso=d=>`${m.slice(0,8)}${String(d).padStart(2,'0')}`, HOL=jpHolidays(y);
  const bx='border:1px solid var(--line);border-radius:6px;padding:6px 0;font:inherit;font-size:14px;line-height:1.25';
  $('main').innerHTML=head+`<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>目安人数（曜日別）</b><select id="ssM" style="width:auto">${opts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel(x)}</option>`).join('')}</select></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;margin-top:12px;max-width:560px">${SH_WD.map((w,i)=>`<label style="text-align:center">${w}<input type="number" inputmode="numeric" min="0" data-ss="${i}" value="${DOW.has(i)?'':T[String(i)]??''}" ${ed&&!DOW.has(i)?'':'disabled'} ${DOW.has(i)?'placeholder="休"':''} style="width:100%;text-align:center"></label>`).join('')}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">シフトの自動作成で、この人数まで割り振ります。日ごとの変更は、シフトのカレンダーで日を押して入力します</div>
    ${ed?'<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="primary sm" id="ssS">保存</button></div>':''}</div>
    <div class="card"><b>定休日</b>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:10px;max-width:560px">${SH_WD.map((w,i)=>{ const on=DOW.has(i); return `<button type="button" ${ed?`data-dw="${i}"`:'disabled'} style="${bx};background:${on?'var(--soft)':'var(--card)'};color:${on?'var(--muted)':'var(--ink)'};${on?'font-weight:700':''}">${w}<small style="display:block;font-size:11px">${on?'休':'&nbsp;'}</small></button>`; }).join('')}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">押すと定休日の登録・取消（毎週）</div></div>
    ${MT?`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>ミーティング</b>${ed?'<button class="primary sm" id="mtS">保存</button>':''}</div>
    ${[['出勤前','pre','17:00','19:30'],['退勤後','post','1:00','2:00']].map(([n,k,p1,p2])=>`<div style="display:flex;gap:8px;align-items:center;margin-top:10px"><span style="width:4.5em">${n}</span><input id="mt_${k}_f" value="${hm(MT[k+'_from'])}" placeholder="${p1}" inputmode="numeric" ${ed?'':'disabled'} style="width:6em">〜<input id="mt_${k}_t" value="${hm(MT[k+'_to'])}" placeholder="${p2}" inputmode="numeric" ${ed?'':'disabled'} style="width:6em"></div>`).join('')}
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px"><span style="width:4.5em">1枠</span><input id="mt_slot" type="number" inputmode="numeric" min="10" max="120" value="${MT.slot_min||30}" ${ed?'':'disabled'} style="width:6em">分</div>
    <div class="muted" style="font-size:13px;margin-top:8px">月初の営業日2日を自動で選択します。申請の締切は前月の末日です</div></div>`:''}
    <div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${mo}月</b>${ed?`<span style="display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden">${[['ev','イベント'],['off','休'],...(MT?[['mt','ミーティング']]:[])].map(([k,n])=>`<button type="button" data-md="${k}" style="border:0;border-radius:0;height:34px;padding:0 14px;font:inherit;font-size:14px;background:${ssMode===k?'var(--pri)':'var(--card)'};color:${ssMode===k?'#fff':'var(--ink)'};${ssMode===k?'font-weight:700':''}">${n}</button>`).join('')}</span>`:''}<small class="muted">イベント ${EVs.size}日・休 ${OFF.size}日${MT?`・ミーティング ${MD.size}日`:''}</small></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:10px;max-width:560px">${SH_WD.map(w=>`<div class="muted" style="text-align:center;font-size:12px">${w}</div>`).join('')}${'<div></div>'.repeat(first)}${Array.from({length:nd},(_,i)=>{ const k=iso(i+1), off=OFF.has(k), ev=EVs.has(k), mt=MD.has(k); return `<button type="button" ${ed?`data-ev="${k}"`:'disabled'} style="${bx};background:${off?'var(--soft)':ev?'var(--gold-soft)':'var(--card)'};color:${off?'var(--muted)':'var(--ink)'};${off||ev||mt?'font-weight:700;':''}${mt?'border:2px solid var(--pri);':''}">${i+1}<small style="display:block;font-size:10px;font-weight:400;white-space:nowrap">${off?'休':mt?'ミーティング':HOL.has(k)?'祝':'&nbsp;'}</small></button>`; }).join('')}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">「イベント」「休」${MT?'「ミーティング」':''}を選んで日を押すと登録・取消（定休日の営業も「休」で押す）。祝＝祝日</div></div>`;
  $('ssM').onchange=()=>{ setMonth=$('ssM').value; PAGES.set_shift(); };
  if(!ed) return;
  const md=k=>`${Number(k.slice(5,7))}/${Number(k.slice(8))}`;
  $('main').querySelectorAll('[data-md]').forEach(b=>b.onclick=()=>{ ssMode=b.dataset.md; PAGES.set_shift(); });
  $('main').querySelectorAll('[data-dw]').forEach(b=>b.onclick=guard(b,async()=>{ const i=Number(b.dataset.dw), on=!DOW.has(i); const q=await rpc('admin_shift_offdow_set',{p_store:st,p_dow:i,p_on:on}); if(!q.ok) return; toast(on?`${SH_WD[i]}曜を定休日にしました`:`${SH_WD[i]}曜の定休日を取消しました`); PAGES.set_shift(); }));
  $('main').querySelectorAll('[data-ev]').forEach(b=>b.onclick=guard(b,async()=>{ const k=b.dataset.ev;
    if(ssMode==='off'){ const on=!OFF.has(k); const q=await rpc('admin_shift_off_set',{p_store:st,p_day:k,p_off:on}); if(!q.ok) return; toast(on?`${md(k)} を休にしました`:`${md(k)} を営業にしました`); PAGES.set_shift(); return; }
    if(ssMode==='mt'){ const on=!MD.has(k); const q=await rpc('admin_meeting_day_set',{p_store:st,p_day:k,p_on:on}); if(!q.ok) return; toast(on?`${md(k)} をミーティング日にしました`:`${md(k)} のミーティング日を取消しました`); PAGES.set_shift(); return; }
    if(OFF.has(k)){ await uiAlert(`${md(k)} は休の日です`); return; }
    const on=!EVs.has(k); const q=await rpc('admin_shift_event_set',{p_store:st,p_day:k,p_on:on}); if(!q.ok) return; toast(on?`${md(k)} をイベント日にしました`:`${md(k)} のイベント日を取消しました`); PAGES.set_shift(); }));
  if($('mtS')) $('mtS').onclick=guard($('mtS'),async()=>{ const v=id=>$(id).value.trim()||null; const q=await rpc('admin_meeting_save',{p_store:st,p_pre_from:v('mt_pre_f'),p_pre_to:v('mt_pre_t'),p_post_from:v('mt_post_f'),p_post_to:v('mt_post_t'),p_slot:Number($('mt_slot').value)||null}); if(!q.ok) return; toast('保存しました'); PAGES.set_shift(); });
  $('ssS').onclick=guard($('ssS'),async()=>{ const v=[...$('main').querySelectorAll('[data-ss]')].map((x,i)=>DOW.has(i)?(x.value===''?Number(T[String(i)]??0):Number(x.value)):(x.value===''?null:Number(x.value))); if(v.some(x=>x==null||!(x>=0))){ await uiAlert('目安人数を入力してください'); return; }
    const q=await rpc('admin_shift_targets_save',{p_store:st,p_month:m,p_counts:v}); if(!q.ok) return; toast('保存しました'); PAGES.set_shift(); }); };
PAGES.set_pos=async()=>{ const st=storeId, ed=perm('set_pos')==='edit', dis=ed?'':'disabled';
  const keep=$('siBox')?.dataset.st===st?$('siBox'):null; // 料金だけ保存した時は、店の情報の入力中の内容を消さない
  $('main').innerHTML=`<h1>POS設定 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="card muted">読み込み中…</div>`;
  const [ps,tb]=await Promise.all([ sb.from('pos_settings').select('*').eq('store_id',st).maybeSingle(), sb.from('tables').select('id,name,vip_set_fee,vip_ext_fee,sort_order').eq('store_id',st).order('sort_order').order('id') ]);
  if(page!=='set_pos'||storeId!==st) return;
  const er=ps.error||tb.error; if(er){ $('main').innerHTML=`<h1>POS設定</h1><div class="card err">読み込めません：${esc(er.message)}</div>`; return; }
  const d=ps.data||{}; if(!('auto_hc_amount' in d)){ $('main').innerHTML=`<h1>POS設定</h1><div class="card err">SQL 062 が未実行です</div>`; return; }
  const num=(id,label,v)=>`<label>${label}<input id="${id}" inputmode="decimal" value="${esc(v??'')}" ${dis}></label>`;
  const amt=(id,label,v)=>`<label>${label}<select id="${id}" ${dis}>${HCBC_OPTS.map(([a,n])=>`<option value="${a??''}" ${(v??null)===a?'selected':''}>${n}</option>`).join('')}</select></label>`;
  const tables=tb.data||[];
  $('main').innerHTML=`<h1>POS設定 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>${ed?'':'<div class="muted" style="margin-bottom:10px">閲覧のみ</div>'}
  <div id="siBox" data-st="${esc(st)}"><div class="card muted">読み込み中…</div></div>
  <div class="card"><h2>料金</h2><div class="grid2">
    ${num('psSetM','最初のセット時間（分）',d.set_minutes)}${num('psSetP','セット1名単価（円）',d.set_unit_price)}
    ${num('psExtM','延長単位（分）',d.ext_minutes)}${num('psExtP','延長1名単価（円）',d.ext_unit_price)}
    ${num('psSvc','サービス料率（%）',d.service_rate)}${num('psTax','消費税率（%）',d.tax_rate)}
    ${num('psRnd','合計の切り上げ単位（円）',d.total_round_unit)}
    ${amt('psHc','HC（人数分・'+KL+'にバック100%）',d.auto_hc_amount)}${amt('psBc','BC（人数分・バックなし）',d.auto_bc_amount)}
  </div>${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" data-pssave>保存</button></div>':''}</div>
  <div class="card"><h2>伝票</h2>
    <label class="ck"><input type="checkbox" id="psDk" ${d.douhan_is_kakari?'checked':''} ${dis}>同伴の人を自動で${KL}にする</label>
    <label class="ck"><input type="checkbox" id="psCk" ${d.cust_auto_kakari!==false?'checked':''} ${dis}>お客様を登録したら、そのお客様の${KL}を自動で入れる</label>
    ${'sales_shot_manager' in d?`<label class="ck"><input type="checkbox" id="psSm" ${d.sales_shot_manager?'checked':''} ${dis}>アプローチのスクショは、お客様の${KL}ではなく、いつも担当の黒服に送る</label>`:''}${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" data-pssave>保存</button></div>':''}</div>
  <div class="card"><h2>入金・出金の項目</h2><div class="muted" style="font-size:13px;margin-bottom:8px">POS の現金管理で、入金・出金する時に選ぶ項目です。「その他」はいつも出ます（自由に書けます）</div>
    ${'cash_out_items' in d?`<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">${[['in','入金'],['out','出金']].map(([k,l])=>`<div style="flex:1 1 280px;min-width:0"><div style="font-weight:700;margin-bottom:6px">${l}</div><div class="ci-list" data-ci="${k}">${(d['cash_'+k+'_items']||[]).map(x=>`<span class="badge gray ci" style="background:#fff;color:var(--ink);border:1px solid var(--line);font-size:14px;margin:0 6px 6px 0;display:inline-flex;gap:6px;align-items:center"><span>${esc(x)}</span>${ed?'<a data-cirm style="cursor:pointer;color:var(--muted)">×</a>':''}</span>`).join('')}</div>
      ${ed?`<div class="row" style="margin-top:4px"><input data-ciin="${k}" maxlength="20" placeholder="${l}の項目（20字まで）" style="flex:1"><button class="ghost" data-ciadd="${k}">追加</button></div>`:''}</div>`).join('')}</div>
      ${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" id="ciSave">保存</button></div>':''}`:'<div class="err">SQL 077 が未実行です</div>'}</div>
  <div class="card"><h2>VIP料金</h2>
    <div class="muted" style="font-size:13px;margin-bottom:6px">VIP代は部屋に1回、VIP延長は延長ごと。人数は掛けません。ここに無い卓は通常卓（0円）です</div>
    <table class="t vip" id="vipT"><tr><th>卓</th><th>VIP代（円）</th><th>VIP延長（円）</th>${ed?'<th></th>':''}</tr>
    ${tables.filter(t=>Number(t.vip_set_fee||0)||Number(t.vip_ext_fee||0)).map(t=>vipRow(t,ed,dis)).join('')}</table>
    <div id="vipNone" class="muted" style="${tables.some(t=>Number(t.vip_set_fee||0)||Number(t.vip_ext_fee||0))?'display:none':''}">VIP の卓はありません</div>
    ${ed&&tables.length?`<div class="row" style="margin-top:8px"><select id="vipAdd" style="width:auto"><option value="">＋VIP の卓を追加</option>${tables.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>`:''}${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" data-pssave>保存</button></div>':''}</div>
  <div class="muted hint" style="font-size:13px;margin-top:10px;line-height:1.6">保存すると、POS の次の伝票から変わります（今開いている伝票はそのまま）<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">日払（立替）の上限・体験の源泉・ポイント・同伴の準備時間は「報酬・罰金項目」で設定します</div></div>`;
  if(keep) $('siBox').replaceWith(keep); else siRender();
  if(!ed) return;
  // v0.48：VIP料金は VIP の卓だけ出す。「＋VIP の卓を足す」で行を足す、× で外す（保存すると0円＝通常卓）
  const vipSync=()=>{ const on=new Set([...$('main').querySelectorAll('tr[data-tb]')].map(x=>x.dataset.tb)); $('vipNone').style.display=on.size?'none':''; [...$('vipAdd').options].forEach(o=>{ if(o.value) o.hidden=on.has(o.value); }); };
  const vipWire=tr=>{ tr.querySelector('[data-vrm]').onclick=()=>{ tr.remove(); vipSync(); }; };
  $('main').querySelectorAll('tr[data-tb]').forEach(vipWire);
  if($('vipAdd')){ vipSync(); $('vipAdd').onchange=()=>{ const t=tables.find(x=>x.id===$('vipAdd').value); $('vipAdd').value=''; if(!t) return; const tb=document.createElement('tbody'); tb.innerHTML=vipRow({...t,vip_set_fee:0,vip_ext_fee:0},true,''); const tr=tb.firstElementChild; $('vipT').appendChild(tr); vipWire(tr); vipSync(); tr.querySelector('[data-v=set]').focus(); }; }
  // v0.47・SQL 077：入金・出金の項目（足す・×で消す → 項目を保存）
  const ciChip=x=>{ const c=document.createElement('span'); c.className='badge gray ci'; c.style.cssText='background:#fff;color:var(--ink);border:1px solid var(--line);font-size:14px;margin:0 6px 6px 0;display:inline-flex;gap:6px;align-items:center'; c.innerHTML=`<span>${esc(x)}</span><a data-cirm style="cursor:pointer;color:var(--muted)">×</a>`; c.querySelector('[data-cirm]').onclick=()=>c.remove(); return c; };
  $('main').querySelectorAll('[data-cirm]').forEach(a=>a.onclick=()=>a.closest('.ci').remove());
  $('main').querySelectorAll('[data-ciadd]').forEach(b=>{ const k=b.dataset.ciadd, inp=$('main').querySelector(`[data-ciin="${k}"]`), list=$('main').querySelector(`[data-ci="${k}"]`);
    const add=async()=>{ const v=inp.value.trim(); if(!v) return; if(v==='その他'){ await uiAlert('「その他」は登録不要です'); return; } if([...list.querySelectorAll('.ci span')].some(x=>x.textContent===v)){ inp.value=''; return; } list.appendChild(ciChip(v)); inp.value=''; inp.focus(); };
    b.onclick=add; inp.onkeydown=e=>{ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); add(); } }; });
  if($('ciSave')){ const cs=$('ciSave'); cs.onclick=guard(cs,async()=>{ const g=k=>[...$('main').querySelectorAll(`[data-ci="${k}"] .ci span`)].map(x=>x.textContent);
    const r=await rpc('admin_save_cash_items',{p_store:st,p_in:g('in'),p_out:g('out')}); if(!r.ok) return; unsavedBtns.delete(cs); toast('保存しました（POS の次の入金・出金から変わります）'); }); }
  /* v1.55：料金・伝票・VIP料金の箱ごとに保存（オーナー 2026-10-23「料金のところには保存ボタンないよね」）。どの箱の保存でも、この3つの箱の今の入力をまとめて保存する（入れた物が消えない） */
  $('main').querySelectorAll('[data-pssave]').forEach(sv=>sv.onclick=guard(sv,async()=>{
    const g=id=>slNum($(id).value), v={set_minutes:g('psSetM'),set_unit_price:g('psSetP'),ext_minutes:g('psExtM'),ext_unit_price:g('psExtP'),service_rate:g('psSvc'),tax_rate:g('psTax'),total_round_unit:g('psRnd')};
    const lab={set_minutes:'最初のセット時間',set_unit_price:'セット1名単価',ext_minutes:'延長単位',ext_unit_price:'延長1名単価',service_rate:'サービス料率',tax_rate:'消費税率',total_round_unit:'合計の切り上げ単位'};
    for(const [k,x] of Object.entries(v)){ if(x==null||!Number.isFinite(x)||x<0){ await uiAlert(`${lab[k]}を0以上の数で入力してください`); return; } }
    for(const k of ['set_minutes','set_unit_price','ext_minutes','ext_unit_price','total_round_unit']) if(!Number.isInteger(v[k])){ await uiAlert(`${lab[k]}は整数で入力してください`); return; }
    if(!(v.set_minutes>0)||!(v.ext_minutes>0)){ await uiAlert('セット時間と延長単位は1分以上にしてください'); return; }
    if(v.service_rate>100||v.tax_rate>100){ await uiAlert('サービス料率・消費税率は100%までです'); return; }
    v.auto_hc_amount=$('psHc').value?Number($('psHc').value):null; v.auto_bc_amount=$('psBc').value?Number($('psBc').value):null;
    v.douhan_is_kakari=$('psDk').checked; v.cust_auto_kakari=$('psCk').checked; if($('psSm')) v.sales_shot_manager=$('psSm').checked; /* v1.42・SQL 187：担当制の店（広島） */
    const vip=[]; for(const t of tables){ const tr=$('main').querySelector(`tr[data-tb="${t.id}"]`); if(!tr){ vip.push({id:t.id,set:0,ext:0}); continue; } // 表に無い卓は通常卓（0円）
      const a=slNum(tr.querySelector('[data-v=set]').value)??0, b=slNum(tr.querySelector('[data-v=ext]').value)??0;
      if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0){ await uiAlert(`${tr.cells[0].textContent} のVIP料金は0以上の整数で入力してください`); return; } vip.push({id:t.id,set:a,ext:b}); }
    if(!await uiConfirm('POS設定を保存しますか？\nPOS の次の伝票から変わります')) return;
    const r=await rpc('admin_save_pos_settings',{p_store:st,p_vals:v,p_vip:vip}); if(!r.ok) return; toast('保存しました'); PAGES.set_pos(); })); };

// v0.22・SQL 062：報酬で使う数（日払の上限・体験の源泉・ポイント・同伴の準備時間）。前は POS の料金設定にあった
// v0.96・SQL 110：ドレス新調日の設定（店ごとに する／しない・毎月○日が提出の期限・罰金の種類）
async function dressFold(st,ed){ const box=$('dressBox'); if(!box) return; const r=await sb.rpc('admin_get_dress_settings',{p_store:st}); if(r.error||page!=='set_pay'||storeId!==st) return; const c=r.data||{};
  let on=!!c.enabled; const dis=ed?'':'disabled', names=[...new Set([c.fine_name,...(c.fine_names||[])])].filter(Boolean);
  box.innerHTML=foldCard('dress','ドレス新調日','',on?`する・毎月${c.due_day}日`:'しない',`<div class="muted" style="font-size:13px;margin-bottom:8px">キャストが毎月の期限までに、新しいドレスの金額とレシートの写真を LINEマイページで提出します。金額が前月の決定時給×3時間未満、または提出がない時は、下の罰金を自動で付けます</div>
    <div class="row"><span class="seg" id="drOn">${[[true,'する'],[false,'しない']].map(([v,n])=>`<button data-v="${v}" class="${on===v?'on':''}" ${dis}>${n}</button>`).join('')}</span></div>
    <div class="grid2" style="margin-top:10px"><label>提出の期限（毎月○日）<input id="drDay" inputmode="numeric" value="${esc(c.due_day)}" ${dis}></label>
    <label>罰金の種類<select id="drFine" ${dis}>${names.map(n=>`<option ${n===c.fine_name?'selected':''}>${esc(n)}</option>`).join('')}</select></label></div>
    ${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" id="drSave">保存</button></div>':''}`);
  foldWire(box); if(!ed) return;
  box.querySelectorAll('#drOn button').forEach(b=>b.onclick=()=>{ on=b.dataset.v==='true'; box.querySelectorAll('#drOn button').forEach(x=>x.classList.toggle('on',x===b)); });
  const sv=$('drSave'); sv.onclick=guard(sv,async()=>{ const d=slNum($('drDay').value); if(!(Number.isInteger(d)&&d>=1&&d<=28)){ await uiAlert('提出の期限は 1〜28 日にしてください'); return; }
    if(!await uiConfirm(on?`ドレス新調日を「する」（毎月${d}日が期限）にしますか？`:'ドレス新調日を「しない」にしますか？')) return;
    const x=await rpc('admin_save_dress_settings',{p_store:st,p_enabled:on,p_due_day:d,p_fine_name:$('drFine').value}); if(!x.ok) return; toast('保存しました'); PAGES.set_pay(); }); }
// v0.95・SQL 105：名刺発注の設定（LINEマイページの名刺発注。宛先・件名・返信先・枚数・金額。店ごと）
async function cardFold(st,ed){ const box=$('cardBox'); if(!box) return; const r=await sb.rpc('admin_get_card_settings',{p_store:st}); if(r.error||page!=='set_pay'||storeId!==st) return; const c=r.data||{};
  const inp=(id,l,v,ph='')=>`<label>${l}<input id="${id}" value="${esc(v??'')}" placeholder="${ph}" ${ed?'':'disabled'}></label>`;
  box.innerHTML=foldCard('card','名刺発注','',`${c.qty}枚 ${Number(c.price).toLocaleString('ja-JP')}円・宛先 ${c.to_email?esc(c.to_email):'未設定'}`,`<div class="muted" style="font-size:13px;margin-bottom:8px">LINEマイページで発注すると、宛先にメールを送信し、名刺代を報酬の個別控除に入れます</div><div class="grid2">
    ${inp('cdTo','宛先メールアドレス',c.to_email,'例：info@example.com')}${inp('cdSub','件名',c.subject)}${inp('cdRe','返信先アドレス',c.reply_to)}${inp('cdQty','枚数',c.qty)}${inp('cdPrice','金額（円）',c.price)}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">メール送信の設定：${c.mail_ready?'設定済み':'未設定'}</div>${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" id="cdSave">保存</button></div>':''}`);
  foldWire(box); const sv=$('cdSave'); if(!sv) return;
  sv.onclick=guard(sv,async()=>{ const q=slNum($('cdQty').value), pr=slNum($('cdPrice').value); if(!(q>0)||!(pr>=0)){ await uiAlert('枚数と金額を確認してください'); return; }
    if(!await uiConfirm('名刺発注の設定を保存しますか？')) return; const x=await rpc('admin_save_card_settings',{p_store:st,p_to:$('cdTo').value,p_subject:$('cdSub').value,p_reply:$('cdRe').value,p_qty:q,p_price:pr}); if(!x.ok) return; toast('保存しました'); PAGES.set_pay(); }); }
// v0.90：報酬・罰金項目の並びに合わせて2つの箱に分けた（保存は同じ admin_save_pay_settings。どちらの保存も6つ全部を送る）
const pnNum=(id,label,v,ed)=>`<label>${label}<input id="${id}" inputmode="decimal" value="${esc(v??'')}" ${ed?'':'disabled'}></label>`;
const pnSaveBtn=ed=>ed?'<div class="fend"><span class="sp"></span><button class="primary sm" data-pnsave>保存</button></div>':'';
const pnYen=v=>v==null?'—':Number(v).toLocaleString('ja-JP')+'円';
function payAdvCard(pos,ed){ const d=pos.data||{};
  return foldCard('payadv','日払（立替）の上限・同伴の準備時間','',`キャスト ${pnYen(d.advance_cap_cast)}・黒服 ${pnYen(d.advance_cap_hall)}・${d.douhan_punch_limit_min??'—'}分`,`<div class="grid2">
    ${pnNum('pnCapC','日払（立替）の上限・キャスト（円）',d.advance_cap_cast,ed)}${pnNum('pnCapH','日払（立替）の上限・黒服（円）',d.advance_cap_hall,ed)}
    ${pnNum('pnDh','同伴の準備時間（分・0＝警告なし）',d.douhan_punch_limit_min,ed)}</div>
    <div class="muted hint" style="font-size:13px;margin-top:8px;line-height:1.6">同伴の準備時間：伝票の立ち上げから出勤の打刻まで<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">これを超えると、タイムカードで本人に警告します</div></div>${pnSaveBtn(ed)}`,'data-paynum'); }
function payPtCard(pos,ed){ const d=pos.data||{};
  return foldCard('paypt','ポイント・体験入店','',`セット ${d.set_point??'—'}・延長 ${d.ext_point??'—'}・源泉 ${d.trial_withholding_rate??'—'}%`,`<div class="grid2">
    ${pnNum('pnSp','セット1名のポイント',d.set_point,ed)}${pnNum('pnEp','延長1回1名のポイント',d.ext_point,ed)}
    ${pnNum('pnTw','体験入店の源泉（%）',d.trial_withholding_rate,ed)}</div>
    <div class="muted" style="font-size:13px;margin-top:8px;line-height:1.6">ポイントは人数分かけて、${KL}で同じに分けます</div>${pnSaveBtn(ed)}`,'data-paynum'); }
function payNumWire(st){ $('main').querySelectorAll('[data-pnsave]').forEach(sv=>sv.onclick=guard(sv,async()=>{
  const g=id=>slNum($(id).value), v={advance_cap_cast:g('pnCapC'),advance_cap_hall:g('pnCapH'),trial_withholding_rate:g('pnTw'),set_point:g('pnSp'),ext_point:g('pnEp'),douhan_punch_limit_min:g('pnDh')};
  if(Object.values(v).some(x=>x==null||!Number.isFinite(x)||x<0)){ await uiAlert('全部の欄に0以上の数を入力してください'); return; }
  if(v.trial_withholding_rate>100){ await uiAlert('体験入店の源泉は100%までです'); return; }
  if(!await uiConfirm(sv.closest('[data-fold]').dataset.fold==='paypt'?'ポイント・体験入店の設定を保存しますか？':'日払（立替）の上限・同伴の準備時間を保存しますか？')) return;
  const r=await rpc('admin_save_pay_settings',{p_store:st,p_vals:v}); if(!r.ok) return; toast('保存しました'); PAGES.set_pay(); })); }

