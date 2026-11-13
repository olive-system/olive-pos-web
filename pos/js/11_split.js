// ---------- split ----------
let splitItem=null;
function openSplit(item){ splitItem=item; const base={back:item.back_amount*item.qty,pts:Number(item.back_points)*item.qty};
  $('splitName').textContent=`${item.name} ×${item.qty}`; $('splitBase').textContent=`配分できる合計：バック ${yen(base.back)}${base.pts?`／ポイント ${base.pts}`:''}`;
  const cur_=Object.fromEntries((item.bill_item_splits||[]).map(s=>[s.staff_id,s]));
  const steps=(max,unit,v)=>{ const a=[]; for(let x=0;x<=max;x+=unit) a.push(x); if(max%unit) a.push(max); if(v&&!a.includes(v)) a.push(v); return a.sort((p,q)=>p-q); };
  const sel=(f,sid,max,unit,v,fmt)=>`<select class="n" data-f="${f}" data-s="${sid}" style="min-width:120px">${steps(max,unit,v).map(x=>`<option value="${x}" ${x===(v||0)?'selected':''}>${fmt(x)}</option>`).join('')}</select>`;
  const onBill=new Set(((S.cur&&S.cur.bill_casts)||[]).map(c=>c.staff_id)); const rk=s=>cur_[s.id]?0:onBill.has(s.id)?1:(S.present&&S.present.has(s.id))?2:3; const rows=S.staff.filter(s=>s.kind==='cast').map((s,i)=>({s,i})).sort((a,b)=>rk(a.s)-rk(b.s)||a.i-b.i).map(x=>x.s);
  const spHd=`<th></th><th>キャスト</th><th>バック</th>${base.pts?'<th>ポイント</th>':''}`; const spCell=s=>{ if(!s) return `<td colspan="${base.pts?4:3}"></td>`; const v=cur_[s.id]; return `<td><input type="checkbox" data-s="${s.id}" ${v?'checked':''}></td><td>${esc(s.display_name)}</td><td>${sel('back',s.id,base.back,1000,v?v.back_amount:0,x=>yen(x))}</td>${base.pts?`<td>${sel('pts',s.id,base.pts,10,v?Number(v.back_points):0,x=>x)}</td>`:''}`; }; const spHalf=Math.ceil(rows.length/2); $('splitTable').innerHTML=`<tr>${spHd}<th class="sp2"></th>${spHd}</tr>`+rows.slice(0,spHalf).map((s,i)=>`<tr>${spCell(s)}<td class="sp2"></td>${spCell(rows[i+spHalf])}</tr>`).join('');
  $('splitTable').querySelectorAll('select').forEach(x=>x.onchange=()=>{ const sid=x.dataset.s; const any=[...$('splitTable').querySelectorAll(`select[data-s="${sid}"]`)].some(z=>Number(z.value)>0); $('splitTable').querySelector(`input[type=checkbox][data-s="${sid}"]`).checked=any; });
  $('splitModal').dataset.base=JSON.stringify(base); $('splitModal').classList.add('on'); }
$('splitEven').onclick=()=>{ const base=JSON.parse($('splitModal').dataset.base); const ch=[...$('splitTable').querySelectorAll('input[type=checkbox]:checked')].map(c=>c.dataset.s); if(!ch.length){toast('キャストにチェックを入力してください');return;}
  ch.forEach(sid=>{ $('splitTable').querySelector(`select[data-f=back][data-s="${sid}"]`).value=Math.floor(base.back/ch.length/1000)*1000; const p=$('splitTable').querySelector(`select[data-f=pts][data-s="${sid}"]`); if(p) p.value=Math.floor(base.pts/ch.length/10)*10; }); };
function splitParts(it,rows){ const rs=rows.map(r=>({staff_id:r.staff_id,back_amount:r.back_amount,back_points:r.back_points})); if(!(it.rows&&it.rows.length>1)) return [{id:it.id,rows:rs}];
  const per=it.rows.map(r=>({id:r.id,cap:{back_amount:it.back_amount*r.qty,back_points:Number(it.back_points)*r.qty},q:r.qty,rows:rs.map(x=>({staff_id:x.staff_id,back_amount:0,back_points:0}))}));
  ['back_amount','back_points'].forEach(f=>rs.forEach((x,k)=>{ let left=x[f]; per.forEach(p=>{ const v=Math.min(left,Math.floor(x[f]*p.q/it.qty)); p.rows[k][f]=v; left-=v; }); /* 端数は、空きがある注文に順に入れる */ per.forEach(p=>{ if(left<=0) return; const v=Math.min(left,p.cap[f]-p.rows.reduce((a,y)=>a+y[f],0)); if(v>0){ p.rows[k][f]+=v; left-=v; } }); }));
  return per; }
$('splitCancel').onclick=()=>$('splitModal').classList.remove('on');
$('splitOk').onclick=guard($('splitOk'),async()=>{ /* 通しチェック3：二度押しでバックが二重になっていた */ const base=JSON.parse($('splitModal').dataset.base); const g=(f,sid)=>Number($('splitTable').querySelector(`select[data-f=${f}][data-s="${sid}"]`)?.value||0);
  const rows=[...$('splitTable').querySelectorAll('input[type=checkbox]:checked')].map(c=>({bill_item_id:splitItem.id,staff_id:c.dataset.s,sales_amount:0,back_amount:g('back',c.dataset.s),back_points:g('pts',c.dataset.s)})).filter(r=>r.back_amount>0||r.back_points>0);
  const sb_=rows.reduce((a,r)=>a+r.back_amount,0), sp_=rows.reduce((a,r)=>a+r.back_points,0);
  if(sb_>base.back){ toast(`バックの合計が ${yen(base.back)} を超えています（今 ${yen(sb_)}）`); return; } if(sp_>base.pts){ toast(`ポイントの合計が ${base.pts} を超えています（今 ${sp_}）`); return; }
  const nm=id=>S.staff.find(x=>x.id===id)?.display_name||'';
  /* 消して入れ直すのを1回で（途中で切れても振分が消えたままにならない）。記録は保存できた後 */
  /* まとめた行は、元の注文それぞれの数に合わせて分けて保存する */ let sv={}; for(const pr of splitParts(splitItem,rows)){ sv=await sb.rpc('pos_split_save',{p_item:pr.id,p_rows:pr.rows.filter(r=>r.back_amount>0||r.back_points>0)}); if(sv.error) break; } if(sv.error){ if(isStale(sv.error)){ $('splitModal').classList.remove('on'); await staleReload(sv.error.message); return; } toast('振り分けを保存できません：'+sv.error.message); return; }
  await logOp('バック振り分け変更',{item:splitItem.name,before:(splitItem.bill_item_splits||[]).map(x=>`${nm(x.staff_id)}:${x.back_amount}`),after:rows.map(x=>`${nm(x.staff_id)}:${x.back_amount}`)}); $('splitModal').classList.remove('on'); await openBill(S.cur.id); });

