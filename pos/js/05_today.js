// ---------- 上部バーの［本日］（本日の売上・来店） ----------
// v10.58：本日の売上・来店（上部バーの［本日］をタップした時だけ表示。再度タップで閉じる）。数え方は伝票一覧と同じ（置きは全額入金の日）
async function todaySum(){ const el=$('tdSum'); el.textContent='…'; const today=businessDate(); const BSEL='id,status,guest_count,business_date,payments(method,amount,received_at,revenue_date)';
  const q1=await sb.from('bills').select(BSEL).eq('store_id',store.id).eq('business_date',today); if(q1.error){ el.textContent='—'; return; }
  const pr=await sb.from('payments').select('bill_id').eq('revenue_date',today).gt('amount',0).not('received_at','is',null); const have=new Set((q1.data||[]).map(b=>b.id)); const ids=[...new Set((pr.data||[]).map(p=>p.bill_id))].filter(i=>!have.has(i));
  const q2=ids.length?await sb.from('bills').select(BSEL).eq('store_id',store.id).in('id',ids):{data:[]};
  const all=[...(q1.data||[]),...(q2.data||[])]; const sales=all.filter(b=>b.status==='closed'&&!(b.payments||[]).some(p=>p.method==='oki'&&p.amount>0&&!p.received_at)&&billDay(b)===today); const open=all.filter(b=>b.status==='open'&&b.business_date===today);
  const vis=(q1.data||[]).filter(b=>b.status!=='void'); const tot={}; await Promise.all([...sales,...open].map(async b=>{ const r=await sb.rpc('calc_bill',{p_bill:b.id}); tot[b.id]=r.data?.amount_due||0; }));
  const s=sales.reduce((a,b)=>a+tot[b.id],0), o=open.reduce((a,b)=>a+tot[b.id],0); if(el.style.display==='none') return;
  el.innerHTML=`売上 <b>${yen(s)}</b>${o?` <small style="opacity:.75">（営業中 ${yen(o)}）</small>`:''}　来店 <b>${vis.length}</b>組 <b>${vis.reduce((a,b)=>a+(b.guest_count||0),0)}</b>名`; }
let tdTimer=null; // v10.59：開いて1分たったら自動で閉じる
function tdClose(){ clearTimeout(tdTimer); $('tdSum').style.display='none'; $('tdBtn').style.display=''; }
$('tdBtn').onclick=()=>{ $('tdBtn').style.display='none'; $('tdSum').style.display=''; todaySum(); clearTimeout(tdTimer); tdTimer=setTimeout(tdClose,60000); };
$('tdSum').onclick=tdClose;
