// ---------- 応募者（集計） ----------
// 応募者・応募の記録が無い体験の子・退店した人を、期間を切らずに全員（POS の［退店・体験］は半年分。オーナー「管理サイトでは、これまでのやつ全員並べてほしい」）
// 面接結果・体験結果は「採用」（店の評価だけ。オーナー 11/13「入店は POS から」）。入店は POS の［退店・体験］の［入店］
// ［詳細］は右上の × で閉じる小窓。面接結果・体験結果は、マイページの応募者ページと同じ中身（データベースの ap_iv_apply・ap_tr_apply・ap_re_apply）を、表示設定で「編集」の人だけ入力できる
// 写真の撮影・ヒアリングシートの編集・契約書の［開始］はマイページのまま（対面でする物）
const APL_ST={applied:'応募',interview:'面接予約',trial:'体験',consider_self:'本人検討',consider_store:'店検討',hired:'採用',joined:'入店',left:'退店',declined:'辞退',rejected:'不採用'};
const APL_SEG=[['all','すべて'],['applied','応募'],['interview','面接予約'],['trial','体験'],['consider','検討中'],['hired','採用'],['joined','入店'],['left','退店'],['declined','辞退'],['rejected','不採用']];
const APL_SRC={line:'LINE 友だち追加',calendar:'面接予約',scout:'スカウト'};
let aplSeg='all', aplQ='', aplSel=null;
const aplHit=(r,k)=>k==='all'||(k==='consider'?/^consider_/.test(r.st):r.st===k);
const aplStLabel=r=>r.st==='trial'&&r.future?'体験予定':APL_ST[r.st]||'';
/* 日付は今年なら月/日、ほかの年は年も（POS の［退店・体験］と同じ） */
const aplDay=d=>{ if(!d) return ''; const [y,m,dd]=String(d).slice(0,10).split('-'); return (y===businessDate().slice(0,4)?'':y+'/')+m+'/'+dd; };
const aplJst=iso=>iso?new Date(new Date(iso).getTime()+9*3600e3).toISOString():'';
const aplDt=iso=>iso?`${aplDay(aplJst(iso))} ${aplJst(iso).slice(11,16)}`:'';
const aplDtW=iso=>{ if(!iso) return '未定'; const d=new Date(new Date(iso).getTime()+9*3600e3); return `${aplDay(aplJst(iso))}（${WD[d.getUTCDay()]}）${aplJst(iso).slice(11,16)}`; };

PAGES.applicants=async()=>{ const st=storeId;
  $('main').innerHTML=`<h1>応募者 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="card muted">読み込み中…</div>`;
  const r=await sb.rpc('admin_ap_list',{p_store:st}); if(page!=='applicants'||storeId!==st) return;
  if(r.error){ $('main').querySelector('.card').outerHTML=`<div class="card err">${/admin_ap_list/.test(r.error.message)?'SQL 488 が未実行です':'表示できません：'+esc(r.error.message)}</div>`; return; }
  const L=r.data||[], cnt=k=>L.filter(x=>aplHit(x,k)).length;
  $('main').innerHTML=`<h1>応募者 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  <div class="row" style="margin-bottom:12px;gap:10px;flex-wrap:wrap"><span class="seg">${APL_SEG.map(([k,n])=>`<button data-aps="${k}" class="${k===aplSeg?'on':''}">${n} ${cnt(k)}</button>`).join('')}</span><input id="aplQ" placeholder="名前検索" value="${esc(aplQ)}" style="width:180px"></div>
  <div class="card" id="aplList"></div>`;
  const draw=()=>{ const q=aplQ.trim(), R=L.filter(x=>aplHit(x,aplSeg)&&(!q||String(x.name||'').includes(q)||kanaKey(x.name).includes(kanaKey(q))));
    /* 列は幅を決めた枠に入れて、名前や日付の長さで縦の位置がずれないようにする（スキル olive-no-misalign） */
    const W=[120,52,96,140,140,96,80,76], col='flex:none;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    const cell=(v,i,hd)=>`<span style="${col};width:${W[i]}px${hd?';font-size:12px;color:var(--muted)':''}">${v}</span>`;
    const head=`<div style="display:flex;gap:12px;align-items:center;padding:0 0 6px;border-bottom:1px solid var(--line)">${['名前','区分','応募日','面接日','体験日','退店日','担当黒服','状態'].map((t,i)=>cell(t,i,1)).join('')}</div>`;
    const tday=x=>x.trial_at?aplDt(x.trial_at):(x.t==='s'&&x.st==='trial'?aplDay(x.sort_day):'');
    $('aplList').innerHTML=R.length?head+R.map(x=>`<div style="display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)">${cell(`<b>${esc(x.name||'（名前なし）')}</b>`,0)}${cell(x.kind==='hall'?'<span class="badge gray">黒服</span>':'',1)}${cell(aplDay(x.applied),2)}${cell(aplDt(x.interview_at),3)}${cell(tday(x),4)}${cell(aplDay(x.left_on),5)}${cell(esc(x.hall||''),6)}${cell(`<span class="badge ${x.st==='joined'?'':'gray'}">${aplStLabel(x)}</span>`,7)}<button class="primary sm" style="flex:none" data-apd="${x.t}:${x.id}">詳細</button></div>`).join(''):'<div class="muted">該当なし</div>';
    $('aplList').querySelectorAll('[data-apd]').forEach(b=>b.onclick=()=>{ const x=R.find(y=>`${y.t}:${y.id}`===b.dataset.apd); if(x) aplOpen(x); }); };
  $('main').querySelectorAll('[data-aps]').forEach(b=>b.onclick=()=>{ aplSeg=b.dataset.aps; $('main').querySelectorAll('[data-aps]').forEach(y=>y.classList.toggle('on',y===b)); draw(); });
  $('aplQ').oninput=()=>{ aplQ=$('aplQ').value; draw(); };
  draw(); };

function aplClose(){ const m=$('aplBox'); if(m) m.remove(); aplSel=null; }
const aplGrid=R=>`<div style="display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px 10px;align-items:center;font-size:15px">${R.filter(Boolean).map(([k,v,top])=>`<span class="muted" style="font-size:13px${top?';align-self:start;padding-top:4px':''}">${k}</span><span style="min-width:0">${v}</span>`).join('')}</div>`;
const aplSec=html=>`<div style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">${html}</div>`;
const aplYen=n=>Number(n||0).toLocaleString('ja-JP');
/* 体験の日ごとの時刻・稼働時間・日払（立替）・受領（POS の［退店・体験］の詳細と同じ並び。稼働時間は受領のサインの時だけ） */
function aplDays(days){ if(!days?.length) return '';
  const col='flex:none;font-variant-numeric:tabular-nums;white-space:nowrap', W=[days.some(x=>aplDay(x.day).split('/').length===3)?92:56,116,64,92,56];
  const cells=(...v)=>v.map((t,i)=>`<span style="${col};width:${W[i]}px${i===3?';text-align:right':''}">${t}</span>`).join('');
  return `<div class="muted" style="display:flex;gap:10px;font-size:12px;padding-bottom:2px">${cells('日付','時刻','稼働時間','日払（立替）','')}</div>`
    +days.map((x,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:6px 0;${i?'border-top:1px solid var(--line)':''}">${cells(aplDay(x.day),x.in?`${hmJst(x.in)} 〜 ${x.out?hmJst(x.out):''}`:'',x.hours!=null?`${Number(x.hours)}時間`:'',x.paid!=null?aplYen(x.paid)+'円':'',x.rc?'<span class="badge">受領済</span>':'')}</div>`).join(''); }
const aplPay=(t,a)=>a?`${t==='hourly'?'時給':'日給'} ${aplYen(a)}円`:'';

async function aplOpen(x){ aplClose(); aplSel=x; const st=storeId;
  const m=mkModal(50); m.id='aplBox'; m.innerHTML=`<div class="box" style="width:min(760px,94vw);text-align:left"><button type="button" class="xb dx" aria-label="閉じる">×</button><div id="aplIn" class="muted">読み込み中…</div></div>`;
  m.querySelector('.dx').onclick=aplClose; m.onclick=e=>{ if(e.target===m) aplClose(); }; document.body.appendChild(m);
  const r=x.t==='a'?await sb.rpc('admin_ap_get',{p_store:st,p_id:x.id}):await sb.rpc('admin_ap_staff',{p_store:st,p_staff:x.id}); if(aplSel!==x) return;
  if(r.error){ $('aplIn').outerHTML=`<div class="err">表示できません：${esc(r.error.message)}</div>`; return; }
  if(x.t==='s') aplStaffBody(r.data); else aplApBody(x,r.data); }

/* 応募の記録が無い人（シフトの［追加］→ 体験・前からの退店） */
function aplStaffBody(D){ const kb=D.kind==='hall'?'黒服':D.is_trial?'体験':D.kakari_only?KL+'専用':D.is_seppan?'折半':'キャスト';
  $('aplIn').outerHTML=`<div style="margin-top:6px">${aplGrid([['名前',`<b>${esc(D.name||'')}</b>`],['本名',esc(D.real_name||'')],['区分',kb],
    ...(D.is_trial?[['体験の報酬',aplPay(D.pay_type,D.pay_amount)],['体験日',aplDays(D.days)||aplDay(D.trial_day),true]]:[['入店日',aplDay(D.joined_on)],['退店日',aplDay(D.left_on)]]),
    D.hall_name?['担当黒服',esc(D.hall_name)]:null])}</div>`; }

/* 応募者：マイページの応募者ページと同じ中身。入力は表示設定で「編集」の人だけ */
function aplApBody(x,A){ const ed=!!A.can_edit, st=storeId;
  const bust=(A.photos||[]).filter(p=>p.kind==='bust'), sheet=(A.photos||[]).filter(p=>p.kind==='sheet');
  const img=(p,w,h)=>`<img data-aph="${p.id}" alt="" style="flex:none;width:${w}px;height:${h}px;object-fit:cover;border:1px solid var(--line);border-radius:8px;background:var(--soft);cursor:pointer">`;
  const blank=(t,w,h)=>`<span style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:${w}px;height:${h}px;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--muted);font-size:12px">${t}</span>`;
  const ivDone=!['applied','interview'].includes(A.status), ivOpen=(['applied','interview','trial','declined','rejected'].includes(A.status)||(A.status==='hired'&&!A.trial_name))&&!A.joined;
  const ivLabel={trial:'体験',considering:'体験',hired:A.trial_name?'体験':'採用',joined:'入店',declined:'辞退',rejected:'不採用'}[A.status]||'';
  const top=`<div style="display:flex;gap:16px;align-items:flex-start;margin-top:6px">${bust.length?img(bust[0],96,128):blank('バストアップ',96,128)}<div style="flex:1;min-width:0">${aplGrid([
    ['名前',`<b>${esc(A.name||A.line_name||'（名前なし）')}</b>`],['本名',esc(A.real_name||'')],['区分',A.kind==='hall'?'黒服':'キャスト'],A.phone?['電話',esc(A.phone)]:null,
    ['応募',`${aplDay(A.applied)}　${APL_SRC[A.source]||''}`],['担当黒服',esc(A.hall_name||'未定')],A.line?null:['LINE','未追加']])}</div></div>`;
  const hl=sheetLines(A.hearing,curStore()?.code==='hiroshima');
  const info=aplSec(aplGrid([['面接',aplDtW(A.interview_at)],ivDone&&!(ed&&ivOpen)?['面接結果',ivLabel]:null,
    A.trial_name?['体験の報酬',aplPay(A.trial_pay_type,A.trial_pay_amount)]:null,
    A.trial_name?['体験日',aplDays(A.days)||aplDtW(A.trial_at),!!A.days?.length]:null,
    A.trial_name&&!(ed&&!A.joined)&&['considering','hired','joined','declined','rejected'].includes(A.status)?['体験結果',`<span class="badge ${A.joined?'':'gray'}">${esc(A.status_label||'')}</span>`]:null,
    A.trial_reason&&!(ed&&!A.joined)?['理由',esc(A.trial_reason)]:null,
    (A.good||[]).length&&!(ed&&A.trial_name&&!A.joined)?['よかった点',esc(A.good.join('・'))]:null,
    (A.concern||[]).length&&!(ed&&A.trial_name&&!A.joined)?['気になった点',esc(A.concern.join('・'))]:null,
    A.voice?['ご感想',`よかった点：${esc((A.voice.good||[]).join('・')||'なし')}<br>気になった点：${esc((A.voice.concern||[]).join('・')||'なし')}${A.voice.text?`<br>ひとこと：${esc(A.voice.text)}`:''}`,true]:null,
    A.joined_on?['入店日',aplDay(A.joined_on)]:null,A.left_on?['退店日',aplDay(A.left_on)]:null,
    A.status==='declined'&&A.next_contact?['次回連絡日',aplDay(A.next_contact)]:null,A.memo?['メモ',esc(A.memo)]:null,
    ['ヒアリングシート',`<span style="display:flex;gap:6px;flex-wrap:wrap">${sheet.map(p=>img(p,64,86)).join('')||'<span class="muted">写真なし</span>'}</span>`,true]]))
    +(hl.length?`<div style="font-size:14px;line-height:1.8;margin-top:10px"><b>ヒアリングシートの入力内容</b>${hl.map(([k,v])=>`<div style="display:flex;gap:8px"><span class="muted" style="flex:none;width:40%">${esc(k)}</span><span style="min-width:0">${esc(v)}</span></div>`).join('')}</div>`:'');
  $('aplIn').outerHTML=`<div id="aplIn">${top}${info}${ed&&ivOpen?aplIvForm(A,ivLabel,bust,sheet):''}${ed&&A.trial_name&&!A.joined?aplTrForm(A):''}</div>`;
  $('aplIn').querySelectorAll('img[data-aph]').forEach(async im=>{ const q=await sb.rpc('admin_ap_photo',{p_store:st,p_photo:im.dataset.aph}); if(q.error||!q.data) return; im.src=q.data;
    im.onclick=()=>{ const w=mkModal(60,`<button class="xb dx" data-k="ok" aria-label="閉じる">×</button><img src="${esc(q.data)}" alt="" style="width:100%;border-radius:10px">`); w.querySelector('[data-k=ok]').onclick=()=>w.remove(); }; });
  if(ed) aplBind(x,A); }

const aplSegH=(k,opts,v)=>`<span class="seg" data-apseg="${k}" style="flex-wrap:wrap">${opts.map(([o,n])=>`<button type="button" data-v="${o}" class="${o===v?'on':''}">${n}</button>`).join('')}</span>`;
const aplSelH=(id,opts,v)=>`<select id="${id}" style="width:auto">${opts.map(([o,n])=>`<option value="${esc(o)}" ${String(o)===String(v)?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
const aplIsoDay=iso=>iso?aplJst(iso).slice(0,10):'';
const aplPayIn=(p,A)=>`<span style="display:flex;gap:8px">${aplSelH(p+'p',[['hourly','時給'],['daily','日給']],A.trial_pay_type||'daily')}<input id="${p}a" type="number" inputmode="numeric" min="1" placeholder="円" value="${A.trial_pay_amount||''}" style="width:140px"></span>`;
/* 面接結果（マイページの「面接」の箱と同じ入力。写真が無いと面接完了を押せない。撮影はマイページ） */
function aplIvForm(A,ivLabel,bust,sheet){ const v={trial:'trial',considering:'trial',hired:'hired',declined:'declined',rejected:'rejected'}[A.status]||'';
  const need=[...(bust.length?[]:['バストアップ']),...(sheet.length||A.sheet_by_line?[]:['ヒアリングシート'])];
  return aplSec(`<b>面接結果</b><div style="margin-top:8px">${aplGrid([['面接結果',aplSegH('iv',[['trial','体験'],['hired','採用'],['declined','辞退'],['rejected','不採用']],v)]])}</div>
    <div id="aplTrIn" style="margin-top:8px;${v==='trial'?'':'display:none'}">${aplGrid([['体験日',`<span style="display:flex;gap:8px"><input id="aplTd" type="date" value="${aplIsoDay(A.trial_at)}" min="${A.today}" style="width:auto">${aplSelH('aplTt',SH_TIMES.map(t=>[t,t]),A.trial_at?aplJst(A.trial_at).slice(11,16):'20:00')}</span>`],
      ['体験の報酬',aplPayIn('aplT',A)],A.name?null:['名前','<input id="aplNm" maxlength="30">'],['本名',`<input id="aplRn" maxlength="60" value="${esc(A.real_name||'')}">`],
      ['希望源氏名',`<input id="aplGn" maxlength="30" placeholder="例）サヤ・ハル" value="${esc(A.trial_name&&A.trial_name!==A.name?A.trial_name:'')}">`]])}</div>
    ${need.length?`<div style="margin-top:10px;color:var(--warn);font-size:14px">未撮影　${need.join('・')}（撮影は LINEマイページ）</div>`:''}
    ${A.line?'':`<div style="margin-top:10px">${aplGrid([['LINE 未追加の理由',`<input id="aplNl" maxlength="200" value="${esc(A.no_line_reason||'')}">`]])}</div>`}
    <div class="fend" style="margin-top:12px"><span class="sp"></span><button class="primary sm" id="aplIvOk" ${need.length?'disabled':''}>面接完了</button></div>`); }
/* 体験結果（マイページの「体験」の箱と同じ入力） */
function aplTrForm(A){ const v={hired:'hired',considering:{self:'consider_self',store:'consider_store'}[A.consider_by]||'',declined:'declined',rejected:'rejected'}[A.status]||(A.status==='trial'&&A.judge==='not'?'rejected':'');
  const reOk=aplIsoDay(A.trial_at)<=A.today;
  const chk=(k,on)=>`<span style="display:grid;grid-template-columns:repeat(4,max-content);gap:4px 14px">${AP_PT.map(t=>`<label style="display:flex;align-items:center;gap:6px;margin:0;white-space:nowrap"><input type="checkbox" data-ap${k}="${esc(t)}" ${(on||[]).includes(t)?'checked':''} style="width:18px;height:18px;margin:0">${esc(t)}</label>`).join('')}</span>`;
  return aplSec(`<b>体験結果</b><div style="margin-top:8px">${aplGrid([['体験結果',aplSegH('tr',[['hired','採用'],...(reOk?[['retrial','再体入']]:[]),['consider_self','本人検討'],['consider_store','店検討'],['declined','辞退'],['rejected','不採用']],v)]])}</div>
    ${reOk?`<div id="aplReIn" style="margin-top:8px;display:none">${aplGrid([['体験日',`<span style="display:flex;gap:8px"><input id="aplRd" type="date" min="${A.today}" style="width:auto">${aplSelH('aplRt',SH_TIMES.map(t=>[t,t]),A.trial_at?aplJst(A.trial_at).slice(11,16):'20:00')}</span>`],['体験の報酬',aplPayIn('aplR',A)]])}</div>`:''}
    <div id="aplPtIn" style="margin-top:8px">${aplGrid([['よかった点',chk('g',A.good),true],['気になった点',chk('c',A.concern),true]])}</div>
    <div id="aplRsIn" style="margin-top:8px;${['declined','rejected'].includes(v)?'':'display:none'}">${aplGrid([['理由',`<textarea id="aplRs" maxlength="500" style="min-height:60px">${esc(A.trial_reason||'')}</textarea>`,true]])}</div>
    <div class="fend" style="margin-top:12px"><span class="sp"></span><button class="primary sm" id="aplTrOk">保存</button></div>`); }

function aplBind(x,A){ const B=$('aplIn'), st=storeId, segV=k=>B.querySelector(`[data-apseg="${k}"] button.on`)?.dataset.v||'';
  const show=(id,on)=>{ if($(id)) $(id).style.display=on?'':'none'; };
  B.querySelectorAll('[data-apseg]').forEach(s=>s.querySelectorAll('button').forEach(b=>b.onclick=()=>{ s.querySelectorAll('button').forEach(y=>y.classList.toggle('on',y===b));
    if(s.dataset.apseg==='iv') show('aplTrIn',b.dataset.v==='trial');
    if(s.dataset.apseg==='tr'){ show('aplReIn',b.dataset.v==='retrial'); show('aplPtIn',b.dataset.v!=='retrial'); show('aplRsIn',['declined','rejected'].includes(b.dataset.v)); } }));
  /* 本名がそのままシフトに出ないように。カタカナにそろえる（マイページと同じ） */
  if($('aplGn')) $('aplGn').onblur=()=>{ $('aplGn').value=kanaKey($('aplGn').value); };
  const after=async q=>{ if(q.error){ await uiAlert(q.error.message); return false; } toast('保存しました'); aplClose(); if(page==='applicants') PAGES.applicants(); return true; };
  if($('aplIvOk')) $('aplIvOk').onclick=guard($('aplIvOk'),async()=>{ const v=segV('iv'); if(!v){ await uiAlert('面接結果を選んでください'); return; }
    if($('aplNm')&&v==='trial'&&!$('aplNm').value.trim()){ await uiAlert('名前を入力してください'); return; }
    if(v==='rejected'&&!await uiConfirm('不採用にしますか？','不採用')) return;
    const T=v==='trial';
    await after(await sb.rpc('admin_ap_interview',{p_store:st,p_id:A.id,p_result:v,p_day:T?$('aplTd').value||null:null,p_time:T?$('aplTt').value:null,p_pay_type:T?$('aplTp').value:null,
      p_amount:T?(parseInt($('aplTa').value||'0',10)||0):null,p_real:T?$('aplRn').value.trim():null,p_genji:T?kanaKey($('aplGn').value)||null:null,p_noline:$('aplNl')?$('aplNl').value.trim()||null:null,p_name:$('aplNm')?$('aplNm').value.trim()||null:null})); });
  if($('aplTrOk')) $('aplTrOk').onclick=guard($('aplTrOk'),async()=>{ const v=segV('tr'); if(!v){ await uiAlert('体験結果を選んでください'); return; }
    if(v==='retrial'){ await after(await sb.rpc('admin_ap_retrial',{p_store:st,p_id:A.id,p_day:$('aplRd').value||null,p_time:$('aplRt').value,p_pay_type:$('aplRp').value,p_amount:parseInt($('aplRa').value||'0',10)||0})); return; }
    const pick=k=>[...B.querySelectorAll(`[data-ap${k}]`)].filter(c=>c.checked).map(c=>c.dataset['ap'+k]);
    const rs=['declined','rejected'].includes(v)?$('aplRs').value.trim():null; if(rs===''){ await uiAlert('理由を入力してください'); return; }
    await after(await sb.rpc('admin_ap_trial',{p_store:st,p_id:A.id,p_result:v,p_good:pick('g'),p_concern:pick('c'),p_reason:rs})); });
}
