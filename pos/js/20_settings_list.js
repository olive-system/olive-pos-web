// ---------- 設定の一覧と編集（並び替え・追加・絞り込み）。項目の定義 SET は 13_settings.js ----------
function setRows(def){ if(def.single) return [settings]; let r=({tables,categories,products,customers})[def.key]; if(def.key==='products'&&setCatFilter) r=r.filter(p=>p.category_id===setCatFilter); return r; }
async function renderSettings(key, keepSel){ if(key!==setCur){ setSel=null; setEditMode=false; setCatFilter=null; $('setFilter').value=''; } setCur=key; await loadMasters(); { const r=await cuPull(); if(r.data) customers=r.data; } /* v12.30：お客様は変わった分だけ読む */ const def=SET.find(s=>s.key===key);
  $('setMenu').innerHTML=SET.map(s=>`<button class="${s.key===key?'on':''}" data-k="${s.key}">${s.name}</button>`).join('')+(storeSwOther()||!termSwitch?'':'<button class="ghost" id="setStoreAdd">店舗追加</button>')+'<button class="ghost" id="setLogout">ログアウト</button>';
  $('setMenu').querySelectorAll('button[data-k]').forEach(b=>b.onclick=()=>renderSettings(b.dataset.k));
  $('setLogout').onclick=async()=>{ if(!await uiConfirm('ログアウトしますか？')) return; await storeSwDrop(); await sb.auth.signOut(); location.reload(); };
  if($('setStoreAdd')) $('setStoreAdd').onclick=async()=>{ if(!await uiConfirm('店舗を追加しますか？\n初回のみ、その店舗のログインと登録コードが必要です')) return; location.href=slotUrl('s'+Math.random().toString(36).slice(2,7)); }; /* v12.44 */
  $('setList').parentElement.style.gridColumn=(def.audit||def.bills||def.closing||def.chorei)?'2 / 4':''; $('setForm').parentElement.style.display=(def.audit||def.bills||def.closing||def.chorei)?'none':'';
  $('setAdd').style.display=def.single?'none':''; $('setEdit').style.display=(def.single||def.nosort)?'none':''; $('setEdit').textContent=setEditMode?'完了':'編集'; $('setEdit').classList.toggle('on',setEditMode);
  $('setFilter').style.display=def.single?'none':'';
  if (def.local) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setList').innerHTML='';
    $('setForm').innerHTML=`<label>印刷方法<select id="pmSel"><option value="tmpa" ${PRINT.method==='tmpa'?'selected':''}>プリンター（Epson TM Print Assistant）</option><option value="browser" ${PRINT.method==='browser'?'selected':''}>ブラウザ印刷（PDF）</option></select></label><div class="muted hint">プリンター印刷には「Epson TM Print Assistant」アプリが要ります<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">プリンター印刷はタブレットに「Epson TM Print Assistant」アプリを入れ、TM-m30IIIとBluetoothまたはWi-Fiで接続しておく必要があります。設定はこの端末だけに保存されます。</div></div>`;
    $('pmSel').onchange=e=>{ PRINT.method=e.target.value; localStorage.setItem('print_method'+SLOT,PRINT.method); toast('保存しました'); }; return; }
  if (def.chorei) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setForm').innerHTML=''; await renderChorei(); return; }
  if (def.closing) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setForm').innerHTML=''; await renderClosing(); return; }
  if (def.bills) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setForm').innerHTML=''; $('setList').innerHTML='<div class="muted">読み込み中…</div>';
    const today=businessDate(); const BSEL='id,status,table_id,guest_count,opened_at,closed_at,business_date,bill_customers(customer_id),bill_casts(id,staff_id,role,is_kakari),payments(method,amount,received_at,revenue_date)';
    const tb=await todayBills(BSEL,today,false); const error=tb.error;
    if(error){ $('setList').innerHTML=`<div class="muted">${esc(error.message)}</div>`; return; }
    // 置き：未入金の間はどの日の一覧にも載せない。全額の入金を受けた日の伝票として載せる
    const data=tb.all.filter(b=>{ if(b.status!=='closed') return b.business_date===today; if((b.payments||[]).some(p=>p.method==='oki'&&p.amount>0&&!p.received_at)) return false; return billDay(b)===today; });
    const tot={}; await Promise.all((data||[]).map(async b=>{ const r=await sb.rpc('calc_bill',{p_bill:b.id}); tot[b.id]=r.data?.amount_due??null; }));
    const SJ={open:'<span class="badge">来店中</span>',closed:'<span class="badge k">会計済</span>',void:'<span class="badge gray">削除</span>'};
    const grl=data.length?await sb.from('good_reactions').select('bill_id,staff_id').in('bill_id',data.map(b=>b.id)):{data:[]}; const grm={}; (grl.data||[]).forEach(g=>(grm[g.bill_id]=grm[g.bill_id]||[]).push(g.staff_id)); if(!staffAll.length) await loadStaffAll();
    const live=(data||[]).filter(b=>b.status==='closed'); const sum=live.reduce((a,b)=>a+(tot[b.id]||0),0);
    $('setList').innerHTML=`<div class="muted" style="margin-bottom:6px">本日（${businessDate()}）　会計済 ${live.length}件・${yen(sum)}</div>`+((data||[]).map(b=>{ const cn=(b.bill_customers||[]).map(c=>customers.find(x=>x.id===c.customer_id)?.name).filter(Boolean).join('・'); const pm=[...new Set((b.payments||[]).filter(p=>p.amount>0).map(p=>METHOD[p.method]+(p.method==='oki'&&!p.received_at?'(未入金)':'')))].join('・');
      return `<div class="row" data-bill="${b.id}" style="cursor:pointer">${SJ[b.status]||''}<span class="nm">${esc(tables.find(t=>t.id===b.table_id)?.name||'')}　${hm5(b.opened_at)}${b.closed_at?'〜'+hm(b.closed_at):''}　${b.guest_count}名　${esc(cn)} <small class="muted">${esc(pm)}${b.business_date&&b.business_date!==today?`（ご来店日 ${jmd(b.business_date)}）`:''}</small></span>${billPeopleChips(b,grm[b.id]||[],b.status==='closed'&&billDay(b)===today)}<b>${tot[b.id]!=null?yen(tot[b.id]):''}</b></div>`; }).join('')||'<div class="muted">本日の伝票はまだありません</div>');
    $('setList').querySelectorAll('[data-bill]').forEach(r=>r.onclick=()=>{ billFrom='bills'; openBill(r.dataset.bill); });
    $('setList').querySelectorAll('[data-bpe]').forEach(x=>x.onclick=async e=>{ e.stopPropagation(); await billPeopleEdit(x.dataset.bpe); renderSettings('bills'); }); return; }
  if (def.audit) { $('setAdd').style.display='none'; $('setEdit').style.display='none'; $('setFilter').style.display='none'; $('setForm').innerHTML='';
    const ad=auDate||(auDate=businessDate()), an=new Date(ad+'T00:00:00'); an.setDate(an.getDate()+1); const ad2=`${an.getFullYear()}-${String(an.getMonth()+1).padStart(2,'0')}-${String(an.getDate()).padStart(2,'0')}`; // v11.30：営業日（朝8時で区切る）を選んで、その日の分を全部
    const { data, error } = await sbAll(()=>sb.from('pos_audit_log').select('*').eq('store_id',store.id).gte('created_at',ad+'T08:00:00+09:00').lt('created_at',ad2+'T08:00:00+09:00').order('created_at',{ascending:false}).order('id'));
    if(error){ $('setList').innerHTML=`<div class="muted">操作ログを読めません（SQL 010 が未適用の可能性）：${esc(error.message)}</div>`; return; }
    const f=d=>{ const x=new Date(d); return `${x.getMonth()+1}/${x.getDate()} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`; };
    const KJ={amount:'金額',minutes:'分',is_auto:'自動延長',before:'変更前',after:'変更後',item:'商品',qty:'数量',total:'請求額',guest_count:'客数',items:'注文',name:'名前',fields:'内容',customer:'お客様',bottle:'ボトル',kind:'種別',reason:'理由',total_before:'切替前の請求額',method:'支払方法',payments:'支払',kakari:''+KL+'',tag_no:'タグ番号',by:'操作者',date:'営業日',memo:'摘要'}; // v11.08：管理サイトの現金管理から入れた操作は「操作者：管理サイト：名前」
    const vj=v=>v===true?'はい':v===false?'いいえ':Array.isArray(v)?v.join('、'):(typeof v==='number'?v.toLocaleString():v);
    const dt=o=>logShort(o,KJ,vj);
    $('setList').innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><input type="date" id="auD" value="${ad}" style="width:auto"><small class="muted">${(data||[]).length}件</small></div>`+((data||[]).map(l=>`<div class="item" style="display:block"><b>${esc(actL(l.action))}</b> <small>${f(l.created_at)}　${esc(l.detail?.table||'')}</small><br><small>${esc(dt(l.detail))}</small>${l.reason?`<br><small>理由：${esc(l.reason)}</small>`:''}</div>`).join('')||'<div class="muted">この日の記録はありません</div>');
    $('auD').onchange=()=>{ if($('auD').value){ auDate=$('auD').value; renderSettings('audit'); } }; return; }
  if (def.single) { $('setList').innerHTML=''; setSel=settings; renderForm(def); return; }
  const rows=setRows(def);
  if(setSel) setSel=rows.find(r=>r.id===setSel.id)||null; // 保存後は読み直した最新の行を表示する（古い値が残らないように）
  let head='';
  if (key==='products') head=`<select id="setCat" style="margin-bottom:6px"><option value="">--- すべて ---</option>${categories.map(c=>`<option value="${c.id}" ${setCatFilter===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`;
  const _st=$('setList').dataset.key===key?$('setList').scrollTop:0; $('setList').dataset.key=key;
  $('setList').innerHTML=head+rows.map(r=>`<div class="row ${setSel?.id===r.id?'on':''}" data-id="${r.id}">${setEditMode?`<button class="xb" data-del="${r.id}" aria-label="削除">×</button>`:''}<span class="nm">${esc(def.label(r))}${def.sub?` <small class="muted">${def.sub(r)}</small>`:''}${r.is_visible===false?' <small class="muted">（非表示）</small>':''}</span>${setEditMode&&!def.nosort?'<span class="hd">≡</span>':''}</div>`).join('');
  if (key==='products') $('setCat').onchange=e=>{ setCatFilter=e.target.value||null; renderSettings(key,true); };
  $('setList').querySelectorAll('.row').forEach(row=>{ row.onclick=e=>{ if(e.target.dataset.del||e.target.classList.contains('hd'))return; setSel=rows.find(r=>r.id===row.dataset.id); renderSettings(key,true); }; });
  $('setList').querySelectorAll('[data-del]').forEach(b=>b.onclick=async e=>{ e.stopPropagation(); const r=rows.find(x=>x.id===b.dataset.del); if(!await uiConfirm(`「${def.label(r)}」を削除しますか？`))return;
    const { data:dd, error } = await sb.from(def.table).delete().eq('id',b.dataset.del).select('id'); if(error){ toast(error.code==='23503'?'使用中のため削除できません。非表示にしてください':error.message); return; } if(!(dd||[]).length){ if(!await posTermLost()) toast('削除に失敗しました。再度お試しください'); return; } /* 点検 2026-11-02：使用中（外部キー）の時だけ「使用中」。0行（端末の登録が外れた等）を削除したことにしない */ await logOp('設定の削除',{kind:def.name,name:def.label(r)},null,true); setSel=null; renderSettings(key,true); });
  $('setList').scrollTop=_st; { const q=$('setFilter').value.trim(); if(q) $('setList').querySelectorAll('.row').forEach(r=>{ r.style.display=r.textContent.includes(q)?'':'none'; }); const on=$('setList').querySelector('.row.on'); if(on){ const a=on.getBoundingClientRect(), l=$('setList').getBoundingClientRect(); if(a.top<l.top+40||a.bottom>l.bottom) on.scrollIntoView({block:'center'}); } }
  if (setEditMode && !def.nosort) enableDrag(def);
  renderForm(def);
}
function renderForm(def){ const r=setSel; const f=$('setForm');
  if(!r){ f.innerHTML='<div class="muted">左の一覧から選ぶか「追加」</div>'; return; }
  if(def.ro){ renderFormRo(def,r); return; }
  f.innerHTML=def.cols.map(([k,label,type])=>{
    if(type==='bool') return `<label class="sw"><input type="checkbox" data-k="${k}" ${r[k]?'checked':''}>${label}</label>`;
    if(type==='prod') return `<label>${label}<select data-k="${k}"><option value="">なし</option>${products.filter(p=>p.agg_category==='HC').map(p=>`<option value="${p.id}" ${r[k]===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`;
    if(type==='cat') return `<label>${label}<select data-k="${k}">${categories.map(c=>`<option value="${c.id}" ${r[k]===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`;
    return `<label>${label}<input type="${type}" data-k="${k}" value="${esc(r[k]??'')}"></label>`; }).join('')+(def.key==='pos'?`<h3 style="margin:16px 0 4px">VIP料金（卓ごと。0＝通常卓）</h3><div class="muted" style="font-size:12px">VIP代＝部屋につき1回／VIP延長＝延長${settings.ext_minutes}分ごとに加算。人数は掛けません</div><table style="width:100%;margin-top:6px"><tr><th style="text-align:left">卓</th><th>VIP代</th><th>VIP${settings.ext_minutes}分延長</th></tr>${tables.map(t=>`<tr><td>${esc(t.name)}</td><td><input type="number" data-vipset="${t.id}" value="${t.vip_set_fee||0}"></td><td><input type="number" data-vipext="${t.id}" value="${t.vip_ext_fee||0}"></td></tr>`).join('')}</table>`:'')+`<div class="bar"><button class="primary" id="setSave">保存</button></div>`;
  $('setSave').onclick=async()=>{ const o={}; def.cols.forEach(([k,,type])=>{ const el=f.querySelector(`[data-k="${k}"]`); o[k]=type==='bool'?el.checked:type==='number'?Number(el.value||0):(type==='prod'?(el.value||null):el.value); });
    const q = def.single ? sb.rpc('pos_settings_save',{p_store:settings.store_id,p:o}) : sb.rpc('pos_row_update',{p_table:def.table,p_id:r.id,p:o});
    let { error } = await q;
    if(!error){ const ch=def.cols.filter(([k])=>String(r[k]??'')!==String(o[k]??'')).map(([k,label])=>`${label.split('（')[0].split('：')[0]}:${r[k]??''}→${o[k]??''}`); if(ch.length) await logOp('設定変更',{kind:def.name,name:def.single?null:def.label(r),fields:ch},null,true); }
    if(!error&&def.key==='pos'){ for(const t of tables){ const a=Number(f.querySelector(`[data-vipset="${t.id}"]`)?.value||0), b=Number(f.querySelector(`[data-vipext="${t.id}"]`)?.value||0); if(a!==(t.vip_set_fee||0)||b!==(t.vip_ext_fee||0)){ const r=await sb.rpc('pos_row_update',{p_table:'tables',p_id:t.id,p:{vip_set_fee:a,vip_ext_fee:b}}); if(r.error){ error=r.error; break; } await logOp('設定変更',{kind:'VIP料金',name:t.name,fields:[`VIP代:${t.vip_set_fee||0}→${a}`,`VIP延長:${t.vip_ext_fee||0}→${b}`]},null,true); } } }
    toast(error?error.message:'保存しました'); if(!error) renderSettings(def.key,true); };
}
// v11.13：料金設定は見るだけ（変えるのは管理サイト：料金は「POS設定」、日払の上限・源泉・ポイント・同伴の準備時間は「報酬・罰金項目」）
function renderFormRo(def,r){ const f=$('setForm'); const val=(k,type)=>type==='bool'?(r[k]?'する':'しない'):type==='amt'?(r[k]>0?yen(r[k]):'付けない'):(r[k]??'');
  f.innerHTML=`<div class="muted hint" style="margin-bottom:10px">ここでは閲覧のみです<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">料金は管理サイト「POS設定」、日払（立替）の上限・体験の源泉・ポイント・同伴の準備時間は「報酬・罰金項目」で設定します</div></div>`+def.cols.map(([k,label,type])=>`<label>${label}<input value="${esc(String(val(k,type)))}" disabled></label>`).join('')+
    `<h3 style="margin:16px 0 4px">VIP料金（卓ごと。0＝通常卓）</h3><table style="width:100%;margin-top:6px"><tr><th style="text-align:left">卓</th><th>VIP代</th><th>VIP${settings.ext_minutes}分延長</th></tr>${tables.map(t=>`<tr><td>${esc(t.name)}</td><td><input value="${t.vip_set_fee||0}" disabled></td><td><input value="${t.vip_ext_fee||0}" disabled></td></tr>`).join('')}</table>`; }
$('setAdd').onclick=async()=>{ const def=SET.find(s=>s.key===setCur); const rows=setRows(def); const row=def.newRow(); if(!def.nosort) row.sort_order=(Math.max(0,...rows.map(r=>r.sort_order||0))+1); if(def.key==='products'&&setCatFilter) row.category_id=setCatFilter;
  const { data, error } = await sb.from(def.table).insert(row).select().single(); if(error){toast(error.message);return;} await logOp('設定の追加',{kind:def.name,name:def.label(data)},null,true); setSel=data; renderSettings(setCur,true); };
$('setEdit').onclick=()=>{ setEditMode=!setEditMode; renderSettings(setCur,true); };
$('setFilter').oninput=e=>{ const q=e.target.value.trim(); $('setList').querySelectorAll('.row').forEach(r=>{ r.style.display=!q||r.textContent.includes(q)?'':'none'; }); };
// 長押しドラッグ並び替え
function enableDrag(def){ dragSort($('setList'),'.row',async ids=>{ const rs=await Promise.all(ids.map((id,i)=>sb.from(def.table).update({sort_order:(i+1)*10}).eq('id',id))); const er=rs.find(r=>r.error); toast(er?('並び順を保存できませんでした：'+er.error.message):'並び順を保存しました'); renderSettings(def.key,true); }); }
// 行を動かすと指の追跡が切れるため、動き・離すは画面全体で受ける
// v12.04：上下の端まで持っていくと、リストが自分で動く（オーナー 2026-10-22「並び変えできない」。在籍リストは画面に入りきらない）
function dragSort(list,sel,onDone){
  const scroller=()=>{ for(let e=list;e&&e!==document.body;e=e.parentElement){ const cs=getComputedStyle(e); if(/(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight) return e; } return document.scrollingElement||document.documentElement; };
  list.querySelectorAll(sel).forEach(row=>{ const h=row.querySelector('.hd'); if(!h)return;
    h.onpointerdown=e=>{ e.preventDefault(); let dragging=null, moved=false, lastX=e.clientX, lastY=e.clientY, raf=0; const sc=scroller();
      const timer=setTimeout(()=>{ dragging=row; row.classList.add('drag'); raf=requestAnimationFrame(auto); },150);
      const place=(x,y)=>{ const el=document.elementsFromPoint(x,y).map(z=>z.closest(sel)).find(z=>z&&z.parentElement===list); /* 上に重なっている物があっても下の行を見る */ if(!el||el===dragging||el.parentElement!==list)return; const r=el.getBoundingClientRect(); const before=y<r.top+r.height/2; const ref=before?el:el.nextSibling; if(ref===dragging||ref===dragging.nextSibling)return; list.insertBefore(dragging,ref); moved=true; };
      const auto=()=>{ if(!dragging)return; const box=sc===document.scrollingElement||sc===document.documentElement?{top:0,bottom:window.innerHeight}:sc.getBoundingClientRect(); const edge=70;
        let v=0; if(lastY<box.top+edge) v=-Math.ceil((box.top+edge-lastY)/4); else if(lastY>box.bottom-edge) v=Math.ceil((lastY-(box.bottom-edge))/4);
        if(v){ sc.scrollTop+=v; place(lastX,Math.min(Math.max(lastY,box.top+12),box.bottom-12)); } /* 指がリストの外に出ても、内側の一番近い行で入れ替える */ raf=requestAnimationFrame(auto); };
      const move=ev=>{ if(!dragging)return; ev.preventDefault(); lastX=ev.clientX; lastY=ev.clientY; place(lastX,lastY); };
      const end=async()=>{ clearTimeout(timer); cancelAnimationFrame(raf); window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',end); window.removeEventListener('pointercancel',end); if(!dragging)return; dragging.classList.remove('drag'); dragging=null; if(moved) await onDone([...list.querySelectorAll(sel)].map(r=>r.dataset.id)); };
      window.addEventListener('pointermove',move,{passive:false}); window.addEventListener('pointerup',end); window.addEventListener('pointercancel',end); }; }); }
