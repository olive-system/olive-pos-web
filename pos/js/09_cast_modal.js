// ---------- cast modal（本日出勤者・同伴自動判定） ----------
$('castAddBtn').onclick=async()=>{
  const { data } = await sb.from('attendance_events').select('staff_id,event_type,event_at').eq('business_date',businessDate()).in('event_type',['clock_in','douhan','clock_out']);
  const present={}, gone=new Set(); (data||[]).forEach(e=>{ if(e.event_type==='clock_out'){ gone.add(e.staff_id); return; } present[e.staff_id]=present[e.staff_id]||{}; present[e.staff_id][e.event_type]=e.event_at; });
  // v10.71：退勤済の人は「出勤中」に出さず、「出勤していないキャストから選ぶ」に入れる
    const list=staff.filter(s=>s.kind==='cast'&&present[s.id]&&!gone.has(s.id));
  const others=staff.filter(s=>s.kind==='cast'&&(!present[s.id]||gone.has(s.id)));
  $('castList').innerHTML=list.map(s=>`<button class="chip" data-id="${s.id}" data-role="none">${esc(s.display_name)}</button>`).join('')||'<span class="muted">出勤中の人はいません</span>';
  $('castListAll').innerHTML=others.map(s=>`<button class="chip" data-id="${s.id}" data-role="none">${esc(s.display_name)}</button>`).join('')||'<span class="muted">なし</span>';
  $('castListAll').classList.add('hidden'); $('castMoreBtn').textContent='出勤していないキャストから選ぶ ▾';
  let castRoleSel='kakari'; const roleUi=()=>$('castRole').querySelectorAll('[data-cr]').forEach(x=>x.classList.toggle('on',x.dataset.cr===castRoleSel)); $('castRole').querySelectorAll('[data-cr]').forEach(x=>x.onclick=()=>{ castRoleSel=x.dataset.cr; roleUi(); }); roleUi();
  // 係は何人でも追加できる（売上は係全員で等分）。同伴にしても他の係は外さない。設定ONなら同伴の人も係になる
  const att=new Set([...Object.keys(present),...gone]); // v11.13：今日出勤した人（退勤済も入る）
  const pick=async b=>{ const isFirst=!(cur.bill_casts||[]).some(c=>c.is_kakari); const dh=castRoleSel==='douhan'; if(dh&&!att.has(b.dataset.id)){ toast('今日出勤していないキャストは同伴にできません'); return; }
    // 既に伝票に付いている人を選んだ時は、追加ではなくその人の係／同伴を更新する
    const ex=(cur.bill_casts||[]).find(c=>c.staff_id===b.dataset.id);
    if(ex){ const upd={}; if(dh){ if(!isDouhan(ex.role)){ const n=(cur.bill_casts||[]).filter(c=>isDouhan(c.role)).length; if(n>=cur.guest_count){ toast(`同伴は客数（${cur.guest_count}名）までです`); return; } upd.role=douhanRole(cur.opened_at); } if(settings.douhan_is_kakari&&!ex.is_kakari) upd.is_kakari=true; } else if(!ex.is_kakari) upd.is_kakari=true;
      if(Object.keys(upd).length){ const { error } = await sb.from('bill_casts').update(upd).eq('id',ex.id); if(error){toast(error.message);return;} await logOp(dh?'同伴を追加':'係を追加',{name:snm(ex.staff_id),kakari:upd.is_kakari??ex.is_kakari,kind:upd.role?ROLE[upd.role]:null,update:true}); if(upd.is_kakari) await syncHcBack(); }
      $('castModal').classList.remove('on'); openBill(cur.id); return; }
    if(dh){ const n=(cur.bill_casts||[]).filter(c=>isDouhan(c.role)).length; if(n>=cur.guest_count){ toast(`同伴は客数（${cur.guest_count}名）までです`); return; } }
    /* v11.95：出勤していない人・退勤した人を付ける時は聞く（ゲネプロ #32・#46） */ if(!present[b.dataset.id]||gone.has(b.dataset.id)){ if(!await uiConfirm(`${snm(b.dataset.id)} は${gone.has(b.dataset.id)?'もう退勤しています':'今日の出勤の記録がありません'}。\n${dh?'同伴':KL}に付けますか？`)) return; }
    const role=dh?douhanRole(cur.opened_at):'none'; const mk=dh?!!settings.douhan_is_kakari:true;
    const { error } = await sb.from('bill_casts').insert({bill_id:cur.id,staff_id:b.dataset.id,role,is_kakari:mk}); if(error){toast(error.message);return;} await logOp(dh?'同伴を追加':'係を追加',{name:snm(b.dataset.id),kakari:mk,kind:dh?ROLE[role]:null});
    if(mk) await syncHcBack();
    $('castModal').classList.remove('on'); openBill(cur.id); };
  $('castList').querySelectorAll('.chip').forEach(b=>b.onclick=()=>pick(b));
  $('castListAll').querySelectorAll('.chip').forEach(b=>b.onclick=()=>pick(b));
  $('castModal').classList.add('on'); };
$('castMoreBtn').onclick=()=>{ const el=$('castListAll'); el.classList.toggle('hidden'); $('castMoreBtn').textContent=el.classList.contains('hidden')?'出勤していないキャストから選ぶ ▾':'出勤していないキャストから選ぶ ▴'; };
$('castCancel').onclick=()=>$('castModal').classList.remove('on');
function douhanRole(ts){ const d=ts?new Date(ts):new Date(); const m=d.getHours()*60+d.getMinutes(); if(m<8*60) return 'douhan'; if(m<=20*60+30) return 'douhan1'; if(m<=21*60) return 'douhan2'; return 'douhan'; }

