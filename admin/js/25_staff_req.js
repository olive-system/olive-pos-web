// ---------- 罰金免除申請・出勤希望（オーナー） ----------
// v1.72・SQL 283：罰金免除申請（オーナー 2026-10-29）。店ごとに、キャスト分・黒服分の承認者（複数可。LINE連携済みの人とオーナー）。承認者に公式 LINE が届き、トークの中のボタンで決める
//   オーナーは、はじめに1回「LINE連携」：QR を読むと、その店の公式 LINE に連携コード付きの文が入るので送信する（受け口 Edge Function line-webhook）
PAGES.o_waive=async()=>{ const st=storeId, head=`<h1>罰金免除申請 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_waive_get',{p_store:st}); if(page!=='o_waive'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_waive_get/.test(r.error.message)?'SQL 283 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data, P=[{id:'owner',name:'オーナー'},...(D.people||[])];
  const box=(sc,nm,note)=>`<div class="card"><b>承認者（${nm}）</b><div class="muted" style="font-size:13px;margin-top:4px">${note}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:10px">${P.map(p=>`<label class="ck" style="white-space:nowrap"><input type="checkbox" data-wsc="${sc}" value="${p.id}" ${(D[sc]||[]).includes(p.id)?'checked':''}>${esc(p.name)}${p.kind==='cast'?' <small class="muted">キャスト</small>':''}</label>`).join('')}</div></div>`;
  $('main').innerHTML=head+`<div class="card"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>オーナーのLINE連携</b><span>${D.owner_linked?'<span class="badge">連携済</span>':'<span class="badge gray">未連携</span>'} <button class="ghost sm" id="wvLink">${D.owner_linked?'再連携':'LINE連携'}</button></span></div>
    <div class="muted" style="font-size:13px;margin-top:4px">この店の公式 LINE を友だち追加したスマホで QR を読み、入った文を送信します</div><div id="wvQr"></div></div>
    ${box('cast','キャスト分','POS の打刻修正の罰金免除申請と、キャストの遅刻連絡が届きます')}${box('hall','黒服分','黒服の遅刻連絡が届きます')}
    <div class="muted" style="font-size:13px">選べるのは LINE連携済の人です。だれか1人が押せば決まります</div>`;
  $('main').querySelectorAll('[data-wsc]').forEach(c=>c.onchange=async()=>{ const sc=c.dataset.wsc, ids=[...$('main').querySelectorAll(`[data-wsc="${sc}"]:checked`)].map(x=>x.value);
    const q=await rpc('admin_waive_set',{p_store:st,p_scope:sc,p_ids:ids}); if(q.ok) toast('保存しました'); else PAGES.o_waive(); });
  $('wvLink').onclick=guard($('wvLink'),async()=>{ const q=await rpc('admin_owner_link_code',{p_store:st}); if(!q.ok) return;
    const qr=qrcode(0,'M'); qr.addData(q.data.url); qr.make();
    $('wvQr').innerHTML=`<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:12px">${qr.createSvgTag(5,8)}<div style="font-size:14px;line-height:1.9">連携コード <b style="font-size:20px;letter-spacing:2px">${esc(q.data.code)}</b><br>有効期限 30分<br><span class="muted" style="font-size:13px">QR が読めない時は、公式 LINE に「オーナー連携 ${esc(q.data.code)}」と送信</span><br><button class="ghost sm" id="wvDone">連携の確認</button></div></div>`;
    $('wvDone').onclick=()=>PAGES.o_waive(); });
};
// v1.82・SQL 321：出勤希望（オーナー 2026-11-02「出勤承認か出勤却下（予約は受ける）は、私が指定した権限者＋私に来たラインで決定。遅刻罰金の免除のように」）
//   LINEマイページの予約で「出勤希望 あり」→ オーナー（いつも）とここで選んだ人に公式 LINE【出勤希望】承認／却下。オーナーの LINE連携は「罰金免除申請」の画面
PAGES.o_shiftreq=async()=>{ const st=storeId, head=`<h1>出勤希望 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_waive_get',{p_store:st}); if(page!=='o_shiftreq'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">読み込めません：${esc(r.error.message)}</div>`; return; }
  const D=r.data; if(!D.shift){ $('main').innerHTML=head+'<div class="card err">SQL 321 が未実行です</div>'; return; }
  $('main').innerHTML=head+`<div class="card"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>オーナーのLINE連携</b>${D.owner_linked?'<span class="badge">連携済</span>':'<span class="badge gray">未連携</span>'}</div>
    <div class="muted" style="font-size:13px;margin-top:4px">オーナーにはいつも届きます。${D.owner_linked?'':'LINE連携は「罰金免除申請」の画面で行います'}</div></div>
    <div class="card"><b>承認者</b><div class="muted" style="font-size:13px;margin-top:4px">LINEマイページの予約の出勤希望が届きます</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:10px">${(D.people||[]).map(p=>`<label class="ck" style="white-space:nowrap"><input type="checkbox" data-ssc value="${p.id}" ${(D.shift||[]).includes(p.id)?'checked':''}>${esc(p.name)}${p.kind==='cast'?' <small class="muted">キャスト</small>':''}</label>`).join('')||'<span class="muted">LINE連携済の人がいません</span>'}</div></div>
    <div class="muted" style="font-size:13px">選べるのは LINE連携済の人です。だれか1人が押せば決まります</div>`;
  $('main').querySelectorAll('[data-ssc]').forEach(c=>c.onchange=async()=>{ const ids=[...$('main').querySelectorAll('[data-ssc]:checked')].map(x=>x.value);
    const q=await rpc('admin_waive_set',{p_store:st,p_scope:'shift',p_ids:ids}); if(q.ok) toast('保存しました'); else PAGES.o_shiftreq(); });
};
