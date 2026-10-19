// ---------- 履歴 v0.56：メモ一覧（日のメモ）・入出金履歴・印刷履歴（領収書の発行）・削除履歴（操作ログのうち、消した・取り消した操作）。どれも見るだけ。SQL なし（表を直接読む） ----------
// 期間（31日まで）は 入出金履歴・印刷履歴・削除履歴 で共通。メモ一覧は月
let hiFrom=null, hiTo=null, hiMonth=null, hiCashK='all', hiDelK='all';
const hiDay=x=>{ if(!x) return '—'; const wd=new Date(x+'T00:00:00').getDay(); return `${md(x)} <span style="color:${wd===0?'var(--warn)':wd===6?'var(--pri)':'var(--muted)'}">${WJ[wd]}</span>`; };
const hiDT=t=>t?new Date(t).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'';
const hiHead=k=>`<h1>${esc(nameOf(k))} <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
function hiPeriod(k,extra,note){ const today=businessDate(); if(!hiFrom){ hiFrom=today.slice(0,8)+'01'; hiTo=today; }
  $('main').innerHTML=hiHead(k)+`<div class="card"><div class="row" style="flex-wrap:wrap;gap:8px;align-items:center"><input type="date" id="hiF" value="${hiFrom}" style="width:auto"><span>〜</span><input type="date" id="hiT" value="${hiTo}" style="width:auto">
    <button class="ghost" id="hiMon">月間反映</button>${extra||''}<button class="primary" id="hiGo">検索</button></div>
    <div class="muted" style="font-size:13px;margin-top:6px">期間は31日まで${note||''}</div></div><div id="hiBox"><div class="card muted">読み込み中…</div></div>`;
  $('hiGo').onclick=()=>{ const a=$('hiF').value, b=$('hiT').value; if(!a||!b){ uiAlert('期間を入力してください'); return; } if(b<a){ uiAlert('期間が逆になっています'); return; }
    if((new Date(b)-new Date(a))/864e5>30){ uiAlert('期間は31日までにしてください'); return; } hiFrom=a; hiTo=b; PAGES[k](); };
  $('hiMon').onclick=()=>{ const a=($('hiF').value||today).slice(0,8)+'01', d=new Date(a+'T00:00:00'); d.setMonth(d.getMonth()+1); d.setDate(0);
    $('hiF').value=a; $('hiT').value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }; }
const hiErr=e=>{ $('hiBox').innerHTML=`<div class="card err">読み込めません：${esc(e.message)}</div>`; };

// メモ一覧：POS の閉店作業で書く「日のメモ」を月で
PAGES.hist_memo=async()=>{ const st=storeId, now=csNowMonth(); if(!hiMonth) hiMonth=now; const m=hiMonth, mOpts=Array.from({length:13},(_,i)=>csAddMonth(now,-i));
  $('main').innerHTML=hiHead('hist_memo')+`<div class="row" style="margin-bottom:12px"><select id="hiM" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel(x)}</option>`).join('')}</select></div><div id="hiBox"><div class="card muted">読み込み中…</div></div>`;
  $('hiM').onchange=()=>{ hiMonth=$('hiM').value; PAGES.hist_memo(); };
  const r=await sb.from('daily_memos').select('business_date,memo').eq('store_id',st).gte('business_date',m).lt('business_date',csAddMonth(m,1)).order('business_date',{ascending:false});
  if(page!=='hist_memo'||storeId!==st||hiMonth!==m) return; if(r.error){ hiErr(r.error); return; }
  const rows=(r.data||[]).filter(x=>String(x.memo||'').trim());
  $('hiBox').innerHTML=`<div class="card">${rows.length?`<table class="t"><tr><th style="white-space:nowrap">営業日</th><th>メモ</th></tr>${rows.map(x=>`<tr><td style="white-space:nowrap;vertical-align:top">${hiDay(x.business_date)}</td><td style="white-space:pre-wrap;width:100%">${esc(x.memo)}</td></tr>`).join('')}</table>`:'<div class="muted">メモはありません</div>'}</div>
    <div class="muted" style="font-size:13px">POS の閉店作業で書いたメモです</div>`; };

// 入出金履歴：期間の入金・出金（今あるものだけ。消したものは削除履歴）。Excel
PAGES.hist_cash=async()=>{ const st=storeId;
  hiPeriod('hist_cash',`<select id="hiK" style="width:auto">${[['all','全部'],['in','入金'],['out','出金']].map(([k,n])=>`<option value="${k}" ${hiCashK===k?'selected':''}>${n}</option>`).join('')}</select>`,'。削除した入出金は「削除履歴」に表示されます');
  const f=hiFrom, t=hiTo; let all=[], rows=[];
  const draw=()=>{ rows=all.filter(x=>hiCashK==='all'||x.kind===hiCashK); const sum=k=>rows.filter(x=>x.kind===k).reduce((a,x)=>a+Number(x.amount||0),0);
    $('hiBox').innerHTML=`<div class="row" style="margin-bottom:8px;gap:8px"><button class="ghost" id="hiXls" ${rows.length?'':'disabled'}>Excel</button><span class="muted" style="font-size:13px">${rows.length}件</span></div>
    <div class="cs-w"><table class="t cs ks"><thead><tr><th class="nm">営業日</th><th style="text-align:left">摘要</th><th>入金</th><th>出金</th></tr></thead><tbody>
    <tr class="kst"><td class="nm"><b>合計</b></td><td></td><td>${yen(sum('in'))}</td><td>${yen(sum('out'))}</td></tr>
    ${rows.map(x=>`<tr><td class="nm">${hiDay(x.business_date)}</td><td style="text-align:left;white-space:normal">${esc(x.memo||'')}</td><td>${x.kind==='in'?yen(x.amount):''}</td><td>${x.kind==='out'?yen(x.amount):''}</td></tr>`).join('')||'<tr><td colspan="4" class="muted" style="text-align:left">入出金はありません</td></tr>'}</tbody></table></div>`;
    $('hiXls').onclick=guard($('hiXls'),async()=>{ try{ await ksLoad('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); }catch(e){ await uiAlert(e.message); return; }
      const ws=XLSX.utils.aoa_to_sheet([[`入出金履歴 ${f}〜${t}`],['営業日','摘要','入金','出金'],['合計','',sum('in'),sum('out')],...rows.map(x=>[x.business_date,x.memo||'',x.kind==='in'?Number(x.amount||0):'',x.kind==='out'?Number(x.amount||0):''])]);
      ws['!cols']=[{wch:12},{wch:30},{wch:12},{wch:12}]; const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'入出金履歴'); XLSX.writeFile(wb,`cash-${f}_${t}${ksCode()}.xlsx`); toast('ダウンロードしました'); }); };
  $('hiK').onchange=()=>{ hiCashK=$('hiK').value; draw(); };
  const r=await sb.from('cash_movements').select('id,business_date,kind,amount,memo,created_at').eq('store_id',st).gte('business_date',f).lte('business_date',t).order('business_date').order('created_at');
  if(page!=='hist_cash'||storeId!==st||hiFrom!==f||hiTo!==t) return; if(r.error){ hiErr(r.error); return; }
  all=r.data||[]; draw(); };

// 印刷履歴：領収書の発行（概算・会計・明細の印刷は記録していない）
PAGES.hist_print=async()=>{ const st=storeId; hiPeriod('hist_print','','。領収書の発行の記録です（概算・会計・明細の印刷は記録していません）'); const f=hiFrom, t=hiTo;
  const r=await sb.from('receipts').select('id,issued_at,issue_date,visit_date,name,guest_count,amount,cash_amount,card_amount,reissue_reason').eq('store_id',st).gte('issue_date',f).lte('issue_date',t).order('issued_at',{ascending:false}).limit(1000);
  if(page!=='hist_print'||storeId!==st||hiFrom!==f||hiTo!==t) return; if(r.error){ hiErr(r.error); return; }
  const rows=r.data||[];
  $('hiBox').innerHTML=`<div class="row" style="margin-bottom:8px"><span class="muted" style="font-size:13px">${rows.length}件${rows.length>=1000?'（1000件まで。期間を短くしてください）':''}</span></div>
    <div class="cs-w"><table class="t cs ks"><thead><tr><th class="nm">発行日</th><th>来店日</th><th style="text-align:left">宛名</th><th>客数</th><th>金額</th><th>現金</th><th>カード</th><th style="text-align:left">再発行の理由</th></tr></thead><tbody>
    ${rows.map(x=>`<tr><td class="nm">${hiDay(x.issue_date)} <small class="muted">${beHm(x.issued_at)}</small></td><td>${x.visit_date?md(x.visit_date):'—'}</td><td style="text-align:left">${esc(x.name||'')}</td><td>${x.guest_count??'—'}</td><td><b>${yen(x.amount)}</b></td><td>${Number(x.cash_amount||0)?yen(x.cash_amount):'—'}</td><td>${Number(x.card_amount||0)?yen(x.card_amount):'—'}</td><td style="text-align:left;white-space:normal">${x.reissue_reason?`<span class="badge warnb">再発行</span> ${esc(x.reissue_reason)}`:''}</td></tr>`).join('')||'<tr><td colspan="8" class="muted" style="text-align:left">領収書の発行はありません</td></tr>'}</tbody></table></div>`; };

// 削除履歴：操作ログ（pos_audit_log）のうち、名前に 削除・取消・取り消し・外す が入る操作。営業日は朝8時で区切る
const HI_KJ={amount:'金額',minutes:'分',is_auto:'自動延長',before:'変更前',after:'変更後',item:'商品',qty:'数量',total:'請求額',guest_count:'客数',items:'注文',name:'名前',fields:'内容',customer:'お客様',bottle:'ボトル',kind:'種別',total_before:'切替前の請求額',method:'支払方法',payments:'支払',kakari:''+KL+'',tag_no:'タグ番号',by:'操作者',date:'営業日',business_date:'営業日',memo:'摘要'};
const hiVal=v=>v===true?'はい':v===false?'いいえ':Array.isArray(v)?v.map(hiVal).join('、'):v&&typeof v==='object'?Object.entries(v).map(([k,z])=>`${HI_KJ[k]||k}：${hiVal(z)}`).join('・'):typeof v==='number'?v.toLocaleString('ja-JP'):String(v);
const HI_UNIT={amount:'円',total:'円',total_before:'円',minutes:'分',guest_count:'名'}; // 数字には単位
const logShort=(o,KJ,val,unit)=>{ const e=Object.entries(o||{}).filter(([k,v])=>v!==null&&v!==undefined&&v!==''&&!(Array.isArray(v)&&!v.length)&&k!=='table'&&k!=='reason'); e.sort((a,b)=>(a[0]==='by'?-1:0)-(b[0]==='by'?-1:0));
  const md=v=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); return m?`${+m[2]}/${+m[3]}`:String(v); }, U={amount:'円',total:'円',total_before:'円',minutes:'分',guest_count:'名'};
  return e.map(([k,v])=>{ const n=typeof v==='number'?v.toLocaleString('ja-JP')+(U[k]||''):null;
    if(k==='by') return '操作者：'+String(v).replace(/^管理サイト：/,'');
    if(k==='date'||k==='business_date') return md(v);
    if(k==='kind'&&(v==='in'||v==='out')) return v==='in'?'入金':'出金';
    if(k==='is_auto') return v?'自動延長':'手動延長';
    if(['amount','minutes','guest_count'].includes(k)&&n!=null) return n;
    if(k==='method'||k==='name'||k==='email') return val(v);
    return `${KJ[k]||k}：${n!=null?n:val(v)}`; }).join(' ／ '); }; /* 2026-10-14：内容は短く（オーナー「長い」）。金額・分・人数・日付・入金／出金は値だけ */
const hiDetail=o=>logShort(o,HI_KJ,hiVal);
const HI_DEL=/削除|取消|取り消し|外す/;
PAGES.hist_del=async()=>{ const st=storeId; hiPeriod('hist_del','<select id="hiK" style="width:auto"><option value="all">全部</option></select>','。削除・取消の記録です（POS の操作ログから）'); const f=hiFrom, t=hiTo; let all=[], raw=0;
  const draw=()=>{ const rows=all.filter(x=>hiDelK==='all'||x.action===hiDelK);
    $('hiBox').innerHTML=`<div class="row" style="margin-bottom:8px"><span class="muted" style="font-size:13px">${rows.length}件${raw>=1000?'（1000件まで。期間を短くしてください）':''}</span></div>
    <div class="cs-w"><table class="t cs ks"><thead><tr><th class="nm">日時</th><th style="text-align:left">操作</th><th style="text-align:left">卓</th><th style="text-align:left">理由</th><th style="text-align:left">内容</th></tr></thead><tbody>
    ${rows.map(x=>`<tr><td class="nm">${hiDT(x.created_at)}</td><td style="text-align:left"><b>${esc(actL(x.action))}</b></td><td style="text-align:left">${esc(x.detail?.table||'')}</td><td style="text-align:left;white-space:normal;min-width:120px;max-width:240px">${esc(x.reason||x.detail?.reason||'')}</td><td style="text-align:left;white-space:normal;min-width:220px;max-width:460px">${esc(hiDetail(x.detail))}</td></tr>`).join('')||'<tr><td colspan="5" class="muted" style="text-align:left">記録はありません</td></tr>'}</tbody></table></div>`; };
  $('hiK').onchange=()=>{ hiDelK=$('hiK').value; draw(); };
  const q=()=>sb.from('pos_audit_log').select('id,action,detail,reason,created_at').eq('store_id',st).gte('created_at',f+'T08:00:00+09:00').lt('created_at',dayAdd(t,1)+'T08:00:00+09:00');
  let r=await q().or('action.ilike.*削除*,action.ilike.*取消*,action.ilike.*取り消し*,action.ilike.*外す*').order('created_at',{ascending:false}).limit(1000);
  if(r.error) r=await q().order('created_at',{ascending:false}).limit(1000); // 絞り込みが通らない時は、全部読んでから画面で絞る
  if(page!=='hist_del'||storeId!==st||hiFrom!==f||hiTo!==t) return; if(r.error){ hiErr(r.error); return; }
  all=(r.data||[]).filter(x=>HI_DEL.test(x.action||'')); raw=(r.data||[]).length; const acts=[...new Set(all.map(x=>x.action))].sort(); if(hiDelK!=='all'&&!acts.includes(hiDelK)) hiDelK='all';
  $('hiK').innerHTML=`<option value="all">全部</option>`+acts.map(a=>`<option value="${esc(a)}" ${hiDelK===a?'selected':''}>${esc(actL(a))}</option>`).join(''); draw(); };

