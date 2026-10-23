// ---------- POS設定の「店の情報」 v0.26・SQL 067：前の「店舗設定」を POS設定にまとめた（権限も POS設定）。v0.14・SQL 055：閉店時間（タイムカードの打ち止め。アフターの延長もここから数える） ----------
// v1.38・SQL 171：振込先（請求書に出る）を足した
// v0.20・SQL 060：店の情報（店名・営業時間・住所・電話・メール・インボイス番号・領収書メールの宛先）。書き換えはここだけ
// 店名は全部のサイト（POS・顧客サイト・タイムカード）に出る。住所・電話・インボイス番号は POS の領収書に出る。領収書メールの宛先は POS の閉店作業で使う。開店時間は登録するだけ
async function siRender(){ const st=storeId, ed=perm('set_pos')==='edit', dis=ed?'':'disabled', box=()=>$('siBox');
  const r=await sb.rpc('admin_get_store_info',{p_store:st}); if(page!=='set_pos'||storeId!==st||!box()) return;
  if(r.error){ box().innerHTML=`<div class="card err">${esc(/admin_get_store_info/.test(r.error.message)?'SQL 060 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const d=r.data||{}, f=(id,label,v,o={})=>`<label>${label}<input id="${id}" value="${esc(v||'')}" ${o.type?`type="${o.type}"`:''} ${o.ph?`placeholder="${esc(o.ph)}"`:''} ${o.im?`inputmode="${o.im}"`:''} ${o.ml?`maxlength="${o.ml}"`:''} ${dis}></label>`;
  box().innerHTML=`<div class="card"><h2>店の情報</h2><div class="sif">
    ${f('siName','店名',d.name,{ml:40})}
    <label>営業時間<span class="sit"><input type="time" id="siOpen" value="${esc(d.open||'')}" ${dis}><span>〜</span><input type="time" id="siClose" value="${esc(d.close||'')}" ${dis}></span></label>
    ${f('siAddr','住所',d.address)}
    ${f('siTel','電話番号',d.phone,{type:'tel',ph:'03-0000-0000'})}
    ${f('siMail','メールアドレス',d.email,{type:'email',ph:'info@example.com'})}
    ${f('siInv','インボイス番号',d.invoice,{ph:'T1234567890123',ml:20})}
    <label>振込先（請求書に出る）<textarea id="siBank" rows="3" maxlength="200" placeholder="振込銀行　◯◯銀行　◯◯支店&#10;口座番号　（普通）0000000&#10;口座名　　株式会社OLIVE" style="width:100%;font:inherit;font-size:16px;line-height:1.5;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)" ${dis}>${esc(d.bank||'')}</textarea></label>
    ${f('siRcpt','領収書メールの宛先',d.receipt_mail,{type:'email'})}
    ${f('siKL','係/担当/指名',curStore()?.kakari_label,{ph:'係',ml:6})}
  </div>
  ${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" id="siSave">保存</button></div>':''}
  <div class="muted hint" style="font-size:13px;margin-top:10px;line-height:1.6">店名は POS・顧客サイト・タイムカード・管理サイトに出ます<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">係/担当/指名：この店での「係」の呼び方です（例：担当）。空にすると「係」のままです。POS・顧客サイト・管理サイトの画面と、Excel・PDF・印刷に出ます（「係小計」は「担当小計」のように変わります）<br>住所・電話番号・インボイス番号は POS の領収書に出ます。住所・電話番号・インボイス番号・振込先は、収支の Excel（ZIP）に入る請求書にも出ます（住所は「〒000-0000 」から書くと、〒の行が分かれます）。領収書メールの宛先は POS の閉店作業「領収書をメールで送る」で使います。開店時間は登録だけです<br>閉店時間：タイムカードの退勤・アフターの打刻は、閉店より後になりません（時給は閉店まで）<br>0:00〜6:00 は日付が変わった後として扱います（例：1:00 ＝ 翌1:00、23:00 ＝ その日の23:00）<br>アフターの延長（報酬・罰金項目）も、この閉店時間から数えます。変更しても、前の打刻はそのまま</div></div></div>`;
  if(!ed) return;
  const sv=$('siSave'); sv.onclick=guard(sv,async()=>{ const v=id=>$(id).value.trim(), name=v('siName'), op=v('siOpen'), cl=v('siClose');
    if(!name){ await uiAlert('店名を入力してください'); return; } if(!cl){ await uiAlert('閉店時間を入力してください'); return; } if(cl>'06:00'&&cl<'18:00'){ await uiAlert('閉店時間は 18:00〜翌6:00 の間にしてください'); return; }
    let iv=v('siInv').replace(/[Ａ-Ｚａ-ｚ０-９]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0xFEE0)).replace(/[\s-]/g,'').toUpperCase(); /* v1.10・SQL 132：T の自動付与をやめた（T が無い・13桁でない時はエラー） */
    if(iv&&!/^T\d{13}$/.test(iv)){ await uiAlert('インボイス番号は T＋数字13桁 で入力してください'); return; }
    const em=/^[^@\s]+@[^@\s]+\.[^@\s]+$/; if(v('siMail')&&!em.test(v('siMail'))){ await uiAlert('メールアドレスの形が正しくありません'); return; } if(v('siRcpt')&&!em.test(v('siRcpt'))){ await uiAlert('領収書メールの宛先の形が正しくありません'); return; }
    const chg=[]; if(name!==(d.name||'')) chg.push('店名（全部のサイトの表示が変わります）'); if(cl!==(d.close||'')) chg.push(`閉店時間 ${closeTxt(cl)}（これから押す打刻から変わります）`);
    const kn=v('siKL')==='係'?'':v('siKL'), k0=curStore()?.kakari_label||''; if(kn.length>6){ await uiAlert('係/担当/指名は6文字までにしてください'); return; } if(kn!==k0) chg.push(`係/担当/指名「${kn||'係'}」（全部のサイトの表示が変わります）`);
    if(!await uiConfirm('店の情報を保存しますか？'+(chg.length?'\n'+chg.map(x=>'・'+x).join('\n'):''))) return;
    const x=await rpc('admin_save_store_info',{p_store:st,p_name:name,p_open:op||null,p_close:cl,p_address:v('siAddr'),p_phone:v('siTel'),p_email:v('siMail'),p_invoice:iv,p_receipt_mail:v('siRcpt'),p_bank:$('siBank').value}); if(!x.ok) return;
    if(kn!==k0){ rtOwn=Date.now(); const y=await sb.rpc('admin_save_kakari_label',{p_store:st,p_label:kn}); rtOwn=Date.now(); if(y.error){ await uiAlert(/admin_save_kakari_label/.test(y.error.message)?'SQL 080 が未実行です（係/担当/指名はまだ保存できません。ほかの項目は保存しました）':y.error.message); } }
    unsavedBtns.delete(sv); toast('保存しました'); me=await loadMe()||me; renderStoreSel(); renderAll(); }); }

