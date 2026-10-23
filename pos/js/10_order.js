// ---------- order（d-system準拠の4列：カテゴリー／メニュー／選択／注文→確定） ----------
// ルール：売上は全部係に付く（複数なら等分）。3列目で選ぶのはバック・ポイントを付ける人だけ（選んだ人数で等分・切り捨て。選ばなければバックなし）
let oCat=null, oCart=[], oSel=-1, oPresent=new Set();
async function openOrder(){ oCart=[]; oSel=-1; oCat=(categories.find(c=>c.is_visible&&products.some(p=>p.category_id===c.id&&p.is_visible))||categories.find(c=>c.is_visible))?.id||null; oPresent=await updateCastBadge(); renderOrder(); show('v-order'); }
function renderOrder(catId){ if(catId) oCat=catId;
  $('oCats').innerHTML=categories.filter(c=>c.is_visible).map(c=>`<button class="ocat ${c.id===oCat?'on':''}" data-id="${c.id}">${esc(c.name)}</button>`).join('');
  $('oCats').querySelectorAll('.ocat').forEach(c=>c.onclick=()=>renderOrder(c.dataset.id));
  $('oProds').innerHTML=products.filter(p=>p.category_id===oCat&&p.is_visible).map(p=>`<button class="oprod" data-id="${p.id}"><span>${esc(p.name)}</span><span class="pb">${yen(p.price)}</span></button>`).join('')||'<div class="muted">なし</div>';
  $('oProds').querySelectorAll('.oprod').forEach(b=>b.onclick=()=>cartAdd(products.find(p=>p.id===b.dataset.id)));
  renderOrderCasts(); renderCart(); }
function cartAdd(p){ const i=oCart.findIndex(l=>l.p.id===p.id); if(i>=0){ oCart[i].qty++; oSel=i; } else { oCart.push({p,qty:1,casts:[]}); oSel=oCart.length-1; } renderOrderCasts(); renderCart(); }
function renderOrderCasts(){ const line=oCart[oSel]; const cs=staff.filter(s=>s.kind==='cast'); const onBill=new Set((cur.bill_casts||[]).map(c=>c.staff_id));
  const rank=s=>onBill.has(s.id)?0:oPresent.has(s.id)?1:2; const list=[...cs].sort((a,b)=>rank(a)-rank(b));
  if(!line){ $('oCasts').innerHTML='<div class="muted">メニューを選ぶと、バックを付けるキャストを選べます</div>'; return; }
  if(noBack(line.p)){ line.casts=[]; $('oCasts').innerHTML=`<div class="muted" style="font-size:14px">「${esc(line.p.name)}」<br>バック0円（設定→メニューで変更できます）</div>`; return; }
  $('oCasts').innerHTML=`<div class="muted" style="font-size:12px">「${esc(line.p.name)}」のバックを付ける人（選ばなければバックなし）</div><div class="ocgrid">`+list.map(s=>`<button class="ocast ${line.casts.includes(s.id)?'on':''}" data-id="${s.id}">${esc(s.display_name)}</button>`).join('')+`</div>`;
  $('oCasts').querySelectorAll('.ocast').forEach(b=>b.onclick=()=>{ const id=b.dataset.id; const k=line.casts.indexOf(id); if(k>=0) line.casts.splice(k,1); else line.casts.push(id); renderOrderCasts(); renderCart(); }); }
const noBack=p=>!Number(p.back_amount)&&!Number(p.back_points); // バック金額もポイントも0のメニュー＝振り分け不要
function castLabel(line){ const nm=id=>staff.find(x=>x.id===id)?.display_name||''; if(noBack(line.p)) return ''; if(!line.casts.length) return '<small class="none">バックなし</small>'; return `<small>バック：${line.casts.map(nm).map(esc).join('・')}${line.casts.length>1?`で${line.casts.length}等分`:''}</small>`; }
function renderCart(){ $('oCart').innerHTML=oCart.map((l,i)=>`<div class="oline ${i===oSel?'sel':''}" data-i="${i}"><div class="r1"><span>${esc(l.p.name)}<br><small>${yen(l.p.price*l.qty)}</small></span><span class="qty"><button data-m="${i}">−</button><b>${l.qty}</b><button data-p="${i}">＋</button></span></div>${castLabel(l)}</div>`).join('')||'<div class="muted">メニューをタップして追加</div>';
  $('oCart').querySelectorAll('.oline').forEach(d=>d.onclick=e=>{ if(e.target.closest('button')) return; oSel=Number(d.dataset.i); renderOrderCasts(); renderCart(); });
  $('oCart').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ oCart[b.dataset.p].qty++; renderCart(); });
  $('oCart').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ const i=Number(b.dataset.m); oCart[i].qty--; if(oCart[i].qty<=0){ oCart.splice(i,1); oSel=Math.min(oSel,oCart.length-1); renderOrderCasts(); } renderCart(); }); }
function buildSplits(itemId, line){ const q=line.qty, back=line.p.back_amount*q, pts=Number(line.p.back_points)*q, n=line.casts.length; // 売上は常に係。ここはバックとポイントだけ
  return line.casts.map((id,i)=>({bill_item_id:itemId,staff_id:id,sales_amount:0,back_amount:Math.floor(back/n)+(i===0?back-Math.floor(back/n)*n:0),back_points:Math.floor(pts/n*10)/10})); } /* v11.43：端数は最初の人に（前は消えていた） */
$('oConfirm').onclick=guard($('oConfirm'),async()=>{ /* 通しチェック3：確かめの読み込みの間の二度押しで二重に入っていた */ if(!oCart.length){ toast('メニューを選んでください'); return; }
  // キープ可の商品：伝票のお客様にボトルを自動登録する。お客様が未登録なら注文を入れない／複数なら誰のボトルか選ぶ
  const keepFor=new Map(); const keepLines=oCart.filter(l=>l.p.is_keepable); if(keepLines.length){ const bcs=[...new Set((cur.bill_customers||[]).map(x=>x.customer_id))]; if(!bcs.length){ await uiConfirm('先にお客様名を登録してください'); return; }
    for(const l of keepLines){ if(bcs.length===1){ keepFor.set(l,bcs[0]); continue; } const pick=await uiPick(`${l.p.name} はどなたのボトルですか？`, bcs.map(id=>({label:(customers.find(c=>c.id===id)?.name||'（不明）')+' 様',value:id}))); if(!pick) return; keepFor.set(l,pick); } }
  /* v11.89：同じ品が3分以内にこの伝票に入っていたら聞く（ゲネプロ #52：画面が固まって入れ直したら二重になった） */ { const ids=[...new Set(oCart.map(l=>l.p.id))]; const r=await sb.from('bill_items').select('name,added_at').eq('bill_id',cur.id).eq('is_void',false).in('product_id',ids).gte('added_at',new Date(Date.now()-180000).toISOString()); if((r.data||[]).length){ const t=[...new Set(r.data.map(x=>`${x.name}（${new Date(x.added_at).toTimeString().slice(0,5)}）`))].join('・'); if(!await uiConfirm(`${t} がもう入っています。\nもう一度入れますか？`)) return; } }
  $('oConfirm').disabled=true;
  const done=new Set(), stop=async m=>{ toast(m); oCart=oCart.filter(x=>!done.has(x)); await openBill(cur.id); renderOrder(); }; /* v11.43：途中で失敗したら、入った行はカートから外す（押し直しても二重にならない） */
  try{ for(const l of oCart){ const p=l.p; const { data:item, error } = await sb.from('bill_items').insert({bill_id:cur.id,product_id:p.id,name:p.name,category_id:p.category_id,qty:l.qty,unit_price:p.price,cast_subtotal_price:p.cast_subtotal_price,back_amount:p.back_amount,back_points:p.back_points,is_service_target:p.is_service_target,is_keep:!!p.is_keepable}).select().single();
      if(error){ await stop(error.message); return; } done.add(l); const sp=buildSplits(item.id,l); if(sp.length){ const r=await sb.from('bill_item_splits').insert(sp); if(r.error){ await stop(r.error.message); return; } }
      if(keepFor.has(l)){ const cid=keepFor.get(l); const cu=customers.find(c=>c.id===cid); const kk=(cur.bill_casts||[]).find(c=>c.is_kakari)?.staff_id||cu?.kakari_staff_id||null; for(let k=0;k<l.qty;k++){ const rb=await sb.from('customer_bottles').insert({store_id:store.id,customer_id:cid,product_id:p.id,name:p.name,remaining:10,kakari_staff_id:kk,keep_name:cu?.name||null}); if(rb.error){ toast('ボトル登録エラー：'+rb.error.message); break; } } await logOp('ボトル登録（注文から自動）',{customer:cu?.name||null,bottle:p.name,qty:l.qty}); } }
    const n=oCart.reduce((a,l)=>a+l.qty,0); oCart=[]; oSel=-1; await openBill(cur.id); renderOrder(); show('v-order'); toast(`${n}点を注文しました`); }
  finally{ $('oConfirm').disabled=false; } });
$('orderBack').onclick=()=>openBill(cur.id);

