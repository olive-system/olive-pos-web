// ---------- 開店作業 v1.45・SQL 194（オーナー 2026-10-22「毎日同じ作業の開店作業と、TODO とを一緒にしないで」「日報メールにつける写真、つけるつけないは管理サイトで決めたい」） ----------
// 上＝きょうの記録（だれが・何時・写真）、下＝項目（毎日、黒服マイページの「開店作業」に出る）と、日報メールに写真を載せるか
// v1.47：項目は一覧の行でそのまま直す（名前・写真 要る｜要らない・並べ替え・削除。オーナー 2026-10-23「いちいち窓をつけてる必要なくない？」）
// v1.50・SQL 209：閉店作業も同じ画面（オーナー 2026-10-23）。項目ごとに対象「全員｜限定」（限定は、スタッフ設定の黒服の「限定項目」が可の人だけ）。作業中も出す
//   閉店作業は上に「マイページで する｜しない」（しない＝POS の閉店作業は今のまま）。決まった画面の項目（ボトル残量など）は名前・写真を変えられず、削除もできない
let openDay=null;
// v1.62・SQL 262：項目ごとに「コメント 要る｜要らない」（要る＝黒服マイページで作業中にコメントの欄。オーナー 2026-10-26「コメントが必要か不要かのボタンがいいかな」）。きょうの記録にコメントを出す
// v1.52：対象・写真は各行ではなく一番上の見出しに（オーナー 2026-10-23「全部横に書いてある。鬱陶しい」）
const TASK_PG={ set_open:['open','開店作業'], set_close:['close','閉店作業'] };
PAGES.set_open=()=>taskPage('set_open');
PAGES.set_close=()=>taskPage('set_close');
async function taskPage(pg){ const [ph,nm]=TASK_PG[pg], st=storeId, ed=perm(pg)==='edit'; if(!openDay) openDay=businessDate(); const d=openDay;
  const head=`<h1>${nm} <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`, again=()=>taskPage(pg);
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_tasks',{p_store:st,p_day:d,p_phase:ph}); if(page!==pg||storeId!==st||openDay!==d) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_tasks/.test(r.error.message)?'SQL 209 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data||{}, I=D.items||[], T=D.day||[], hm=t=>t?new Date(t).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}):'';
  const wd=x=>['日','月','火','水','木','金','土'][new Date(x+'T00:00:00+09:00').getDay()], nd=T.filter(x=>x.status==='done').length;
  const seg=(k,i,cur,os)=>`<span class="seg">${os.map(([v,n])=>`<button data-${k}="${i}" data-v="${v}" class="${cur===v?'on':''}">${n}</button>`).join('')}</span>`;
  const onCard=ph==='close'?`<div class="card"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>閉店作業をマイページで</b>
      <span class="seg" id="tkOn">${[[true,'する'],[false,'しない']].map(([v,n])=>`<button data-v="${v}" class="${!!D.close_on===v?'on':''}" ${ed?'':'disabled'}>${n}</button>`).join('')}</span></div>
    <div class="muted" style="font-size:13px;margin-top:4px">する：黒服マイページの「閉店作業」で開始・保存します。POS は入出金・レジ金合わせ・精算と、この一覧の完了・作業中です。しない：POS の閉店作業は今のままです</div></div>`:'';
  $('main').innerHTML=head+onCard+`<div class="card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button class="ghost sm" id="opPrev">◀</button><input type="date" id="opDate" value="${d}" style="width:auto"><button class="ghost sm" id="opNext">▶</button><button class="ghost sm" id="opToday">今日</button>
      <span class="muted" style="font-size:13px">${Number(d.slice(5,7))}/${Number(d.slice(8))}（${wd(d)}）　完了 ${nd}／${T.length}</span></div>
    ${T.map(x=>`<div style="display:flex;gap:10px;align-items:center;border-top:1px solid var(--line);padding:8px 0;font-size:14px"><b style="min-width:3.5em;color:${x.status==='done'?'var(--ok)':'var(--warn)'}">${x.status==='done'?'完了':'未完了'}</b><span style="flex:1">${esc(x.name)}${x.detail&&x.detail.comment?`<br><span style="white-space:pre-wrap">コメント：${esc(x.detail.comment)}</span>`:''}</span>
      ${x.status==='done'?`<span class="muted" style="white-space:nowrap">${esc(x.by||'')} ${hm(x.at)}</span>`:x.wip_by?`<span style="background:var(--gold-soft);border-radius:6px;padding:1px 7px;white-space:nowrap">作業中 ${esc(x.wip_by)}</span>`:''}${(x.photos||[]).map(u=>`<img src="${esc(u)}" data-big="${esc(u)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--line);cursor:pointer">`).join('')}</div>`).join('')||'<div class="muted" style="margin-top:8px">項目がありません</div>'}</div>
  <div class="card"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>日報メールに写真を載せる</b>
      <span class="seg" id="opMail">${[[true,'載せる'],[false,'載せない']].map(([v,n])=>`<button data-v="${v}" class="${!!D.mail_photos===v?'on':''}" ${ed?'':'disabled'}>${n}</button>`).join('')}</span></div>
    <div class="muted" style="font-size:13px;margin-top:4px">開店作業・閉店作業の両方です。未完了の項目は、いつも日報メールに出ます</div></div>
  <div class="card"><b>項目</b><div class="muted" style="font-size:13px;margin:4px 0 8px">毎日、黒服マイページの「${nm}」にこの順で出ます。対象が限定の項目は、スタッフ設定の黒服の「限定項目」が可の人のみです。コメントが「要る」の項目は、作業中にコメントの欄が出ます（書くのは任意）</div>
    ${!I.length?'<div class="muted">まだありません</div>':ed?`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tr style="font-size:13px;color:var(--muted);text-align:left"><th style="font-weight:400;padding:0 6px 6px 0">項目</th><th style="font-weight:400;padding:0 6px 6px 0">対象</th><th style="font-weight:400;padding:0 6px 6px 0">写真</th><th style="font-weight:400;padding:0 6px 6px 0">コメント</th><th></th></tr>
    ${I.map((x,i)=>{ const fx=x.kind!=='simple'; return `<tr><td style="border-top:1px solid var(--line);padding:8px 6px 8px 0;width:100%">${fx?esc(x.name):`<input data-opn="${i}" value="${esc(x.name)}" maxlength="60" style="min-width:160px;width:100%">`}</td>
      <td style="border-top:1px solid var(--line);padding:8px 6px 8px 0">${seg('opl',i,!!x.limited,[[false,'全員'],[true,'限定']])}</td><td style="border-top:1px solid var(--line);padding:8px 6px 8px 0">${fx?'':seg('opph',i,!!x.need_photo,[[true,'要る'],[false,'要らない']])}</td><td style="border-top:1px solid var(--line);padding:8px 6px 8px 0">${fx?'':seg('opcm',i,!!x.need_comment,[[true,'要る'],[false,'要らない']])}</td>
      <td style="border-top:1px solid var(--line);padding:8px 6px 8px 0;white-space:nowrap;text-align:right"><button class="ghost sm" data-opm="${i}" data-dir="-1" ${i?'':'disabled'}>↑</button> <button class="ghost sm" data-opm="${i}" data-dir="1" ${i<I.length-1?'':'disabled'}>↓</button>${fx?'':` <button class="ghost sm" data-opx="${i}">削除</button>`}</td></tr>`; }).join('')}</table></div>`
      :I.map(x=>`<div style="display:flex;gap:8px;align-items:center;border-top:1px solid var(--line);padding:8px 0"><span style="flex:1">${esc(x.name)}</span>${[x.limited?'<small class="muted">限定</small>':'',x.need_photo?'<small class="muted">写真</small>':'',x.need_comment?'<small class="muted">コメント</small>':''].join(' ')}</div>`).join('')}
    ${ed?'<div class="row" style="gap:8px;border-top:1px solid var(--line);padding-top:10px;margin-top:4px"><input id="opNew" maxlength="60" placeholder="新しい項目" style="flex:1;min-width:0"><button class="ghost" id="opAdd">追加</button></div>':''}</div>`;
  $('opDate').onchange=()=>{ if($('opDate').value){ openDay=$('opDate').value; again(); } }; $('opPrev').onclick=()=>{ openDay=dayAdd(d,-1); again(); }; $('opNext').onclick=()=>{ openDay=dayAdd(d,1); again(); }; $('opToday').onclick=()=>{ openDay=businessDate(); again(); };
  $('main').querySelectorAll('[data-big]').forEach(im=>im.onclick=()=>{ const m=modal(`<img src="${esc(im.dataset.big)}" alt="" style="width:100%;border-radius:10px"><div class="bar"><button class="primary" data-k="ok">閉じる</button></div>`); m.querySelector('[data-k=ok]').onclick=()=>m.remove(); });
  if(!ed) return;
  if($('tkOn')) $('tkOn').querySelectorAll('button').forEach(b=>b.onclick=guard(b,async()=>{ const v=b.dataset.v==='true'; if(!!D.close_on===v) return; const z=await rpc('admin_close_on',{p_store:st,p_on:v}); if(!z.ok) return; toast('保存しました'); again(); }));
  $('opMail').querySelectorAll('button').forEach(b=>b.onclick=guard(b,async()=>{ const v=b.dataset.v==='true'; if(!!D.mail_photos===v) return; const z=await rpc('admin_open_mail_photos',{p_store:st,p_on:v}); if(!z.ok) return; toast('保存しました'); again(); }));
  const save=async(x,name,photo,lim)=>{ const z=await rpc('admin_task_save',{p_store:st,p_id:x?x.id:null,p_name:name,p_need_photo:photo,p_limited:lim,p_phase:ph}); return z.ok; };
  $('opAdd').onclick=guard($('opAdd'),async()=>{ const n=$('opNew').value.trim(); if(!n){ await uiAlert('項目の名前を入れてください'); return; } if(await save(null,n,false,false)){ toast('追加しました'); again(); } });
  $('main').querySelectorAll('[data-opn]').forEach(inp=>inp.onchange=async()=>{ const x=I[+inp.dataset.opn], n=inp.value.trim(); if(!n){ inp.value=x.name; await uiAlert('項目の名前を入れてください'); return; } if(n===x.name) return; if(await save(x,n,x.need_photo,x.limited)){ x.name=n; toast('保存しました'); } else inp.value=x.name; });
  $('main').querySelectorAll('[data-opph]').forEach(b=>b.onclick=guard(b,async()=>{ const x=I[+b.dataset.opph], v=b.dataset.v==='true'; if(!!x.need_photo===v) return; if(await save(x,x.name,v,x.limited)) again(); }));
  $('main').querySelectorAll('[data-opcm]').forEach(b=>b.onclick=guard(b,async()=>{ const x=I[+b.dataset.opcm], v=b.dataset.v==='true'; if(!!x.need_comment===v) return; const z=await rpc('admin_task_comment',{p_store:st,p_id:x.id,p_on:v}); if(z.ok) again(); }));
  $('main').querySelectorAll('[data-opl]').forEach(b=>b.onclick=guard(b,async()=>{ const x=I[+b.dataset.opl], v=b.dataset.v==='true'; if(!!x.limited===v) return; if(await save(x,x.name,x.need_photo,v)) again(); }));
  $('main').querySelectorAll('[data-opx]').forEach(b=>b.onclick=guard(b,async()=>{ const x=I[+b.dataset.opx]; if(!await uiConfirm(`「${x.name}」を削除しますか？\nこれまでの記録は残ります`,'削除','danger')) return; const z=await rpc('admin_open_task_delete',{p_store:st,p_id:x.id}); if(!z.ok) return; toast('削除しました'); again(); }));
  $('main').querySelectorAll('[data-opm]').forEach(b=>b.onclick=guard(b,async()=>{ const i=+b.dataset.opm, j=i+Number(b.dataset.dir); const ids=I.map(x=>x.id); [ids[i],ids[j]]=[ids[j],ids[i]];
    const z=await rpc('admin_open_task_order',{p_store:st,p_ids:ids}); if(z.ok) again(); }));
}
