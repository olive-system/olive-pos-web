// ---------- キャスト設定 v0.15・SQL 056：一人ずつの報酬条件（月ごと。その月以降／その月のみ）・その人だけの条件・メモ ----------
// 担当・報酬（時給／日給）・日給・日払い・契約書は staff に入れる（月で変わらない。POS と同じ欄）
// 保証時給・期限・同伴ノルマ・バック・源泉徴収・消費税・厚生費・罰金の免除は cast_terms に月ごとに入れる（その月の行があればそれ、なければ前の月の「以降」の行）
const CS_PUNCH='打刻の手入力'; // v0.24・SQL 064：POS で打刻を手で入れた時に自動で付く罰金
const CS_FOREVER='9999-12-31', CS_CATS=['性格','体調','お客様','勤怠','良かったこと','その他'];
const CS_SP={pay:'支給',deduct:'控除',text:'文字だけ',wage:'支給（時給加算）'}; // v0.54・SQL 079：時給加算（1時間あたりの円。時給の人のスライド表の金額に足す）。v0.55：時給加算は「支給」の中の1つ（種類＝支給 → 月額／時給加算）。保存する kind は wage のまま // v0.43：文字だけは新しく入れない（メモを使う。前に入れたものは出す）
let csMonth=null, csEdit=false, csDetail=null, csTab='memo', csOrdM=null;
// v0.52：キャスト・黒服のタブをやめて、1つの画面に（上にキャスト、下に黒服）。編集はどちらか片方ずつ（csEdit＝'cast'／'hall'）
// v0.23：「今月」は営業日（朝8時で日付が変わる）の月
const csNowMonth=()=>businessDate().slice(0,7)+'-01';
const csAddMonth=(m,n)=>{ const [y,mo]=m.split('-').map(Number); const d=new Date(Date.UTC(y,mo-1+n,1)); return d.toISOString().slice(0,7)+'-01'; };
const csMLabel=m=>{ const [y,mo]=m.split('-').map(Number); return `${y}年${mo}月`; };
const csMShort=m=>`${Number(m.split('-')[1])}月`;
const csList=st=>sb.from('staff').select('*').eq('store_id',st).eq('is_active',true).order('sort_order').order('id');
// v0.23・SQL 063：報酬形態（時給・日給）と日給も月ごと。前の行（pay_type が空）は staff の値を使う
function csTerms(s,rows,m){ const t=rows.filter(r=>r.staff_id===s.id&&r.month<=m&&(r.month===m||!r.only_month)).sort((a,b)=>a.month<b.month?1:-1)[0];
  const pay=x=>{ const pt=x.pay_type||(s.is_seppan?'seppan':s.pay_type==='daily'?'daily':'hourly'); /* v0.36・SQL 075：報酬に折半 */ return {...x,pay_type:pt,daily_wage:pt==='daily'?(x.pay_type?x.daily_wage:s.daily_wage)??null:null}; };
  if(t) return pay({...t,exempt_fines:t.exempt_fines||[]});
  return pay({month:null,only_month:false,guaranteed_wage:s.guaranteed_wage??null,guarantee_until:s.guarantee_until??null,douhan_quota:s.douhan_quota??null,back_pct:null,back_mode:'add',withhold:null,ctax_pct:null,welfare_mode:'std',welfare_amount:null,exempt_fines:[],slide_ids:null,pay_type:null,daily_wage:null,seppan_pct:null}); }
const csNum=v=>v==null||v===''?null:Number(v);
const csDate=d=>{ if(!d) return '—'; if(d===CS_FOREVER) return '無期限'; const [y,m,dd]=d.split('-').map(Number); return `${y}/${m}/${dd}`; };

PAGES.set_cast=async()=>{
  if(csDetail&&csDetail.store===storeId) return csDetailPage();
  csDetail=null; const st=storeId, ed=perm('set_cast')==='edit'; if(!ed) csEdit=false;
  const cur=csNowMonth(); if(!csMonth) csMonth=cur; const m=csMonth, mOpts=[]; for(let i=1;i>=-12;i--) mOpts.push(csAddMonth(cur,i));
  $('main').innerHTML=`<h1>スタッフ設定 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>${ed?'':'<div class="muted" style="margin-bottom:10px">閲覧のみ</div>'}
  <div class="row" style="margin-bottom:12px"><select id="csM" style="width:auto" ${csEdit?'disabled':''}>${mOpts.map(x=>`<option value="${x}" ${x===m?'selected':''}>${csMLabel(x)}</option>`).join('')}</select></div>
  <div id="csCastBox"><h2 style="margin:0 0 8px">キャスト</h2><div class="card muted">読み込み中…</div></div>
  <div id="csShBox" style="margin-top:28px"><h2 style="margin:0 0 8px">シフト</h2><div class="card muted">読み込み中…</div></div>
  <div id="csHallBox" style="margin-top:28px"><h2 style="margin:0 0 8px">黒服</h2><div class="card muted">読み込み中…</div></div>`;
  $('csM').onchange=()=>{ csMonth=$('csM').value; PAGES.set_cast(); };
  await Promise.all([csCastPart($('csCastBox'),st,ed,m), csShiftPart($('csShBox'),st,ed,m), csHallPart($('csHallBox'),st,ed,m)]); };
async function csCastPart(box,st,ed,m){
  const [sf,tm,ft,nt,stb]=await Promise.all([csList(st), sbAll(()=>sb.from('cast_terms').select('*').eq('store_id',st).lte('month',m).order('id')),
    sb.from('fine_types').select('name').eq('store_id',st).order('sort_order'), sbAll(()=>sb.from('cast_notes').select('staff_id').eq('store_id',st).eq('is_void',false).order('id')), /* v0.67：1000行で切れないように分けて読む */
    sb.from('slide_tables').select('id,name,unit,sort_order').eq('store_id',st).eq('is_active',true).order('sort_order')]);
  if(page!=='set_cast'||storeId!==st||csMonth!==m||!box.isConnected) return;
  const er=sf.error||tm.error||nt.error;
  if(er){ box.innerHTML=`<h2 style="margin:0 0 8px">キャスト</h2><div class="card err">${esc(/cast_terms|cast_notes|day_pay_ok/.test(er.message)&&/exist|schema cache/.test(er.message)?'SQL 056 が未実行です：':'読み込めません：')}${esc(er.message)}</div>`; return; }
  const all=sf.data||[], halls=all.filter(x=>x.kind==='hall'), casts=all.filter(x=>x.kind==='cast'&&!x.is_trial&&!x.kakari_only);
  const nc={}; (nt.data||[]).forEach(x=>nc[x.staff_id]=(nc[x.staff_id]||0)+1);
  const tbls=stb.error?[]:(stb.data||[]); // SQL 058 の前は空
  const unitOf=(s,t)=>t.pay_type==='seppan'?null:t.pay_type==='daily'?'daily':'hourly'; // v0.36・SQL 075：折半＝係小計×小計バック％だけ（スライド・保証時給・同伴ノルマなし）
  const slOk=(ids,u)=>(ids||[]).filter(id=>tbls.some(x=>x.id===id&&x.unit===u));
  const slTxt=(s,t)=>{ const u=unitOf(s,t); if(!u) return '—'; const ok=slOk(t.slide_ids,u); return ok.length?esc(ok.map(id=>slShort(tbls.find(x=>x.id===id).name)).join('・')):'<span class="badge warnb">未選択</span>'; };
  const slShort=n=>String(n).replace(/スライド(表)?$/,'')||n; // v0.35：表の中は短く
  const fines=[...new Set([...(ft.data||[]).map(x=>x.name),'同伴ノルマ','新調日',CS_PUNCH])];
  const rows=casts.map(s=>({s,t:csTerms(s,tm.data||[],m)}));
  const hallName=id=>halls.find(h=>h.id===id)?.display_name||'—';
  const E=csEdit==='cast', lock=!!csEdit&&!E;
  const sel=(k,v,os,dis)=>`<select data-k="${k}" ${dis?'disabled':''}>${os.map(([ov,on])=>`<option value="${esc(ov)}" ${String(v??'')===String(ov)?'selected':''}>${esc(on)}</option>`).join('')}</select>`;
  const inp=(k,v,w,dis)=>`<input data-k="${k}" inputmode="decimal" value="${esc(v??'')}" style="width:${w}px" ${dis?'disabled':''}>`;
  const yn=v=>v==null?'—':v;
  const PT={hourly:'時給',daily:'日給',seppan:'折半'};
  const cell=({s,t})=>{ const sp=t.pay_type==='seppan', daily=t.pay_type==='daily';
    const back=t.back_pct==null?(sp?'<span class="badge warnb">未設定</span>':'—'):`${Number(t.back_pct)}%`;
    const wf=t.welfare_mode==='amount'?yen(t.welfare_amount):t.welfare_mode==='none'?'なし':'標準';
    if(!E) return [hallName(s.manager_staff_id), PT[t.pay_type]||'時給', slTxt(s,t), daily&&t.daily_wage!=null?yen(t.daily_wage):'—', !sp&&t.guaranteed_wage!=null?yen(t.guaranteed_wage):'—',
      !sp&&t.guaranteed_wage!=null?csDate(t.guarantee_until):'—', !sp&&t.douhan_quota!=null?t.douhan_quota+'回':'—', back, t.withhold==null?'—':t.withhold?'する':'しない',
      t.ctax_pct==null?'—':Number(t.ctax_pct)+'%', wf, t.exempt_fines.length?esc(t.exempt_fines.join('・')):'—', s.day_pay_ok==null?'—':s.day_pay_ok?'可':'不可',
      s.contract_done==null?'—':s.contract_done?'<span class="badge k">済</span>':'<span class="badge warnb">未</span>'];
    const fe=t.guarantee_until===CS_FOREVER;
    return [sel('mgr',s.manager_staff_id||'',[['','未選択'],...halls.map(h=>[h.id,h.display_name])]),
      sel('pt',t.pay_type,[['hourly','時給'],['daily','日給'],['seppan','折半']]),
      `<button class="ghost sm" data-k="sl" data-v="${esc(JSON.stringify(slOk(t.slide_ids,unitOf(s,t))))}" ${sp?'disabled':''}>${slTxt(s,t)}</button>`, inp('dw',daily?t.daily_wage:'',80,!daily),
      inp('g',sp?'':t.guaranteed_wage,80,sp), `<span class="cs-gu"><input type="date" data-k="gu" value="${fe||sp?'':esc(t.guarantee_until||'')}" ${fe||sp?'disabled':''}><label><input type="checkbox" data-k="gf" ${fe&&!sp?'checked':''} ${sp?'disabled':''}>無期限</label></span>`,
      inp('q',sp?'':t.douhan_quota,50,sp)+' 回', inp('bk',t.back_pct==null?'':Number(t.back_pct),50)+' %',
      sel('wh',t.withhold==null?'':String(t.withhold),[['','—'],['true','する'],['false','しない']]), inp('ct',t.ctax_pct==null?'':Number(t.ctax_pct),50)+' %',
      sel('wm',t.welfare_mode,[['std','標準'],['amount','金額'],['none','なし']])+' '+inp('wa',t.welfare_amount,80,t.welfare_mode!=='amount'),
      `<button class="ghost sm" data-k="ex" data-v="${esc(JSON.stringify(t.exempt_fines))}">${t.exempt_fines.length?esc(t.exempt_fines.join('・')):'—'}</button>`,
      sel('dp',s.day_pay_ok==null?'':String(s.day_pay_ok),[['','—'],['true','可'],['false','不可']]), sel('ct2',s.contract_done==null?'':String(s.contract_done),[['','—'],['true','済'],['false','未']])]; };
  const HD=['担当黒服','報酬','スライド表','日給','保証時給','保証の期限','同伴ノルマ','小計バック','源泉徴収','消費税','厚生費','罰金の免除','日払（立替）','契約書','メモ'];
  box.innerHTML=`<div class="row" style="margin-bottom:8px;align-items:center"><h2 style="margin:0">キャスト</h2><span style="flex:1"></span>${ed?(E?'<button class="ghost" id="csCancel">キャンセル</button><button class="primary" id="csSave">保存</button>':(lock?csLockTag():`<button class="ghost" id="csAdd">＋追加</button><button class="ghost" id="csEd">編集</button>`)):''}</div>
  ${rows.length?`<div class="cs-w ${E?'editing':''}"><table class="reg cs"><tr><th class="nm">名前</th>${HD.map(h=>`<th>${h}</th>`).join('')}</tr>
  ${rows.map(r=>`<tr data-sid="${r.s.id}"><td class="nm">${E?esc(r.s.display_name):`<a data-open="${r.s.id}">${esc(r.s.display_name)}</a>`}${r.t.month===m&&r.t.only_month?`<br><small class="muted">${csMShort(m)}のみ</small>`:''}</td>${cell(r).map(c=>`<td>${c}</td>`).join('')}<td>${nc[r.s.id]?nc[r.s.id]+'件':'—'}</td></tr>`).join('')}</table></div>`
  :'<div class="card muted">在籍のキャストがいません</div>'}
  <div class="muted" style="font-size:13px;margin-top:10px;line-height:1.6">${E?'担当黒服・日払（立替）・契約書以外を変更すると、保存の時に「○月以降／○月のみ」を選びます':'名前を押すと、メモと個別設定が開きます'}${ed&&!E?'。修正は「編集」から':''}</div>`;
  box.querySelectorAll('[data-open]').forEach(a=>a.onclick=()=>{ const s=casts.find(x=>x.id===a.dataset.open); csDetail={store:st,s}; csTab='memo'; PAGES.set_cast(); }); // v0.44：メモを最初に開く
  if(!ed) return;
  if(!E){ if(lock) return; $('csEd').onclick=()=>{ csEdit='cast'; PAGES.set_cast(); }; $('csAdd').onclick=()=>staffEdit(st,null,'cast'); return; }
  $('csCancel').onclick=()=>{ csEdit=false; PAGES.set_cast(); };
  const tb=box.querySelector('table.cs');
  tb.querySelectorAll('tr[data-sid]').forEach(tr=>{ const q=k=>tr.querySelector(`[data-k=${k}]`);
    if(q('pt')) q('pt').onchange=()=>{ const v=q('pt').value, sp=v==='seppan'; q('dw').disabled=v!=='daily'; if(q('dw').disabled) q('dw').value='';
      if(q('sl')){ q('sl').dataset.v='[]'; q('sl').disabled=sp; q('sl').innerHTML=sp?'—':'<span class="badge warnb">未選択</span>'; }
      ['g','q','gf'].forEach(k=>{ q(k).disabled=sp; if(sp){ if(k==='gf') q(k).checked=false; else q(k).value=''; } }); q('gu').disabled=sp||q('gf').checked; if(sp) q('gu').value=''; };
    if(q('sl')) q('sl').onclick=()=>{ const u=q('pt')?.value==='daily'?'daily':'hourly', cur=JSON.parse(q('sl').dataset.v||'[]'), opts=tbls.filter(x=>x.unit===u);
      const md=modal(`<h2 style="margin:0">スライド表</h2><div class="muted" style="font-size:14px">${esc(rows.find(r=>r.s.id===tr.dataset.sid).s.display_name)}：使う表を選びます（${u==='daily'?'日給':'時給'}の表）。選んだ表と保証時給のうち一番高い金額になります</div>
        <div style="display:flex;flex-direction:column;gap:8px">${opts.map(o=>`<label style="display:flex;align-items:center;gap:8px;font-size:15px;color:var(--ink)"><input type="checkbox" style="width:auto;height:auto" value="${o.id}" ${cur.includes(o.id)?'checked':''}>${esc(o.name)}</label>`).join('')||`<div class="muted">${u==='daily'?'日給':'時給'}のスライド表がありません（報酬・罰金項目で作成します）</div>`}</div>
        <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">決める</button></div>`);
      md.querySelector('[data-k=no]').onclick=()=>md.remove();
      md.querySelector('[data-k=ok]').onclick=()=>{ const v=[...md.querySelectorAll('input:checked')].map(x=>x.value); q('sl').dataset.v=JSON.stringify(v); q('sl').innerHTML=v.length?esc(v.map(id=>slShort(tbls.find(x=>x.id===id).name)).join('・')):'<span class="badge warnb">未選択</span>'; md.remove(); }; };
    q('wm').onchange=()=>{ q('wa').disabled=q('wm').value!=='amount'; };
    q('gf').onchange=()=>{ q('gu').disabled=q('gf').checked||q('pt').value==='seppan'; };
    q('ex').onclick=()=>{ const cur=JSON.parse(q('ex').dataset.v||'[]'); const opts=[...new Set([...fines,...cur])];
      const md=modal(`<h2 style="margin:0">罰金の免除</h2><div class="muted" style="font-size:14px">${esc(rows.find(r=>r.s.id===tr.dataset.sid).s.display_name)}：チェックした罰金は付けません</div>
        <div style="display:flex;flex-direction:column;gap:8px">${opts.map(o=>`<label style="display:flex;align-items:center;gap:8px;font-size:15px;color:var(--ink)"><input type="checkbox" style="width:auto;height:auto" value="${esc(o)}" ${cur.includes(o)?'checked':''}>${esc(o)}</label>`).join('')}</div>
        <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">決める</button></div>`);
      md.querySelector('[data-k=no]').onclick=()=>md.remove();
      md.querySelector('[data-k=ok]').onclick=()=>{ const v=[...md.querySelectorAll('input:checked')].map(x=>x.value); q('ex').dataset.v=JSON.stringify(v); q('ex').textContent=v.length?v.join('・'):'—'; md.remove(); }; }; });
  const sv=$('csSave'); sv.onclick=guard(sv,async()=>{
    const out=[]; let needP=false;
    for(const {s,t} of rows){ const tr=tb.querySelector(`tr[data-sid="${s.id}"]`), q=k=>tr.querySelector(`[data-k=${k}]`), nm=s.display_name;
      const int=(k,l,max)=>{ const v=slNum(q(k).value); if(v==null) return null; if(!Number.isFinite(v)||v<0||(max!=null&&v>max)) throw `${nm}：${l}が正しくありません`; return v; };
      let so, to;
      try{ const pt=q('pt').value, dw=pt==='daily'?int('dw','日給'):null, sep=pt==='seppan';
        if(pt==='daily'&&!dw) throw `${nm}：日給を入力してください`;
        const b=v=>v===''?null:v==='true';
        so={manager_staff_id:q('mgr').value||null,day_pay_ok:b(q('dp').value),contract_done:b(q('ct2').value)};
        const g=sep?null:int('g','保証時給'), gf=q('gf').checked, gu=gf?CS_FOREVER:(q('gu').value||null), wm=q('wm').value, wa=wm==='amount'?int('wa','厚生費'):null, bk=int('bk','小計バック',100);
        if(wm==='amount'&&wa==null) throw `${nm}：厚生費の金額を入力してください`;
        if(sep&&bk==null) throw `${nm}：折半の人は、小計バックの％を入力してください`;
        to={guaranteed_wage:g==null?null:Math.round(g),guarantee_until:g==null?null:gu,douhan_quota:sep?null:(v=>v==null?null:Math.round(v))(int('q','同伴ノルマ')),back_pct:bk,back_mode:'add',
          withhold:b(q('wh').value),ctax_pct:int('ct','消費税',100),welfare_mode:wm,welfare_amount:wa==null?null:Math.round(wa),exempt_fines:JSON.parse(q('ex').dataset.v||'[]'),
          slide_ids:sep?null:(v=>v.length?v.sort():null)(q('sl')?JSON.parse(q('sl').dataset.v||'[]'):[]),pay_type:pt,daily_wage:dw==null?null:Math.round(dw),seppan_pct:null};
      }catch(e){ if(typeof e==='string'){ await uiAlert(e); return; } throw e; }
      const so0={manager_staff_id:s.manager_staff_id||null,day_pay_ok:s.day_pay_ok??null,contract_done:s.contract_done??null};
      const to0={guaranteed_wage:t.guaranteed_wage??null,guarantee_until:t.guaranteed_wage==null?null:(t.guarantee_until??null),douhan_quota:t.douhan_quota??null,back_pct:t.back_pct==null?null:Number(t.back_pct),back_mode:'add',
        withhold:t.withhold??null,ctax_pct:t.ctax_pct==null?null:Number(t.ctax_pct),welfare_mode:t.welfare_mode||'std',welfare_amount:t.welfare_mode==='amount'?(t.welfare_amount??null):null,exempt_fines:t.exempt_fines||[],
        slide_ids:(v=>v.length?v.sort():null)(slOk(t.slide_ids,unitOf(s,t))),pay_type:t.pay_type,daily_wage:t.daily_wage==null?null:Number(t.daily_wage),seppan_pct:null};
      const r={staff_id:s.id}; if(JSON.stringify(so)!==JSON.stringify(so0)) r.staff=so; if(JSON.stringify(to)!==JSON.stringify(to0)){ r.terms=to; needP=true;
        if(to.guaranteed_wage!=null&&!to.guarantee_until){ await uiAlert(`${nm}：保証の期限を入れるか、「無期限」を選んでください`); return; } } // v0.24：保証時給の期限は空欄にできない
      if(r.staff||r.terms) out.push(r); }
    if(!out.length){ csEdit=false; toast('変更はありません'); PAGES.set_cast(); return; }
    let only=false;
    if(needP){ const ans=await new Promise(res=>{ const md=modal(`<h2 style="margin:0">いつから変更しますか？</h2><div style="display:flex;flex-direction:column;gap:8px">
        <button class="ghost" data-v="after">${csMShort(m)}以降</button><button class="ghost" data-v="only">${csMShort(m)}のみ</button><button class="ghost" data-v="" style="border:none;color:var(--muted)">キャンセル</button></div>`);
        md.querySelectorAll('button').forEach(b=>b.onclick=()=>{ md.remove(); res(b.dataset.v); }); });
      if(!ans) return; only=ans==='only'; }
    const r=await rpc('admin_save_cast_settings',{p_store:st,p_month:m,p_only:only,p_rows:out}); if(!r.ok) return;
    csEdit=false; toast('保存しました'); PAGES.set_cast(); });
};

// v1.06・SQL 127：キャストのシフトの設定（希望出勤日数・出勤可能時間・出勤できる日のみ・入店日）。月に関係なし。POS のキャストの詳細からも入れられる
// 提出（v1.24 オーナー 2026-10-17「出勤できる日のみ」→「提出」）：出勤希望＝LINEマイページで「出勤できる日」を出す（自動作成で先に入れる）。休み希望＝「出勤できない日」を出す
// 入店日が空の子は、最初に出勤した日を入店日の代わりに使う（入店から2か月は売り出し中で先に入れる）
// v1.25・SQL 139：シフトの「優先」「控え」（オーナー 2026-10-17。本人には絶対に出さない＝管理サイトだけ）
// v1.61：優先と控えの間は「標準」（オーナー 2026-10-26「いわゆる普通が欲しい」→ 標準）
const rkTag=r=>` <small class="muted">${r>0?'優先':r<0?'控え':'標準'}</small>`;
// v1.61：ほかの表を編集中は、押せない「編集」「＋追加」を出さず、理由を出す（オーナー 2026-10-26「オーナーの私がさわれない」）
const csLockTag=()=>`<span class="muted" style="font-size:13px">${({cast:'キャスト',hall:'黒服',shift:'シフト'})[csEdit]||''}の表を編集中</span>`;
async function csShiftPart(box,st,ed,m){
  const r=await sb.rpc('admin_shift_staff',{p_store:st});
  if(page!=='set_cast'||storeId!==st||csMonth!==m||!box.isConnected) return;
  if(r.error){ box.innerHTML=`<h2 style="margin:0 0 8px">シフト</h2><div class="card err">${esc(/admin_shift_staff/.test(r.error.message)?'SQL 127 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const rows=r.data||[], E=csEdit==='shift', lock=!!csEdit&&!E;
  const sel=(k,v,os)=>`<select data-k="${k}">${os.map(([ov,on])=>`<option value="${esc(ov)}" ${String(v??'')===String(ov)?'selected':''}>${esc(on)}</option>`).join('')}</select>`;
  const cell=c=>!E?[c.week?`週 ${c.week}日`:'<span class="badge warnb">未設定</span>', c.earliest?`${c.earliest}〜`:'<span class="badge warnb">未設定</span>', c.ok_only?'出勤希望':'休み希望',
      c.joined?csDate(c.joined):c.since?csDate(c.since):'—']
    :[sel('w',c.week??'',[['','未設定'],...[1,2,3,4,5,6,7].map(n=>[n,`週 ${n}日`])]), sel('e',c.earliest??'',[['','未設定'],...SH_TIMES.map(t=>[t,t+'〜'])]),
      sel('o',String(!!c.ok_only),[['false','休み希望'],['true','出勤希望']]), `<input type="date" data-k="j" value="${esc(c.joined||'')}" style="width:auto">`];
  const HD=['希望出勤日数','出勤可能時間','提出','入店日'];
  box.innerHTML=`<div class="row" style="margin-bottom:8px;align-items:center"><h2 style="margin:0">シフト</h2><span style="flex:1"></span>${ed?(E?'<button class="ghost" id="cshCancel">キャンセル</button><button class="primary" id="cshSave">保存</button>':(lock?csLockTag():`<button class="ghost" id="cshEd">編集</button>`)):''}</div>
  ${rows.length?`<div class="cs-w ${E?'editing':''}"><table class="reg cs"><tr><th class="nm">名前</th>${HD.map(h=>`<th>${h}</th>`).join('')}</tr>
  ${rows.map(c=>`<tr data-sid="${c.id}"><td class="nm">${E?`<span style="display:flex;justify-content:space-between;align-items:center;gap:8px">${esc(c.name)}${sel('r',String(c.rank||0),[['1','優先'],['0','標準'],['-1','控え']])}</span>`:`<a data-shopen="${c.id}">${esc(c.name)}</a>${rkTag(c.rank)}`}</td>${cell(c).map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>`:'<div class="card muted">在籍のキャストがいません</div>'}
  <div class="muted" style="font-size:13px;margin-top:10px;line-height:1.6">優先：自動作成で同伴の次に入れる／控え：足りない日だけ入れる（管理サイトだけ・本人には出ない）<br>提出　休み希望：休む日を提出／出勤希望：出られる日を提出（自動作成で優先）<br>入店から2か月は売り出し中（自動作成で優先）${ed&&!E?'。修正は「編集」から':''}</div>`;
  // v1.14：シフトの表の名前からも、メモと個別設定を開く（キャストの表と同じ）
  box.querySelectorAll('[data-shopen]').forEach(a=>a.onclick=async()=>{ const q=await csList(st); const s=(q.data||[]).find(x=>x.id===a.dataset.shopen); if(!s) return; csDetail={store:st,s}; csTab='memo'; PAGES.set_cast(); });
  if(!ed) return;
  if(!E){ if(lock) return; $('cshEd').onclick=()=>{ csEdit='shift'; PAGES.set_cast(); }; return; }
  $('cshCancel').onclick=()=>{ csEdit=false; PAGES.set_cast(); };
  const sv=$('cshSave'); sv.onclick=guard(sv,async()=>{
    const out=[];
    for(const c of rows){ const tr=box.querySelector(`tr[data-sid="${c.id}"]`), q=k=>tr.querySelector(`[data-k=${k}]`);
      const x={id:c.id,week:q('w').value?Number(q('w').value):null,earliest:q('e').value||null,ok_only:q('o').value==='true',rank:Number(q('r').value),joined:q('j').value||null};
      if(x.week!==(c.week??null)||x.earliest!==(c.earliest||null)||x.ok_only!==!!c.ok_only||x.rank!==(c.rank||0)||x.joined!==(c.joined||null)) out.push(x); }
    if(!out.length){ csEdit=false; toast('変更はありません'); PAGES.set_cast(); return; }
    const q=await rpc('admin_shift_staff_save',{p_store:st,p_rows:out}); if(!q.ok) return;
    csEdit=false; toast('保存しました'); PAGES.set_cast(); });
}

// v1.16・SQL 136：キャスト・黒服の追加・基本情報の変更・在籍から外す（オーナー 2026-10-17「管理サイトでキャストや黒服を追加できるように。POS にもタイムカードにも」）
// 項目は POS の新規登録と同じ。名簿は POS・タイムカードと同じなので、ここで変えるとすべてに出る。報酬（時給／日給）は新規の時だけ（あとはスタッフ設定の表で月ごと）
async function staffEdit(st,s,kd){ const isNew=!s, q=await csList(st); const halls=(q.data||[]).filter(x=>x.kind==='hall'&&(!s||x.id!==s.id));
  // v1.27：折半は区分ではなく報酬（オーナー 2026-10-17「折半の場合は時給も日給もない。時給か日給か折半と言う選択肢が正しい」）
  const k0=s?(s.kind==='hall'?'hall':s.kakari_only?'kakari':s.is_trial?'trial':'cast'):(kd==='seppan'?'cast':kd);
  const KD=[['cast','キャスト'],['hall','黒服'],['trial','体験'],['kakari',`${KL}専用（店・ママなど。タイムカードに出ない）`]];
  const md=modal(`<h2 style="margin:0">${isNew?(kd==='hall'?'黒服の追加':'キャストの追加'):esc(s.display_name)+'　基本情報'}</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>源氏名<input id="seN" value="${esc(s?.display_name||'')}"></label><label>本名<input id="seR" value="${esc(s?.real_name||'')}"></label></div>
    <label>区分<select id="seK">${KD.map(([v,n])=>`<option value="${v}" ${v===k0?'selected':''}>${n}</option>`).join('')}</select></label>
    <div id="sePay" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>報酬<select id="seP">${isNew?'<option value="hourly">時給</option><option value="daily">日給</option>':'<option value="tbl">時給・日給</option>'}<option value="seppan" ${s?.is_seppan?'selected':''}>折半</option></select></label><label id="seDwB">日給（円）<input id="seDw" inputmode="numeric"></label></div>
    <div id="seTr" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>体験の報酬<select id="seTp"><option value="hourly" ${s?.trial_pay_type!=='daily'?'selected':''}>時給</option><option value="daily" ${s?.trial_pay_type==='daily'?'selected':''}>日給</option></select></label><label>金額（円）<input id="seTa" inputmode="numeric" value="${s?.trial_pay_amount||''}"></label></div>
    <label id="seMgB">担当黒服<select id="seMg"><option value="">未選択</option>${halls.filter(h=>h.is_active).map(h=>`<option value="${h.id}" ${s?.manager_staff_id===h.id?'selected':''}>${esc(h.display_name)}</option>`).join('')}</select></label>
    <label>インボイス番号<input id="seIv" value="${esc(s?.invoice_number||'')}" placeholder="T1234567890123" autocapitalize="characters"></label>
    <div class="muted" style="font-size:13px">${isNew?'追加すると、POS の在籍リストとタイムカードにも出ます':'変更は POS・タイムカードにもすぐ出ます'}${isNew&&kd!=='hall'?'。保証時給・スライド表などはスタッフ設定の表で':''}</div>
    <div class="bar">${isNew?'':'<button class="ghost" data-k="out" style="color:var(--warn);margin-right:auto">在籍から外す</button>'}<button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">${isNew?'追加':'保存'}</button></div>`);
  const v=id=>md.querySelector('#'+id), paint=()=>{ const k=v('seK').value; v('sePay').style.display=k==='cast'?'grid':'none'; v('seDwB').style.visibility=v('seP').value==='daily'?'':'hidden'; v('seTr').style.display=k==='trial'?'grid':'none'; v('seMgB').style.display=k==='hall'||k==='kakari'?'none':''; };
  v('seK').onchange=paint; v('seP').onchange=paint; paint();
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  const out=md.querySelector('[data-k=out]'); if(out) out.onclick=async()=>{ if(!await uiConfirm(`${s.display_name} を在籍から外しますか？\n過去のデータは残ります（POS・タイムカードから消えます）`,'在籍から外す','danger')) return; const x=await rpc('admin_staff_retire',{p_store:st,p_id:s.id}); if(!x.ok) return; md.remove(); toast('在籍から外しました'); csDetail=null; PAGES.set_cast(); };
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{ const sp=v('seK').value==='cast'&&v('seP').value==='seppan'; const row={display_name:v('seN').value.trim(),real_name:v('seR').value.trim(),kind:sp?'seppan':v('seK').value,pay_type:sp||v('seP').value==='tbl'?'hourly':v('seP').value,daily_wage:v('seDw').value.replace(/[^0-9]/g,''),
      trial_pay_type:v('seTp').value,trial_pay_amount:v('seTa').value.replace(/[^0-9]/g,''),manager_staff_id:v('seMg').value,invoice_number:v('seIv').value};
    if(!row.display_name){ await uiAlert('源氏名を入力してください'); return; }
    let restore=null; if(isNew){ const rr=await sb.rpc('admin_staff_retired',{p_store:st,p_name:row.display_name}); const R=rr.error?[]:(rr.data||[]);
      if(R.length){ if(await uiConfirm(`在籍から外した人に「${row.display_name}」がいます。その人を戻しますか？\n（戻すと、前の記録がつながります）`,'戻す')) restore=R[0].id; else if(!await uiConfirm(`別の人として「${row.display_name}」を追加しますか？`,'追加')) return; } }
    const x=await rpc('admin_staff_save',{p_store:st,p_id:s?s.id:null,p_row:row,p_restore:restore}); if(!x.ok) return;
    md.remove(); toast(restore?'戻しました':isNew?'追加しました':'保存しました'); if(csDetail&&s) csDetail.s={...s,display_name:row.display_name}; PAGES.set_cast(); }); }
