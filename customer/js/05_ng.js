// ---------- NG キャスト（SQL 745・POS の顧客画面と同じ形）：詳細では名前だけ、編集の画面では係のすぐ下に × と ＋NG（押すとすぐ保存） ----------
async function csNgLoad(c){ let d; try{ d=await rpc('cs_cust_ng',{p_token:token,p_id:c.id}); }catch(e){ const x=$('dNg'); if(x) x.textContent='—'; return; } const box=$('dNg'); if(!box||!cur||cur.customer.id!==c.id) return; box.innerHTML=ngView(d||[]); }
async function csNgEdit(s,c){ const box=s.querySelector('[data-ngbox]'); if(!box) return; let d; try{ d=await rpc('cs_cust_ng',{p_token:token,p_id:c.id}); }catch(e){ box.textContent='—'; return; }
  const casts=(boot.staff||[]).filter(x=>x.kind==='cast'&&x.active).map(x=>({id:x.id,name:x.name}));
  ngEditBox(box,d||[],casts,async(id,on)=>{ if(!await needEdit()) return null; try{ const r=await rpc('cs_cust_ng_set',{p_token:token,p_edit_token:editTok,p_id:c.id,p_staff:id,p_on:on}); csNgLoad(c); return r||[]; }catch(e){ await csFail(e); return null; } }); }
