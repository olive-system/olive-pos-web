// ---------- 伝票の操作（客数・席移動・途中退店・来店時刻・サービス料） ----------
/* v12.30・SQL 291：客数の＋／−と自動の HC・BC の数はデータベースで1回で（2台で同時に押しても数が消えない）。記録は変えられた後 */
async function guestStep(d){ if(!cur) return; const r=await sb.rpc('pos_guest_step',{p_bill:cur.id,p_delta:d}); if(r.error){ if(await stale(r.error)) return; toast(r.error.message); return; }
  if(!r.data){ await staleReload('もう1台で会計済です'); return; } if(r.data.after!==r.data.before) await logOp('客数変更',{before:r.data.before,after:r.data.after}); await openBill(cur.id); }
$('gPlus').onclick=guard($('gPlus'),async()=>{ /* 通しチェック3：連打で自動HCのバックが二重になっていた */ await guestStep(1); });
$('gMinus').onclick=guard($('gMinus'),async()=>{ if(cur.guest_count<=1)return; await guestStep(-1); });
// 途中退店（v10.41）：過去のセット・延長・h.c・b.c はそのまま。次の延長から新しい人数。入金は通常の入金と同じ
/* v11.93：卓の名前に「卓」を足す（「1卓」はそのまま、「B」は「B卓」） */ const tk=n=>/卓$/.test(String(n||''))?String(n):`${n||''}卓`;
/* v11.93・SQL 163：席移動。空いている卓へ移す／お客様がいる卓なら伝票をまとめる（ゲネプロ #43・見本 ウ） */
$('bMove').onclick=guard($('bMove'),async()=>{ if(!cur||cur.status!=='open') return; const from=billTable(cur);
  const ob=await sb.from('bills').select('id,table_id,guest_count,bill_customers(customers(name))').eq('store_id',store.id).eq('status','open'); if(ob.error){ toast(ob.error.message); return; }
  const at=new Map((ob.data||[]).map(x=>[x.table_id,x])); const list=tables.filter(t=>t.id!==cur.table_id&&t.is_active!==false&&(!t.store_id||t.store_id===store.id));
  const tid=await uiPick('どの卓へ移しますか？',list.map(t=>{ const x=at.get(t.id); const nm=x?.bill_customers?.[0]?.customers?.name; return {label:x?`${t.name}　${nm?nm+' 様 ':''}${x.guest_count}名`:`${t.name}　空席`,value:t.id}; })); if(!tid) return;
  const to=tables.find(t=>t.id===tid)?.name||'', x=at.get(tid);
  if(!x){ if(!await uiConfirm(`${tk(from)} → ${tk(to)} に移しますか？`)) return; const r=await sb.rpc('pos_bill_move',{p_bill:cur.id,p_table:tid}); if(r.error){ await uiAlert(/pos_bill_move/.test(r.error.message)?'SQL 163 が未実行です':r.error.message); return; } toast(`${tk(to)}に移しました`); await openBill(cur.id); return; }
  if(!await uiConfirm(`${tk(to)}にはお客様がいます。\n${tk(to)}の伝票とまとめますか？\n（${x.guest_count}名＋${cur.guest_count}名＝${x.guest_count+cur.guest_count}名。セットは${tk(to)}の来店の時刻のまま）`)) return;
  const r=await sb.rpc('pos_bill_merge',{p_from:cur.id,p_to:x.id}); if(r.error){ await uiAlert(/pos_bill_merge/.test(r.error.message)?'SQL 163 が未実行です':r.error.message); return; } toast(`${tk(to)}の伝票にまとめました`); await openBill(x.id); });
$('gLeave').onclick=guard($('gLeave'),async()=>{ if(!cur||cur.status!=='open'||cur.guest_count<2) return; const gb=cur.guest_count, ru=Number(settings?.total_round_unit)||1000, up=x=>Math.ceil(x/ru)*ru; /* v12.47：店の「合計の切り上げ単位」（管理サイト POS設定。銀座 1000・広島 100） */ const due=up(cur.totals?.amount_due??0), unpaid=Math.max(0,cur.totals?.unpaid??0); let n=1; if(gb>2){ n=await uiPick('退店人数',Array.from({length:gb-1},(_,k)=>({label:`${k+1}名`,value:k+1}))); if(!n) return; } const share=Math.min(unpaid,up(unpaid/gb)*n);
  const av=await uiPrompt(`途中退店（${gb}名→${gb-n}名）\n今の請求額 ${yen(due)}\nお支払い金額`,share); if(av===null) return; const v=numIn(av); if(isNaN(v)||v<0){ toast('金額が正しくありません'); return; } if(v>unpaid){ toast(`未収は ${yen(unpaid)} です`); return; }
  let method=null; if(v>0){ method=await uiPick('お支払い方法',[{label:METHOD.cash,value:'cash'},{label:METHOD.card,value:'card'}]); if(!method) return; }
  if(!await uiConfirm(`途中退店（${gb}名→${gb-n}名）\n${v>0?`${METHOD[method]} ${yen(v)}`:'お支払いなし'}\n確定しますか？`)) return;
  /* v12.30・SQL 291：入金・退店の記録・人数を1回で（途中で切れても半端に残らない。もう1台で人数が変わっていたら止める） */
  const p=await cashClosed(()=>sb.rpc('pos_mid_leave',{p_bill:cur.id,p_guests:gb,p_left:n,p_amount:v,p_method:method,p_due:due,p_share:share}),`途中退店の現金（${tblName()} ${yen(v)}）`); /* v12.07・SQL 220 */ if(p.error){ if(p.error.cancel) return; if(await stale(p.error)) return; toast(p.error.message); return; }
  await logOp('途中退店',{before:gb,after:gb-n,left:n,total:due,amount:v,method:method?METHOD[method]:null}); openBill(cur.id); });
// 来店時刻の変更（v10.41）：セットの終了・延長・同伴①②を新しい時刻で計算し直す
function uiTimeHM(def,bd){ return new Promise(res=>{ const st=new Date(`${bd||businessDate()}T08:00:00+09:00`).getTime();
  const d0=Math.max(st,new Date(def).getTime());
  const m=mkModal(60);
  m.innerHTML=`<div class="box" style="width:320px"><div style="display:flex;gap:8px;align-items:center;justify-content:center;font-size:20px"><select data-ut="h" style="font-size:22px"></select>時<select data-ut="m" style="font-size:22px"></select>分</div><div class="bar" style="justify-content:flex-end"><button class="ghost" data-ut="no">キャンセル</button><button class="primary" data-ut="ok">決定</button></div></div>`;
  document.body.appendChild(m);
  const H=m.querySelector('[data-ut=h]'), M=m.querySelector('[data-ut=m]');
  const kmax=Math.max(0,Math.min(23,Math.floor((Date.now()-st)/3600000)));
  let hs='';
  for(let k=0;k<=kmax;k++) hs+=`<option value="${k}">${(8+k)%24}</option>`;
  H.innerHTML=hs;
  let ms='';
  for(let i=0;i<60;i++) ms+=`<option value="${i}">${String(i).padStart(2,'0')}</option>`;
  M.innerHTML=ms;
  const dk=Math.min(kmax,Math.floor((d0-st)/3600000));
  H.value=String(dk);
  M.value=String(Math.min(59,Math.floor((d0-st-dk*3600000)/60000)));
  const done=v=>{ m.remove();
  res(v);
  };
  m.querySelector('[data-ut=no]').onclick=()=>done(null);
  m.querySelector('[data-ut=ok]').onclick=()=>done(new Date(st+Number(H.value)*3600000+Number(M.value)*60000).toISOString());
  });
  }
$('bTime').onclick=async()=>{ if(!cur||cur.status!=='open') return; const v=await uiTimeHM(cur.set_start,cur.business_date); if(!v) return; if(new Date(v).getTime()>Date.now()){ toast('今より後の時刻にはできません'); return; } const before=cur.set_start; if(Math.abs(new Date(v).getTime()-new Date(before).getTime())<60000) return;
  const u=await sb.rpc('pos_rows_set',{p_table:'bills',p_where:{id:(cur.id)??null},p:{opened_at:v,set_start:ceil5(v).toISOString()}}); if(u.error){ toast(u.error.message); return; } await logOp('来店時刻の変更',{before:hmJst(before),after:hmJst(v)});
  const nr=douhanRole(v); for(const c of (cur.bill_casts||[]).filter(c=>isDouhan(c.role)&&c.role!==nr)) await sb.rpc('pos_rows_set',{p_table:'bill_casts',p_where:{id:(c.id)??null},p:{role:nr}});
  const b2={...cur,set_start:ceil5(v).toISOString()}; let ex=[...(cur.bill_extensions||[])]; const now=new Date();
  for(;;){ const last=[...ex].reverse().find(e=>e.is_auto); if(!last) break; const rest=ex.filter(e=>e!==last); if(billEnd({...b2,bill_extensions:rest})<now) break; const r=await sb.rpc('pos_rows_del',{p_table:'bill_extensions',p_where:{id:(last.id)??null}}); if(r.error) break; ex=rest; }
  if(billEnd({...b2,bill_extensions:ex})<now){ const r=await sb.rpc('pos_auto_extend',{p_bill:cur.id}); if(r.error) toast(/pos_auto_extend/.test(r.error.message)?'SQL 067 が未実行です（自動延長）':r.error.message); } // v11.18：自動延長はデータベースで足す
  openBill(cur.id); };

$('svcBtn').onclick=()=>{ const m=modes.find(x=>x.id===cur.pricing_mode_id); $('svcNow').textContent=`現在：${m?.name||'通常'}　サービス料 ${cur.totals.service_rate}%${cur.service_rate_override!=null?'（この伝票だけ変更中）':''}`; $('svcRate').value=cur.totals.service_rate; $('svcModal').classList.add('on'); };
$('svcCancel').onclick=()=>$('svcModal').classList.remove('on');
$('svcRateOk').onclick=async()=>{ const v=parseFloat($('svcRate').value); if(isNaN(v)||v<0||v>100){toast('0〜100で入力してください');return;} const normal=modes.find(m=>m.code==='normal'); await logOp('サービス料率変更',{before:cur.totals?.service_rate,after:v}); const { error } = await sb.rpc('pos_rows_set',{p_table:'bills',p_where:{id:(cur.id)??null},p:{service_rate_override:v===Number(settings.service_rate)?null:v,pricing_mode_id:normal.id,fixed_total:null}}); if(error){toast(error.message);return;} $('svcModal').classList.remove('on'); openBill(cur.id); };
$('svcNormal').onclick=async()=>{ { const up=await sb.rpc('pos_rows_set',{p_table:'bills',p_where:{id:(cur.id)??null},p:{service_rate_override:null}}); if(up.error){ toast('サービス料率を変更できません：'+up.error.message); return; } } await logOp('サービス料率を既定に戻す',{before:cur.totals?.service_rate}); $('svcModal').classList.remove('on'); openBill(cur.id); };

