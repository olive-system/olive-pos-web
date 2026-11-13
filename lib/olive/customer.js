/* POS の顧客画面と顧客サイトで同じ働きの部品（07 の C）。前は2つのサイトに1文字も同じコピーがあった。
   メモのボトルの取り込み（memoMerge・memoMergeDone）・ボトルの名前の行・五十音の並び・1行に収める文字の大きさ */
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

function memoMergeDone(r,choices){ const out=[...r.lines]; for(let i=r.conflicts.length-1;i>=0;i--){ const c=r.conflicts[i], ch=choices[i]; out.splice(c.at,0,...(ch==='m'?c.mine:ch==='t'?c.theirs:[...c.theirs,...c.mine])); } return out.join('\n'); }

function bnLine(names,n){ names=names||[]; if(!names.length) return n?`ボトル${n}本`:''; return names.slice(0,3).join('、')+(names.length>3?` ほか${names.length-3}本`:''); }

function jaCmp(a,b){ return (jaCmp.c||(jaCmp.c=new Intl.Collator('ja',{numeric:true}))).compare(String(a??''),String(b??'')); }

function fitLine(root){ (root||document).querySelectorAll('.fit1').forEach(e=>{ if(e.dataset.fs==null) e.dataset.fs=e.style.fontSize||''; e.style.fontSize=e.dataset.fs; let s=parseFloat(getComputedStyle(e).fontSize)||14; while(e.scrollWidth>e.clientWidth+1&&s>9){ s-=0.5; e.style.fontSize=s+'px'; } }); }

/* メモの同じ所を両方が直した時に、どちらを残すかを選ぶ。返し：'m'＝あなた・'t'＝ほかの人・'b'＝両方残す・null＝キャンセル。
   箱の見た目はサイトごと（CU_SITE.clashBox(あなたの文, ほかの人の文) → 押したボタンの data-v（x＝キャンセル）） */
function pickClash(x){ const t=a=>esc(a.join('\n'))||'<span class="muted">（削除）</span>'; return CU_SITE.clashBox(t(x.mine),t(x.theirs)).then(v=>v==='x'?null:v); }

/* サイトごとにちがう所（07 の C1）：today＝営業日（POS は端末の時計・顧客サイトはデータベースの営業日）、rnInp・rnBtn＝本名の欄の入力欄と［追加］の形 */
const CU_SITE = { today: function(){ return businessDate(); }, rnInp: '', rnBtn: 'padding:0 14px' };
/* 来店の一覧：今年はそのまま、前の年は年ごとにたたむ */
function visYears(list,dt,row){ const cy=CU_SITE.today().slice(0,4), g={}; const head=list.filter(v=>String(dt(v)).slice(0,4)===cy).map(row).join(''); for(const v of list){ const y=String(dt(v)).slice(0,4); if(y===cy) continue; (g[y]=g[y]||[]).push(v); } return head+Object.keys(g).sort().reverse().map(y=>`<details class="vyr"><summary>${y}年　${g[y].length}回</summary>${g[y].map(row).join('')}</details>`).join(''); }
/* 日付を「11/3」（前の年は「2025/11/3」）。今年かどうかは CU_SITE.today（来店の年と同じ） */
function cuMd(d){ const m=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${m[1]===CU_SITE.today().slice(0,4)?'':m[1]+'/'}${+m[2]}/${+m[3]}`:''; }
/* 本名・領収書名の欄：1つずつ入れて［追加］。value は空でない行を改行でつないだ文 */
function rnBox(el){ let a=String(el.dataset.v||'').split('\n'); const vals=()=>[...el.querySelectorAll('input')].map(i=>i.value);
  const draw=()=>{ el.innerHTML=a.map((x,i)=>`<input value="${esc(x)}" style="${CU_SITE.rnInp}">${i===a.length-1?`<button type="button" class="ghost" data-rnadd style="${CU_SITE.rnBtn}">追加</button>`:'<span></span>'}`).join(''); el.querySelector('[data-rnadd]').onclick=()=>{ a=vals(); a.push(''); draw(); el.querySelector('input:last-of-type').focus(); }; };
  Object.defineProperty(el,'value',{get:()=>vals().map(x=>x.trim()).filter(Boolean).join('\n'),set:v=>{ a=String(v||'').split('\n'); draw(); }}); draw(); }
