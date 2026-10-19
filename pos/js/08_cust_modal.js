// ---------- customer modal ----------
let custPick=null;
$('custAddBtn').onclick=()=>{ $('custCancel').textContent='伝票へ戻る'; custPick=null; $('custSearch').value=''; renderCust(''); $('custModal').classList.add('on'); };
$('custCancel').onclick=()=>$('custModal').classList.remove('on');
function renderCust(q){ const on=new Set(custPick?[]:((cur&&cur.bill_customers)||[]).map(x=>x.customer_id)); const list=customers.filter(c=>!on.has(c.id)&&(!q||c.name.includes(q))).slice(0,40);
  /* v11.95：お客様の共有（cust_share）で見えている、ほかの店のお客様には「他店」と出す（ゲネプロ #14） */ $('custList').innerHTML=list.map(c=>`<button class="chip" data-id="${c.id}">${esc(c.name)}${c.store_id&&c.store_id!==store.id?' <small class="muted">他店</small>':''}</button>`).join('')||'<span class="muted">該当なし</span>';
  $('custList').querySelectorAll('.chip').forEach(b=>b.onclick=()=>attachCust(b.dataset.id)); }
$('custSearch').oninput=e=>renderCust(e.target.value.trim());
/* v11.85：お客様の新規登録。登録と読み返しを分ける（同じ命令で読み返すと、まだ「見てよいお客様」に入っていないので断られる。2026-10-18 ゲネプロで見つけた） */
async function custInsert(name){ const id=crypto.randomUUID(); const r=await sb.from('customers').insert({id,store_id:store.id,name}); if(r.error) return r; return await sb.from('customers').select('*').eq('id',id).single(); }
$('custNew').onclick=async()=>{ const name=$('custSearch').value.trim(); if(!name){toast('名前を入力してください');return;}
  const { data, error } = await custInsert(name); if(error){toast(error.message);return;}
  customers.push(data); customers.sort((a,b)=>a.name.localeCompare(b.name,'ja')); attachCust(data.id); };
async function attachCust(id){ if(custPick){ const c=customers.find(x=>x.id===id); $('custModal').classList.remove('on'); custPick(c); custPick=null; return; } const { error } = await sb.from('bill_customers').insert({bill_id:cur.id,customer_id:id}); if(error&&!error.message.includes('duplicate')) toast(error.message); else if(!error) await logOp('お客様を伝票に追加',{customer:customers.find(x=>x.id===id)?.name});
  const kc=customers.find(x=>x.id===id)?.kakari_staff_id; if(kc&&settings.cust_auto_kakari!==false&&!(cur.bill_casts||[]).some(c=>c.staff_id===kc)){ const r=await sb.from('bill_casts').insert({bill_id:cur.id,staff_id:kc,role:'none',is_kakari:true}); if(r.error) toast(r.error.message); else await syncHcBack(); } $('custModal').classList.remove('on'); openBill(cur.id); }

