// ---------- 日報メール・契約書（オーナー） ----------
// 日報メール（オーナー。店ごとに1通・毎朝7時・店の Gmail から）。宛先はオーナーだけが変える
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
  $('dmTest').onclick=guard($('dmTest'),async()=>{ if(unsavedNow()){ await uiAlert('先に宛先を保存してください'); return; } await sb.rpc('admin_daily_mail_prepare'); /* 写真を先に準備（別の呼び出しで） */ const q=await rpc('admin_daily_mail_test',{p_store:st}); if(!q.ok) return; await uiAlert(q.data==='送信'?'送りました':String(q.data)); PAGES.o_daily(); }); };
// 契約書（オーナーのみ）。LINEマイページで同意する「業務委託契約 兼 誓約書」の条文の変更（保存すると新しい版。同意済みの人の版はそのまま）と、同意の一覧（本人情報・署名）
let ctDraft=null;
PAGES.o_contract=async()=>{ const head='<h1>契約書</h1>';
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_contract_get'); if(page!=='o_contract') return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(r.error.message)}</div>`; return; }
  const V=r.data.version, A=r.data.agreed||[]; const D=ctDraft||(ctDraft={title:V.title,preamble:V.preamble,oath:V.oath,articles:(V.articles||[]).map(a=>({...a,to:['cast','hall'].includes(a.to)?a.to:'all'}))}); /* 条文ごとの区分（キャスト・黒服） */
  const tw=(a,k)=>a.to==='all'||a.to===k;
  const ta=(id,v,rows)=>`<textarea id="${id}" rows="${rows}" style="width:100%;font:inherit;font-size:15px;line-height:1.6;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">${esc(v||'')}</textarea>`;
  const day=a=>{ const d=new Date(new Date(a).getTime()+9*3600e3); return `${d.getUTCFullYear()}/${d.getUTCMonth()+1}/${d.getUTCDate()}`; };
  $('main').innerHTML=head+`<div class="card"><div class="muted" style="font-size:13px;margin-bottom:8px">LINEマイページで同意する契約書です。保存すると新しい版になり、これから同意する人に表示します（同意済の人の版は変更されません）。今の版：${day(V.at)}</div>
      <label>タイトル<input id="ctT" value="${esc(D.title)}"></label><label style="display:block;margin-top:8px">前文${ta('ctP',D.preamble,3)}</label>
      ${D.articles.map((a,i)=>`<div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px"><div style="display:flex;gap:8px;align-items:center"><input data-at="${i}" value="${esc(a.title)}" style="flex:1"><span class="seg"><button data-to="${i}" data-k="cast" class="${tw(a,'cast')?'on':''}">キャスト</button><button data-to="${i}" data-k="hall" class="${tw(a,'hall')?'on':''}">黒服</button></span><button class="xb" data-ad="${i}" aria-label="削除">×</button></div><div style="margin-top:6px">${ta('ctB'+i,a.body,4)}</div></div>`).join('')}
      <div class="muted" style="font-size:13px;margin-top:10px">キャスト・黒服：押した方の LINEマイページに出す条文です（両方押すと全員）</div>
      <div style="margin-top:10px"><button class="ghost sm" id="ctAdd">条文の追加</button></div>
      <label style="display:block;margin-top:12px">最終誓約${ta('ctO',D.oath,2)}</label>
      <div style="display:flex;gap:8px;margin-top:12px"><span style="flex:1"></span><button class="ghost sm" id="ctX">キャンセル</button><button class="primary sm" id="ctS">保存</button></div></div>
    <div class="card"><b>同意の一覧</b> <small class="muted">${A.length}人</small>${A.map(x=>`<div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px;font-size:14px;line-height:1.7"><b>${esc(x.cast)}</b>${x.active?'':'<small class="muted">（退店）</small>'} <small class="muted">${esc(x.store)}・${x.kind==='hall'?'黒服':'キャスト'}・${day(x.at)} 同意${x.latest?'':'（旧版）'}</small><br>${esc(x.name)}　${esc(x.phone)}　${esc(x.email)}<br>${esc(x.address)}<br><img src="${esc(x.signature) /* 署名も esc（点検） */}" alt="署名" style="height:60px;border:1px solid var(--line);border-radius:6px;background:var(--card);margin-top:4px"></div>`).join('')||'<div class="muted" style="margin-top:8px">まだありません</div>'}</div>`;
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
