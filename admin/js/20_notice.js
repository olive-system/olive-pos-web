// ---------- お知らせ（LINEマイページ・LINE で送る。宛先・予約・添付） ----------
// v0.97・SQL 118：お知らせ（LINEマイページに出す。補助として、過去のお知らせの置き場所。オーナー 2026-10-16）。掲載のたびに「LINE 通知」を選べる。キャストが「確認」を押すと確認済み
// v1.77：修正の時の見出しは「修正」だけ（オーナー 2026-10-30「送信予定の修正ではなく修正でいい」。掲載済みのお知らせの修正も同じ）
// v1.76・SQL 302：宛先（全員／黒服のみ）・店舗（銀座／広島／両店。上の店のプルダウンとは別）・送信時刻（今すぐ／時刻指定・15分ごと）（オーナー 2026-10-30）
//   黒服のみ＝LINE だけ（本文まで送る・マイページには載せない）。時刻指定＝送信予定に入り、15分ごとの cron が送る（全員は指定の時刻に掲載と LINE）。送信前は編集・取消
// v1.90・SQL 335：宛先に「キャストのみ」「個別」、添付（写真・PDF 4つまで）（オーナー 2026-11-03「ファイルや写真も添付」「指定した時間に必要な人へ一斉送信」）
//   全員＝キャスト（マイページに掲載＋LINE）と黒服（LINE）。キャストのみ＝今までの全員。個別＝選んだキャストのマイページに掲載＋LINE・選んだ黒服に LINE
//   添付は送る時に置き場「notice-files」へ上げる（店のid/番号.jpg|pdf）。写真は 1600px の JPEG に縮める。お知らせの削除・予約の取消・添付を外した保存のあと、使われなくなったものを消す
let ntEdit=null, ntSched=null, ntFiles=[], ntKey='', ntPick=new Set();
const NT_STORE={ginza:'銀座',hiroshima:'広島'}, ntStoreName=s=>NT_STORE[s?.code]||s?.name||'';
const ntWhen=a=>{ const d=new Date(new Date(a).getTime()+9*3600e3); return `${d.getUTCMonth()+1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`; };
const NT_TO={all:'全員',cast:'キャストのみ',hall:'黒服のみ',pick:'個別'};
const ntUrl=p=>sb.storage.from('notice-files').getPublicUrl(p).data.publicUrl;
// 新しく足したものを上げて、[{p,n,t}] を返す（上げたものは up に入れる。失敗した時に消すため）
async function ntUpload(folder,up){ const out=[];
  for(const f of ntFiles){ if(f.p){ out.push({p:f.p,n:f.n,t:f.t}); continue; }
    const p=`${folder}/${crypto.randomUUID()}.${f.t==='pdf'?'pdf':'jpg'}`, body=f.t==='pdf'?f.file:await shrinkJpeg(f.file);
    const r=await sb.storage.from('notice-files').upload(p,body,{contentType:f.t==='pdf'?'application/pdf':'image/jpeg',upsert:false}); if(r.error) throw r.error;
    up.push(p); out.push({p,n:f.n,t:f.t}); }
  return out; }
const ntRemove=async ps=>{ ps=[...new Set(ps)].filter(Boolean); if(ps.length) try{ await sb.storage.from('notice-files').remove(ps); }catch(e){} };
const ntAttachView=a=>(a||[]).length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">${[...a].sort((x,y)=>(x.t==='pdf')-(y.t==='pdf')).map(f=>f.t==='pdf'?`<a href="${esc(ntUrl(f.p))}" target="_blank" rel="noopener" class="muted" style="font-size:13px;border:1px solid var(--line);border-radius:8px;padding:6px 10px;text-decoration:none">PDF　${esc(f.n)}</a>`
  :`<a href="${esc(ntUrl(f.p))}" target="_blank" rel="noopener"><img src="${esc(ntUrl(f.p))}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;display:block"></a>`).join('')}</div>`:'';
const ntCount=a=>{ const i=a.filter(f=>f.t!=='pdf').length, p=a.length-i; return [i?`写真 ${i}`:'',p?`PDF ${p}`:''].filter(Boolean).join('・'); };
PAGES.notice=async()=>{ const st=storeId, ed=perm('notice')==='edit';
  const head=`<h1>お知らせ <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const [r,rs]=await Promise.all([sb.rpc('admin_notice_list',{p_store:st}),sb.rpc('admin_notice_sched_list',{p_store:st})]); if(page!=='notice'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(r.error.message)}</div>`; return; }
  const L=r.data||[], E=ntEdit&&L.find(x=>x.id===ntEdit)||null; if(!E) ntEdit=null;
  const SL=rs.error?[]:(rs.data||[]), SE=ntSched&&SL.find(x=>x.id===ntSched)||null; if(!SE) ntSched=null;
  const key=E?'e'+E.id:SE?'s'+SE.id:'n';
  if(ntKey!==key){ ntKey=key; ntFiles=((E||SE)?.attach||[]).map(f=>({...f})); ntPick=new Set(SE?.staff||[]); }
  const day=a=>{ const d=new Date(new Date(a).getTime()+9*3600e3); return `${d.getUTCMonth()+1}/${d.getUTCDate()}`; };
  const S=stores(), sOpt=[...S.map(s=>[s.id,ntStoreName(s)]),...(S.length>1?[['all','両店']]:[])];
  const sv0=SE?(SE.stores.length>1?'all':SE.stores[0]):st;
  // 送信時刻：今日から60日・15分ごと（はじめは15分より先の15分の区切り）
  const now=Date.now(), first=new Date(Math.ceil((now+15*60e3)/(15*60e3))*15*60e3), j0=new Date(first.getTime()+9*3600e3);
  const sa=SE?new Date(new Date(SE.send_at).getTime()+9*3600e3):j0, ymd=d=>d.toISOString().slice(0,10), hm=d=>d.toISOString().slice(11,16);
  const dOpts=Array.from({length:60},(_,i)=>{ const d=new Date(now+9*3600e3+i*864e5); return [ymd(d),`${d.getUTCMonth()+1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）`]; });
  const tOpts=Array.from({length:96},(_,i)=>`${String(Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`);
  const sel=(id,opts,v)=>`<select id="${id}" style="width:auto">${opts.map(([k,l])=>`<option value="${esc(k)}" ${k===v?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  const area=v=>`<textarea id="ntB" rows="6" maxlength="2000" style="width:100%;font:inherit;font-size:16px;line-height:1.6;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">${esc(v||'')}</textarea>`;
  const row=(l,h,id)=>`<div ${id?`id="${id}"`:''} style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap"><span class="muted" style="font-size:13px;width:5em">${l}</span>${h}</div>`;
  const attRow=`<div style="display:flex;gap:10px;align-items:flex-start;margin-top:8px"><span class="muted" style="font-size:13px;width:5em;flex:none;padding-top:6px">添付</span><div style="flex:1;min-width:0"><div id="ntA" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"></div><div class="muted" style="font-size:12px;margin-top:4px">写真・PDF 4つまで</div><input id="ntF" type="file" accept="image/*,application/pdf" multiple style="display:none"></div></div>`;
  const form=!ed?'':E?`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:8px">修正</div>
      <label>タイトル<input id="ntT" maxlength="60" value="${esc(E.title)}"></label>
      <label style="display:block;margin-top:8px">本文${area(E.body)}</label>
      ${attRow}
      <div class="fend" style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="ntP" style="width:auto">LINE 通知</label><span style="flex:1"></span><button class="ghost sm" id="ntX">キャンセル</button><button class="primary sm" id="ntS">保存</button></div></div>`
    :`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:4px" id="ntLead"></div>
      ${row('宛先',sel('ntTo',Object.entries(NT_TO),SE?.target||'all'))}
      ${row('店舗',sel('ntSt',sOpt,sv0))}
      <div id="ntPk" style="display:none;gap:10px;align-items:flex-start;margin-top:8px"><span class="muted" style="font-size:13px;width:5em;flex:none;padding-top:6px">対象</span><div id="ntPkL" style="flex:1;min-width:0"></div></div>
      <label style="margin-top:8px">タイトル<input id="ntT" maxlength="60" value="${esc(SE?.title||'')}"></label>
      <label style="display:block;margin-top:8px">本文${area(SE?.body)}</label>
      ${attRow}
      ${row('送信時刻',sel('ntW',SE?[['at','時刻指定']]:[['now','今すぐ'],['at','時刻指定']],SE?'at':'now')+`<span id="ntAt" style="display:${SE?'inline-flex':'none'};gap:6px">${sel('ntD',dOpts,ymd(sa))}${sel('ntH',tOpts.map(t=>[t,t]),hm(sa))}</span>`)}
      <div class="fend" style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><label id="ntPl" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="ntP" ${!SE||SE.push?'checked':''} style="width:auto">LINE 通知</label><span style="flex:1"></span>${SE?'<button class="ghost sm" id="ntX">キャンセル</button>':''}<button class="primary sm" id="ntS"></button></div></div>`;
  const stLbl=a=>a.length>1?'両店':ntStoreName(S.find(s=>s.id===a[0])||{});
  const sched=SL.length?`<div class="card"><b>送信予定</b>${SL.map(x=>`<div style="display:flex;gap:10px;align-items:center;border-top:1px solid var(--line);padding:6px 0;margin-top:6px;flex-wrap:wrap">
      <span style="width:9.5em;white-space:nowrap">${ntWhen(x.send_at)}</span><span style="width:6em;white-space:nowrap">${NT_TO[x.target]||''}</span><span style="width:2.5em;white-space:nowrap">${esc(stLbl(x.stores))}</span>
      <b style="flex:1;min-width:8em">${esc(x.title)}${(x.attach||[]).length?` <small class="muted" style="font-weight:400">${ntCount(x.attach)}</small>`:''}${x.target==='pick'?`<br><small class="muted" style="font-weight:400">${x.names.map(esc).join('・')}</small>`:''}</b>${ed?`<button class="ghost sm" data-se="${x.id}">編集</button><button class="ghost sm" data-sc="${x.id}">取消</button>`:''}</div>`).join('')}</div>`:'';
  const list=L.map(x=>`<div class="card"><div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><b>${esc(x.title)}</b> <small class="muted">${day(x.at)} 掲載${x.pick?'・個別':''}${x.updated_at?'（修正済）':''}${x.pushed?`・LINE 通知 ${x.pushed}人`:''}</small></div>
      ${ed?`<button class="ghost sm" data-ne="${x.id}">編集</button><button class="xb" data-nd="${x.id}" aria-label="削除">×</button>`:''}</div>
    ${x.body?`<div style="white-space:pre-wrap;margin-top:6px;font-size:14px;line-height:1.6">${esc(x.body)}</div>`:''}${ntAttachView(x.attach)}
    <div class="muted" style="font-size:13px;margin-top:8px">確認済 ${x.read}人／未確認 ${x.unread.length}人${x.unread.length?`<br>未確認：${x.unread.map(esc).join('・')}`:''}</div></div>`).join('')||'<div class="card muted">お知らせはありません</div>';
  $('main').innerHTML=head+form+sched+list;
  if(!ed) return;
  if($('ntX')) $('ntX').onclick=()=>{ ntEdit=null; ntSched=null; PAGES.notice(); };
  $('main').querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>{ ntEdit=b.dataset.ne; ntSched=null; PAGES.notice(); });
  $('main').querySelectorAll('[data-se]').forEach(b=>b.onclick=()=>{ ntSched=b.dataset.se; ntEdit=null; PAGES.notice(); });
  $('main').querySelectorAll('[data-nd]').forEach(b=>b.onclick=guard(b,async()=>{ const x=L.find(z=>z.id===b.dataset.nd); if(!await uiConfirm(`「${x.title}」を削除しますか？${(x.attach||[]).length?'\n添付も削除します':''}`,'削除','danger')) return;
    const q=await rpc('admin_notice_delete',{p_store:st,p_id:x.id}); if(!q.ok) return; await ntRemove((x.attach||[]).map(f=>f.p)); toast('削除しました'); if(ntEdit===x.id) ntEdit=null; PAGES.notice(); }));
  $('main').querySelectorAll('[data-sc]').forEach(b=>b.onclick=guard(b,async()=>{ const x=SL.find(z=>z.id===b.dataset.sc); if(!await uiConfirm(`「${x.title}」の予約を取り消しますか？\n送信時刻：${ntWhen(x.send_at)}`,'取消','danger')) return;
    const q=await rpc('admin_notice_sched_cancel',{p_id:x.id}); if(!q.ok) return; await ntRemove((x.attach||[]).map(f=>f.p)); toast('取り消しました'); if(ntSched===x.id) ntSched=null; PAGES.notice(); }));
  // 添付：並べる・［×］で外す・［追加］で選ぶ
  const paintA=()=>{ $('ntA').innerHTML=ntFiles.map((f,i)=>`<div style="position:relative">${f.t==='pdf'?`<div style="width:96px;height:64px;border:1px solid var(--line);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;color:var(--pri)">PDF<small class="muted" style="font-weight:400;font-size:10px;max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.n)}</small></div>`
      :`<img src="${esc(f.p?ntUrl(f.p):f.url)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;display:block">`}<button class="xb img${f.t==='pdf'?' lt':''}" data-ax="${i}" aria-label="削除">×</button></div>`).join('')
      +(ntFiles.length<4?'<button class="ghost sm" id="ntAdd">追加</button>':'');
    $('ntA').querySelectorAll('[data-ax]').forEach(b=>b.onclick=()=>{ ntFiles.splice(+b.dataset.ax,1); paintA(); });
    if($('ntAdd')) $('ntAdd').onclick=()=>{ $('ntF').value=''; $('ntF').click(); }; };
  $('ntF').onchange=async()=>{ for(const file of [...$('ntF').files]){ if(ntFiles.length>=4){ await uiAlert('添付は4つまでです'); break; }
      const pdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
      if(!pdf&&!/^image\//.test(file.type)){ await uiAlert('写真か PDF を選択してください'); continue; }
      if(pdf&&file.size>20*1024*1024){ await uiAlert('PDF は20MBまでです'); continue; }
      ntFiles.push({file,n:file.name.slice(0,80),t:pdf?'pdf':'img',url:pdf?'':URL.createObjectURL(file)}); }
    paintA(); };
  paintA();
  const gone=()=>{ const keep=new Set(ntFiles.map(f=>f.p).filter(Boolean)); return ((E||SE)?.attach||[]).map(f=>f.p).filter(p=>!keep.has(p)); };
  if(E){ $('ntS').onclick=guard($('ntS'),async()=>{ const t=$('ntT').value.trim(), b=$('ntB').value.trim(), push=$('ntP').checked; if(!t){ await uiAlert('タイトルを入力してください'); return; }
      if(!await uiConfirm(`「${t}」を保存しますか？${push?`\n${E.pick?'選んだキャスト':'連携したキャスト全員'}に LINE で通知します`:''}`)) return;
      const up=[]; let a; try{ a=await ntUpload(st,up); }catch(e){ await ntRemove(up); await uiAlert('添付をアップロードできません：'+(e.message||e)); return; }
      const old=gone(), x=await rpc('admin_notice_save',{p_store:st,p_id:E.id,p_title:t,p_body:b,p_push:push,p_attach:a}); if(!x.ok){ await ntRemove(up); return; }
      await ntRemove(old); toast(`保存しました${push?`（LINE 通知 ${x.data.pushed}人）`:''}`); ntEdit=null; ntKey=''; PAGES.notice(); });
    return; }
  // 個別の対象：店の在籍のキャスト・黒服（LINE 未連携は選べない）
  let PK=null, pkStore=null;
  const paintPk=async()=>{ const sv=$('ntSt').value; if(sv==='all'){ $('ntPkL').innerHTML=''; return; }
    if(pkStore!==sv){ pkStore=sv; $('ntPkL').innerHTML='<span class="muted" style="font-size:13px">読み込み中…</span>'; const q=await sb.rpc('admin_notice_staff',{p_store:sv}); if(pkStore!==sv) return;
      if(q.error){ $('ntPkL').innerHTML=`<span class="err" style="font-size:13px">${esc(q.error.message)}</span>`; return; } PK=q.data||[]; }
    const ids=new Set(PK.map(p=>p.id)); [...ntPick].forEach(id=>{ if(!ids.has(id)) ntPick.delete(id); });
    const grp=(k,l)=>{ const g=PK.filter(p=>p.kind===k); return g.length?`<div class="muted" style="font-size:12px;margin:2px 0 4px">${l}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${g.map(p=>`<label style="display:inline-flex;gap:5px;align-items:center;margin:0;border:1px solid ${ntPick.has(p.id)?'var(--pri)':'var(--line)'};border-radius:8px;padding:4px 9px;${p.line?'':'opacity:.5'}"><input type="checkbox" data-pk="${p.id}" ${ntPick.has(p.id)?'checked':''} ${p.line?'':'disabled'} style="width:auto;margin:0">${esc(p.name)}${p.line?'':' <small class="muted">未連携</small>'}</label>`).join('')}</div>`:''; };
    $('ntPkL').innerHTML=grp('cast','キャスト')+grp('hall','黒服')+`<div class="muted" style="font-size:13px">${ntPick.size}人</div>`;
    $('ntPkL').querySelectorAll('[data-pk]').forEach(c=>c.onchange=()=>{ c.checked?ntPick.add(c.dataset.pk):ntPick.delete(c.dataset.pk); paintPk(); }); };
  const LEAD={all:'キャストは LINEマイページに掲載、黒服は LINE に送信します',cast:'LINEマイページの「お知らせ」に掲載します',hall:'黒服の LINE に送信します（マイページには掲載しません）',pick:'選んだキャストは LINEマイページに掲載、黒服は LINE に送信します'};
  const sync=()=>{ const to=$('ntTo').value, at=$('ntW').value==='at', bothOpt=$('ntSt').querySelector('option[value="all"]');
    if(bothOpt){ bothOpt.disabled=to==='pick'; if(to==='pick'&&$('ntSt').value==='all') $('ntSt').value=st; }
    $('ntAt').style.display=at?'inline-flex':'none'; $('ntPl').style.display=to==='hall'||to==='pick'?'none':'flex'; $('ntPk').style.display=to==='pick'?'flex':'none';
    $('ntS').textContent=SE?'保存':at?'予約':to==='hall'||to==='pick'?'送信':'掲載'; $('ntLead').textContent=SE?'修正':LEAD[to];
    if(to==='pick') paintPk(); };
  ['ntTo','ntW','ntSt'].forEach(k=>$(k).onchange=sync); sync();
  $('ntS').onclick=guard($('ntS'),async()=>{ const t=$('ntT').value.trim(), b=$('ntB').value.trim(), to=$('ntTo').value, at=$('ntW').value==='at', push=to==='hall'||to==='pick'||$('ntP').checked;
    if(!t){ await uiAlert('タイトルを入力してください'); return; }
    if(to==='pick'&&!ntPick.size){ await uiAlert('対象を選択してください'); return; }
    const sv=$('ntSt').value, ids=sv==='all'?S.map(s=>s.id):[sv], sl=sv==='all'?'両店':ntStoreName(S.find(s=>s.id===sv)), whenIso=at?`${$('ntD').value}T${$('ntH').value}:00+09:00`:null;
    if(at&&new Date(whenIso).getTime()<=Date.now()){ await uiAlert('過去の時刻は指定できません'); return; }
    const lineMsg={all:push?'連携したキャスト・黒服全員に LINE で送信します':'',cast:push?'連携したキャスト全員に LINE で通知します':'',hall:'連携した黒服全員に LINE で送信します',pick:`選んだ ${ntPick.size}人に LINE で送信します`}[to];
    const att=ntFiles.length?`\n添付：${ntCount(ntFiles)}`:'';
    const msg=at?`「${t}」を${SE?'保存':'予約'}しますか？\n送信時刻：${ntWhen(whenIso)}\n宛先：${NT_TO[to]}\n店舗：${sl}${att}${lineMsg?'\n'+lineMsg:''}`
      :`「${t}」を${to==='hall'||to==='pick'?'送信':'掲載'}しますか？\n宛先：${NT_TO[to]}\n店舗：${sl}${att}${lineMsg?'\n'+lineMsg:''}`;
    if(!await uiConfirm(msg)) return;
    const up=[]; let a; try{ a=await ntUpload(ids[0],up); }catch(e){ await ntRemove(up); await uiAlert('添付をアップロードできません：'+(e.message||e)); return; }
    const old=gone(), x=await rpc('admin_notice_send',{p_target:to,p_stores:ids,p_title:t,p_body:b,p_push:push,p_send_at:whenIso,p_sched:SE?SE.id:null,p_attach:a,p_staff:to==='pick'?[...ntPick]:null});
    if(!x.ok){ await ntRemove(up); return; }
    await ntRemove(old);
    toast(at?(SE?'保存しました':'予約しました'):`${to==='hall'||to==='pick'?'送信':'掲載'}しました${push?`（LINE ${x.data.pushed}人）`:''}`); ntSched=null; ntKey=''; PAGES.notice(); }); };
