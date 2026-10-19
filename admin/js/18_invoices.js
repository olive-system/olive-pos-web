// ---------- 請求書の未入金 v0.26・SQL 067：売上は会計日のまま。振り込まれたら入金日を入れて「入金済」にする（ここだけ。POS は見るだけ）。間違えた時は理由を入れて未入金に戻す。操作ログに残る ----------
let invTab='unpaid';
const mdj=d=>{ const m=String(d||'').match(/^\d{4}-(\d{2})-(\d{2})/); return m?`${+m[1]}/${+m[2]}`:''; };
const todayJst=()=>{ const x=new Date(Date.now()+9*3600000); return x.toISOString().slice(0,10); };
// v0.37・SQL 076：収支の画面（月次）の中に出す。見る・直すの権限は収支と同じ
async function invRender(st){ const ed=perm('pl')==='edit', box=()=>$('invBox'), again=()=>invRender(st);
  const r=await sb.rpc('admin_invoice_list',{p_store:st}); if(page!=='pl'||storeId!==st||plDate||!box()) return;
  const head='<div style="font-size:15px;font-weight:700;margin:0 0 6px">請求書の未入金</div>'; // v0.39：見出しは小さく（画面の名前より大きくしない）
  if(r.error){ box().innerHTML=head+`<div class="card err">${esc(/権限/.test(r.error.message)?'SQL 076 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const all=r.data||[], un=all.filter(x=>!x.paid_on), pd=all.filter(x=>x.paid_on), list=invTab==='paid'?pd:un, sum=a=>a.reduce((t,x)=>t+Number(x.amount||0),0);
  box().innerHTML=head+`<div class="cs-tabs"><button data-it="unpaid" class="${invTab==='unpaid'?'on':''}">未入金（${un.length}件 ${yen(sum(un))}）</button><button data-it="paid" class="${invTab==='paid'?'on':''}">入金済（${pd.length}件）</button></div>
  <div class="card" style="margin-bottom:0"><table class="t"><tr><th>会計日</th><th>お客様</th><th>${KL}</th><th style="text-align:right">金額</th>${invTab==='paid'?'<th>入金日</th>':''}${ed?'<th></th>':''}</tr>
  ${list.map(x=>`<tr><td>${esc(x.business_date)}</td><td>${esc(x.customers||'')}</td><td>${esc(x.kakari||'')}</td><td style="text-align:right">${yen(x.amount)}</td>${invTab==='paid'?`<td>${esc(x.paid_on)}</td>`:''}${ed?`<td style="text-align:right">${invTab==='paid'?`<button class="ghost sm" data-iu="${x.id}">未入金に戻す</button>`:`<button class="primary sm" data-ip="${x.id}">入金済にする</button>`}</td>`:''}</tr>`).join('')||`<tr><td class="muted" colspan="6">${invTab==='paid'?'入金済の請求書はありません':'未入金の請求書はありません'}</td></tr>`}</table></div>`;
  box().querySelectorAll('[data-it]').forEach(b=>b.onclick=()=>{ invTab=b.dataset.it; again(); });
  const row=id=>all.find(x=>x.id===id), what=x=>`${x.business_date}　${x.table_name||''}${x.customers?'　'+x.customers+' 様':''}　${yen(x.amount)}`;
  box().querySelectorAll('[data-ip]').forEach(b=>b.onclick=guard(b,async()=>{ const x=row(b.dataset.ip); if(!x) return;
    const t=todayJst(), m=modal(`<h2 style="margin:0">入金済にする</h2><div>${esc(what(x))}</div><label>入金日<input type="date" id="ipDate" value="${t}" min="${esc(x.business_date)}" max="${t}"></label><div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">入金済にする</button></div>`);
    const d=await new Promise(res=>{ m.querySelector('[data-k=no]').onclick=()=>{ m.remove(); res(null); }; m.querySelector('[data-k=ok]').onclick=()=>{ const v=m.querySelector('#ipDate').value; m.remove(); res(v||''); }; });
    if(d===null) return; if(!d){ await uiAlert('入金日を入力してください'); return; }
    const z=await rpc('admin_invoice_paid',{p_payment:x.id,p_date:d}); if(!z.ok) return; toast(`${mdj(d)} 入金済にしました`); again(); }));
  box().querySelectorAll('[data-iu]').forEach(b=>b.onclick=guard(b,async()=>{ const x=row(b.dataset.iu); if(!x) return;
    const m=modal(`<h2 style="margin:0">未入金に戻す</h2><div>${esc(what(x))}<br>入金日 ${esc(x.paid_on)}</div><label>理由（必須・操作ログに残ります）<input id="iuWhy" maxlength="100"></label><div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="danger" data-k="ok">未入金に戻す</button></div>`);
    const w=await new Promise(res=>{ m.querySelector('[data-k=no]').onclick=()=>{ m.remove(); res(null); }; m.querySelector('[data-k=ok]').onclick=()=>{ const v=m.querySelector('#iuWhy').value.trim(); m.remove(); res(v); }; });
    if(w===null) return; if(!w){ await uiAlert('理由を入力してください'); return; }
    const z=await rpc('admin_invoice_unpaid',{p_payment:x.id,p_reason:w}); if(!z.ok) return; toast('未入金に戻しました'); again(); })); }

