// ---------- 操作ログ（不正予防）：pos_audit_log に追記のみ。画面から消せない ----------
let DBLOG=false;
/* v12.78（通しの点検 2026-11-07・iPad 4〜5台）：通信が切れて返事が届かなかった時に押し直すと、二重に登録されていた（入出金・罰金・領収書・延長）
   → 失敗の後に同じ中身を登録する時は、前と同じ id で入れる。データベースに入っていたら「もうある」と断られるので、入ったものとする */
const insPend=new Map();
async function insOnce(t,row){ const k=t+JSON.stringify(row), pd=insPend.get(k), id=pd&&Date.now()-pd.at<600000?pd.id:crypto.randomUUID(); const r=await sb.rpc('pos_rows_add',{p_table:t,p:{...row,id}});
  if(r.error&&r.error.code==='23505'&&pd?.id===id){ const q=await sb.from(t).select('id').eq('id',id).maybeSingle(); if(q.data){ insPend.delete(k); return {data:null,error:null}; } }
  if(r.error) insPend.set(k,{id,at:Date.now()}); else insPend.delete(k); return r; }
/* bill を渡すと、その伝票の操作として残す（渡さない時は今開いている伝票） */
async function logOp(action, detail, reason, noBill, bill){ const B=bill||cur; try{ const { error } = await sb.rpc('pos_log_add',{p_store:store.id,p_bill:noBill?null:(B?.id||null),p_action:action,p_detail:{table:noBill?null:billTable(B)||null,...detail,...(opBy&&Date.now()-opBy.at<180000?{by:opBy.name}:{})},p_reason:reason||null}) /* SQL 430：入口の関数 */; opBy=null; if(error) console.warn('audit',error.message); }catch(e){ console.warn('audit',e); } }
// ブラウザ標準の確認・入力ダイアログ（サイト名が出る）を使わず、画面内のダイアログで聞く
/* 2026-11-08 オーナー：理由を空のまま OK を押した時は、箱を閉じずに赤で「理由を入力してください」（前は箱が閉じて 1.8秒の知らせで中止）。need＝空の時に出す文 */
function uiDlg(msg, withInput, def, need){ msg=jaNet(msg); return new Promise(res=>{ $('uiDlgMsg').textContent=msg; const inp=$('uiDlgIn'); let er=$('uiDlgErr'); if(!er){ er=document.createElement('div'); er.id='uiDlgErr'; er.style.cssText='color:var(--warn);font-size:14px;margin-top:6px'; inp.after(er); } er.textContent=''; inp.style.display=withInput?'':'none'; inp.value=def??''; inp.inputMode=(withInput&&/^\d+$/.test(String(def??'')))?'numeric':'text'; $('uiDlg').classList.add('on'); if(withInput) setTimeout(()=>{ inp.focus(); inp.select(); },50);
  const done=v=>{ $('uiDlg').classList.remove('on'); er.textContent=''; $('uiDlgOk').onclick=$('uiDlgNo').onclick=inp.onkeydown=null; res(v); };
  const ok=()=>{ if(need&&withInput&&!inp.value.trim()){ er.textContent=need; inp.focus(); return; } done(withInput?inp.value:true); };
  $('uiDlgOk').onclick=ok; $('uiDlgNo').onclick=()=>done(withInput?null:false); inp.onkeydown=e=>{ if(e.key==='Enter'&&!e.isComposing) ok(); }; }); }
UI.input=true; UI.box=async o=>{ if(!o.cancel) $('uiDlgNo').style.display='none'; try{ return await uiDlg(o.msg,!!o.input,o.def,o.need); } finally { $('uiDlgNo').style.display=''; } }; /* 知らせの箱の見た目（POS の小窓）。uiAlert・uiConfirm・uiPrompt は lib/olive/core.js */ /* v11.88：お金が減る操作（延長・注文の削除）は理由を必ず聞く。null＝やめた（ゲネプロ #44：×1回で消え、理由も残らなかった） */ /* v11.92：お金が動く操作は「入れた人」（黒服）を選ぶ。操作ログの detail.by に入り、日報メールに出る（ゲネプロ #42・見本 オ） */ let opBy=null; const askBy=async(ttl='入れた人（黒服）')=>{ opBy=null; const hs=staff.filter(x=>x.kind==='hall'); if(!hs.length) return ''; const v=await uiPick(ttl,hs.map(h=>({label:h.display_name,value:h.display_name}))); if(!v) return null; opBy={name:v,at:Date.now()}; return v; };
 const askWhy=async msg=>{ if(await askBy()===null) return null; const w=await uiDlg(msg+'\n理由を入力してください（必須・操作ログに残ります）',true,'','理由を入力してください'); if(w===null) return null; if(!w.trim()){ toast('理由を入力してください'); return null; } return w.trim(); };
// 選択肢から1つ選ぶダイアログ（キャンセルは null）
function uiPick(msg, opts){ return new Promise(res=>{ $('uiDlgMsg').textContent=msg; $('uiDlgIn').style.display='none'; let box=$('uiDlgPick'); if(!box){ box=document.createElement('div'); box.id='uiDlgPick'; box.style.cssText='display:flex;flex-direction:column;gap:8px;margin:12px 0'; $('uiDlgMsg').after(box); } box.innerHTML=opts.map((o,i)=>`<button class="ghost" data-pk="${i}" style="font-size:18px;padding:12px">${esc(o.label)}</button>`).join(''); $('uiDlgOk').style.display='none'; $('uiDlg').classList.add('on');
  const done=v=>{ $('uiDlg').classList.remove('on'); box.innerHTML=''; $('uiDlgOk').style.display=''; $('uiDlgNo').onclick=null; res(v); }; box.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>done(opts[Number(b.dataset.pk)].value)); $('uiDlgNo').onclick=()=>done(null); }); }
// v11.14・SQL 063：打刻の写真（タイムカードで撮ったもの）。在籍リストの時刻の横の📷で見る
const phBtn=p=>p?`<button class="ghost sm" data-ph="${esc(p)}" style="min-height:0;padding:0 6px;font-size:14px;border:0;background:none" aria-label="写真">${FX('camera',20)}</button>`:'';
async function showSelfie(path){ const r=await sb.storage.from('selfies').createSignedUrl(path,600); if(r.error||!r.data?.signedUrl){ toast('写真を出せません：'+(r.error?.message||'')); return; }
  const m=mkModal(60); m.innerHTML=`<div class="box" style="width:min(520px,94vw)"><button class="xb dx" data-x aria-label="閉じる">×</button><img src="${esc(r.data.signedUrl)}" alt="" style="width:100%;border-radius:10px;display:block"></div>`; document.body.appendChild(m); m.querySelector('[data-x]').onclick=()=>m.remove(); }
async function askReason(title){ const r=await uiDlg(title+'\n理由を入力してください（必須・操作ログに残ります）',true,'','理由を入力してください'); if(r===null) return null; if(!r.trim()){ toast('理由が未入力のため中止しました'); return null; } return r.trim(); }
function billEnd(b){ const ext=(b.bill_extensions||[]).reduce((a,e)=>a+e.minutes,0)+(b.ext_waived_minutes||0); return new Date(new Date(b.set_start).getTime()+(b.set_minutes+ext)*60000); }
