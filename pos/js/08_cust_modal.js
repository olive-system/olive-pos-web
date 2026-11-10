// ---------- customer modal ----------
let custPick=null, custBill=null; /* v12.72：閉店作業「① お客様登録」から追加する時の伝票（新規のお連れ様の係に使う） */
$('custAddBtn').onclick=()=>{ $('custCancel').textContent='伝票へ戻る'; custPick=null; custBill=null; $('custSearch').value=''; renderCust(''); $('custModal').classList.add('on'); cuFresh().then(()=>{ if($('custModal').classList.contains('on')) renderCust($('custSearch').value.trim()); }); };
$('custCancel').onclick=()=>{ $('custModal').classList.remove('on'); if(custBill){ custPick=null; custBill=null; } };
/* v12.28・SQL 276：お客様を追加の並びも最近出てきた順（来店・予約・情報の更新。顧客の画面と同じ。オーナー 2026-10-29）。顧客の画面をまだ開いていない時は、最近出てきた時刻だけ読む */
function custActLoad(){ if(custActLoad.on||Object.keys(cuInfo.act||{}).length) return; custActLoad.on=true; sb.rpc('pos_cust_act').then(r=>{ custActLoad.on=false; if(r.error||!r.data||typeof r.data!=='object') return; cuInfo.act=r.data; if($('custModal').classList.contains('on')) renderCust($('custSearch').value.trim()); }); }
function renderCust(q){ custActLoad(); const on=new Set(custPick?[]:((cur&&cur.bill_customers)||[]).map(x=>x.customer_id)); const list=customers.filter(c=>!on.has(c.id)&&(!q||c.name.includes(q)||kanaHit(c,q))).sort((a,b)=>cuAct(b)-cuAct(a)||jaCmp(a.name,b.name)||String(a.id).localeCompare(String(b.id))).slice(0,40);
  /* v11.95：お客様の共有（cust_share）で見えている、ほかの店のお客様には「他店」と出す（ゲネプロ #14） */ $('custList').innerHTML=list.map(c=>`<button class="chip" data-id="${c.id}">${esc(c.name)}${c.store_id&&c.store_id!==store.id?' <small class="muted">他店</small>':''}</button>`).join('')||'<span class="muted">該当なし</span>';
  $('custList').querySelectorAll('.chip').forEach(b=>b.onclick=()=>attachCust(b.dataset.id)); }
$('custSearch').oninput=e=>renderCust(e.target.value.trim());
/* v11.85：お客様の新規登録。登録と読み返しを分ける（同じ命令で読み返すと、まだ「見てよいお客様」に入っていないので断られる。2026-10-18 ゲネプロで見つけた） */
async function custInsert(name){ const id=crypto.randomUUID(); const r=await sb.rpc('pos_customer_add',{p:{id,store_id:store.id,name}}); if(r.error) return r; return await sb.from('customers').select('*').eq('id',id).single(); }
$('custNew').onclick=guard($('custNew'),async()=>{ /* v12.30：二度押しで同じお客様が2人できないように */ const name=$('custSearch').value.trim(); if(!name){toast('名前を入力してください');return;}
  const kk=await custTsureKakari(); const { data, error } = await custInsert(name); if(error){toast(error.message);return;}
  let km=''; if(kk){ const kr=await sb.rpc('pos_kakari_set',{p_customer:data.id,p_store:store.id,p_staff:kk}); if(kr.error) toast(''+KL+'を保存できません：'+kr.error.message); else { data.kakari_staff_id=kk; km=`係 ${snm(kk)} を登録しました`; } }
  customers.push(data); customers.sort((a,b)=>a.name.localeCompare(b.name,'ja')); await attachCust(data.id); if(km) toast(km); });
/* v12.46・SQL 328：銀座（係の店）だけ。伝票に新規のお客様（お連れ様）を登録した時、伝票の最初のお客様の係を、新規のお客様の係にする。最初のお客様に係が無い時は伝票の係（1人の時だけ）。広島（担当の店）ではしない（オーナー 2026-11-02「銀座ルール」） */
async function custTsureKakari(){ const bl=custBill||cur; if((custPick&&!custBill)||!bl||KL!=='係') return null; const act=id=>staffAll.some(s=>s.id===id&&s.is_active);
  const r=await sb.from('bill_customers').select('customer_id').eq('bill_id',bl.id).order('created_at').limit(1); if(r.error) return null;
  if(r.data?.length){ const k=await sb.from('customer_kakari').select('staff_id').eq('customer_id',r.data[0].customer_id).eq('store_id',store.id).maybeSingle(); if(k.data?.staff_id&&act(k.data.staff_id)) return k.data.staff_id; }
  const ks=[...new Set((bl.bill_casts||[]).filter(c=>c.is_kakari).map(c=>c.staff_id))]; return ks.length===1&&act(ks[0])?ks[0]:null; }
async function attachCust(id){ if(custPick){ const c=customers.find(x=>x.id===id); $('custModal').classList.remove('on'); custPick(c); custPick=null; return; } const { error } = await sb.rpc('pos_rows_add',{p_table:'bill_customers',p:{bill_id:cur.id,customer_id:id}}); if(error&&!error.message.includes('duplicate')) toast(error.message); else if(!error) await logOp('お客様を伝票に追加',{customer:customers.find(x=>x.id===id)?.name});
  const kc=customers.find(x=>x.id===id)?.kakari_staff_id; if(kc&&settings.cust_auto_kakari!==false&&!(cur.bill_casts||[]).some(c=>c.staff_id===kc)){ const r=await sb.rpc('pos_rows_add',{p_table:'bill_casts',p:{bill_id:cur.id,staff_id:kc,role:'none',is_kakari:true}}); if(r.error) toast(r.error.message); else await syncHcBack(); } $('custModal').classList.remove('on'); await openBill(cur.id); if(!error) await resvDouhan(customers.find(x=>x.id===id)); }

