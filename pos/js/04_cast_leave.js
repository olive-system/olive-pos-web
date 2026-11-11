// v12.48・SQL 334：退店の2段（オーナー 2026-11-03「退店しても報酬を渡すまで消せない」）。［退店］→ 在籍から外す。報酬があって受取確認の無い月があれば「受取待ち」
//   受取待ちの間は LINEマイページは報酬明細だけ。最後の月の受取確認で自動で退店完了。［退店完了］でも終える。手作業の一覧はチェックだけ（記録しない）
const LEAVE_TODO=['グループLINE 削除','名刺 廃棄','公式LINE 表示名 変更（在籍→退店）'];
const leaveMon=ms=>(ms||[]).map(m=>`${+String(m).slice(5,7)}月分`).join('・');
function leaveBadge(s){ /* 退店した日から3か月を過ぎたら「3か月超」（オーナー「3か月以内に取りに来てほしい」） */
  const d=s.left_on?new Date(s.left_on+'T00:00:00Z'):null; if(d) d.setUTCMonth(d.getUTCMonth()+3);
  return d&&d.toISOString().slice(0,10)<businessDate()?' <span class="badge warnb">受取待ち 3か月超</span>':' <span class="badge gray">受取待ち</span>'; }
async function leaveDlg(s){
  if(!s) return; const inf=await sb.rpc('pos_staff_leave_info',{p_staff:s.id}); if(inf.error){ await uiAlert(/pos_staff_leave_info/.test(inf.error.message)?'SQL 334 が未実行です':inf.error.message); return; }
  const ms=inf.data?.months||[], pend=ms.length>0&&inf.data?.line;
  const lb=t=>`<div style="font-size:13px;color:var(--muted);margin:10px 0 2px">${t}</div>`;
  const box=document.createElement('div'); box.id='uiDlgLeave'; box.style.cssText='text-align:left;font-size:16px;line-height:1.6;margin:4px 0 8px';
  box.innerHTML=lb('自動停止')+`<div>タイムカード・シフト・鍵・お知らせ・伝票での選択${pend?'':'・LINEマイページ'}</div>`+(pend?lb('LINEマイページ')+'<div>報酬明細のみ（受取確認まで）</div>'+lb('受取待ち')+`<div>${esc(leaveMon(ms))}</div>`:'')
    +lb('手作業')+LEAVE_TODO.map(t=>`<label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" style="width:20px;height:20px">${esc(t)}</label>`).join('');
  /* v12.77・SQL 395（オーナー 2026-11-07「残り香チェックってシステムで何とかカバーできないのかな」→ 退店で済ませる）：手作業3つ全部にチェックするまで［退店］は押せない。
     押したら「退店処理した人」（黒服）を選び、操作ログの by に残す。毎月の TODO「退店した人の、残り香チェック」は外した */
  $('uiDlgMsg').after(box); const ok=$('uiDlgOk'), cks=[...box.querySelectorAll('input[type=checkbox]')], sync=()=>{ ok.disabled=!cks.every(c=>c.checked); };
  cks.forEach(c=>c.onchange=sync); ok.textContent='退店'; let y=false;
  try{ const p=uiConfirm(`${s.display_name}　退店`); sync(); y=await p; } finally{ ok.textContent='OK'; ok.disabled=false; box.remove(); } if(!y) return;
  const by=await askBy('退店処理した人'); if(by===null) return;
  const r=await sb.rpc('pos_staff_leave',{p_staff:s.id,p_by:by||null}); if(r.error){ await uiAlert(/p_by/.test(r.error.message)?'SQL 395 が未実行です':r.error.message); return; }
  toast(r.data?.pending?`${s.display_name}：受取待ち（${leaveMon(r.data.months)}）`:`${s.display_name}：退店しました`); if(cSel?.id===s.id){ cSel=null; if(typeof castFormHide==='function') castFormHide(); }
  await loadStaffAll(); renderCasts();
}
async function leaveDone(s){
  if(!s) return; const ok=$('uiDlgOk'); ok.textContent='退店完了'; let y=false; try{ y=await uiConfirm(`${s.display_name}　退店完了\nLINEマイページの報酬明細も停止`); } finally{ ok.textContent='OK'; } if(!y) return;
  const r=await sb.rpc('pos_staff_leave',{p_staff:s.id,p_done:true}); if(r.error){ await uiAlert(r.error.message); return; }
  toast(`${s.display_name}：退店完了`); await loadStaffAll(); renderCasts();
}
// v13.41・SQL 447：［退店・体験］の一覧。退店日・体験日が半年以内の人（受取待ちは今までどおり在籍リストの一番下）。在籍に戻す時は今までどおり［新規登録］で同じ名前
//   オーナー 2026-11-11「退店した女の子や、体験入店した女の子、過去の女の子を、過去、半年分表示」。黒服の退店も出す
// v13.43・SQL 451：［詳細］は右上の × で閉じる小窓（右の欄 300px には書類の写真と体験日の行が入らない。POS の見るだけの小窓と同じ形）。
//   体験の報酬・体験日ごとの時刻と日払（立替）（記録を読むだけ。［受領済］は在籍リストと同じ受領のサインの画面）・書類（在籍の［編集］と同じ部品 posDocs。撮影・削除も同じ）
const PAST_RES={considering:'検討中',consider_self:'本人検討',consider_store:'店検討',declined:'辞退',rejected:'不採用'}; /* v13.44・SQL 452：検討中を本人検討・店検討に分けた（前に入れた検討中はそのまま） */
let pastSel=null;
const pastDay=d=>{ if(!d) return ''; const [y,m,dd]=String(d).split('-'); return (y===businessDate().slice(0,4)?'':y+'/')+m+'/'+dd; };
async function renderPast(){ $('cTabToday').classList.remove('on'); $('cTabPast').classList.add('on'); $('cSort').textContent='並べ替え';
  const r=await sb.rpc('pos_staff_past',{p_day:businessDate()});
  if(r.error){ $('cList').innerHTML=/pos_staff_past/.test(r.error.message)?'<div class="muted">SQL 447 が未実行です</div>':RDERR; pastForm(); return; }
  const q=$('cSearch').value.trim(), L=(r.data||[]).filter(s=>!q||(s.display_name+(s.real_name||'')).includes(q));
  /* しるし・日付・体験結果は幅を決めた枠に入れて、名前の長さで縦の位置がずれないようにする */
  const col='flex:none;font-size:16px;font-variant-numeric:tabular-nums;white-space:nowrap';
  $('cList').innerHTML=L.map(s=>`<div class="rrow" data-id="${s.id}"><span class="nm">${esc(s.display_name)}${s.kind==='hall'?' <span class="badge gray">黒服</span>':''}</span><span style="${col};width:48px"><span class="badge gray">${s.is_trial?'体験':'退店'}</span></span><span style="${col};width:96px">${pastDay(s.day)}</span><span style="${col};width:56px">${PAST_RES[s.result]||''}</span><button class="primary sm" data-pdt="${s.id}">詳細</button></div>`).join('')||'<div class="muted">該当なし</div>';
  $('cList').querySelectorAll('[data-pdt]').forEach(b=>b.onclick=()=>{ const s=L.find(x=>x.id===b.dataset.pdt); if(s) pastOpen(s); });
  pastForm(); }
function pastForm(){ const f=$('cForm'); f.classList.add('empty'); f.innerHTML='<div class="muted">一覧の「詳細」を押してください</div>'; }
const pastGrid=R=>R.map(([k,v,top])=>`<span class="muted" style="font-size:13px${top?';align-self:start;padding-top:7px':''}">${k}</span><span>${v}</span>`).join('');
function pastClose(){ const m=$('pastBox'); if(m) m.remove(); pastSel=null; }
async function pastOpen(s){ pastClose(); pastSel=s;
  const mg=s.manager_staff_id?staffAll.find(x=>x.id===s.manager_staff_id):null;
  const kb=s.kind==='hall'?'黒服':s.is_trial?'体験':s.kakari_only?KL+'専用':s.is_seppan?'折半':'キャスト';
  const R=[['源氏名',esc(s.display_name)],['本名',esc(s.real_name||'')],['区分',kb],...(s.is_trial?[['体験結果',PAST_RES[s.result]||'未入力']]:[['入店日',pastDay(s.joined_on)],['退店日',pastDay(s.day)]]),...(mg?[['担当黒服',esc(mg.display_name)]]:[])];
  const m=mkModal(50); m.id='pastBox'; /* 受領のサインの画面（55）・書類の小窓（58）より下 */
  m.innerHTML=`<div class="box" style="width:min(760px,94vw)"><button type="button" class="xb dx" aria-label="閉じる">×</button><div id="pastGrid" style="display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px 10px;align-items:center;font-size:15px">${pastGrid(R)}<span id="pastMore" style="display:contents"></span>${s.kakari_only?'':'<span class="muted" style="font-size:13px;align-self:start;padding-top:4px">書類</span><span id="cDocs" style="display:flex;flex-wrap:wrap;gap:4px"></span>'}</div></div>`; /* 書類は在籍の［編集］と同じく係専用には出さない */
  m.querySelector('.dx').onclick=pastClose; m.onclick=e=>{ if(e.target===m) pastClose(); }; document.body.appendChild(m);
  if(!s.kakari_only) posDocs(s);
  const r=await sb.rpc('pos_staff_past_detail',{p_staff:s.id}); if(pastSel!==s) return;
  const more=$('pastMore'), D=r.data||{}, days=D.days||[], f=n=>Number(n||0).toLocaleString('ja-JP'), A=[];
  if(r.error) A.push(['体験の報酬',`<span style="color:var(--warn)">${/pos_staff_past_detail/.test(r.error.message)?'SQL 451 が未実行です':'表示できません：'+esc(r.error.message)}</span>`]);
  else if(D.pay_amount&&(s.is_trial||days.length)) A.push(['体験の報酬',`${D.pay_type==='daily'?'日給':'時給'} ${f(D.pay_amount)}円`]);
  if(days.length){ /* 日付・時刻・稼働時間・日払（立替）・受領済は幅を決めた枠に入れて、行ごとに縦の位置をそろえる */
    const col='flex:none;font-variant-numeric:tabular-nums;white-space:nowrap', W=[56,116,64,92,56];
    const cells=(...v)=>v.map((t,i)=>`<span style="${col};width:${W[i]}px${i===3?';text-align:right':''}">${t}</span>`).join('');
    const hrs=x=>{ const h=x.hours!=null?Number(x.hours):trialHours(x.in,x.out); return h==null?'':`${h}時間`; };
    if(days.some(x=>pastDay(x.day).split('/').length===3)) W[0]=92; /* 去年の日は年も出す */
    A.push(['体験日',`<div class="muted" style="display:flex;gap:10px;font-size:12px;padding-bottom:2px">${cells('日付','時刻','稼働時間','日払（立替）','')}</div>`
      +days.map((x,i)=>`<div data-pday="${x.day}" style="display:flex;align-items:center;gap:10px;padding:6px 0;${i?'border-top:1px solid var(--line)':''}">${cells(pastDay(x.day),x.in?`${hmJst(x.in)} 〜 ${x.out?hmJst(x.out):''}`:'',hrs(x),x.paid!=null?f(x.paid)+'円':'',x.rc?`<span class="badge" data-prc="${x.day}" style="cursor:pointer">受領済</span>`:'')}</div>`).join(''),true]);
  } else if(s.is_trial) A.push(['体験日',pastDay(s.day)]);
  more.innerHTML=pastGrid(A);
  more.querySelectorAll('[data-prc]').forEach(b=>b.onclick=()=>{ const x=days.find(y=>y.day===b.dataset.prc); if(x) openTrialPay(s,null,{},0,x.rc); });
}
