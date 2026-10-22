// ---------- 開店作業 v1.45・SQL 194（オーナー 2026-10-22「毎日同じ作業の開店作業と、TODO とを一緒にしないで」「日報メールにつける写真、つけるつけないは管理サイトで決めたい」） ----------
// 上＝きょうの記録（だれが・何時・写真）、下＝項目（毎日、黒服マイページの「開店作業」に出る）と、日報メールに写真を載せるか
// v1.47：項目は一覧の行でそのまま直す（名前・写真 要る｜要らない・並べ替え・削除。オーナー 2026-10-23「いちいち窓をつけてる必要なくない？」）
let openDay=null;
PAGES.set_open=async()=>{ const st=storeId, ed=perm('set_open')==='edit'; if(!openDay) openDay=businessDate(); const d=openDay;
  const head=`<h1>開店作業 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_open_tasks',{p_store:st,p_day:d}); if(page!=='set_open'||storeId!==st||openDay!==d) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_open_tasks/.test(r.error.message)?'SQL 194 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data||{}, I=D.items||[], T=D.day||[], hm=t=>t?new Date(t).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}):'';
  const wd=x=>['日','月','火','水','木','金','土'][new Date(x+'T00:00:00+09:00').getDay()], nd=T.filter(x=>x.status==='done').length;
  $('main').innerHTML=head+`<div class="card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button class="ghost sm" id="opPrev">◀</button><input type="date" id="opDate" value="${d}" style="width:auto"><button class="ghost sm" id="opNext">▶</button><button class="ghost sm" id="opToday">今日</button>
      <span class="muted" style="font-size:13px">${Number(d.slice(5,7))}/${Number(d.slice(8))}（${wd(d)}）　済 ${nd}／${T.length}</span></div>
    ${T.map(x=>`<div style="display:flex;gap:10px;align-items:center;border-top:1px solid var(--line);padding:8px 0;font-size:14px"><b style="min-width:2em;color:${x.status==='done'?'var(--pri)':'var(--warn)'}">${x.status==='done'?'済':'未'}</b><span style="flex:1">${esc(x.name)}</span>
      ${x.status==='done'?`<span class="muted" style="white-space:nowrap">${esc(x.by||'')} ${hm(x.at)}</span>`:''}${(x.photos||[]).map(u=>`<img src="${esc(u)}" data-big="${esc(u)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--line);cursor:pointer">`).join('')}</div>`).join('')||'<div class="muted" style="margin-top:8px">項目がありません</div>'}</div>
  <div class="card"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>日報メールに写真を載せる</b>
      <span class="seg" id="opMail">${[[true,'載せる'],[false,'載せない']].map(([v,n])=>`<button data-v="${v}" class="${!!D.mail_photos===v?'on':''}" ${ed?'':'disabled'}>${n}</button>`).join('')}</span></div>
    <div class="muted" style="font-size:13px;margin-top:4px">だれが・何時に完了したかは、いつも日報メールに出ます</div></div>
  <div class="card"><b>項目</b><div class="muted" style="font-size:13px;margin:4px 0 8px">毎日、黒服マイページの「開店作業」にこの順で出ます</div>
    ${I.map((x,i)=>`<div style="display:flex;gap:8px;align-items:center;border-top:1px solid var(--line);padding:8px 0;flex-wrap:wrap">${ed?`<input data-opn="${i}" value="${esc(x.name)}" maxlength="60" style="flex:1 1 240px;min-width:0">`:`<span style="flex:1">${esc(x.name)}</span>`}
      ${ed?`<span class="muted" style="font-size:13px">写真</span><span class="seg">${[[true,'要る'],[false,'要らない']].map(([v,n])=>`<button data-opph="${i}" data-v="${v}" class="${!!x.need_photo===v?'on':''}">${n}</button>`).join('')}</span>
      <button class="ghost sm" data-opm="${i}" data-dir="-1" ${i?'':'disabled'}>↑</button><button class="ghost sm" data-opm="${i}" data-dir="1" ${i<I.length-1?'':'disabled'}>↓</button><button class="ghost sm" data-opx="${i}">削除</button>`:(x.need_photo?'<small class="muted">写真</small>':'')}</div>`).join('')||'<div class="muted">まだありません</div>'}
    ${ed?'<div class="row" style="gap:8px;border-top:1px solid var(--line);padding-top:10px;margin-top:4px"><input id="opNew" maxlength="60" placeholder="新しい項目" style="flex:1;min-width:0"><button class="ghost" id="opAdd">追加</button></div>':''}</div>`;
  $('opDate').onchange=()=>{ if($('opDate').value){ openDay=$('opDate').value; PAGES.set_open(); } }; $('opPrev').onclick=()=>{ openDay=dayAdd(d,-1); PAGES.set_open(); }; $('opNext').onclick=()=>{ openDay=dayAdd(d,1); PAGES.set_open(); }; $('opToday').onclick=()=>{ openDay=businessDate(); PAGES.set_open(); };
  $('main').querySelectorAll('[data-big]').forEach(im=>im.onclick=()=>{ const m=modal(`<img src="${esc(im.dataset.big)}" alt="" style="width:100%;border-radius:10px"><div class="bar"><button class="primary" data-k="ok">閉じる</button></div>`); m.querySelector('[data-k=ok]').onclick=()=>m.remove(); });
  if(!ed) return;
  $('opMail').querySelectorAll('button').forEach(b=>b.onclick=guard(b,async()=>{ const v=b.dataset.v==='true'; if(!!D.mail_photos===v) return; const z=await rpc('admin_open_mail_photos',{p_store:st,p_on:v}); if(!z.ok) return; toast('保存しました'); PAGES.set_open(); }));
  const save=async(x,name,photo)=>{ const z=await rpc('admin_open_task_save',{p_store:st,p_id:x?x.id:null,p_name:name,p_need_photo:photo}); return z.ok; };
  $('opAdd').onclick=guard($('opAdd'),async()=>{ const n=$('opNew').value.trim(); if(!n){ await uiAlert('項目の名前を入れてください'); return; } if(await save(null,n,false)){ toast('追加しました'); PAGES.set_open(); } });
  $('main').querySelectorAll('[data-opn]').forEach(inp=>inp.onchange=async()=>{ const x=I[+inp.dataset.opn], n=inp.value.trim(); if(!n){ inp.value=x.name; await uiAlert('項目の名前を入れてください'); return; } if(n===x.name) return; if(await save(x,n,x.need_photo)){ x.name=n; toast('保存しました'); } else inp.value=x.name; });
  $('main').querySelectorAll('[data-opph]').forEach(b=>b.onclick=guard(b,async()=>{ const x=I[+b.dataset.opph], v=b.dataset.v==='true'; if(!!x.need_photo===v) return; if(await save(x,x.name,v)) PAGES.set_open(); }));
  $('main').querySelectorAll('[data-opx]').forEach(b=>b.onclick=guard(b,async()=>{ const x=I[+b.dataset.opx]; if(!await uiConfirm(`「${x.name}」を削除しますか？\nこれまでの記録は残ります`,'削除','danger')) return; const z=await rpc('admin_open_task_delete',{p_store:st,p_id:x.id}); if(!z.ok) return; toast('削除しました'); PAGES.set_open(); }));
  $('main').querySelectorAll('[data-opm]').forEach(b=>b.onclick=guard(b,async()=>{ const i=+b.dataset.opm, j=i+Number(b.dataset.dir); const ids=I.map(x=>x.id); [ids[i],ids[j]]=[ids[j],ids[i]];
    const z=await rpc('admin_open_task_order',{p_store:st,p_ids:ids}); if(z.ok) PAGES.set_open(); }));
};
