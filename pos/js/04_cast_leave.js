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
