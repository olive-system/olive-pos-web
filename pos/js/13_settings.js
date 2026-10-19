// ---------- settings（d-system風：一覧＋詳細、編集モードで長押し並び替え・削除） ----------
const SET = [
  { key:'chorei', name:'朝礼', chorei:true }, // v11.58・SQL 129：朝礼（オーナー 2026-10-16。並びもオーナー）
  { key:'closing', name:'閉店作業', closing:true },
  { key:'bills', name:'伝票一覧', bills:true },
  { key:'tables', name:'テーブル', table:'tables', label:r=>r.name, cols:[['name','テーブル名','text'],['is_visible','表示','bool']], newRow:()=>({store_id:store.id,name:'新しいテーブル',is_visible:true}) },
  { key:'categories', name:'カテゴリー', table:'categories', label:r=>r.name, cols:[['name','カテゴリー名','text'],['short_name','略称','text'],['is_visible','表示','bool'],['is_industry_target','同業者モードの対象','bool']], newRow:()=>({store_id:store.id,name:'新しいカテゴリー',is_visible:true,is_industry_target:false}) },
  { key:'products', name:'メニュー', table:'products', label:r=>`${r.name}`, sub:r=>yen(r.price), cols:[['name','メニュー名','text'],['short_name','略称','text'],['category_id','カテゴリー','cat'],['price','販売価格（税抜）','number'],['cast_subtotal_price','小計価格（'+KL+'小計に入る額）','number'],['back_amount','バック金額','number'],['back_points','バックポイント','number'],['is_service_target','サービス料の対象','bool'],['is_keepable','キープ可','bool'],['in_stock','在庫あり','bool'],['is_visible','表示','bool']], newRow:()=>({store_id:store.id,name:'新メニュー',category_id:categories[0]?.id,price:0,cast_subtotal_price:0,back_amount:0,back_points:0,is_service_target:true,is_keepable:false,in_stock:true,is_visible:true}) },
  { key:'pos', name:'料金設定', table:'pos_settings', single:true, ro:true, cols:[['set_minutes','最初のセット時間（分）','number'],['set_unit_price','セット1名単価','number'],['ext_minutes','延長単位（分）','number'],['ext_unit_price','延長1名単価','number'],['service_rate','サービス料率 %','number'],['tax_rate','消費税率 %','number'],['total_round_unit','合計の切り上げ単位','number'],['auto_hc_amount','自動で人数分つけるHC','amt'],['auto_bc_amount','自動で人数分つけるBC','amt'],['douhan_punch_limit_min','同伴の準備時間の目安（分）：伝票の立ち上げ〜出勤打刻がこれを超えるとタイムカードで本人に警告（0＝警告しない）','number'],['advance_cap_cast','日払（立替）の上限（キャスト）円','number'],['advance_cap_hall','日払（立替）の上限（黒服）円','number'],['trial_withholding_rate','体験入店の日払（立替）から引く源泉（%）','number'],['douhan_is_kakari','同伴にしたら自動で'+KL+'にする（ON＝同伴の人は自動で'+KL+'にもなる。ほかの'+KL+'も追加でき、売上は'+KL+'全員で等分／OFF＝同伴と'+KL+'は別々）','bool'],['cust_auto_kakari','お客様を伝票に登録したら、そのお客様の'+KL+'を自動で追加する','bool'],['set_point','セット1名あたりのポイント（人数分かけて、'+KL+'で均等に分ける）','number'],['ext_point','延長1回・1名あたりのポイント（人数分かけて、'+KL+'で均等に分ける）','number']] },
  { key:'print', name:'印刷設定', local:true, cols:[['print_method','印刷方法','select',[['tmpa','プリンター（TM Print Assistant）'],['browser','ブラウザ印刷（PDF）']]]] },
  { key:'audit', name:'操作ログ', audit:true },
];
let RW={point_slide:false,types:[],points:[],auto:{}}, alwMode={}; /* v11.67・SQL 140 */
let setCur='chorei', setSel=null, setEditMode=false, setCatFilter=null, auDate=null;
$('navSettings').onclick=()=>{ renderSettings(setCur); show('v-settings'); };
// v11.66：保存忘れのお知らせ（オーナー 2026-10-17。管理サイト v1.22 と同じ）。設定の「詳細」と閉店作業「⑧ その日のメモ」で、入力して保存を押さずに、設定のタブ・一覧・下のボタンで移ろうとした時
// 保存して画面が描き直されるとボタンが消える＝保存済み。精算の数（金種）は画面を移っても残るので数えない
let unsavedBtn=null, unsavedPass=false;
function unsavedMark(e){ const t=e.target; if(!t||t.closest('.modal')) return; const id=t.closest('#setForm')?'setSave':null; /* v11.72：その日のメモは自動で保存 */ if(id&&$(id)) unsavedBtn=$(id); }
$('v-settings').addEventListener('input',unsavedMark,true); $('v-settings').addEventListener('change',unsavedMark,true);
const unsavedNow=()=>!!(unsavedBtn&&unsavedBtn.isConnected&&!unsavedBtn.disabled);
async function leaveOk(){ if(!unsavedNow()) return true;
  const ans=await new Promise(res=>{ const m=document.createElement('div'); m.className='modal on'; m.style.zIndex=60;
    m.innerHTML=`<div class="box" style="width:min(420px,94vw)"><div style="font-size:18px;font-weight:700;margin-bottom:12px">保存していない変更があります</div><div style="display:flex;flex-direction:column;gap:8px"><button class="primary" data-v="save">保存して進む</button><button class="ghost" data-v="go">保存せずに進む</button><button class="ghost" data-v="" style="border:none;color:var(--muted)">戻る</button></div></div>`;
    document.body.appendChild(m); m.querySelectorAll('button').forEach(b=>b.onclick=()=>{ m.remove(); res(b.dataset.v); }); });
  if(!ans) return false;
  if(ans==='go'){ unsavedBtn=null; return true; }
  const b=unsavedBtn; b.click();
  for(let i=0,idle=0;i<1200;i++){ await new Promise(r=>setTimeout(r,100)); if(!b.isConnected||unsavedBtn!==b){ unsavedBtn=null; return true; } if(document.querySelector('.modal.on')||b.disabled) idle=0; else if(++idle>15) return false; }
  return false; }
/* 移る操作を先に止めて、小窓の後でもう一度押す */
document.addEventListener('click',async e=>{ if(unsavedPass||!unsavedNow()) return; const t=e.target.closest?.('#setMenu button,#setList .row,#setAdd,nav button,#navHall,#navOrder,#navCasts,#navCust,#navSettings'); if(!t||t.closest('.modal')) return;
  e.preventDefault(); e.stopPropagation(); if(!await leaveOk()) return; unsavedPass=true; try{ t.click(); } finally{ unsavedPass=false; } },true);
window.addEventListener('beforeunload',e=>{ if(unsavedNow()){ e.preventDefault(); e.returnValue=''; } });

