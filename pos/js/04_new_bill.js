// ---------- 新しい伝票（人数・お客様を選んで伝票を作る） ----------
let newT=null, newN=0, newCust=null;
function openNew(t){ newT=t; newN=0; newCust=null; $('nTable').textContent=t.name; renderNew(); show('v-new'); }
function renderNew(){ $('nCount').textContent=newN; $('nCust').textContent=newCust?newCust.name:'新規'; }
$('nPlus').onclick=()=>{ if(newN<50) newN++; renderNew(); };
$('nMinus').onclick=()=>{ if(newN>0) newN--; renderNew(); };
$('nBack').onclick=()=>{ loadHall(); show('v-hall'); };
$('nCust').onclick=()=>{ $('custCancel').textContent='閉じる'; custPick=c=>{ newCust=c; renderNew(); }; $('custSearch').value=''; renderCust(''); $('custModal').classList.add('on'); };
$('nNext').onclick=guard($('nNext'),async()=>{ if(newN<1){ toast('お客様の人数を入力してください'); return; } await createBill(newT, newN, newCust); });
async function createBill(t, n, c){ const normal=modes.find(m=>m.code==='normal');
  const ex=await sb.from('bills').select('id').eq('table_id',t.id).eq('status','open').limit(1); if(ex.data?.length){ toast('この卓はすでに伝票があります'); await openBill(ex.data[0].id); return; }
  const { data:b, error } = await sb.rpc('pos_rows_add',{p_table:'bills',p:{ store_id:store.id, business_date:businessDate(), table_id:t.id, guest_count:n||1, pricing_mode_id:normal?.id, set_start:ceil5(Date.now()).toISOString(), set_minutes:settings.set_minutes, set_unit_price:settings.set_unit_price }}).then(oneRow);
  if (error) { if(error.code==='23505'){ /* 1つの卓に営業中の伝票は1枚だけ */ toast('もう1台でこの卓の伝票が作成されました'); const e2=await sb.from('bills').select('id').eq('table_id',t.id).eq('status','open').limit(1); if(e2.data?.length) await openBill(e2.data[0].id); else { loadHall(); show('v-hall'); } return; } toast(error.message); return; }
  cur=b; let addedK=false; if (c){ { const rc=await sb.rpc('pos_rows_add',{p_table:'bill_customers',p:{bill_id:b.id,customer_id:c.id}}); if(rc.error) toast('お客様を伝票に登録できません：'+rc.error.message); } /* 通しチェック3：失敗しても何も出なかった */ if(c.kakari_staff_id&&settings.cust_auto_kakari!==false){ /* 設定で OFF にできる */ const r=await sb.rpc('pos_rows_add',{p_table:'bill_casts',p:{bill_id:b.id,staff_id:c.kakari_staff_id,role:'none',is_kakari:true}}); addedK=!r.error; } }
  // HC・BC の金額は管理サイト「POS設定」で選ぶ（なし＝付けない）。伝票の名前は HC／BC。HC は係にバック100%、BC はバックなし
  const hc=settings.auto_hc_product_id&&products.find(p=>p.id===settings.auto_hc_product_id), hcA=('auto_hc_amount' in settings)?settings.auto_hc_amount:hc?.price;
  if (hc&&hcA>0){ const rh=await sb.rpc('pos_rows_add',{p_table:'bill_items',p:{bill_id:b.id,product_id:hc.id,name:'HC',category_id:hc.category_id,qty:n||1,unit_price:hcA,cast_subtotal_price:Number(hc.cast_subtotal_price)?hcA:0,back_amount:hcA,back_points:hc.back_points,is_service_target:hc.is_service_target}}); if(rh.error) toast('HC を登録できません：'+rh.error.message); }
  const bc=settings.auto_bc_product_id&&products.find(p=>p.id===settings.auto_bc_product_id), bcA=('auto_bc_amount' in settings)?settings.auto_bc_amount:bc?.price;
  if (bc&&bcA>0){ const rb=await sb.rpc('pos_rows_add',{p_table:'bill_items',p:{bill_id:b.id,product_id:bc.id,name:'BC',category_id:bc.category_id,qty:n||1,unit_price:bcA,cast_subtotal_price:Number(bc.cast_subtotal_price)?bcA:0,back_amount:0,back_points:0,is_service_target:bc.is_service_target}}); if(rb.error) toast('BC を登録できません：'+rb.error.message); }
  await logOp('伝票立ち上げ',{guest_count:n||1,customer:c?.name||null}); await openBill(b.id); if(addedK){ await syncHcBack(); await openBill(b.id); } if(c) await resvDouhan(c); }
/* 客数が変わった時の HC・BC の数と振分は pos_guest_step（データベース）で合わせる */


