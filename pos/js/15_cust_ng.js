// ---------- NG キャスト（SQL 745・オーナー 11/26「お客様が嫌いと言った女性が二度とつかないように、それを思い出せるように」） ----------
// 顧客画面：反応◎の下に NG（× と ＋NG。押すとすぐ保存。顧客サイトと同じ形）
const CU_NG_BOX='<div style="grid-column:1/-1;margin:0 0 8px"><div class="muted" style="font-size:13px">NG</div><div id="cuNg" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:16px;padding:4px 0">…</div></div>';
async function cuNgLoad(c){ const box=$('cuNg'); if(!box) return; const r=await sb.rpc('pos_cust_ng',{p_customers:[c.id]}); if(!$('cuNg')||S.cuSel!==c.id) return; if(r.error){ box.textContent='—'; return; }
  if(!S.staffAll.length) await loadStaffAll(); const casts=S.staffAll.filter(s=>s.kind==='cast'&&s.is_active).map(s=>({id:s.id,name:s.display_name}));
  ngEditBox(box,(r.data||{})[c.id]||[],casts,async(id,on)=>{ const q=await sb.rpc('pos_cust_ng_set',{p_customer:c.id,p_staff:id,p_on:on}); if(q.error){ toast(q.error.message); return null; } const n=await sb.rpc('pos_cust_ng',{p_customers:[c.id]}); return n.error?null:((n.data||{})[c.id]||[]); }); }
// 伝票のお客様の NG（{キャストの id: ['お客様の名前', ...]}）。読めない時は空（付けるのは止めない）
async function ngOfBill(b){ const ids=[...new Set((b?.bill_customers||[]).map(x=>x.customer_id).filter(Boolean))]; if(!ids.length) return {};
  const [r,c]=await Promise.all([sb.rpc('pos_cust_ng',{p_customers:ids}), sb.from('customers').select('id,name').in('id',ids)]); if(r.error) return {};
  const nm=Object.fromEntries((c.data||[]).map(x=>[x.id,x.name])), m={}; Object.entries(r.data||{}).forEach(([cid,l])=>l.forEach(x=>(m[x.staff_id]=m[x.staff_id]||[]).push(nm[cid]||''))); return m; }
// NG の子を伝票に付ける前の確かめ（オーナー「ア 確認の箱」）。label は「係」「同伴」「アフター」。付けてよければ true
async function ngConfirm(m,sid,label){ const cs=m&&m[sid]; if(!cs||!cs.length) return true; return uiConfirm(`${snm(sid)} は ${cs.join('・')} 様の NG です。\n${label}に付けますか？`); }
// キャストを選ぶ小窓：NG の子の名前の横に小さく「NG」
function ngMarkChips(m){ ['castList','castListAll'].forEach(id=>$(id)?.querySelectorAll('.chip[data-id]').forEach(c=>{ if(m[c.dataset.id]&&!c.querySelector('.ngm')) c.insertAdjacentHTML('beforeend',' <span class="ngm" style="font-size:12px;color:var(--warn)">NG</span>'); })); }
