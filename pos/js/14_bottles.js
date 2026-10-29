// ---------- ボトル（全ボトルの一覧・ご来店のないお客様の抽出・期限切れ） ----------
function ymdJa(d){ const m=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${+m[1]}年${+m[2]}月${+m[3]}日`:''; }
function sDate(d){ if(!d) return ''; const [y,m,dd]=String(d).slice(0,10).split('-'); return (y==String(new Date().getFullYear())?'':y+'/')+Number(m)+'/'+Number(dd); }
function expLine(b){ return `${b.name}　${b.remaining??0}/10　${(d=>d?d.slice(0,10).split('-').map(Number).join('/'):'')(b.expired_on)} ${b.moved?'ボトル移動':'期限切れ'}`; } /* v10.84：日付は 2026/9/29 の形 */
function knLabel(b,cname){ return b.keep_name&&b.keep_name!==cname?`（キープ名：${b.keep_name}）`:''; }
async function expireBottle(b,cname){ if(!b) return false; if(!await uiConfirm(`${b.name}（残り ${b.remaining??0}/10）を期限切れにしますか？\n残量はこのまま記録されます。`)) return false; const d=businessDate(); const { error } = await sb.from('customer_bottles').update({expired_on:d,updated_at:new Date().toISOString()}).eq('id',b.id); if(error){ toast(error.message.includes('column')?'SQL 017 が未適用です：'+error.message:error.message); return false; } await logOp('ボトル期限切れ',{customer:cname,bottle:b.name,remaining:b.remaining},null,true); b.expired_on=d; toast('期限切れにしました'); return true; }
// v10.75：ボトル移動（移動先は記録しない。日付と残量を残してキープから外す。SQL 045）
async function moveBottle(b,cname){ if(!b) return false; if(!await uiConfirm(`${b.name}（${b.remaining??0}/10）をボトル移動にしますか？\n移動日と残量が記録されます。`)) return false; const d=businessDate(); const { error } = await sb.from('customer_bottles').update({expired_on:d,moved:true,updated_at:new Date().toISOString()}).eq('id',b.id); if(error){ toast(error.message.includes('moved')?'SQL 045 が未適用です：'+error.message:error.message); return false; } await logOp('ボトル移動',{customer:cname,bottle:b.name,remaining:b.remaining},null,true); b.expired_on=d; b.moved=true; toast('ボトル移動にしました'); return true; }
/* v12.30：期限切れ・移動を戻すボタンは v10.86 から出していないので unexpireBottle は消した */
function btMonths(){ return Number(settings?.bottle_keep_months)||6; } /* v10.99：お店の設定（ボトルのキープ期間）と同じ。顧客サイトと同じ */
/* v10.99：1回に1000件までしか返らないので、1000件ずつ全部読む（お客様5000件以上に対応） */
// v11.01：係は店舗ごと（SQL 048 の customer_kakari）。読み込んだお客様の kakari_staff_id を、この店舗の係に置き換える
const CUSEL='*,customer_kakari(store_id,staff_id)';
/* メモを行ごとに合わせる（3者マージ）。base＝書き始めた時のメモ、mine＝自分の入力、theirs＝ほかで変わった今のメモ。同じ所を両方が別々に直した時だけ conflicts に入る */
function memoMerge(base,mine,theirs){ const L=s=>s?String(s).replace(/\r/g,'').split('\n'):[]; const b=L(base), m=L(mine), t=L(theirs), J=a=>a.join('\n');
  if(J(m)===J(t)||J(t)===J(b)) return {lines:m,conflicts:[]}; if(J(m)===J(b)) return {lines:t,conflicts:[]};
  const hunks=(a,o)=>{ const n=a.length, k=o.length, d=Array.from({length:n+1},()=>new Int32Array(k+1)); for(let i=n-1;i>=0;i--) for(let j=k-1;j>=0;j--) d[i][j]=a[i]===o[j]?d[i+1][j+1]+1:Math.max(d[i+1][j],d[i][j+1]);
    const h=[]; let i=0,j=0,cur=null; const flush=()=>{ if(cur){ h.push(cur); cur=null; } };
    while(i<n||j<k){ if(i<n&&j<k&&a[i]===o[j]){ flush(); i++; j++; } else if(j<k&&(i>=n||d[i][j+1]>=d[i+1][j])){ cur=cur||{s:i,e:i,lines:[]}; cur.lines.push(o[j]); j++; } else { cur=cur||{s:i,e:i,lines:[]}; cur.e=i+1; i++; } }
    flush(); return h; };
  const all=[...hunks(b,m).map(x=>({...x,w:'m'})),...hunks(b,t).map(x=>({...x,w:'t'}))].sort((x,y)=>x.s-y.s||x.e-y.e);
  const hit=(x,y)=>(x.s===x.e&&y.s===y.e)?x.s===y.s:(x.s===x.e?(x.s>y.s&&x.s<y.e):y.s===y.e?(y.s>x.s&&y.s<x.e):Math.max(x.s,y.s)<Math.min(x.e,y.e));
  const groups=[]; for(const x of all){ const g=groups[groups.length-1]; if(g&&g.some(y=>y.w!==x.w&&hit(x,y))){ g.push(x); g.S=Math.min(g.S,x.s); g.E=Math.max(g.E,x.e); } else { const ng=[x]; ng.S=x.s; ng.E=x.e; groups.push(ng); } }
  const side=(g,w)=>{ const out=[]; let p=g.S; for(const x of g.filter(y=>y.w===w)){ out.push(...b.slice(p,x.s),...x.lines); p=x.e; } out.push(...b.slice(p,g.E)); return out; };
  const out=[], conflicts=[]; let p=0;
  for(const g of groups){ out.push(...b.slice(p,g.S)); const ws=new Set(g.map(x=>x.w));
    if(ws.size===1){ out.push(...side(g,g[0].w)); }
    else { const vm=side(g,'m'), vt=side(g,'t');
      if(J(vm)===J(vt)) out.push(...vm);
      else if(g.S===g.E) out.push(...vt,...vm); // 同じ所に両方が書き足した時は、両方残す（先に入っていた方が上）
      else { conflicts.push({at:out.length,mine:vm,theirs:vt}); } }
    p=Math.max(p,g.E); }
  out.push(...b.slice(p)); return {lines:out,conflicts}; }
/* conflicts の choice（'m'／'t'／'b'）で仕上げる */
function memoMergeDone(r,choices){ const out=[...r.lines]; for(let i=r.conflicts.length-1;i>=0;i--){ const c=r.conflicts[i], ch=choices[i]; out.splice(c.at,0,...(ch==='m'?c.mine:ch==='t'?c.theirs:[...c.theirs,...c.mine])); } return out.join('\n'); }
function pickClash(x){ return new Promise(res=>{ const m=document.createElement('div'); m.className='modal on'; m.style.zIndex=60; const bx=t=>`<div style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-top:4px">${esc(t.join('\n'))||'<span class="muted">（削除）</span>'}</div>`;
  m.innerHTML=`<div class="box" style="width:min(520px,94vw)"><div style="font-size:18px;font-weight:700">同じ箇所をほかの人も修正していました</div><div class="muted" style="font-size:13px">どちらを残しますか？</div><div style="margin-top:10px">あなた${bx(x.mine)}</div><div style="margin-top:8px">ほかの人${bx(x.theirs)}</div><div class="bar" style="justify-content:flex-end;margin-top:12px"><button class="ghost" data-v="x">キャンセル</button><button class="ghost" data-v="b">両方残す</button><button class="ghost" data-v="t">ほかの人</button><button class="primary" data-v="m">あなた</button></div></div>`;
  document.body.appendChild(m); m.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ m.remove(); res(b.dataset.v==='x'?null:b.dataset.v); }); }); }
function cuK(c){ if(!c||!('customer_kakari' in c)) return c; const k=(c.customer_kakari||[]).find(x=>x.store_id===store?.id); delete c.customer_kakari; c.kakari_staff_id=k?k.staff_id:null; return c; }
async function cuLoadAll(){ let r=await sbAll(()=>sb.from('customers').select(CUSEL).order('name').order('id')); if(r.error&&/customer_kakari/.test(r.error.message)){ toast((/does not exist|schema cache/.test(r.error.message)?'SQL 048 が未実行です：':''+KL+'を読み込めません：')+r.error.message); r=await sbAll(()=>sb.from('customers').select('*').order('name').order('id')); } return r; }
/* v12.30：お客様は最初に全部読み、あとは更新・登録の時刻が前に読んだ一番新しい時刻（5分の余裕）より後の人だけ読む。消えた人に気づくため10分ごとに全部読む */
let cuMax=0, cuFullAt=0; const cuStamp=c=>Math.max(Date.parse(c?.updated_at)||0,Date.parse(c?.created_at)||0);
function cuMark(full,list){ if(full) cuFullAt=Date.now(); for(const c of (list||customers)) cuMax=Math.max(cuMax,cuStamp(c)); }
async function cuPull(){ if(!cuMax||Date.now()-cuFullAt>=600000){ const r=await cuLoadAll(); if(r.error||!r.data) return r; r.data.forEach(cuK); cuMax=0; cuMark(true,r.data); return {data:r.data,error:null}; }
  const since=new Date(cuMax-300000).toISOString(); const r=await sbAll(()=>sb.from('customers').select(CUSEL).or(`updated_at.gte."${since}",created_at.gte."${since}"`).order('id')); if(r.error||!r.data) return r; r.data.forEach(cuK); cuMark(false,r.data);
  const up=new Map(r.data.map(c=>[c.id,c])); const out=customers.map(c=>up.get(c.id)||c); const have=new Set(customers.map(c=>c.id)); r.data.forEach(c=>{ if(!have.has(c.id)) out.push(c); }); return {data:out,error:null}; }
async function sbAll(mk){ let all=[]; for(let from=0;;from+=1000){ const r=await mk().range(from,from+999); if(r.error) return {data:all.length?all:null,error:r.error}; all=all.concat(r.data||[]); if((r.data||[]).length<1000) return {data:all,error:null}; } }
/* v10.99：並び順を顧客サイトとそろえる（名前・卓名は日本語順、数字は数の順） */
function jaCmp(a,b){ return (jaCmp.c||(jaCmp.c=new Intl.Collator('ja',{numeric:true}))).compare(String(a??''),String(b??'')); }
function btSort(list){ return list.sort((a,b)=>String(b.opened_on||'').localeCompare(String(a.opened_on||''))||String(a.id).localeCompare(String(b.id))); }
function btCutoff(n){ const [y,m,d]=businessDate().split('-').map(Number); const x=new Date(y,m-1-(n||btMonths()),1); x.setDate(Math.min(d,new Date(x.getFullYear(),x.getMonth()+1,0).getDate())); /* v11.32：月末のずれを直す（8/31 の6か月前は 2/28。前は 3/3 になった） */ return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
// 顧客一覧に出す情報：最終来店日・キープ中のボトル本数と銘柄・キープ名（検索用）
// v10.94：一覧は「最終 日付・係の名前・キープ中の銘柄（3本まで、4本以上は「ほか○本」）」。顧客サイトと同じ
function bnLine(names,n){ names=names||[]; if(!names.length) return n?`ボトル${n}本`:''; return names.slice(0,3).join('、')+(names.length>3?` ほか${names.length-3}本`:''); }
let cuInfo={last:{},cnt:{},first:{},kn:{},req:{},bn:{},act:{}}, cuMode='all';
async function loadCuInfo(){ const info={last:{},cnt:{},first:{},kn:{},req:{},bn:{},act:{}}; const ac=await sb.rpc('pos_cust_act'); if(!ac.error&&ac.data&&typeof ac.data==='object') info.act=ac.data; /* v12.19・SQL 276：最近出てきた時刻（並び） */ const rq=await sb.from('customer_note_requests').select('customer_id').eq('store_id',store.id).eq('status','pending'); (rq.data||[]).forEach(x=>{ info.req[x.customer_id]=(info.req[x.customer_id]||0)+1; }); const bt=await sbAll(()=>sb.from('customer_bottles').select('*').eq('is_finished',false).order('opened_on',{ascending:false}).order('id')); (bt.data||[]).filter(b=>!b.expired_on).forEach(b=>{ const c=b.customer_id; info.cnt[c]=(info.cnt[c]||0)+1; (info.bn[c]||(info.bn[c]=[])).push(b.name); const d=b.opened_on||String(b.created_at||'').slice(0,10); if(d&&(!info.first[c]||d<info.first[c])) info.first[c]=d; if(b.keep_name) (info.kn[c]||(info.kn[c]=[])).push(b.keep_name); });
  const lv=await sb.rpc('pos_cust_last'); /* v11.30・SQL 082：前は来店の記録を全部読んでいた。関数が無い時だけ前の読み方 */ if(!lv.error&&lv.data&&typeof lv.data==='object') Object.entries(lv.data).forEach(([id,d])=>{ info.last[id]=d; });
  else for(let from=0;;from+=1000){ const v=await sb.from('bill_customers').select('customer_id,bills(business_date,status)').order('bill_id').order('customer_id').range(from,from+999); if(v.error) break; (v.data||[]).forEach(x=>{ const bl=x.bills; if(!bl||bl.status==='void') return; if(!info.last[x.customer_id]||bl.business_date>info.last[x.customer_id]) info.last[x.customer_id]=bl.business_date; }); if((v.data||[]).length<1000) break; } /* v11.01：最終は共有の店舗での来店も入れる（SQL 048） */ const sl=await sb.rpc('cust_share_last'); Object.entries(sl.data||{}).forEach(([id,d])=>{ if(!info.last[id]||d>info.last[id]) info.last[id]=d; }); cuInfo=info; }
const cuAct=c=>Math.max(...[cuInfo.act[c.id],c.updated_at,c.created_at].map(t=>Date.parse(t)||0)); /* v12.19・SQL 276：最近出てきた時刻（来店・予約・情報の更新）。読み直す前に登録・更新した人も上に */
function cuBase(id){ return cuInfo.last[id]||cuInfo.first[id]||String(customers.find(c=>c.id===id)?.created_at||'').slice(0,10)||''; }
let cuMonthsSel=null;

