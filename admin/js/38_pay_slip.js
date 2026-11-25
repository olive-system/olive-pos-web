// ---------- 報酬支払明細書（［スタッフ］の名前を押すと開く小窓）。左は今の報酬明細（PDF）と同じ項目・同じ言葉、右は1日1行（上に合計） ----------
// データは admin_cast_slip（SQL 703・読むだけ）。修正・取消は SQL 704 の入口（admin_slip_edit・admin_slip_cancel）と今の打刻の入口（admin_punch_fix・admin_punch_add）を呼ぶだけ
// ［修正］［取消］は「給与の修正」の人だけ（admin_pay_edit）。固まった月（受取のサイン・毎月1日の確定の後）は見るだけ（オーナー 2026-11-25）
// オーナー本人は日の小窓の中でその場で直す。オーナー以外の権限の人は、理由を入れる2つ目の小窓を通す（オーナー 2026-11-25）
// 小窓の中にダウンロードは置かない（明細を確かめる物。PDF・Excel は今のスタッフ画面のボタンのまま）
const SLIP_ORDER=['遅刻','無断遅刻','早退','当日欠勤','無断欠勤','打刻漏れ','新調日','同伴ノルマ'];
async function slipOpen(staffId,m,day){ const st=storeId;
  const [r,pe,ed]=await Promise.all([sb.rpc('admin_cast_slip',{p_store:st,p_staff:staffId,p_month:m}), sb.rpc('admin_pay_edit',{p_store:st}),
    sb.from('slip_edits').select('*').eq('store_id',st).eq('staff_id',staffId).gte('business_date',m).lt('business_date',csAddMonth(m,1)).order('edited_at')]);
  if(r.error){ await uiAlert(r.error.message); return; }
  const D=r.data||{}, mr=D.month_row||{}; if(!D.month_row){ await uiAlert('この月の明細はありません'); return; }
  const fixed=!!(mr.locked||mr.fixed), can=!pe.error&&pe.data===true&&!fixed;
  const S={st,staffId,m:String(D.month||m).slice(0,10),D,can,own:!!me?.is_owner,edits:ed.error?[]:(ed.data||[]),hall:D.kind==='hall',changed:false};
  document.querySelector('.modal.slipm')?.remove();
  const el=mkModal(55); el.classList.add('slipm'); el.innerHTML=`<div class="box"><button class="xb dx" data-x aria-label="閉じる">×</button><div class="slw"><div class="sll">${slipLeft(S)}</div><div class="slr">${slipRight(S)}</div></div></div>`;
  document.body.appendChild(el);
  el.querySelector('[data-x]').onclick=()=>{ el.remove(); if(S.changed&&page==='cast_sales') PAGES.cast_sales(); };
  el.querySelectorAll('[data-sld]').forEach(b=>b.onclick=()=>slipDay(S,b.dataset.sld));
  if(day) slipDay(S,day);
  return S; }
const slipN=v=>Number(v)||0, slipY=v=>slipN(v)?slipN(v).toLocaleString('ja-JP'):'--';
const slipHM=t=>t?`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`:'--';
const slipMins=(i,o)=>{ if(!i||!o) return 0; const [a,b]=i.split(':').map(Number), [c,d]=o.split(':').map(Number); let v=(c*60+d)-(a*60+b); if(v<0) v+=1440; return v; };
const slipFB=k=>String(k).replace(/（(?:シフト|予定)\d[^）]*）$/,''); /* ksFineBase と同じ */
const slipDl=s=>{ const d=new Date(s+'T00:00:00'); return String(d.getDate()).padStart(2,'0')+'('+'日月火水木金土'[d.getDay()]+')'; };
const slipMd=s=>{ const d=new Date(s+'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）`; };
function slipFT(S){ const D=S.D; return [...new Set([...Object.keys(D.month_row.fine_items||{}),...(D.days||[]).flatMap(x=>(x.fines||[]).map(f=>f.reason))].map(slipFB))].sort((a,b)=>a.localeCompare(b,'ja')); }
/* 左：今の報酬明細（PDF）の ksSlips と同じ項目・同じ順 */
function slipLeft(S){ const m=S.D.month_row, n=slipN, Y=slipY, own=S.own, FT=slipFT(S), [y,mo]=S.m.split('-').map(Number);
  const one=(k,v,c='')=>`<tr class="${c}"><td class="k" colspan="2">${k}</td><td class="v">${v}</td></tr>`;
  const grp=(name,rs)=>rs.map((r,i)=>`<tr class="${r[2]||''}">${i===0?`<td class="gl" rowspan="${rs.length}">${[...name].join('<br>')}</td>`:''}<td class="k">${r[0]}</td><td class="v">${r[1]}</td></tr>`).join('');
  const ded=n(m.ctax)+n(m.fines)+n(m.quota_fine)+n(m.welfare)+n(m.special_deduct), net=(n(m.net)<0?'−':'')+'¥'+Math.abs(n(m.net)).toLocaleString('ja-JP');
  const HMJ=h=>{ const t=Math.round(n(h)*60); return `${Math.floor(t/60)}時間${String(t%60).padStart(2,'0')}分`; };
  const head=`<div class="slh"><div class="t">報酬支払明細書</div><div>令和 ${y-2018}年 ${mo}月分</div><div>${esc(curStore()?.name||'')}</div><div class="nm">${esc(m.name)}</div></div>`;
  if(!S.hall){ const pay=[[m.pay_type==='daily'?'報酬（日給）':'報酬（時給）',Y(m.time_pay)],['小計バック',Y(m.kakari_back)],...(m.seppan?[[`折半（${n(m.seppan_pct)}%）`,Y(m.seppan_pay)]]:[]),['HC',Y(m.backs?.hc?.amount)],['ボトルバック',Y(m.backs?.bottle?.amount)],['商品バック',Y(m.backs?.other?.amount)],['手当など、その他',Y(n(m.allowance)+n(m.special_pay))],['合計',Y(m.taxable),'sum']];
    const dd=[['消費税',Y(m.ctax)],...FT.map(f=>[esc(f),Y((m.fine_items||{})[f]||Object.entries(m.fine_items||{}).reduce((a,[k,v])=>slipFB(k)===f?a+n(v):a,0))]),['同伴ノルマ',Y(m.quota_fine)],['厚生費',Y(m.welfare)],...(own?[['個別控除',Y(m.special_deduct)]]:[]),['合計',Y(ded),'sum']];
    return `${head}<table class="slL">${one('稼働日数',n(m.days)+'日')}${one('稼働時間',HMJ(m.hours))}${one(m.pay_type==='daily'?'決定日給':'決定時給',Y(m.wage))}${n(m.points)?one('ポイント',n(m.points).toLocaleString('ja-JP',{maximumFractionDigits:1})):''}
      ${grp('支給対象',pay)}${grp('控除対象',dd)}${one('総支給額',Y(n(m.taxable)-ded))}${one('課税対象額',Y(m.taxable))}${one('源泉徴収',Y(m.withholding))}${one('日払',Y(n(m.advance)-n(m.tatekae)))}${one('立替',Y(m.tatekae))}${one('残り支給額',net,'big')}</table>`; }
  const pay=[[`基本給（${CS_HPAY[m.pay_type]||'—'}）`,Y(m.base)],[(m.absent_days||[]).length?'遅刻・早退・欠勤':'遅刻・早退',n(m.late_deduct)?'−'+Y(m.late_deduct):'--'],['ボーナス',Y(m.bonus)],['手当など、その他',Y(n(m.allowance)+n(m.special_pay))],['合計',Y(m.taxable),'sum']];
  const dd=[['消費税',Y(m.ctax)],['罰金',Y(m.fines)],['厚生費',Y(m.welfare)],...(own?[['個別控除',Y(m.special_deduct)]]:[]),['合計',Y(ded),'sum']];
  return `${head}<table class="slL">${one('稼働日数',n(m.days)+'日')}${one('稼働時間',HMJ(m.hours))}${one('遅刻・早退',`${n(m.late_min)+n(m.early_min)}分`)}
    ${grp('支給対象',pay)}${grp('控除対象',dd)}${one('総支給額',Y(n(m.taxable)-ded))}${one('課税対象額',Y(m.taxable))}${one('源泉徴収',Y(m.withholding))}${one('日払（立替）',Y(m.advance))}${one('残り支給額',net,'big')}</table>`; }
/* 右：1日1行。上に合計。罰金の列はその月に出た名前だけ（PDF・Excel と同じ並び） */
function slipRight(S){ const D=S.D, m=D.month_row, n=slipN, FT=slipFT(S), BY=Object.fromEntries((D.days||[]).map(x=>[x.date,x]));
  const end=new Date(+S.m.slice(0,4),+S.m.slice(5,7),0).getDate(), dates=Array.from({length:end},(_,i)=>S.m.slice(0,8)+String(i+1).padStart(2,'0'));
  const fineOf=(x,t)=>((x&&x.fines)||[]).filter(f=>slipFB(f.reason)===t).reduce((a,f)=>a+n(f.amount),0);
  let head,rowOf,TXT;
  if(!S.hall){ TXT=[2,3,4];
    rowOf=x=>{ const r=(x&&x.row)||{}, b=r.backs||{}, at=(x&&x.att)||{};
      return [n(r.sales),n(r.honkei),at.in||'',at.out||'',r.hours?slipHM(Math.round(r.hours*60)):'',n(r.kakari_back),n(b.hc?.qty),n(b.hc?.amount),n(b.bottle?.qty),n(b.bottle?.amount),n(b.other?.amount),n(r.kakari_back)+n(r.item_back),n(r.allowance)+n(r.special_pay),n(r.advance)-n(r.tatekae),n(r.tatekae),...FT.map(t=>fineOf(x,t)),FT.reduce((a,t)=>a+fineOf(x,t),0)]; };
    head=`<tr><th rowspan="2">日付</th><th rowspan="2">${KL}小計</th><th rowspan="2">${KL}本計</th><th colspan="3">タイムカード</th><th rowspan="2">小計<br>バック</th><th colspan="2">HC</th><th colspan="2">ボトルバック</th><th rowspan="2">商品<br>バック</th><th rowspan="2">バック計</th><th rowspan="2">手当など、<br>その他</th><th rowspan="2">日払</th><th rowspan="2">立替</th>${FT.length?`<th colspan="${FT.length+1}">マイナス</th>`:''}${S.can?'<th rowspan="2">修正</th>':''}</tr>
      <tr><th>出勤</th><th>退勤</th><th>時間</th><th>本数</th><th>金額</th><th>本数</th><th>金額</th>${FT.length?FT.map(t=>`<th class="vt">${esc(t)}</th>`).join('')+'<th class="vt">計</th>':''}</tr>`;
  } else { TXT=[0,1,2];
    rowOf=x=>{ const at=(x&&x.att)||{}, a=(x&&x.adv)||{}, L=x&&x.late;
      return [at.in||'',at.out||'',slipHM(slipMins(at.in,at.out)),L?n(L.min):0,L&&!L.nocontact?n(L.amount):0,L&&L.nocontact?n(L.amount):0,x&&x.early?n(x.early.min):0,x&&x.absent?n(x.absent.amount):0,...FT.map(t=>fineOf(x,t)),FT.reduce((s,t)=>s+fineOf(x,t),0),n(a.allowance),n(a.advance)]; };
    head=`<tr><th rowspan="2">日付</th><th colspan="3">タイムカード</th><th colspan="5">遅刻・早退・欠勤</th>${FT.length?`<th colspan="${FT.length+1}">罰金</th>`:''}<th rowspan="2">手当など、<br>その他</th><th rowspan="2">日払<br>（立替）</th>${S.can?'<th rowspan="2">修正</th>':''}</tr>
      <tr><th>出勤</th><th>退勤</th><th>時間</th><th>遅刻<br>（分）</th><th>遅刻</th><th>無断<br>遅刻</th><th>早退<br>（分）</th><th>欠勤</th>${FT.length?FT.map(t=>`<th class="vt">${esc(t)}</th>`).join('')+'<th class="vt">計</th>':''}</tr>`; }
  const rows=dates.map(ds=>({ds,x:BY[ds]||null,v:rowOf(BY[ds]||null)}));
  if(!FT.length){ const i=S.hall?8:15; rows.forEach(r=>r.v.splice(i,1)); }
  const tot=rows[0].v.map((_,i)=>TXT.includes(i)?'':rows.reduce((a,r)=>a+(typeof r.v[i]==='number'?r.v[i]:0),0));
  if(!S.hall){ tot[0]=n(m.sales); tot[1]=n(m.honkei); tot[4]=slipHM(Math.round(n(m.hours)*60)); } else tot[2]=slipHM(rows.reduce((a,r)=>a+slipMins(r.x?.att?.in,r.x?.att?.out),0));
  const cell=(v,i)=>`<td>${TXT.includes(i)?(v||'--'):(typeof v==='number'?slipY(v):v)}</td>`;
  const vh=Math.max(4,...FT.map(t=>t.length))*14+16;
  return `<table class="slR" style="--vh:${vh}px"><thead>${head}</thead><tbody><tr class="tot"><td class="d">合計</td>${tot.map(cell).join('')}${S.can?'<td></td>':''}</tr>
    ${rows.map(r=>`<tr data-row="${r.ds}"><td class="d">${slipDl(r.ds)}</td>${r.v.map(cell).join('')}${S.can?`<td class="op"><button class="ghost sm" data-sld="${r.ds}">修正</button></td>`:''}</tr>`).join('')}</tbody></table>`; }
/* 日の小窓：その日の記録を1件ずつ。［修正］［取消］は今の入口を呼ぶ */
function slipDayItems(S,ds){ const x=(S.D.days||[]).find(z=>z.date===ds)||{}, r=x.row||{}, at=x.att||{}, a=x.adv||{}, n=slipN, it=[];
  it.push({k:'clock_in',label:'出勤',val:at.in||'',id:at.in_id||null,time:true});
  it.push({k:'clock_out',label:'退勤',val:at.out||'',id:at.out_id||null,time:true});
  if(!S.hall&&(n(r.sales)||n(r.honkei))) it.push({k:'bill',label:`${KL}小計・${KL}本計`,val:`${slipY(r.sales)}／${slipY(r.honkei)}`});
  (x.fines||[]).forEach(f=>it.push({k:'fine',label:slipFB(f.reason),reason:f.reason,val:n(f.amount),id:f.id}));
  if(S.hall&&x.late) it.push({k:'late',label:`${x.late.nocontact?'無断遅刻':'遅刻'}　${n(x.late.min)}分`,val:n(x.late.amount)});
  if(S.hall&&x.absent) it.push({k:'absent',label:x.absent.nocontact?'無断欠勤':'欠勤',val:n(x.absent.amount)});
  const al=S.hall?n(a.allowance):n(r.allowance), adv=n(a.advance)-n(a.tatekae), tat=n(a.tatekae);
  if(al) it.push({k:'allowance',label:'手当',val:al,id:a.id,memo:a.memo});
  if(adv) it.push({k:'advance',label:S.hall?'日払（立替）':'日払',val:adv,id:a.id});
  if(tat) it.push({k:'tatekae',label:'立替',val:tat,id:a.id});
  return it; }
function slipDay(S,ds){ document.querySelector('.modal.slipd')?.remove(); const it=slipDayItems(S,ds);
  const E=S.edits.filter(e=>e.business_date===ds), KN={allowance:'手当',advance:'日払',tatekae:'立替',fine:'罰金',absent:'欠勤',late:'遅刻',clock_in:'出勤',clock_out:'退勤'};
  const v=x=>x.time?(x.val||'--'):(typeof x.val==='number'?slipY(x.val):x.val);
  const btn=(x)=>{ if(!S.can) return '<span></span><span></span>'; if(x.k==='bill') return '<button class="ghost sm" data-b="bill">伝票</button><span></span>';
    if(x.time&&!x.id) return '<button class="ghost sm" data-e>追加</button><span></span>'; return '<button class="ghost sm" data-e>修正</button><button class="ghost sm" data-c>取消</button>'; };
  const el=mkModal(60); el.classList.add('slipd'); el.innerHTML=`<div class="box"><button class="xb dx" data-x aria-label="閉じる">×</button><div style="font-weight:700;font-size:18px">${slipMd(ds)}　${esc(S.D.month_row.name)}</div>
    <div class="sdl">${it.map((x,i)=>`<div class="sdr" data-i="${i}"><span>${esc(x.label)}</span><span class="v">${v(x)}</span>${btn(x)}</div>`).join('')}</div>
    ${E.length?`<div class="sdh">${E.map(e=>`<div><span>${esc(KN[e.kind]||e.kind)}${e.memo&&e.kind==='fine'?' '+esc(slipFB(e.memo)):''}</span><span>${e.action==='cancel'?`<s>${slipY(e.amount)}</s>　取消`:`${slipY(e.amount)} → ${slipY(e.new_amount)}　修正`}　${esc(e.edited_by||'')}${e.reason?'　'+esc(e.reason):''}</span></div>`).join('')}</div>`:''}</div>`;
  document.body.appendChild(el); el.querySelector('[data-x]').onclick=()=>el.remove();
  el.querySelector('[data-b=bill]')?.addEventListener('click',()=>{ el.remove(); document.querySelector('.modal.slipm')?.remove(); blFrom=blTo=ds; go('bills'); });
  el.querySelectorAll('.sdr').forEach(rw=>{ const x=it[+rw.dataset.i];
    rw.querySelector('[data-e]')?.addEventListener('click',()=>slipEdit(S,ds,x,rw,it));
    rw.querySelector('[data-c]')?.addEventListener('click',()=>slipCancel(S,ds,x,rw)); }); }
/* 打刻の時刻（その営業日の 8:00〜翌 8:00。8:00 より前は次の日の時刻） */
const slipAt=(ds,t)=>`${t<'08:00'?dayAdd(ds,1):ds}T${t}:00+09:00`;
/* 理由を入れる2つ目の小窓（オーナー以外）。金額・時刻があれば一緒に */
function slipAsk(title,line,inp){ return new Promise(res=>{ const el=mkModal(65); el.innerHTML=`<div class="box"><div style="font-weight:700">${title}</div><div>${line}</div>
    ${inp?`<label>${inp.label}<input id="saV" ${inp.time?'type="time"':'inputmode="numeric"'} value="${esc(inp.val??'')}"></label>`:''}${inp?.memo!=null?`<label>項目<input id="saM" value="${esc(inp.memo)}"></label>`:''}
    <label>理由（必須）<input id="saR"></label><div class="bar"><button class="ghost" data-k="no">閉じる</button><button class="primary" data-k="ok">${title}</button></div></div>`;
    document.body.appendChild(el); const q=s=>el.querySelector(s);
    q('[data-k=no]').onclick=()=>{ el.remove(); res(null); };
    q('[data-k=ok]').onclick=async()=>{ const r=q('#saR').value.trim(); if(!r){ await uiAlert('理由を入力してください'); return; } const o={r,v:q('#saV')?.value.trim(),m:q('#saM')?.value.trim()}; el.remove(); res(o); }; }); }
async function slipEdit(S,ds,x,rw,it){
  if(x.k==='late'||x.k==='absent'){ const ci=it.findIndex(z=>z.k==='clock_in'); const r2=rw.parentNode.querySelector(`.sdr[data-i="${ci}"]`); return slipEdit(S,ds,it[ci],r2,it); } /* 遅刻・欠勤の額は給与の計算で出るので、出勤の打刻を直す・足す */
  const money=!x.time, line=`${slipMd(ds)}　${esc(S.D.month_row.name)}　${esc(x.label)}${x.val!==''?'　'+(money?slipY(x.val)+'円':x.val):''}`;
  let val,memo=null,reason='';
  if(S.own){ /* オーナーはその場で */
    const sp=rw.querySelector('.v'), b=rw.querySelector('[data-e]'); if(b.dataset.on){ val=rw.querySelector('input.sv').value.trim(); memo=rw.querySelector('input.sm')?.value.trim()??null; }
    else { b.dataset.on='1'; b.textContent='保存'; sp.innerHTML=`${x.k==='fine'?`<input class="sm" value="${esc(x.reason||'')}" style="width:9em">`:''}<input class="sv" ${x.time?'type="time"':'inputmode="numeric"'} value="${esc(x.time?x.val:String(x.val??''))}" style="width:7em;text-align:right">`; rw.querySelector('input.sv').focus(); return; } }
  else { const o=await slipAsk(x.time&&!x.id?'追加':'修正',line,{label:x.time?'時刻':'金額（円）',time:x.time,val:x.time?x.val:x.val,memo:x.k==='fine'?(x.reason||''):null}); if(!o) return; val=o.v; memo=o.m??null; reason=o.r; }
  let z;
  if(x.time){ if(!/^\d{1,2}:\d{2}$/.test(val||'')){ await uiAlert('時刻を入力してください'); return; }
    z=x.id?await rpc('admin_punch_fix',{p_event:x.id,p_at:slipAt(ds,val),p_reason:reason||null}):await rpc('admin_punch_add',{p_store:S.st,p_staff:S.staffId,p_type:x.k,p_date:ds,p_at:slipAt(ds,val)}); }
  else { const a=slNum(val); if(!(Number.isInteger(a)&&a>=0)){ await uiAlert('金額は0以上の整数で入力してください'); return; }
    z=await rpc('admin_slip_edit',{p_kind:x.k,p_id:x.id||null,p_amount:a,p_reason:reason||null,p_staff:S.staffId,p_date:ds,p_memo:memo||null}); }
  if(!z.ok) return; toast('修正しました'); slipReload(S,ds); }
async function slipCancel(S,ds,x,rw){
  const kind=x.k, line=`${slipMd(ds)}　${esc(S.D.month_row.name)}　${esc(x.label)}　${x.time?x.val:slipY(x.val)+'円'}`;
  let reason='';
  if(S.own){ const b=rw.querySelector('[data-c]'); if(!b.dataset.on){ b.dataset.on='1'; b.textContent='確定'; setTimeout(()=>{ if(b.isConnected){ delete b.dataset.on; b.textContent='取消'; } },4000); return; } } /* オーナーは2回押しで取消（小窓を出さない） */
  else { const o=await slipAsk('取消',line+(kind==='clock_in'&&S.hall?'<div class="muted" style="font-size:13px">出勤を取り消すと欠勤になります</div>':''),null); if(!o) return; reason=o.r; }
  const id=(kind==='late'||kind==='absent')?S.staffId:x.id;
  const z=await rpc('admin_slip_cancel',{p_kind:kind,p_id:id,p_reason:reason||null,p_date:ds}); if(!z.ok) return; toast('取り消しました'); slipReload(S,ds); }
async function slipReload(S,ds){ S.changed=true; const T=await slipOpen(S.staffId,S.m,ds); if(T) T.changed=true; }
