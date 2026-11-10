// ---------- 日付 ----------
function bd(){ return boot&&boot.business_date||new Date().toISOString().slice(0,10); }
CU_SITE.today = bd; /* 来店の年（lib/olive/customer.js の visYears）は、データベースの営業日で分ける */
// 一覧のボトル：キープ中の銘柄を3本まで、4本以上は「ほか○本」。銘柄が届かない時は本数だけ。POSと同じ
function md(d){ const m=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${m[1]===bd().slice(0,4)?'':m[1]+'/'}${+m[2]}/${+m[3]}`:''; }
function cutoff(n){ const [y,m,d]=bd().split('-').map(Number); const x=new Date(y,m-1-n,1); x.setDate(Math.min(d,new Date(x.getFullYear(),x.getMonth()+1,0).getDate())); /* v1.37：月末のずれを直す */ return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
function base(c){ return c.last||c.first_bottle||String(c.created_at||'').slice(0,10)||''; }
const staffBy=id=>(boot&&boot.staff||[]).find(s=>s.id===id);
const sname=id=>{ const s=staffBy(id); return s?s.name+(s.active?'':'（退店）'):''; };

// ---------- 一覧 ----------
const csAt=c=>Math.max(Date.parse(c.act)||0,Date.parse(c.created_at)||0), csOrder=(a,b)=>csAt(b)-csAt(a)||jaCmp(a.name,b.name)||String(a.id).localeCompare(String(b.id));
async function loadList(){ $('rows').innerHTML='<div class="loading">読み込み中…</div>';
  try{ custs=await rpc('cs_list',{p_token:token})||[]; custs.sort(csOrder); /* v1.52・SQL 276：最近出てきた順（来店・予約・情報の更新。オーナー 2026-10-28）。POS と同じ並び */ renderList(); }catch(e){ $('rows').innerHTML=''; await fail(e); } }
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{ mode=b.dataset.mode; renderList(); });
$('q').oninput=()=>renderList();
function renderList(){ const q=$('q').value.trim();
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));
  const ms=$('months'); const opts=[...new Set([1,2,3,6,12,monthsSel])].sort((a,b)=>a-b); ms.innerHTML=`<option value="" ${mode==='all'?'selected':''}>全員</option><option value="focus" ${mode==='focus'?'selected':''}>強化リスト</option>`+opts.map(n=>`<option value="${n}" ${mode==='old'&&n===monthsSel?'selected':''}>${n%12?n+"か月":n/12+"年"}以上ご来店なし</option>`).join(''); ms.onchange=()=>{ if(!ms.value){ mode='all'; renderList(); return; } if(ms.value==='focus'){ mode='focus'; renderList(); loadFocus(); return; } /* v1.60：強化リスト（並びは最後のご来店が古い順） */ monthsSel=Number(ms.value); mode='old'; renderList(); };
  const cut=cutoff(monthsSel);
  let list=custs.filter(c=>!q||[c.name,c.company,c.receipt_name,...(c.keep_names||[])].some(v=>v&&String(v).includes(q))||kanaHit(c,q));
  if(mode==='old') list=list.filter(c=>base(c)&&base(c)<=cut).sort((a,b)=>base(a).localeCompare(base(b)));
  if(mode==='focus') list=list.filter(c=>c.focus).sort((a,b)=>(a.last||'').localeCompare(b.last||''));
  $('count').textContent=`${list.length}名`+(mode==='old'?`（${md(cut)} 以前）`:mode==='focus'&&fInfo?`（上限${fInfo.cap}名）`:'');
  const show=list.slice(0,300);
  $('rows').innerHTML=show.map(c=>`<button class="row" data-id="${c.id}"><div class="nm">${esc(c.name)}${c.company?` <small class="muted" style="font-weight:400">${esc(c.company)}</small>`:''}${c.focus?' <span class="badge">強化</span>':''}${c.is_industry?' <span class="badge k">同業</span>':''}${c.req?` <span class="badge warnb">申請 ${c.req}件</span>`:''}</div><div class="sub" style="${mode==='old'?'color:var(--warn)':''}">${[c.last?md(c.last):'来店なし',c.kakari_staff_id?esc(sname(c.kakari_staff_id)):'',esc(bnLine(c.bottle_names,c.bottles)),mode==='focus'&&fInfo&&fInfo.contacts?(fInfo.contacts[c.id]?`連絡先 ${fInfo.contacts[c.id]}名`:'<span style="color:var(--warn)">連絡先なし</span>'):''].filter(Boolean).join('・')}</div></button>`).join('')+(list.length>show.length?`<div class="muted" style="font-size:13px;padding:8px 0">ほか ${list.length-show.length}名（検索で絞り込んでください）</div>`:'')||'<div class="muted" style="padding:20px 0">該当なし</div>';
  $('rows').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openDetail(b.dataset.id)); }

/* v1.67・SQL 380：お名前の下にフリガナ（任意）。検索の文字がかなだけの時はフリガナの枠に入れる */
function newForm(q){ const kq=q&&!kanaBad(kanaFix(q)); return sheet(`<h3>新しいお客様</h3><label class="f">お名前<input id="nfName" value="${esc(kq?'':q)}"></label><label class="f">フリガナ<input id="nfKana" value="${esc(kq?kanaFix(q):'')}" placeholder="例）あおやぎ しろう or アオヤギ シロウ"></label><div class="btns"><button class="ghost" data-x>キャンセル</button><button class="primary" data-ok>登録</button></div>`,(s,done)=>{ const n=s.querySelector('#nfName'), k=s.querySelector('#nfKana'); setTimeout(()=>(kq?n:(q?k:n)).focus(),50); k.onblur=()=>{ k.value=kanaFix(k.value); };
  s.querySelector('[data-x]').onclick=()=>done(null); s.querySelector('[data-ok]').onclick=()=>{ const nm=n.value.trim(), kn=kanaFix(k.value); if(!nm){ toast('お名前を入力してください'); return; } if(kanaBad(kn)){ toast('フリガナはカタカナで入力してください'); return; } done({nm,kn}); }; }); }
$('newBtn').onclick=async()=>{ const v=await newForm($('q').value.trim()); if(!v) return; const nm=v.nm;
  const same=custs.filter(c=>c.name===nm); if(same.length&&!await uiConfirm(`「${nm}」様はすでに登録されています${same[0].company?`（${same[0].company}）`:''}。\n別の方として新規登録しますか？`,'新規登録')) return;
  try{ const id=await rpc('cs_customer_add',{p_token:token,p_name:nm,p_kana:v.kn||null}); toast('登録しました'); $('q').value=''; await loadList(); openDetail(id); }catch(e){ await fail(e); } };

