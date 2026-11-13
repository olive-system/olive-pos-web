// ---------- お預かりタグ ----------
let tagKind='coat';
$('tagBtn').onclick=()=>{ renderTags(); $('tagModal').classList.add('on'); };
$('tagCancel').onclick=()=>$('tagModal').classList.remove('on');
function renderTags(){ const tags=(cur.bill_tags||[]).filter(t=>!t.returned_at);
  $('tagList').innerHTML=tags.map(t=>`<div class="item"><span class="n">${FX('label')} ${TAGK[t.kind]} ${t.tag_no?'#'+esc(t.tag_no):''} <small>${esc(t.memo||'')}</small></span><button class="sm" data-ret="${t.id}">返却</button></div>`).join('')||'<div class="muted">お預かり品なし</div>';
  $('tagList').querySelectorAll('[data-ret]').forEach(b=>b.onclick=async()=>{ const tg=tags.find(z=>z.id===b.dataset.ret); { const up=await sb.rpc('pos_tag_return',{p_ids:[b.dataset.ret]}); if(up.error){ toast('返却を登録できません：'+up.error.message); return; } } await logOp('お預かり返却',{kind:TAGK[tg?.kind],tag_no:tg?.tag_no}); await openBill(cur.id); renderTags(); });
  $('tagKinds').innerHTML=Object.entries(TAGK).map(([k,v])=>`<button class="kindbtn ${tagKind===k?'on':''}" data-k="${k}">${v}</button>`).join('');
  $('tagKinds').querySelectorAll('.kindbtn').forEach(b=>b.onclick=()=>{ tagKind=b.dataset.k; renderTags(); }); }
$('tagAdd').onclick=guard($('tagAdd'),async()=>{ /* 二度押しで2つ入らないように */ const { error } = await sb.rpc('pos_tag_add',{p_bill:cur.id,p_kind:tagKind,p_no:$('tagNo').value.trim()||null,p_memo:$('tagMemo').value.trim()||null}); if(error){toast(error.message);return;} await logOp('お預かり追加',{kind:TAGK[tagKind],tag_no:$('tagNo').value.trim()||null}); $('tagNo').value=''; $('tagMemo').value=''; await openBill(cur.id); renderTags(); });

