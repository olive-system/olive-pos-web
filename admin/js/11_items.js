// ---------- 報酬・罰金・アフターの延長の項目 ----------
// v0.11・SQL 052：罰金の種類（店舗ごと）。POS の在籍リスト「＋罰金」で選ぶ。金額が決まっているものはそのまま登録、時給の％は月末の時給で計算、日給の％はその人の日給で計算
// v1.26・SQL 140：報酬の種類（オーナー 2026-10-17「罰金の種類だけではなく、報酬の種類も作れ」「広島はポイントの加算でスライド表作ってる」）
// 名前・手当（円）かポイント・1回の数・自動（連絡先交換の提出）。ポイントはその月のポイント（ポイントスライド）に、手当は報酬の手当に足す。POS の在籍リストの「手当」で選ぶ
let RWT=[], RWPS=false, RWT0=[]; /* v1.75：RWT0＝読んだ時の一覧（保存の時に送って、ほかの画面で変わっていたら断る。点検 2026-10-30） */
const rwTxt=x=>`${x.value!=null?`${Number(x.value).toLocaleString('ja-JP')}${x.kind==='point'?'P':'円'}／${x.auto==='after'?'お客様1名':'1回'}`:'<span class="muted">数 未設定</span>'}${x.auto?'　自動':''}`;
function rwCard(d,ed){ RWT=d.rows||[]; RWT0=JSON.parse(JSON.stringify(RWT)); RWPS=!!d.point_slide; return foldCard('rewards','報酬の種類','',`${RWT.length}種類`,`<div class="muted" style="font-size:13px;margin-bottom:8px">POS：在籍リストの「手当」${RWPS?'（手当／ポイント）':''}　自動：連絡先交換の提出1件ごと</div>
  <div style="border:1px solid var(--line);border-radius:10px;background:#fff">${RWT.map((x,i)=>`<div ${ed?`data-rwi="${i}"`:''} style="display:flex;justify-content:space-between;gap:12px;padding:10px 14px;${i?'border-top:1px solid var(--line);':''}${ed?'cursor:pointer':''}"><span>${esc(x.name)}　<small class="muted">${x.kind==='point'?'ポイント':'手当'}</small></span><b style="font-weight:600">${rwTxt(x)}</b></div>`).join('')||'<div class="muted" style="padding:10px 14px">なし</div>'}</div>
  ${ed?'<div class="fend"><button class="ghost sm" data-rwadd>＋ 報酬を追加</button></div>':''}`,'data-rewards'); }
function rwEdit(st,i){ const x=i==null?{name:'',kind:RWPS?'point':'yen',value:null,auto:null}:RWT[i];
  const md=modal(`<h2 style="margin:0">${i==null?'報酬の追加':esc(x.name)}</h2><label>名前<input id="rwN" value="${esc(x.name)}"></label>
    <label>種類<select id="rwK"><option value="yen" ${x.kind==='yen'?'selected':''}>手当（円）</option>${RWPS?`<option value="point" ${x.kind==='point'?'selected':''}>ポイント</option>`:''}</select></label>
    <label>1回<span style="display:flex;gap:6px;align-items:center"><input id="rwV" inputmode="numeric" value="${x.value??''}" style="width:120px;text-align:right"><span id="rwU">${x.kind==='point'?'P':'円'}</span></span></label>
    <label>自動<select id="rwA"><option value="">なし（POS で付ける）</option><option value="contact" ${x.auto==='contact'?'selected':''}>連絡先交換の提出1件ごと</option><option value="douhan" ${x.auto==='douhan'?'selected':''}>同伴1回ごと</option><option value="douhan1" ${x.auto==='douhan1'?'selected':''}>同伴①1回ごと（出勤 〜20:30）</option><option value="douhan2" ${x.auto==='douhan2'?'selected':''}>同伴②1回ごと（出勤 20:31〜21:00）</option><option value="after" ${x.auto==='after'?'selected':''}>アフター（お客様1名ごと・人数で分配）</option></select></label>
    <div class="bar">${i==null?'':'<button class="ghost" data-k="del" style="color:var(--warn);margin-right:auto">削除</button>'}<button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  const q=id=>md.querySelector('#'+id); q('rwU').textContent=q('rwK').value==='point'?'P':'円'; /* v1.80・SQL 317（点検 C6）：ポイントスライドが無い店では種類「ポイント」を出さない（POS に出ないため） */ q('rwK').onchange=()=>{ q('rwU').textContent=q('rwK').value==='point'?'P':'円'; };
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  const save=async L=>{ const r=await rpc('admin_reward_types_save',{p_store:st,p_rows:L,p_base:RWT0}); return r.ok; };
  const del=md.querySelector('[data-k=del]'); if(del) del.onclick=async()=>{ if(!await uiConfirm(`「${x.name}」を報酬の一覧から削除しますか？\n登録済の報酬は削除されません`,'削除','danger')) return; if(!await save(RWT.filter((_,k)=>k!==i))) return; md.remove(); toast('削除しました'); PAGES.set_pay(); };
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{ const name=q('rwN').value.trim(); if(!name){ await uiAlert('名前を入力してください'); return; }
    if(RWT.some((y,k)=>k!==i&&y.name===name)){ await uiAlert(`「${name}」はもうあります`); return; }
    const v=q('rwV').value.trim()===''?null:slNum(q('rwV').value); if(v==null){ await uiAlert('1回の数を入力してください'); return; } if(!(v>0)){ await uiAlert('1回の数は1以上にしてください'); return; } /* v1.80・SQL 317（点検 C6）：1回は必須（空だと POS に出なかった） */
    const y={name,kind:q('rwK').value,value:v,auto:q('rwA').value||null}; const L=RWT.slice(); if(i==null) L.push(y); else L[i]=y; if(!await save(L)) return; md.remove(); toast('保存しました'); PAGES.set_pay(); }); }
function rwWire(st,ed){ if(!ed) return; document.querySelectorAll('[data-rwi]').forEach(e=>e.onclick=()=>rwEdit(st,Number(e.dataset.rwi))); const a=document.querySelector('[data-rewards] [data-rwadd]'); if(a) a.onclick=()=>rwEdit(st,null); }
// v0.17：罰金1つを1行にして、時給の人・日給の人の決め方を横に並べる（表は今と同じ fine_types。時給と日給が同じ「円」か「その都度」なら target='all' の1行＝黒服にもかかる。違えば hourly・daily の2行）
const FINE_H=[['','なし'],['hourly_pct','％'],['yen','円'],['input','その都度']], FINE_D=[['','なし'],['daily_pct','％'],['yen','円'],['input','その都度'],['daily_late','遅刻（時間分）'],['daily_early','早上がり（時間分）']];
const FINE_TIME=c=>c==='daily_late'||c==='daily_early';
// fine_types の行 → 名前ごとに {name, h:{calc,value,per_unit}, d:{…}}
function fineGroup(rows){ const g=new Map();
  for(const r of rows){ const k=r.name; if(!g.has(k)) g.set(k,{name:k,h:null,d:null}); const x=g.get(k), c={calc:r.calc,value:r.value,per_unit:r.per_unit};
    if(r.target==='hourly') x.h=c; else if(r.target==='daily') x.d=c;
    else if(r.calc==='hourly_pct') x.h=x.h||c; else if(r.calc==='daily_pct'||FINE_TIME(r.calc)) x.d=x.d||c; else { x.h=x.h||c; x.d=x.d||c; } }
  return [...g.values()]; }
// v1.18：罰金の種類は「一覧は文、押して小窓で変える」（オーナー 2026-10-17。見本ア）。時給・日給の2列と「個数」のチェックをやめた。円の罰金は POS でいつも回数を入れられる（per_unit を全部 true）
let FINES=[], FINES0=[]; /* v1.75：FINES0＝読んだ時の fine_types の行（保存の時に送る。報酬の種類と同じ） */
const fineTxt=c=>!c?'なし':c.calc==='yen'?`${Number(c.value||0).toLocaleString('ja-JP')}円`:c.calc==='hourly_pct'?(c.value%100===0?`時給×${c.value/100}時間`:`時給の${c.value}%`):c.calc==='daily_pct'?`日給 ${c.value}%`:c.calc==='input'?'その都度':c.calc==='daily_late'?`遅刻時間分${c.value?`＋日給 ${c.value}%`:''}`:c.calc==='daily_early'?`早上がり時間分${c.value?`＋日給 ${c.value}%`:''}`:'—';
const fineSame=(a,b)=>!!a&&!!b&&a.calc===b.calc&&(a.value??null)===(b.value??null);
// v1.55：所定時間の保存も箱の右下（オーナー 2026-10-23「ちぐはぐやめて」）
function fineCard(rows,ed,hours){ FINES=fineGroup(rows); FINES0=rows.map(r=>({name:r.name,target:r.target,calc:r.calc,value:r.value,per_unit:r.per_unit})); return foldCard('fines','罰金の種類','',`${FINES.length}種類`,`<div class="muted" style="font-size:13px;margin-bottom:8px">POS の在籍リストの「＋罰金」で選びます。${ed?'押すと変えられます':''}</div>
  <div class="row" style="margin-bottom:10px;font-size:14px">日給の人の所定時間<input id="dHours" inputmode="decimal" value="${hours??''}" ${ed&&hours!=null?'':'disabled'} style="width:80px;text-align:right">時間${hours==null?'<span class="muted" style="font-size:13px">SQL 053 が未実行です</span>':''}</div>
  <div id="fnList">${fineListHtml(ed)}</div>${ed?`<div class="fend"><button class="ghost sm" data-fadd>＋ 罰金を追加</button><span class="sp"></span>${hours!=null?'<button class="primary sm" id="dHoursSave">保存</button>':''}</div>`:''}`,'data-fines'); }
function fineListHtml(ed){ return `<div style="border:1px solid var(--line);border-radius:10px;background:#fff">${FINES.map((g,i)=>{ const same=fineSame(g.h,g.d); /* 点検 2026-11-02：日給の人が「かからない」（d が無い）を「時給の人と同じ」と読んでいた */
    return `<div ${ed?`data-fi="${i}"`:''} style="display:flex;justify-content:space-between;gap:12px;padding:10px 14px;${i?'border-top:1px solid var(--line);':''}${ed?'cursor:pointer':''}"><span>${esc(g.name)}</span><span style="text-align:right">${!g.h?`<b>${fineTxt(g.d)}</b><br><span class="muted" style="font-size:12px">日給のみ</span>`:`<b>${fineTxt(g.h)}</b>${same?'':`<br><span class="muted" style="font-size:12px">${g.d&&g.d.calc==='daily_pct'?fineTxt(g.d):'日給 '+fineTxt(g.d)}</span>`}`}</span></div>`; }).join('')||'<div class="muted" style="padding:10px 14px">まだ入っていません</div>'}</div>`; }
function fineEdit(st,i){ const g=i==null?{name:'',h:{calc:'yen',value:null},d:null}:FINES[i], hc=g.h?.calc||'none', same=fineSame(g.h,g.d)||(g.h&&g.d&&g.h.calc==='yen'&&g.d.calc==='yen'&&g.h.value===g.d.value);
  const dSel=same?'same':g.d?g.d.calc:'none';
  const md=modal(`<h2 style="margin:0">${i==null?'罰金の追加':esc(g.name)}</h2><label>名前<input id="fnN" value="${esc(g.name)}"></label>
    <div><div class="muted" style="font-size:13px;margin-bottom:4px">時給の人</div>${[['yen','金額',`<input id="fnHy" inputmode="numeric" value="${hc==='yen'?g.h.value??'':''}" style="width:110px;text-align:right"> 円`],['hourly_pct','時給の',`<input id="fnHp" inputmode="decimal" value="${hc==='hourly_pct'?g.h.value/100:''}" style="width:80px;text-align:right"> 時間分`],['input','その都度（POS で金額を入れる）',''],['none','かからない','']].map(([v,n,x])=>`<label style="display:flex;align-items:center;gap:8px;flex-direction:row;margin:4px 0;color:var(--ink);font-size:15px"><input type="radio" name="fnH" value="${v}" ${hc===v?'checked':''} style="width:auto">${n} ${x}</label>`).join('')}</div>
    <div><div class="muted" style="font-size:13px;margin-bottom:4px">日給の人</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select id="fnD" style="width:auto">${[['same','時給の人と同じ'],['yen','金額'],['daily_pct','日給の'],['input','その都度'],['daily_late','遅刻の時間分'],['daily_early','早上がりの時間分'],['none','かからない']].map(([v,n])=>`<option value="${v}" ${dSel===v?'selected':''}>${n}</option>`).join('')}</select><span id="fnDv"><input id="fnDn" inputmode="numeric" value="${g.d&&!same?g.d.value??'':''}" style="width:100px;text-align:right"> <span id="fnDu"></span></span></div></div>
    <div class="bar">${i==null?'':'<button class="ghost" data-k="del" style="color:var(--warn);margin-right:auto">削除</button>'}<button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  const q=id=>md.querySelector('#'+id), dp=()=>{ const v=q('fnD').value; q('fnDv').style.display=['yen','daily_pct','daily_late','daily_early'].includes(v)?'':'none'; q('fnDu').textContent=v==='yen'?'円':v==='daily_pct'?'%':'＋日給の %（空けてよい）'; }; q('fnD').onchange=dp; dp();
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  const save=async list=>{ const rows=[]; for(const x of list){ const same=fineSame(x.h,x.d); if(x.h&&x.d&&same&&(x.h.calc==='yen'||x.h.calc==='input')) rows.push({name:x.name,target:'all',...x.h,per_unit:x.h.calc==='yen'}); else { if(x.h) rows.push({name:x.name,target:'hourly',...x.h,per_unit:x.h.calc==='yen'}); if(x.d) rows.push({name:x.name,target:'daily',...x.d,per_unit:x.d.calc==='yen'}); } }
    const r=await rpc('admin_save_fine_types',{p_store:st,p_rows:rows,p_base:FINES0}); if(!r.ok) return false; return true; };
  const del=md.querySelector('[data-k=del]'); if(del) del.onclick=async()=>{ if(!await uiConfirm(`「${g.name}」を罰金の一覧から削除しますか？\n登録済の罰金は削除されません`,'削除','danger')) return; const L=FINES.filter((_,k)=>k!==i); if(!await save(L)) return; md.remove(); toast('削除しました'); PAGES.set_pay(); };
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{ const name=q('fnN').value.trim(); if(!name){ await uiAlert('名前を入力してください'); return; }
    if(FINES.some((x,k)=>k!==i&&x.name===name)){ await uiAlert(`「${name}」はもうあります`); return; }
    const hv=md.querySelector('input[name=fnH]:checked')?.value||'none'; let h=null;
    if(hv==='yen'){ const v=slNum(q('fnHy').value); if(!(v>0)||!Number.isInteger(v)){ await uiAlert('時給の人の金額を入力してください'); return; } h={calc:'yen',value:v}; }
    else if(hv==='hourly_pct'){ const v=slNum(q('fnHp').value); if(!(v>0)){ await uiAlert('時給の何時間分かを入力してください'); return; } h={calc:'hourly_pct',value:Math.round(v*100)}; }
    else if(hv==='input') h={calc:'input',value:null};
    const dv=q('fnD').value; let d=null;
    if(dv==='same'){ if(!h){ await uiAlert('時給の人が「かからない」の時は、日給の人を選んでください'); return; } if(h.calc==='hourly_pct'){ await uiAlert('時給の時間分は日給の人には使えません。日給の人を選んでください'); return; } d={...h}; }
    else if(dv==='yen'||dv==='daily_pct'){ const v=slNum(q('fnDn').value); if(!(v>0)||!Number.isInteger(v)){ await uiAlert(dv==='yen'?'日給の人の金額を入力してください':'日給の何%かを入力してください'); return; } d={calc:dv,value:v}; }
    else if(dv==='input') d={calc:'input',value:null};
    else if(dv==='daily_late'||dv==='daily_early'){ const v=slNum(q('fnDn').value); if(v!=null&&(!(v>0)||!Number.isInteger(v))){ await uiAlert('加算の%は1以上の整数にするか、空けてください'); return; } d={calc:dv,value:v}; }
    if(!h&&!d){ await uiAlert('時給の人か日給の人のどちらかを選んでください'); return; }
    const L=FINES.slice(); const x={name,h,d}; if(i==null) L.push(x); else L[i]=x; if(!await save(L)) return; md.remove(); toast('保存しました'); PAGES.set_pay(); }); }
function fineListWire(st,ed){ if(!ed) return; document.querySelectorAll('[data-fi]').forEach(e=>e.onclick=()=>fineEdit(st,Number(e.dataset.fi))); const a=document.querySelector('[data-fines] [data-fadd]'); if(a) a.onclick=()=>fineEdit(st,null); }

// v0.14・SQL 055：アフターの延長（attendance_rules。タイムカードの打刻の時に round_punch が使う）。閉店の○分前を過ぎたアフターは、閉店まで働いたことにする。閉店時間は店舗設定で決める
const closeTxt=c=>{ const m=String(c||'01:00').match(/^(\d{1,2}):(\d{2})/); return m?`${+m[1]<12?'翌':''}${+m[1]}:${m[2]}`:String(c); };
function afterCard(ax,ed){ const T='アフターの延長', h='<div class="muted" style="font-size:13px;margin-bottom:10px">アフターの打刻（退勤の代わり）で、時給を付ける時間を延ばします</div>';
  if(ax.error) return foldCard('after',T,'','',`<div class="err">${esc(/after_ext|minutes|close/.test(ax.error.message)||/find|exist|schema cache/.test(ax.error.message)?'SQL 055 が未実行です：':'読み込めません：')}${esc(ax.error.message)}</div>`);
  const a=ax.data||{}; if(a.minutes==null) return foldCard('after',T,'','','<div class="err">SQL 055 が未実行です</div>');
  const on=!!a.on, dis=ed?'':'disabled', cl=closeTxt(a.close);
  return foldCard('after',T,'',on?`する・閉店の${esc(String(a.minutes))}分前から`:'しない',`${h}<div class="row"><span class="seg" id="afOn">${[[true,'する'],[false,'しない']].map(([v,n])=>`<button data-v="${v}" class="${on===v?'on':''}" ${dis}>${n}</button>`).join('')}</span></div>
    <div class="row" style="margin-top:10px;font-size:14px">閉店（${esc(cl)}）の<input id="afM" inputmode="numeric" value="${esc(String(a.minutes))}" ${dis} style="width:80px;text-align:right">分前を過ぎたアフターは、閉店（${esc(cl)}）まで働いたことにする</div>
    <div class="muted hint" style="font-size:13px;margin-top:8px;line-height:1.6">時給の人・日給の人の両方。タイムカードで打刻した時に決まります<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">（変更しても、前の打刻はそのまま）<br>閉店時間は「POS設定」で設定します。退勤・アフターの打刻は閉店より後になりません</div></div>
    ${ed?'<div class="fend"><span class="sp"></span><button class="primary sm" id="afSave">保存</button></div>':''}`,'data-after'); }

