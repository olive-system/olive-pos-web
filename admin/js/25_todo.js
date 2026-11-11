// ---------- 黒服の TODO ----------
// v1.29・SQL 145：黒服の TODO（オーナー 2026-10-18。TimeTree の「todoリスト写メ報告」の代わり）。上＝その日の TODO（済・できない・未・写真）、下＝項目（押すと小窓で変える）
const TODO_SLOT={open:'開店作業',close:'閉店作業',by17:'17時まで',none:'なし'};
// v1.31・SQL 148：いつ に「隔週」「毎月 第◯ ◯曜日」「毎年」（オーナー 2026-10-18。TimeTree の TODO を入れるため）
// v1.88・SQL 332：月末は店の月の最終営業日（休みの日は数えない）
// v2.07・SQL 354：イベント最終日（シフト設定のイベント日が続く時は最後の日。休みの日は飛ばす。オーナー 2026-11-04 銀座のイベントのノルマ）
const TODO_KIND=[['daily','毎日'],['weekly','毎週'],['biweekly','隔週'],['monthly','毎月（日にち）'],['nth','毎月（第◯ ◯曜日）'],['month_end','月末（最終営業日）'],['event_last','イベント最終日'],['yearly','毎年'],['once','その日だけ']];
const todoMd=d=>String(d||'').slice(5).split('-').map(Number).join('/'), todoWds=x=>(x.rule_dows||[]).map(d=>WD[d]).join('・');
const todoWhen=x=>x.rule_kind==='daily'?'毎日':x.rule_kind==='weekly'?`毎週 ${todoWds(x)}`:x.rule_kind==='biweekly'?`隔週 ${todoWds(x)}`:x.rule_kind==='monthly'?`毎月 ${(x.rule_days||[]).join('・')}日`:x.rule_kind==='nth'?`毎月 第${(x.rule_nth||[]).join('・')} ${todoWds(x)}`:x.rule_kind==='month_end'?'月末':x.rule_kind==='event_last'?'イベント最終日':x.rule_kind==='yearly'?`毎年 ${todoMd(x.rule_date)}`:`${todoMd(x.rule_date)} だけ`;
// v1.34・SQL 153：TODO は設定の中の1つだけ（オーナー 2026-10-18「わざわざタブ一つつくる必要ある？」）。上＝その日の TODO（済・できない・未・写真）、下＝月のカレンダー（TimeTree のように）。「項目」で足す・変える
let todoDay=null, todoMon=null, todoView='cal';
PAGES.todo=()=>{ page='set_todo'; return PAGES.set_todo(); };
PAGES.set_todo=async()=>{ const st=storeId, ed=perm('set_todo')==='edit';
  if(!todoDay) todoDay=businessDate(); if(!todoMon) todoMon=todoDay.slice(0,7);
  const head=`<div class="row" style="align-items:center;gap:10px;margin-bottom:12px"><h1 style="margin:0">TODO <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><span style="flex:1"></span>
    <span class="seg"><button class="${todoView==='cal'?'on':''}" data-tv="cal">カレンダー</button><button class="${todoView==='items'?'on':''}" data-tv="items">項目</button></span>${ed&&todoView==='items'?'<button class="ghost sm" id="tdAdd">＋ TODO を追加</button>':''}</div>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const it=await sb.rpc('admin_todo_items',{p_store:st}); if(page!=='set_todo'||storeId!==st) return;
  if(it.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_todo/.test(it.error.message)?'SQL 146 が未実行です：':'読み込めません：')}${esc(it.error.message)}</div>`; return; }
  const I=it.data||[], byId=Object.fromEntries(I.map(x=>[x.id,x]));
  const wire=()=>{ $('main').querySelectorAll('[data-tv]').forEach(b=>b.onclick=()=>{ todoView=b.dataset.tv; PAGES.set_todo(); }); const ad=$('tdAdd'); if(ad) ad.onclick=()=>todoEdit(st,null); };
  if(todoView==='items'){
    $('main').innerHTML=head+`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:8px">黒服マイページに出る。その日の出勤の黒服がやる</div>
      <div style="border:1px solid var(--line);border-radius:10px;background:#fff">${I.map((x,i)=>`<div ${ed?`data-tdi="${i}"`:''} style="display:flex;justify-content:space-between;gap:12px;padding:10px 14px;${i?'border-top:1px solid var(--line);':''}${ed?'cursor:pointer':''}"><span>${esc(x.name)}</span><span class="muted" style="text-align:right;font-size:14px;white-space:nowrap">${todoWhen(x)}　${x.slot!=='none'?TODO_SLOT[x.slot]:''}${x.need_photo?'　写真':''}${x.need_note?'　書く':''}</span></div>`).join('')||'<div class="muted" style="padding:10px 14px">なし</div>'}</div></div>`;
    wire(); if(ed) $('main').querySelectorAll('[data-tdi]').forEach(e=>e.onclick=()=>todoEdit(st,I[+e.dataset.tdi])); return; }
  const mo=await sb.rpc('admin_todo_month',{p_store:st,p_month:todoMon+'-01'}); if(page!=='set_todo'||storeId!==st) return;
  if(mo.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_todo_month/.test(mo.error.message)?'SQL 153 が未実行です：':'読み込めません：')}${esc(mo.error.message)}</div>`; return; }
  const M=mo.data||{}, today=businessDate();
  if(todoDay.slice(0,7)!==todoMon) todoDay=todoMon===today.slice(0,7)?today:todoMon+'-01';
  const stOf=(x,d)=>x.status==='done'?'done':x.status==='skip'?'skip':d>today?'fut':'open';
  const CHS={done:'background:var(--gold-soft)',skip:'background:var(--soft);color:var(--muted)',open:'background:var(--warn-soft);color:var(--warn);font-weight:700',fut:'background:#fff;border:1px solid var(--line)'};
  const D=M[todoDay]||[], hm=hmJst;
  const wdN=wdJ, cnt=k=>D.filter(x=>stOf(x,todoDay)===k).length;
  const badge=k=>`<span style="font-size:12px;border-radius:999px;padding:1px 8px;white-space:nowrap;${CHS[k]}">${({done:'完了',skip:'できない',open:'未完了',fut:'これから'})[k]}</span>`;
  const dayCard=`<div class="card"><div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px"><b style="font-size:20px">${Number(todoDay.slice(5,7))}/${Number(todoDay.slice(8))}（${wdN(todoDay)}）${todoDay===today?'　本日':''}</b><span class="muted" style="font-size:13px">TODO ${D.length}件${D.length?`　完了 ${cnt('done')}・できない ${cnt('skip')}・未完了 ${cnt('open')}`:''}</span></div>
    ${(()=>{ const row=(x,i)=>{ const k=stOf(x,todoDay); return `<div style="border-top:1px solid var(--line);padding:9px 0"><div style="display:flex;gap:8px;align-items:center">${badge(k)}<b style="flex:1;font-weight:500;${ed&&byId[x.id]?'cursor:pointer':''}" ${ed&&byId[x.id]?`data-tde="${x.id}"`:''}>${esc(x.name)}</b><span class="muted" style="font-size:12px;white-space:nowrap">${esc(TODO_SLOT[x.slot]&&x.slot!=='none'?TODO_SLOT[x.slot]:'')}${x.by?'　'+esc(x.by):''}${x.at?' '+hm(x.at):''}</span>${ed&&byId[x.id]?`<button class="ghost sm" data-tde="${x.id}" style="padding:0 8px">変更</button>`:''}</div>
      ${((x.photos&&x.photos.length)?x.photos:(x.photo?[x.photo]:[])).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;margin:8px 6px 0 0"></a>`).join('')/* v1.40：写真は何枚でも（SQL 176） */}
      ${x.status==='skip'&&x.reason?`<div style="font-size:13px;margin-top:4px">理由：${esc(x.reason)}</div>`:''}${x.note?`<div style="font-size:13px;margin-top:4px;white-space:pre-wrap">${esc(x.note_hint||'書いたこと')}：${esc(x.note)}</div>`:''}
      ${x.steps?`<details style="margin-top:4px"><summary class="muted" style="font-size:13px;cursor:pointer">手順</summary><div style="font-size:13px;white-space:pre-wrap;margin-top:4px">${esc(x.steps)}</div></details>`:''}</div>`; };
      /* v1.61・SQL 234：休日分（休みの日の TODO を次の営業日に）を黒服マイページと同じく分けて出す（オーナー 2026-10-26「土日の To Do 表示されてるよね？」）。言葉は用語集：休日分・本日分・期限 閉店・期限 17:00 */
      const C=D.filter(x=>x.carry), T=D.filter(x=>!x.carry), md=d=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`, cd=[...new Set(C.map(x=>x.day))].sort();
      const sec=(t,r)=>`<div style="display:flex;gap:10px;align-items:baseline;border-top:1px solid var(--line);padding:10px 0 2px"><b style="font-size:15px">${t}</b>${r||''}</div>`;
      if(!C.length) return T.map(row).join('')||'<div class="muted">この日の TODO はありません</div>';
      const late=C.some(x=>x.late);
      return sec(`休日分（${cd.length>2?`${md(cd[0])}〜${md(cd[cd.length-1])}`:cd.map(md).join('・')}）`,`<span style="${late?'background:var(--warn-soft);color:var(--warn);':'color:var(--muted);'}border-radius:6px;padding:2px 8px;font-size:13px;white-space:nowrap">期限 ${esc(C[0].deadline||'閉店')}</span>`)
        + C.map(row).join('') + sec('本日分') + (T.map(row).join('')||'<div class="muted">本日分の TODO はありません</div>'); })()}
    <div class="muted" style="font-size:12px;margin-top:6px">写真は30日で消えます</div></div>`;
  const [yy,mm]=todoMon.split('-').map(Number), f=new Date(yy,mm-1,1), st0=new Date(yy,mm-1,1-f.getDay()), ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const weeks=Math.ceil((f.getDay()+new Date(yy,mm,0).getDate())/7); let cells='';
  for(let i=0;i<weeks*7;i++){ const d=new Date(st0); d.setDate(st0.getDate()+i); const k=ymd(d), inM=d.getMonth()===mm-1, L=inM?(M[k]||[]):[];
    cells+=`<div data-tdd="${inM?k:''}" style="border:1px solid var(--line);margin:-1px 0 0 -1px;min-height:112px;padding:4px;min-width:0;${inM?'cursor:pointer;background:#fff':'background:var(--soft)'};${k===todoDay?'outline:3px solid var(--ok);outline-offset:-3px':''}">
      <div style="font-size:13px;font-weight:700;margin-bottom:2px;${d.getDay()===0?'color:var(--warn)':''}">${k===today?`<span style="background:var(--head);color:#fff;border-radius:999px;padding:0 6px">${d.getDate()}</span>`:d.getDate()}</div>
      ${L.slice(0,4).map(x=>`<div ${ed&&byId[x.id]?`data-tdc="${x.id}"`:''} style="font-size:12px;line-height:1.35;border-radius:4px;padding:1px 4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${CHS[stOf(x,k)]}">${esc(x.name)}</div>`).join('')}${L.length>4?`<div class="muted" style="font-size:12px">ほか ${L.length-4}</div>`:''}</div>`; }
  const sw=k=>`<span style="display:inline-block;width:14px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:3px;${CHS[k]}"></span>`;
  $('main').innerHTML=head+dayCard+`<div class="card" style="margin-top:14px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><button class="ghost sm" id="tdmP">‹</button><b style="font-size:18px">${yy}年${mm}月</b><button class="ghost sm" id="tdmN">›</button><span style="flex:1"></span><span class="muted" style="font-size:12px">${sw('done')}完了　${sw('open')}未完了　${sw('skip')}できない　${sw('fut')}これから</span></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">${WD.map(w=>`<div class="muted" style="text-align:center;font-size:12px;padding:3px">${w}</div>`).join('')}${cells}</div></div>`;
  wire();
  const mv=n=>{ const d=new Date(yy,mm-1+n,1); todoMon=ymd(d).slice(0,7); PAGES.set_todo(); }; $('tdmP').onclick=()=>mv(-1); $('tdmN').onclick=()=>mv(1);
  $('main').querySelectorAll('[data-tdd]').forEach(c=>{ if(c.dataset.tdd) c.onclick=()=>{ todoDay=c.dataset.tdd; PAGES.set_todo(); window.scrollTo(0,0); }; });
  $('main').querySelectorAll('[data-tde]').forEach(b=>b.onclick=()=>todoEdit(st,byId[b.dataset.tde]));
  /* v1.59：カレンダーの TODO の名前を押すと、その項目の編集（オーナー 2026-10-25「カレンダーからのタップで編集できるように。いちいち項目から探すのだるい」） */
  $('main').querySelectorAll('[data-tdc]').forEach(c=>c.onclick=e=>{ e.stopPropagation(); todoEdit(st,byId[c.dataset.tdc]); }); };
function todoEdit(st,x){ const isNew=!x; x=x||{name:'',steps:'',rule_kind:'weekly',rule_dows:[],rule_days:[],rule_nth:[],rule_date:null,slot:'open',need_photo:false,need_note:false,note_hint:''};
  const md=mkModal(null,todoEditHtml(x,isNew));
  const q=id=>md.querySelector('#'+id), paint=()=>{ const k=q('tdK').value; q('tdKw').style.display=['weekly','biweekly','nth'].includes(k)?'flex':'none'; q('tdKn').style.display=k==='nth'?'flex':'none'; q('tdKm').style.display=k==='monthly'?'':'none'; q('tdKo').style.display=['biweekly','yearly','once'].includes(k)?'':'none'; q('tdKoL').textContent=k==='biweekly'?'初めの日（この日から隔週）':k==='yearly'?'日付（毎年この月日）':'日付'; q('tdHw').style.display=q('tdW').value==='true'?'':'none'; };
  q('tdK').onchange=paint; q('tdW').onchange=paint; paint();
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  const del=md.querySelector('[data-k=del]'); if(del) del.onclick=async()=>{ if(!await uiConfirm(`「${x.name}」を削除しますか？\n今までの記録は残ります`,'削除','danger')) return; const r=await rpc('admin_todo_remove',{p_store:st,p_id:x.id}); if(!r.ok) return; md.remove(); toast('削除しました'); PAGES.set_todo(); }; /* v1.59：外す → 削除（オーナー 2026-10-25「外すではなく削除だろ」） */
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{
    const row={name:q('tdN').value.trim(),rule_kind:q('tdK').value,rule_dows:[...md.querySelectorAll('[data-dw]:checked')].map(e=>+e.dataset.dw),rule_days:q('tdDays').value.split(/[,、\s]+/).map(v=>parseInt(v,10)).filter(v=>v>=1&&v<=31),rule_nth:[...md.querySelectorAll('[data-nth]:checked')].map(e=>+e.dataset.nth),rule_date:q('tdDt').value||null,
      slot:q('tdS').value,need_photo:q('tdP').value==='true',need_note:q('tdW').value==='true',note_hint:q('tdH').value.trim(),steps:q('tdT').value};
    if(!row.name){ await uiAlert('名前を入力してください'); return; }
    const r=await rpc('admin_todo_save',{p_store:st,p_id:isNew?null:x.id,p_row:row}); if(!r.ok) return; md.remove(); toast('保存しました'); PAGES.set_todo(); }); }
/* TODO の追加・変更の小窓の中身 */
function todoEditHtml(x,isNew){
  return `<h2 style="margin:0">${isNew?'TODO の追加':esc(x.name)}</h2><label>名前<input id="tdN" value="${esc(x.name)}"></label>
    <label>いつ<select id="tdK">${TODO_KIND.map(([v,n])=>`<option value="${v}" ${x.rule_kind===v?'selected':''}>${n}</option>`).join('')}</select></label>
    <div id="tdKn" style="display:flex;gap:6px;flex-wrap:wrap">${[1,2,3,4,5].map(n=>`<label style="display:flex;align-items:center;gap:4px;margin:0"><input type="checkbox" data-nth="${n}" ${(x.rule_nth||[]).includes(n)?'checked':''} style="width:auto">第${n}</label>`).join('')}</div>
    <div id="tdKw" style="display:flex;gap:6px;flex-wrap:wrap">${WD.map((w,i)=>`<label style="display:flex;align-items:center;gap:4px;margin:0"><input type="checkbox" data-dw="${i}" ${(x.rule_dows||[]).includes(i)?'checked':''} style="width:auto">${w}</label>`).join('')}</div>
    <label id="tdKm">日（「1,15」のように）<input id="tdDays" value="${esc((x.rule_days||[]).join(','))}" inputmode="numeric"></label>
    <label id="tdKo"><span id="tdKoL">日付</span><input type="date" id="tdDt" value="${esc(x.rule_date||'')}"></label>
    <label>時間<select id="tdS">${Object.entries(TODO_SLOT).map(([v,n])=>`<option value="${v}" ${x.slot===v?'selected':''}>${n}</option>`).join('')}</select></label>
    <label>写真<select id="tdP"><option value="false">不要</option><option value="true" ${x.need_photo?'selected':''}>要</option></select></label>
    <label>書く欄<select id="tdW"><option value="false">なし</option><option value="true" ${x.need_note?'selected':''}>あり</option></select></label>
    <label id="tdHw">書く欄の見出し<input id="tdH" value="${esc(x.note_hint||'')}" placeholder="例：在庫の数"></label>
    <label>手順（黒服に見せる）<textarea id="tdT" rows="6" style="width:100%;font:inherit;font-size:15px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">${esc(x.steps||'')}</textarea></label>
    <div class="bar">${isNew?'':'<button class="ghost" data-k="del" style="color:var(--warn);margin-right:auto">削除</button>'}<button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`;
}
