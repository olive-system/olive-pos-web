// ---------- 詳細 ----------
/* v1.25：並び順を POS とそろえる（名前・卓名は日本語順、数字は数の順） */
async function openDetail(id){ curId=id; cur=null; const c=custs.find(x=>x.id===id); $('dName').textContent=c?c.name+' 様':''; $('detail').innerHTML='<div class="loading">読み込み中…</div>'; show('vDetail'); paintEdit();
  try{ const d=await rpc('cs_detail',{p_token:token,p_id:id}); if(curId!==id) return; cur=d; renderDetail(); }catch(e){ if(curId===id){ $('detail').innerHTML=''; } await csFail(e); if(e.code==='CS_NOTFOUND'){ show('vList'); loadList(); } } }
async function reloadDetail(){ if(!curId) return; try{ const d=await rpc('cs_detail',{p_token:token,p_id:curId}); cur=d; renderDetail(); }catch(e){ await csFail(e); } }

// v1.43・SQL 117：連絡先交換（LINEマイページからキャストが提出）。交換したキャストの名前。顧客は自動では選ばないので、編集中に黒服がわかる時だけ「未選択の連絡先交換」から選択（POS と同じ。オーナー 2026-10-16）
async function cxLoad(c){ let d; try{ d=await rpc('cs_contacts',{p_token:token,p_customer:c.id}); }catch(e){ const x=$('dCx'); if(x) x.textContent='—'; return; } const box=$('dCx'); if(!box||!cur||cur.customer.id!==c.id) return;
  const key=x=>String(x||'').replace(/[\s　]/g,''), un=((d&&d.unlinked)||[]).slice().sort((a,b)=>(key(b.name)===key(c.name))-(key(a.name)===key(c.name)));
  box.innerHTML=`${((d&&d.casts)||[]).length?d.casts.map(esc).join('・'):'<span class="muted">なし</span>'}`+(editing()&&un.length?`<div style="display:flex;gap:6px;align-items:center;margin-top:6px"><select id="cxSel" style="flex:1;min-width:0;padding:8px 6px"><option value="">未選択の連絡先交換</option>${un.map(x=>`<option value="${x.id}">${esc(x.name)} 様（${esc(x.cast)} ${cuMd(x.date)}）</option>`).join('')}</select><button class="ghost sm" id="cxGo" style="flex:none">選択</button></div>`:'');
  const go=$('cxGo'); if(go) go.onclick=async()=>{ const id=$('cxSel').value; if(!id){ await uiAlert('連絡先交換を選んでください'); return; } const x=un.find(z=>z.id===id); if(!await uiConfirm(`${x.name} 様（${x.cast}）の連絡先交換を\n${c.name} 様にしますか？`)) return; if(!await needEdit()) return; go.disabled=true; try{ await rpc('cs_contact_link',{p_token:token,p_edit_token:editTok,p_id:id,p_customer:c.id}); toast('顧客を選択しました'); cxLoad(c); }catch(e){ go.disabled=false; await csFail(e); } }; }
function renderDetail(){ if(!cur) return; const c=cur.customer; /* v1.59：モードが無いので、編集のボタンはいつも同じ形（閲覧だけの人には出さない） */ $('dName').textContent=c.name+' 様';
  const bts=(cur.bottles||[]).slice().sort((a,b)=>String(b.opened_on||'').localeCompare(String(a.opened_on||''))||String(a.id).localeCompare(String(b.id))); /* v1.25：開けた日の新しい順（POS と同じ） */ const open=bts.filter(b=>!b.is_finished&&!b.expired_on), fin=bts.filter(b=>b.is_finished&&!b.expired_on), exp=bts.filter(b=>b.expired_on);
  const kakari=c.kakari_staff_id?sname(c.kakari_staff_id):'';
  const good=(cur.good||[]).slice().sort((a,b)=>b.n-a.n||jaCmp(sname(a.staff_id),sname(b.staff_id))).slice(0,3)/* v1.28・SQL 066：全員を受け取り、多い順・同じ回数は名前順で3名（POS と同じ） */.map(g=>`<span style="margin-right:14px;white-space:nowrap;display:inline-block">${esc(sname(g.staff_id))} <small class="muted">${g.n}回</small></span>`).join('')||'<span class="muted">なし</span>';
  const reqs=(cur.requests||[]).map(q=>`<div class="req"><div class="who">${cuMd(q.business_date)}　${esc(sname(q.author_staff_id))}　申請中</div><div style="white-space:pre-wrap">${esc(q.body)}</div></div>`).join('');
  const keep=(boot.keep_products||[]);
  const V={c,bts,open,fin,exp,kakari,good,reqs,keep};
  $('detail').innerHTML=rdHtmlInfo(V)+rdHtmlBottles(V)+rdHtmlRest(V);
  rdBindTop(V); rdBindBottles(V); rdBindAdd(V); }
/* お客様の情報（フリガナ〜連絡先交換） */
function rdHtmlInfo(V){ const {c,bts,open,fin,exp,kakari,good,reqs,keep}=V; return `
  <div class="card" style="position:relative"><button class="edit sm" id="editInfo" style="position:absolute;top:10px;right:10px">編集</button>
    <dl class="kv info">
      <dt>フリガナ</dt><dd>${esc(c.kana||'—')}</dd>
      <dt>お誕生日</dt><dd>${esc(c.birthday||'—')}</dd>
      <dt>会社名</dt><dd>${esc(c.company||'—')}${c.is_industry?' <span class="badge k">同業</span>':''}</dd>
      <dt>領収書名</dt><dd style="white-space:pre-line">${c.receipt_none?'不要':esc(c.receipt_name||'—')}</dd>
      <dt>${KL}</dt><dd>${esc(kakari||'—')}</dd>
      <dt>会社住所</dt><dd>${esc(c.company_address||'—')}</dd>
      <dt>タバコ</dt><dd style="white-space:pre-line">${esc(c.tobacco||'—')}</dd>
      <dt>配車</dt><dd style="white-space:pre-line">${esc(c.haisha||'—')}</dd>
      <dt>反応◎</dt><dd>${good}</dd>
      <dt>連絡先交換</dt><dd id="dCx"><span class="muted">…</span></dd>
    </dl></div>`; }
/* キープボトル（ほかの店舗・新しく登録・期限切れ・飲み切り） */
function rdHtmlBottles(V){ const {c,bts,open,fin,exp,kakari,good,reqs,keep}=V; return `
  <div class="card"><h2>キープボトル ${open.length}本</h2>
    ${open.map(b=>`<div class="bt"><div class="b1"><span class="nm" style="min-width:0;display:flex;align-items:baseline;white-space:nowrap"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(b.name)}</span>${b.share?`<small style="margin-left:6px;flex:none"><span class="badge" style="font-size:11px;padding:0 5px">共同</span> <a data-shgo="${b.share_id||''}" style="color:var(--pri);text-decoration:underline;cursor:pointer">${esc(b.share)} 様</a></small>`:''}</span><select data-rem="${b.id}" aria-label="残量">${[10,9,8,7,6,5,4,3,2,1,0].map(n=>`<option value="${n}" ${b.remaining===n?'selected':''}>${n}/10</option>`).join('')}</select></div>
      <div class="b2"><div class="kn"><span class="muted">キープ名</span><input data-kn="${b.id}" value="${esc(b.keep_name||c.name)}" aria-label="キープ名"></div><div class="b3"><button class="ghost sm" data-fin="${b.id}">飲切</button><button class="ghost sm" data-exp="${b.id}">期限切</button><button class="ghost sm" data-mv="${b.id}">移動</button><button class="ghost sm" data-sh="${b.id}">共同</button></div></div></div>`).join('')||'<div class="muted" style="margin-bottom:8px">なし</div>'}
    ${(cur.other_bottles||[]).length?`<div style="margin-top:8px"><div class="muted" style="font-size:12px">ほかの店舗のキープ（閲覧のみ）</div>${cur.other_bottles.map(b=>`<div class="muted fit1" style="font-size:13px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.store+'：'+b.name+'　'+(b.remaining??0)+'/10')}${b.keep_name&&b.keep_name!==c.name?`（キープ名：${esc(b.keep_name)}）`:''}</div>`).join('')}</div>`:''}`+rdHtmlBtNew(V); }
/* 新しくボトルを登録・期限切れ・飲み切り済 */
function rdHtmlBtNew(V){ const {c,bts,open,fin,exp,kakari,good,reqs,keep}=V; return `
    <div style="border-top:1px dashed var(--line);margin-top:10px;padding-top:10px"><div class="muted" style="font-size:13px;margin-bottom:6px">新しくボトルを登録</div><div style="display:flex;gap:6px;align-items:center"><select id="btSel" style="flex:1;min-width:0;padding:10px 6px"><option value="">銘柄を選ぶ</option>${keep.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}<option value="__free">＋ リストに無い銘柄</option></select><select id="btRem" style="width:auto;flex:none;padding:10px 6px" aria-label="残量">${[10,9,8,7,6,5,4,3,2,1].map(n=>`<option value="${n}">${n}/10</option>`).join('')}</select><button class="ok" id="btAdd" style="flex:none">登録</button></div></div>
    ${exp.length?`<div style="margin-top:4px">${exp.map(b=>`<div class="muted fit1" style="font-size:13px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((b.moved?'ボトル移動':'期限切れ')+'：'+b.name+'　'+(b.remaining??0)+'/10　'+(d=>d?String(d).slice(0,10).split('-').map(Number).join('/'):'')(b.expired_on)+(b.moved&&(b.moved_to||b.moved_staff)?'　'+[b.moved_to?'移動先 '+b.moved_to:'',b.moved_staff?KL+' '+b.moved_staff:''].filter(Boolean).join('・'):''))}${b.keep_name&&b.keep_name!==c.name?`（キープ名：${esc(b.keep_name)}）`:''}</div>`).join('')}</div>`:''}
    ${fin.length?`<div class="muted" style="font-size:13px;margin-top:10px">飲み切り済：${fin.slice(0,10).map(b=>esc(b.name)).join('、')}</div>`:''}</div>`; }
/* メモ・請求先・最終来店日（SQL 469：一方通行・金額は出さない）・削除 v1.47・SQL 196：お客様を削除（オーナー 2026-10-22。来店の履歴・キープボトルがある人は消さない） */
function rdHtmlRest(V){ const {c,bts,open,fin,exp,kakari,good,reqs,keep}=V; return `
  <div class="card"><h2>メモ<button class="edit sm" id="editMemo">編集</button></h2>
    <div class="memo">${c.memo?esc(c.memo):'<span class="muted">なし</span>'}</div>${reqs}
    <button class="ok" id="reqBtn" style="width:100%;margin-top:12px">＋ 気づきを申請</button></div>
  <div class="card"><h2>請求先<button class="ghost sm" id="btcAdd">追加</button></h2><div id="dBt"><span class="muted">…</span></div></div>
  <div class="card"><h2>最終来店日</h2><div class="vis"><span>${cur.last?String(cur.last).slice(0,10).replace(/-/g,'/').replace(/\/0/g,'/'):'なし'}</span></div></div>
  <div style="text-align:right;margin:4px 0 20px"><button class="danger sm" id="cuDel">削除</button></div>`; }
/* 押した時の動き：請求先・削除・編集・申請 */
function rdBindTop(V){ const {c,bts,open,fin,exp,kakari,good,reqs,keep}=V;
  const D=$('detail'); fitLine(D); cxLoad(c); btcLoad(c); $('btcAdd').onclick=async()=>{ if(await needEdit()) btcForm(c,null); };
  $('cuDel').onclick=async()=>{ if(!await needEdit()) return; if(!await uiConfirm(`${c.name} 様を削除しますか？`,'削除','danger')) return;
    try{ await rpc('cs_customer_delete',{p_token:token,p_edit_token:editTok,p_id:c.id}); toast('削除しました'); curId=null; cur=null; show('vList'); renderList(); await loadList(); }catch(e){ await csFail(e); } };
  $('editInfo').onclick=async()=>{ if(await needEdit()) editForm(false); };
  $('editMemo').onclick=async()=>{ if(await needEdit()) editForm(true); };
  $('reqBtn').onclick=()=>reqForm();
}
/* 押した時の動き：ボトルの残量・飲み切り・期限切れ・移動・共同・キープ名 */
function rdBindBottles(V){ const {c,bts,open,fin,exp,kakari,good,reqs,keep}=V; const D=$('detail');
  D.querySelectorAll('[data-rem]').forEach(x=>x.onchange=async()=>{ const b=bts.find(z=>z.id===x.dataset.rem); const v=x.value; x.disabled=true;
    try{ await rpc('cs_bottle',{p_token:token,p_bottle:b.id,p_action:'remaining',p_value:v}); b.remaining=Number(v); toast(`${b.name} を 残り ${v}/10 にしました`); }catch(e){ x.value=String(b.remaining); await csFail(e); } finally{ x.disabled=false; } });
  D.querySelectorAll('[data-fin]').forEach(x=>x.onclick=async()=>{ const b=bts.find(z=>z.id===x.dataset.fin); if(!await uiConfirm(`${b.name} を飲み切りにしますか？`,'飲み切り')) return; await bottleAct(b,'finish','飲み切りにしました'); });
  D.querySelectorAll('[data-exp]').forEach(x=>x.onclick=async()=>{ const b=bts.find(z=>z.id===x.dataset.exp); if(!await uiConfirm(`${b.name}（残り ${b.remaining??0}/10）を期限切れにしますか？\n残量はこのまま記録されます。`,'期限切れ','danger')) return; await bottleAct(b,'expire','期限切れにしました'); });
  D.querySelectorAll('[data-mv]').forEach(x=>x.onclick=async()=>{ const b=bts.find(z=>z.id===x.dataset.mv); const v=await mvForm(b,c); if(v) await bottleAct(b,'move','ボトル移動にしました',JSON.stringify(v)); }); /* v1.55・SQL 306：移動先・係を記録（オーナー 2026-11-01「移籍先のお店に持っていける。一応記録しておきたい」） */
  D.querySelectorAll('[data-sh]').forEach(x=>x.onclick=async()=>{ const b=bts.find(z=>z.id===x.dataset.sh); if(b.own===false){ if(!await uiConfirm(`${b.name} は ${b.share} 様のボトルです。\n共同を解除しますか？`,'共同解除')) return; if(!await needEdit()) return; await bottleAct(b,'share','共同を解除しました','',true); return; } /* 相手のボトルは解除だけ */ if(!await needEdit()) return; const v=await shForm(b,c); if(v!=null) await bottleAct(b,'share',v?'共同ボトルにしました':'共同を解除しました',v,true); }); /* v1.55・SQL 306：共同ボトル（1本を2人のお客様につなぐ） */
  D.querySelectorAll('[data-shgo]').forEach(x=>x.onclick=()=>{ if(x.dataset.shgo) openDetail(x.dataset.shgo); });
  D.querySelectorAll('[data-unexp]').forEach(x=>x.onclick=async()=>{ const b=bts.find(z=>z.id===x.dataset.unexp); if(!await uiConfirm(`${b.name} の${b.moved?'ボトル移動':'期限切れ'}を取り消して、キープ中に戻しますか？`,'戻す')) return; if(!await needEdit()) return; await bottleAct(b,'unexpire','キープ中に戻しました',null,true); });
  /* v1.10：キープ名は常に表示。書き換えて枠を離れたら、編集パスワードを確認してから保存（POS と同じ形） */
  D.querySelectorAll('[data-kn]').forEach(x=>x.onchange=async()=>{ const b=bts.find(z=>z.id===x.dataset.kn); const v=x.value.trim(); const before=b.keep_name||c.name; if((v||c.name)===before){ x.value=before; return; } if(!await needEdit()){ x.value=before; return; } await bottleAct(b,'keep_name','キープ名を保存しました',v,true); });
}
/* ボトルの追加（リストに無い銘柄も） */
function rdBindAdd(V){ const {c,bts,open,fin,exp,kakari,good,reqs,keep}=V;
  let btPrev='';
  $('btSel').onchange=async()=>{ const sel=$('btSel'); if(sel.value!=='__free'){ btPrev=sel.value; return; }
    const cur0=sel.querySelector('option[data-free]'); const nm=await uiPrompt('リストに無い銘柄の名前',cur0?cur0.dataset.free:'',{ok:'決定',ph:'例：マッカラン18年'});
    const v=(nm||'').trim(); if(!v){ sel.value=btPrev; return; }
    let o=cur0; if(!o){ o=document.createElement('option'); sel.insertBefore(o,sel.querySelector('option[value="__free"]')); }
    o.value='__name'; o.dataset.free=v; o.textContent=v; sel.value='__name'; btPrev='__name'; };
  $('btAdd').onclick=async()=>{ const pid=$('btSel').value; const fo=$('btSel').querySelector('option[data-free]'); const freeName=pid==='__name'&&fo?fo.dataset.free:''; const p=freeName?{name:freeName}:keep.find(z=>z.id===pid); if(!p){ toast('銘柄を選んでください'); return; } const rem=Number($('btRem').value); if(!await uiConfirm(`${c.name} 様に ${p.name}（残り ${rem}/10）を登録しますか？${freeName?'\n（リストに無い銘柄として登録します）':''}`,'登録')) return;
    if(freeName){ try{ await rpc('cs_bottle_add_named',{p_token:token,p_customer:c.id,p_name:freeName,p_remaining:rem}); toast('ボトルを登録しました'); await reloadDetail(); }catch(e){ if(e.code==='SQL') await uiAlert('準備中です（SQL 044 が未実行）'); else { await csFail(e); await reloadDetail(); } } return; }
    try{ const bid=await rpc('cs_bottle_add',{p_token:token,p_customer:c.id,p_product:p.id}); if(rem!==10) await rpc('cs_bottle',{p_token:token,p_bottle:bid,p_action:'remaining',p_value:String(rem)}); toast('ボトルを登録しました'); await reloadDetail(); }catch(e){ await csFail(e); await reloadDetail(); } };
}
window.addEventListener('resize',()=>fitLine());
// v1.55・SQL 306：ボトル移動の移動先・係（係は今の係を最初に選ぶ）
function mvForm(b,c){ const casts=(boot.staff||[]).filter(s=>s.kind==='cast'&&s.active); const k0=b.kakari_staff_id||c.kakari_staff_id||'';
  return sheet(`<h3>${esc(b.name)}（${b.remaining??0}/10）をボトル移動にしますか？</h3><label class="f">移動先<input id="mvTo" maxlength="60" placeholder="例）ファースト"></label><label class="f">${KL}<select id="mvSt"><option value="">なし</option>${casts.map(s=>`<option value="${s.id}" ${s.id===k0?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
  <div class="btns"><button class="ghost" data-x>キャンセル</button><button class="edit" data-ok>ボトル移動</button></div>`,(s,done)=>{ s.querySelector('[data-x]').onclick=()=>done(null); s.querySelector('[data-ok]').onclick=()=>done({to:s.querySelector('#mvTo').value.trim(),staff:s.querySelector('#mvSt').value}); }); }
// v1.55・SQL 306：共同のお客様を選ぶ（名前・会社名で探す）。今の共同は「共同解除」で外す
function shForm(b,c){ return sheet(`<h3>${esc(b.name)}　共同ボトル</h3><label class="f">共同のお客様<input id="shQ" placeholder="お名前・フリガナ・会社名で検索" autocomplete="off"></label><div id="shL" style="border:1px solid var(--line);border-radius:10px;max-height:240px;overflow:auto"></div>
  <div class="btns">${b.share?'<button class="ghost" data-off style="margin-right:auto">共同解除</button>':''}<button class="ghost" data-x>キャンセル</button><button class="edit" data-ok>保存</button></div>`,(s,done)=>{ let pick=b.share_id&&b.share_id!==c.id?b.share_id:'';
    const draw=()=>{ const q=s.querySelector('#shQ').value.trim(); const hit=custs.filter(x=>x.id!==c.id&&(!q||(x.name||'').includes(q)||(x.company||'').includes(q)||kanaHit(x,q))).slice(0,30); s.querySelector('#shL').innerHTML=hit.map((x,i)=>`<div data-pk="${x.id}" style="padding:8px 10px;cursor:pointer;${i?'border-top:1px solid var(--line);':''}${x.id===pick?'background:var(--soft);font-weight:700':''}">${esc(x.name)} 様${x.company?`　<span class="muted">${esc(x.company)}</span>`:''}</div>`).join('')||'<div class="muted" style="padding:8px 10px">見つかりません</div>'; s.querySelectorAll('[data-pk]').forEach(d=>d.onclick=()=>{ pick=d.dataset.pk; draw(); }); };
    s.querySelector('#shQ').oninput=draw; draw(); s.querySelector('[data-x]').onclick=()=>done(null); const off=s.querySelector('[data-off]'); if(off) off.onclick=()=>done('');
    s.querySelector('[data-ok]').onclick=()=>{ if(!pick){ toast('共同のお客様を選んでください'); return; } done(pick); }; }); }
async function bottleAct(b,action,msg,value,withEdit){ try{ await rpc('cs_bottle',{p_token:token,p_bottle:b.id,p_action:action,p_value:value==null?null:String(value),p_edit_token:withEdit?editTok:null}); toast(msg); }catch(e){ await csFail(e); } await reloadDetail(); }

// 気づきの申請（書いた人はこのスマホで前回選んだ人を初期表示）
function reqForm(){ const c=cur.customer; const ppl=(boot.staff||[]).filter(s=>s.active&&s.kind==='hall'); /* 顧客サイトは黒服だけが使う */ const last=LS.get('olive_cs_author');
  const opt=()=>ppl.map(s=>`<option value="${s.id}" ${s.id===last?'selected':''}>${esc(s.name)}</option>`).join('');
  return sheet(`<h3>${esc(c.name)} 様　気づきを申請</h3><label class="f">書いた人<select id="rqWho"><option value="">選んでください</option>${opt()}</select></label><label class="f">気づき<textarea id="rqBody" rows="6" maxlength="1000" placeholder="例）お連れ様は赤ワイン派。次回は…"></textarea></label><div class="muted" style="font-size:12px">申請はメモに直接は入りません。お店で確認してからメモに追記されます。</div><div class="btns"><button class="ghost" data-x>キャンセル</button><button class="ok" data-ok>申請</button></div>`,(s,done)=>{
    s.querySelector('[data-x]').onclick=()=>done(false);
    s.querySelector('[data-ok]').onclick=async e=>{ const who=s.querySelector('#rqWho').value, body=s.querySelector('#rqBody').value.trim(); if(!who){ toast('書いた人を選んでください'); return; } if(!body){ toast('気づきを入力してください'); return; }
      e.target.disabled=true; try{ await rpc('cs_request',{p_token:token,p_customer:c.id,p_author:who,p_body:body}); LS.set('olive_cs_author',who); done(true); toast('申請しました'); await reloadDetail(); }catch(err){ e.target.disabled=false; await csFail(err); } }; }); }

// v1.46・SQL 171：請求先（オーナー 2026-10-19「顧客サイトにも登録」「1人のお客様が会社を何個も持っていて、請求先が違う場合もある」）
// POS で「請求書」にした時に選んだ・入れた請求先が並ぶ。ここで足す・直す・消すと、POS の請求先に出る。直しても消しても、もう会計した分の請求先は変わらない
async function btcLoad(c){ const box=()=>$('dBt'); let rows; /* v1.54：説明を外し、1件を1〜2行に（オーナー 2026-11-01「請求先に説明はいらない。もっとコンパクトに」）。「追加」は見出しの右 */
  try{ rows=await rpc('cs_bill_tos',{p_token:token,p_customer:c.id}); }catch(e){ if(box()) box().innerHTML=`<span class="muted">${esc(e.code==='SQL'?'SQL 171 が未実行です':(e.message||'読み込めません'))/* v1.59：関数が無い時だけ SQL の番号。ほかは本当の文（点検 B3） */}</span>`; return; }
  if(!cur||cur.customer.id!==c.id||!box()) return;
  box().innerHTML=rows.length?rows.map((x,i)=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;${i?'border-top:1px solid var(--line)':''}"><div style="flex:1;min-width:0;font-size:15px;overflow-wrap:anywhere"><b>${esc(x.company)}</b>${x.attn?`　${esc(x.attn)} 様`:''}${x.address?`<div class="muted" style="font-size:13px;white-space:pre-line">${esc(x.address)}</div>`:''}</div>
    <button class="ghost sm" data-bte="${i}" style="flex:none">修正</button><button class="xb" data-btd="${i}" aria-label="削除">×</button></div>`).join('')
    :'<span class="muted">なし</span>';
  box().querySelectorAll('[data-bte]').forEach(b=>b.onclick=async()=>{ if(await needEdit()) btcForm(c,rows[+b.dataset.bte]); });
  box().querySelectorAll('[data-btd]').forEach(b=>b.onclick=async()=>{ const x=rows[+b.dataset.btd]; if(!await needEdit()) return; if(!await uiConfirm(`請求先「${x.company}」を削除しますか？\n会計済の伝票の請求先は変わりません`,'削除','danger')) return;
    try{ await rpc('cs_bill_to_delete',{p_token:token,p_edit_token:editTok,p_customer:c.id,p_id:x.id}); toast('削除しました'); btcLoad(c); }catch(e){ await csFail(e); } }); }
function btcForm(c,x){ return sheet(`<h3>${esc(c.name)} 様　${x?'請求先を修正':'請求先を追加'}</h3>
  <label class="f">会社名（部署も書ける）<input id="bfCo" maxlength="100" value="${esc(x?.company||'')}"></label>
  <label class="f">住所（〒から）<textarea id="bfAd" rows="3" maxlength="200">${esc(x?.address||'')}</textarea></label>
  <label class="f">宛名（様の前）<input id="bfAt" maxlength="60" value="${esc(x?x.attn||'':rnFirst(c.receipt_name)||c.name)}"></label>
  <div class="btns"><button class="ghost" data-x>キャンセル</button><button class="edit" data-ok>保存</button></div>`,(s,done)=>{
    s.querySelector('[data-x]').onclick=()=>done(false);
    s.querySelector('[data-ok]').onclick=async e=>{ const co=s.querySelector('#bfCo').value.trim(); if(!co){ toast('会社名を入力してください'); return; }
      e.target.disabled=true; try{ await rpc('cs_bill_to_save',{p_token:token,p_edit_token:editTok,p_customer:c.id,p_id:x?.id||null,p_company:co,p_address:s.querySelector('#bfAd').value.trim(),p_attn:s.querySelector('#bfAt').value.trim()}); done(true); toast('保存しました'); btcLoad(c); }
      catch(err){ e.target.disabled=false; if(err.code==='CS_EDIT'){ done(false); await uiAlert(err.message); return; } await csFail(err); } }; }); }
