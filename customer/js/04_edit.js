// 基本情報・メモの編集（編集パスワードが必要）
CU_SITE.rnInp = 'margin:0'; /* 本名の欄（lib/olive/customer.js の rnBox）の入力欄の形 */
const rnFirst=v=>String(v||'').split('\n')[0].trim();
const EF=[['name','お名前'],['kana','フリガナ'],['birthday','お誕生日'],['company','会社名'],['receipt_name','領収書名'],['kakari_staff_id',''+KL+''],['company_address','会社住所'],['tobacco','タバコ'],['haisha','配車']]; /* タバコ・配車（オーナー。メモの【タバコ】【配車】から移した。2行になることがあるので入力は2行の枠） */
function editForm(memoOnly,draft){ const c=cur.customer, dv=k=>draft&&(k in draft)?draft[k]:c[k]; const casts=(boot.staff||[]).filter(s=>s.kind==='cast'&&s.active); const curK=c.kakari_staff_id&&!casts.some(s=>s.id===c.kakari_staff_id)?staffBy(c.kakari_staff_id):null;
  const fields=efFields(c,dv,casts,curK,memoOnly,draft); /* 強化リスト（店ごと・上限は出勤人数×3） */
  return sheet(`<h3>${esc(c.name)} 様　${memoOnly?'メモを編集':'お客様の情報を編集'}</h3>${fields}${memoOnly?`<label class="f">メモ<textarea data-k="memo" rows="12">${esc(dv('memo')||'')}</textarea></label>`:''}<div class="btns"><button class="ghost" data-x>キャンセル</button><button class="edit" data-ok>保存</button></div>`,(s,done)=>{ s.querySelectorAll('[data-rn]').forEach(rnBox); const rnNo=s.querySelector('[data-k=receipt_none]'); if(rnNo) rnNo.onchange=()=>s.querySelector('[data-rn]').classList.toggle('hide',rnNo.checked);
    s.querySelector('[data-x]').onclick=()=>done(false);
    s.querySelector('[data-ok]').onclick=e=>efSave(e,s,done,c,memoOnly); }); }
/* 編集の欄（係・タバコと配車・領収書名・そのほか） */
function efFields(c,dv,casts,curK,memoOnly,draft){ return memoOnly?'':EF.map(([k,l])=>k==='kakari_staff_id'?`<label class="f">${l}<select data-k="${k}"><option value="">なし</option>${curK?`<option value="${curK.id}" selected>${esc(curK.name)}（退店）</option>`:''}${casts.map(s=>`<option value="${s.id}" ${dv(k)===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`
    :k==='tobacco'||k==='haisha'?`<label class="f">${l}<textarea data-k="${k}" rows="2" maxlength="300">${esc(dv(k)||'')}</textarea></label>`
    :k==='receipt_name'?`<div class="f" style="margin-bottom:10px;font-size:13px;color:var(--muted)"><span style="display:flex;align-items:center;gap:12px">${l}<label style="display:inline-flex;align-items:center;gap:4px;margin:0;font-size:13px;color:var(--ink)"><input type="checkbox" data-k="receipt_none" ${dv('receipt_none')?'checked':''} style="width:auto;margin:0">不要</label></span><div data-k="${k}" data-rn data-v="${esc(dv(k)||'')}" class="${dv('receipt_none')?'hide':''}" style="display:grid;grid-template-columns:1fr auto;gap:4px 6px;margin-top:4px;color:var(--ink)"></div></div>` /* 領収書名の横の「不要」（オーナー）。不要の時は枠を非表示 */
    :`<label class="f">${l}<input data-k="${k}" value="${esc(dv(k)||'')}" ${k==='birthday'?'placeholder="例 11/24" inputmode="numeric"':k==='kana'?'placeholder="例）あおやぎ しろう or アオヤギ シロウ"':''}></label>`).join('')+`<label class="f" style="display:flex;align-items:center;gap:8px;color:var(--ink);font-size:15px"><input type="checkbox" data-k="is_industry" ${dv('is_industry')?'checked':''} style="width:auto;margin:0">同業（会社名に店名を入れる）</label><label class="f" style="display:flex;align-items:center;gap:8px;color:var(--ink);font-size:15px"><input type="checkbox" data-k="focus" ${(draft&&('focus' in draft)?draft.focus:!!(custs.find(x=>x.id===c.id)||{}).focus)?'checked':''} style="width:auto;margin:0">強化</label>`; }
/* 保存：変えた欄だけ送る。ほかの人が先に変えていたら合わせる（csClash） */
async function efSave(e,s,done,c,memoOnly){ const patch={}, before={}, dr={}; let fNew=null; const li0=custs.find(x=>x.id===c.id), fChg=()=>fNew!=null&&fNew!==!!(li0&&li0.focus); s.querySelectorAll('[data-k]').forEach(i=>{ dr[i.dataset.k]=i.type==='checkbox'?i.checked:(i.value||null); });
      s.querySelectorAll('[data-k]').forEach(i=>{ const k=i.dataset.k; let v=i.type==='checkbox'?i.checked:(k==='memo'?i.value.replace(/\s+$/,''):i.value.trim()); if(v==='') v=null; if(k==='focus'){ fNew=v; return; } if(k==='is_industry'||k==='receipt_none'){ if(v!==!!c[k]){ patch[k]=v; before[k]=!!c[k]; } return; } if(v!==(c[k]||null)){ patch[k]=v; before[k]=c[k]??null; } });
      if('name' in patch&&!patch.name){ toast('お名前は必須です'); return; }
      if('kana' in patch){ patch.kana=kanaFix(patch.kana)||null; if(kanaBad(patch.kana)){ toast('フリガナはカタカナで入力してください'); return; } if(patch.kana===(c.kana||null)){ delete patch.kana; delete before.kana; } }
      if(patch.birthday){ const m=toHan(patch.birthday).match(/^(\d{1,2})[\/月.\-](\d{1,2})日?$/); const dim=[31,29,31,30,31,30,31,31,30,31,30,31]; if(!m||+m[1]<1||+m[1]>12||+m[2]<1||+m[2]>dim[+m[1]-1]){ toast('お誕生日は 11/24 のように入力してください'); return; } patch.birthday=`${+m[1]}/${+m[2]}`; if(patch.birthday===(c.birthday||null)){ delete patch.birthday; delete before.birthday; } }
      const ind='is_industry' in patch?patch.is_industry:!!c.is_industry; const co='company' in patch?patch.company:c.company; if(ind&&!co){ toast('同業の時は店名を会社名に入力してください'); return; }
      if(!Object.keys(patch).length&&!fChg()){ done(false); toast('変更はありません'); return; }
      if(!editing()){ done(false); if(!await needEdit()) return; return editForm(memoOnly,dr); } /* パスワードを入れ直しても、書いた内容は残す */
      e.target.disabled=true; try{ if(fChg()){ await rpc('cs_focus_set',{p_token:token,p_edit_token:editTok,p_id:c.id,p_on:fNew}); if(li0) li0.focus=fNew; delete dr.focus; loadFocus(); renderList(); } if(Object.keys(patch).length) await rpc('cs_customer_edit',{p_token:token,p_edit_token:editTok,p_id:c.id,p_patch:patch,p_before:before}); done(true); toast('保存しました'); await reloadDetail(); const li=custs.find(x=>x.id===c.id); if(li&&cur){ Object.assign(li,{name:cur.customer.name,kana:cur.customer.kana,company:cur.customer.company,receipt_name:cur.customer.receipt_name,kakari_staff_id:cur.customer.kakari_staff_id,is_industry:cur.customer.is_industry}); } }
      catch(err){ e.target.disabled=false; if(err.code==='CS_CONFLICT'){ done(false); await reloadDetail(); return csClash(memoOnly,c,patch,before,dr); } if(err.code==='CS_EDIT'){ done(false); await uiAlert(err.message); if(!await needEdit()) return; return editForm(memoOnly,dr); } await csFail(err); }
}
/* ほかの人が先に変えていた時。メモは行ごとに自動で合わせて保存する（同じ行を両方が直した時だけ、どちらを残すか聞く）。メモ以外は最新にして、書いた内容と一緒に見せ直す */
async function csClash(memoOnly,c0,patch,before,dr){ const c=cur&&cur.customer; if(!c||c.id!==c0.id){ await uiAlert('ほかの人が先にこのお客様を変更しました'); return; }
  const same=(x,y)=>JSON.stringify(x??null)===JSON.stringify(y??null);
  const clash=Object.keys(patch).filter(k=>!same(k==='is_industry'||k==='receipt_none'?!!c[k]:c[k],before[k]));
  if(clash.includes('memo')){ const r=memoMerge(before.memo,patch.memo,c.memo), ch=[];
    for(const x of r.conflicts){ const v=await pickClash(x); if(v==null){ return editForm(true,{memo:patch.memo}); } ch.push(v); }
    const memo=memoMergeDone(r,ch).replace(/\s+$/,'')||null;
    if(same(memo,c.memo)){ toast('ほかの人の変更と同じだったので、そのままにしました'); return; }
    try{ await rpc('cs_customer_edit',{p_token:token,p_edit_token:editTok,p_id:c.id,p_patch:{memo},p_before:{memo:c.memo??null}}); toast('ほかの人の変更と合わせて保存しました'); await reloadDetail(); }
    catch(err){ if(err.code==='CS_CONFLICT'){ await reloadDetail(); return csClash(true,c0,{memo},{memo:c.memo??null},{memo}); } if(err.code==='CS_EDIT'){ await uiAlert(err.message); if(!await needEdit()) return; return editForm(true,{memo}); } await csFail(err); }
    return; }
  const lb=Object.fromEntries(EF.concat([['is_industry','同業'],['receipt_none','領収書名 不要']])); const d={...dr}; clash.forEach(k=>{ d[k]=c[k]; });
  await uiAlert(`ほかの人が先に「${clash.map(k=>lb[k]||k).join('・')}」を変更していました。そこは最新にして、ほかの欄は書いた内容を残したので、確かめて保存してください`);
  return editForm(memoOnly,d); }
CU_SITE.clashBox=(mine,theirs)=>sheet(`<h3>同じ箇所をほかの人も修正していました</h3><div class="muted" style="font-size:13px">どちらを残しますか？</div>
  <div class="f" style="margin-top:8px">あなた<div class="memo" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px">${mine}</div></div>
  <div class="f">ほかの人<div class="memo" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px">${theirs}</div></div>
  <div class="btns"><button class="ghost" data-v="x">キャンセル</button><button class="ghost" data-v="b">両方残す</button><button class="ghost" data-v="t">ほかの人</button><button class="edit" data-v="m">あなた</button></div>`,(s,done)=>{ s.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>done(b.dataset.v)); }); /* メモの食い違いを選ぶ箱の見た目（顧客サイトの下から出る箱）。選ぶ決まりは lib/olive/customer.js の pickClash */
/* メモを行ごとに合わせる（3者マージ）。base＝書き始めた時のメモ、mine＝自分の入力、theirs＝ほかで変わった今のメモ。同じ所を両方が別々に直した時だけ conflicts に入る */
/* conflicts の choice（'m'／'t'／'b'）で仕上げる */


// 戻るボタン（スマホの戻る操作）で一覧へ
const _open=openDetail; openDetail=async id=>{ try{ history.pushState({d:1},''); }catch(e){} return _open(id); };
$('backBtn').onclick=()=>{ if(history.state&&history.state.d){ history.back(); return; } curId=null; cur=null; show('vList'); renderList(); loadList(); };
window.addEventListener('popstate',()=>{ curId=null; cur=null; show('vList'); renderList(); loadList(); });
/* ほかの端末（POS など）での変更を出す。画面に戻った時と、詳細を開いている間は1分ごとに読み直す。入力中・確認の画面が出ている間は読み直さない。失敗しても知らせない */
async function csRefresh(listToo){ if(!token||document.visibilityState!=='visible'||$('modal').classList.contains('on')) return; const a=document.activeElement; if(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName)&&a.id!=='q') return;
  try{ if(!$('vDetail').classList.contains('hide')&&curId){ const id=curId; const d=await rpc('cs_detail',{p_token:token,p_id:id}); if(curId!==id||$('modal').classList.contains('on')) return; if(JSON.stringify(d)!==JSON.stringify(cur)){ cur=d; renderDetail(); } }
    else if(listToo&&!$('vList').classList.contains('hide')){ const l=await rpc('cs_list',{p_token:token})||[]; if($('vList').classList.contains('hide')) return; l.sort(csOrder); if(JSON.stringify(l)!==JSON.stringify(custs)){ custs=l; renderList(); } } }catch(e){ if(e&&e.code==='CS_AUTH'){ logoutLocal(); showLogin(CS_OUT); } } }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ paintEdit(); csRefresh(true); } });
setInterval(()=>csRefresh(true),60000); /* 一覧の画面でも1分ごとに読み直す（パスワードが変わったらログアウト） */

