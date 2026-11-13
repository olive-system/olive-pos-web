// ---------- 打刻一覧 日ごとの打刻と写真（見るだけ。打刻の修正は POS） ----------
let pcDate=null;
const PC_TYPES=[['douhan','同伴'],['clock_in','出勤'],['after','アフター'],['clock_out','退勤']];
PAGES.punches=async()=>{ const st=storeId; if(!pcDate) pcDate=businessDate(); const d=pcDate;
  const head=`<h1>打刻一覧 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  <div class="row" style="margin-bottom:12px"><button class="ghost" id="pcPrev">◀</button><input type="date" id="pcDate" value="${d}" style="width:auto"><button class="ghost" id="pcNext">▶</button><button class="ghost" id="pcToday">今日</button></div>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const wire=()=>{ $('pcDate').onchange=()=>{ if($('pcDate').value){ pcDate=$('pcDate').value; PAGES.punches(); } }; $('pcPrev').onclick=()=>{ pcDate=dayAdd(d,-1); PAGES.punches(); }; $('pcNext').onclick=()=>{ pcDate=dayAdd(d,1); PAGES.punches(); }; $('pcToday').onclick=()=>{ pcDate=businessDate(); PAGES.punches(); }; };
  const [ev,sf,cx,cp]=await Promise.all([ sb.from('attendance_events').select('id,staff_id,event_type,event_at,rounded_at,photo_path,is_corrected,orig_at,fixed_by,fixed_at').eq('store_id',st).eq('business_date',d).order('event_at'),
    sb.from('staff').select('id,display_name,kind,sort_order').eq('store_id',st).order('sort_order').order('id'),
    /* POS の「退勤を取り消す」は打刻の行を写真ごと消すので、取り消した退勤は操作ログから出す */
    sb.from('pos_audit_log').select('detail,created_at').eq('store_id',st).eq('action','退勤の取消').gte('created_at',d+'T08:00:00+09:00').lt('created_at',dayAdd(d,1)+'T08:00:00+09:00').order('created_at'),
    /* 取消の前の写真の場所。表が無い時（SQL の前）は写真なしで出す */
    sb.from('attendance_cancels').select('staff_id,photo_path,cancelled_at').eq('store_id',st).eq('business_date',d) ]);
  if(page!=='punches'||storeId!==st||pcDate!==d) return;
  const er=ev.error||sf.error; if(er){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(er.message)}</div>`; wire(); return; }
  const by={}; (ev.data||[]).forEach(e=>{ const o=by[e.staff_id]||(by[e.staff_id]={}); o[e.event_type]=e; });
  const cxBy={}; (cx.data||[]).forEach(c=>{ const p=(sf.data||[]).find(x=>x.display_name===c.detail?.name); if(!p) return; c.photo=(cp.data||[]).find(r=>r.staff_id===p.id&&Math.abs(new Date(r.cancelled_at)-new Date(c.created_at))<120000)?.photo_path||null; (cxBy[p.id]||(cxBy[p.id]=[])).push(c); });
  const people=(sf.data||[]).filter(x=>by[x.id]||cxBy[x.id]); people.forEach(p=>{ by[p.id]=by[p.id]||{}; });
  const paths=[...(ev.data||[]).map(e=>e.photo_path),...(cx.data||[]).map(c=>c.photo)].filter(Boolean); let urls={};
  if(paths.length){ const r=await sb.storage.from('selfies').createSignedUrls(paths,3600); (r.data||[]).forEach(x=>{ if(x.signedUrl) urls[x.path]=x.signedUrl; }); if(page!=='punches'||pcDate!==d) return; }
  const hm=t=>{ const x=new Date(t); return `${x.getHours()}:${String(x.getMinutes()).padStart(2,'0')}`; }; const md=t=>{ const x=new Date(t); return `${x.getMonth()+1}/${x.getDate()} ${hm(t)}`; };
  /* 大きい時刻は報酬に使う丸めた時刻（POS と同じ）。打刻の時刻（最初の打刻）は半分ほどの大きさで横に。手で修正した打刻は矢印にせず、下の行に「修正 時刻 操作者 修正日時」（オーナー「矢印だと手で修正したみたいになる」）（オーナー「管理サイトとポスがリンクしてない」「誰がいつ変更したのかがわからない」「実際の打刻時間は半分ぐらいの大きさで」） */
  const ed=perm('punches')==='edit'; /* 打刻一覧で修正・追加（表示設定の「編集」の人） */
  /* 出勤を押し忘れて退勤だけの人は、出勤の所に赤で「出勤なし」（黒服が「追加」で時刻を入れる） */
  /* 修正した打刻は「最初の打刻→今の時刻」（オーナー）。最初の打刻が無い修正（今までの POS の修正・追加）は「修正済」のまま */
  /* 詰めた形（オーナー「もう少し無駄なく」）。写真は小さく時刻の横・「追加」「修正」は小さい文字 */
  const cxl=(pid,k)=>k!=='clock_out'||!cxBy[pid]?'':cxBy[pid].map(c=>`<span style="color:var(--warn)">${c.photo&&urls[c.photo]?`<img class="pc-x" src="${esc(urls[c.photo])}" data-big="${esc(urls[c.photo])}" alt="">`:''}取消 ${esc(String(c.detail.out||'').replace(/^0(?=\d)/,''))} ${esc(c.detail.by||'')} ${md(c.created_at)}</span>`).join('<br>');
  const cell=(e,pid,k)=>!e?((k==='clock_in'&&(by[pid]?.clock_out||by[pid]?.after)&&!by[pid]?.douhan? /* アフターも退勤の扱い（オーナー） */'<b style="color:var(--warn);font-size:13px;margin-right:6px">出勤なし</b>':'')+(ed?`<button class="pc-l" data-pcadd="${pid}" data-k="${k}">追加</button>`:'<span class="muted">—</span>')+(cxl(pid,k)?`<small class="pc-s" style="margin-left:6px">${cxl(pid,k)}</small>`:'')):`<div class="pc-c">${e.photo_path?(urls[e.photo_path]?`<img src="${esc(urls[e.photo_path])}" data-big="${esc(urls[e.photo_path])}" alt="">`:'<small class="muted">写真を出せません</small>'):'<small class="muted">写真なし</small>'}<span class="pc-t"${e.is_corrected?' style="color:var(--warn)"':''}>${hm(e.rounded_at||e.event_at)}</span>`+
    `<small class="pc-s">${hm(e.orig_at||e.event_at)}${e.orig_at?`<br>修正 ${hm(e.event_at)}${e.fixed_at?` ${esc(e.fixed_by||'')} ${md(e.fixed_at)}`:''}`:''}${cxl(pid,k)?'<br>'+cxl(pid,k):''}</small>${e.is_corrected&&!e.orig_at?'<small class="badge warnb">修正済</small>':''}${ed?`<button class="pc-l" data-pcfix="${e.id}" data-k="${e.event_type}" data-t="${hm(e.event_at)}" data-n="${pid}">修正</button>`:''}</div>`;
  $('main').innerHTML=head+(people.length?`<div class="cs-w"><table class="reg pc"><tr><th class="nm">名前</th>${PC_TYPES.map(([,n])=>`<th>${n}</th>`).join('')}</tr>
    ${people.map(p=>`<tr><td class="nm">${esc(p.display_name)}${p.kind==='hall'?' <small class="muted">黒服</small>':''}</td>${PC_TYPES.map(([k])=>`<td>${cell(by[p.id][k],p.id,k)}</td>`).join('')}</tr>`).join('')}</table></div>`
    :'<div class="card muted">この日の打刻はありません</div>')+`<div class="muted" style="font-size:13px;margin-top:10px">写真を押すと大きく出ます</div>`;
  wire();
  const nameOf=id=>(sf.data||[]).find(x=>x.id===id)?.display_name||'', typeOf=k=>(PC_TYPES.find(x=>x[0]===k)||[])[1]||'';
  const askTime=(title,def)=>new Promise(res=>{ const m=mkModal(null,`<h2 style="margin:0">${esc(title)}</h2><label>時刻<input type="time" id="pcT" value="${esc(def||'')}"></label><div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
    m.querySelector('[data-k=no]').onclick=()=>{ m.remove(); res(null); }; m.querySelector('[data-k=ok]').onclick=()=>{ const v=m.querySelector('#pcT').value; m.remove(); res(v||''); }; });
  const at=t=>`${t<'08:00'?dayAdd(d,1):d}T${t}:00+09:00`; /* 朝8時より前は次の日の時刻 */
  $('main').querySelectorAll('[data-pcfix]').forEach(b=>b.onclick=guard(b,async()=>{ const t=await askTime(`${nameOf(b.dataset.n)}　${typeOf(b.dataset.k)}の修正`,b.dataset.t.padStart(5,'0')); if(t===null) return; if(!t){ await uiAlert('時刻を入力してください'); return; }
    const z=await rpc('admin_punch_fix',{p_event:b.dataset.pcfix,p_at:at(t),p_reason:null}); if(!z.ok) return; toast('修正しました'); PAGES.punches(); }));
  $('main').querySelectorAll('[data-pcadd]').forEach(b=>b.onclick=guard(b,async()=>{ const t=await askTime(`${nameOf(b.dataset.pcadd)}　${typeOf(b.dataset.k)}の追加`,''); if(t===null) return; if(!t){ await uiAlert('時刻を入力してください'); return; }
    const z=await rpc('admin_punch_add',{p_store:st,p_staff:b.dataset.pcadd,p_type:b.dataset.k,p_date:d,p_at:at(t)}); if(!z.ok) return; toast('追加しました'); PAGES.punches(); }));
  $('main').querySelectorAll('[data-big]').forEach(im=>im.onclick=()=>{ const m=mkModal(null,`<button class="xb dx" data-k="ok" aria-label="閉じる">×</button><img src="${esc(im.dataset.big)}" alt="" style="width:100%;border-radius:10px">`); m.querySelector('[data-k=ok]').onclick=()=>m.remove(); }); };

