// ---------- 在籍キャストの詳細（月の数字・アプローチの入替・詳細のフォーム） ----------
// アプローチの提案の入替（そのキャストの連絡先交換のお客様から選ぶ。並びは今の提案が先）
async function salesPlanEdit(s){ const r=await sb.rpc('pos_sales_plan',{p_staff:s.id}); if(r.error){ toast(r.error.message); return; } const C=r.data.contacts||[]; if(!C.length){ await uiAlert(`${s.display_name} の連絡先交換の提出がありません`); return; }
  const on=new Set(r.data.plan||[]); const m=mkModal(60);
  const paint=()=>{ m.innerHTML=`<div class="box" style="width:min(560px,94vw);max-height:86vh;overflow:auto"><b>提案（${esc(s.display_name)}）</b> <small class="muted">${reqMd(r.data.date)}・選択 ${on.size}名（敬称略）</small>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;margin-top:10px">${C.map(c=>`<button type="button" class="chip ${on.has(c.id)?'on':''}" data-pc="${c.id}" style="border-radius:8px;font-size:14px;padding:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</button>`).join('')}</div>
    <div class="bar" style="justify-content:flex-end"><button class="ghost" data-pp="no">キャンセル</button><button class="primary" data-pp="ok">保存</button></div></div>`;
    m.querySelectorAll('[data-pc]').forEach(b=>b.onclick=()=>{ const id=b.dataset.pc; on.has(id)?on.delete(id):on.add(id); const y=m.querySelector('.box').scrollTop; paint(); m.querySelector('.box').scrollTop=y; });
    m.querySelector('[data-pp=no]').onclick=()=>m.remove();
    m.querySelector('[data-pp=ok]').onclick=async()=>{ const ids=[...(r.data.plan||[]).filter(x=>on.has(x)), ...C.map(c=>c.id).filter(x=>on.has(x)&&!(r.data.plan||[]).includes(x))];
      const q=await sb.rpc('pos_sales_plan_save',{p_staff:s.id,p_ids:ids}); if(q.error){ toast(q.error.message); return; } m.remove(); toast(`${s.display_name} の提案を保存しました（${ids.length}名）`); }; };
  paint(); document.body.appendChild(m); }
const MYPAGE_URL={ ginza:'https://liff.line.me/2012027414-zlSsSUTA', hiroshima:'https://liff.line.me/2012027414-BSyLe8IB' }; /* LINEマイページの入口（店ごと） */
const FOREVER='9999-12-31'; // 保証時給の期限「永久」
// 保証時給があって期限が空欄なら、初期値は3か月後の月末（営業日から）
function gDefault(){ const [y,m]=businessDate().split('-').map(Number); const d=new Date(y,m-1+4,0); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
// 今月（会計済）の係小計を人ごとに集計（係が複数なら等分）。only＝この人たちが係の伝票だけ計算する
// 今月のポイント（会計済）。セット・延長のポイントは 人数×設定値 を係で均等に分け、商品のポイントは振り分けた人に付く
/* 決定時給は、管理サイトの報酬の計算と同じ値を出す（折半・時給加算・ポイントも同じになる）。関数が無い時は画面の計算のまま */
function posWage(s){ sb.rpc('pos_cast_wage',{p_staff:s.id}).then(r=>{ if(S.cSel!==s||r.error||!r.data||r.data.wage==null) return; const e=$('cWage'); if(e) e.textContent=yen(r.data.wage); }); } /* 通しチェックで直した。txt は別の関数の中だけにあり、ここでエラーになっていた（管理サイトと同じ決定時給が出ていなかった） */
// 今月のキャストの成績に入る伝票。置き伝票は入金のあった日の月に入れ、まだ入金がない置きは入れない（POS の売上日 billDay と同じ決め方。オーナー）
async function monthCreditBills(sel){ const bd=businessDate(), m1=bd.slice(0,7)+'-01'; const selCols=sel+',status,business_date,payments(method,amount,received_at,revenue_date)';
  const [a,p]=await Promise.all([sbAll(()=>sb.from('bills').select(selCols).eq('store_id',S.store.id).eq('status','closed').gte('business_date',m1).lte('business_date',bd).order('id')), sbAll(()=>sb.from('payments').select('bill_id').gte('revenue_date',m1).lte('revenue_date',bd).gt('amount',0).order('id'))]);
  if(a.error||p.error) return null; const have=new Set((a.data||[]).map(b=>b.id)); const ids=[...new Set((p.data||[]).map(x=>x.bill_id))].filter(i=>!have.has(i)); let more=[];
  for(let i=0;i<ids.length;i+=100){ const q=await sb.from('bills').select(selCols).eq('store_id',S.store.id).eq('status','closed').in('id',ids.slice(i,i+100)); if(q.error) return null; more=more.concat(q.data||[]); }
  return [...(a.data||[]),...more].filter(b=>{ if(isOki(b)) return false; const d=billDay(b); return d>=m1&&d<=bd; }); }
// セット＋延長のポイントはデータベースの1か所（bill_set_ext_points。セットは1組の人数別の段）から。前は画面で同じ式を計算していた
async function monthPoints(only){ const [q,bs]=await Promise.all([ sb.rpc('pos_month_set_points'), monthCreditBills('id,bill_items(is_void,bill_item_splits(staff_id,back_points))') ]); if(q.error||!bs) return null; const m={}; const add=(id,v)=>{ if(only&&!only.has(id)) return; m[id]=Math.round(((m[id]||0)+v)*10)/10; };
  Object.entries(q.data||{}).forEach(([id,v])=>{ v=Number(v||0); if(v) add(id,v); });
  bs.forEach(b=>{ (b.bill_items||[]).filter(x=>!x.is_void).forEach(x=>(x.bill_item_splits||[]).forEach(z=>{ const v=Number(z.back_points||0); if(v) add(z.staff_id,v); })); });
  return m; }
async function monthKakari(only){ { const q=await sb.rpc('pos_month_kakari'); if(!q.error&&q.data&&typeof q.data==='object'){ const m={}; Object.entries(q.data).forEach(([id,v])=>{ if(!only||only.has(id)) m[id]=Number(v||0); }); return m; } } /* 前は伝票を1枚ずつ計算していた（月末に数百回の通信）。関数が無い時は下の前の読み方 */
  const all=await monthCreditBills('id,bill_casts(staff_id,is_kakari),bill_items(cast_subtotal_price,qty,is_void)'); if(!all) return null;
  const bs=all.filter(b=>(b.bill_casts||[]).some(c=>c.is_kakari&&(!only||only.has(c.staff_id)))); const m={};
  for(let i=0;i<bs.length;i+=8){ const part=bs.slice(i,i+8); const ts=await Promise.all(part.map(b=>sb.rpc('calc_bill',{p_bill:b.id}))); part.forEach((b,j)=>{ const T=ts[j].data||{}; const ks=(b.bill_casts||[]).filter(c=>c.is_kakari).map(c=>c.staff_id); const total=(T.set||0)+(T.vip_set||0)+(T.extension||0)+(T.vip_ext||0)+(b.bill_items||[]).filter(x=>!x.is_void).reduce((a,x)=>a+x.cast_subtotal_price*x.qty,0); const each=Math.floor(total/ks.length); ks.forEach(id=>{ m[id]=(m[id]||0)+each; }); }); }
  return m; }
// 担当キャストの今月の係小計を黒服ごとに集計し、在籍中の黒服全員の合計に対する割合も出す（削除済の黒服・担当なしのキャストは含めない）
async function clMgrSum(s){ const halls=new Set(S.staffAll.filter(x=>x.kind==='hall'&&x.is_active).map(x=>x.id)); const mgr=new Map(S.staffAll.filter(x=>x.manager_staff_id&&halls.has(x.manager_staff_id)&&x.id!==x.manager_staff_id).map(x=>[x.id,x.manager_staff_id])); const mineN=S.staffAll.filter(x=>x.manager_staff_id===s.id&&x.id!==s.id&&x.is_active).length; const sums={}; let all=0;
  if(mgr.size){ const m=await monthKakari(new Set(mgr.keys())); if(!m) return {sum:'—',pct:'—'}; Object.entries(m).forEach(([id,v])=>{ const h=mgr.get(id); if(h){ sums[h]=(sums[h]||0)+v; all+=v; } }); }
  const mine=sums[s.id]||0; return {sum:`${yen(mine)} <small class="muted">担当 ${mineN}人</small>`, pct: all>0&&halls.has(s.id) ? (Math.round(mine/all*1000)/10).toFixed(1)+'%' : '—'}; }
function renderCastForm(){ const f=$('cForm'); const s=S.cSel; f.classList.toggle('empty',!s); if(!s){ f.innerHTML='<div class="muted">一覧の「編集」を押してください</div>'; return; }
  f.innerHTML=cfHtmlTop(s)+cfHtmlCast(s)+cfHtmlInfo(s)+cfHtmlFoot(s);
  if(!s._new) cfShiftWish(s);
  if(!s._new) cfSalesRow(s);
  if(!s._new) posDocs(s);
  if(!s._new&&!s.is_trial) cfLine(s);
  $('cDel').onclick=()=>leaveDlg(s);
  if(s.kind!=='hall') cfWage(s,f);
  cfGood(s); cfFines(s);
  if(!s._new&&s.kind==='hall') cfHall(s);
  const k=cfKind(s,f);
  $('cSave').onclick=guard($('cSave'),()=>cfSave(s,f,k)); }
/* 詳細のフォームの形（上から：名前・区分と報酬・今月の時給の箱・反応◎と罰金・LINE とシフトの希望・黒服の数字・保存） */
// 時給・保証時給・同伴ノルマは管理ページで設定する（ここは表示だけ。列は staff.hourly_wage／guaranteed_wage／douhan_quota の予定）
// 並びは 区分・報酬（日給）／担当黒服・お誕生日／インボイス番号（オーナー）
function cfHtmlTop(s){ return `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px"><label style="min-width:0">源氏名<input data-k="display_name" value="${esc(s.display_name||'')}" style="width:100%;min-width:0"></label><label style="min-width:0">本名<input data-k="real_name" value="${esc(s.real_name||'')}" style="width:100%;min-width:0"></label></div><div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:end"><label style="min-width:0">区分<select data-k="kind" style="width:100%;min-width:0"><option value="cast" ${s.kind==='cast'&&!s.is_trial&&!s.kakari_only?'selected':''}>キャスト</option><option value="hall" ${s.kind==='hall'?'selected':''}>黒服（雇用）</option><option value="trial" ${s.kind!=='hall'&&s.is_trial&&!s.kakari_only?'selected':''}>体験</option>`+
    `<option value="kakari" ${s.kakari_only?'selected':''}>${KL}専用（店・ママなど。タイムカードに出ない）</option></select></label>${s.is_seppan?'<div id="cPayBox" style="min-width:0;font-size:13px;color:var(--muted)">報酬<br><b style="color:var(--ink);font-size:15px">折半</b></div>':`<label id="cPayBox" style="min-width:0">報酬<select data-k="cast_pay" style="width:100%;min-width:0"><option value="hourly" ${s.pay_type!=='daily'?'selected':''}>時給</option><option value="daily" ${s.pay_type==='daily'?'selected':''}>日給</option></select></label>`}<div class="c-hall" style="min-width:0;font-size:13px;color:var(--muted)">報酬形態<br><b style="color:var(--ink);font-size:15px" id="cHallPay">${({monthly:'月給',hourly:'時給',daily:'日給'})[s.pay_type]||'未設定'}</b></div>`+
    `<label id="cDwBox" style="min-width:0;grid-column:2">保証日給（円）<input type="number" inputmode="numeric" data-k="daily_wage" value="${s.daily_wage??''}" style="width:100%;min-width:0;text-align:right"></label><label id="cMgrBox" style="min-width:0">担当黒服<select data-k="manager_staff_id" style="width:100%;min-width:0"><option value="">未選択</option>${hallList().filter(h=>h.id!==s.id).map(h=>`<option value="${h.id}" ${mgrOf(s)?.id===h.id?'selected':''}>${esc(h.display_name)}</option>`).join('')}</select></label><label style="min-width:0">お誕生日<input data-k="birthday" value="${esc(s.birthday||'')}" placeholder="5/3" inputmode="numeric" style="width:100%;min-width:0"></label><label id="cInvBox" style="min-width:0;grid-column:1/-1">インボイス番号<input data-k="invoice_number" value="${esc(s.invoice_number||'')}" placeholder="T1234567890123" autocapitalize="characters" style="width:100%;min-width:0"></label>`+
    `</div>`; }
function cfHtmlCast(s){ return `
    <div class="c-cast" data-disp="block" style="border:1px solid var(--line);border-radius:10px;padding:8px 6px;font-size:13px;color:var(--muted)"><div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 6px 4px;border-bottom:1px solid var(--line);margin-bottom:2px"><span>${s.pay_type==='daily'&&!s.is_seppan?'日給':'時給'}（今月）</span><span>適用 <b id="cWage" style="color:var(--ink);font-size:19px">…</b></span></div><div style="padding:3px 6px">同伴 <span id="cDhCnt">…</span> / ノルマ <span id="cQuota">${s.douhan_quota==null||s.douhan_quota===''?'未設定':esc(String(s.douhan_quota))+'回'}</span></div><div id="cSlRows"><div style="padding:5px 6px">読み込み中…</div></div></div>
    <div id="cInfo" style="display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px 10px;align-items:center;font-size:13px;color:var(--muted);padding:2px 6px">
    <div class="c-cast" data-disp="contents" style="display:contents"><span>反応◎</span><span><span id="cGoodMb" style="white-space:nowrap;cursor:pointer;text-decoration:underline dotted">今月 <b style="color:var(--ink)" id="cGoodM">…</b></span>　<span id="cGoodAb" style="white-space:nowrap;cursor:pointer;text-decoration:underline dotted">累計 <b style="color:var(--ink)" id="cGoodA">…</b></span></span></div>
    <div id="cFineRow" style="display:contents"><span>罰金</span><span><span id="cFineMb" style="white-space:nowrap;cursor:pointer;text-decoration:underline dotted">今月 <b style="color:var(--ink)" id="cFineM">…</b></span>　<span id="cFineAb" style="white-space:nowrap;cursor:pointer;text-decoration:underline dotted">累計 <b style="color:var(--ink)" id="cFineA">…</b></span></span></div>`; }
function cfHtmlInfo(s){ return `
    ${s._new?'':`<div id="cLineRow" style="display:none"><span>LINEマイページ</span><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="color:var(--ink)" id="cLine">…</b><button class="ghost sm" id="cLineBtn" style="display:none;padding:2px 10px"></button></span></div>`}
    ${s._new?'':`<div class="c-cast" data-disp="contents" id="cShRow" style="display:contents"><span>希望出勤日数</span><span><select id="cShW" style="width:auto;font-size:14px;padding:0 8px"><option value="">未設定</option>${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${s.shift_days_per_week===n?'selected':''}>週 ${n}日</option>`).join('')}</select></span><span>出勤可能時間</span><span><select id="cShE" style="width:auto;font-size:14px;padding:0 8px"><option value="">未設定</option>${['19:50',...Array.from({length:13},(_,i)=>`${20+Math.floor(i/4)}:${String(i%4*15).padStart(2,'0')}`)].map(t=>`<option value="${t}" ${s.shift_earliest===t?'selected':''}>${t}〜</option>`).join('')}</select></span></div>`}
    ${s._new?'':`<div class="c-cast" data-disp="contents" id="cSlRow" style="display:contents"><span>アプローチ</span><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span id="cSl" style="color:var(--ink)">…</span><button type="button" class="ghost sm" id="cSlBtn" style="padding:2px 10px">提案の入替</button></span></div>`}
    ${s._new?'':`<div id="cDocRow" style="display:contents"><span style="align-self:start;padding-top:4px">書類</span><span id="cDocs" style="display:flex;flex-wrap:wrap;gap:4px"></span></div>`}
    </div>`; }
function cfHtmlFoot(s){ return `
    <div class="c-hall" data-disp="grid" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 10px;font-size:13px;color:var(--muted)"><div>担当キャスト売上<br><b style="color:var(--ink);font-size:15px" id="cMgrSum">…</b></div><div>売上シェア<br><b style="color:var(--ink);font-size:15px" id="cMgrPct">…</b></div></div>
    <label class="sw" id="cNoTcBox" style="display:none"><input type="checkbox" data-k="no_timecard" ${s.no_timecard?'checked':''}>タイムカードを打たない（売上歩合の人。在籍リストの下に手当の欄が出ます）</label>
    <div id="cTrialBox" style="display:none"><label>体験の報酬<select data-k="trial_pay_type"><option value="hourly" ${s.trial_pay_type!=='daily'?'selected':''}>時給</option><option value="daily" ${s.trial_pay_type==='daily'?'selected':''}>日給</option></select></label><label>金額（円）<input type="number" inputmode="numeric" data-k="trial_pay_amount" value="${s.trial_pay_amount||''}"></label><div class="muted" style="font-size:13px">在籍リストで本日の報酬額を自動計算します（源泉 ${Number(S.settings?.trial_withholding_rate??10)}% 控除）</div></div>
    <div class="bar"><button class="primary" id="cSave">${s._new?'登録':'保存'}</button><button class="ghost sm" id="cDel" style="color:var(--muted);${s._new?'display:none':''}">退店</button>${s._new?'':'<span class="muted" style="font-size:13px">退店すると、タイムカード・シフト・鍵・お知らせ・伝票での選択が停止します。<br>ただし、報酬受取確認までは LINEマイページ（報酬明細のみ）と一覧の一番下に残ります</span>'}</div>`; }
// シフトの希望出勤日数（週○日）と出勤可能時間（入店時に黒服がヒアリング）。変えたらすぐ保存（管理サイトのシフトの下書きに使う）
function cfShiftWish(s){ const sv=async(k,v,l)=>{ const u=await sb.rpc('pos_row_update',{p_table:'staff',p_id:s.id,p:{[k]:v}}); if(u.error||!(u.data||[]).length){ toast(u.error?.message||'保存できませんでした'); return; } s[k]=v; await logOp('シフトの希望',{name:s.display_name,[l]:v??'未設定'}); toast('保存しました'); };
    const w=$('cShW'), e=$('cShE'); if(w) w.onchange=()=>sv('shift_days_per_week',w.value?Number(w.value):null,'希望出勤日数'); if(e) e.onchange=()=>sv('shift_earliest',e.value||null,'出勤可能時間'); }
// アプローチの今日の状態と、提案（連絡先交換のお客様から30名）の入替
function cfSalesRow(s){ const r=S.salesM[s.id], el=$('cSl'); if(el) el.textContent=r&&r.count!=null?`連絡済 ${r.count}名・スクショ${r.sent?'送信済':'未送信'}`:'未連絡';
    const b=$('cSlBtn'); if(b) b.onclick=()=>salesPlanEdit(s); }
// LINEマイページの LINE連携（キャストの画面の4桁の番号を入力）。SQL 096 が無い時は出さない。言葉を熟語に（オーナー）
// 体験の子には出さない（LINE は応募の友だち追加で控えてあり、在籍に変更すると自動で連携。オーナー）
function cfLine(s){ sb.rpc('pos_cast_links').then(r=>{ const row=$('cLineRow'); if(!row||S.cSel!==s||r.error) return; row.style.display='contents'; const l=(r.data||[]).find(x=>x.staff_id===s.id), b=$('cLineBtn');
    $('cLine').textContent=l?(l.line_name||'LINE 名なし'):'未連携'; /* 連携中は LINE の名前だけ（オーナー） */ b.style.display=''; b.textContent=l?'連携解除':'LINE連携';
    b.onclick=async()=>{ if(l){ if(!await uiConfirm(`${s.display_name} の LINE連携を解除しますか？\nLINEマイページに入れなくなります（再連携できます）`)) return; const u=await sb.rpc('pos_cast_unlink',{p_staff:s.id}); toast(u.error?u.error.message:'解除しました'); if(!u.error) renderCasts(); return; }
      /* その店のマイページの入口の QR も出す（オーナー「それぞれのリンクに飛ぶQRもつけてくれるとたすかる」） */
      await needLib('qrcode').catch(()=>{}); /* QR の部品は使う時だけ読む（07 の S1） */
      const qu=MYPAGE_URL[S.store?.code], qb=document.createElement('div'); qb.id='uiDlgQr';
      if(qu&&window.qrcode){ const q=qrcode(0,'M'); q.addData(qu); q.make(); qb.style.cssText='text-align:center;margin:10px 0 4px';
        qb.innerHTML=`<div style="display:inline-block;background:#fff;padding:6px;border-radius:8px">${q.createSvgTag({cellSize:5,margin:2})}</div><div style="font-size:13px;color:var(--muted);line-height:1.5;margin-top:4px">まだ番号が出ていない時：キャストの LINE のカメラでこの QR を読むと、${esc(S.store?.name||'')} のマイページが開きます</div>`;
        $('uiDlgMsg').after(qb); }
      let v; try{ v=await uiPrompt('LINEマイページに表示された4桁の番号'); } finally{ qb.remove(); } if(v===null) return; const code=toHan(v).replace(/\D/g,''); if(code.length!==4){ toast('4桁の番号を入力してください'); return; }
      /* 番号の打ちまちがいで別の人の LINE が付かないように、LINE の名前を確かめてから連携（オーナー） */
      const pk=await sb.rpc('pos_cast_link_peek',{p_staff:s.id,p_code:code}); if(pk.error){ await uiAlert(pk.error.message); return; }
      { const ok=$('uiDlgOk'); ok.textContent='連携'; let y=false; try{ y=await uiConfirm(`${s.display_name}\nLINE『${pk.data?.line_name||''}』と連携しますか？`); } finally{ ok.textContent='OK'; } if(!y) return; }
      const k=await sb.rpc('pos_cast_link',{p_staff:s.id,p_code:code}); if(k.error){ await uiAlert(k.error.message); return; } toast(`連携しました（${k.data?.line_name||'LINE'}）`); renderCasts(); }; }); }
  // 時給（日給）＝その人が管理サイト「スタッフ設定」で選んだスライド表（月ごと）と保証時給のうち一番高いもの。日給の人は日給の表と、設定の日給のうち一番高いもの
  // 表は管理サイト「報酬・罰金項目」で作る（slide_tables・slide_rows。何で決まるか＝係小計／ポイント／同伴数／稼働日数）。ここは表示だけ
  // 反応数（反応◎の回数。取り消し伝票は除く）・組数（その人が係の会計済伝票の数）・人数（その伝票の客数の合計）を追加
  // 報酬形態・日給も今月の条件（cast_terms）で決める。条件に無ければ staff の値
async function cfWage(s,f){ const bd=businessDate(), m1=bd.slice(0,7)+'-01'; const box=$('cSlRows'); let daily=s.pay_type==='daily'&&!s.is_seppan, unit=daily?'daily':'hourly', dwSet=s.daily_wage;
    const [dh,ctm,stb,srw]=await Promise.all([
      s._new?Promise.resolve(0):sb.from('bill_casts').select('role,bills!inner(business_date,status,store_id)').eq('staff_id',s.id).gte('bills.business_date',m1).lte('bills.business_date',bd).then(r=>r.error?null:(r.data||[]).filter(x=>isDouhan(x.role)&&x.bills&&x.bills.status==='closed'&&x.bills.store_id===S.store.id).length), // スライドの実績は会計済の伝票だけ
      s._new?Promise.resolve(null):sb.from('cast_terms').select('*').eq('staff_id',s.id).lte('month',m1).order('month',{ascending:false}).then(r=>r.error?null:((r.data||[]).find(x=>x.month===m1||!x.only_month)||null)),
      sb.from('slide_tables').select('id,name,basis,unit,sort_order').eq('store_id',S.store.id).eq('is_active',true).order('sort_order').then(r=>r.error?null:(r.data||[])),
      sb.from('slide_rows').select('table_id,threshold,amount').eq('store_id',S.store.id).then(r=>r.error?null:(r.data||[]))]);
    if(S.cSel!==s||!box) return; const txt=(id,v)=>{ const e=$(id); if(e) e.textContent=v; }; const num=v=>v==null||v===''?null:Number(v);
    if(ctm&&ctm.pay_type&&!s.is_seppan){ daily=ctm.pay_type==='daily'; unit=daily?'daily':'hourly'; dwSet=daily?ctm.daily_wage:null; }
    // 月が変わった直後も、編集欄の報酬の最初の選択を今月の条件にする（まだ触っていなければ）
    if(ctm&&ctm.pay_type&&!s.is_seppan&&(ctm.pay_type==='daily'||ctm.pay_type==='hourly')){ const ndw=ctm.pay_type==='daily'?(ctm.daily_wage??null):null; if(ctm.pay_type!==(s.pay_type==='daily'?'daily':'hourly')||ndw!==(s.pay_type==='daily'?(s.daily_wage??null):null)){ s.pay_type=ctm.pay_type; s.daily_wage=ndw; const ps=f.querySelector('[data-k=cast_pay]'), dw=f.querySelector('[data-k=daily_wage]'); if(ps&&!ps.dataset.touched&&!(dw&&dw.dataset.touched)){ ps.value=ctm.pay_type; if(dw) dw.value=ndw??''; ps.dispatchEvent(new Event('change')); } } }
    const gw=ctm?ctm.guaranteed_wage:s.guaranteed_wage, gUntil=ctm?ctm.guarantee_until:s.guarantee_until, dq=ctm?ctm.douhan_quota:s.douhan_quota;
    txt('cQuota',dq==null||dq===''?'未設定':dq+'回'); txt('cDhCnt',dh==null?'—':dh+'回');

    if(s.is_trial){ box.innerHTML=`<div style="padding:5px 6px">体験のためスライドはありません</div>`; txt('cWage','—'); return; }
    const mine=(stb||[]).filter(t=>t.unit===unit&&(ctm?.slide_ids||[]).includes(t.id));
    const need=new Set(mine.map(t=>t.basis)), met=await cfWageMet(s,need,dh,m1,bd); if(S.cSel!==s) return;
    cfWagePaint(s,box,{mine,met,srw,daily,dwSet,gw,gUntil,bd}); }
/* 今月の実績（スライド表の何で決まるかの分だけ読む） */
async function cfWageMet(s,need,dh,m1,bd){ const sid=new Set([s.id]);
    const kb=(need.has('groups')||need.has('guests'))&&!s._new?sb.from('bills').select('guest_count,set_guest_count,bill_casts!inner(staff_id,is_kakari)').eq('store_id',S.store.id).eq('status','closed').gte('business_date',m1).lte('business_date',bd).eq('bill_casts.staff_id',s.id).eq('bill_casts.is_kakari',true).then(r=>r.error?null:(r.data||[])):Promise.resolve(null);
    const [ks,pt,dy,rc,kbl]=await Promise.all([ need.has('sales')&&!s._new?monthKakari(sid).then(m=>m?(m[s.id]||0):null):null, need.has('points')&&!s._new?monthPoints(sid).then(m=>m?(m[s.id]||0):null):null,
      need.has('days')&&!s._new?sb.from('attendance_events').select('business_date').eq('staff_id',s.id).gte('business_date',m1).lte('business_date',bd).in('event_type',['clock_in','douhan']).then(r=>r.error?null:new Set((r.data||[]).map(x=>x.business_date)).size):null,
      need.has('reactions')&&!s._new?sb.from('good_reactions').select('bills!inner(business_date,status)').eq('staff_id',s.id).eq('store_id',S.store.id).gte('bills.business_date',m1).lte('bills.business_date',bd).then(r=>r.error?null:(r.data||[]).filter(x=>x.bills&&x.bills.status==='closed').length):null, kb ]);
    const met={sales:[ks,v=>yen(v),''+KL+'小計'],points:[pt,v=>Number(v).toLocaleString('ja-JP')+'pt','ポイント'],douhan:[dh,v=>v+'回','同伴数'],days:[dy,v=>v+'日','稼働日数'],reactions:[rc,v=>v+'回','反応数'],groups:[kbl&&kbl.length,v=>v+'組','組数'],guests:[kbl&&kbl.reduce((a,b)=>a+Number(b.set_guest_count??b.guest_count??0),0),v=>v+'名','人数']};
    return met; }
/* スライド表ごとの行と、一番高い額を「適用」にする */
function cfWagePaint(s,box,{mine,met,srw,daily,dwSet,gw,gUntil,bd}){ const txt=(id,v)=>{ const e=$(id); if(e) e.textContent=v; }; const num=v=>v==null||v===''?null:Number(v);
    const row=(k,label,sub,val)=>`<div data-w="${k}" style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 8px;padding:5px 6px;border-radius:6px"><div style="min-width:0">${label}${sub?`<br><small>${sub}</small>`:''}</div><div style="text-align:right;white-space:nowrap"><small class="wtag" style="display:none;color:var(--acc);font-weight:700;margin-right:4px">適用</small><b style="color:var(--ink);font-size:15px">${val}</b></div></div>`;
    const cand=[]; let html='';
    for(const t of mine){ const [v,f,l]=met[t.basis]||[null,String,t.basis]; const rs=(srw||[]).filter(r=>r.table_id===t.id); const hit=v==null?null:rs.filter(r=>Number(r.threshold)<=v).sort((a,b)=>b.threshold-a.threshold)[0];
      const k='t'+t.id; if(hit) cand.push([k,hit.amount]); html+=row(k,esc(t.name),`${l} ${v==null?'—':f(v)}`,hit?yen(hit.amount):rs.length?'該当なし':'未設定'); }
    if(!mine.length) html+=`<div style="padding:5px 6px;color:var(--warn)">スライド表：未選択</div>`; /* 場所の説明は箱の一番下に1行（オーナー） */
    if(daily){ const dw=num(dwSet); if(dw!=null) cand.push(['dw',dw]); html+=row('dw','日給（設定）','',dw==null?'未設定':yen(dw)); }
    else { const g=num(gw), gu=gUntil||(g!=null?gDefault():null), gExp=gu&&gu!==FOREVER&&gu<bd; if(g!=null&&!gExp) cand.push(['g',g]); html+=row('g','保証時給','',g==null?'未設定':yen(g)+(gExp?'（期限切れ）':'')); }
    html+=`<div class="muted" style="padding:8px 6px 2px;font-size:13px">↑ 管理サイトの“スタッフ設定”で入力します</div>`; /* 時給・ノルマ・スライド表・保証時給はここでは変更できない（オーナー） */
    box.innerHTML=html;
    const mx=cand.length?Math.max(...cand.map(x=>x[1])):null; const win=cand.find(x=>x[1]===mx);
    txt('cWage',mx==null?'未設定':yen(mx)); posWage(s);
    box.querySelectorAll('[data-w]').forEach(e=>{ const on=!!win&&e.dataset.w===win[0]; e.style.background=on?'var(--soft)':''; const tg=e.querySelector('.wtag'); if(tg) tg.style.display=on?'':'none'; }); }
// 反応◎の回数（今月・累計）
function cfGood(s){ if(s._new){ const a=$('cGoodA'), m=$('cGoodM'); if(a) a.textContent='0回'; if(m) m.textContent='0回'; } else if(s.kind!=='hall'){ const m1=businessDate().slice(0,7)+'-01'; sbAll(()=>sb.from('good_reactions').select('id,bills!inner(business_date,opened_at,table_id,table_name,guest_count,status,bill_customers(customer_id))').eq('staff_id',s.id).order('id')).then(r=>{ if(S.cSel!==s) return; const a=$('cGoodA'), m=$('cGoodM'); if(r.error){ if(a) a.textContent='—'; if(m) m.textContent='—'; return; } const d=(r.data||[]).filter(x=>x.bills&&x.bills.status!=='void').sort((x,y)=>(y.bills.business_date+y.bills.opened_at).localeCompare(x.bills.business_date+x.bills.opened_at));
    const dm=d.filter(x=>x.bills.business_date>=m1); if(a) a.textContent=d.length+'回'; if(m) m.textContent=dm.length+'回'; const mb=$('cGoodMb'), ab=$('cGoodAb'); if(mb) mb.onclick=()=>goodList(`${s.display_name}　反応◎（今月 ${dm.length}回）`,dm); if(ab) ab.onclick=()=>goodList(`${s.display_name}　反応◎（累計 ${d.length}回）`,d); }); } }
// 罰金の合計（今月・累計）。タップで内訳（日付・理由・金額）
function cfFines(s){ const tx=(i,v)=>{ const e=$(i); if(e) e.textContent=v; }; if(s._new){ tx('cFineM','0円'); tx('cFineA','0円'); } else { const m1=businessDate().slice(0,7)+'-01'; sb.from('staff_fines').select('*').eq('staff_id',s.id).eq('is_void',false).order('business_date',{ascending:false}).order('created_at',{ascending:false}).then(r=>{ if(S.cSel!==s) return; if(r.error){ tx('cFineM','—'); tx('cFineA','—'); return; } const d=r.data||[], dm=d.filter(x=>x.business_date>=m1); const sum=a=>fineSumTxt(a.reduce((t,x)=>t+Number(x.amount||0),0),a.reduce((t,x)=>t+Number(x.wage_pct||0),0)); tx('cFineM',sum(dm)+'（'+dm.length+'件）'); tx('cFineA',sum(d)+'（'+d.length+'件）'); const mb=$('cFineMb'), ab=$('cFineAb'); if(mb) mb.onclick=()=>fineList(`${s.display_name}　罰金（今月 ${sum(dm)}）`,dm); if(ab) ab.onclick=()=>fineList(`${s.display_name}　罰金（累計 ${sum(d)}）`,d); }); } }
// 黒服は報酬形態（月給・時給・日給。管理ページで選ぶ。ここは表示だけ）と、担当キャストの今月の係小計の合計（会計済の伝票。係が複数なら等分した分）
// 黒服の報酬形態と金額は管理サイト「スタッフ設定」の黒服タブ（今月の条件。無ければ staff の報酬形態）
function cfHall(s){ sb.from('cast_terms').select('*').eq('staff_id',s.id).lte('month',businessDate().slice(0,7)+'-01').order('month',{ascending:false}).then(r=>{ if(S.cSel!==s||r.error) return; const m1=businessDate().slice(0,7)+'-01', t=(r.data||[]).find(x=>x.month===m1||!x.only_month), e=$('cHallPay'); if(!e||!t?.pay_type) return; const a=t.pay_type==='monthly'?t.monthly_wage:t.pay_type==='hourly'?t.hourly_wage:t.daily_wage; e.textContent=({monthly:'月給',hourly:'時給',daily:'日給'})[t.pay_type]; /* 金額は出さない（POS はみんなで使うので、黒服同士で報酬が見えないように） */ });
  clMgrSum(s).then(v=>{ if(S.cSel!==s) return; const e=$('cMgrSum'), p=$('cMgrPct'); if(e) e.innerHTML=v.sum; if(p) p.textContent=v.pct; }); }
/* 区分で出す欄を切り替える。保存で使う kEff・選んだ欄を返す */
function cfKind(s,f){ const kSel=f.querySelector('[data-k=kind]');
  const pSel=f.querySelector('[data-k=cast_pay]'), dwIn=f.querySelector('[data-k=daily_wage]');
  [pSel,dwIn].forEach(x=>x&&x.addEventListener('input',()=>{ x.dataset.touched='1';
  }));
  /* 折半は区分ではなく報酬（オーナー）。折半は管理サイトの表（キャストの月ごとの条件）だけで決める。POS は staff.is_seppan を出すだけで、選ぶ所・書き換えは無し（点検 C1） */ const kEff=()=>kSel.value==='cast'&&s.is_seppan?'seppan':kSel.value;
  const pv=()=>{ const on=kSel.value==='cast';
  $('cPayBox').style.display=on?'':'none';
  $('cDwBox').style.display=on&&pSel&&pSel.value==='daily'?'':'none';
  };
  if(pSel) pSel.onchange=()=>tb();
  const tb=()=>{ pv();
  $('cTrialBox').style.display=kSel.value==='trial'?'':'none';
  $('cNoTcBox').style.display=kEff()==='seppan'?'':'none';
  $('cMgrBox').style.display=(kSel.value==='hall'||kSel.value==='kakari')?'none':'';
  f.querySelectorAll('.c-cast').forEach(e=>e.style.display=(kSel.value==='hall'||kSel.value==='kakari')?'none':(e.dataset.disp||''));
  { const fr=$('cFineRow');
  if(fr) fr.style.display=kSel.value==='kakari'?'none':'contents';
  } { const dr=$('cDocRow');
  if(dr) dr.style.display=kSel.value==='kakari'?'none':'contents';
  } /* 書類は黒服にも（SQL 271 で黒服にも3つ。オーナー） */ f.querySelectorAll('.c-hall').forEach(e=>e.style.display=kSel.value==='hall'?(e.dataset.disp||''):'none');
  };
  kSel.onchange=tb;
  tb();
  const mSel=f.querySelector('[data-k=manager_staff_id]');
  const mCol=()=>{ mSel.style.color=mSel.value?'':'var(--warn)';
  };
  mSel.onchange=mCol;
  mCol();
  return {kEff,pSel,dwIn,mSel};
  }
async function cfSave(s,f,{kEff,pSel,dwIn,mSel}){ const kv=kEff(); const o={display_name:f.querySelector('[data-k=display_name]').value.trim(),real_name:f.querySelector('[data-k=real_name]').value.trim(),kind:kv==='hall'?'hall':'cast',is_trial:kv==='trial',kakari_only:kv==='kakari',no_timecard:kv==='seppan'&&f.querySelector('[data-k=no_timecard]').checked,is_active:true,manager_staff_id:(kv==='hall'||kv==='kakari')?null:(mSel.value||null)}; if(kv==='trial'){ o.trial_pay_type=f.querySelector('[data-k=trial_pay_type]').value; o.trial_pay_amount=parseInt(f.querySelector('[data-k=trial_pay_amount]').value||'0',10)||0; if(o.trial_pay_amount<=0){ toast('体験の時給または日給の金額を入力してください'); return; } }
    { let iv=toHan(f.querySelector('[data-k=invoice_number]').value.trim()).replace(/[\s-]/g,'').toUpperCase(); if(iv&&!/^T\d{13}$/.test(iv)){ await uiAlert('インボイス番号は T＋数字13桁 で入力してください'); return; } /* T が無い・13桁でない時はエラー（T の自動付与をやめた。オーナー） */ o.invoice_number=iv||null; }
    { const v=toHan(f.querySelector('[data-k=birthday]').value).trim(); /* お誕生日（月/日。朝礼の「2週間以内のお誕生日」に出る） */
      if(!v) o.birthday=null; else { const m=v.match(/^(\d{1,2})[\/月.\-](\d{1,2})日?$/); if(!m||+m[1]<1||+m[1]>12||+m[2]<1||+m[2]>31){ await uiAlert('お誕生日は「5/3」のように入力してください'); return; } o.birthday=`${+m[1]}/${+m[2]}`; } }
    // キャストは 時給／日給 と日給の金額。黒服の報酬形態は管理ページで決めるので触らない。折半の人は報酬を変えない（管理サイトの表で決める）
    if(kv==='cast'&&pSel){ const pv2=pSel.value; o.daily_wage=pv2==='daily'?numIn(dwIn.value):null; if(pv2==='daily'&&!o.daily_wage){ toast('日給の金額を入力してください'); return; } o.pay_type=pv2; const cur=s.pay_type==='daily'?'daily':'hourly'; if(!s._new&&cur===pv2&&(pv2!=='daily'||(s.daily_wage??null)===o.daily_wage)){ delete o.pay_type; delete o.daily_wage; } else if(!s._new){ o._pt=pv2; } }
    await cfSaveSend(s,o,kv); }
async function cfSaveSend(s,o,kv){
    // 保証時給の期限は管理サイトで決める（POS では変えない。期限切れの判定は表示に使う）
    if(!o.display_name){ toast('源氏名を入力してください'); return; }
    if(s._new){ const dels=S.staffAll.filter(x=>!x.is_active&&x.display_name===o.display_name).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))); if(dels.length){ const pk=await uiPick('退店済に同じ名前の人がいます。戻しますか？',[{label:'はい（その人を戻す）',value:'restore'},{label:'いいえ（別人として登録）',value:'new'}]); if(!pk) return; if(pk==='restore'){ const r=await sb.rpc('pos_row_update',{p_table:'staff',p_id:dels[0].id,p:{...o,is_active:true}}); if(r.error){ toast(r.error.message.includes('invoice_number')?'SQL 021 が未適用です：'+r.error.message:r.error.message); return; } await logOp('キャストを戻す',{name:o.display_name},null,true); toast('戻しました'); S.cSel=null; renderCasts(); return; } }
      const r=await sb.rpc('pos_row_insert',{p_table:'staff',p:{store_id:S.store.id,...o,sort_order:(Math.max(0,...S.staff.map(z=>z.sort_order||0))+1)}}); if(r.error){ toast(r.error.message.includes('invoice_number')?'SQL 021 が未適用です：'+r.error.message:r.error.message); return; } await logOp('キャスト新規登録',{name:o.display_name},null,true); toast('登録しました'); S.cSel=null; renderCasts(); return; }
    // キャストの報酬形態・日給は月ごと。変えた時は「○月以降／○月のみ」を選ぶ（折半はここでは選ばない）
    let pay=null; if(kv==='cast'&&o._pt){ const mo=Number(businessDate().slice(5,7)), pt=o._pt; const pk=await uiPick(`報酬を「${pt==='daily'?'日給 '+yen(o.daily_wage):'時給'}」にします。いつからにしますか？`,[{label:`${mo}月以降`,value:'after'},{label:`${mo}月のみ`,value:'only'}]); if(!pk) return; pay={pt,dw:o.daily_wage,only:pk==='only',mo}; delete o.pay_type; delete o.daily_wage; delete o._pt; }
    const { error } = await sb.rpc('pos_row_update',{p_table:'staff',p_id:s.id,p:o});
    if(!error&&pay){ const r=await sb.rpc('pos_set_cast_pay',{p_staff:s.id,p_month:businessDate().slice(0,7)+'-01',p_only:pay.only,p_pay_type:pay.pt,p_daily_wage:pay.dw}); if(r.error){ toast(/pos_set_cast_pay/.test(r.error.message)?'SQL 063 が未実行です：'+r.error.message:r.error.message); return; } await logOp('報酬形態の変更',{name:s.display_name,pay_type:pay.pt==='daily'?'日給':'時給',daily_wage:pay.dw??null,when:`${pay.mo}月${pay.only?'のみ':'以降'}`},null,true); }
    if(!error){ const ch=Object.keys(o).filter(k=>k!=='manager_staff_id'&&(s[k]??'')!==(o[k]??'')); if(ch.length) await logOp('キャスト情報変更',{name:s.display_name,fields:ch.map(k=>`${k}:${s[k]??''}→${o[k]??''}`)},null,true); } toast(error?error.message:'保存しました'); if(!error){ S.cSel=null; renderCasts(); }  }
