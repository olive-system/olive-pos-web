// 基本情報・メモの編集（編集パスワードが必要）
/* v1.61：領収書名は1社1枠（2社・3社の方がいる。オーナー 2026-11-04「スペースを食わない形で」）。保存は改行でつなぐ。「追加」は最後の枠のすぐ右。枠を空にして保存すると、その社は削除。value で読み書きできるので、ほかの欄と同じに扱える */
const rnFirst=v=>String(v||'').split('\n')[0].trim();
function rnBox(el){ let a=String(el.dataset.v||'').split('\n'); const vals=()=>[...el.querySelectorAll('input')].map(i=>i.value);
  const draw=()=>{ el.innerHTML=a.map((x,i)=>`<input value="${esc(x)}" style="margin:0">${i===a.length-1?'<button type="button" class="ghost" data-rnadd style="padding:0 14px">追加</button>':'<span></span>'}`).join(''); el.querySelector('[data-rnadd]').onclick=()=>{ a=vals(); a.push(''); draw(); el.querySelector('input:last-of-type').focus(); }; };
  Object.defineProperty(el,'value',{get:()=>vals().map(x=>x.trim()).filter(Boolean).join('\n'),set:v=>{ a=String(v||'').split('\n'); draw(); }}); draw(); }
const EF=[['name','お名前'],['kana','フリガナ'],['birthday','お誕生日'],['company','会社名'],['receipt_name','領収書名'],['kakari_staff_id',''+KL+''],['company_address','会社住所'],['tobacco','タバコ'],['haisha','配車']]; /* v1.54・SQL 304：タバコ・配車（オーナー 2026-11-01。メモの【タバコ】【配車】から移した。2行になることがあるので入力は2行の枠） */
function editForm(memoOnly,draft){ const c=cur.customer, dv=k=>draft&&(k in draft)?draft[k]:c[k]; const casts=(boot.staff||[]).filter(s=>s.kind==='cast'&&s.active); const curK=c.kakari_staff_id&&!casts.some(s=>s.id===c.kakari_staff_id)?staffBy(c.kakari_staff_id):null;
  const fields=memoOnly?'':EF.map(([k,l])=>k==='kakari_staff_id'?`<label class="f">${l}<select data-k="${k}"><option value="">なし</option>${curK?`<option value="${curK.id}" selected>${esc(curK.name)}（退店）</option>`:''}${casts.map(s=>`<option value="${s.id}" ${dv(k)===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`
    :k==='tobacco'||k==='haisha'?`<label class="f">${l}<textarea data-k="${k}" rows="2" maxlength="300">${esc(dv(k)||'')}</textarea></label>`
    :k==='receipt_name'?`<div class="f" style="margin-bottom:10px;font-size:13px;color:var(--muted)"><span style="display:flex;align-items:center;gap:12px">${l}<label style="display:inline-flex;align-items:center;gap:4px;margin:0;font-size:13px;color:var(--ink)"><input type="checkbox" data-k="receipt_none" ${dv('receipt_none')?'checked':''} style="width:auto;margin:0">不要</label></span><div data-k="${k}" data-rn data-v="${esc(dv(k)||'')}" class="${dv('receipt_none')?'hide':''}" style="display:grid;grid-template-columns:1fr auto;gap:4px 6px;margin-top:4px;color:var(--ink)"></div></div>` /* v1.63・SQL 368：領収書名の横の「不要」（オーナー 2026-11-05）。不要の時は枠を非表示 */
    :`<label class="f">${l}<input data-k="${k}" value="${esc(dv(k)||'')}" ${k==='birthday'?'placeholder="例 11/24" inputmode="numeric"':k==='kana'?'placeholder="例）あおやぎ しろう or アオヤギ シロウ"':''}></label>`).join('')+`<label class="f" style="display:flex;align-items:center;gap:8px;color:var(--ink);font-size:15px"><input type="checkbox" data-k="is_industry" ${dv('is_industry')?'checked':''} style="width:auto;margin:0">同業（会社名に店名を入れる）</label><label class="f" style="display:flex;align-items:center;gap:8px;color:var(--ink);font-size:15px"><input type="checkbox" data-k="focus" ${(draft&&('focus' in draft)?draft.focus:!!(custs.find(x=>x.id===c.id)||{}).focus)?'checked':''} style="width:auto;margin:0">強化</label>`; /* v1.60・SQL 324：強化リスト（店ごと・上限は出勤人数×3） */
  return sheet(`<h3>${esc(c.name)} 様　${memoOnly?'メモを編集':'お客様の情報を編集'}</h3>${fields}${memoOnly?`<label class="f">メモ<textarea data-k="memo" rows="12">${esc(dv('memo')||'')}</textarea></label>`:''}<div class="btns"><button class="ghost" data-x>キャンセル</button><button class="edit" data-ok>保存</button></div>`,(s,done)=>{ s.querySelectorAll('[data-rn]').forEach(rnBox); const rnNo=s.querySelector('[data-k=receipt_none]'); if(rnNo) rnNo.onchange=()=>s.querySelector('[data-rn]').classList.toggle('hide',rnNo.checked);
    s.querySelector('[data-x]').onclick=()=>done(false);
    s.querySelector('[data-ok]').onclick=async e=>{ const patch={}, before={}, dr={}; let fNew=null; const li0=custs.find(x=>x.id===c.id), fChg=()=>fNew!=null&&fNew!==!!(li0&&li0.focus); s.querySelectorAll('[data-k]').forEach(i=>{ dr[i.dataset.k]=i.type==='checkbox'?i.checked:(i.value||null); });
      s.querySelectorAll('[data-k]').forEach(i=>{ const k=i.dataset.k; let v=i.type==='checkbox'?i.checked:(k==='memo'?i.value.replace(/\s+$/,''):i.value.trim()); if(v==='') v=null; if(k==='focus'){ fNew=v; return; } if(k==='is_industry'||k==='receipt_none'){ if(v!==!!c[k]){ patch[k]=v; before[k]=!!c[k]; } return; } if(v!==(c[k]||null)){ patch[k]=v; before[k]=c[k]??null; } });
      if('name' in patch&&!patch.name){ toast('お名前は必須です'); return; }
      if('kana' in patch){ patch.kana=kanaFix(patch.kana)||null; if(kanaBad(patch.kana)){ toast('フリガナはカタカナで入力してください'); return; } if(patch.kana===(c.kana||null)){ delete patch.kana; delete before.kana; } } /* v1.67・SQL 380 */
      if(patch.birthday){ const m=patch.birthday.replace(/[０-９／]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0xFEE0)).match(/^(\d{1,2})[\/月.\-](\d{1,2})日?$/); const dim=[31,29,31,30,31,30,31,31,30,31,30,31]; if(!m||+m[1]<1||+m[1]>12||+m[2]<1||+m[2]>dim[+m[1]-1]){ toast('お誕生日は 11/24 のように入力してください'); return; } patch.birthday=`${+m[1]}/${+m[2]}`; if(patch.birthday===(c.birthday||null)){ delete patch.birthday; delete before.birthday; } }
      const ind='is_industry' in patch?patch.is_industry:!!c.is_industry; const co='company' in patch?patch.company:c.company; if(ind&&!co){ toast('同業の時は店名を会社名に入力してください'); return; }
      if(!Object.keys(patch).length&&!fChg()){ done(false); toast('変更はありません'); return; }
      if(!editing()){ done(false); if(!await needEdit()) return; return editForm(memoOnly,dr); } /* v1.30：パスワードを入れ直しても、書いた内容は残す */
      e.target.disabled=true; try{ if(fChg()){ await rpc('cs_focus_set',{p_token:token,p_edit_token:editTok,p_id:c.id,p_on:fNew}); if(li0) li0.focus=fNew; delete dr.focus; loadFocus(); renderList(); } if(Object.keys(patch).length) await rpc('cs_customer_edit',{p_token:token,p_edit_token:editTok,p_id:c.id,p_patch:patch,p_before:before}); done(true); toast('保存しました'); await reloadDetail(); const li=custs.find(x=>x.id===c.id); if(li&&cur){ Object.assign(li,{name:cur.customer.name,kana:cur.customer.kana,company:cur.customer.company,receipt_name:cur.customer.receipt_name,kakari_staff_id:cur.customer.kakari_staff_id,is_industry:cur.customer.is_industry}); } }
      catch(err){ e.target.disabled=false; if(err.code==='CS_CONFLICT'){ done(false); await reloadDetail(); return csClash(memoOnly,c,patch,before,dr); } if(err.code==='CS_EDIT'){ done(false); await uiAlert(err.message); if(!await needEdit()) return; return editForm(memoOnly,dr); } await fail(err); } }; }); }
/* v1.30：ほかの人が先に変えていた時。メモは行ごとに自動で合わせて保存する（同じ行を両方が直した時だけ、どちらを残すか聞く）。メモ以外は最新にして、書いた内容と一緒に見せ直す */
async function csClash(memoOnly,c0,patch,before,dr){ const c=cur&&cur.customer; if(!c||c.id!==c0.id){ await uiAlert('ほかの人が先にこのお客様を変更しました'); return; }
  const same=(x,y)=>JSON.stringify(x??null)===JSON.stringify(y??null);
  const clash=Object.keys(patch).filter(k=>!same(k==='is_industry'||k==='receipt_none'?!!c[k]:c[k],before[k]));
  if(clash.includes('memo')){ const r=memoMerge(before.memo,patch.memo,c.memo), ch=[];
    for(const x of r.conflicts){ const v=await pickClash(x); if(v==null){ return editForm(true,{memo:patch.memo}); } ch.push(v); }
    const memo=memoMergeDone(r,ch).replace(/\s+$/,'')||null;
    if(same(memo,c.memo)){ toast('ほかの人の変更と同じだったので、そのままにしました'); return; }
    try{ await rpc('cs_customer_edit',{p_token:token,p_edit_token:editTok,p_id:c.id,p_patch:{memo},p_before:{memo:c.memo??null}}); toast('ほかの人の変更と合わせて保存しました'); await reloadDetail(); }
    catch(err){ if(err.code==='CS_CONFLICT'){ await reloadDetail(); return csClash(true,c0,{memo},{memo:c.memo??null},{memo}); } if(err.code==='CS_EDIT'){ await uiAlert(err.message); if(!await needEdit()) return; return editForm(true,{memo}); } await fail(err); }
    return; }
  const lb=Object.fromEntries(EF.concat([['is_industry','同業'],['receipt_none','領収書名 不要']])); const d={...dr}; clash.forEach(k=>{ d[k]=c[k]; });
  await uiAlert(`ほかの人が先に「${clash.map(k=>lb[k]||k).join('・')}」を変更していました。そこは最新にして、ほかの欄は書いた内容を残したので、確かめて保存してください`);
  return editForm(memoOnly,d); }
function pickClash(x){ return sheet(`<h3>同じ箇所をほかの人も修正していました</h3><div class="muted" style="font-size:13px">どちらを残しますか？</div>
  <div class="f" style="margin-top:8px">あなた<div class="memo" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px">${esc(x.mine.join('\n'))||'<span class="muted">（削除）</span>'}</div></div>
  <div class="f">ほかの人<div class="memo" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px">${esc(x.theirs.join('\n'))||'<span class="muted">（削除）</span>'}</div></div>
  <div class="btns"><button class="ghost" data-v="x">キャンセル</button><button class="ghost" data-v="b">両方残す</button><button class="ghost" data-v="t">ほかの人</button><button class="edit" data-v="m">あなた</button></div>`,(s,done)=>{ s.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>done(b.dataset.v==='x'?null:b.dataset.v)); }); }
/* メモを行ごとに合わせる（3者マージ）。base＝書き始めた時のメモ、mine＝自分の入力、theirs＝ほかで変わった今のメモ。同じ所を両方が別々に直した時だけ conflicts に入る */
function memoMerge(base,mine,theirs){ const L=s=>s?String(s).replace(/\r/g,'').split('\n'):[]; const b=L(base), m=L(mine), t=L(theirs), J=a=>a.join('\n');
  if(J(m)===J(t)||J(t)===J(b)) return {lines:m,conflicts:[]}; if(J(m)===J(b)) return {lines:t,conflicts:[]};
  const hunks=(a,o)=>{ const n=a.length, k=o.length, d=Array.from({length:n+1},()=>new Int32Array(k+1)); for(let i=n-1;i>=0;i--) for(let j=k-1;j>=0;j--) d[i][j]=a[i]===o[j]?d[i+1][j+1]+1:Math.max(d[i+1][j],d[i][j+1]);
    const h=[]; let i=0,j=0,cur=null; const flush=()=>{ if(cur){ h.push(cur); cur=null; } };
    while(i<n||j<k){ if(i<n&&j<k&&a[i]===o[j]){ flush(); i++; j++; } else if(j<k&&(i>=n||d[i][j+1]>=d[i+1][j])){ cur=cur||{s:i,e:i,lines:[]}; cur.lines.push(o[j]); j++; } else { cur=cur||{s:i,e:i,lines:[]}; cur.e=i+1; i++; } }
    flush(); return h; };
  const all=[...hunks(b,m).map(x=>({...x,w:'m'})),...hunks(b,t).map(x=>({...x,w:'t'}))].sort((x,y)=>x.s-y.s||x.e-y.e);
  const hit=(x,y)=>(x.s===x.e&&y.s===y.e)?x.s===y.s:(x.s===x.e?(x.s>y.s&&x.s<y.e):y.s===y.e?(y.s>x.s&&y.s<x.e):Math.max(x.s,y.s)<Math.min(x.e,y.e));
  const groups=[]; for(const x of all){ const g=groups[groups.length-1]; if(g&&g.some(y=>y.w!==x.w&&hit(x,y))){ g.push(x); g.S=Math.min(g.S,x.s); g.E=Math.max(g.E,x.e); } else { const ng=[x]; ng.S=x.s; ng.E=x.e; groups.push(ng); } }
  const side=(g,w)=>{ const out=[]; let p=g.S; for(const x of g.filter(y=>y.w===w)){ out.push(...b.slice(p,x.s),...x.lines); p=x.e; } out.push(...b.slice(p,g.E)); return out; };
  const out=[], conflicts=[]; let p=0;
  for(const g of groups){ out.push(...b.slice(p,g.S)); const ws=new Set(g.map(x=>x.w));
    if(ws.size===1){ out.push(...side(g,g[0].w)); }
    else { const vm=side(g,'m'), vt=side(g,'t');
      if(J(vm)===J(vt)) out.push(...vm);
      else if(g.S===g.E) out.push(...vt,...vm); // 同じ所に両方が書き足した時は、両方残す（先に入っていた方が上）
      else { conflicts.push({at:out.length,mine:vm,theirs:vt}); } }
    p=Math.max(p,g.E); }
  out.push(...b.slice(p)); return {lines:out,conflicts}; }
/* conflicts の choice（'m'／'t'／'b'）で仕上げる */
function memoMergeDone(r,choices){ const out=[...r.lines]; for(let i=r.conflicts.length-1;i>=0;i--){ const c=r.conflicts[i], ch=choices[i]; out.splice(c.at,0,...(ch==='m'?c.mine:ch==='t'?c.theirs:[...c.theirs,...c.mine])); } return out.join('\n'); }


// 戻るボタン（スマホの戻る操作）で一覧へ
const _open=openDetail; openDetail=async id=>{ try{ history.pushState({d:1},''); }catch(e){} return _open(id); };
$('backBtn').onclick=()=>{ if(history.state&&history.state.d){ history.back(); return; } curId=null; cur=null; show('vList'); renderList(); loadList(); };
window.addEventListener('popstate',()=>{ curId=null; cur=null; show('vList'); renderList(); loadList(); });
/* v1.25：ほかの端末（POS など）での変更を出す。画面に戻った時と、詳細を開いている間は1分ごとに読み直す。入力中・確認の画面が出ている間は読み直さない。失敗しても知らせない */
async function csRefresh(listToo){ if(!token||document.visibilityState!=='visible'||$('modal').classList.contains('on')) return; const a=document.activeElement; if(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName)&&a.id!=='q') return;
  try{ if(!$('vDetail').classList.contains('hide')&&curId){ const id=curId; const d=await rpc('cs_detail',{p_token:token,p_id:id}); if(curId!==id||$('modal').classList.contains('on')) return; if(JSON.stringify(d)!==JSON.stringify(cur)){ cur=d; renderDetail(); } }
    else if(listToo&&!$('vList').classList.contains('hide')){ const l=await rpc('cs_list',{p_token:token})||[]; if($('vList').classList.contains('hide')) return; l.sort(csOrder); if(JSON.stringify(l)!==JSON.stringify(custs)){ custs=l; renderList(); } } }catch(e){ if(e&&e.code==='CS_AUTH'){ logoutLocal(); showLogin(CS_OUT); } } }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ paintEdit(); csRefresh(true); } });
setInterval(()=>csRefresh(true),60000); /* v1.27：一覧の画面でも1分ごとに読み直す（パスワードが変わったらログアウト） */

kReg(EF);
if(EMB){ token=null; editTok=null; editExp=0; embAsk().then(d=>{ if(d&&d.token) start(); else { show('vLogin'); $('loginErr').textContent=d&&d.error||'顧客サイトを開けません'; } }); } else if(token){ keyDb('readwrite',s=>s.put(token,'olive_cs_token')); start(); } else keyDb('readonly',s=>s.get('olive_cs_token')).then(b=>{ if(b){ token=b; LS0.set('olive_cs_token',b); } start(); }); /* 片方の引き出しが空なら、もう片方から戻す */
