// ---------- 開店作業 v1.45・SQL 194（オーナー 2026-10-22「毎日同じ作業の開店作業と、TODO とを一緒にしないで」「日報メールにつける写真、つけるつけないは管理サイトで決めたい」） ----------
// 上＝きょうの記録（だれが・何時・写真）、下＝項目（毎日、黒服マイページの「開店作業」に出る）と、日報メールに写真を載せるか
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
  <div class="card"><div class="row" style="justify-content:space-between;align-items:center"><b>項目</b>${ed?'<button class="ghost sm" id="opAdd">＋ 項目を足す</button>':''}</div>
    <div class="muted" style="font-size:13px;margin:4px 0 8px">毎日、黒服マイページの「開店作業」にこの順で出ます。押すと直せます</div>
    ${I.map((x,i)=>`<div style="display:flex;gap:8px;align-items:center;border-top:1px solid var(--line);padding:8px 0"><span ${ed?`data-ope="${i}" style="flex:1;cursor:pointer"`:'style="flex:1"'}>${esc(x.name)}</span>${x.need_photo?'<small class="muted">写真</small>':''}
      ${ed?`<button class="ghost sm" data-opm="${i}" data-dir="-1" ${i?'':'disabled'}>↑</button><button class="ghost sm" data-opm="${i}" data-dir="1" ${i<I.length-1?'':'disabled'}>↓</button>`:''}</div>`).join('')||'<div class="muted">まだありません</div>'}</div>`;
  $('opDate').onchange=()=>{ if($('opDate').value){ openDay=$('opDate').value; PAGES.set_open(); } }; $('opPrev').onclick=()=>{ openDay=dayAdd(d,-1); PAGES.set_open(); }; $('opNext').onclick=()=>{ openDay=dayAdd(d,1); PAGES.set_open(); }; $('opToday').onclick=()=>{ openDay=businessDate(); PAGES.set_open(); };
  $('main').querySelectorAll('[data-big]').forEach(im=>im.onclick=()=>{ const m=modal(`<img src="${esc(im.dataset.big)}" alt="" style="width:100%;border-radius:10px"><div class="bar"><button class="primary" data-k="ok">閉じる</button></div>`); m.querySelector('[data-k=ok]').onclick=()=>m.remove(); });
  if(!ed) return;
  $('opMail').querySelectorAll('button').forEach(b=>b.onclick=guard(b,async()=>{ const v=b.dataset.v==='true'; if(!!D.mail_photos===v) return; const z=await rpc('admin_open_mail_photos',{p_store:st,p_on:v}); if(!z.ok) return; toast('保存しました'); PAGES.set_open(); }));
  $('opAdd').onclick=()=>openEdit(st,null);
  $('main').querySelectorAll('[data-ope]').forEach(e=>e.onclick=()=>openEdit(st,I[+e.dataset.ope]));
  $('main').querySelectorAll('[data-opm]').forEach(b=>b.onclick=guard(b,async()=>{ const i=+b.dataset.opm, j=i+Number(b.dataset.dir); const ids=I.map(x=>x.id); [ids[i],ids[j]]=[ids[j],ids[i]];
    const z=await rpc('admin_open_task_order',{p_store:st,p_ids:ids}); if(z.ok) PAGES.set_open(); }));
};
function openEdit(st,x){ const isNew=!x; x=x||{name:'',need_photo:false};
  const m=modal(`<h2 style="margin:0">${isNew?'開店作業の項目を足す':'開店作業の項目'}</h2><label>名前<input id="opN" maxlength="60" value="${esc(x.name)}"></label>
    <label>写真<select id="opP"><option value="false">要らない</option><option value="true" ${x.need_photo?'selected':''}>要る</option></select></label>
    <div class="bar">${isNew?'':'<button class="danger" data-k="del" style="margin-right:auto">消す</button>'}<button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  m.querySelector('[data-k=no]').onclick=()=>m.remove();
  const sv=m.querySelector('[data-k=ok]'); sv.onclick=guard(sv,async()=>{ const n=m.querySelector('#opN').value.trim(); if(!n){ await uiAlert('名前を入れてください'); return; }
    const z=await rpc('admin_open_task_save',{p_store:st,p_id:x.id||null,p_name:n,p_need_photo:m.querySelector('#opP').value==='true'}); if(!z.ok) return; m.remove(); toast('保存しました'); PAGES.set_open(); });
  const dl=m.querySelector('[data-k=del]'); if(dl) dl.onclick=guard(dl,async()=>{ if(!await uiConfirm(`「${x.name}」を消しますか？\nこれまでの記録は残ります`,'消す','danger')) return; const z=await rpc('admin_open_task_delete',{p_store:st,p_id:x.id}); if(!z.ok) return; m.remove(); toast('消しました'); PAGES.set_open(); });
}
