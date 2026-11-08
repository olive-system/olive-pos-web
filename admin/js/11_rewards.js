// ---------- 報酬・罰金項目の画面（スライド表は 11_slide.js・項目は 11_items.js）----------
PAGES.set_pay=async()=>{
  const st=storeId, ed=perm('set_pay')==='edit';
  $('main').innerHTML=`<h1>報酬・罰金項目 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><div class="card muted">読み込み中…</div>`;
  const [ps,hb,pos,ft,ax,stb,srw,ctm,rwt,act]=await Promise.all([ sb.from('pay_slides').select('kind,threshold,wage').eq('store_id',st).order('threshold'),
    sb.from('hall_bonus_slides').select('*').eq('store_id',st).order('sales_man'), sb.from('pos_settings').select('*').eq('store_id',st).maybeSingle(),
    sb.from('fine_types').select('name,target,calc,value,per_unit,sort_order').eq('store_id',st).order('sort_order'), sb.rpc('admin_get_after_ext',{p_store:st}),
    sb.from('slide_tables').select('*').eq('store_id',st).eq('is_active',true).order('sort_order'), sb.from('slide_rows').select('table_id,threshold,amount').eq('store_id',st).order('threshold'),
    sbAll(()=>sb.from('cast_terms').select('staff_id,month,only_month,slide_ids').eq('store_id',st).order('id')), sb.rpc('admin_reward_types',{p_store:st}), sb.from('staff').select('id').eq('store_id',st).eq('is_active',true) ]);
  if(page!=='set_pay'||storeId!==st) return;
  const er=ps.error||hb.error||pos.error; if(er){ $('main').innerHTML=`<h1>報酬・罰金項目</h1><div class="card err">${esc(/hall_bonus_slides/.test(er.message)&&/does not exist|schema cache/.test(er.message)?'SQL 050 が未実行です：':'読み込めません：')}${esc(er.message)}</div>`; return; }
  $('main').innerHTML=`<h1>報酬・罰金項目 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  ${ed?'':'<div class="muted" style="margin-bottom:10px">閲覧のみ</div>'}
  <div class="psec">勤怠・日払</div>
  ${afterCard(ax,ed)}
  ${payAdvCard(pos,ed)}
  <div class="psec">罰金</div>
  ${ft.error?`<div class="card err">${esc(/fine_types/.test(ft.error.message)&&/does not exist|schema cache/.test(ft.error.message)?'SQL 052 が未実行です：':'罰金の種類を読み込めません：')}${esc(ft.error.message)}</div>`:fineCard(ft.data||[],ed,pos.data?.daily_hours)}
  <div class="psec">報酬</div>
  ${rwt.error?`<div class="card err">${esc(/admin_reward_types/.test(rwt.error.message)?'SQL 140 が未実行です：':'報酬の種類を読み込めません：')}${esc(rwt.error.message)}</div>`:rwCard(rwt.data||{},ed)}
  <div class="psec">キャスト</div>
  ${stb.error?`<div class="card err">${esc(/slide_tables/.test(stb.error.message)&&/does not exist|schema cache/.test(stb.error.message)?'SQL 058 が未実行です：':'スライド表を読み込めません：')}${esc(stb.error.message)}</div>`:stSection(stb.data||[],srw.data||[],ctm.data||[],ed,act.error?null:(act.data||[]).map(x=>x.id))}
  ${payPtCard(pos,ed)}
  <div id="cardBox"></div>
  <div id="dressBox"></div>
  <div class="psec">黒服</div>
  ${slideCard('hall',hb.data||[],ed,`<div class="muted hint" style="font-size:13px;margin-bottom:8px;line-height:1.6">単位は万円。月の総売上が、その行の売上以上になっている行のうち、一番下の行を使います<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">一番上の行より売上が少ない月は0円です。<br>人件費比率（キャストの報酬＋黒服の月給＋体験の報酬 ÷ 総売上）が 目標比率以内／＋2%まで／＋5%まで／5%超 で金額が決まり、売上ボーナスを加算した総額を、黒服の売上シェアで分けます</div></div>`)}`;
  foldWire($('main'));
  cardFold(st,ed);
  dressFold(st,ed);
  fineListWire(st,ed);
  rwWire(st,ed);
  if(!ed) return;
  payNumWire(st);
  { const ac=$('main').querySelector('[data-after]'); if(ac){ let on=!!ax.data?.on; ac.querySelectorAll('#afOn button').forEach(b=>b.onclick=()=>{ on=b.dataset.v==='true'; ac.querySelectorAll('#afOn button').forEach(x=>x.classList.toggle('on',x===b)); });
    const sv=$('afSave'); sv.onclick=guard(sv,async()=>{ const m=slNum($('afM').value); if(m==null||!Number.isInteger(m)||m<1||m>180){ await uiAlert('何分前かは 1〜180 の整数で入力してください'); return; } const cl=closeTxt(ax.data.close);
      if(!await uiConfirm(on?`閉店（${cl}）の ${m}分前を過ぎたアフターは、閉店まで働いたことにしますか？\nこれから押す打刻から変わります`:'アフターの延長を「しない」にしますか？\nこれから押す打刻から変わります')) return;
      const r=await rpc('admin_set_after_ext',{p_store:st,p_on:on,p_minutes:m}); if(!r.ok) return; toast('保存しました'); PAGES.set_pay(); }); } }
  { const fc=$('main').querySelector('[data-fines]'); if(fc){
    const hs=$('dHoursSave'); if(hs) hs.onclick=guard(hs,async()=>{ const h=slNum($('dHours').value); if(h==null||!(h>0&&h<=24)){ await uiAlert('所定時間は0より大きく24以下の数にしてください'); return; } if(!await uiConfirm(`日給の人の所定時間を ${h}時間 にしますか？\n時間給 ＝ 日給 ÷ ${h}時間 になります`)) return; const r=await rpc('admin_set_daily_hours',{p_store:st,p_hours:h}); if(!r.ok) return; toast('保存しました'); PAGES.set_pay(); });
  } }
  stWire(st);
  $('main').querySelectorAll('[data-sl]').forEach(card=>{ const kind=card.dataset.sl, d=SLIDE_DEF[kind];
    card.querySelector('[data-add]').onclick=()=>{ const tb=card.querySelector('table.sl'); const ph=tb.querySelector('td[colspan]'); if(ph) ph.parentElement.remove(); const i=tb.querySelectorAll('tr[data-i]').length+Date.now(); const tr=document.createElement('tr'); tr.dataset.i=i; tr.innerHTML=d.cols.map(c=>`<td><input inputmode="decimal" data-c="${c.k}"></td>`).join('')+`<td class="x"><button class="xb" aria-label="行を削除">×</button></td>`; tr.querySelector('button').onclick=()=>tr.remove(); tb.appendChild(tr); tr.querySelector('input').focus(); };
    card.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>x.closest('tr').remove());
    const sv=card.querySelector('[data-save]'); sv.onclick=guard(sv,async()=>{ const g=slideRead(card,kind); if(g.err){ await uiAlert(g.err); return; }
      if(!await uiConfirm(`${d.t}を保存しますか？（${g.rows.length}行）`)) return;
      const r=kind==='hall'?await rpc('admin_save_hall_bonus',{p_store:st,p_rows:g.rows}):await rpc('admin_save_pay_slides',{p_store:st,p_kind:kind,p_rows:g.rows}); if(!r.ok) return;
      toast('保存しました'); PAGES.set_pay(); }); });
};

