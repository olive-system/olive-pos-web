// ---------- bill ----------
const BILL_SEL='*, bill_casts(id,staff_id,role,is_kakari), bill_extensions(id,minutes,unit_price,qty,is_auto), bill_items(id,product_id,category_id,name,qty,unit_price,cast_subtotal_price,back_amount,back_points,is_service_target,is_keep,added_at,is_void,bill_item_splits(id,staff_id,sales_amount,back_amount,back_points)), bill_customers(customer_id), bill_adjustments(id,kind,amount,reason), payments(*), bill_tags(id,kind,tag_no,memo,returned_at)';
/* 伝票を続けて開いた時（2回押す・すぐ別の卓）、先に始めた方が後の伝票（金額がまだ無い）を描いて止まった。最後に開いた方だけが描く */
let openBillSeq=0;
async function openBill(id){ const my=++openBillSeq; if(!cur||cur.id!==id) extOpen=false;
  const { data, error } = await sb.from('bills').select(BILL_SEL).eq('id',id).single();
  if (error) { toast(error.message);
    return;
    } cur=data;
    billFp=fpOf(data);
    { const dp=await sb.from('bill_departures').select('payment_id').eq('bill_id',id);
    cur.depPays=new Set((dp.data||[]).map(x=>x.payment_id).filter(Boolean));
    } if((cur.bill_customers||[]).some(x=>!customers.some(c=>c.id===x.customer_id))) await cuFresh();
    /* ほかの iPad で登録したお客様 */ if(cur.status==='open'){ const ind=modes.find(m=>m.code==='industry'), normal=modes.find(m=>m.code==='normal');
    const isI=cur.pricing_mode_id===ind?.id;
    let want=(cur.bill_customers||[]).some(x=>customers.find(c=>c.id===x.customer_id)?.is_industry);
    if(ind&&normal&&want!==isI){ await cuFresh();
    want=(cur.bill_customers||[]).some(x=>customers.find(c=>c.id===x.customer_id)?.is_industry);
    } /* 切り替える前に、ほかの iPad の変更を読む（古い一覧で同業を解除していた） */ if(ind&&normal&&want!==isI){ const u=await sb.rpc('pos_rows_set',{p_table:'bills',p_where:{id:(id)??null},p:{pricing_mode_id:want?ind.id:normal.id,fixed_total:null}});
    if(!u.error){ cur.pricing_mode_id=want?ind.id:normal.id;
    billFp=fpOf(cur);
    await logOp(want?'同業に切替':'同業を解除',{auto:true});
    } } } const r=await sb.rpc('calc_bill',{p_bill:id});
    if(r.error){ toast('伝票の金額を読み込めません：'+r.error.message);
    return;
    } cur.totals=r.data||{};
    if(cur.status==='open') hallPut(id,r.data);
    /* ホールの金額も最新に */ /* 通しチェック3：読めない時に0円と出て、置きの残額を消すことがあった */ present=await updateCastBadge();
    if(!staffAll.length) await loadStaffAll();
    if(my!==openBillSeq||!cur||!cur.totals) return;
    renderBill();
    show('v-bill');
    }
let present=new Set(); const TAGK={coat:'コート',bag:'バッグ',umbrella:'傘',other:'その他'};
// お誕生日リマインド：前後21日以内なら伝票とホール状況に表示
function bdayDiff(bd){ const m=String(bd||'').match(/^(\d{1,2})\/(\d{1,2})$/); if(!m) return null; const [y,mo,d]=businessDate().split('-').map(Number); const today=new Date(y,mo-1,d); let best=null; for(const yy of [y-1,y,y+1]){ const diff=Math.round((new Date(yy,+m[1]-1,+m[2])-today)/86400000); if(best===null||Math.abs(diff)<Math.abs(best)) best=diff; } return Math.abs(best)<=21?best:null; }
function bdayLines(b){ return (b.bill_customers||[]).map(x=>customers.find(c=>c.id===x.customer_id)).filter(Boolean).map(c=>{ const n=bdayDiff(c.birthday); return n===null?null:`${c.name} 様　お誕生日 ${c.birthday}（${n===0?'本日':n>0?`あと${n}日`:`${-n}日前`}）`; }).filter(Boolean); }
// 反応◎・同伴はその営業日に出勤した（出勤か同伴の打刻がある）キャストだけ
/* 出勤の一覧は20秒の間は読み直さない（ホールの描き直しのたびに読んでいた）。打刻した時・在籍リストを開いた時は読み直す */
let attC={}; const attDrop=()=>{ attC={}; };
/* 読めない時に空にすると「＋同伴」「＋反応◎」の選ぶ欄と出勤の人数が黙って0になるので、前に読めた分を使う */ const attOk={};
function attendedOn(bd){ const c=attC[bd]; if(c&&Date.now()-c.at<20000) return c.p.then(x=>new Set(x)); const p=sb.from('attendance_events').select('staff_id').eq('business_date',bd).in('event_type',['clock_in','douhan']).then(r=>{ if(r.error){ if(attC[bd]&&attC[bd].p===p) delete attC[bd]; return new Set(attOk[bd]||[]); } const s=new Set((r.data||[]).map(e=>e.staff_id)); attOk[bd]=s; return s; }); attC[bd]={at:Date.now(),p}; return p.then(x=>new Set(x)); }
// 反応◎（お客様の反応が良かったキャスト。1伝票に同じ人は1回。営業中の伝票だけ付け外しできる）
async function renderGood(b){ const box=$('bGood'), sel=$('goodAdd'); if(!box||!sel) return; const r=await sb.from('good_reactions').select('id,staff_id').eq('bill_id',b.id); if(cur!==b) return; if(r.error){ box.innerHTML=''; sel.style.display='none'; return; } if(!staffAll.length) await loadStaffAll(); const att=await attendedOn(b.business_date); if(cur!==b) return;
  const gl=r.data||[]; const nm=id=>staffAll.find(x=>x.id===id)?.display_name||''; const open=b.status==='open';
  box.innerHTML=gl.map(x=>`<span style="display:inline-flex;align-items:center;gap:2px;font-size:13px;line-height:1.2;padding:4px ${open?'2px':'10px'} 4px 10px;border:1px solid var(--line);border-radius:999px;background:#fff">${esc(nm(x.staff_id))}<span style="color:var(--gold)">◎</span>${open?`<button class="xb" data-rmgood="${x.id}">×</button>`:''}</span>`).join('');
  box.querySelectorAll('[data-rmgood]').forEach(x=>x.onclick=async()=>{ const g=gl.find(z=>z.id===x.dataset.rmgood); const d=await sb.rpc('pos_good_del',{p_id:x.dataset.rmgood}); if(d.error){ toast(d.error.message); return; } await logOp('反応◎を取り消し',{name:nm(g?.staff_id)}); renderGood(cur); });
  const have=new Set(gl.map(x=>x.staff_id)); const cands=staffAll.filter(s=>s.is_active&&s.kind==='cast'&&!s.kakari_only&&!have.has(s.id)&&att.has(s.id));
  sel.style.display=open?'':'none'; sel.innerHTML='<option value="">＋反応◎</option>'+cands.map(s=>`<option value="${s.id}">${esc(s.display_name)}</option>`).join('');
  sel.onchange=async()=>{ const id=sel.value; if(!id) return; sel.disabled=true; const ins=await sb.rpc('pos_good_add',{p_store:store.id,p_bill:b.id,p_staff:id}); sel.disabled=false; if(ins.error&&!ins.error.message.includes('duplicate')) toast(ins.error.message); else if(!ins.error) await logOp('反応◎',{name:nm(id)}); renderGood(cur); }; }
// 伝票一覧の行に 係・同伴・反応◎ を小さく表示。会計済の伝票は当日だけ［編集］で変更できる（翌営業日以降は変更不可）
const snm2=id=>staffAll.find(x=>x.id===id)?.display_name||'';
function billPeopleChips(b,gr,editable){ const cs=b.bill_casts||[]; const ch=(txt,col)=>`<span style="font-size:12px;padding:2px 8px;border:1px solid var(--line);border-radius:999px;background:#fff;color:${col||'var(--ink)'};white-space:nowrap">${txt}</span>`;
  const parts=[...cs.filter(c=>c.is_kakari).map(c=>ch(''+KL+' '+esc(snm2(c.staff_id)))),...cs.filter(c=>isDouhan(c.role)).map(c=>ch(esc(ROLE[c.role])+' '+esc(snm2(c.staff_id)))),...gr.map(id=>ch(esc(snm2(id))+'<span style="color:var(--gold)">◎</span>'))];
  return `<span style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:flex-end;margin:0 14px 0 auto;max-width:45%">${parts.join('')}${editable?`<button class="ghost sm" data-bpe="${b.id}" style="font-size:12px;padding:2px 10px;min-height:0">編集</button>`:''}</span>`; }
async function billPeopleEdit(id){ let box=$('uiDlgList'); if(!box){ box=document.createElement('div'); box.id='uiDlgList'; box.style.cssText='max-height:60vh;overflow:auto;margin:10px 0;font-size:15px'; $('uiDlgMsg').after(box); } if(!staffAll.length) await loadStaffAll();
  let b=null; const hc=()=>syncHcBack(id); /* 今開いている伝票（cur）を差し替えずに、この伝票を振り分ける */
  const L=(action,d)=>logOp(action,d,undefined,false,b); /* 今開いている伝票（cur）を差し替えずに、この伝票の操作として残す */
  const draw=async()=>{ const r=await sb.from('bills').select('id,status,table_id,table_name,guest_count,opened_at,business_date,bill_casts(id,staff_id,role,is_kakari),payments(method,amount,received_at,revenue_date)').eq('id',id).single(); if(r.error){ box.innerHTML=`<div class="muted">${esc(r.error.message)}</div>`; return; } b=r.data;
    const ok=b.status==='closed'&&billDay(b)===businessDate(); const g=await sb.from('good_reactions').select('id,staff_id').eq('bill_id',id); const gl=g.data||[]; const cs=b.bill_casts||[]; const att=await attendedOn(b.business_date);
    box.innerHTML=billPeopleHtml(ok,cs,gl,att);
    box.querySelectorAll('[data-bprm]').forEach(x=>x.onclick=async()=>{ const c=cs.find(z=>z.id===x.dataset.bprm); const d=await sb.rpc('pos_rows_del',{p_table:'bill_casts',p_where:{id:(c.id)??null}}); if(d.error){ toast(d.error.message); return; } await L('キャストを伝票から外す（会計後）',{name:snm2(c.staff_id)}); if(c.is_kakari) await hc(); draw(); });
    box.querySelectorAll('[data-bpg]').forEach(x=>x.onclick=async()=>{ const gg=gl.find(z=>z.id===x.dataset.bpg); const d=await sb.rpc('pos_good_del',{p_id:gg.id}); if(d.error){ toast(d.error.message); return; } await L('反応◎を取り消し',{name:snm2(gg.staff_id)}); draw(); });
    box.querySelectorAll('[data-bp]').forEach(s=>s.onchange=()=>billPeopleAdd(s,id,b,cs,L,hc,draw)); };
  await draw(); const tn=billTable(b); try{ await uiAlert(`${tn}　${b?hm5(b.opened_at):''}〜　${KL}・同伴・反応◎`); } finally { box.remove(); } }
/* 会計後の伝票に係・同伴・反応◎を足す（選んだ時） */
async function billPeopleAdd(s,id,b,cs,L,hc,draw){
  const sid=s.value; if(!sid) return; s.disabled=true; const k=s.dataset.bp; const ex=cs.find(c=>c.staff_id===sid); let e=null, kak=false;
  if(k==='g'){ e=(await sb.rpc('pos_good_add',{p_store:store.id,p_bill:id,p_staff:sid})).error; if(!e) await L('反応◎',{name:snm2(sid)}); }
  else if(k==='k'){ kak=true; e=ex?(await sb.rpc('pos_rows_set',{p_table:'bill_casts',p_where:{id:(ex.id)??null},p:{is_kakari:true}})).error:(await sb.rpc('pos_rows_add',{p_table:'bill_casts',p:{bill_id:id,staff_id:sid,role:'none',is_kakari:true}})).error; if(!e) await L('係を追加（会計後）',{name:snm2(sid)}); }
  else { if(cs.filter(c=>isDouhan(c.role)).length>=b.guest_count){ toast(`同伴は客数（${b.guest_count}名）までです`); draw(); return; } const role=douhanRole(b.opened_at); kak=!!settings.douhan_is_kakari; e=ex?(await sb.rpc('pos_rows_set',{p_table:'bill_casts',p_where:{id:(ex.id)??null},p:kak?{role,is_kakari:true}:{role}})).error:(await sb.rpc('pos_rows_add',{p_table:'bill_casts',p:{bill_id:id,staff_id:sid,role,is_kakari:kak}})).error; if(!e) await L('同伴を追加（会計後）',{name:snm2(sid),kind:ROLE[role]}); }
  if(e){ toast(e.message); } else if(kak) await hc(); draw(); }
/* 会計後の伝票の係・同伴・反応◎の小窓の文 */
function billPeopleHtml(ok,cs,gl,att){
  const act=staffAll.filter(s=>s.is_active&&(s.kind==='cast'||s.kakari_only)); const opt=(list,ph)=>`<option value="">${ph}</option>`+list.map(s=>`<option value="${s.id}">${esc(s.display_name)}</option>`).join('');
  const sel=(k,ph,list)=>`<select data-bp="${k}" style="width:auto;min-height:0;font-size:14px;padding:6px 10px">${opt(list,ph)}</select>`;
  return !ok?'<div class="muted">この伝票は当日ではないため変更できません</div>':
      `<div class="muted" style="font-size:13px">${KL}・同伴</div>`+(cs.filter(c=>c.is_kakari||isDouhan(c.role)).map(c=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span style="flex:1">${esc(snm2(c.staff_id))} <small class="muted">${[c.is_kakari?''+KL+'':'',ROLE[c.role]||''].filter(Boolean).join('・')}</small></span><button class="xb" data-bprm="${c.id}">×</button></div>`).join('')||'<div class="muted" style="padding:6px 0">なし</div>')+
      `<div style="display:flex;gap:8px;margin:8px 0 14px">${sel('k','＋'+KL+'',act.filter(s=>!cs.some(c=>c.staff_id===s.id&&c.is_kakari)))}${sel('d','＋同伴',act.filter(s=>!s.kakari_only&&!cs.some(c=>c.staff_id===s.id&&isDouhan(c.role))))}</div>`+
      `<div class="muted" style="font-size:13px">反応◎</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">${gl.map(x=>`<span style="display:inline-flex;align-items:center;font-size:14px;padding:3px 2px 3px 10px;border:1px solid var(--line);border-radius:999px">${esc(snm2(x.staff_id))}<span style="color:var(--gold)">◎</span><button class="xb" data-bpg="${x.id}">×</button></span>`).join('')}${sel('g','＋反応◎',staffAll.filter(s=>s.is_active&&s.kind==='cast'&&!s.kakari_only&&att.has(s.id)&&!gl.some(x=>x.staff_id===s.id)))}</div>`;
}
function renderBill(){ const b=cur, t=tables.find(x=>x.id===b.table_id);
  const mode=modes.find(m=>m.id===b.pricing_mode_id); const T0=b.totals;
  const R={b,t,mode,T0};
  rbHead(R); rbTags(R); rbCust(R); rbCasts(R); rbSetHtml(R); rbSetBind(R);
  Object.assign(R,rbItemKit(R)); rbItems(R); rbItemBind(R); rbTotals(R); }
/* 伝票の上：お誕生日・卓・しるし */
function rbHead(R){ const {b,t,mode,T0,items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}=R;
  { let bb=$('bBday'); if(!bb){ bb=document.createElement('div'); bb.id='bBday'; $('v-bill').querySelector('.card').prepend(bb); } const ls=b.status==='void'?[]:bdayLines(b); bb.style.cssText=ls.length?'background:var(--gold-soft);border:2px solid var(--brand);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:20px;font-weight:700;color:var(--brand-d)':'display:none'; bb.innerHTML=ls.map(x=>FX('birthdaycake',22)+' '+esc(x)).join('<br>'); }
  $('bTable').innerHTML=`<small class="muted" style="font-size:14px;font-weight:400">卓</small> ${esc(billTable(b))}`; $('bGuests').textContent=b.guest_count; $('bTime').textContent=`${hm5(b.set_start)}〜${hm5(billEnd(b))}`;
  $('bFlags').innerHTML=(t?.vip_set_fee>0?'<span class="badge warnb">VIP卓</span>':'')+(b.status!=='open'&&!isOki(b)?`<span class="badge gray">${b.status==='void'?'削除済':'会計済'}</span>`:'')+(mode&&mode.code!=='normal'?`<span class="badge warnb">${esc(mode.name)}</span>`:'')+(b.service_rate_override!=null?`<span class="badge warnb">サ料 ${b.service_rate_override}%</span>`:'')+((b.bill_tags||[]).filter(t=>!t.returned_at).length?`<span class="badge tag">${FX('label')} お預かり ${(b.bill_tags||[]).filter(t=>!t.returned_at).length}</span>`:'');
}
/* 札（お預かり） */
function rbTags(R){ const {b,t,mode,T0,items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}=R;
  $('bTags').innerHTML=(b.bill_tags||[]).filter(t=>!t.returned_at).map(t=>`<div class="item"><span class="n">${FX('label')} ${TAGK[t.kind]||esc(t.kind)} ${t.tag_no?'#'+esc(t.tag_no):''} <small>${esc(t.memo||'')}</small></span><button class="xb" data-tagdel="${t.id}" aria-label="削除">×</button></div>`).join('');
  $('bTags').querySelectorAll('[data-tagdel]').forEach(x=>x.onclick=guard(x,async()=>{ const tg=(b.bill_tags||[]).find(z=>z.id===x.dataset.tagdel), nm=`${TAGK[tg?.kind]||tg?.kind||''}${tg?.tag_no?' #'+tg.tag_no:''}`; /* 付け間違い・先に帰るお客様の分 */
    if(!await uiConfirm(`${nm} を削除しますか？`)) return; const q=await sb.rpc('pos_tag_del',{p_id:tg.id}); if(q.error){ toast('削除できません：'+q.error.message); return; } await logOp('お預かり削除',{kind:TAGK[tg?.kind],tag_no:tg?.tag_no}); openBill(b.id); }));
}
/* お客様 */
function rbCust(R){ const {b,t,mode,T0,items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}=R;
  $('bCust').innerHTML=(b.bill_customers||[]).map(c=>{ const cu=customers.find(x=>x.id===c.customer_id); return `<div class="item"><span class="n">${esc(cu?.name||'')}</span><button class="xb" data-rmcust="${c.customer_id}">×</button></div>`; }).join('');
  $('bCust').querySelectorAll('[data-rmcust]').forEach(x=>x.onclick=async()=>{ { const dl=await sb.rpc('pos_rows_del',{p_table:'bill_customers',p_where:{bill_id:(b.id)??null,customer_id:(x.dataset.rmcust)??null}}); if(dl.error){ toast(dl.error.message); return; } } await logOp('お客様を伝票から外す',{customer:customers.find(z=>z.id===x.dataset.rmcust)?.name}); openBill(b.id); }); /* 外せたのを確かめてから記録 */
}
/* 係・同伴・反応◎ */
function rbCasts(R){ const {b,t,mode,T0,items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}=R;
  $('bCasts').innerHTML=(b.bill_casts||[]).map(c=>`<div class="item cast"><span class="n"><span class="nm">${present.has(c.staff_id)?'✓ ':''}${esc(snm(c.staff_id))}</span> ${c.is_kakari?'<span class="badge k">'+KL+'</span>':''} ${ROLE[c.role]?`<span class="badge">${ROLE[c.role]}</span>`:''}${present.has(c.staff_id)||staffAll.find(z=>z.id===c.staff_id)?.kakari_only?'':' <span class="badge gray">未出勤</span>'}</span><div class="btns"><button class="xb" data-rmcast="${c.id}">×</button></div></div>`).join('');
  $('bCasts').querySelectorAll('[data-rmcast]').forEach(x=>x.onclick=async()=>{ const bc=(b.bill_casts||[]).find(c=>c.id===x.dataset.rmcast); { const dl=await sb.rpc('pos_rows_del',{p_table:'bill_casts',p_where:{id:(x.dataset.rmcast)??null}}); if(dl.error){ toast('キャストを外せません：'+dl.error.message); return; } } await logOp('キャストを伝票から外す',{name:snm(bc?.staff_id)}); if(bc?.is_kakari) await syncHcBack(); /* その人のバックが付いた注文が残っていたら知らせる（ゲネプロ #51） */ const left=(b.bill_items||[]).filter(i=>!i.is_void&&i.name!=='HC'&&(i.bill_item_splits||[]).some(sp=>sp.staff_id===bc?.staff_id)).map(i=>`${i.name}×${i.qty}`); await openBill(b.id); if(left.length) await uiAlert(`${snm(bc?.staff_id)} のバックが付いた注文が残っています。\n${left.join('・')}\n修正する時は、注文の「振分」を押してください`); });
  renderGood(b); // 反応◎
}
/* セット・VIP・延長 */
function rbSetHtml(R){ const {b,t,mode,T0,items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}=R;
  $('bSet').innerHTML=`<div class="item"><span class="n">1セット ${b.set_minutes}分<br><small>${yen(b.set_unit_price)}×${b.set_guest_count??b.guest_count}</small></span><span class="amt">${yen(b.set_unit_price*(b.set_guest_count??b.guest_count))}</span></div>`+
    (t?.vip_set_fee>0&&!b.vip_set_off?`<div class="item" style="flex-wrap:nowrap;gap:6px"><span class="n" style="white-space:nowrap"><span class="badge warnb">VIP</span> VIP代</span><span class="amt">${yen(b.totals?.vip_set??t.vip_set_fee)}</span><button class="xb" data-vipoff aria-label="削除">×</button></div>`:'')+ /* VIP代は × で外せる（サービス） */ /* 金額は calc_bill の値（会計済みの伝票は会計した時の VIP代） */
    (()=>{ const ex=b.bill_extensions||[]; if(!ex.length) return ''; const tot=ex.reduce((a,e)=>a+e.unit_price*e.qty,0), mins=ex.reduce((a,e)=>a+e.minutes,0);
      return `<div class="item" id="extSum" style="cursor:pointer"><span class="n">${settings.ext_minutes}分延長 ×${ex.length}<br><small>計${mins}分 ${extOpen?'▲ 閉じる':'▼ 内訳'}</small></span><span class="amt">${yen(tot)}</span></div>`+
        (extOpen?ex.map(e=>`<div class="item" style="margin-left:16px"><span class="n">延長 ${e.minutes}分 <small>${e.is_auto?'自動':'手動'} ${yen(e.unit_price)}×${e.qty}</small></span><span class="amt">${yen(e.unit_price*e.qty)}</span><button class="xb" data-ext="${e.id}">×</button></div>`).join(''):'')+
        (t?.vip_ext_fee>0?`<div class="item"><span class="n">VIP${settings.ext_minutes}分延長 ×${ex.length}</span><span class="amt">${yen(b.totals?.vip_ext??t.vip_ext_fee*ex.length)}</span></div>`:''); })()+
    (b.ext_waived_minutes>0?`<div class="muted" style="font-size:12px;padding:2px 4px">削除した延長 ${b.ext_waived_minutes}分（料金なし）</div>`:'')+
    (t?.vip_set_fee>0&&b.vip_set_off?`<div class="muted" style="font-size:12px;padding:2px 4px">削除した VIP代（料金なし）</div>`:'');
}
function rbSetBind(R){ const {b,t,mode,T0,items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}=R;
  if($('extSum')) $('extSum').onclick=()=>{ extOpen=!extOpen; openBill(b.id); };
  $('bSet').querySelectorAll('[data-vipoff]').forEach(x=>x.onclick=async()=>{ const why=await askWhy(`VIP代 ${yen(t.vip_set_fee)} を削除します。`); if(why===null) return; { const up=await sb.rpc('pos_rows_set',{p_table:'bills',p_where:{id:(b.id)??null},p:{vip_set_off:true}}); if(up.error){ if(await stale(up.error)) return; toast('VIP代を削除できません：'+up.error.message); return; } } await logOp('VIP代削除',{table:t.name,amount:t.vip_set_fee},why); openBill(b.id); });
  $('bSet').querySelectorAll('[data-ext]').forEach(x=>x.onclick=async()=>{ const e=(b.bill_extensions||[]).find(z=>z.id===x.dataset.ext); const why=await askWhy(`延長 ${e?.minutes??''}分 ${yen(e?e.unit_price*e.qty:0)} を削除します。`); if(why===null) return; { const dl=await sb.rpc('pos_rows_del',{p_table:'bill_extensions',p_where:{id:(x.dataset.ext)??null}}); if(dl.error){ if(await stale(dl.error)) return; toast('延長を削除できません：'+dl.error.message); return; } } await logOp('延長削除',{minutes:e?.minutes,amount:e?e.unit_price*e.qty:null,is_auto:e?.is_auto},why);
    // 削除後に時間が足りなくなる分は「料金なしの延長」として記録（自動延長で復活しないように）
    const rest=(b.bill_extensions||[]).filter(z=>z.id!==x.dataset.ext); const endAfter=billEnd({...b,bill_extensions:rest});
    if(e&&endAfter<new Date()){ const r=await sb.rpc('pos_ext_waive',{p_bill:b.id,p_minutes:e.minutes}); if(r.error) toast(r.error.message); } /* 今の値に足す（2台同時でも消えない） */
    openBill(b.id); });
}
/* 注文の行の部品（ボトルかどうか・値段や数を変えられるか・1行の形） */
function rbItemKit(R){ const {b,t,mode,T0}=R;
  const items=(b.bill_items||[]).filter(i=>!i.is_void); const grp=groupItems(items), gOf=id=>grp.find(g=>g.id===id); /* 同じ注文は1行にまとめる（×・金額・振分・数量はまとめた注文の全部に） */
  const isBottle=i=>{ const p=products.find(x=>x.id===i.product_id); const cn=categories.find(c=>c.id===(i.category_id||p?.category_id))?.name||''; return !!p?.is_keepable||/シャンパン|ワイン|ボトル|焼酎|ウイスキー|ウィスキー|ブランデー/.test(cn); };
  const priceEdit=i=>(!!settings.auto_hc_product_id&&i.product_id===settings.auto_hc_product_id)||/^h\.?c/i.test(i.name||''); // 伝票上で金額を変えられるのは h.c だけ。ほかは枠なしの文字
  const qtyEdit=i=>noBack(i)&&!isBottle(i)&&!priceEdit(i)&&!i.is_keep&&!/^(HC|BC)$/i.test(i.name||''); // 数量を変えられるのはバックが無い品だけ（ボトル・HC・BC・h.c は対象外）
  const itemRow=i=>{ const sp=(i.bill_item_splits||[]).map(s=>staff.find(x=>x.id===s.staff_id)?.display_name).filter(Boolean).join('/');
    return `<div class="item" style="flex-wrap:nowrap;gap:6px;padding-left:8px;padding-right:8px"><span class="n" style="flex:1 1 0;min-width:0">${esc(i.name)} ${qtyEdit(i)?`<span class="qb" data-qty="${i.id}">×${i.qty}</span>`:`×${i.qty}`}${noBack(i)?'':`<br><small>${sp?'バック:'+esc(sp):'バックなし'}</small> <button class="ghost sm" data-split="${i.id}">振分</button>`}</span>${priceEdit(i)?`<button class="ghost sm amt" data-price="${i.id}" style="min-width:0;flex:0 0 auto;white-space:nowrap">${yen(i.unit_price*i.qty)}</button>`:`<span class="amt" style="min-width:0;flex:0 0 auto;white-space:nowrap">${yen(i.unit_price*i.qty)}</span>`}<button class="xb" data-del="${i.id}">×</button></div>`; }; /* × はどの行も右端にそろえる（振分はバックの人の横） */
  return {items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}; }
/* 注文（ボトルとそのほか） */
function rbItems(R){ const {b,t,mode,T0,items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}=R;
  $('bItems').innerHTML=grp.filter(isBottle).map(itemRow).join('')||'<div class="muted">なし</div>';
  $('bItems2').innerHTML=grp.filter(i=>!isBottle(i)).map(itemRow).join('')||'<div class="muted">なし</div>';
}
/* 注文の値段・取消・振分・数量 */
function rbItemBind(R){ const {b,t,mode,T0,items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}=R;
  $('bOrders').querySelectorAll('[data-price]').forEach(x=>x.onclick=async()=>{ const it=gOf(x.dataset.price); const v=await uiPrompt(`${it.name} の1つあたりの金額`, it.unit_price); if(v===null)return; const np=parseInt(v,10); if(isNaN(np)||np<0){toast('金額が正しくありません');return;} if(np===it.unit_price)return; const why=await askReason(`${it.name} の金額を ${yen(it.unit_price)} → ${yen(np)} に変更します。`); if(!why)return;
    const p0=products.find(p=>p.id===it.product_id); const zero=Number(p0?p0.cast_subtotal_price:it.cast_subtotal_price)===0; // 小計価格が0円の商品（h.c・b.c・立替金など）は、金額を変更しても係小計には入れない
    { const up=await sb.rpc('pos_rows_set',{p_table:'bill_items',p_where:{id:(it.ids)??null},p:{unit_price:np,cast_subtotal_price:zero?0:np}}); if(up.error){ if(await stale(up.error)) return; toast('単価を変更できません：'+up.error.message); return; } } await logOp('金額変更',{item:it.name,qty:it.qty,before:it.unit_price,after:np},why); /* 変えられたのを確かめてから記録 */
    openBill(b.id); });
  $('bOrders').querySelectorAll('[data-del]').forEach(x=>x.onclick=async()=>{ const it=gOf(x.dataset.del); if(await askBy()===null||!await uiConfirm(`${it?.name??''} ×${it?.qty??''}（${yen(it?it.unit_price*it.qty:0)}）を削除します。`)) return; /* 注文の削除・数量を減らす時は理由を聞かない（オーナー「理由は入れなくてもいい」）。入れた人は今までどおり */ const r=await sb.rpc('pos_rows_set',{p_table:'bill_items',p_where:{id:(it.ids)??null},p:{is_void:true}}); if(r.error){ if(await stale(r.error)) return; toast('削除できません：'+r.error.message); return; } await logOp('注文削除',{item:it?.name,qty:it?.qty,amount:it?it.unit_price*it.qty:null}); await openBill(b.id); if((cur?.totals?.unpaid??0)<0) await uiAlert(`入金が請求額より ${yen(-cur.totals.unpaid)} 多くなりました。会計の画面で入金を取り消してください`); }); /* 削除を確かめてから記録（前は失敗しても記録が残った） */
  $('bOrders').querySelectorAll('[data-split]').forEach(x=>x.onclick=()=>openSplit(gOf(x.dataset.split)));
  $('bOrders').querySelectorAll('[data-qty]').forEach(x=>x.onclick=()=>qtyChange(b,gOf(x.dataset.qty)));
}
/* 合計とボタン（会計済みは押せない） */
function rbTotals(R){ const {b,t,mode,T0,items,grp,gOf,isBottle,priceEdit,qtyEdit,itemRow}=R;
  const T=b.totals;
  $('bTotals').innerHTML=`<span>小計</span><span class="right">${yen(T.subtotal)}</span><span>サービス料${T.service_rate!=null?' '+T.service_rate+'%':''}</span><span class="right">${yen(T.service)}</span><span>消費税</span><span class="right">${yen(T.tax)}</span><span>合計</span><span class="right">${yen(T.total_rounded)}</span>${T.adjustment?`<span>値引/値増</span><span class="right">${yen(T.adjustment)}</span>`:''}<span class="big">請求額</span><span class="big right">${yen(T.amount_due)}</span>${T.paid>0&&!isOki(b)?`<span>入金済</span><span class="right">${yen(T.paid)}</span><span>未収</span><span class="right">${yen(T.unpaid)}</span>`:''}${kakariRows(b,T)}`; /* 途中退店などで先に受け取った分を伝票でも見せる（ゲネプロ #33） */
  const ro=b.status!=='open'; $('bBack').textContent=billFrom==='bills'?'伝票一覧へ':'ホールへ'; let pb=$('bPaid'); if(!pb){ pb=document.createElement('div'); pb.id='bPaid'; pb.style.cssText='flex:1 1 280px;max-width:460px'; $('bTotals').after(pb); } pb.innerHTML='';
  const okiB=isOki(b); $('v-bill').querySelectorAll('button').forEach(x=>{ const keep=['bBack','extSumBtn'].includes(x.id)||(okiB&&['prEst','prBill','prDetail','bPay'].includes(x.id)); x.disabled=ro&&!keep; x.style.display=(ro&&!keep)?'none':''; }); renderStatement(b,T,ro&&!okiB); $('gLeave').style.display=(b.status==='open'&&b.guest_count>=2)?'':'none'; $('bTime').style.cssText=b.status==='open'?'cursor:pointer;text-decoration:underline dotted':'';
}
// まとめた行の数量の変更。増やす＝増えた分を新しい注文で足す／減らす＝入れた人を聞いて、後から入れた注文から減らす（0 は × で削除）
async function qtyChange(b,g){ if(!g) return; const v=await uiPrompt(`${g.name} の数量`, g.qty); if(v===null) return; const n=Number(String(v).trim()); if(!Number.isInteger(n)||n<0){ toast('数量が正しくありません'); return; } if(n===g.qty) return; if(n===0){ toast('削除は × を押してください'); return; }
  const bad=async e=>{ if(await stale(e)) return; toast('数量を変更できません：'+e.message); };
  if(n>g.qty){ const s=g.rows[g.rows.length-1]; const r=await sb.rpc('pos_rows_add',{p_table:'bill_items',p:{bill_id:b.id,product_id:s.product_id,name:s.name,category_id:s.category_id,qty:n-g.qty,unit_price:s.unit_price,cast_subtotal_price:s.cast_subtotal_price,back_amount:s.back_amount,back_points:s.back_points,is_service_target:s.is_service_target,is_keep:!!s.is_keep}}); if(r.error){ await bad(r.error); return; }
    await logOp('数量変更',{item:g.name,before:g.qty,after:n,amount:g.unit_price*(n-g.qty)}); await openBill(b.id); return; }
  if(await askBy()===null) return;
  let left=g.qty-n, err=null; for(const r of [...g.rows].reverse()){ if(left<=0) break; const q=Math.min(left,r.qty); const up=await sb.rpc('pos_rows_set',{p_table:'bill_items',p_where:{id:(r.id)??null},p:q===r.qty?{is_void:true}:{qty:r.qty-q}}); if(up.error){ err=up.error; break; } left-=q; }
  const now=n+left; if(now!==g.qty) await logOp('数量変更',{item:g.name,before:g.qty,after:now,amount:-g.unit_price*(g.qty-now)}); /* 途中で止まった時は、変わった所までを記録 */
  if(err){ await bad(err); if(isStale(err)) return; } await openBill(b.id); if((cur?.totals?.unpaid??0)<0) await uiAlert(`入金が請求額より ${yen(-cur.totals.unpaid)} 多くなりました。会計の画面で入金を取り消してください`); }
// 会計済・取消済の伝票は、見返し用の明細書の形で表示する（編集用の枠やボタンは出さない）
function renderStatement(b,T,on){ const card=$('v-bill').querySelector('.card'); stCssOnce();
  let st=$('bStatement'); if(!st){ st=document.createElement('div'); st.id='bStatement'; st.style.cssText='max-width:720px;margin:0 auto'; card.appendChild(st); } card.classList.toggle('st-mode',!!on); if(!on){ st.innerHTML=''; return; }
  const cn=id=>customers.find(c=>c.id===id)?.name||''; const sn=id=>staffAll.find(x=>x.id===id)?.display_name||staff.find(x=>x.id===id)?.display_name||''; const md=d=>{ const x=new Date(d); return `${x.getMonth()+1}/${x.getDate()}`; };
  const custs=(b.bill_customers||[]).map(x=>cn(x.customer_id)).filter(Boolean); const ks=(b.bill_casts||[]).filter(c=>c.is_kakari).map(c=>sn(c.staff_id)).filter(Boolean); const ds=(b.bill_casts||[]).filter(c=>isDouhan(c.role)).map(c=>sn(c.staff_id)).filter(Boolean);
  const bd=String(billDay(b)||'').replace(/^\d{4}-0?(\d+)-0?(\d+)$/,'$1/$2')+(billDay(b)!==b.business_date?`（ご来店日 ${jmd(b.business_date)}）`:''); const extMin=(b.bill_extensions||[]).reduce((a,e)=>a+e.minutes,0);
  const L=(l,r,cls)=>`<div class="ln ${cls||''}"><span>${l}</span><span style="white-space:nowrap">${r}</span></div>`;
  const items=stItems(b,L,sn);
  const pays=stPays(b,md); const adjs=(b.bill_adjustments||[]);
  st.innerHTML=`${stHead(b,bd,custs,ks,ds)}
  ${(T.set||0)?L(`セット <small>× ${T.set_guests??b.guest_count}</small>`,yen(T.set)):''}${(T.vip_set||0)?L('VIPルーム料金',yen(T.vip_set)):''}${(T.extension||0)?L(`延長 <small>計${extMin}分</small>`,yen(T.extension)):''}${(T.vip_ext||0)?L('VIPルーム延長',yen(T.vip_ext)):''}${items}<hr>
  ${L('小計',yen(T.subtotal),'sm')}${L('サービス料'+(T.service_rate!=null?' '+T.service_rate+'%':''),yen(T.service),'sm')}${L('消費税',yen(T.tax),'sm')}${adjs.map(a=>L((a.kind==='discount'?'値引':'値増')+(a.reason?` <small>${esc(a.reason)}</small>`:''),(a.kind==='discount'?'−':'')+yen(a.amount),'sm')).join('')}
  <div class="ln" style="font-size:26px;font-weight:800;padding-top:10px"><span>請求額</span><span>${yen(T.amount_due)}</span></div>
  <div class="sm" style="display:grid;grid-template-columns:1fr auto;gap:2px 12px;margin-top:2px">${kakariRows(b,T)}</div><hr>
  <div class="ln"><span>お支払い</span><span style="white-space:normal;text-align:right">${stPayText(pays,md)}</span></div>
  <div class="bar" style="margin-top:14px;display:flex;justify-content:space-between"><button class="ghost" id="stBack">${billFrom==='bills'?'伝票一覧へ':'ホールへ'}</button>${b.status==='closed'&&hasReceived(b)?'<button class="ghost" id="stReceipt">領収書印刷</button>':''}</div>`;
  st.querySelectorAll('button').forEach(x=>{ x.disabled=false; x.style.display=''; }); $('stBack').onclick=()=>$('bBack').onclick(); if($('stReceipt')) $('stReceipt').onclick=()=>$('prReceipt').onclick(); }
// 明細書の上の段（卓・日付と時刻・人数・会計済／削除済・お客様・係・同伴）
function stHead(b,bd,custs,ks,ds){ return `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><b style="font-size:22px">${esc(billTable(b))}</b><span>${bd}　${b.closed_at?hm5(b.opened_at)+'〜'+hmJst(b.closed_at):esc($('bTime').textContent)}　${b.guest_count}名</span><span class="badge gray" style="margin-left:auto;font-size:15px">${b.status==='void'?'削除済':'会計済'}</span></div>
  <div class="sm" style="margin-top:6px">お客様：${custs.length?esc(custs.map(n=>n+' 様').join('・')):'未登録'}　　${KL}：${ks.length?esc(ks.join('・')):'なし'}${ds.length?'　　同伴：'+esc(ds.join('・')):''}</div><hr>`; }
// 明細書の見た目（1回だけ入れる）
function stCssOnce(){if(!$('stCss')){ const c=document.createElement('style'); c.id='stCss'; c.textContent='#bStatement{display:none}.card.st-mode>*{display:none !important}.card.st-mode>#bStatement{display:block !important}#bStatement .ln{display:flex;justify-content:space-between;gap:12px;padding:7px 2px;font-size:17px}#bStatement .ln small{color:var(--muted);font-size:13px}#bStatement hr{border:0;border-top:1px solid var(--line);margin:8px 0}#bStatement .sm{font-size:14px;color:var(--muted)}'; document.head.appendChild(c); } }
// 明細書の注文の行（バックの付いた人も）
function stItems(b,L,sn){
  return groupItems((b.bill_items||[]).filter(i=>!i.is_void)).map(i=>{ const bk=(i.bill_item_splits||[]).filter(sp=>(sp.back_amount||0)>0||Number(sp.back_points||0)>0).map(sp=>sn(sp.staff_id)).filter(Boolean); return L(`${esc(i.name)} <small>× ${i.qty}</small>${bk.length?` <small>（バック：${esc(bk.join('・'))}）</small>`:''}`, yen(i.unit_price*i.qty)); }).join('');
}
// お支払いを方法ごとにまとめる（置きは入金日・請求書は入金日でも分ける）
function stPays(b,md){ const pays=[]; (b.payments||[]).filter(p=>p.amount>0).forEach(p=>{ const k=p.method+'|'+(p.method==='oki'&&p.received_at?md(p.received_at):'')+(p.method==='invoice'?'|'+(p.invoice_paid_on||''):''); const e=pays.find(z=>z.k===k); if(e) e.amount+=p.amount; else pays.push({k,method:p.method,amount:p.amount,received_at:p.received_at,invoice_paid_on:p.invoice_paid_on}); }); return pays; }
// 明細書のお支払いの文
function stPayText(pays,md){ return pays.length?pays.map(p=>`${METHOD[p.method]} ${yen(p.amount)}${p.method==='oki'&&p.received_at?`<small>（${md(p.received_at)}入金）</small>`:''}${p.method==='invoice'?`<small>（${p.invoice_paid_on?invMd(p.invoice_paid_on)+'入金':'未入金'}）</small>`:''}`).join('／'):'入金の記録はありません'; }
// 請求書は会計日の売上。入金されたかは管理サイト「請求書の未入金」で入れる（POS は見るだけ）
const invMd=d=>{ const m=String(d||'').match(/^\d{4}-(\d{2})-(\d{2})/); return m?`${+m[1]}/${+m[2]}`:''; };
function invTag(p){ return p.method!=='invoice'?'':p.invoice_paid_on?` <small>入金済 ${invMd(p.invoice_paid_on)}</small>`:' <small>未入金</small>'; }
function hasReceived(b){ return (b?.payments||[]).some(p=>p.amount>0&&p.received_at); }
// 伝票の日付：置きは入金が揃った日（payments.revenue_date の最後の日）。それ以外はご来店日
function billDay(b){ const ps=(b.payments||[]).filter(p=>p.amount>0); if(b.status!=='closed'||!ps.length||ps.some(p=>p.method==='oki'&&!p.received_at)) return b.business_date; return ps.map(p=>p.revenue_date).filter(Boolean).sort().pop()||b.business_date; }
const jmd=d=>{ const m=String(d||'').match(/^\d{4}-(\d{2})-(\d{2})/); return m?`${+m[1]}月${+m[2]}日`:''; };
function isOki(b){ return !!b&&b.status==='closed'&&(b.payments||[]).some(p=>p.method==='oki'&&p.amount>0&&!p.received_at); }
function okiRemain(b){ return (b?.payments||[]).filter(p=>p.method==='oki'&&p.amount>0&&!p.received_at).reduce((a,p)=>a+p.amount,0); }
// 置き伝票の会計：入金・値引などの後に、置きの残額を請求額に合わせ直す。残額0で全額入金＝その日の売上として確定しホールへ戻る（true を返す）
async function okiSync(wasOki){ if(!wasOki||!cur||cur.totals?.amount_due==null) return false; const pays=(cur.payments||[]).filter(p=>p.amount>0); const delta=(cur.totals?.amount_due??0)-pays.reduce((a,p)=>a+p.amount,0); const row=pays.find(p=>p.method==='oki'&&!p.received_at);
  if(delta!==0){ let r=null; if(row){ const na=row.amount+delta; r=na>0?await sb.rpc('pos_rows_set',{p_table:'payments',p_where:{id:(row.id)??null},p:{amount:na}}):await sb.rpc('pos_rows_del',{p_table:'payments',p_where:{id:(row.id)??null}}); } else if(delta>0){ r=await sb.rpc('pos_rows_add',{p_table:'payments',p:{bill_id:cur.id,method:'oki',amount:delta,revenue_date:cur.business_date,received_at:null}}); } if(r&&r.error){ toast('置きの残額を更新できません：'+r.error.message); } await openBill(cur.id); }
  if(okiRemain(cur)>0) return false; const d=businessDate(); const r2=await sb.rpc('pos_rows_set',{p_table:'payments',p_where:{bill_id:(cur.id)??null},p:{revenue_date:d}}); if(r2.error) toast('売上日の更新に失敗：'+r2.error.message); await logOp('置きの入金完了',{total:cur.totals?.amount_due??null,revenue_date:d,payments:(cur.payments||[]).filter(p=>p.amount>0).map(p=>`${METHOD[p.method]}:${p.amount}`)}); toast('全額の入金を受けました。本日の売上に計上します'); loadHall(); show('v-hall'); return true; }
