// ---------- Square 連携・LINE メニュー（オーナー） ----------
// Square 連携（オーナーだけ）。POS の閉店作業でカード売上を自動で照合する。トークンは入れたら画面に出さない
PAGES.o_square=async()=>{ const st=storeId, head=`<h1>Square 連携 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_square_get',{p_store:st}); if(page!=='o_square'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_square_get/.test(r.error.message)?'SQL 131 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data;
  $('main').innerHTML=head+`<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>状態</b>${D.set?`<span class="badge k">連携済</span><span>${D.location_name?'店舗：'+esc(D.location_name):'<span class="badge warnb">店舗が未選択</span>'}</span><small class="muted">${fmtDT(D.updated_at)}</small>`:'<span class="badge warnb">未連携</span>'}</div>
      <div id="sqLoc" style="margin-top:10px"></div>
      <div style="margin-top:14px"><label>アクセストークン（本番）<input id="sqTok" type="password" autocomplete="off" placeholder="${D.set?'再登録時のみ入力':'EAAA で始まる文字'}" style="width:100%;max-width:520px"></label></div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="primary" id="sqSave">${D.set?'再登録':'連携'}</button>${D.set?'<button class="ghost" id="sqOff">解除</button>':''}</div></div>
    <div class="card"><b>アクセストークンの作り方</b><ol style="margin:8px 0 0;padding-left:20px;line-height:1.9;font-size:14px">
      <li>Square の開発者サイト（developer.squareup.com）に、店の Square のアカウントでログイン</li>
      <li>「アプリケーション」→「＋」で新しいアプリを作る（名前は OLIVE など）</li>
      <li>上の切り替えを「本番環境」にして、「認証情報」の「本番アクセストークン」をコピー</li>
      <li>この画面に貼り付けて「連携」</li></ol>
      <div class="muted" style="font-size:13px;margin-top:6px">使うのは支払いの読み込みだけです。閉店作業の「レジ金合わせ」で、その営業日（朝8時〜翌朝8時）の Square のカード売上と POS のカードの入金を比べます</div></div>`;
  const locPaint=async()=>{ if(!D.set||D.location_id) return; const q=await rpc('admin_square_locations',{p_store:st}); if(!q.ok) return; const L=q.data||[];
    $('sqLoc').innerHTML=`<div class="muted" style="font-size:13px">Square の店舗を選んでください</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${L.map(x=>`<button class="ghost sm" data-loc="${esc(x.id)}" data-nm="${esc(x.name)}">${esc(x.name)}</button>`).join('')||'<span class="muted">店舗がありません</span>'}</div>`;
    $('sqLoc').querySelectorAll('[data-loc]').forEach(b=>b.onclick=async()=>{ const q2=await rpc('admin_square_location',{p_store:st,p_id:b.dataset.loc,p_name:b.dataset.nm}); if(!q2.ok) return; toast('保存しました'); PAGES.o_square(); }); };
  locPaint();
  $('sqSave').onclick=guard($('sqSave'),async()=>{ const t=$('sqTok').value.trim(); if(!t){ await uiAlert('アクセストークンを入力してください'); return; }
    const q=await rpc('admin_square_save',{p_store:st,p_token:t}); $('sqTok').value=''; if(!q.ok) return; toast('つなぎました'); PAGES.o_square(); });
  if($('sqOff')) $('sqOff').onclick=guard($('sqOff'),async()=>{ if(!await uiConfirm('Square 連携を解除しますか？\nカード売上の照合ができなくなります','解除','danger')) return; const q=await rpc('admin_square_off',{p_store:st}); if(!q.ok) return; toast('解除しました'); PAGES.o_square(); }); };
// LINE メニュー（黒服のリッチメニュー。キャストも。オーナー「LINE 連携した人にだけ」「まずは黒服から」）。店ごとに する／しない。初めて「する」にした時に、Edge Function「line-richmenu」で LINE にメニューを作る
PAGES.o_line=async()=>{ const st=storeId, head=`<h1>LINE メニュー <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_richmenu_get',{p_store:st}); if(page!=='o_line'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_richmenu_get/.test(r.error.message)?'SQL 219 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data; /* キャストのリッチメニューも（D.cast。オーナー） */
  const K={hall:{nm:'黒服',img:'richmenu_hall.png',on:D.on,made:D.made,linked:D.linked,note:'開店・閉店作業：22時から朝8時までは閉店作業、それ以外は開店作業が開きます'},
    cast:{nm:'キャスト',img:'richmenu_cast.png',on:D.cast?.on,made:D.cast?.made,linked:D.cast?.linked,note:'連絡先交換：LINE のお知らせと同じく、入力の画面が開きます',sql:!D.cast},
    /* みんな用（LINE 連携していない友だち。オーナー「採用の LINE と同じにしよう」） */
    minna:{nm:'みんな用',img:'richmenu_minna.png',on:D.minna?.on,made:D.minna?.made,note:'上：面接予約のページ<br>予約状況の確認：電話番号で面接予約を表示<br>ACCESS：Google マップ<br>FAQ：トークに「FAQ」を送信（FAQ の画面は準備中）',sql:!D.minna,no:'275'}};
  const card=k=>{ const x=K[k]; return `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>${x.nm}のリッチメニュー</b>
      <span class="seg" data-rmon="${k}">${[[true,'する'],[false,'しない']].map(([v,n])=>`<button data-v="${v}" class="${!!x.on===v?'on':''}" ${D.ready&&!x.sql?'':'disabled'}>${n}</button>`).join('')}</span></div>
    <div class="muted" style="font-size:13px;margin-top:4px">${k==='minna'?'する：LINE 連携していない友だち全員の、お店の公式 LINE のトークの下にメニューが出ます。連携している黒服・キャストには今までのメニューが出ます':`する：LINE 連携している${x.nm}の、お店の公式 LINE のトークの下にメニューが出ます。押すとマイページのその画面が開きます。${k==='hall'?'キャスト':'黒服'}と、連携していない人には出ません`}</div>
    ${x.sql?`<div class="err" style="margin-top:8px">SQL ${x.no||'221'} が未実行です</div>`:D.ready?'':'<div class="err" style="margin-top:8px">この店の LINE の設定（マイページの入口・メッセージを送る設定）がありません</div>'}
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-top:12px"><img src="../cast/${x.img}" alt="${x.nm}のリッチメニュー" style="width:300px;max-width:100%;border:1px solid var(--line);border-radius:8px">
      <div style="font-size:14px;line-height:1.9">${k==='minna'?'':`連携している${x.nm}：${Number(x.linked||0)}人<br>`}${x.note}${x.made?`<div style="margin-top:8px"><button class="ghost sm" data-rmre="${k}">メニュー再作成</button></div>`:''}</div></div></div>`; };
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
