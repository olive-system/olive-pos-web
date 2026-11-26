// ---------- order（d-system準拠の4列：カテゴリー／メニュー／選択／注文→確定） ----------
// ルール：売上は全部係に付く（複数なら等分）。3列目で選ぶのはバック・ポイントを付ける人だけ（選ばなければバックなし）
// キャストドリンクは、名前を押すたびにその人の行に1つ足す（同じ物を何人かに一度に入れるため。等分は無い）。ほかは選んだ人数で等分（シャンパン・ワインの抜き物）
let oCat=null, oCart=[], oSel=-1, oPresent=new Set();
async function openOrder(){ oCart=[]; oSel=-1; oCat=(S.categories.find(c=>c.is_visible&&S.products.some(p=>p.category_id===c.id&&p.is_visible))||S.categories.find(c=>c.is_visible))?.id||null; oPresent=await updateCastBadge(); renderOrder(); show('v-order'); }
function renderOrder(catId){ if(catId) oCat=catId;
  $('oCats').innerHTML=S.categories.filter(c=>c.is_visible).map(c=>`<button class="ocat ${c.id===oCat?'on':''}" data-id="${c.id}">${esc(c.name)}</button>`).join('');
  $('oCats').querySelectorAll('.ocat').forEach(c=>c.onclick=()=>renderOrder(c.dataset.id));
  $('oProds').innerHTML=S.products.filter(p=>p.category_id===oCat&&p.is_visible).map(p=>`<button class="oprod" data-id="${p.id}"><span>${esc(p.name)}</span><span class="pb">${yen(p.price)}</span></button>`).join('')||'<div class="muted">なし</div>';
  $('oProds').querySelectorAll('.oprod').forEach(b=>b.onclick=()=>cartAdd(S.products.find(p=>p.id===b.dataset.id)));
  renderOrderCasts(); renderCart(); }
const perHead=p=>/キャストドリンク/.test(S.categories.find(c=>c.id===p.category_id)?.name||'');
function cartAdd(p){ const i=perHead(p)?oCart.findIndex(l=>l.p.id===p.id&&!l.casts.length):oCart.findIndex(l=>l.p.id===p.id); /* キャストドリンクは人ごとの行に分けるので、名前の付いていない行にだけ足す */ if(i>=0){ oCart[i].qty++; oSel=i; } else { oCart.push({p,qty:1,casts:[]}); oSel=oCart.length-1; } renderOrderCasts(); renderCart(); }
function renderOrderCasts(){ const line=oCart[oSel]; const cs=S.staff.filter(s=>s.kind==='cast'); const onBill=new Set((S.cur.bill_casts||[]).map(c=>c.staff_id));
  const rank=s=>onBill.has(s.id)?0:oPresent.has(s.id)?1:2; const list=[...cs].sort((a,b)=>rank(a)-rank(b));
  if(!line){ $('oCasts').innerHTML='<div class="muted">メニューを選ぶと、バックを付けるキャストを選べます</div>'; return; }
  /* 771：小計価格のある品は「小計の係」を選べる（在籍の子全員。選ばなければ［等分］＝伝票の係で等分。オーナー 2026-11-26「出勤していなくても選べるようにしたい」） */
  const subH=Number(line.p.cast_subtotal_price)>0?`<div class="muted" style="font-size:12px">「${esc(line.p.name)}」の小計の係</div><div class="ocgrid" style="max-height:190px;overflow:auto;margin-bottom:14px"><button class="ocast ${line.sub?'':'on'}" data-sub="">等分</button>`+list.map(s=>`<button class="ocast ${line.sub===s.id?'on':''}" data-sub="${s.id}">${esc(s.display_name)}</button>`).join('')+`</div>`:'';
  const put=h=>{ $('oCasts').innerHTML=subH+h; $('oCasts').querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{ line.sub=b.dataset.sub||null; renderOrderCasts(); renderCart(); }); };
  if(noBack(line.p)){ line.casts=[]; put(`<div class="muted" style="font-size:14px">「${esc(line.p.name)}」<br>バック0円（設定→メニューで変更できます）</div>`); return; }
  if(!perHead(line.p)){ put(`<div class="muted" style="font-size:12px">「${esc(line.p.name)}」のバックを付ける人（選ばなければバックなし）</div><div class="ocgrid">`+list.map(s=>`<button class="ocast ${line.casts.includes(s.id)?'on':''}" data-id="${s.id}">${esc(s.display_name)}</button>`).join('')+`</div>`);
    $('oCasts').querySelectorAll('.ocast[data-id]').forEach(b=>b.onclick=()=>{ const id=b.dataset.id; const k=line.casts.indexOf(id); if(k>=0) line.casts.splice(k,1); else line.casts.push(id); renderOrderCasts(); renderCart(); }); return; }
  const one=id=>oCart.find(l=>l.p.id===line.p.id&&l.casts.length===1&&l.casts[0]===id); /* その人だけの行 */
  const btn=s=>{ const l=one(s.id); return `<button class="ocast ${l?'on':''}" data-id="${s.id}">${esc(s.display_name)}${l&&l.qty>1?' ×'+l.qty:''}</button>`; };
  put(`<div class="muted" style="font-size:12px">名前を押すたびに、その人に「${esc(line.p.name)}」を1つ足します</div><div class="ocgrid">`+list.map(btn).join('')+`</div>`);
  $('oCasts').querySelectorAll('.ocast[data-id]').forEach(b=>b.onclick=()=>{ const id=b.dataset.id;
    if(!line.casts.length) line.casts=[id]; /* メニューを押したばかりの行は、その人の行にする */
    else { const l=one(id); if(l){ l.qty++; oSel=oCart.indexOf(l); } else { oCart.push({p:line.p,qty:1,casts:[id]}); oSel=oCart.length-1; } }
    renderOrderCasts(); renderCart(); }); }
const noBack=p=>!Number(p.back_amount)&&!Number(p.back_points); // バック金額もポイントも0のメニュー＝振り分け不要
function castLabel(line){ const nm=id=>S.staff.find(x=>x.id===id)?.display_name||''; const sub=line.sub?`<small>小計 ${esc(nm(line.sub))}</small>`:''; /* 771 */
  if(noBack(line.p)) return sub; if(!line.casts.length) return '<small class="none">バックなし</small>'+sub; return `<small>バック：${line.casts.map(nm).map(esc).join('・')}${line.casts.length>1?`で${line.casts.length}等分`:''}</small>`+sub; }
function renderCart(){ $('oCart').innerHTML=oCart.map((l,i)=>`<div class="oline ${i===oSel?'sel':''}" data-i="${i}"><div class="nm">${esc(l.p.name)}</div><div class="r1"><small class="amt">${yen(l.p.price*l.qty)}</small><span class="qty"><button data-m="${i}">−</button><b>${l.qty}</b><button data-p="${i}">＋</button></span></div>${castLabel(l)}</div>`).join('')||'<div class="muted">メニューをタップして追加</div>';
  $('oCart').querySelectorAll('.oline').forEach(d=>d.onclick=e=>{ if(e.target.closest('button')) return; oSel=Number(d.dataset.i); renderOrderCasts(); renderCart(); });
  /* 確定の後、画面を描き直す前に残っている ＋／− を押すと、空になったカートを読んで止まっていた */
  $('oCart').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ if(!oCart[b.dataset.p]) return; oCart[b.dataset.p].qty++; renderCart(); });
  $('oCart').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ const i=Number(b.dataset.m); if(!oCart[i]) return; oCart[i].qty--; if(oCart[i].qty<=0){ oCart.splice(i,1); oSel=Math.min(oSel,oCart.length-1); renderOrderCasts(); } renderCart(); }); }
function buildSplits(itemId, line){ const q=line.qty, back=line.p.back_amount*q, pts=Number(line.p.back_points)*q, n=line.casts.length; // 売上は常に係。ここはバックとポイントだけ
  return line.casts.map((id,i)=>({bill_item_id:itemId,staff_id:id,sales_amount:0,back_amount:Math.floor(back/n)+(i===0?back-Math.floor(back/n)*n:0),back_points:i===0?Math.round((pts-Math.floor(pts/n*10)/10*(n-1))*10)/10:Math.floor(pts/n*10)/10})); } /* 端数は最初の人に足して合計をぴったりに（管理サイトの伝票の直しと同じ式） */
$('oConfirm').onclick=guard($('oConfirm'),async()=>{ /* 通しチェック3：確かめの読み込みの間の二度押しで二重に入っていた */ if(!oCart.length){ toast('メニューを選んでください'); return; }
  // キープ可の商品：伝票のお客様にボトルを自動登録する。お客様が未登録なら注文を入れない／複数なら誰のボトルか選ぶ
  const keepFor=new Map(); const keepLines=oCart.filter(l=>l.p.is_keepable); if(keepLines.length){ const bcs=[...new Set((S.cur.bill_customers||[]).map(x=>x.customer_id))]; if(!bcs.length){ await uiConfirm('先にお客様名を登録してください'); return; }
    for(const l of keepLines){ if(bcs.length===1){ keepFor.set(l,bcs[0]); continue; } const pick=await uiPick(`${l.p.name} はどなたのボトルですか？`, bcs.map(id=>({label:(S.customers.find(c=>c.id===id)?.name||'（不明）')+' 様',value:id}))); if(!pick) return; keepFor.set(l,pick); } }
  /* 同じ品が3分以内にこの伝票に入っていたら聞く（ゲネプロ #52：画面が固まって入れ直したら二重になった） */ { const ids=[...new Set(oCart.map(l=>l.p.id))]; const r=await sb.from('bill_items').select('name,added_at').eq('bill_id',S.cur.id).eq('is_void',false).in('product_id',ids).gte('added_at',new Date(Date.now()-180000).toISOString()); if((r.data||[]).length){ const t=[...new Set(r.data.map(x=>`${x.name}（${new Date(x.added_at).toTimeString().slice(0,5)}）`))].join('・'); if(!await uiConfirm(`${t} は注文済です。\n再度注文しますか？`)) return; } }
  $('oConfirm').disabled=true; $('oCart').style.cssText='pointer-events:none;opacity:.4'; /* 入れている間はカートを押せない見た目に（押しても効かないと迷うので） */
  const done=new Set(), stop=async m=>{ toast(m); oCart=oCart.filter(x=>!done.has(x)); await openBill(S.cur.id); renderOrder(); }; /* 途中で失敗したら、入った行はカートから外す（押し直しても二重にならない） */
  try{ for(const l of oCart){ const p=l.p; const { data:item, error } = await sb.rpc('pos_rows_add',{p_table:'bill_items',p:{bill_id:S.cur.id,product_id:p.id,name:p.name,category_id:p.category_id,qty:l.qty,unit_price:p.price,cast_subtotal_price:p.cast_subtotal_price,back_amount:p.back_amount,back_points:p.back_points,is_service_target:p.is_service_target,is_keep:!!p.is_keepable,...(l.sub?{subtotal_staff_id:l.sub}:{})}}).then(oneRow);
      if(error){ await stop(error.message); return; } const sp=buildSplits(item.id,l); if(sp.length){ const r=await sb.rpc('pos_rows_add',{p_table:'bill_item_splits',p:sp}); if(r.error){ const dr=await sb.rpc('pos_rows_del',{p_table:'bill_items',p_where:{id:(item.id)??null}}); if(dr.error||!(dr.data||[]).length){ done.add(l); await stop(`振分を保存できませんでした。${p.name}は伝票に入っているので、伝票で確認してください`); return; } /* 取り消しも止まった時は、品が伝票に残るのでカートから外して知らせる（前は黙ってカートに残り、押し直すと二重になった） */ await stop(r.error.message); return; } } done.add(l); /* 振分が入らなかった時は、品も取り消してカートに残す（前は振分の無い注文が残り、バックが抜けた） */
      if(keepFor.has(l)){ const cid=keepFor.get(l); const cu=S.customers.find(c=>c.id===cid); const kk=(S.cur.bill_casts||[]).find(c=>c.is_kakari)?.staff_id||cu?.kakari_staff_id||null; for(let k=0;k<l.qty;k++){ const rb=await sb.rpc('pos_bottle_add',{p_store:S.store.id,p_customer:cid,p_product:p.id,p_name:p.name,p_remaining:10,p_kakari:kk,p_keep_name:cu?.name||null}); if(rb.error){ toast('ボトル登録エラー：'+rb.error.message); break; } } await logOp('ボトル登録（注文から自動）',{customer:cu?.name||null,bottle:p.name,qty:l.qty}); } }
    const n=oCart.reduce((a,l)=>a+l.qty,0); oCart=[]; oSel=-1; renderCart(); await openBill(S.cur.id); renderOrder(); show('v-order'); toast(`${n}点を注文しました`); }
  finally{ $('oConfirm').disabled=false; $('oCart').style.cssText=''; } });
$('orderBack').onclick=()=>openBill(S.cur.id);

