// ---------- v2.09・SQL 363：メモ一覧の「共有メモ」（オーナー 2026-11-05「メモ一覧のタブのところに共有メモを足して、ここにくっつけてほしい」。見本 管理サイト_共有メモ_案1） ----------
// オーナーのみ（黒服の管理サイトには切り替えを出さない）。店舗はヘッダーで選んだ店。項目はマイページのオーナーの編集（cast/js/23_memo.js）と同じ
let amFiles=[];
const amTa='width:100%;min-height:140px;font:inherit;font-size:16px;padding:10px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink)';
const amLb=t=>`<div style="font-size:13px;color:var(--muted);margin:12px 0 4px">${t}</div>`;

async function amList(){ const st=storeId;
  $('main').innerHTML=hiMemoSw()+hiHead('hist_memo')+`<div class="row" style="margin-bottom:12px;justify-content:flex-end"><button class="primary" id="amNew">追加</button></div><div id="hiBox"><div class="card muted">読み込み中…</div></div>`;
  hiMemoSwOn(); $('amNew').onclick=()=>amEdit(null);
  const r=await sb.rpc('admin_memo_list',{p_store:st}); if(page!=='hist_memo'||storeId!==st||hiMemoTab!=='share') return; if(r.error){ hiErr(r.error); return; }
  const L=r.data.memos||[];
  $('hiBox').innerHTML=`<div class="card">${L.length?`<table class="t"><tr><th>件名</th><th>共有</th><th>更新</th><th></th></tr>${L.map(x=>`<tr><td><b>${esc(x.title)}</b>${x.needs_change?' <span class="badge warnb">要変更</span>':''}</td><td>${esc(x.members||'—')}</td><td style="white-space:nowrap">${esc(x.updated)}${x.updated_by?' '+esc(x.updated_by):''}</td><td style="text-align:right"><button class="ghost sm" data-am="${x.id}">編集</button></td></tr>`).join('')}</table>`:'<div class="muted">共有メモはありません</div>'}</div>
    <div class="muted" style="font-size:13px">共有した黒服のマイページに表示されます</div>`;
  $('hiBox').querySelectorAll('[data-am]').forEach(b=>b.onclick=()=>amEdit(b.dataset.am)); }

// ファイルを見る：2分だけの入場券をもらってから、2分の署名つきのアドレスで開く（マイページと同じ）
async function amFileOpen(id,p){ const w=window.open('','_blank');
  const q=await sb.rpc('admin_memo_file_open',{p_id:id,p_path:p}); if(q.error){ w?.close(); await uiAlert(q.error.message); return; }
  const s=await sb.storage.from('memo-files').createSignedUrl(p,120); if(s.error||!s.data){ w?.close(); await uiAlert('表示できません'); return; }
  if(w) w.location.href=s.data.signedUrl; else location.href=s.data.signedUrl; }

async function amShrink(file){ const img=await new Promise((ok,ng)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ng; i.src=URL.createObjectURL(file); });
  const k=Math.min(1,1600/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height); return await new Promise(ok=>c.toBlob(ok,'image/jpeg',0.85)); }

async function amEdit(id){ const st=storeId; $('main').innerHTML=hiMemoSw()+`<div class="card muted">読み込み中…</div>`; hiMemoSwOn();
  const [g,l]=await Promise.all([id?sb.rpc('admin_memo_get',{p_id:id}):{data:null},sb.rpc('admin_memo_list',{p_store:st})]);
  if(page!=='hist_memo'||storeId!==st||hiMemoTab!=='share') return; if(g.error||l.error){ $('main').innerHTML=hiMemoSw()+`<div class="card err">読み込めません：${esc((g.error||l.error).message)}</div>`; hiMemoSwOn(); return; }
  /* v2.14・SQL 369：黒服が作成して共有を設定していないメモは、members が店の黒服全員（今見られる人）。保存すると、印を付けた黒服だけに */
  const M=g.data, mem=new Set(M?.members||[]); amFiles=(M?.files||[]).map(f=>({...f}));
  $('main').innerHTML=hiMemoSw()+`<h1>${esc(M?M.title:'追加')} <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>
    ${M?.needs_change?`<div class="card"><b style="color:var(--warn)">要変更</b>　${esc(M.change_note||'')}</div>`:''}
    <div class="card">${amLb('件名')}<input id="amT" maxlength="60" value="${esc(M?.title||'')}">
      ${amLb('本文')}<textarea id="amB" maxlength="5000" style="${amTa}">${esc(M?.body||'')}</textarea>
      ${amLb('リンク名')}<input id="amLn" maxlength="60" value="${esc(M?.link_name||'')}">
      ${amLb('リンク')}<input id="amLu" inputmode="url" placeholder="https://" value="${esc(M?.link_url||'')}">
      ${amLb('ファイル（写真・PDF）')}<div class="row" style="gap:8px"><div id="amFs" style="flex:1;min-width:0"></div><button class="ghost sm" id="amFa">追加</button><input id="amF" type="file" accept="image/jpeg,image/png,application/pdf" style="display:none"></div>
      <label style="display:inline-flex;align-items:center;gap:6px;margin-top:16px;font-size:15px;color:var(--ink)"><input type="checkbox" id="amPw" ${M?.has_password?'checked':''} style="width:18px;height:18px;flex:none">パスワードあり</label>
      ${amLb('共有（黒服）')}<div>${(l.data.halls||[]).map(h=>`<label style="display:inline-flex;align-items:center;gap:6px;margin:0 16px 6px 0;font-size:15px;color:var(--ink);white-space:nowrap"><input type="checkbox" data-amh="${h.id}" ${mem.has(h.id)?'checked':''} style="width:18px;height:18px;flex:none">${esc(h.name)}</label>`).join('')||'<span class="muted">黒服がいません</span>'}</div>
      ${M?`<div class="muted" style="font-size:13px;margin-top:10px">更新 ${esc(M.updated)}${M.updated_by?' '+esc(M.updated_by):''}</div>`:''}</div>
    <div class="row" style="gap:8px"><button class="primary" id="amSv">保存</button>${M?'<button class="ghost" id="amDel">削除</button>':''}<button class="ghost" id="amBk">戻る</button></div>`;
  hiMemoSwOn();
  const paint=()=>{ $('amFs').innerHTML=amFiles.map((f,i)=>`<div class="row" style="gap:8px;margin-bottom:6px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.t==='pdf'?'PDF':'写真'}　${esc(f.n)}</span><button class="ghost sm" data-amo="${i}">表示</button><button class="xb" data-amx="${i}" aria-label="削除">×</button></div>`).join('')||'<span class="muted">なし</span>';
    $('amFs').querySelectorAll('[data-amo]').forEach(b=>b.onclick=()=>amFileOpen(M?.id||null,amFiles[Number(b.dataset.amo)].p));
    $('amFs').querySelectorAll('[data-amx]').forEach(b=>b.onclick=()=>{ amFiles.splice(Number(b.dataset.amx),1); paint(); }); };
  paint(); $('amFa').onclick=()=>$('amF').click();
  $('amF').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return;
    if(amFiles.length>=10){ await uiAlert('ファイルは10件までです'); return; }
    const pdf=f.type==='application/pdf'; if(!pdf&&!/^image\//.test(f.type)){ await uiAlert('写真か PDF を選んでください'); return; }
    if(f.size>20*1024*1024){ await uiAlert('20MB までのファイルを選んでください'); return; }
    $('amFs').insertAdjacentHTML('beforeend','<div class="muted">アップロード中…</div>');
    try{ const blob=pdf?f:await amShrink(f);
      const p=await sb.rpc('admin_memo_file_new',{p_ext:pdf?'pdf':'jpg'}); if(p.error) throw new Error(p.error.message);
      const up=await sb.storage.from('memo-files').upload(p.data,blob,{contentType:pdf?'application/pdf':'image/jpeg',upsert:false}); if(up.error) throw new Error(up.error.message);
      amFiles.push({p:p.data,n:f.name||(pdf?'ファイル.pdf':'写真.jpg'),t:pdf?'pdf':'img'});
    }catch(err){ await uiAlert('アップロードできませんでした：'+err.message); }
    paint(); };
  $('amSv').onclick=guard($('amSv'),async()=>{
    const q=await sb.rpc('admin_memo_save',{p_id:M?.id||null,p_store:st,p_title:$('amT').value,p_body:$('amB').value,p_link_name:$('amLn').value,p_link_url:$('amLu').value,
      p_has_password:$('amPw').checked,p_files:amFiles,p_members:[...$('main').querySelectorAll('[data-amh]')].filter(x=>x.checked).map(x=>x.dataset.amh)});
    if(q.error){ await uiAlert(q.error.message); return; } toast('保存しました'); amList(); });
  if($('amDel')) $('amDel').onclick=async()=>{ if(!await uiConfirm(`${M.title}\n共有メモを削除しますか？`,'削除')) return;
    const q=await sb.rpc('admin_memo_delete',{p_id:M.id}); if(q.error){ await uiAlert(q.error.message); return; } toast('削除しました'); amList(); };
  $('amBk').onclick=()=>amList(); }
