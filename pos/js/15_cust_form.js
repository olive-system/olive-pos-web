// ---------- 顧客：基本情報のフォーム ----------
function renderCuForm(){ const c=cuSel==='__new'?cuDraft:customers.find(x=>x.id===cuSel); if(!c){ $('cuForm').innerHTML='<div class="muted">左の一覧からお客様を選ぶか、「＋新規」で登録してください</div>'; $('cuSide').innerHTML=''; return; }
  if(!staffAll.length&&!renderCuForm._ld){ renderCuForm._ld=1; loadStaffAll().then(()=>{ if(cuSel===c.id) renderCuForm(); }); } // v10.50：退店キャストの名前を出すため
  const casts=staff.filter(s=>s.kind==='cast');
  /* v11.17：係が辞めたキャストの時は「○○（退店）」で残す（前は「なし」になり、ほかの欄を保存すると係が消えていた。顧客サイトと同じ） */ const kGone=c.kakari_staff_id&&!casts.some(s=>s.id===c.kakari_staff_id)?(staffAll.find(s=>s.id===c.kakari_staff_id)||{id:c.kakari_staff_id,display_name:''}):null;
  $('cuForm').innerHTML=cufHtml(c,casts,kGone); $('cuForm').querySelectorAll('[data-rn]').forEach(rnBox);
  /* v12.61・SQL 368：領収書名の横の「不要」（オーナー 2026-11-05「なしと書くと宛名がなしと受け取られる」）。不要の時は領収書名の枠を非表示・会計の領収書の宛名に入れない */
  const rnNo=$('cuForm').querySelector('[data-rnno]'); if(rnNo) rnNo.onchange=()=>{ $('cuForm').querySelector('[data-rn]').style.display=rnNo.checked?'none':'grid'; };
  if(!c.id){ const g=$('cuGood'); if(g) g.parentElement.remove(); $('cuSide').innerHTML=''; } else { cuGoodLoad(c); // v10.53
  cuCxLoad(c); } // v11.52・SQL 117
  $('cuSave').onclick=()=>cufSave(c,rnNo);
  $('cuInd').onclick=e=>cufIndustry(c,e);
  $('cuDel').onclick=()=>cufDelete(c);
  if(c.id){ renderCuReq(c); renderCuSide(c); } }
/* お客様のフォームの形 */
function cufHtml(c,casts,kGone){ return '<div id="cuReq"></div><div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 12px">'+CUF.map(([k,l])=>k==='kakari_staff_id'?`<label>${l}<select data-k="${k}"><option value="">なし</option>${kGone?`<option value="${kGone.id}" selected>${esc(kGone.display_name)}（退店）</option>`:''}${casts.map(s=>`<option value="${s.id}" ${c[k]===s.id?'selected':''}>${esc(s.display_name)}</option>`).join('')}</select></label>`:k==='good_cast_ids'?`<div style="grid-column:1/-1;margin:4px 0 8px"><div class="muted" style="font-size:13px">${l}</div><div id="cuGood" style="font-size:16px;padding:4px 0">…</div></div>`:k==='memo'?`<label style="grid-column:1/-1">${l}<textarea data-k="${k}" rows="9" style="width:100%;font-size:16px;line-height:1.5">${esc(c[k]||'')}</textarea>`+
    `</label>`:k==='birthday'?`<label>${l}<span style="display:flex;gap:8px;align-items:center"><input data-k="${k}" value="${esc(c[k]||'')}" placeholder="例 11/24" style="flex:1 1 0;min-width:0;width:0"><button type="button" class="chip ${c.is_industry?'on':''}" id="cuInd" style="flex:none;padding:6px 12px;font-size:14px">同業</button></span></label>`:k==='receipt_name'?`<div style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted);margin-bottom:10px"><span style="display:flex;align-items:center;gap:12px">${l}<label style="display:inline-flex;align-items:center;gap:4px;margin:0;font-size:13px;color:var(--ink)"><input type="checkbox" data-rnno ${c.receipt_none?'checked':''} style="width:auto;margin:0">不要</label></span>`+
    `<div data-k="${k}" data-rn data-v="${esc(c[k]||'')}" style="display:${c.receipt_none?'none':'grid'};grid-template-columns:minmax(0,1fr) auto;gap:4px 6px;font-size:16px;color:var(--ink)"></div></div>`:`<label>${l}<input data-k="${k}" value="${esc(c[k]||'')}" ${k==='kana'?'placeholder="例）あおやぎ しろう or アオヤギ シロウ" ':''}style="width:100%"></label>`).join('')+'</div>'+`${c.id?'<div id="cuCx" style="margin:0 0 8px"></div>':''}<div class="bar"><button class="primary" id="cuSave">${c.id?'保存':'登録'}</button>${c.id?'<button class="ghost sm" id="cuDel" style="color:var(--muted)">削除</button>':''}</div>`; }
/* 保存：画面の値を集めて確かめ、新規なら登録・あるなら変えた欄だけ保存 */
async function cufSave(c,rnNo){ const patch={}; $('cuForm').querySelectorAll('[data-k]').forEach(i=>patch[i.dataset.k]=i.value.trim()||null); if(!patch.name){toast('お名前は必須です');return;} if(patch.kana){ patch.kana=kanaFix(patch.kana)||null; if(kanaBad(patch.kana)){ await uiAlert('フリガナはカタカナで入力してください'); return; } } /* v12.72・SQL 380 */ if(c.is_industry&&!patch.company){ await uiAlert('店名を会社名に入力してください'); return; } if(patch.birthday){ const m=toHan(patch.birthday).match(/^(\d{1,2})[\/月.\-](\d{1,2})日?$/); const dim=[31,29,31,30,31,30,31,31,30,31,30,31]; if(!m||+m[1]<1||+m[1]>12||+m[2]<1||+m[2]>dim[+m[1]-1]){ toast('お誕生日は 11/24 のように入力してください'); return; } patch.birthday=`${+m[1]}/${+m[2]}`; }
        patch.receipt_none=!!rnNo?.checked; /* v12.61・SQL 368 */
    if(!c.id) return cufAdd(c,patch); return cufUpdate(c,patch); }
async function cufAdd(c,patch){ const same=customers.filter(x=>x.name===patch.name); if(same.length&&!await uiConfirm(`「${patch.name}」様はすでに登録されています${same[0].company?`（${same[0].company}）`:''}。\n別の方として新規登録しますか？`)) return;
      const { kakari_staff_id:kk, ...cup }=patch; Object.keys(cup).forEach(k=>{ if(cup[k]==null) delete cup[k]; }); if(c.is_industry) cup.is_industry=true; const id=crypto.randomUUID();
      const b=$('cuSave'); b.disabled=true; const ins=await sb.rpc('pos_customer_add',{p:{id,store_id:store.id,...cup}}); if(ins.error){ b.disabled=false; toast(ins.error.message); return; }
      if(kk){ const kr=await sb.rpc('pos_kakari_set',{p_customer:id,p_store:store.id,p_staff:kk}); if(kr.error) toast(''+KL+'を保存できません：'+kr.error.message); }
      const r=await sb.from('customers').select(CUSEL).eq('id',id).single(); cuK(r.data); await logOp('顧客追加',{name:patch.name},null,true); customers.push(r.data||{id,store_id:store.id,...cup}); cuDraft=null; cuSel=id; $('cuSearch').value=''; toast('登録しました'); renderCuList(); renderCuForm();
}
async function cufUpdate(c,patch){
        const changed=Object.keys(patch).filter(k=>k==='good_cast_ids'?JSON.stringify(c[k]||[])!==JSON.stringify(patch[k]):k==='receipt_none'?!!c[k]!==patch[k]:(c[k]||null)!==patch[k]); if(!changed.length){toast('変更はありません');return;}
    /* v10.99：変えた欄だけ保存する。ほかの端末（顧客サイトなど）で同じ欄が先に変わっていたら上書きしない */
    const now=await sb.from('customers').select(CUSEL).eq('id',c.id).maybeSingle(); if(now.error){ toast(/customer_kakari/.test(now.error.message)?''+KL+'を読み込めません：'+now.error.message:now.error.message); return; } cuK(now.data); if(!now.data){ await uiAlert('このお客様は削除されています'); customers=customers.filter(x=>x.id!==c.id); cuSel=null; renderCuList(); renderCuForm(); return; }
    const clash=changed.filter(k=>JSON.stringify(now.data[k]??null)!==JSON.stringify(c[k]??null)); let merged=false;
    /* v11.19：メモはほかの端末の変更と行ごとに自動で合わせる（同じ行を両方が直した時だけ、どちらを残すか聞く） */
    if(clash.includes('memo')){ const r=memoMerge(c.memo,patch.memo,now.data.memo), ch=[]; for(const x of r.conflicts){ const v=await pickClash(x); if(v==null) return; ch.push(v); }
      patch.memo=memoMergeDone(r,ch).replace(/\s+$/,'')||null; clash.splice(clash.indexOf('memo'),1); merged=true; c.memo=now.data.memo; const ta=$('cuForm').querySelector('[data-k=memo]'); if(ta) ta.value=patch.memo||'';
      if(JSON.stringify(patch.memo)===JSON.stringify(now.data.memo??null)) changed.splice(changed.indexOf('memo'),1); }
    if(clash.length){ const lb={...Object.fromEntries(CUF),receipt_none:'領収書名 不要'}; const keep=changed.filter(k=>!clash.includes(k)); Object.assign(c,now.data); renderCuForm(); keep.forEach(k=>{ const i=$('cuForm').querySelector(`[data-k=${k}]`); if(i) i.value=patch[k]??''; }); renderCuList(); await uiAlert(`ほかの端末で「${clash.map(k=>lb[k]||k).join('・')}」が先に変更されていました。\n最新の内容に入れ替えたので、確かめてから再度保存してください。`); return; }
    if(!changed.length){ Object.assign(c,now.data); renderCuForm(); toast('ほかの人の変更と同じだったので、そのままにしました'); return; }
    const up={}; changed.forEach(k=>up[k]=patch[k]);
    /* v11.01：係はこの店舗の係として customer_kakari に保存（ほかの店舗の係は変わらない） */ const { kakari_staff_id:kk, ...cup }=up;
    if(Object.keys(cup).length){ const { error } = await sb.rpc('pos_customer_save',{p_id:c.id,p:cup}); if(error){ toast(error.message.includes('column')?'SQL 011 が未適用です：'+error.message:error.message); return; } }
    if('kakari_staff_id' in up){ const kr=kk?await sb.rpc('pos_kakari_set',{p_customer:c.id,p_store:store.id,p_staff:kk}):await sb.rpc('pos_kakari_set',{p_customer:c.id,p_store:store.id,p_staff:null}); if(kr.error){ toast(''+KL+'を保存できません：'+kr.error.message); return; } }
    await logOp('顧客変更',{name:c.name,fields:changed},null,true); const other=Object.keys(now.data).some(k=>!changed.includes(k)&&JSON.stringify(now.data[k]??null)!==JSON.stringify(c[k]??null)); Object.assign(c,now.data,up); toast(merged?'ほかの人の変更と合わせて保存しました':'保存しました'); renderCuList(); if(other) renderCuForm(); /* ほかの端末で変わった欄も最新にする */
}
/* 同業のしるし */
async function cufIndustry(c,e){ e.preventDefault(); const on=!c.is_industry; if(!c.id){ c.is_industry=on; e.currentTarget.classList.toggle('on',on); return; } /* v12.72：新規の時は登録の時に一緒に保存 */ const co=($('cuForm').querySelector('[data-k=company]')?.value||'').trim(); if(on){ if(!co){ await uiAlert('店名を会社名に入力してください'); return; } if(!await uiConfirm(`お店の名前は${co}ですね`)) return; } const r=await sb.rpc('pos_customer_save',{p_id:c.id,p:on?{is_industry:true,company:co}:{is_industry:false}}); if(r.error){ toast(r.error.message); return; } await logOp(on?'同業に登録':'同業の登録を解除',{name:c.name},null,true); c.is_industry=on; if(on) c.company=co; renderCuForm(); renderCuList();
}
/* 削除（来店履歴があれば止める・ボトルの記録も消す） */
async function cufDelete(c){ /* v10.99：来店履歴があれば先に知らせる。ボトルの記録があれば一緒に消す（英語のエラーを出さない） */
    /* v11.01：ほかの店舗に来店・ボトルの記録があるお客様は削除できない（SQL 048） */ const ot=await sb.rpc('cust_others',{p_customer:c.id}); if(ot.data?.others_all){ await uiAlert(`「${c.name}」様はほかの店舗に来店・ボトルの記録があるので削除できません`); return; }
    const [vc,bc]=await Promise.all([ sb.from('bill_customers').select('bill_id',{count:'exact',head:true}).eq('customer_id',c.id), sb.from('customer_bottles').select('id',{count:'exact',head:true}).eq('customer_id',c.id) ]); if(vc.error||bc.error){ toast('削除できません：'+(vc.error||bc.error).message); return; }
    if(vc.count){ await uiAlert(`「${c.name}」様は来店履歴があるので削除できません`); return; }
    if(!await uiConfirm(`「${c.name}」を削除しますか？${bc.count?`\nボトルの記録（${bc.count}本・飲み切りや期限切れも含む）も一緒に消えます。`:''}`))return;
    if(bc.count){ const d=await sb.rpc('pos_bottle_del_customer',{p_customer:c.id}); if(d.error){ toast('削除できません：'+d.error.message); return; } }
    const { error } = await sb.rpc('pos_customer_del',{p_id:c.id}); if(error){ toast('削除できません：'+error.message); renderCuSide(c); return; } await logOp('顧客削除',{name:c.name},null,true); customers=customers.filter(x=>x.id!==c.id); cuSel=null; renderCuList(); renderCuForm();
}
