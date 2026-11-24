// ---------- ボトルの期限切れ・移動と、顧客の一覧（15_customers.js）の横に出す情報（最終来店日・キープ中のボトル）と、お客様のメモの食い違いを選ぶ小窓 ----------
/* キープ名がお客様の名前とちがう時だけ「（キープ名：…）」を付ける（同じなら書かない） */
function knLabel(b,cname){ return b.keep_name&&b.keep_name!==cname?`（キープ名：${b.keep_name}）`:''; }
async function expireBottle(b,cname){ if(!b) return false; if(!await uiConfirm(`${b.name}（残り ${b.remaining??0}/10）を期限切れにしますか？\n残量はこのまま記録されます。`)) return false; const d=businessDate(); const { error } = await sb.rpc('pos_bottle_set',{p_id:b.id,p:{expired_on:d}}); if(error){ toast(error.message); return false; } await logOp('ボトル期限切れ',{customer:cname,bottle:b.name,remaining:b.remaining},null,true); b.expired_on=d; toast('期限切れにしました'); return true; }
// ボトル移動（uiMoveForm で移動先と係を聞き、moveBottle で保存）：日付と残量を残して、この店のキープから外す（expired_on を入れると、キープ中の一覧に出なくなる）
// 移動先・係を記録（オーナー「移籍先のお店に持っていける。一応記録しておきたい」）
function uiMoveForm(b,k0){ return new Promise(res=>{ const cs=S.staff.filter(x=>x.kind==='cast'&&x.is_active!==false);
  const m=mkModal(60);
  m.innerHTML=`<div class="box" style="width:min(420px,92vw)"><h2 style="margin:0 0 8px">${esc(b.name)}（${b.remaining??0}/10）をボトル移動にしますか？</h2><label>移動先<input data-mf="to" maxlength="60" placeholder="例）ファースト" style="width:100%"></label><label>${KL}<select data-mf="st" style="width:100%"><option value="">なし</option>${cs.map(s=>`<option value="${s.id}" ${s.id===k0?'selected':''}>${esc(s.display_name)}</option>`).join('')}</select></label><div class="bar" style="justify-content:flex-end"><button class="ghost" data-mf="no">キャンセル</button><button class="primary" data-mf="ok">ボトル移動</button></div></div>`;
  document.body.appendChild(m);
  const done=v=>{ m.remove();
  res(v);
  };
  m.querySelector('[data-mf=no]').onclick=()=>done(null);
  m.querySelector('[data-mf=ok]').onclick=()=>done({to:m.querySelector('[data-mf=to]').value.trim()||null,staff:m.querySelector('[data-mf=st]').value||null});
  });
  }
async function moveBottle(b,cname,k0){ if(!b) return false; const mf=await uiMoveForm(b,b.kakari_staff_id||k0||''); if(!mf) return false; const d=businessDate(); const { error } = await sb.rpc('pos_bottle_set',{p_id:b.id,p:{expired_on:d,moved:true,moved_to:mf.to,moved_staff_id:mf.staff}}); if(error){ toast(error.message); return false; } await logOp('ボトル移動',{customer:cname,bottle:b.name,remaining:b.remaining,to:mf.to,staff:S.staff.find(x=>x.id===mf.staff)?.display_name||null},null,true); b.expired_on=d; b.moved=true; toast('ボトル移動にしました'); return true; }
function btMonths(){ return Number(S.settings?.bottle_keep_months)||6; } /* お店の設定（ボトルのキープ期間）と同じ。顧客サイトと同じ */
/* お客様のメモを、ほかの端末でも同じ所を直していた時に、どちらを残すかを選ぶ小窓（POS の見た目）。合わせ方と選び方の決まりは lib/olive/customer.js（pickClash）。返す値：m 自分・t ほかの人・b 両方・x キャンセル */
CU_SITE.clashBox=(mine,theirs)=>new Promise(res=>{ const m=mkModal(60); const bx=h=>`<div style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-top:4px">${h}</div>`;
  m.innerHTML=`<div class="box" style="width:min(520px,94vw)"><div style="font-size:18px;font-weight:700">同じ箇所をほかの人も修正していました</div><div class="muted" style="font-size:13px">どちらを残しますか？</div><div style="margin-top:10px">あなた${bx(mine)}</div><div style="margin-top:8px">ほかの人${bx(theirs)}</div><div class="bar" style="justify-content:flex-end;margin-top:12px"><button class="ghost" data-v="x">キャンセル</button><button class="ghost" data-v="b">両方残す</button><button class="ghost" data-v="t">ほかの人</button><button class="primary" data-v="m">あなた</button></div></div>`;
  document.body.appendChild(m); m.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ m.remove(); res(b.dataset.v); }); });
/* ボトルの並び：開けた日の新しい順（同じ日は id の順）。渡した配列そのものを並べ替える */
function btSort(list){ return list.sort((a,b)=>String(b.opened_on||'').localeCompare(String(a.opened_on||''))||String(a.id).localeCompare(String(b.id))); }
/* 顧客の一覧（15_customers.js）の「n か月以上ご来店なし」の境の日：営業日から n か月前（n が無い時はボトルのキープ月数） */
function btCutoff(n){ return monthsBefore(businessDate(),n||btMonths()); }
// 一覧の見え方（最終 日付・係の名前・キープ中の銘柄 3本まで、4本以上は「ほか○本」）は 15_customers.js が作る。顧客サイトと同じ
/* 顧客の一覧（15_customers.js）の横に出す情報。お客様ごとに last＝最終来店日・cnt＝キープ中のボトルの本数・first＝最初に開けたボトルの日・kn＝キープ名・req＝更新申請の数・bn＝キープ中の銘柄・act＝最近の動きの時刻。
   cuMode＝一覧の絞り込み（all 全員・old ご来店なし・req 更新申請あり） */
S.cuInfo={last:{},cnt:{},first:{},kn:{},req:{},bn:{},act:{}}; S.cuMode='all';
async function loadCuInfo(){ const info={last:{},cnt:{},first:{},kn:{},req:{},bn:{},act:{}};
  /* 一覧の横の中身は入口の関数1回で（SQL 654。前は6回を順番に読み、来店日とボトルの行が遅れて伸びて行が動いた）。読めない時は前の中身のまま知らせる */ const r=await sb.rpc('pos_cust_info',{p_store:S.store.id}); if(r.error){ toast(RDERR_T); return; } const D=r.data||{};
  const ac=entryPart(D,'act'); if(!ac.error&&ac.data&&typeof ac.data==='object') info.act=ac.data; /* 最近出てきた時刻（並び） */ const rq=entryPart(D,'req'); (rq.data||[]).forEach(x=>{ info.req[x.customer_id]=(info.req[x.customer_id]||0)+1; }); const bt=entryPart(D,'bottles'), shr=entryPart(D,'shares'); const shBy={}; (shr.data||[]).forEach(x=>(shBy[x.bottle_id]||(shBy[x.bottle_id]=[])).push(x.customer_id)); /* 共同のお客様にもそのボトルを数える */
  (bt.data||[]).filter(b=>!b.expired_on).flatMap(b=>[b,...(shBy[b.id]||[]).map(cid=>({...b,customer_id:cid}))]).forEach(b=>{ const c=b.customer_id; info.cnt[c]=(info.cnt[c]||0)+1; (info.bn[c]||(info.bn[c]=[])).push(b.name); const d=b.opened_on||String(b.created_at||'').slice(0,10); if(d&&(!info.first[c]||d<info.first[c])) info.first[c]=d; if(b.keep_name) (info.kn[c]||(info.kn[c]=[])).push(b.keep_name); });
  const lv=entryPart(D,'last'); /* 最終の来店日はデータベースで1回に（来店の記録を全部読むと、日ごとに遅くなる）。読めない時は最終の日を出さないだけ */ if(!lv.error&&lv.data&&typeof lv.data==='object') Object.entries(lv.data).forEach(([id,d])=>{ info.last[id]=d; });
  /* 最終は共有の店舗での来店も入れる */ const sl=entryPart(D,'share_last'); Object.entries(sl.data||{}).forEach(([id,d])=>{ if(!info.last[id]||d>info.last[id]) info.last[id]=d; }); S.cuInfo=info; }
const cuAct=c=>Math.max(...[S.cuInfo.act[c.id],c.updated_at,c.created_at].map(t=>Date.parse(t)||0)); /* 最近出てきた時刻（来店・予約・情報の更新）。読み直す前に登録・更新した人も上に */
/* 「ご来店なし」を決める日：最終来店日 → 無ければ最初に開けたボトルの日 → 無ければ登録した日 */
function cuBase(id){ return S.cuInfo.last[id]||S.cuInfo.first[id]||String(S.customers.find(c=>c.id===id)?.created_at||'').slice(0,10)||''; }
S.cuMonthsSel=null; /* 顧客の一覧で選んだ「○か月以上ご来店なし」の月数（初めはボトルのキープ月数） */

