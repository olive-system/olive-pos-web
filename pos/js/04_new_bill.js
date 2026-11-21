// ---------- 新しい伝票（人数・お客様を選んで伝票を作る） ----------
// 予約は「今の時刻の前後1時間」（伝票がもうあるお客様の予約は、関数 pos_resv_near_now が外す。SQL 681）。最大10件（10個目は［ほか ○件］）
let newT=null, newN=0, newCust=null, newResvId=null, newResvList=[], newResvSeq=0, newDouhanIds=null;
function openNew(t){ newT=t; newN=0; newCust=null; newResvId=null; newResvList=[]; newDouhanIds=null; $('nTable').textContent=t.name; renderNew(); show('v-new'); loadNewResv(); }
function renderNew(){ $('nCount').textContent=newN; renderNewResv(); }
$('nPlus').onclick=()=>{ if(newN<50) newN++; renderNew(); };
$('nMinus').onclick=()=>{ if(newN>0) newN--; renderNew(); };
$('nBack').onclick=()=>{ loadHall(); show('v-hall'); };
$('nNext').onclick=guard($('nNext'),async()=>{ if(newN<1){ toast('お客様の人数を入力してください'); return; } await createBill(newT, newN, newCust, newDouhanIds); });
const hmOf=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
async function loadNewResv(){ const seq=++newResvSeq; const now=new Date();
  $('nResvHead').textContent=`予約　${hmOf(new Date(now-3600000))}〜${hmOf(new Date(now.getTime()+3600000))}`;
  const r=await sb.rpc('pos_resv_near_now'); if(seq!==newResvSeq) return;
  if(r.error){ newResvList=[]; $('nResv').innerHTML=`<div class="muted" style="grid-column:1/-1">予約の一覧を読めません：${esc(r.error.message)}</div>`; return; }
  newResvList=(r.data||[]); renderNewResv(); }
// 予約の箱：押すと人数（予約の人数）とお客様が入る。お客様が登録された予約だけ、お客様も入る
function renderNewResv(){ const box=$('nResv'); if(!box) return; const L=newResvList;
  if(!L.length){ box.innerHTML='<div class="muted" style="grid-column:1/-1">予約はありません</div>'; return; }
  const shown=L.length>10?L.slice(0,9):L;
  const cells=shown.map(r=>`<div class="rb${newResvId===r.id?' sel':''}" data-rid="${esc(r.id)}"><div class="rb1"><b>${esc(r.time)}</b> ${esc(r.name)}　様</div><div class="rb2">${r.douhan?'<span class="rtag">同伴</span>':'<span></span>'}<span>${r.guests}名</span></div></div>`).join('');
  const more=L.length>10?`<div class="rb more">ほか ${L.length-9}件</div>`:'';
  box.innerHTML=cells+more;
  box.querySelectorAll('[data-rid]').forEach(el=>el.onclick=()=>{ const r=L.find(x=>x.id===el.dataset.rid); if(!r) return; newResvId=r.id; newN=r.guests||1; newCust=r.customer_id?{id:r.customer_id,name:r.name}:null; newDouhanIds=r.douhan_ids||null; renderNew(); }); }
// 押した予約の同伴の子を、伝票作成の時に伝票へ付ける（同伴は伝票で決める。押したことが決め）
async function addResvDouhan(b, ids){ if(!ids?.length) return; const role=douhanRole(b.opened_at); let n=0;
  for(const sid of ids){ if(n>=(b.guest_count||1)){ toast(`同伴は客数（${b.guest_count}名）までです`); break; }
    const q=await sb.rpc('pos_rows_add',{p_table:'bill_casts',p:{bill_id:b.id,staff_id:sid,role,is_kakari:!!S.settings.douhan_is_kakari}});
    if(q.error){ toast(q.error.message); break; } n++; await logOp('同伴を追加',{kind:ROLE[role],resv:true}); }
  if(n&&S.settings.douhan_is_kakari) await syncHcBack(); }
async function createBill(t, n, c, dids){ const normal=S.modes.find(m=>m.code==='normal');
  const ex=await sb.from('bills').select('id').eq('table_id',t.id).eq('status','open').limit(1); if(ex.data?.length){ toast('この卓はすでに伝票があります'); await openBill(ex.data[0].id); return; }
  const { data:b, error } = await sb.rpc('pos_rows_add',{p_table:'bills',p:{ store_id:S.store.id, business_date:businessDate(), table_id:t.id, guest_count:n||1, pricing_mode_id:normal?.id, set_start:ceil5(Date.now()).toISOString(), set_minutes:S.settings.set_minutes, set_unit_price:S.settings.set_unit_price }}).then(oneRow);
  if (error) { if(error.code==='23505'){ /* 1つの卓に営業中の伝票は1枚だけ */ toast('もう1台でこの卓の伝票が作成されました'); const e2=await sb.from('bills').select('id').eq('table_id',t.id).eq('status','open').limit(1); if(e2.data?.length) await openBill(e2.data[0].id); else { loadHall(); show('v-hall'); } return; } toast(error.message); return; }
  S.cur=b; let addedK=false; if (c){ { const rc=await sb.rpc('pos_rows_add',{p_table:'bill_customers',p:{bill_id:b.id,customer_id:c.id}}); if(rc.error) toast('お客様を伝票に登録できません：'+rc.error.message); } /* 通しチェック3：失敗しても何も出なかった */ if(c.kakari_staff_id&&S.settings.cust_auto_kakari!==false){ /* 設定で OFF にできる */ const r=await sb.rpc('pos_rows_add',{p_table:'bill_casts',p:{bill_id:b.id,staff_id:c.kakari_staff_id,role:'none',is_kakari:true}}); addedK=!r.error; } }
  // HC・BC の金額は管理サイト「POS設定」で選ぶ（なし＝付けない）。伝票の名前は HC／BC。HC は係にバック100%、BC はバックなし
  const hc=S.settings.auto_hc_product_id&&S.products.find(p=>p.id===S.settings.auto_hc_product_id), hcA=('auto_hc_amount' in S.settings)?S.settings.auto_hc_amount:hc?.price;
  if (hc&&hcA>0){ const rh=await sb.rpc('pos_rows_add',{p_table:'bill_items',p:{bill_id:b.id,product_id:hc.id,name:'HC',category_id:hc.category_id,qty:n||1,unit_price:hcA,cast_subtotal_price:Number(hc.cast_subtotal_price)?hcA:0,back_amount:hcA,back_points:hc.back_points,is_service_target:hc.is_service_target}}); if(rh.error) toast('HC を登録できません：'+rh.error.message); }
  const bc=S.settings.auto_bc_product_id&&S.products.find(p=>p.id===S.settings.auto_bc_product_id), bcA=('auto_bc_amount' in S.settings)?S.settings.auto_bc_amount:bc?.price;
  if (bc&&bcA>0){ const rb=await sb.rpc('pos_rows_add',{p_table:'bill_items',p:{bill_id:b.id,product_id:bc.id,name:'BC',category_id:bc.category_id,qty:n||1,unit_price:bcA,cast_subtotal_price:Number(bc.cast_subtotal_price)?bcA:0,back_amount:0,back_points:0,is_service_target:bc.is_service_target}}); if(rb.error) toast('BC を登録できません：'+rb.error.message); }
  await addResvDouhan(b, dids); await logOp('伝票立ち上げ',{guest_count:n||1,customer:c?.name||null}); await openBill(b.id); if(addedK){ await syncHcBack(); await openBill(b.id); } if(c) await resvDouhan(c); }
/* 客数が変わった時の HC・BC の数と振分は pos_guest_step（データベース）で合わせる */


