// ---------- 管理サイトのID（オーナー） ----------
// v0.99・SQL 120：契約書（オーナーのみ）。LINEマイページで同意する「業務委託契約 兼 誓約書」の条文の変更（保存すると新しい版。同意済みの人の版はそのまま）と、同意の一覧（本人情報・署名）
let ctDraft=null;
// v1.08・SQL 131：Square 連携（オーナーだけ）。POS の閉店作業でカード売上を自動で照合する。トークンは入れたら画面に出さない
PAGES.o_square=async()=>{ const st=storeId, head=`<h1>Square 連携 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_square_get',{p_store:st}); if(page!=='o_square'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_square_get/.test(r.error.message)?'SQL 131 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data;
  $('main').innerHTML=head+`<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>状態</b>${D.set?`<span class="badge k">接続中</span><span>${D.location_name?'店舗：'+esc(D.location_name):'<span class="badge warnb">店舗が未選択</span>'}</span><small class="muted">${fmtDT(D.updated_at)}</small>`:'<span class="badge warnb">未接続</span>'}</div>
      <div id="sqLoc" style="margin-top:10px"></div>
      <div style="margin-top:14px"><label>アクセストークン（本番）<input id="sqTok" type="password" autocomplete="off" placeholder="${D.set?'入れ直す時だけ入力':'EAAA で始まる文字'}" style="width:100%;max-width:520px"></label></div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="primary" id="sqSave">${D.set?'入れ直す':'つなぐ'}</button>${D.set?'<button class="ghost" id="sqOff">解除</button>':''}</div></div>
    <div class="card"><b>アクセストークンの作り方</b><ol style="margin:8px 0 0;padding-left:20px;line-height:1.9;font-size:14px">
      <li>Square の開発者サイト（developer.squareup.com）に、店の Square のアカウントでログイン</li>
      <li>「アプリケーション」→「＋」で新しいアプリを作る（名前は OLIVE など）</li>
      <li>上の切り替えを「本番環境」にして、「認証情報」の「本番アクセストークン」をコピー</li>
      <li>この画面に貼り付けて「つなぐ」</li></ol>
      <div class="muted" style="font-size:13px;margin-top:6px">使うのは支払いの読み込みだけです。閉店作業の「⑧ レジ金合わせ」で、その営業日（朝8時〜翌朝8時）の Square のカード売上と POS のカードの入金を比べます</div></div>`;
  const locPaint=async()=>{ if(!D.set||D.location_id) return; const q=await rpc('admin_square_locations',{p_store:st}); if(!q.ok) return; const L=q.data||[];
    $('sqLoc').innerHTML=`<div class="muted" style="font-size:13px">Square の店舗を選んでください</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${L.map(x=>`<button class="ghost sm" data-loc="${esc(x.id)}" data-nm="${esc(x.name)}">${esc(x.name)}</button>`).join('')||'<span class="muted">店舗がありません</span>'}</div>`;
    $('sqLoc').querySelectorAll('[data-loc]').forEach(b=>b.onclick=async()=>{ const q2=await rpc('admin_square_location',{p_store:st,p_id:b.dataset.loc,p_name:b.dataset.nm}); if(!q2.ok) return; toast('保存しました'); PAGES.o_square(); }); };
  locPaint();
  $('sqSave').onclick=guard($('sqSave'),async()=>{ const t=$('sqTok').value.trim(); if(!t){ await uiAlert('アクセストークンを入力してください'); return; }
    const q=await rpc('admin_square_save',{p_store:st,p_token:t}); $('sqTok').value=''; if(!q.ok) return; toast('つなぎました'); PAGES.o_square(); });
  if($('sqOff')) $('sqOff').onclick=guard($('sqOff'),async()=>{ if(!await uiConfirm('Square 連携を解除しますか？\nカード売上の照合ができなくなります','解除','danger')) return; const q=await rpc('admin_square_off',{p_store:st}); if(!q.ok) return; toast('解除しました'); PAGES.o_square(); }); };
// v1.53・SQL 219：LINE メニュー（黒服のリッチメニュー。v1.54・SQL 221：キャストも。オーナー 2026-10-23「LINE 連携した人にだけ」「まずは黒服から」）。店ごとに する／しない。初めて「する」にした時に、Edge Function「line-richmenu」で LINE にメニューを作る
PAGES.o_line=async()=>{ const st=storeId, head=`<h1>LINE メニュー <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_richmenu_get',{p_store:st}); if(page!=='o_line'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_richmenu_get/.test(r.error.message)?'SQL 219 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data; /* v1.54・SQL 221：キャストのリッチメニューも（D.cast。オーナー 2026-10-23） */
  const K={hall:{nm:'黒服',img:'richmenu_hall.png',on:D.on,made:D.made,linked:D.linked,note:'開店・閉店作業：22時から朝8時までは閉店作業、それ以外は開店作業が開きます'},
    cast:{nm:'キャスト',img:'richmenu_cast.png',on:D.cast?.on,made:D.cast?.made,linked:D.cast?.linked,note:'連絡先交換：LINE のお知らせと同じく、入力の画面が開きます',sql:!D.cast},
    /* v1.68・SQL 275：みんな用（LINE 連携していない友だち。オーナー 2026-10-27「採用の LINE と同じにしよう」） */
    minna:{nm:'みんな用',img:'richmenu_minna.png',on:D.minna?.on,made:D.minna?.made,note:'上：面接予約のページ<br>予約状況の確認：電話番号で面接予約を表示<br>ACCESS：Google マップ<br>FAQ：トークに「FAQ」を送信（FAQ の画面は準備中）',sql:!D.minna,no:'275'}};
  const card=k=>{ const x=K[k]; return `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>${x.nm}のリッチメニュー</b>
      <span class="seg" data-rmon="${k}">${[[true,'する'],[false,'しない']].map(([v,n])=>`<button data-v="${v}" class="${!!x.on===v?'on':''}" ${D.ready&&!x.sql?'':'disabled'}>${n}</button>`).join('')}</span></div>
    <div class="muted" style="font-size:13px;margin-top:4px">${k==='minna'?'する：LINE 連携していない友だち全員の、お店の公式 LINE のトークの下にメニューが出ます。連携している黒服・キャストには今までのメニューが出ます':`する：LINE 連携している${x.nm}の、お店の公式 LINE のトークの下にメニューが出ます。押すとマイページのその画面が開きます。${k==='hall'?'キャスト':'黒服'}と、連携していない人には出ません`}</div>
    ${x.sql?`<div class="err" style="margin-top:8px">SQL ${x.no||'221'} が未実行です</div>`:D.ready?'':'<div class="err" style="margin-top:8px">この店の LINE の設定（マイページの入口・メッセージを送る設定）がありません</div>'}
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-top:12px"><img src="../cast/${x.img}" alt="${x.nm}のリッチメニュー" style="width:300px;max-width:100%;border:1px solid var(--line);border-radius:8px">
      <div style="font-size:14px;line-height:1.9">${k==='minna'?'':`連携している${x.nm}：${Number(x.linked||0)}人<br>`}${x.note}${x.made?`<div style="margin-top:8px"><button class="ghost sm" data-rmre="${k}">メニューを作り直す</button></div>`:''}</div></div></div>`; };
  $('main').innerHTML=head+card('hall')+card('cast')+card('minna');
  const make=async k=>{ const q=await sb.functions.invoke('line-richmenu',{body:{store:st,kind:k}}); let e=q.error?(q.data&&q.data.error)||q.error.message:(q.data&&q.data.error);
    if(e&&q.error&&q.error.context&&q.error.context.json){ try{ e=(await q.error.context.json()).error||e; }catch(x){} }
    if(e){ await uiAlert('メニューを作れませんでした：'+e); return false; } return true; };
  $('main').querySelectorAll('[data-rmon]').forEach(sg=>{ const k=sg.dataset.rmon, x=K[k]; sg.querySelectorAll('[data-v]').forEach(b=>b.onclick=guard(b,async()=>{ const on=b.dataset.v==='true'; if(on===!!x.on) return;
    const who=k==='minna'?'LINE 連携していない友だち全員':`連携している${x.nm}${Number(x.linked||0)}人`;
    if(!await uiConfirm(on?`${x.nm}のリッチメニューを「する」にしますか？\n${who}の LINE にメニューが出ます`:`${x.nm}のリッチメニューを「しない」にしますか？\n${k==='minna'?who:x.nm}の LINE からメニューが消えます`)) return;
    if(on&&!x.made&&!await make(k)) return;
    const q=await rpc('admin_richmenu_on',{p_store:st,p_on:on,p_kind:k}); if(!q.ok) return;
    if(k==='minna'&&q.data!==200){ await uiAlert('LINE に反映できませんでした（'+q.data+'）'); PAGES.o_line(); return; }
    toast(k==='minna'?(on?'付けました':'外しました'):on?`${q.data}人に付けました`:'外しました'); PAGES.o_line(); })); });
  $('main').querySelectorAll('[data-rmre]').forEach(b=>b.onclick=guard(b,async()=>{ const k=b.dataset.rmre; if(!await uiConfirm(`${K[k].nm}のメニューを作り直しますか？\n画像やボタンを変えた時に使います`)) return; if(!await make(k)) return; toast('作り直しました'); PAGES.o_line(); })); };
// v1.23・SQL 138：日報メール（オーナー 2026-10-17。店ごとに1通・毎朝7時・店の Gmail から）。宛先はオーナーだけが変える
// v1.29・SQL 145：黒服の TODO（オーナー 2026-10-18。TimeTree の「todoリスト写メ報告」の代わり）。上＝その日の TODO（済・できない・未・写真）、下＝項目（押すと小窓で変える）
const TODO_SLOT={open:'開店作業',close:'閉店作業',by17:'17時まで',none:'なし'}, TODO_WD=['日','月','火','水','木','金','土'];
// v1.31・SQL 148：いつ に「隔週」「毎月 第◯ ◯曜日」「毎年」（オーナー 2026-10-18。TimeTree の TODO を入れるため）
const TODO_KIND=[['daily','毎日'],['weekly','毎週'],['biweekly','隔週'],['monthly','毎月（日にち）'],['nth','毎月（第◯ ◯曜日）'],['month_end','月末（最終日）'],['yearly','毎年'],['once','その日だけ']];
const todoMd=d=>String(d||'').slice(5).split('-').map(Number).join('/'), todoWds=x=>(x.rule_dows||[]).map(d=>TODO_WD[d]).join('・');
const todoWhen=x=>x.rule_kind==='daily'?'毎日':x.rule_kind==='weekly'?`毎週 ${todoWds(x)}`:x.rule_kind==='biweekly'?`隔週 ${todoWds(x)}`:x.rule_kind==='monthly'?`毎月 ${(x.rule_days||[]).join('・')}日`:x.rule_kind==='nth'?`毎月 第${(x.rule_nth||[]).join('・')} ${todoWds(x)}`:x.rule_kind==='month_end'?'月末':x.rule_kind==='yearly'?`毎年 ${todoMd(x.rule_date)}`:`${todoMd(x.rule_date)} だけ`;
// v1.34・SQL 153：TODO は設定の中の1つだけ（オーナー 2026-10-18「わざわざタブ一つつくる必要ある？」）。上＝その日の TODO（済・できない・未・写真）、下＝月のカレンダー（TimeTree のように）。「項目」で足す・変える
let todoDay=null, todoMon=null, todoView='cal';
PAGES.todo=()=>{ page='set_todo'; return PAGES.set_todo(); };
PAGES.set_todo=async()=>{ const st=storeId, ed=perm('set_todo')==='edit';
  if(!todoDay) todoDay=businessDate(); if(!todoMon) todoMon=todoDay.slice(0,7);
  const head=`<div class="row" style="align-items:center;gap:10px;margin-bottom:12px"><h1 style="margin:0">TODO <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1><span style="flex:1"></span>
    <span class="seg"><button class="${todoView==='cal'?'on':''}" data-tv="cal">カレンダー</button><button class="${todoView==='items'?'on':''}" data-tv="items">項目</button></span>${ed&&todoView==='items'?'<button class="ghost sm" id="tdAdd">＋ TODO を追加</button>':''}</div>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const it=await sb.rpc('admin_todo_items',{p_store:st}); if(page!=='set_todo'||storeId!==st) return;
  if(it.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_todo/.test(it.error.message)?'SQL 146 が未実行です：':'読み込めません：')}${esc(it.error.message)}</div>`; return; }
  const I=it.data||[], byId=Object.fromEntries(I.map(x=>[x.id,x]));
  const wire=()=>{ $('main').querySelectorAll('[data-tv]').forEach(b=>b.onclick=()=>{ todoView=b.dataset.tv; PAGES.set_todo(); }); const ad=$('tdAdd'); if(ad) ad.onclick=()=>todoEdit(st,null); };
  if(todoView==='items'){
    $('main').innerHTML=head+`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:8px">黒服マイページに出る。その日の出勤の黒服がやる</div>
      <div style="border:1px solid var(--line);border-radius:10px;background:#fff">${I.map((x,i)=>`<div ${ed?`data-tdi="${i}"`:''} style="display:flex;justify-content:space-between;gap:12px;padding:10px 14px;${i?'border-top:1px solid var(--line);':''}${ed?'cursor:pointer':''}"><span>${esc(x.name)}</span><span class="muted" style="text-align:right;font-size:14px;white-space:nowrap">${todoWhen(x)}　${x.slot!=='none'?TODO_SLOT[x.slot]:''}${x.need_photo?'　写真':''}${x.need_note?'　書く':''}</span></div>`).join('')||'<div class="muted" style="padding:10px 14px">なし</div>'}</div></div>`;
    wire(); if(ed) $('main').querySelectorAll('[data-tdi]').forEach(e=>e.onclick=()=>todoEdit(st,I[+e.dataset.tdi])); return; }
  const mo=await sb.rpc('admin_todo_month',{p_store:st,p_month:todoMon+'-01'}); if(page!=='set_todo'||storeId!==st) return;
  if(mo.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_todo_month/.test(mo.error.message)?'SQL 153 が未実行です：':'読み込めません：')}${esc(mo.error.message)}</div>`; return; }
  const M=mo.data||{}, today=businessDate();
  if(todoDay.slice(0,7)!==todoMon) todoDay=todoMon===today.slice(0,7)?today:todoMon+'-01';
  const stOf=(x,d)=>x.status==='done'?'done':x.status==='skip'?'skip':d>today?'fut':'open';
  const CHS={done:'background:var(--gold-soft)',skip:'background:var(--soft);color:var(--muted)',open:'background:var(--warn-soft);color:var(--warn);font-weight:700',fut:'background:#fff;border:1px solid var(--line)'};
  const D=M[todoDay]||[], hm=t=>t?new Date(t).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}):'';
  const wdN=d=>TODO_WD[new Date(d+'T00:00:00+09:00').getDay()], cnt=k=>D.filter(x=>stOf(x,todoDay)===k).length;
  const badge=k=>`<span style="font-size:12px;border-radius:999px;padding:1px 8px;white-space:nowrap;${CHS[k]}">${({done:'完了',skip:'できない',open:'未完了',fut:'これから'})[k]}</span>`;
  const dayCard=`<div class="card"><div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px"><b style="font-size:20px">${Number(todoDay.slice(5,7))}/${Number(todoDay.slice(8))}（${wdN(todoDay)}）${todoDay===today?'　本日':''}</b><span class="muted" style="font-size:13px">TODO ${D.length}件${D.length?`　完了 ${cnt('done')}・できない ${cnt('skip')}・未完了 ${cnt('open')}`:''}</span></div>
    ${(()=>{ const row=(x,i)=>{ const k=stOf(x,todoDay); return `<div style="border-top:1px solid var(--line);padding:9px 0"><div style="display:flex;gap:8px;align-items:center">${badge(k)}<b style="flex:1;font-weight:500;${ed&&byId[x.id]?'cursor:pointer':''}" ${ed&&byId[x.id]?`data-tde="${x.id}"`:''}>${esc(x.name)}</b><span class="muted" style="font-size:12px;white-space:nowrap">${esc(TODO_SLOT[x.slot]&&x.slot!=='none'?TODO_SLOT[x.slot]:'')}${x.by?'　'+esc(x.by):''}${x.at?' '+hm(x.at):''}</span>${ed&&byId[x.id]?`<button class="ghost sm" data-tde="${x.id}" style="padding:0 8px">変更</button>`:''}</div>
      ${((x.photos&&x.photos.length)?x.photos:(x.photo?[x.photo]:[])).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;margin:8px 6px 0 0"></a>`).join('')/* v1.40：写真は何枚でも（SQL 176） */}
      ${x.status==='skip'&&x.reason?`<div style="font-size:13px;margin-top:4px">理由：${esc(x.reason)}</div>`:''}${x.note?`<div style="font-size:13px;margin-top:4px;white-space:pre-wrap">${esc(x.note_hint||'書いたこと')}：${esc(x.note)}</div>`:''}
      ${x.steps?`<details style="margin-top:4px"><summary class="muted" style="font-size:13px;cursor:pointer">手順</summary><div style="font-size:13px;white-space:pre-wrap;margin-top:4px">${esc(x.steps)}</div></details>`:''}</div>`; };
      /* v1.61・SQL 234：休日分（休みの日の TODO を次の営業日に）を黒服マイページと同じく分けて出す（オーナー 2026-10-26「土日の To Do 表示されてるよね？」）。言葉は用語集：休日分・本日分・期限 閉店・期限 17:00 */
      const C=D.filter(x=>x.carry), T=D.filter(x=>!x.carry), md=d=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`, cd=[...new Set(C.map(x=>x.day))].sort();
      const sec=(t,r)=>`<div style="display:flex;gap:10px;align-items:baseline;border-top:1px solid var(--line);padding:10px 0 2px"><b style="font-size:15px">${t}</b>${r||''}</div>`;
      if(!C.length) return T.map(row).join('')||'<div class="muted">この日の TODO はありません</div>';
      const late=C.some(x=>x.late);
      return sec(`休日分（${cd.length>2?`${md(cd[0])}〜${md(cd[cd.length-1])}`:cd.map(md).join('・')}）`,`<span style="${late?'background:var(--warn-soft);color:var(--warn);':'color:var(--muted);'}border-radius:6px;padding:2px 8px;font-size:13px;white-space:nowrap">期限 ${esc(C[0].deadline||'閉店')}</span>`)
        + C.map(row).join('') + sec('本日分') + (T.map(row).join('')||'<div class="muted">本日分の TODO はありません</div>'); })()}
    <div class="muted" style="font-size:12px;margin-top:6px">写真は30日で消えます</div></div>`;
  const [yy,mm]=todoMon.split('-').map(Number), f=new Date(yy,mm-1,1), st0=new Date(yy,mm-1,1-f.getDay()), ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const weeks=Math.ceil((f.getDay()+new Date(yy,mm,0).getDate())/7); let cells='';
  for(let i=0;i<weeks*7;i++){ const d=new Date(st0); d.setDate(st0.getDate()+i); const k=ymd(d), inM=d.getMonth()===mm-1, L=inM?(M[k]||[]):[];
    cells+=`<div data-tdd="${inM?k:''}" style="border:1px solid var(--line);margin:-1px 0 0 -1px;min-height:112px;padding:4px;min-width:0;${inM?'cursor:pointer;background:#fff':'background:var(--soft)'};${k===todoDay?'outline:3px solid var(--ok);outline-offset:-3px':''}">
      <div style="font-size:13px;font-weight:700;margin-bottom:2px;${d.getDay()===0?'color:var(--warn)':''}">${k===today?`<span style="background:var(--head);color:#fff;border-radius:999px;padding:0 6px">${d.getDate()}</span>`:d.getDate()}</div>
      ${L.slice(0,4).map(x=>`<div ${ed&&byId[x.id]?`data-tdc="${x.id}"`:''} style="font-size:12px;line-height:1.35;border-radius:4px;padding:1px 4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${CHS[stOf(x,k)]}">${esc(x.name)}</div>`).join('')}${L.length>4?`<div class="muted" style="font-size:12px">ほか ${L.length-4}</div>`:''}</div>`; }
  const sw=k=>`<span style="display:inline-block;width:14px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:3px;${CHS[k]}"></span>`;
  $('main').innerHTML=head+dayCard+`<div class="card" style="margin-top:14px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><button class="ghost sm" id="tdmP">‹</button><b style="font-size:18px">${yy}年${mm}月</b><button class="ghost sm" id="tdmN">›</button><span style="flex:1"></span><span class="muted" style="font-size:12px">${sw('done')}完了　${sw('open')}未完了　${sw('skip')}できない　${sw('fut')}これから</span></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">${TODO_WD.map(w=>`<div class="muted" style="text-align:center;font-size:12px;padding:3px">${w}</div>`).join('')}${cells}</div></div>`;
  wire();
  const mv=n=>{ const d=new Date(yy,mm-1+n,1); todoMon=ymd(d).slice(0,7); PAGES.set_todo(); }; $('tdmP').onclick=()=>mv(-1); $('tdmN').onclick=()=>mv(1);
  $('main').querySelectorAll('[data-tdd]').forEach(c=>{ if(c.dataset.tdd) c.onclick=()=>{ todoDay=c.dataset.tdd; PAGES.set_todo(); window.scrollTo(0,0); }; });
  $('main').querySelectorAll('[data-tde]').forEach(b=>b.onclick=()=>todoEdit(st,byId[b.dataset.tde]));
  /* v1.59：カレンダーの TODO の名前を押すと、その項目の編集（オーナー 2026-10-25「カレンダーからのタップで編集できるように。いちいち項目から探すのだるい」） */
  $('main').querySelectorAll('[data-tdc]').forEach(c=>c.onclick=e=>{ e.stopPropagation(); todoEdit(st,byId[c.dataset.tdc]); }); };
function todoEdit(st,x){ const isNew=!x; x=x||{name:'',steps:'',rule_kind:'weekly',rule_dows:[],rule_days:[],rule_nth:[],rule_date:null,slot:'open',need_photo:false,need_note:false,note_hint:''};
  const md=modal(`<h2 style="margin:0">${isNew?'TODO の追加':esc(x.name)}</h2><label>名前<input id="tdN" value="${esc(x.name)}"></label>
    <label>いつ<select id="tdK">${TODO_KIND.map(([v,n])=>`<option value="${v}" ${x.rule_kind===v?'selected':''}>${n}</option>`).join('')}</select></label>
    <div id="tdKn" style="display:flex;gap:6px;flex-wrap:wrap">${[1,2,3,4,5].map(n=>`<label style="display:flex;align-items:center;gap:4px;margin:0"><input type="checkbox" data-nth="${n}" ${(x.rule_nth||[]).includes(n)?'checked':''} style="width:auto">第${n}</label>`).join('')}</div>
    <div id="tdKw" style="display:flex;gap:6px;flex-wrap:wrap">${TODO_WD.map((w,i)=>`<label style="display:flex;align-items:center;gap:4px;margin:0"><input type="checkbox" data-dw="${i}" ${(x.rule_dows||[]).includes(i)?'checked':''} style="width:auto">${w}</label>`).join('')}</div>
    <label id="tdKm">日（「1,15」のように）<input id="tdDays" value="${esc((x.rule_days||[]).join(','))}" inputmode="numeric"></label>
    <label id="tdKo"><span id="tdKoL">日付</span><input type="date" id="tdDt" value="${esc(x.rule_date||'')}"></label>
    <label>時間<select id="tdS">${Object.entries(TODO_SLOT).map(([v,n])=>`<option value="${v}" ${x.slot===v?'selected':''}>${n}</option>`).join('')}</select></label>
    <label>写真<select id="tdP"><option value="false">不要</option><option value="true" ${x.need_photo?'selected':''}>要</option></select></label>
    <label>書く欄<select id="tdW"><option value="false">なし</option><option value="true" ${x.need_note?'selected':''}>あり</option></select></label>
    <label id="tdHw">書く欄の見出し<input id="tdH" value="${esc(x.note_hint||'')}" placeholder="例：在庫の数"></label>
    <label>手順（黒服に見せる）<textarea id="tdT" rows="6" style="width:100%;font:inherit;font-size:15px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">${esc(x.steps||'')}</textarea></label>
    <div class="bar">${isNew?'':'<button class="ghost" data-k="del" style="color:var(--warn);margin-right:auto">削除</button>'}<button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  const q=id=>md.querySelector('#'+id), paint=()=>{ const k=q('tdK').value; q('tdKw').style.display=['weekly','biweekly','nth'].includes(k)?'flex':'none'; q('tdKn').style.display=k==='nth'?'flex':'none'; q('tdKm').style.display=k==='monthly'?'':'none'; q('tdKo').style.display=['biweekly','yearly','once'].includes(k)?'':'none'; q('tdKoL').textContent=k==='biweekly'?'初めの日（この日から隔週）':k==='yearly'?'日付（毎年この月日）':'日付'; q('tdHw').style.display=q('tdW').value==='true'?'':'none'; };
  q('tdK').onchange=paint; q('tdW').onchange=paint; paint();
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  const del=md.querySelector('[data-k=del]'); if(del) del.onclick=async()=>{ if(!await uiConfirm(`「${x.name}」を削除しますか？\n今までの記録は残ります`,'削除','danger')) return; const r=await rpc('admin_todo_remove',{p_store:st,p_id:x.id}); if(!r.ok) return; md.remove(); toast('削除しました'); PAGES.set_todo(); }; /* v1.59：外す → 削除（オーナー 2026-10-25「外すではなく削除だろ」） */
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{
    const row={name:q('tdN').value.trim(),rule_kind:q('tdK').value,rule_dows:[...md.querySelectorAll('[data-dw]:checked')].map(e=>+e.dataset.dw),rule_days:q('tdDays').value.split(/[,、\s]+/).map(v=>parseInt(v,10)).filter(v=>v>=1&&v<=31),rule_nth:[...md.querySelectorAll('[data-nth]:checked')].map(e=>+e.dataset.nth),rule_date:q('tdDt').value||null,
      slot:q('tdS').value,need_photo:q('tdP').value==='true',need_note:q('tdW').value==='true',note_hint:q('tdH').value.trim(),steps:q('tdT').value};
    if(!row.name){ await uiAlert('名前を入力してください'); return; }
    const r=await rpc('admin_todo_save',{p_store:st,p_id:isNew?null:x.id,p_row:row}); if(!r.ok) return; md.remove(); toast('保存しました'); PAGES.set_todo(); }); }
PAGES.o_daily=async()=>{ const st=storeId, head=`<h1>日報メール <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_daily_mail_get',{p_store:st}); if(page!=='o_daily'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_daily_mail_get/.test(r.error.message)?'SQL 138 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data||{}, L=D.last;
  $('main').innerHTML=head+`<div class="card"><div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;align-items:center;max-width:560px">
      <span class="muted">送る時刻</span><span>毎朝 7:00（前の営業日の分）</span>
      <span class="muted">送り主</span><span>${D.ready?'店の Gmail':'<span class="badge warnb">店の Gmail の準備なし</span>'}</span>
      <span class="muted">前回</span><span>${L?`${esc(fmtDT(L.at))}　${esc(L.result||'')}`:'なし'}</span></div>
    <div style="margin-top:14px"><label style="display:block">宛先（1行に1つ）<textarea id="dmTo" rows="4" style="display:block;margin-top:4px;width:100%;max-width:520px;font:inherit;font-size:15px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">${esc((D.to||'').split(',').filter(Boolean).join('\n'))}</textarea></label></div>
    <div class="fend"><button class="ghost sm" id="dmTest">試しに送る（昨日の分）</button><span class="sp"></span><button class="primary sm" id="dmSave">保存</button></div></div>
    <div class="card"><b>中身</b><div style="margin-top:6px;line-height:1.9;font-size:14px">売上（月累計）／来店一覧／出退勤／連絡先交換／黒服の報告／その日のメモ</div></div>`;
  $('dmSave').onclick=guard($('dmSave'),async()=>{ const q=await rpc('admin_daily_mail_save',{p_store:st,p_to:$('dmTo').value.split(/\n/).map(x=>x.trim()).filter(Boolean).join(',')}); if(!q.ok) return; toast('保存しました'); PAGES.o_daily(); });
  $('dmTest').onclick=guard($('dmTest'),async()=>{ if(unsavedNow()){ await uiAlert('先に宛先を保存してください'); return; } await sb.rpc('admin_daily_mail_prepare'); /* v1.35・SQL 156：写真を先に準備（別の呼び出しで） */ const q=await rpc('admin_daily_mail_test',{p_store:st}); if(!q.ok) return; await uiAlert(q.data==='送信'?'送りました':String(q.data)); PAGES.o_daily(); }); };
PAGES.o_contract=async()=>{ const head='<h1>契約書</h1>';
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_contract_get'); if(page!=='o_contract') return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(r.error.message)}</div>`; return; }
  const V=r.data.version, A=r.data.agreed||[]; const D=ctDraft||(ctDraft={title:V.title,preamble:V.preamble,oath:V.oath,articles:(V.articles||[]).map(a=>({...a,to:['cast','hall'].includes(a.to)?a.to:'all'}))}); /* v1.65・SQL 271：条文ごとの区分（キャスト・黒服） */
  const tw=(a,k)=>a.to==='all'||a.to===k;
  const ta=(id,v,rows)=>`<textarea id="${id}" rows="${rows}" style="width:100%;font:inherit;font-size:15px;line-height:1.6;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">${esc(v||'')}</textarea>`;
  const day=a=>{ const d=new Date(new Date(a).getTime()+9*3600e3); return `${d.getUTCFullYear()}/${d.getUTCMonth()+1}/${d.getUTCDate()}`; };
  $('main').innerHTML=head+`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:8px">LINEマイページで同意する契約書です。保存すると新しい版になり、これから同意する人に表示します（同意済みの人の版は変更されません）。今の版：${day(V.at)}</div>
      <label>タイトル<input id="ctT" value="${esc(D.title)}"></label><label style="display:block;margin-top:8px">前文${ta('ctP',D.preamble,3)}</label>
      ${D.articles.map((a,i)=>`<div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px"><div style="display:flex;gap:8px;align-items:center"><input data-at="${i}" value="${esc(a.title)}" style="flex:1"><span class="seg"><button data-to="${i}" data-k="cast" class="${tw(a,'cast')?'on':''}">キャスト</button><button data-to="${i}" data-k="hall" class="${tw(a,'hall')?'on':''}">黒服</button></span><button class="ghost sm" data-ad="${i}">削除</button></div><div style="margin-top:6px">${ta('ctB'+i,a.body,4)}</div></div>`).join('')}
      <div class="muted" style="font-size:13px;margin-top:10px">キャスト・黒服：押した方の LINEマイページに出す条文です（両方押すと全員）</div>
      <div style="margin-top:10px"><button class="ghost sm" id="ctAdd">条文の追加</button></div>
      <label style="display:block;margin-top:12px">最終誓約${ta('ctO',D.oath,2)}</label>
      <div style="display:flex;gap:8px;margin-top:12px"><span style="flex:1"></span><button class="ghost sm" id="ctX">キャンセル</button><button class="primary sm" id="ctS">保存</button></div></div>
    <div class="card"><b>同意の一覧</b> <small class="muted">${A.length}人</small>${A.map(x=>`<div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px;font-size:14px;line-height:1.7"><b>${esc(x.cast)}</b>${x.active?'':'<small class="muted">（退店）</small>'} <small class="muted">${esc(x.store)}・${x.kind==='hall'?'黒服':'キャスト'}・${day(x.at)} 同意${x.latest?'':'（旧版）'}</small><br>${esc(x.name)}　${esc(x.phone)}　${esc(x.email)}<br>${esc(x.address)}<br><img src="${x.signature}" alt="署名" style="height:60px;border:1px solid var(--line);border-radius:6px;background:var(--card);margin-top:4px"></div>`).join('')||'<div class="muted" style="margin-top:8px">まだありません</div>'}</div>`;
  const keep=()=>{ D.title=$('ctT').value; D.preamble=$('ctP').value; D.oath=$('ctO').value; D.articles.forEach((a,i)=>{ a.title=$('main').querySelector(`[data-at="${i}"]`).value; a.body=$('ctB'+i).value; }); };
  $('ctAdd').onclick=()=>{ keep(); D.articles.push({title:`第${D.articles.length+1}条：`,body:'',to:'all'}); PAGES.o_contract(); };
  $('main').querySelectorAll('[data-to]').forEach(b=>b.onclick=()=>{ keep(); const a=D.articles[+b.dataset.to], k=b.dataset.k, o=k==='cast'?'hall':'cast';
    if(!tw(a,k)) a.to=tw(a,o)?'all':k; else if(tw(a,o)) a.to=o; else { toast('キャスト・黒服のどちらかは選んでください'); return; } PAGES.o_contract(); });
  $('main').querySelectorAll('[data-ad]').forEach(b=>b.onclick=async()=>{ keep(); const a=D.articles[+b.dataset.ad]; if(!await uiConfirm(`「${a.title}」を削除しますか？`,'削除','danger')) return; D.articles.splice(+b.dataset.ad,1); PAGES.o_contract(); });
  $('ctX').onclick=()=>{ ctDraft=null; PAGES.o_contract(); };
  $('ctS').onclick=guard($('ctS'),async()=>{ keep(); const arts=D.articles.map(a=>({title:a.title.trim(),body:a.body.trim(),to:a.to})).filter(a=>a.title||a.body);
    if(!D.title.trim()||!arts.length){ await uiAlert('タイトルと条文を入力してください'); return; }
    if(!await uiConfirm('契約書を保存しますか？\nこれから同意する人に、新しい版を表示します')) return;
    const x=await rpc('admin_contract_save',{p_title:D.title,p_preamble:D.preamble,p_articles:arts,p_oath:D.oath}); if(!x.ok) return; ctDraft=null; toast('保存しました'); PAGES.o_contract(); }); };
PAGES.o_ids=async()=>{
  $('main').innerHTML=`<h1>管理サイトのID</h1><div class="card muted">読み込み中…</div>`;
  const [ra,rh]=await Promise.all([sb.rpc('admin_accounts_list'),sb.rpc('admin_hall_staff',{p_store:storeId})]);
  if(page!=='o_ids') return;
  if(ra.error||rh.error){ $('main').innerHTML=`<h1>管理サイトのID</h1><div class="card err">${esc((ra.error||rh.error).message)}</div>`; return; }
  const halls=rh.data||[], sName=id=>stores().find(s=>s.id===id)?.name||'';
  const list=(ra.data||[]).filter(a=>a.is_owner||a.store_id===storeId);
  $('main').innerHTML=`<h1>管理サイトのID <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
  <div class="card"><h2>IDの一覧</h2><table class="t"><tr><th>ID</th><th>名前</th><th>店舗</th><th>黒服</th><th>状態</th><th></th></tr>
  ${list.map(a=>`<tr><td><b>${esc(a.login_id)}</b></td><td>${esc(a.name)}</td><td>${a.is_owner?'全店舗':esc(sName(a.store_id))}</td><td>${esc(a.staff_name||'—')}</td>
    <td>${a.is_owner?'<span class="badge">オーナー</span>':a.is_active?'使える':'<span class="badge gray">停止中</span>'}</td>
    <td style="text-align:right">${a.is_owner?'':`<button class="ghost sm" data-ed="${a.id}">変更</button>`}</td></tr>`).join('')}
  </table></div>
  <div class="card"><h2>IDの作成</h2>
    <div class="grid2">
      <label>ID（半角の小文字・数字 3〜20文字）<input id="nId" autocapitalize="off" spellcheck="false"></label>
      <label>黒服と結びつける<select id="nStaff"><option value="">結びつけない</option>${halls.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></label>
      <label id="nNameBox">名前<input id="nName"></label>
      <label>最初のパスワード（8文字以上）<input id="nPw" autocapitalize="off" spellcheck="false"></label>
    </div>
    <div class="row" style="margin-top:10px"><button class="ghost" id="nGen">パスワードを自動作成</button><button class="primary" id="nSave">作成</button></div>
    <div class="muted hint" style="font-size:14px;margin-top:8px">黒服と結びつけると、POSでその黒服を削除した時に、このIDも自動で使えなくなります<button type="button" class="qm" aria-label="詳しく">？</button><div class="more">店舗は上で選んでいる「${esc(curStore()?.name||'')}」になります</div></div>
  </div>`;
  $('nGen').onclick=()=>{ $('nPw').value=genPw(10); };
  /* v0.89：黒服を選んだら、名前はその黒服の名前（名前の枠は「結びつけない」の時だけ。オーナー 2026-10-14） */
  const nSync=()=>{ $('nNameBox').style.display=$('nStaff').value?'none':''; }; $('nStaff').onchange=nSync; nSync();
  $('nSave').onclick=guard($('nSave'),async()=>{
    const id=$('nId').value.trim().toLowerCase(), pw=$('nPw').value;
    if(!/^[a-z0-9_-]{3,20}$/.test(id)){ await uiAlert('IDは半角の小文字・数字で3〜20文字にしてください'); return; }
    if(pw.length<8){ await uiAlert('パスワードは8文字以上にしてください'); return; }
    const r=await rpc('admin_account_create',{p_login:id,p_pw:pw,p_name:$('nStaff').value?(halls.find(h=>h.id===$('nStaff').value)?.name||''):$('nName').value.trim(),p_store:storeId,p_staff:$('nStaff').value||null}); if(!r.ok) return;
    await uiAlert(`IDを作成しました\n\nID：${id}\nパスワード：${pw}\n\n本人に伝えてください`); PAGES.o_ids(); });
  $('main').querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>editAccount(list.find(a=>a.id===b.dataset.ed),halls));
};
async function editAccount(a,halls){ if(!a) return;
  const m=modal(`<h2 style="margin:0">IDの変更：${esc(a.login_id)}</h2>
    <label>名前<input data-k="name" value="${esc(a.name)}"></label>
    <label>黒服と結びつける<select data-k="staff"><option value="">結びつけない</option>${halls.map(h=>`<option value="${h.id}" ${h.id===a.staff_id?'selected':''}>${esc(h.name)}</option>`).join('')}${a.staff_id&&!halls.some(h=>h.id===a.staff_id)?`<option value="${a.staff_id}" selected>${esc(a.staff_name||'（削除済の黒服）')}</option>`:''}</select></label>
    <label>状態<select data-k="active"><option value="1" ${a.is_active?'selected':''}>使える</option><option value="0" ${a.is_active?'':'selected'}>停止（ログイン不可）</option></select></label>
    <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  const q=k=>m.querySelector(`[data-k=${k}]`);
  q('no').onclick=()=>m.remove();
  q('ok').onclick=guard(q('ok'),async()=>{ const act=q('active').value==='1';
    if(a.is_active&&!act&&!await uiConfirm(`「${a.login_id}」を停止します。ログイン中でもすぐに使えなくなります`,'停止','danger')) return;
    const r=await rpc('admin_account_update',{p_id:a.id,p_name:q('name').value.trim(),p_staff:q('staff').value||null,p_active:act}); if(!r.ok) return;
    m.remove(); toast('保存しました'); PAGES.o_ids(); });
}

