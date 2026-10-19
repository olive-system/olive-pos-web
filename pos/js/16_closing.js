// ---------- 閉店作業（入出金の登録 → ボトル残量 → 顧客メモの更新申請の確認（顧客ウェブサイトから届いた分） → 今日出たお酒・ドリンク → レジ金合わせ → 月間一覧） ----------
const DENOMS=[[10000,'1万円札'],[5000,'5千円札'],[2000,'2千円札'],[1000,'千円札'],[500,'500円玉'],[100,'100円玉'],[50,'50円玉'],[10,'10円玉'],[5,'5円玉'],[1,'1円玉']];
let clDate=null, clCounts={}, clDeposit=0, clOpening=0, clMonth=null, clCtx=null, clReqAuthor='';
function clRange(d){ const a=new Date(`${d}T08:00:00`); return [a.toISOString(), new Date(a.getTime()+24*3600*1000).toISOString()]; }
// v10.43：閉店作業の④ 今日出たお酒・ドリンク（発注用）。取消の伝票・取消した注文は除く。フード・その他（h.c・b.c・立替金など）は出さない
function clOrderHtml(od){ if(od.error) return `<div class="muted">${esc(od.error.message)}</div>`; const skip=new Set(categories.filter(c=>['フード','その他'].includes(c.name)).map(c=>c.id)); const agg=new Map();
  (od.data||[]).forEach(i=>{ const cid=i.category_id||products.find(p=>p.id===i.product_id)?.category_id||null; if(skip.has(cid)) return; const k=i.product_id||i.name; const a=agg.get(k)||{name:i.name,cid,qty:0}; a.qty+=Number(i.qty)||0; agg.set(k,a); });
  const items=[...agg.values()].filter(a=>a.qty>0); if(!items.length) return '<div class="muted">なし</div>';
  const cats=[...categories.map(c=>c.id),null]; return `<div class="list">${cats.map(cid=>{ const xs=items.filter(a=>(a.cid||null)===cid).sort((a,b)=>b.qty-a.qty); if(!xs.length) return ''; const cn=categories.find(c=>c.id===cid)?.name||'未分類'; return `<div class="item" style="flex-wrap:wrap;gap:4px 14px"><b style="flex:0 0 auto">${esc(cn)}</b>${xs.map(a=>`<span>${esc(a.name)} ×${a.qty}</span>`).join('')}</div>`; }).join('')}</div>`; }
const clNum=v=>{ const n=parseInt(String(v??'').replace(/[^0-9]/g,''),10); return isNaN(n)?0:n; };
// v10.61：閉店作業④ 係・同伴・反応◎の登録に間違いがないかを伝票一覧で確認し、確認者を記録する（操作ログに残る。誰が確認したかで責任の所在が分かる）
const CL_CHK='伝票の確認（係・同伴・反応◎）';
// v11.59・SQL 130：⑤ 着物（ドレス新調日の免除。オーナー 2026-10-16「閉店作業で、着物の項目。本日出勤のキャストの中から選ぶ形で」）
// 出勤したキャストから着物の子を押す → その月のドレス新調日が免除（付いた罰金は取消）。もう一度押すと取消。ドレス新調日をしない店は出さない
// v11.60・SQL 131：カード売上の照合（Square と POS。オーナー 2026-10-16「スクエアと API 連携して自動で照合し結果を表示。照合ボタン」）。閉店作業を開くと自動、「照合」でやり直し
async function clCardRender(d,btn){ const el=$('clCard'); if(!el) return; el.innerHTML='<div class="muted">カード売上の照合…</div>';
  const q=await sb.rpc('pos_card_check',{p_day:d}); if(!$('clCard')||clDate!==d) return;
  const go='<button class="sm" id="clCardGo">照合</button>';
  if(q.error){ el.innerHTML=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>カード売上の照合</b><span style="color:var(--warn)">${esc(q.error.message)}</span>${go}</div>`; }
  else if(!q.data.set){ el.innerHTML='<div class="muted">カード売上の照合：Square がつながっていません（管理サイトの「Square 連携」）</div>'; return; }
  else { const D=q.data, ok=D.diff===0;
    el.innerHTML=`<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;${ok?'':'background:var(--warn-soft)'}"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>カード売上の照合</b>${ok?'<span class="badge k">一致</span>':`<b style="color:var(--warn)">差 ${D.diff>0?'+':''}${yen(D.diff)}</b>`}<span style="flex:1"></span>${go}</div>
      <div style="display:grid;grid-template-columns:auto auto 1fr;gap:2px 14px;margin-top:6px;font-size:15px"><span>Square</span><b class="right">${yen(D.square.total)}</b><span class="muted">${D.square.count}件</span><span>POS</span><b class="right">${yen(D.pos.total)}</b><span class="muted">${D.pos.count}件</span></div></div>`; }
  const b=$('clCardGo'); if(b) b.onclick=()=>clCardRender(d,true); if(btn&&!q.error) toast('照合しました'); }
// v11.71・SQL 145：閉店作業「⑦ TODO」（v11.72 でレジ金合わせの前に。オーナー 2026-10-18）（オーナー 2026-10-18「POS の閉店作業で警告する。絶対に終わらせる。できない場合は理由を書かせる」）。未で理由も無いと精算を保存できない（データベースでも止める）
async function clTodoRender(d){ const el=$('clTodo'); if(!el) return; const q=await sb.rpc('pos_todos',{p_day:d}); if(!$('clTodo')||clDate!==d) return;
  if(q.error){ el.innerHTML=`<div class="muted">${esc(/pos_todos/.test(q.error.message)?'SQL 145 が未実行です':q.error.message)}</div>`; return; }
  const L=q.data||[]; if(!L.length){ el.innerHTML='<div class="muted">この日の TODO はありません</div>'; return; }
  const n=L.filter(x=>x.status==='open').length;
  el.innerHTML=(n?`<div style="color:var(--warn);font-weight:700;margin-bottom:6px">終わっていない TODO が ${n}つ</div>`:'<div style="color:var(--pri);font-weight:700;margin-bottom:6px">全部済</div>')+L.map(x=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--line);font-size:15px"><span style="flex:1;min-width:0">${esc(x.name)}</span>${x.status==='done'?`<b style="color:var(--pri)">済</b><small class="muted">${esc(x.by||'')}</small>`:x.status==='skip'?`<small class="muted" style="max-width:50%">理由：${esc(x.reason||'')}</small>`:`<b style="color:var(--warn)">未</b><button class="ghost sm" data-tdr="${x.id}">理由</button>`}</div>`).join('')+'<div class="muted" style="font-size:13px;margin-top:6px">済は黒服マイページで（写真）</div>';
  el.querySelectorAll('[data-tdr]').forEach(b=>b.onclick=async()=>{ const x=L.find(y=>y.id===b.dataset.tdr); const r=await uiPrompt(`${x.name}\nできない理由`,''); if(r==null) return; if(!r.trim()){ toast('理由を入力してください'); return; } const z=await sb.rpc('pos_todo_skip',{p_item:x.id,p_day:d,p_reason:r.trim()}); if(z.error){ await uiAlert(z.error.message); return; } toast('理由を入れました'); clTodoRender(d); }); }
async function clKmRender(d){ const el=$('clKmBox'); if(!el) return; const q=await sb.rpc('pos_kimono_day',{p_day:d}); if(!$('clKmBox')||clDate!==d) return;
  if(q.error||!q.data?.enabled){ el.innerHTML=''; return; } const C=q.data.casts||[], mo=Number(d.slice(5,7)), md=x=>{ const [,m,dd]=String(x).split('-').map(Number); return `${m}/${dd}`; };
  el.innerHTML=`<h2 style="margin:18px 0 8px">⑤ 着物（ドレス新調日の免除）</h2>${C.length?`<div style="display:flex;flex-wrap:wrap;gap:8px">${C.map(c=>`<button type="button" class="${c.kimono?'primary':''}" data-km="${c.id}" ${c.done||c.other_day?'disabled':''} style="min-width:96px">${esc(c.name)}${c.kimono?'　着物':''}${c.done?'<br><small>新調済み</small>':''}${c.other_day?`<br><small>着物 ${md(c.other_day)}</small>`:''}</button>`).join('')}</div>
    <div class="muted hint" style="margin-top:6px">着物で出勤した子を押す → ${mo}月のドレス新調日は免除（もう一度押すと取消）</div>`:'<div class="muted">この日に出勤したキャストがいません</div>'}`;
  el.querySelectorAll('[data-km]').forEach(b=>b.onclick=async()=>{ const c=C.find(x=>x.id===b.dataset.km), on=!c.kimono; b.disabled=true;
    const r=await sb.rpc('pos_kimono_set',{p_staff:c.id,p_day:d,p_on:on}); if(r.error){ b.disabled=false; await uiAlert(r.error.message); return; } toast(on?`${c.name}：着物（${mo}月のドレス新調日は免除）`:`${c.name}：着物を取消しました`); clKmRender(d); }); }
async function clChkRender(d){ const el=$('clChk'); if(!el) return; if(!staffAll.length) await loadStaffAll();
  const r=await sb.from('pos_audit_log').select('created_at,detail').eq('store_id',store.id).eq('action',CL_CHK).eq('detail->>business_date',d).order('created_at',{ascending:false}).limit(1); if(!$('clChk')||clDate!==d) return;
  const done=(r.data||[])[0]; if(done){ const x=new Date(done.created_at); el.innerHTML=`<div style="font-size:16px">${FX('ballotboxwithcheck')} 伝票一覧で確認済　<b>${esc(done.detail?.by||'')}</b>　<small class="muted">${x.getMonth()+1}/${x.getDate()} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}</small></div>`; return; }
  if(d!==businessDate()){ el.innerHTML='<div class="muted">確認の記録なし</div>'; return; }
  const who=staffAll.filter(s=>s.is_active&&(s.kind==='hall'||(s.kakari_only&&s.display_name!=='店')));
  el.innerHTML=`<div style="margin-bottom:8px">${KL}・同伴・反応◎の登録に間違いがないか、伝票一覧で確認してください。</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="ghost sm" id="clChkOpen">伝票一覧を開く</button>
    <label style="display:flex;align-items:center;gap:6px;margin:0;font-size:16px;color:var(--ink)"><input type="checkbox" id="clChkBox" style="width:auto;margin:0">伝票一覧で確認した</label>
    <select id="clChkWho" style="width:auto;min-width:0"><option value="">確認者</option>${who.map(s=>`<option value="${s.id}">${esc(s.display_name)}</option>`).join('')}</select>
    <button class="primary sm" id="clChkSave" disabled>記録</button></div>`;
  const upd=()=>{ $('clChkSave').disabled=!($('clChkBox').checked&&$('clChkWho').value); }; $('clChkBox').onchange=upd; $('clChkWho').onchange=upd;
  $('clChkOpen').onclick=()=>{ setCur='bills'; renderSettings('bills'); };
  $('clChkSave').onclick=async()=>{ $('clChkSave').disabled=true; const s=staffAll.find(x=>x.id===$('clChkWho').value); await logOp(CL_CHK,{by:s?.display_name||'',staff_id:s?.id||null,business_date:d},null,true); clChkRender(d); }; }
