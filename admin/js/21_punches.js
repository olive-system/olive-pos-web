// ---------- 打刻一覧 v0.23・SQL 063：日ごとの打刻と写真（見るだけ。打刻の修正は POS） ----------
let pcDate=null;
const PC_TYPES=[['douhan','同伴'],['clock_in','出勤'],['after','アフター'],['clock_out','退勤']];
PAGES.punches=async()=>{ const st=storeId; if(!pcDate) pcDate=businessDate(); const d=pcDate;
  const head=`<h1>打刻一覧 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  <div class="row" style="margin-bottom:12px"><button class="ghost" id="pcPrev">◀</button><input type="date" id="pcDate" value="${d}" style="width:auto"><button class="ghost" id="pcNext">▶</button><button class="ghost" id="pcToday">今日</button></div>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const wire=()=>{ $('pcDate').onchange=()=>{ if($('pcDate').value){ pcDate=$('pcDate').value; PAGES.punches(); } }; $('pcPrev').onclick=()=>{ pcDate=dayAdd(d,-1); PAGES.punches(); }; $('pcNext').onclick=()=>{ pcDate=dayAdd(d,1); PAGES.punches(); }; $('pcToday').onclick=()=>{ pcDate=businessDate(); PAGES.punches(); }; };
  const [ev,sf]=await Promise.all([ sb.from('attendance_events').select('id,staff_id,event_type,event_at,photo_path,is_corrected').eq('store_id',st).eq('business_date',d).order('event_at'),
    sb.from('staff').select('id,display_name,kind,sort_order').eq('store_id',st).order('sort_order').order('id') ]);
  if(page!=='punches'||storeId!==st||pcDate!==d) return;
  const er=ev.error||sf.error; if(er){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(er.message)}</div>`; wire(); return; }
  const by={}; (ev.data||[]).forEach(e=>{ const o=by[e.staff_id]||(by[e.staff_id]={}); o[e.event_type]=e; });
  const people=(sf.data||[]).filter(x=>by[x.id]);
  const paths=(ev.data||[]).map(e=>e.photo_path).filter(Boolean); let urls={};
  if(paths.length){ const r=await sb.storage.from('selfies').createSignedUrls(paths,3600); (r.data||[]).forEach(x=>{ if(x.signedUrl) urls[x.path]=x.signedUrl; }); if(page!=='punches'||pcDate!==d) return; }
  const hm=t=>{ const x=new Date(t); return `${x.getHours()}:${String(x.getMinutes()).padStart(2,'0')}`; };
  const ed=perm('punches')==='edit'; /* v0.89・SQL 093：打刻一覧で修正・追加（表示設定の「編集」の人） */
  const cell=(e,pid,k)=>!e?(ed?`<button class="ghost sm" data-pcadd="${pid}" data-k="${k}">追加</button>`:'<span class="muted">—</span>'):`<div class="pc-c"><span>${hm(e.event_at)}${e.is_corrected?' <small class="badge warnb">修正済</small>':''}${ed?` <button class="ghost sm" data-pcfix="${e.id}" data-k="${e.event_type}" data-t="${hm(e.event_at)}" data-n="${pid}">修正</button>`:''}</span>${e.photo_path?(urls[e.photo_path]?`<img src="${esc(urls[e.photo_path])}" data-big="${esc(urls[e.photo_path])}" alt="">`:'<small class="muted">写真を出せません</small>'):'<small class="muted">写真なし</small>'}</div>`;
  $('main').innerHTML=head+(people.length?`<div class="cs-w"><table class="reg pc"><tr><th class="nm">名前</th>${PC_TYPES.map(([,n])=>`<th>${n}</th>`).join('')}</tr>
    ${people.map(p=>`<tr><td class="nm">${esc(p.display_name)}${p.kind==='hall'?' <small class="muted">黒服</small>':''}</td>${PC_TYPES.map(([k])=>`<td>${cell(by[p.id][k],p.id,k)}</td>`).join('')}</tr>`).join('')}</table></div>`
    :'<div class="card muted">この日の打刻はありません</div>')+`<div class="muted" style="font-size:13px;margin-top:10px">写真を押すと大きく出ます</div>`;
  wire();
  const nameOf=id=>(sf.data||[]).find(x=>x.id===id)?.display_name||'', typeOf=k=>(PC_TYPES.find(x=>x[0]===k)||[])[1]||'';
  const askTime=(title,def)=>new Promise(res=>{ const m=modal(`<h2 style="margin:0">${esc(title)}</h2><label>時刻<input type="time" id="pcT" value="${esc(def||'')}"></label><div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
    m.querySelector('[data-k=no]').onclick=()=>{ m.remove(); res(null); }; m.querySelector('[data-k=ok]').onclick=()=>{ const v=m.querySelector('#pcT').value; m.remove(); res(v||''); }; });
  const at=t=>`${t<'08:00'?dayAdd(d,1):d}T${t}:00+09:00`; /* 朝8時より前は次の日の時刻 */
  $('main').querySelectorAll('[data-pcfix]').forEach(b=>b.onclick=guard(b,async()=>{ const t=await askTime(`${nameOf(b.dataset.n)}　${typeOf(b.dataset.k)}の修正`,b.dataset.t.padStart(5,'0')); if(t===null) return; if(!t){ await uiAlert('時刻を入力してください'); return; }
    const z=await rpc('admin_punch_fix',{p_event:b.dataset.pcfix,p_at:at(t),p_reason:null}); if(!z.ok) return; toast('修正しました'); PAGES.punches(); }));
  $('main').querySelectorAll('[data-pcadd]').forEach(b=>b.onclick=guard(b,async()=>{ const t=await askTime(`${nameOf(b.dataset.pcadd)}　${typeOf(b.dataset.k)}の追加`,''); if(t===null) return; if(!t){ await uiAlert('時刻を入力してください'); return; }
    const z=await rpc('admin_punch_add',{p_store:st,p_staff:b.dataset.pcadd,p_type:b.dataset.k,p_date:d,p_at:at(t)}); if(!z.ok) return; toast('追加しました'); PAGES.punches(); }));
  $('main').querySelectorAll('[data-big]').forEach(im=>im.onclick=()=>{ const m=modal(`<img src="${esc(im.dataset.big)}" alt="" style="width:100%;border-radius:10px"><div class="bar"><button class="primary" data-k="ok">閉じる</button></div>`); m.querySelector('[data-k=ok]').onclick=()=>m.remove(); }); };

