// ---------- スタッフ設定・黒服 v0.24・SQL 064：報酬形態（月給・時給・日給）と金額・源泉徴収・消費税・厚生費は cast_terms に月ごと（○月以降／○月のみ）。日払い・契約書は staff ----------
const CS_HPAY={monthly:'月給',hourly:'時給',daily:'日給'};
function csHallTerms(s,rows,m){ const t=rows.filter(r=>r.staff_id===s.id&&r.month<=m&&(r.month===m||!r.only_month)).sort((a,b)=>a.month<b.month?1:-1)[0];
  const pt=t?.pay_type||(CS_HPAY[s.pay_type]?s.pay_type:null);
  const amt=!pt?null:t?.pay_type?(pt==='monthly'?t.monthly_wage:pt==='hourly'?t.hourly_wage:t.daily_wage):(pt==='daily'?s.daily_wage:null);
  return {month:t?.month??null,only_month:!!t?.only_month,pay_type:pt,amount:amt==null?null:Number(amt),withhold:t?.withhold??null,ctax_pct:t?.ctax_pct==null?null:Number(t.ctax_pct),welfare_mode:t?.welfare_mode||'std',welfare_amount:t?.welfare_mode==='amount'?(t.welfare_amount??null):null}; }
async function csHallPart(box,st,ed,m){
  const [sf,tm]=await Promise.all([csList(st), sbAll(()=>sb.from('cast_terms').select('*').eq('store_id',st).lte('month',m).order('id'))]);
  if(page!=='set_cast'||storeId!==st||csMonth!==m||!box.isConnected) return;
  const er=sf.error||tm.error;
  if(er){ box.innerHTML=`<h2 style="margin:0 0 8px">黒服</h2><div class="card err">読み込めません：${esc(er.message)}</div>`; return; }
  if(!me?.is_owner&&me?.staff_id!==undefined) ed=false; /* v0.68・SQL 087：黒服の条件を変えられるのはオーナーだけ。オーナー以外は自分の行だけ見る */
  const halls=(sf.data||[]).filter(x=>x.kind==='hall'&&(me?.is_owner||me?.staff_id===undefined||x.id===me.staff_id)), tr0=tm.data||[];
  const sql064=!tr0.length||'monthly_wage' in tr0[0];
  const rows=halls.map(s=>({s,t:csHallTerms(s,tr0,m)}));
  const E=csEdit==='hall', lock=!!csEdit&&!E;
  const sel=(k,v,os)=>`<select data-k="${k}">${os.map(([ov,on])=>`<option value="${esc(ov)}" ${String(v??'')===String(ov)?'selected':''}>${esc(on)}</option>`).join('')}</select>`;
  const inp=(k,v,w,dis)=>`<input data-k="${k}" inputmode="decimal" value="${esc(v??'')}" style="width:${w}px" ${dis?'disabled':''}>`;
  const own=!!me?.is_owner, hm5=v=>v?String(v).slice(0,5):''; // v0.34・SQL 074：出勤・退勤の時刻（遅刻・早退の計算に使う。変えられるのはオーナーだけ）
  const cell=({s,t})=>{ const wf=t.welfare_mode==='amount'?yen(t.welfare_amount):t.welfare_mode==='none'?'なし':'標準';
    const sh=E&&own?`<span class="row" style="gap:4px;flex-wrap:nowrap"><input type="time" data-k="ss" value="${hm5(s.shift_start)}" style="width:120px">〜<input type="time" data-k="se" value="${hm5(s.shift_end)}" style="width:120px"></span>`:(s.shift_start||s.shift_end?`${hm5(s.shift_start)||'—'}〜${hm5(s.shift_end)||'—'}`:'<span class="badge warnb">未設定</span>');
    if(!E) return [t.pay_type?CS_HPAY[t.pay_type]:'<span class="badge warnb">未設定</span>', t.amount!=null?yen(t.amount):'—', sh, s.day_pay_ok==null?'—':s.day_pay_ok?'可':'不可',
      s.contract_done==null?'—':s.contract_done?'<span class="badge k">済</span>':'<span class="badge warnb">未</span>', t.withhold==null?'—':t.withhold?'する':'しない', t.ctax_pct==null?'—':t.ctax_pct+'%', wf, s.task_limited_ok?'可':'不可'];
    return [sel('pt',t.pay_type||'',[['','未設定'],...Object.entries(CS_HPAY)]), inp('am',t.amount,100,!t.pay_type)+' 円', sh,
      sel('dp',s.day_pay_ok==null?'':String(s.day_pay_ok),[['','—'],['true','可'],['false','不可']]), sel('ct2',s.contract_done==null?'':String(s.contract_done),[['','—'],['true','済'],['false','未']]),
      sel('wh',t.withhold==null?'':String(t.withhold),[['','—'],['true','する'],['false','しない']]), inp('ct',t.ctax_pct??'',50)+' %',
      sel('wm',t.welfare_mode,[['std','標準'],['amount','金額'],['none','なし']])+' '+inp('wa',t.welfare_amount,80,t.welfare_mode!=='amount'), sel('tl',String(!!s.task_limited_ok),[['true','可'],['false','不可']])]; };
  const HD=['報酬','金額','出勤〜退勤'+(E&&!own?'<br><small class="muted">オーナーだけ</small>':''),'日払（立替）','契約書','源泉徴収','消費税','厚生費','限定項目']; /* v1.50・SQL 209：限定の項目をしてよいか（新しく入った人は不可）。v1.56・SQL 227：顧客サイトの編集も同じ可・不可で決める（オーナー 2026-10-24「限定項目だけと言う表示にして、ここで権限をつける」） */
  box.innerHTML=`<div class="row" style="margin-bottom:8px;align-items:center"><h2 style="margin:0">黒服</h2><span style="flex:1"></span>${ed?(E?'<button class="ghost" id="chCancel">キャンセル</button><button class="primary" id="chSave">保存</button>':`<button class="ghost" id="chAdd" ${lock?'disabled':''}>＋追加</button><button class="ghost" id="chEd" ${lock?'disabled':''}>編集</button>`):''}</div>
  ${sql064?'':'<div class="card err">SQL 064 が未実行です（黒服の月給・時給を保存できません）</div>'}
  ${rows.length?`<div class="cs-w ${E?'editing':''}"><table class="reg cs"><tr><th class="nm">名前</th>${HD.map(h=>`<th>${h}</th>`).join('')}</tr>
  ${rows.map(r=>`<tr data-sid="${r.s.id}"><td class="nm">${ed&&!E?`<a data-hed="${r.s.id}">${esc(r.s.display_name)}</a>`:esc(r.s.display_name)}${r.t.month===m&&r.t.only_month?`<br><small class="muted">${csMShort(m)}のみ</small>`:''}</td>${cell(r).map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`
  :'<div class="card muted">在籍の黒服がいません</div>'}
  <div class="muted" style="font-size:13px;margin-top:10px;line-height:1.6">${E?'報酬・金額・源泉徴収・消費税・厚生費を変更すると、保存の時に「○月以降／○月のみ」を選びます':'金額は、月給なら1か月、時給なら1時間、日給なら1日の金額です'}${ed&&!E?'。修正は「編集」から':''}<br>限定項目：可の黒服のみ、開店・閉店作業の限定の項目と、LINEマイページの顧客サイトの編集が可能です</div>
`;
  if(!ed) return;
  if(!E){ $('chEd').onclick=()=>{ csEdit='hall'; PAGES.set_cast(); }; $('chAdd').onclick=()=>staffEdit(st,null,'hall'); box.querySelectorAll('[data-hed]').forEach(a=>a.onclick=()=>staffEdit(st,halls.find(h=>h.id===a.dataset.hed),'hall')); return; }
  $('chCancel').onclick=()=>{ csEdit=false; PAGES.set_cast(); };
  const tb=box.querySelector('table.cs');
  tb.querySelectorAll('tr[data-sid]').forEach(tr=>{ const q=k=>tr.querySelector(`[data-k=${k}]`);
    q('pt').onchange=()=>{ q('am').disabled=!q('pt').value; if(q('am').disabled) q('am').value=''; };
    q('wm').onchange=()=>{ q('wa').disabled=q('wm').value!=='amount'; if(q('wa').disabled) q('wa').value=''; }; });
  const sv=$('chSave'); sv.onclick=guard(sv,async()=>{
    const out=[], shifts=[]; let needP=false;
    for(const {s,t} of rows){ const tr=tb.querySelector(`tr[data-sid="${s.id}"]`), q=k=>tr.querySelector(`[data-k=${k}]`), nm=s.display_name;
      const num=(k,l,max)=>{ const v=slNum(q(k).value); if(v==null) return null; if(!Number.isFinite(v)||v<0||(max!=null&&v>max)) throw `${nm}：${l}が正しくありません`; return v; };
      const b=v=>v===''?null:v==='true';
      let so, to;
      try{ const pt=q('pt').value||null, am=pt?num('am','金額'):null, wm=q('wm').value, wa=wm==='amount'?num('wa','厚生費'):null;
        if(pt&&!am) throw `${nm}：${CS_HPAY[pt]}の金額を入力してください`;
        if(wm==='amount'&&wa==null) throw `${nm}：厚生費の金額を入力してください`;
        so={day_pay_ok:b(q('dp').value),contract_done:b(q('ct2').value),task_limited_ok:q('tl').value==='true'};
        to={pay_type:pt,amount:am==null?null:Math.round(am),withhold:b(q('wh').value),ctax_pct:num('ct','消費税',100),welfare_mode:wm,welfare_amount:wa==null?null:Math.round(wa)};
      }catch(e){ if(typeof e==='string'){ await uiAlert(e); return; } throw e; }
      const so0={day_pay_ok:s.day_pay_ok??null,contract_done:s.contract_done??null,task_limited_ok:!!s.task_limited_ok};
      const to0={pay_type:t.pay_type,amount:t.amount,withhold:t.withhold,ctax_pct:t.ctax_pct,welfare_mode:t.welfare_mode,welfare_amount:t.welfare_mode==='amount'?(t.welfare_amount==null?null:Number(t.welfare_amount)):null};
      const r={staff_id:s.id}; if(JSON.stringify(so)!==JSON.stringify(so0)) r.staff=so; if(JSON.stringify(to)!==JSON.stringify(to0)){ r.terms=to; needP=true; }
      if(r.staff||r.terms) out.push(r);
      if(own&&q('ss')){ const ss=q('ss').value||null, se=q('se').value||null; if(ss!==(hm5(s.shift_start)||null)||se!==(hm5(s.shift_end)||null)) shifts.push({staff_id:s.id,shift_start:ss,shift_end:se}); } }
    if(!out.length&&!shifts.length){ csEdit=false; toast('変更はありません'); PAGES.set_cast(); return; }
    let only=false;
    if(needP){ const ans=await new Promise(res=>{ const md=modal(`<h2 style="margin:0">いつから変更しますか？</h2><div style="display:flex;flex-direction:column;gap:8px">
        <button class="ghost" data-v="after">${csMShort(m)}以降</button><button class="ghost" data-v="only">${csMShort(m)}のみ</button><button class="ghost" data-v="" style="border:none;color:var(--muted)">キャンセル</button></div>`);
        md.querySelectorAll('button').forEach(b=>b.onclick=()=>{ md.remove(); res(b.dataset.v); }); });
      if(!ans) return; only=ans==='only'; }
    // v0.63：「いつから」を聞いた後に保存する（前は出勤〜退勤だけ先に保存されて、やめても残った）
    if(shifts.length){ const r0=await rpc('admin_save_hall_shift',{p_store:st,p_rows:shifts}); if(!r0.ok) return; }
    if(out.length){ const r=await rpc('admin_save_hall_settings',{p_store:st,p_month:m,p_only:only,p_rows:out}); if(!r.ok){ if(shifts.length) await uiAlert('出勤〜退勤は保存しました。報酬などは保存できていません'); return; } }
    csEdit=false; toast('保存しました'); PAGES.set_cast(); });
}

// 名前を押した時：その人だけの条件・メモ
async function csDetailPage(){ const st=storeId, s=csDetail.s, ed=perm('set_cast')==='edit';
  const head=`<div class="row" style="margin-bottom:12px"><button class="ghost" id="csBack">← 一覧に戻る</button><h1 style="margin:0">${esc(s.display_name)}</h1><span style="flex:1"></span>${ed?'<button class="ghost" id="csBase">基本情報の変更</button>':''}</div>
   <div class="cs-tabs"><button data-t="memo" class="${csTab==='memo'?'on':''}">メモ</button><button data-t="sp" class="${csTab==='sp'?'on':''}">個別設定</button><button data-t="ord" class="${csTab==='ord'?'on':''}">注文集計</button></div>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const wire=()=>{ $('csBack').onclick=()=>{ csDetail=null; PAGES.set_cast(); }; if($('csBase')) $('csBase').onclick=()=>staffEdit(st,s,'cast'); $('main').querySelectorAll('.cs-tabs button').forEach(b=>b.onclick=()=>{ csTab=b.dataset.t; csDetailPage(); }); };
  wire();
  const t=csTab;
  if(t==='sp'){
    const r=await sb.from('cast_specials').select('*').eq('staff_id',s.id).eq('is_void',false).order('from_month',{ascending:false}).order('created_at',{ascending:false});
    if(page!=='set_cast'||storeId!==st||csDetail?.s!==s||csTab!==t) return;
    if(r.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(r.error.message)}</div>`; wire(); return; }
    const cur=csNowMonth(), mo=[]; for(let i=-12;i<=12;i++) mo.push(csAddMonth(cur,i));
    const per=x=>`${csMLabel(x.from_month)}${x.to_month?(x.to_month===x.from_month?'のみ':'〜'+csMLabel(x.to_month)):'以降'}`;
    $('main').innerHTML=head+`<div class="card">${(r.data||[]).map(x=>`<div class="cs-li"><span class="badge gray">${CS_SP[x.kind]}</span><span style="flex:1;min-width:0">${esc(x.title)}${x.amount!=null?`　<b>${x.kind==='wage'?'1時間あたり ':''}${yen(x.amount)}</b>`:''}<br><small class="muted">${per(x)}</small></span>${ed?`<button class="ghost sm" data-del="${x.id}" aria-label="削除">✕</button>`:''}</div>`).join('')||'<div class="muted">まだありません</div>'}</div>
    ${ed?`<div class="card"><h2>追加</h2>
      <div class="row"><select id="spK" style="width:auto"><option value="pay">支給</option><option value="deduct">控除</option></select><select id="spW" style="width:auto"><option value="">月額</option><option value="wage">時給加算</option></select><input id="spT" maxlength="50" placeholder="内容（50字まで）" style="flex:1;min-width:200px"><input id="spA" inputmode="numeric" placeholder="金額" style="width:120px;text-align:right">
      <select id="spF" style="width:auto">${mo.map(x=>`<option value="${x}" ${x===cur?'selected':''}>${csMLabel(x)}以降</option>`).join('')}</select>
      <select id="spTo" style="width:auto"><option value="">無期限</option>${mo.map(x=>`<option value="${x}">${csMLabel(x)}まで</option>`).join('')}</select><button class="primary" id="spAdd">追加</button></div>
      <div class="muted hint" style="font-size:13px;margin-top:8px">支給・控除は、その期間の毎月の報酬に加算／減算する金額です。支給の「時給加算」は、1時間あたりの金額をスライド表の時給に加算します<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">「時給加算」は時給の人だけです（日給の人には付きません）。スライド表の金額に加算してから保証時給と比べるので、保証時給の方が高い間は決定時給は変わりません。時給で決まる罰金（％の罰金・同伴ノルマ）も、加算後の決定時給で計算します<br>罰金の免除は一覧の「罰金の免除」で決めます</div></div></div>`:''}`;
    wire(); if(!ed) return;
    $('main').querySelectorAll('[data-del]').forEach(b=>b.onclick=guard(b,async()=>{ if(!await uiConfirm('この条件を削除しますか？','削除','danger')) return; const x=await rpc('admin_void_cast_special',{p_id:b.dataset.del}); if(!x.ok) return; toast('削除しました'); csDetailPage(); }));
    const spSync=()=>{ const pay=$('spK').value==='pay'; $('spW').classList.toggle('hide',!pay); if(!pay) $('spW').value=''; $('spA').placeholder=$('spW').value==='wage'?'1時間あたり':'金額'; }; $('spK').onchange=spSync; $('spW').onchange=spSync; spSync();
    const ad=$('spAdd'); ad.onclick=guard(ad,async()=>{ const kind=$('spK').value==='pay'&&$('spW').value==='wage'?'wage':$('spK').value, title=$('spT').value.trim(), a=slNum($('spA').value), f=$('spF').value, to=$('spTo').value||null;
      if(!title){ await uiAlert('内容を入力してください'); return; }
      if(kind!=='text'&&(a==null||!Number.isInteger(a)||a<=0)){ await uiAlert('金額を1以上の整数で入力してください'); return; }
      if(to&&to<f){ await uiAlert('期間が逆になっています'); return; }
      rtOwn=Date.now(); const x=await sb.rpc('admin_add_cast_special',{p_store:st,p_staff:s.id,p_kind:kind,p_title:title,p_amount:kind==='text'?null:a,p_from:f,p_to:to}); rtOwn=Date.now();
      if(x.error){ await uiAlert(kind==='wage'&&/種類が違います|cast_specials_kind_check/.test(x.error.message)?'SQL 079 が未実行です（「時給加算」はまだ使えません）':x.error.message); return; } toast('追加しました'); csDetailPage(); });
    return; }
  if(t==='ord'){ // v0.33・SQL 073：注文集計（その月、この人にバックが付いた注文を商品ごとに。取消は除く）
    const now=csNowMonth(); if(!csOrdM) csOrdM=now; const om=csOrdM, mOpts=Array.from({length:13},(_,i)=>csAddMonth(now,-i));
    $('main').innerHTML=head+`<div class="card"><select id="coM" style="width:auto">${mOpts.map(x=>`<option value="${x}" ${x===om?'selected':''}>${csMLabel(x)}</option>`).join('')}</select><div id="coBox" class="muted" style="margin-top:10px">読み込み中…</div></div>`; wire();
    $('coM').onchange=()=>{ csOrdM=$('coM').value; csDetailPage(); };
    const r=await sb.rpc('admin_cast_orders',{p_staff:s.id,p_month:om}); if(page!=='set_cast'||csDetail?.s!==s||csTab!==t||csOrdM!==om) return;
    if(r.error){ $('coBox').innerHTML=`<span class="err">${esc(/admin_cast_orders/.test(r.error.message)?'SQL 073 が未実行です：':'読み込めません：')}${esc(r.error.message)}</span>`; return; }
    const L=r.data||[]; $('coBox').className=''; $('coBox').innerHTML=L.length?`<table class="t"><tr><th>商品</th><th style="text-align:right">数</th><th style="text-align:right">注文額</th></tr>${L.map(x=>`<tr><td>${esc(x.name)}</td><td style="text-align:right">${Number(x.qty)}</td><td style="text-align:right">${yen(x.amount)}</td></tr>`).join('')}<tr class="kst"><td>合計</td><td style="text-align:right">${L.reduce((a,x)=>a+Number(x.qty),0)}</td><td style="text-align:right">${yen(L.reduce((a,x)=>a+Number(x.amount),0))}</td></tr></table><div class="muted" style="font-size:13px;margin-top:6px">この人にバックが付いた注文（会計済）。何人かで分けた注文も、それぞれの人に全部の数が入ります</div>`:'<div class="muted">この月の注文はありません</div>';
    return; }
  const [nr,cr]=await Promise.all([sb.from('cast_notes').select('*').eq('staff_id',s.id).eq('is_void',false).order('created_at',{ascending:false}), sb.from('cast_note_cats').select('names').eq('store_id',st).maybeSingle()]);
  if(page!=='set_cast'||storeId!==st||csDetail?.s!==s||csTab!==t) return;
  if(nr.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(nr.error.message)}</div>`; wire(); return; }
  const cats=cr.data?.names?.length?cr.data.names:CS_CATS;
  const dt=x=>{ const d=new Date(x); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`; };
  $('main').innerHTML=head+`${ed?`<div class="card"><div class="row"><select id="nC" style="width:auto">${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><input id="nB" maxlength="50" placeholder="1行・50字まで" style="flex:1;min-width:200px"><button class="primary" id="nAdd">追加</button></div>
    <div style="margin-top:8px;text-align:right"><button class="ghost sm" id="nCats">分類の変更</button></div></div>`:''}
    <div class="card">${(nr.data||[]).map(x=>`<div class="cs-li"><small class="muted" style="white-space:nowrap">${dt(x.created_at)} ${esc(x.author_name||'')}</small><span class="badge gray">${esc(x.category)}</span><span style="flex:1;min-width:0">${esc(x.body)}</span>${ed?`<button class="ghost sm" data-del="${x.id}" aria-label="削除">✕</button>`:''}</div>`).join('')||'<div class="muted">まだありません</div>'}</div>
    <div class="muted" style="font-size:13px">メモは管理サイトだけで見られます（POS・タイムカードには出ません）</div>`;
  wire(); if(!ed) return;
  const ad=$('nAdd'); ad.onclick=guard(ad,async()=>{ const b=$('nB').value.trim(); if(!b){ await uiAlert('メモを入力してください'); return; }
    const x=await rpc('admin_add_cast_note',{p_store:st,p_staff:s.id,p_cat:$('nC').value,p_body:b}); if(!x.ok) return; toast('追加しました'); csDetailPage(); });
  $('main').querySelectorAll('[data-del]').forEach(b=>b.onclick=guard(b,async()=>{ if(!await uiConfirm('このメモを削除しますか？','削除','danger')) return; const x=await rpc('admin_void_cast_note',{p_id:b.dataset.del}); if(!x.ok) return; toast('削除しました'); csDetailPage(); }));
  $('nCats').onclick=()=>{ const md=modal(`<h2 style="margin:0">メモの分類</h2><div class="muted" style="font-size:14px">1行に1つ（10字まで）。今までのメモの分類は変わりません</div><textarea id="nCT" rows="8" style="font:inherit;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px">${esc(cats.join('\n'))}</textarea>
      <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
    md.querySelector('[data-k=no]').onclick=()=>md.remove();
    const ok=md.querySelector('[data-k=ok]'); ok.onclick=guard(ok,async()=>{ const ns=md.querySelector('#nCT').value.split('\n').map(x=>x.trim()).filter(Boolean); if(!ns.length){ await uiAlert('分類を1つ以上入力してください'); return; }
      const x=await rpc('admin_save_note_cats',{p_store:st,p_names:ns}); if(!x.ok) return; md.remove(); toast('保存しました'); csDetailPage(); }); };
}

