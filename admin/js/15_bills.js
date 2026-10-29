// ---------- 伝票一覧 v0.49・SQL 078：期間（31日まで）の伝票。No で中身、オーナーは直す・まとめて削除。Excel ----------
let blFrom=null, blTo=null, blFilt='all', blQ='';
const BL_F=[['all','全部'],['discount','値引あり'],['invoice','請求あり'],['oki','置きあり'],['open','来店中'],['void','削除']];
/* v0.84：重要な順（だれが・どの係で・いくら）。注文は最後。v0.85：状態は前（オーナー 2026-10-14）。収支の日次の伝票一覧も同じ並び */
const BL_COLS=[['date','営業日'],['status','状態'],['customers','お客様'],['kakari',''+KL+''],['due','合計'],['cash','現金'],['card','カード'],['invoice','請求'],['oki','置き'],
  ['guests','客数'],['table','卓'],['service','サービス料'],['discount','値引'],['surcharge','値増'],['dur','時間'],['receipt','領収書'],['ext','延長'],['items','注文']];
/* v0.87：オーナーが決めた並び（2026-10-14）。同伴・係小計・入店・退店は画面に出さず、Excel にだけ残す */
const BL_XLS_COLS=[['date','営業日'],['status','状態'],['customers','お客様'],['kakari',''+KL+''],['due','合計'],['cash','現金'],['card','カード'],['invoice','請求'],['oki','置き'],
  ['guests','客数'],['table','卓'],['douhan','同伴'],['sub',''+KL+'小計'],['service','サービス料'],['discount','値引'],['surcharge','値増'],['in','入店'],['out','退店'],['dur','時間'],['receipt','領収書'],['ext','延長'],['items','注文']]; /* 入店・退店は注文の前（オーナー） */
const BL_TXT=['customers','kakari','douhan'];
// v0.51：延長の列は回数。見出しに POS設定の延長単位を出す（例：30分延長（回））。POS設定を読めない時は「延長（回）」
let blExtL='延長'; /* v0.88：（回）はいらない（オーナー） */ const blLab=(k,l)=>k==='ext'?blExtL:l;
const BL_SUM=['guests','ext','sub','service','discount','surcharge','due','cash','card','invoice','oki'];
const blDur=(a,b)=>{ if(!a||!b) return ''; const m=Math.max(0,Math.round((new Date(b)-new Date(a))/60000)); return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`; };
const blSt=x=>x.status==='void'?'削除':x.status==='open'?'来店中':'会計済';
const blVal=(k,x)=>k==='status'?blSt(x):k==='date'?x.date:k==='in'?beHm5(x.opened_at):k==='out'?(x.closed_at?beHm(x.closed_at):''):k==='dur'?blDur(x.opened_at,x.closed_at):k==='receipt'?(x.receipt?'◯':''):BL_SUM.includes(k)?Number(x[k]||0):(x[k]??'');
PAGES.bills=async()=>{ const st=storeId, own=!!me?.is_owner, today=businessDate();
  if(!blFrom){ blFrom=today.slice(0,8)+'01'; blTo=today; }
  const f=blFrom, t=blTo;
  const head=`<h1>伝票一覧 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  <div class="card"><div class="row" style="flex-wrap:wrap;gap:8px;align-items:center"><input type="date" id="blF" value="${f}" style="width:auto"><span>〜</span><input type="date" id="blT" value="${t}" style="width:auto">
    <button class="ghost" id="blMon">月間反映</button><select id="blFl" style="width:auto">${BL_F.map(([k,n])=>`<option value="${k}" ${blFilt===k?'selected':''}>${n}</option>`).join('')}</select><button class="primary" id="blGo">検索</button>
    <span style="flex:1"></span><input id="blQ" placeholder="文字で探す" value="${esc(blQ)}" style="width:180px"></div>
    <div class="muted" style="font-size:13px;margin-top:6px">期間は31日まで。No で伝票を開きます${own?'。削除は会計済の伝票のみ':''}</div></div>`;
  $('main').innerHTML=head+'<div id="blBox"><div class="card muted">読み込み中…</div></div>';
  const wire=()=>{ $('blGo').onclick=()=>{ const a=$('blF').value, b=$('blT').value; if(!a||!b){ uiAlert('期間を入力してください'); return; } if(b<a){ uiAlert('期間が逆になっています'); return; }
      if((new Date(b)-new Date(a))/864e5>30){ uiAlert('期間は31日までにしてください'); return; } blFrom=a; blTo=b; blFilt=$('blFl').value; PAGES.bills(); };
    $('blMon').onclick=()=>{ const a=($('blF').value||today).slice(0,8)+'01', d=new Date(a+'T00:00:00'); d.setMonth(d.getMonth()+1); d.setDate(0);
      $('blF').value=a; $('blT').value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    $('blFl').onchange=()=>{ blFilt=$('blFl').value; draw(); }; $('blQ').oninput=()=>{ blQ=$('blQ').value; draw(); }; };
  wire();
  const [r,ps]=await Promise.all([sb.rpc('admin_bill_list',{p_store:st,p_from:f,p_to:t}), sb.from('pos_settings').select('ext_minutes').eq('store_id',st).maybeSingle()]); if(page!=='bills'||storeId!==st||blFrom!==f||blTo!==t) return;
  const em=Number(ps?.data?.ext_minutes||0); blExtL=em>0?`${em}分延長`:'延長';
  if(r.error){ $('blBox').innerHTML=`<div class="card err">${esc(/admin_bill_list/.test(r.error.message)?'SQL 078 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const all=(r.data||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.opened_at||'').localeCompare(String(a.opened_at||''))); let rows=[]; // v0.92：新しい順（オーナー 2026-10-15）
  const pick=()=>{ const q=blQ.trim().toLowerCase(); return all.filter(x=>blFilt==='void'?x.status==='void':x.status!=='void'&&(blFilt==='all'||(blFilt==='open'?x.status==='open':Number(x[blFilt]||0)>0)))
    .filter(x=>!q||BL_XLS_COLS.some(([k])=>String(blVal(k,x)).toLowerCase().includes(q))); };
  const cell=(k,x)=>{ const v=blVal(k,x); if(k==='status') return x.status==='closed'?'<span class="muted">会計済</span>':`<span class="badge ${x.status==='open'?'':'warnb'}">${v}</span>`;
    if(k==='date') return md(v); if(BL_SUM.includes(k)) return k==='guests'||k==='ext'?(v?v:'—'):(v?yen(v):'—'); return esc(v||(k==='out'?'':'')); };
  function draw(){ rows=pick(); const tot={}; BL_SUM.forEach(k=>tot[k]=rows.reduce((a,x)=>a+Number(x[k]||0),0));
    const del=own&&blFilt!=='void';
    $('blBox').innerHTML=`<div class="row" style="margin-bottom:8px;gap:8px">${own?`<button class="ghost" id="blXls" ${rows.length?'':'disabled'}>Excel</button>`:''}${del?'<button class="ghost" id="blDel" disabled>削除</button>':''}<span class="muted" style="font-size:13px">${rows.length}件</span></div>
    <div class="cs-w"><table class="t cs ks bl"><thead><tr>${del?'<th><input type="checkbox" id="blAll" style="width:auto;height:auto"></th>':''}<th class="nm">No</th>${BL_COLS.map(([k,l])=>`<th${k==='items'||BL_TXT.includes(k)?' style="text-align:left"':''}>${blLab(k,l)}</th>`).join('')}</tr></thead><tbody>
    <tr class="kst">${del?'<td></td>':''}<td class="nm"><b>合計</b></td>${BL_COLS.map(([k])=>`<td>${BL_SUM.includes(k)?(k==='guests'||k==='ext'?tot[k]:yen(tot[k])):''}</td>`).join('')}</tr>
    ${rows.map((x,i)=>`<tr>${del?`<td>${x.status==='closed'?`<input type="checkbox" data-blck="${x.id}" style="width:auto;height:auto">`:''}</td>`:''}<td class="nm"><a data-blv="${x.id}" style="color:var(--blue);cursor:pointer;text-decoration:underline">${i+1}</a></td>${BL_COLS.map(([k])=>`<td${k==='items'?' style="white-space:normal;min-width:180px;max-width:320px;text-align:left"':BL_TXT.includes(k)?' style="text-align:left"':''}>${cell(k,x)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${BL_COLS.length+2}" class="muted">伝票はありません</td></tr>`}</tbody></table></div>`;
    $('main').querySelectorAll('[data-blv]').forEach(a=>a.onclick=()=>{ const x=all.find(z=>z.id===a.dataset.blv); billView(a.dataset.blv,own&&x&&x.status==='closed'); });
    stickCols($('blBox').querySelector('table.bl'),(del?1:0)+5); if($('blXls')) $('blXls').onclick=guard($('blXls'),()=>blExcel(rows,f,t));
    if(del){ const ck=()=>[...$('main').querySelectorAll('[data-blck]:checked')].map(x=>x.dataset.blck), upd=()=>{ $('blDel').disabled=!ck().length; };
      $('main').querySelectorAll('[data-blck]').forEach(c=>c.onchange=upd); $('blAll').onchange=()=>{ $('main').querySelectorAll('[data-blck]').forEach(c=>c.checked=$('blAll').checked); upd(); };
      $('blDel').onclick=guard($('blDel'),async()=>{ const ids=ck(); if(!ids.length) return; const sum=ids.reduce((a,id)=>a+Number(all.find(x=>x.id===id)?.due||0),0);
        if(!await uiConfirm(`${ids.length}件の伝票（合計 ${yen(sum)}）を削除しますか？\n売上・${KL}小計・バックから外れます`,'削除','danger')) return;
        /* v1.75・SQL 293：まとめて1回で削除（途中で止まって一部だけ消えることがない） */
        const z=await rpc('admin_bill_void_many',{p_bills:ids}); if(!z.ok) return;
        toast(`${z.data??ids.length}件 削除しました`); PAGES.bills(); }); } }
  draw(); };
async function blExcel(rows,f,t){ try{ await ksLoad('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); }catch(e){ await uiAlert(e.message); return; }
  const head=['No',...BL_XLS_COLS.map(([k,l])=>blLab(k,l))], body=rows.map((x,i)=>[i+1,...BL_XLS_COLS.map(([k])=>blVal(k,x))]);
  const tot=['合計',...BL_XLS_COLS.map(([k])=>BL_SUM.includes(k)?rows.reduce((a,x)=>a+Number(x[k]||0),0):'')];
  const ws=XLSX.utils.aoa_to_sheet([[`伝票一覧 ${f}〜${t}`],head,tot,...body]); ws['!cols']=head.map(h=>({wch:h==='注文'?40:h==='お客様'||h===''+KL+''||h===blExtL?14:10}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'伝票一覧'); XLSX.writeFile(wb,`bills-${f}_${t}${ksCode()}.xlsx`); toast('ダウンロードしました'); }

