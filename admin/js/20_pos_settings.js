// ---------- POS設定 料金（メニュー以外）はここだけで変える。POS では見るだけ ----------
// HC・BC は伝票を立ち上げた時に人数分つける。金額だけ選ぶ（伝票の名前は HC／BC）。HC は係にバック100%（振分できる）、BC は誰にもバックなし
const HCBC_OPTS=[[null,'付けない'],...Array.from({length:10},(_,i)=>[(i+1)*1000,((i+1)*1000).toLocaleString('ja-JP')+'円'])];
const vipRow=(t,ed,dis)=>`<tr data-tb="${t.id}"><td>${esc(t.name)}</td><td><input inputmode="numeric" data-v="set" value="${esc(String(t.vip_set_fee||0))}" ${dis}></td><td><input inputmode="numeric" data-v="ext" value="${esc(String(t.vip_ext_fee||0))}" ${dis}></td>${ed?'<td style="width:1%"><button class="xb" data-vrm aria-label="外す">×</button></td>':''}</tr>`;
PAGES.set_pos=async()=>{ const st=storeId, ed=perm('set_pos')==='edit', dis=ed?'':'disabled';
  const keep=$('siBox')?.dataset.st===st?$('siBox'):null; // 料金だけ保存した時は、店の情報の入力中の内容を消さない
  $('main').innerHTML=`<h1>POS設定 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="card muted">読み込み中…</div>`;
  const [ps,tb]=await Promise.all([ sb.from('pos_settings').select('*').eq('store_id',st).maybeSingle(), sb.from('tables').select('id,name,vip_set_fee,vip_ext_fee,sort_order').eq('store_id',st).order('sort_order').order('id') ]);
  const tgtR=me?.is_owner?await sb.rpc('admin_sales_target',{p_store:st}):null, tgt=tgtR?.data??null, tgtErr=!!tgtR?.error; /* 読めない時に空欄のまま保存すると目標が消えるので、その時は押せなくする */ /* 売上目標（朝礼・日報メールの売上予測。オーナーのみ） */
  if(page!=='set_pos'||storeId!==st) return;
  const er=ps.error||tb.error; if(er){ $('main').innerHTML=`<h1>POS設定</h1><div class="card err">読み込めません：${esc(er.message)}</div>`; return; }
  const d=ps.data||{}; if(!('auto_hc_amount' in d)){ $('main').innerHTML=`<h1>POS設定</h1><div class="card err">SQL 062 が未実行です</div>`; return; }
  const num=(id,label,v)=>`<label>${label}<input id="${id}" inputmode="decimal" value="${esc(v??'')}" ${dis}></label>`;
  const amt=(id,label,v)=>`<label>${label}<select id="${id}" ${dis}>${HCBC_OPTS.map(([a,n])=>`<option value="${a??''}" ${(v??null)===a?'selected':''}>${n}</option>`).join('')}</select></label>`;
  const tables=tb.data||[];
  $('main').innerHTML=`<h1>POS設定 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>${ed?'':'<div class="muted" style="margin-bottom:10px">閲覧のみ</div>'}
  <div id="siBox" data-st="${esc(st)}"><div class="card muted">読み込み中…</div></div>
  <div class="card"><h2>料金</h2><div class="grid2">
    ${num('psSetM','最初のセット時間（分）',d.set_minutes)}${num('psSetP','セット1名単価（円）',d.set_unit_price)}
    ${num('psExtM','延長単位（分）',d.ext_minutes)}${num('psExtP','延長1名単価（円）',d.ext_unit_price)}
    ${num('psSvc','サービス料率（%）',d.service_rate)}${num('psTax','消費税率（%）',d.tax_rate)}
    ${num('psRnd','合計の切り上げ単位（円）',d.total_round_unit)}
    ${amt('psHc','HC（人数分・'+KL+'にバック100%）',d.auto_hc_amount)}${amt('psBc','BC（人数分・バックなし）',d.auto_bc_amount)}
  </div>${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" data-pssave>保存</button></div>':''}</div>
  ${me?.is_owner?`<div class="card"><h2>売上目標</h2><div class="grid2"><label>売上目標（月・円）<input id="psTgt" inputmode="numeric" value="${esc(tgt==null?'':Number(tgt).toLocaleString('ja-JP'))}"${tgtErr?' disabled':''}></label></div><div class="fend"><span class="sp"></span><button class="primary sm" id="tgtSave"${tgtErr?' disabled':''}>保存</button></div></div>`:''}
  <div class="card"><h2>伝票</h2>
    <label class="ck"><input type="checkbox" id="psDk" ${d.douhan_is_kakari?'checked':''} ${dis}>同伴の人を自動で${KL}にする</label>
    <label class="ck"><input type="checkbox" id="psCk" ${d.cust_auto_kakari!==false?'checked':''} ${dis}>お客様を登録したら、そのお客様の${KL}を自動で入れる</label>
    ${'sales_shot_manager' in d?`<label class="ck"><input type="checkbox" id="psSm" ${d.sales_shot_manager?'checked':''} ${dis}>アプローチのスクショは、お客様の${KL}ではなく、いつも担当黒服に送る</label>`:''}${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" data-pssave>保存</button></div>':''}</div>
  <div class="card"><h2>入金・出金の項目</h2><div class="muted" style="font-size:13px;margin-bottom:8px">POS の現金管理で、入金・出金する時に選ぶ項目です。「その他」はいつも出ます（自由に書けます）</div>
    ${'cash_out_items' in d?`<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">${[['in','入金'],['out','出金']].map(([k,l])=>`<div style="flex:1 1 280px;min-width:0"><div style="font-weight:700;margin-bottom:6px">${l}</div><div class="ci-list" data-ci="${k}">${(d['cash_'+k+'_items']||[]).map(x=>`<span class="badge gray ci" style="background:#fff;color:var(--ink);border:1px solid var(--line);font-size:14px;margin:0 6px 6px 0;display:inline-flex;gap:6px;align-items:center"><span>${esc(x)}</span>${ed?'<a data-cirm style="cursor:pointer;color:var(--muted)">×</a>':''}</span>`).join('')}</div>
      ${ed?`<div class="row" style="margin-top:4px"><input data-ciin="${k}" maxlength="20" placeholder="${l}の項目（20字まで）" style="flex:1"><button class="ghost" data-ciadd="${k}">追加</button></div>`:''}</div>`).join('')}</div>
      ${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" id="ciSave">保存</button></div>':''}`:'<div class="err">SQL 077 が未実行です</div>'}</div>
  <div class="card"><h2>VIP料金</h2>
    <div class="muted" style="font-size:13px;margin-bottom:6px">VIP代は部屋に1回、VIP延長は延長ごと。人数は掛けません。ここに無い卓は通常卓（0円）です</div>
    <table class="t vip" id="vipT"><tr><th>卓</th><th>VIP代（円）</th><th>VIP延長（円）</th>${ed?'<th></th>':''}</tr>
    ${tables.filter(t=>Number(t.vip_set_fee||0)||Number(t.vip_ext_fee||0)).map(t=>vipRow(t,ed,dis)).join('')}</table>
    <div id="vipNone" class="muted" style="${tables.some(t=>Number(t.vip_set_fee||0)||Number(t.vip_ext_fee||0))?'display:none':''}">VIP の卓はありません</div>
    ${ed&&tables.length?`<div class="row" style="margin-top:8px"><select id="vipAdd" style="width:auto"><option value="">＋VIP の卓を追加</option>${tables.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>`:''}${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" data-pssave>保存</button></div>':''}</div>
  <div class="muted hint" style="font-size:13px;margin-top:10px;line-height:1.6">保存すると、POS の次の伝票から変わります（今開いている伝票はそのまま）<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">日払（立替）の上限・体験の源泉・ポイント・同伴の準備時間は「報酬・罰金項目」で設定します</div></div>`;
  if(keep) $('siBox').replaceWith(keep); else siRender();
  if($('tgtSave')) $('tgtSave').onclick=async()=>{ const raw=toHan($('psTgt').value).replace(/[,，\s円]/g,''); if(raw!==''&&!/^\d+$/.test(raw)){ toast('売上目標を入力してください'); return; }
    const q=await rpc('admin_sales_target_save',{p_store:st,p_amount:raw===''?null:Number(raw)}); if(!q.ok) return; toast('保存しました'); $('psTgt').value=raw===''?'':Number(raw).toLocaleString('ja-JP'); };
  if(!ed) return;
  // VIP料金は VIP の卓だけ出す。「＋VIP の卓を足す」で行を足す、× で外す（保存すると0円＝通常卓）
  const vipSync=()=>{ const on=new Set([...$('main').querySelectorAll('tr[data-tb]')].map(x=>x.dataset.tb)); $('vipNone').style.display=on.size?'none':''; [...$('vipAdd').options].forEach(o=>{ if(o.value) o.hidden=on.has(o.value); }); };
  const vipWire=tr=>{ tr.querySelector('[data-vrm]').onclick=()=>{ tr.remove(); vipSync(); }; };
  $('main').querySelectorAll('tr[data-tb]').forEach(vipWire);
  if($('vipAdd')){ vipSync(); $('vipAdd').onchange=()=>{ const t=tables.find(x=>x.id===$('vipAdd').value); $('vipAdd').value=''; if(!t) return; const tb=document.createElement('tbody'); tb.innerHTML=vipRow({...t,vip_set_fee:0,vip_ext_fee:0},true,''); const tr=tb.firstElementChild; $('vipT').appendChild(tr); vipWire(tr); vipSync(); tr.querySelector('[data-v=set]').focus(); }; }
  // 入金・出金の項目（足す・×で消す → 項目を保存）
  const ciChip=x=>{ const c=document.createElement('span'); c.className='badge gray ci'; c.style.cssText='background:#fff;color:var(--ink);border:1px solid var(--line);font-size:14px;margin:0 6px 6px 0;display:inline-flex;gap:6px;align-items:center'; c.innerHTML=`<span>${esc(x)}</span><a data-cirm style="cursor:pointer;color:var(--muted)">×</a>`; c.querySelector('[data-cirm]').onclick=()=>c.remove(); return c; };
  $('main').querySelectorAll('[data-cirm]').forEach(a=>a.onclick=()=>a.closest('.ci').remove());
  $('main').querySelectorAll('[data-ciadd]').forEach(b=>{ const k=b.dataset.ciadd, inp=$('main').querySelector(`[data-ciin="${k}"]`), list=$('main').querySelector(`[data-ci="${k}"]`);
    const add=async()=>{ const v=inp.value.trim(); if(!v) return; if(v==='その他'){ await uiAlert('「その他」は登録不要です'); return; } if([...list.querySelectorAll('.ci span')].some(x=>x.textContent===v)){ inp.value=''; return; } list.appendChild(ciChip(v)); inp.value=''; inp.focus(); };
    b.onclick=add; inp.onkeydown=e=>{ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); add(); } }; });
  if($('ciSave')){ const cs=$('ciSave'); cs.onclick=guard(cs,async()=>{ const g=k=>[...$('main').querySelectorAll(`[data-ci="${k}"] .ci span`)].map(x=>x.textContent);
    const r=await rpc('admin_save_cash_items',{p_store:st,p_in:g('in'),p_out:g('out')}); if(!r.ok) return; unsavedBtns.delete(cs); toast('保存しました（POS の次の入金・出金から変わります）'); }); }
  /* 料金・伝票・VIP料金の箱ごとに保存（オーナー「料金のところには保存ボタンないよね」）。どの箱の保存でも、この3つの箱の今の入力をまとめて保存する（入れた物が消えない） */
  $('main').querySelectorAll('[data-pssave]').forEach(sv=>sv.onclick=guard(sv,async()=>{
    const g=id=>slNum($(id).value), v={set_minutes:g('psSetM'),set_unit_price:g('psSetP'),ext_minutes:g('psExtM'),ext_unit_price:g('psExtP'),service_rate:g('psSvc'),tax_rate:g('psTax'),total_round_unit:g('psRnd')};
    const lab={set_minutes:'最初のセット時間',set_unit_price:'セット1名単価',ext_minutes:'延長単位',ext_unit_price:'延長1名単価',service_rate:'サービス料率',tax_rate:'消費税率',total_round_unit:'合計の切り上げ単位'};
    for(const [k,x] of Object.entries(v)){ if(x==null||!Number.isFinite(x)||x<0){ await uiAlert(`${lab[k]}を0以上の数で入力してください`); return; } }
    for(const k of ['set_minutes','set_unit_price','ext_minutes','ext_unit_price','total_round_unit']) if(!Number.isInteger(v[k])){ await uiAlert(`${lab[k]}は整数で入力してください`); return; }
    if(!(v.set_minutes>0)||!(v.ext_minutes>0)){ await uiAlert('セット時間と延長単位は1分以上にしてください'); return; }
    if(v.service_rate>100||v.tax_rate>100){ await uiAlert('サービス料率・消費税率は100%までです'); return; }
    v.auto_hc_amount=$('psHc').value?Number($('psHc').value):null; v.auto_bc_amount=$('psBc').value?Number($('psBc').value):null;
    v.douhan_is_kakari=$('psDk').checked; v.cust_auto_kakari=$('psCk').checked; if($('psSm')) v.sales_shot_manager=$('psSm').checked; /* 担当制の店（広島） */
    const vip=[]; for(const t of tables){ const tr=$('main').querySelector(`tr[data-tb="${t.id}"]`); if(!tr){ vip.push({id:t.id,set:0,ext:0}); continue; } // 表に無い卓は通常卓（0円）
      const a=slNum(tr.querySelector('[data-v=set]').value)??0, b=slNum(tr.querySelector('[data-v=ext]').value)??0;
      if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0){ await uiAlert(`${tr.cells[0].textContent} のVIP料金は0以上の整数で入力してください`); return; } vip.push({id:t.id,set:a,ext:b}); }
    if(!await uiConfirm('POS設定を保存しますか？\nPOS の次の伝票から変わります')) return;
    const r=await rpc('admin_save_pos_settings',{p_store:st,p_vals:v,p_vip:vip}); if(!r.ok) return; toast('保存しました'); PAGES.set_pos(); })); };

// 報酬で使う数（日払の上限・体験の源泉・ポイント・同伴の準備時間）。前は POS の料金設定にあった
// ドレス新調日の設定（店ごとに する／しない・毎月○日が提出の期限・罰金の種類）
async function dressFold(st,ed){ const box=$('dressBox'); if(!box) return; const r=await sb.rpc('admin_get_dress_settings',{p_store:st}); if(r.error||page!=='set_pay'||storeId!==st) return; const c=r.data||{};
  let on=!!c.enabled; const dis=ed?'':'disabled', names=[...new Set([c.fine_name,...(c.fine_names||[])])].filter(Boolean);
  box.innerHTML=foldCard('dress','ドレス新調日','',on?`する・毎月${c.due_day}日`:'しない',`<div class="muted" style="font-size:13px;margin-bottom:8px">キャストが毎月の期限までに、新しいドレスの金額とレシートの写真を LINEマイページで提出します。金額が前月の決定時給×3時間未満、または提出がない時は、下の罰金を自動で付けます</div>
    <div class="row"><span class="seg" id="drOn">${[[true,'する'],[false,'しない']].map(([v,n])=>`<button data-v="${v}" class="${on===v?'on':''}" ${dis}>${n}</button>`).join('')}</span></div>
    <div class="grid2" style="margin-top:10px"><label>提出の期限（毎月○日）<input id="drDay" inputmode="numeric" value="${esc(c.due_day)}" ${dis}></label>
    <label>罰金の種類<select id="drFine" ${dis}>${names.map(n=>`<option ${n===c.fine_name?'selected':''}>${esc(n)}</option>`).join('')}</select></label></div>
    ${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" id="drSave">保存</button></div>':''}`);
  foldWire(box); if(!ed) return;
  box.querySelectorAll('#drOn button').forEach(b=>b.onclick=()=>{ on=b.dataset.v==='true'; box.querySelectorAll('#drOn button').forEach(x=>x.classList.toggle('on',x===b)); });
  const sv=$('drSave'); sv.onclick=guard(sv,async()=>{ const d=slNum($('drDay').value); if(!(Number.isInteger(d)&&d>=1&&d<=28)){ await uiAlert('提出の期限は 1〜28 日にしてください'); return; }
    if(!await uiConfirm(on?`ドレス新調日を「する」（毎月${d}日が期限）にしますか？`:'ドレス新調日を「しない」にしますか？')) return;
    const x=await rpc('admin_save_dress_settings',{p_store:st,p_enabled:on,p_due_day:d,p_fine_name:$('drFine').value}); if(!x.ok) return; toast('保存しました'); PAGES.set_pay(); }); }
// 名刺発注の設定（LINEマイページの名刺発注。宛先・件名・返信先・枚数・金額。店ごと）
async function cardFold(st,ed){ const box=$('cardBox'); if(!box) return; const r=await sb.rpc('admin_get_card_settings',{p_store:st}); if(r.error||page!=='set_pay'||storeId!==st) return; const c=r.data||{};
  const inp=(id,l,v,ph='')=>`<label>${l}<input id="${id}" value="${esc(v??'')}" placeholder="${ph}" ${ed?'':'disabled'}></label>`;
  box.innerHTML=foldCard('card','名刺発注','',`${c.qty}枚 ${Number(c.price).toLocaleString('ja-JP')}円・宛先 ${c.to_email?esc(c.to_email):'未設定'}`,`<div class="muted" style="font-size:13px;margin-bottom:8px">LINEマイページで発注すると、宛先にメールを送信し、名刺代を報酬の個別控除に入れます</div><div class="grid2">
    ${inp('cdTo','宛先メールアドレス',c.to_email,'例：info@example.com')}${inp('cdSub','件名',c.subject)}${inp('cdRe','返信先アドレス',c.reply_to)}${inp('cdQty','枚数',c.qty)}${inp('cdPrice','金額（円）',c.price)}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">メール送信の設定：${c.mail_ready?'設定済':'未設定'}</div>${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" id="cdSave">保存</button></div>':''}`);
  foldWire(box); const sv=$('cdSave'); if(!sv) return;
  sv.onclick=guard(sv,async()=>{ const q=slNum($('cdQty').value), pr=slNum($('cdPrice').value); if(!(q>0)||!(pr>=0)){ await uiAlert('枚数と金額を確認してください'); return; }
    if(!await uiConfirm('名刺発注の設定を保存しますか？')) return; const x=await rpc('admin_save_card_settings',{p_store:st,p_to:$('cdTo').value,p_subject:$('cdSub').value,p_reply:$('cdRe').value,p_qty:q,p_price:pr}); if(!x.ok) return; toast('保存しました'); PAGES.set_pay(); }); }
// 報酬・罰金項目の並びに合わせて2つの箱に分けた（保存は同じ admin_save_pay_settings。どちらの保存も6つ全部を送る）
const pnNum=(id,label,v,ed)=>`<label>${label}<input id="${id}" inputmode="decimal" value="${esc(v??'')}" ${ed?'':'disabled'}></label>`;
const pnSaveBtn=ed=>ed?'<div class="fend"><span class="sp"></span><button class="primary sm" data-pnsave>保存</button></div>':'';
const pnYen=v=>v==null?'—':Number(v).toLocaleString('ja-JP')+'円';
function payAdvCard(pos,ed){ const d=pos.data||{};
  return foldCard('payadv','日払（立替）の上限・同伴の準備時間','',`キャスト ${pnYen(d.advance_cap_cast)}・黒服 ${pnYen(d.advance_cap_hall)}・${d.douhan_punch_limit_min??'—'}分`,`<div class="grid2">
    ${pnNum('pnCapC','日払（立替）の上限・キャスト（円）',d.advance_cap_cast,ed)}${pnNum('pnCapH','日払（立替）の上限・黒服（円）',d.advance_cap_hall,ed)}
    ${pnNum('pnDh','同伴の準備時間（分・0＝警告なし）',d.douhan_punch_limit_min,ed)}</div>
    <div class="muted hint" style="font-size:13px;margin-top:8px;line-height:1.6">同伴の準備時間：伝票の立ち上げから出勤の打刻まで<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">これを超えると、タイムカードで本人に警告します</div></div>${pnSaveBtn(ed)}`,'data-paynum'); }
function payPtCard(pos,ed){ const d=pos.data||{};
  return foldCard('paypt','ポイント・体験入店','',`セット ${d.set_point??'—'}・延長 ${d.ext_point??'—'}・源泉 ${d.trial_withholding_rate??'—'}%${RWPS&&Array.isArray(d.set_point_tiers)&&d.set_point_tiers.length?`・1組の人数別 ${d.set_point_tiers.length}段`:''}`,`<div class="grid2">
    ${pnNum('pnSp','セット1名のポイント',d.set_point,ed)}${pnNum('pnEp','延長1回1名のポイント',d.ext_point,ed)}
    ${pnNum('pnTw','体験入店の源泉（%）',d.trial_withholding_rate,ed)}</div>
    <div class="muted" style="font-size:13px;margin-top:8px;line-height:1.6">ポイントは人数分かけて、${KL}で同じに分けます</div>${RWPS?sptBlock(d,ed):''}${pnSaveBtn(ed)}`,'data-paynum'); }
// セットのポイントを1組（伝票1枚）の人数で段にする（団体をたまたま取った子に大きく入りすぎないため）。ポイントスライドの店だけ
const sptRow=(t,ed)=>`<tr data-spt><td><input inputmode="numeric" data-tu value="${esc(String(t.upto??''))}" ${ed?'':'disabled'}></td><td><input inputmode="decimal" data-tp value="${esc(String(t.p??''))}" ${ed?'':'disabled'}></td><td>${ed?'<button type="button" class="xb" aria-label="削除" data-sptdel>×</button>':''}</td></tr>`;
function sptBlock(d,ed){ const ts=Array.isArray(d.set_point_tiers)?d.set_point_tiers:[];
  return `<div id="sptBox" style="margin-top:14px"><div style="font-size:14px;margin-bottom:6px">セットのポイント（1組の人数別）</div>
    <table class="t vip"><thead><tr><th>人数（名まで）</th><th>ポイント（1名）</th><th></th></tr></thead><tbody id="sptBody">${ts.map(t=>sptRow(t,ed)).join('')}</tbody></table>
    <div class="muted" id="sptRest" style="font-size:13px;margin-top:6px"></div>
    ${ed?'<button type="button" class="ghost sm" id="sptAdd" style="margin-top:6px">＋ 段を追加</button>':''}
    <div class="grid2" style="margin-top:8px"><label>適用開始<input type="date" id="sptFrom" value="${esc(d.set_point_tiers_from||'')}" ${ed?'':'disabled'}></label></div>
    <div class="muted" style="font-size:13px;margin-top:8px;line-height:1.6">段を入れると、適用開始以降はセット1名のポイントの代わりに使います。${KL}が2人以上の伝票は、同じに分けます</div></div>`; }
function sptRest(){ const us=[...document.querySelectorAll('#sptBody [data-tu]')].map(i=>slNum(i.value)).filter(x=>Number.isFinite(x)); const el=$('sptRest'); if(el) el.textContent=us.length?`${Math.max(...us)+1}名以降 0P`:''; }
function sptWire(){ const box=$('sptBox'); if(!box) return; sptRest();
  box.addEventListener('input',e=>{ if(e.target.matches('[data-tu]')) sptRest(); });
  box.addEventListener('click',e=>{ const x=e.target.closest('[data-sptdel]'); if(x){ x.closest('tr').remove(); sptRest(); } });
  const ad=$('sptAdd'); if(ad) ad.onclick=()=>{ $('sptBody').insertAdjacentHTML('beforeend',sptRow({},true)); sptRest(); }; }
function sptVals(){ return [...document.querySelectorAll('#sptBody [data-spt]')].map(tr=>({upto:slNum(tr.querySelector('[data-tu]').value),p:slNum(tr.querySelector('[data-tp]').value)})); }
function payNumWire(st){ $('main').querySelectorAll('[data-pnsave]').forEach(sv=>sv.onclick=guard(sv,async()=>{
  const g=id=>slNum($(id).value), v={advance_cap_cast:g('pnCapC'),advance_cap_hall:g('pnCapH'),trial_withholding_rate:g('pnTw'),set_point:g('pnSp'),ext_point:g('pnEp'),douhan_punch_limit_min:g('pnDh')};
  if(Object.values(v).some(x=>x==null||!Number.isFinite(x)||x<0)){ await uiAlert('全部の欄に0以上の数を入力してください'); return; }
  if(v.trial_withholding_rate>100){ await uiAlert('体験入店の源泉は100%までです'); return; }
  const isPt=sv.closest('[data-fold]').dataset.fold==='paypt', ts=isPt&&$('sptBox')?sptVals():null, tf=ts?$('sptFrom').value:null;
  if(ts){ if(ts.some(t=>!Number.isInteger(t.upto)||t.upto<1||t.p==null||!Number.isFinite(t.p)||t.p<0)){ await uiAlert('段の人数は1以上の整数、ポイントは0以上の数を入力してください'); return; }
    ts.sort((x,y)=>x.upto-y.upto); if(ts.some((t,i)=>i&&t.upto===ts[i-1].upto)){ await uiAlert('段の人数が重複しています'); return; }
    if(ts.length&&!tf){ await uiAlert('適用開始を入力してください'); return; } }
  if(!await uiConfirm(sv.closest('[data-fold]').dataset.fold==='paypt'?'ポイント・体験入店の設定を保存しますか？':'日払（立替）の上限・同伴の準備時間を保存しますか？')) return;
  const r=await rpc('admin_save_pay_settings',{p_store:st,p_vals:v}); if(!r.ok) return;
  if(ts){ const r2=await rpc('admin_save_set_point_tiers',{p_store:st,p_tiers:ts,p_from:tf||null}); if(!r2.ok) return; }
  toast('保存しました'); PAGES.set_pay(); })); sptWire(); }

