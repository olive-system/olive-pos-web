// v1.98・SQL 341：LINE自動送信（オーナー 2026-11-03「リマインドについて設定できる画面ってあるんかな？」→ 見本 作業場/LINE自動送信_案.png）
//   リマインド（キャスト：休み希望・新調日・ミーティング／黒服：未提出の一覧）の 送信日・時刻・送信。変更するとすぐ保存
//   ランキング（SQL 340 の rank_settings）も同じ画面。SQL 340 が未実行の時は箱を出さない
const LA_ROWS=[['shift','休み希望'],['dress','新調日'],['meeting','ミーティング']];
const LA_WD=['日曜','月曜','火曜','水曜','木曜','金曜','土曜'];
const laTimes=()=>{ const a=[]; for(let h=9;h<24;h++) for(const m of ['00','30']) a.push(`${String(h).padStart(2,'0')}:${m}`); return a; };
const laSel=(attr,opts,v)=>`<select ${attr} style="width:auto">${opts.map(([k,n])=>`<option value="${k}" ${String(k)===String(v)?'selected':''}>${n}</option>`).join('')}</select>`;
const laTime=(attr,v)=>laSel(attr,laTimes().map(t=>[t,t.replace(/^0/,'')]),v);
const laOn=(attr,v)=>laSel(attr,[['1','する'],['0','しない']],v?'1':'0');
const laDays=(attr,v)=>laSel(attr,[[0,'当日'],...[1,2,3,4,5,6,7].map(n=>[n,`${n}日前`])],v);
/* 一覧の列の位置を箱どうしでそろえる（olive-no-misalign） */
const LA_HEAD='<colgroup><col style="width:22%"><col style="width:15%"><col style="width:27%"><col style="width:18%"><col style="width:18%"></colgroup><tr><th>項目</th><th>期限</th><th>送信日</th><th>時刻</th><th>送信</th></tr>';
PAGES.o_line_auto=async()=>{ const st=storeId, head=`<h1>LINE自動送信 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const [r,rk]=await Promise.all([sb.rpc('admin_reminder_get',{p_store:st}),sb.rpc('admin_get_rank_settings',{p_store:st})]); if(page!=='o_line_auto'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_reminder_get/.test(r.error.message)?'SQL 341 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data||{}, R=D.rows||{}, dr=D.dress||{}, K=rk.error?null:(rk.data||{});
  const due={shift:'毎月10日',dress:dr.enabled?`毎月${dr.due_day}日`:'',meeting:'月末'};
  const row=(k,n)=>{ const x=R[k]||{enabled:true,days_before:0,at_time:'13:00'};
    if(k==='dress'&&!dr.enabled) return `<tr><td>${n}</td><td class="muted">—</td><td colspan="3" class="muted">新調日「しない」（報酬・罰金項目で変更）</td></tr>`;
    return `<tr data-la="${k}"><td>${n}</td><td>${due[k]}</td><td>期限の ${laDays('data-lv="days"',x.days_before)}</td><td>${laTime('data-lv="at"',x.at_time)}</td><td>${laOn('data-lv="on"',x.enabled)}</td></tr>`; };
  const h=R.hall||{enabled:true,at_time:'19:00'};
  const rank=!K?'':`<div class="card"><b>ランキング</b><div class="muted" style="font-size:13px;margin-top:4px">キャスト全員へ、先週の順位・毎月1日は先月の順位（LINE連携済のみ）</div>
    <table class="t" style="margin-top:8px;table-layout:fixed">${LA_HEAD}<tr data-rk><td>ランキング</td><td class="muted">—</td>
      <td>${K.dow!=null?`毎週 ${laSel('data-rv="dow"',LA_WD.map((w,i)=>[i,w]),K.dow)}`:'毎週月曜・毎月1日'}</td><td>${K.at_time?laTime('data-rv="at"',K.at_time):'12:00'}</td><td>${laOn('data-rv="on"',K.enabled)}</td></tr></table></div>`;
  $('main').innerHTML=head+`<div class="card"><b>リマインド（キャスト）</b><div class="muted" style="font-size:13px;margin-top:4px">未提出の子へ、提出画面のリンク付きの LINE（LINE連携済のみ）</div>
      <table class="t" style="margin-top:8px;table-layout:fixed">${LA_HEAD}${LA_ROWS.map(([k,n])=>row(k,n)).join('')}</table></div>
    <div class="card"><b>リマインド（黒服）</b><div class="muted" style="font-size:13px;margin-top:4px">担当キャストの未提出の一覧（LINE連携済のみ）</div>
      <table class="t" style="margin-top:8px;table-layout:fixed">${LA_HEAD}<tr data-la="hall"><td>未提出の一覧</td><td>各期限</td><td>期限の当日</td><td>${laTime('data-lv="at"',h.at_time)}</td><td>${laOn('data-lv="on"',h.enabled)}</td></tr></table></div>
    ${rank}<div class="muted" style="font-size:13px">変更するとすぐ保存</div>`;
  $('main').querySelectorAll('[data-la]').forEach(tr=>tr.querySelectorAll('select').forEach(sel=>sel.onchange=async()=>{ const k=tr.dataset.la, v=n=>tr.querySelector(`[data-lv=${n}]`)?.value;
    const x=await rpc('admin_reminder_set',{p_store:st,p_kind:k,p_enabled:v('on')==='1',p_days:k==='hall'?0:+v('days'),p_at:v('at')}); if(!x.ok){ PAGES.o_line_auto(); return; } toast('保存しました'); }));
  const rt=$('main').querySelector('[data-rk]'); if(rt) rt.querySelectorAll('select').forEach(sel=>sel.onchange=async()=>{ const v=n=>rt.querySelector(`[data-rv=${n}]`)?.value;
    const a={p_store:st,p_enabled:v('on')==='1'}; if(K.dow!=null){ a.p_dow=+v('dow'); a.p_at=v('at'); }
    const x=await rpc('admin_save_rank_settings',a); if(!x.ok){ PAGES.o_line_auto(); return; } toast('保存しました'); });
  /* v2.00・SQL 343：連絡先交換の LINE（閉店時／退勤時／しない。オーナー 2026-11-03） */
  const ca=await sb.rpc('admin_contact_ask_get',{p_store:st}); if(page!=='o_line_auto'||storeId!==st||ca.error) return;
  const el=document.createElement('div'); el.className='card';
  el.innerHTML=`<div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>連絡先交換</b>${laSel('data-cav',[['close','閉店時'],['leave','退勤時'],['off','しない']],ca.data)}</div>
    <div class="muted" style="font-size:13px;margin-top:4px;line-height:1.8">閉店時：POS の閉店作業を開いた時に、出勤したキャスト全員へ。本日来店のお客様から選んで提出します<br>退勤時：退勤の打刻の時に、そのキャストへ。退勤までに立ち上がった伝票のお客様から選びます<br>しない：今までどおり、1:00 に未提出のキャストへ LINE</div>`;
  $('main').appendChild(el);
  el.querySelector('[data-cav]').onchange=async e=>{ const x=await rpc('admin_contact_ask_set',{p_store:st,p_mode:e.target.value}); if(!x.ok){ PAGES.o_line_auto(); return; } toast('保存しました'); };
  /* v2.04・SQL 348：応募者（応募から入店。オーナー 2026-11-04「管理サイトで文章を変更できるように。またタブが増えるな」→ この画面に箱を1つ。見本 作業場/応募者_体験の後_案4.png の④）。はじめは全部「しない」 */
  const ap=await sb.rpc('admin_ap_line_get',{p_store:st}); if(page!=='o_line_auto'||storeId!==st||ap.error) return;
  const A=ap.data||{}, AR=[['greet','あいさつ','友だち追加',0],['greet_scout','あいさつ（面接の時）','QR',0],['iv_eve','面接の前日','面接予約',1],['trial_next','体験の翌日','検討中のみ',1],['join','入店','入店',0],['reapproach','再アプローチ','次回連絡日',1]];
  const ae=document.createElement('div'); ae.className='card';
  ae.innerHTML=`<b>応募者</b><div class="muted" style="font-size:13px;margin-top:4px">応募の人へ（再アプローチはオーナーと担当へ）</div>
    <table class="t" style="margin-top:8px;table-layout:fixed">${LA_HEAD.replace('<th>期限</th><th>送信日</th>','<th>対象</th><th>文</th>')}${AR.map(([k,n,tg,t])=>{ const x=A[k]||{};
      return `<tr data-ap="${k}"><td>${n}</td><td>${tg}</td><td><button class="ghost sm" data-ape>編集</button>${x.custom?' <span class="muted" style="font-size:12px">変更済</span>':''}</td><td>${t?laTime('data-apv="at"',x.at_time):'<span class="muted">すぐ</span>'}</td><td>${laOn('data-apv="on"',x.enabled)}</td></tr>`; }).join('')}</table>
    <div id="apEd"></div>`;
  $('main').appendChild(ae);
  const apSave=async(k,body)=>{ const tr=ae.querySelector(`[data-ap="${k}"]`), v=n=>tr.querySelector(`[data-apv=${n}]`)?.value;
    const x=await rpc('admin_ap_line_set',{p_store:st,p_kind:k,p_enabled:v('on')==='1',p_at:v('at')||null,p_body:body===undefined?(A[k]?.custom?A[k].body:null):body}); if(!x.ok){ PAGES.o_line_auto(); return false; } toast('保存しました'); return true; };
  ae.querySelectorAll('[data-ap]').forEach(tr=>{ const k=tr.dataset.ap;
    tr.querySelectorAll('select').forEach(sel=>sel.onchange=()=>apSave(k));
    tr.querySelector('[data-ape]').onclick=()=>{ const n=AR.find(r=>r[0]===k)[1];
      $('apEd').innerHTML=`<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:12px"><div class="muted" style="font-size:13px">${esc(n)}（編集）</div>
        <textarea id="apTx" style="width:100%;height:220px;font:inherit;font-size:14px;border:1px solid var(--line);border-radius:8px;padding:10px;margin-top:6px;box-sizing:border-box">${esc(A[k]?.body||'')}</textarea>
        <div class="muted" style="font-size:12px;margin-top:4px">{店名}{名前}{日時}{住所}{担当}{一覧} は送る時に入れかわります</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="ghost" id="apRs">戻す</button><button class="primary" id="apSv">保存</button></div></div>`;
      $('apSv').onclick=async()=>{ if(await apSave(k,$('apTx').value)) PAGES.o_line_auto(); };
      $('apRs').onclick=async()=>{ if(!await uiConfirm('最初の文に戻しますか？','戻す')) return; if(await apSave(k,'')) PAGES.o_line_auto(); }; }; });
};
