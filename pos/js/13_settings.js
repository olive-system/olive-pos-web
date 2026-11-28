// ---------- settings（d-system風：一覧＋詳細、編集モードで長押し並び替え・削除） ----------
/* 設定の項目の表（描くのは 20_settings_list.js の renderSettings）。印の意味：
   chorei・closing・bills・audit＝その項目だけの画面を出す（一覧と詳細の形ではない）
   table＝表の名前（一覧と詳細で行を直す）・cols＝[列, 見出し, 種類（text・number・bool・cat＝カテゴリーを選ぶ・select＝4つ目の選択肢から選ぶ・amt＝0 なら「付けない」と出す金額）]・newRow＝［＋追加］の行の始めの値
   single＝店に1行だけの表（一覧を出さず、詳細だけ）・ro＝POS では読むだけ（変えるのは管理サイトの POS設定）・local＝この端末の中だけに覚える（印刷のしかた） */
const SET = [
  { key:'chorei', name:'朝礼', chorei:true }, // 朝礼（中身も並びも、オーナーが決める）
  { key:'closing', name:'閉店作業', closing:true },
  { key:'bills', name:'伝票一覧', bills:true },
  { key:'tables', name:'テーブル', table:'tables', label:r=>r.name, cols:[['name','テーブル名','text'],['is_visible','表示','bool']], newRow:()=>({store_id:S.store.id,name:'新しいテーブル',is_visible:true}) },
  { key:'categories', name:'カテゴリー', table:'categories', label:r=>r.name, cols:[['name','カテゴリー名','text'],['short_name','略称','text'],['is_visible','表示','bool'],['is_industry_target','同業者モードの対象','bool']], newRow:()=>({store_id:S.store.id,name:'新しいカテゴリー',is_visible:true,is_industry_target:false}) },
  { key:'products', name:'メニュー', table:'products', label:r=>r.name, sub:r=>yen(r.price), cols:[['name','メニュー名','text'],['short_name','略称','text'],['category_id','カテゴリー','cat'],['price','販売価格（税抜）','number'],['cast_subtotal_price','小計価格（'+KL+'小計に入る額）','number'],['back_amount','バック金額','number'],['back_points','バックポイント','number'],['is_service_target','サービス料の対象','bool'],['is_keepable','キープ可','bool'],['in_stock','在庫あり','bool'],['is_visible','表示','bool']], newRow:()=>({store_id:S.store.id,name:'新メニュー',category_id:S.categories[0]?.id,price:0,cast_subtotal_price:0,back_amount:0,back_points:0,is_service_target:true,is_keepable:false,in_stock:true,is_visible:true}) },
  { key:'pos', name:'料金設定', table:'pos_settings', single:true, ro:true, cols:[['set_minutes','最初のセット時間（分）','number'],['set_unit_price','セット1名単価','number'],['ext_minutes','延長単位（分）','number'],['ext_unit_price','延長1名単価','number'],['service_rate','サービス料率 %','number'],['tax_rate','消費税率 %','number'],['total_round_unit','合計の切り上げ単位','number'],['auto_hc_amount','自動で人数分つけるHC','amt'],['auto_bc_amount','自動で人数分つけるBC','amt'],['douhan_punch_limit_min','同伴の準備時間の目安（分）：伝票の立ち上げ〜出勤打刻がこれを超えるとタイムカードで本人に警告（0＝警告しない）','number'],['advance_cap_cast','日払（立替）の上限（キャスト）円','number'],['advance_cap_hall','日払（立替）の上限（黒服）円','number'],['trial_withholding_rate','体験入店の日払（立替）から引く源泉（%）','number'],['douhan_is_kakari','同伴にしたら自動で'+KL+'にする（ON＝同伴の人は自動で'+KL+'にもなる。ほかの'+KL+'も追加でき、売上は'+KL+'全員で等分／OFF＝同伴と'+KL+'は別々）','bool'],['cust_auto_kakari','お客様を伝票に登録したら、そのお客様の'+KL+'を自動で追加する','bool'],['set_point','セット1名あたりのポイント（人数分かけて、'+KL+'で均等に分ける）','number'],['ext_point','延長1回・1名あたりのポイント（人数分かけて、'+KL+'で均等に分ける）','number']] },
  { key:'print', name:'印刷設定', local:true, cols:[['print_method','印刷方法','select',[['tmpa','プリンター（TM Print Assistant）'],['browser','ブラウザ印刷（PDF）']]]] },
  { key:'audit', name:'操作ログ', audit:true },
];
{ const c=SET.find(s=>s.key==='pos').cols; const i=c.findIndex(x=>x[0]==='ext_unit_price'); c.splice(i<0?c.length:i+1,0,['auto_extend','自動延長','bool']); } /* 延長1名単価のすぐ下に「自動延長　する／しない」（SQL 701 で足した列。位置を番号でなく列の名前で決める：上の列の並びを変えても、延長1名単価の下からずれない） */
S.RW={point_slide:false,types:[],points:[],auto:{}}; S.alwMode={}; S.afMode={}; /* キャストの画面（04_casts.js）の始めの値：RW＝報酬の種類と今日のポイント・alwMode＝人ごとの手当の入れ方（金額／ポイント）・afMode＝人ごとの日払／罰金の切り替え */
S.setCur='chorei'; S.setSel=null; S.setEditMode=false; S.setCatFilter=null; S.auDate=null; /* 開いている項目・選んでいる行・並び替えの最中か・メニューの絞り込みのカテゴリー・操作ログの日 */
$('navSettings').onclick=()=>{ renderSettings(S.setCur); show('v-settings'); };
// 保存忘れのお知らせ（オーナー。管理サイト v1.22 と同じ）。設定の「詳細」と閉店作業「⑧ その日のメモ」で、入力して保存を押さずに、設定のタブ・一覧・下のボタンで移ろうとした時
// 保存して画面が描き直されるとボタンが消える＝保存済み。精算の数（金種）は画面を移っても残るので数えない
let unsavedBtn=null, unsavedPass=false; /* unsavedBtn＝まだ押されていない保存のボタン（触った詳細の［保存］）・unsavedPass＝小窓の後に押し直す間だけ見張りを外す印 */
/* その日のメモは自動保存なので、保存ボタンのある設定の詳細（#setForm）だけを見張る */
function setUnsavedMark(e){ const t=e.target; if(!t||t.closest('.modal')) return; const id=t.closest('#setForm')?'setSave':null; /* その日のメモは自動で保存 */ if(id&&$(id)) unsavedBtn=$(id); }
$('v-settings').addEventListener('input',setUnsavedMark,true); $('v-settings').addEventListener('change',setUnsavedMark,true);
const unsavedNow=()=>!!(unsavedBtn&&unsavedBtn.isConnected&&!unsavedBtn.disabled);
async function setLeaveOk(){ if(!unsavedNow()) return true;
  /* 3つのボタンのどれかでしか閉じない小窓（mkModal は外側を押しても Esc でも閉じない）。3択は共通の確かめの箱（uiConfirm は2択）に無いので、ここで作る */
  const ans=await new Promise(res=>{ const m=mkModal(60);
    m.innerHTML=`<div class="box" style="width:min(420px,94vw)"><div style="font-size:18px;font-weight:700;margin-bottom:12px">保存していない変更があります</div><div style="display:flex;flex-direction:column;gap:8px"><button class="primary" data-v="save">保存して進む</button><button class="ghost" data-v="go">保存せずに進む</button><button class="ghost" data-v="" style="border:none;color:var(--muted)">戻る</button></div></div>`;
    document.body.appendChild(m); m.querySelectorAll('button').forEach(b=>b.onclick=()=>{ m.remove(); res(b.dataset.v); }); });
  if(!ans) return false;
  if(ans==='go'){ unsavedBtn=null; return true; }
  /* 保存を押して、最長 120 秒（100ms×1200）待つ。ボタンが消えた＝描き直された＝保存できた。知らせの箱が出ている間と保存中（押せない間）は待ち続け、どちらでもないまま 1.5 秒（100ms×15）たったら、保存できなかったとして元の画面に残る（エラーは保存の側が知らせの箱で出している） */
  const b=unsavedBtn; b.click();
  for(let i=0,idle=0;i<1200;i++){ await new Promise(r=>setTimeout(r,100)); if(!b.isConnected||unsavedBtn!==b){ unsavedBtn=null; return true; } if(document.querySelector('.modal.on')||b.disabled) idle=0; else if(++idle>15) return false; }
  return false; }
/* 移る操作を先に止めて、小窓の後でもう一度押す。ほかのボタンの動きより先に止めるため、受け取りは capture（true）。移るボタンを新しく足した時は、下の並びにも足す */
document.addEventListener('click',async e=>{ if(unsavedPass||!unsavedNow()) return; const t=e.target.closest?.('#setMenu button,#setList .row,#setAdd,nav button,#navHall,#navOrder,#navCasts,#navCust,#navSettings,#storeName'); if(!t||t.closest('.modal')) return;
  e.preventDefault(); e.stopPropagation(); if(!await setLeaveOk()) return; unsavedPass=true; try{ t.click(); } finally{ unsavedPass=false; } },true);
window.addEventListener('beforeunload',e=>{ if(unsavedNow()){ e.preventDefault(); e.returnValue=''; } });

