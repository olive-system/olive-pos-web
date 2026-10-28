// ---------- 顧客サイト v0.37・SQL 076：顧客サイト（preview）をそのまま中に出す。顧客サイトのパスワードは聞かない（管理サイトのログインで入場券をもらう）。編集は「顧客サイト」を編集できる人だけ ----------
let csFrameMsg=null;
// v0.62：お客様のデータ（Excel）。期間の会計済の伝票から、お客様ごとに 名前・係・来店回数・金額（伝票の合計）を金額の高い順に。1枚の伝票にお客様が2人以上いる時は、全員にその伝票の金額を付ける（オーナーの指示）。登録の無い伝票は入らない
let cdFrom=null, cdTo=null;
async function custDataExcel(st,f,t){ try{ await ksLoad('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); }catch(e){ await uiAlert(e.message); return; }
  // v0.63：係は店ごとの表（customer_kakari。POS と同じ）。読めない時だけ、前の列（customers.kakari_staff_id）
  const bills=[]; let ck='customer_kakari(store_id,staff_id)'; for(let i=0;i<50;i++){ const q=await sb.from('bills').select(`id,business_date,bill_customers(customer_id,customers(name,${ck})),payments(amount)`).eq('store_id',st).eq('status','closed').gte('business_date',f).lte('business_date',t).order('business_date').order('id').range(i*1000,i*1000+999);
    if(q.error&&i===0&&ck!=='kakari_staff_id'&&/customer_kakari/.test(q.error.message)){ ck='kakari_staff_id'; i=-1; continue; }
    if(q.error){ await uiAlert('読み込めません：'+q.error.message); return; } bills.push(...(q.data||[])); if((q.data||[]).length<1000) break; }
  const kOf=c=>c?('customer_kakari' in c?((c.customer_kakari||[]).find(x=>x.store_id===st)?.staff_id||null):c.kakari_staff_id):null;
  const sf=await sb.from('staff').select('id,display_name').eq('store_id',st); const sn={}; (sf.data||[]).forEach(x=>{ sn[x.id]=x.display_name; });
  const M={}; for(const b of bills){ const amt=(b.payments||[]).reduce((a,p)=>a+Number(p.amount||0),0); const seen=new Set();
    for(const c of (b.bill_customers||[])){ if(!c.customer_id||seen.has(c.customer_id)) continue; seen.add(c.customer_id); const m=M[c.customer_id]||(M[c.customer_id]={name:c.customers?.name||'',kakari:sn[kOf(c.customers)]||'',n:0,amt:0}); m.n++; m.amt+=amt; } }
  const rows=Object.values(M).sort((a,b)=>b.amt-a.amt||b.n-a.n||String(a.name).localeCompare(String(b.name),'ja'));
  if(!rows.length){ await uiAlert('この期間に、お客様を登録した会計済の伝票はありません'); return; }
  const ws=XLSX.utils.aoa_to_sheet([[`お客様のデータ ${f}〜${t}`],['No','名前',KL,'来店回数','金額'],...rows.map((x,i)=>[i+1,x.name,x.kakari,x.n,x.amt])]); ws['!cols']=[{wch:5},{wch:24},{wch:12},{wch:10},{wch:14}];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'お客様のデータ'); XLSX.writeFile(wb,`customers-${f}_${t}${ksCode()}.xlsx`); toast('ダウンロードしました'); }
PAGES.cust=()=>{ const st=storeId, today=businessDate(); if(!cdFrom){ cdFrom=today.slice(0,8)+'01'; cdTo=today; }
  $('main').innerHTML=`<h1>顧客サイト <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  ${me?.is_owner?`<div class="row" style="flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px"><input type="date" id="cdF" value="${cdFrom}" style="width:auto"><span>〜</span><input type="date" id="cdT" value="${cdTo}" style="width:auto"><button class="ghost" id="cdXls">Excel</button>
    <span class="muted" style="font-size:13px">お客様ごとの来店回数・金額</span></div>`:''}
  <iframe id="csFrame" src="../customer/preview.html#admin" title="顧客サイト" style="width:100%;height:calc(100vh - 210px);min-height:480px;border:1px solid var(--line);border-radius:12px;background:#fff"></iframe>`;
  if(csFrameMsg) window.removeEventListener('message',csFrameMsg);
  csFrameMsg=async e=>{ const f=$('csFrame'); if(!f||e.source!==f.contentWindow||e.origin!==location.origin||!e.data||e.data.type!=='olive-cs-need') return;
    const r=await sb.rpc('admin_cs_session',{p_store:st}); if(!$('csFrame')||storeId!==st) return;
    const d=r.error?{error:/admin_cs_session/.test(r.error.message)?'SQL 076 が未実行です':r.error.message}:(r.data||{});
    f.contentWindow.postMessage({type:'olive-cs-auth',...d},location.origin); };
  window.addEventListener('message',csFrameMsg);
  if($('cdXls')) $('cdXls').onclick=guard($('cdXls'),async()=>{ const a=$('cdF').value, b=$('cdT').value; if(!a||!b){ await uiAlert('期間を入力してください'); return; } if(b<a){ await uiAlert('期間が逆になっています'); return; }
    if((new Date(b)-new Date(a))/864e5>366){ await uiAlert('期間は1年までにしてください'); return; } cdFrom=a; cdTo=b; await custDataExcel(st,a,b); }); };

