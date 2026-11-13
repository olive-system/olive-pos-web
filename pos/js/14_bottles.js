// ---------- ボトル（全ボトルの一覧・ご来店のないお客様の抽出・期限切れ） ----------
function sDate(d){ if(!d) return ''; const [y,m,dd]=String(d).slice(0,10).split('-'); return (y==String(new Date().getFullYear())?'':y+'/')+Number(m)+'/'+Number(dd); }
function knLabel(b,cname){ return b.keep_name&&b.keep_name!==cname?`（キープ名：${b.keep_name}）`:''; }
async function expireBottle(b,cname){ if(!b) return false; if(!await uiConfirm(`${b.name}（残り ${b.remaining??0}/10）を期限切れにしますか？\n残量はこのまま記録されます。`)) return false; const d=businessDate(); const { error } = await sb.rpc('pos_bottle_set',{p_id:b.id,p:{expired_on:d}}); if(error){ toast(error.message.includes('column')?'SQL 017 が未適用です：'+error.message:error.message); return false; } await logOp('ボトル期限切れ',{customer:cname,bottle:b.name,remaining:b.remaining},null,true); b.expired_on=d; toast('期限切れにしました'); return true; }
// ボトル移動（移動先は記録しない。日付と残量を残してキープから外す）
// 移動先・係を記録（オーナー「移籍先のお店に持っていける。一応記録しておきたい」）
function uiMoveForm(b,k0){ return new Promise(res=>{ const cs=staff.filter(x=>x.kind==='cast'&&x.is_active!==false);
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
async function moveBottle(b,cname,k0){ if(!b) return false; const mf=await uiMoveForm(b,b.kakari_staff_id||k0||''); if(!mf) return false; const d=businessDate(); const { error } = await sb.rpc('pos_bottle_set',{p_id:b.id,p:{expired_on:d,moved:true,moved_to:mf.to,moved_staff_id:mf.staff}}); if(error){ toast(error.message.includes('moved')?'SQL 045 が未適用です：'+error.message:error.message); return false; } await logOp('ボトル移動',{customer:cname,bottle:b.name,remaining:b.remaining,to:mf.to,staff:staff.find(x=>x.id===mf.staff)?.display_name||null},null,true); b.expired_on=d; b.moved=true; toast('ボトル移動にしました'); return true; }
/* 期限切れ・移動を戻すボタンは v10.86 から出していないので unexpireBottle は消した */
function btMonths(){ return Number(settings?.bottle_keep_months)||6; } /* お店の設定（ボトルのキープ期間）と同じ。顧客サイトと同じ */
/* メモを行ごとに合わせる（3者マージ）。base＝書き始めた時のメモ、mine＝自分の入力、theirs＝ほかで変わった今のメモ。同じ所を両方が別々に直した時だけ conflicts に入る */
/* conflicts の choice（'m'／'t'／'b'）で仕上げる */
CU_SITE.clashBox=(mine,theirs)=>new Promise(res=>{ const m=mkModal(60); const bx=h=>`<div style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-top:4px">${h}</div>`;
  m.innerHTML=`<div class="box" style="width:min(520px,94vw)"><div style="font-size:18px;font-weight:700">同じ箇所をほかの人も修正していました</div><div class="muted" style="font-size:13px">どちらを残しますか？</div><div style="margin-top:10px">あなた${bx(mine)}</div><div style="margin-top:8px">ほかの人${bx(theirs)}</div><div class="bar" style="justify-content:flex-end;margin-top:12px"><button class="ghost" data-v="x">キャンセル</button><button class="ghost" data-v="b">両方残す</button><button class="ghost" data-v="t">ほかの人</button><button class="primary" data-v="m">あなた</button></div></div>`;
  document.body.appendChild(m); m.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ m.remove(); res(b.dataset.v); }); }); /* メモの食い違いを選ぶ箱の見た目（POS の小窓）。選ぶ決まりは lib/olive/customer.js の pickClash */
/* 並び順を顧客サイトとそろえる（名前・卓名は日本語順、数字は数の順） */
function btSort(list){ return list.sort((a,b)=>String(b.opened_on||'').localeCompare(String(a.opened_on||''))||String(a.id).localeCompare(String(b.id))); }
function btCutoff(n){ const [y,m,d]=businessDate().split('-').map(Number); const x=new Date(y,m-1-(n||btMonths()),1); x.setDate(Math.min(d,new Date(x.getFullYear(),x.getMonth()+1,0).getDate())); /* 月末のずれを直す（8/31 の6か月前は 2/28。前は 3/3 になった） */ return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
// 顧客一覧に出す情報：最終来店日・キープ中のボトル本数と銘柄・キープ名（検索用）
// 一覧は「最終 日付・係の名前・キープ中の銘柄（3本まで、4本以上は「ほか○本」）」。顧客サイトと同じ
let cuInfo={last:{},cnt:{},first:{},kn:{},req:{},bn:{},act:{}}, cuMode='all';
async function loadCuInfo(){ const info={last:{},cnt:{},first:{},kn:{},req:{},bn:{},act:{}}; const ac=await sb.rpc('pos_cust_act'); if(!ac.error&&ac.data&&typeof ac.data==='object') info.act=ac.data; /* 最近出てきた時刻（並び） */ const rq=await sb.from('customer_note_requests').select('customer_id').eq('store_id',store.id).eq('status','pending'); (rq.data||[]).forEach(x=>{ info.req[x.customer_id]=(info.req[x.customer_id]||0)+1; }); const bt=await sbAll(()=>sb.from('customer_bottles').select('*').eq('is_finished',false).order('opened_on',{ascending:false}).order('id')); const shr=await sbAll(()=>sb.from('customer_bottle_shares').select('bottle_id,customer_id').order('bottle_id').order('customer_id')); const shBy={}; (shr.data||[]).forEach(x=>(shBy[x.bottle_id]||(shBy[x.bottle_id]=[])).push(x.customer_id)); /* 共同のお客様にもそのボトルを数える */
  (bt.data||[]).filter(b=>!b.expired_on).flatMap(b=>[b,...(shBy[b.id]||[]).map(cid=>({...b,customer_id:cid}))]).forEach(b=>{ const c=b.customer_id; info.cnt[c]=(info.cnt[c]||0)+1; (info.bn[c]||(info.bn[c]=[])).push(b.name); const d=b.opened_on||String(b.created_at||'').slice(0,10); if(d&&(!info.first[c]||d<info.first[c])) info.first[c]=d; if(b.keep_name) (info.kn[c]||(info.kn[c]=[])).push(b.keep_name); });
  const lv=await sb.rpc('pos_cust_last'); /* 前は来店の記録を全部読んでいた。関数が無い時だけ前の読み方 */ if(!lv.error&&lv.data&&typeof lv.data==='object') Object.entries(lv.data).forEach(([id,d])=>{ info.last[id]=d; });
  else for(let from=0;;from+=1000){ const v=await sb.from('bill_customers').select('customer_id,bills(business_date,status)').order('bill_id').order('customer_id').range(from,from+999); if(v.error) break; (v.data||[]).forEach(x=>{ const bl=x.bills; if(!bl||bl.status==='void') return; if(!info.last[x.customer_id]||bl.business_date>info.last[x.customer_id]) info.last[x.customer_id]=bl.business_date; }); if((v.data||[]).length<1000) break; } /* 最終は共有の店舗での来店も入れる */ const sl=await sb.rpc('cust_share_last'); Object.entries(sl.data||{}).forEach(([id,d])=>{ if(!info.last[id]||d>info.last[id]) info.last[id]=d; }); cuInfo=info; }
const cuAct=c=>Math.max(...[cuInfo.act[c.id],c.updated_at,c.created_at].map(t=>Date.parse(t)||0)); /* 最近出てきた時刻（来店・予約・情報の更新）。読み直す前に登録・更新した人も上に */
function cuBase(id){ return cuInfo.last[id]||cuInfo.first[id]||String(customers.find(c=>c.id===id)?.created_at||'').slice(0,10)||''; }
let cuMonthsSel=null;

