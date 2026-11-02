// v1.84・SQL 326：鍵（セサミの解錠）。オーナー 2026-11-02「業者も設定したい。QR 1個で完結したい」「キャストは更衣室の鍵だけ、業者は店の鍵だけ、黒服は店と更衣室」
//   在籍のキャスト・黒服は POS の LINE連携で自動（登録なし）。業者は追加 → QR（読むと鍵の画面）。セサミの設定（API キー・鍵ごとの UUID と秘密鍵）は入れるだけで表示しない
//   セサミの設定は、セサミのアプリの「共有」の QR の画像からも読める（この画面の中で読み、送るのは UUID と秘密鍵だけ）
const KEY_URL=new URL('../key/',location.href).href, KEY_WD=['日','月','火','水','木','金','土'], KEY_WD_ORDER=[1,2,3,4,5,6,0];
PAGES.o_key=async()=>{ const st=storeId, head=`<h1>鍵 <small class="muted" style="font-weight:400">${esc(curStore()?.name||'')}</small></h1>`;
  $('main').innerHTML=head+'<div class="card muted">読み込み中…</div>';
  const r=await sb.rpc('admin_key_get',{p_store:st}); if(page!=='o_key'||storeId!==st) return;
  if(r.error){ $('main').innerHTML=head+`<div class="card err">${esc(/admin_key_get/.test(r.error.message)?'SQL 326 が未実行です：':'読み込めません：')}${esc(r.error.message)}</div>`; return; }
  const D=r.data, L=D.locks||[];
  if(!L.length){ $('main').innerHTML=head+'<div class="card muted">鍵なし</div>'; return; }
  const who=k=>L.filter(l=>l[k]).map(l=>l.name).join('・');
  const set=(ok)=>ok?'<span class="badge">設定済み</span>':'<span class="badge gray">未設定</span>';
  const dt=s=>{ const d=new Date(s); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`; };
  const hasV=L.some(l=>l.vendor);
  $('main').innerHTML=head+`<div class="card"><b>セサミの設定</b><table class="t" style="margin-top:8px">
      <tr><td>API キー</td><td>${set(D.api)}</td><td style="text-align:right"><button class="ghost sm" data-api>設定</button></td></tr>
      ${L.map(l=>`<tr><td>${esc(l.name)}</td><td>${set(l.set)}</td><td style="text-align:right"><button class="ghost sm" data-lk="${l.id}">設定</button></td></tr>`).join('')}</table></div>
    <div class="card"><b>在籍キャスト・黒服</b><table class="t" style="margin-top:8px">
      ${who('cast')?`<tr><td>キャスト</td><td>${esc(who('cast'))}</td><td>シフトの日　シフトの2時間前〜翌8:00</td></tr>`:''}
      ${who('hall')?`<tr><td>黒服</td><td>${esc(who('hall'))}</td><td>営業日　12:00〜翌8:00</td></tr>`:''}</table>
      <div class="muted" style="font-size:13px;margin-top:6px">POS の LINE連携で追加。退店・連携解除で停止</div></div>
    ${hasV?`<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><b>業者 <small class="muted" style="font-weight:400">${esc(who('vendor'))}</small></b><button class="ghost sm" id="kvAdd">追加</button></div>
      ${(D.vendors||[]).length?`<table class="t" style="margin-top:8px"><tr><th>名称</th><th>曜日・時間</th><th>期限</th><th></th><th>状態</th></tr>
      ${D.vendors.map((v,i)=>`<tr><td><a data-kv="${i}" style="color:var(--blue);cursor:pointer;text-decoration:underline">${esc(v.name)}</a></td><td>${esc(v.text)}</td><td>${v.until?esc(v.until.slice(5).replace(/^0/,'').replace('-0','/').replace('-','/')):'無期限'}</td>
        <td><button class="ghost sm" data-kq="${i}">QR</button></td><td>${v.expired?'<span class="badge gray">期限切れ</span>':'<span class="badge">有効</span>'}</td></tr>`).join('')}</table>`:'<div class="muted" style="margin-top:6px">業者なし</div>'}</div>`:''}
    <div class="card"><b>解錠履歴</b>${(D.logs||[]).length?`<table class="t" style="margin-top:8px"><tr><th>日時</th><th>名前</th><th>鍵</th><th>操作</th><th>結果</th></tr>
      ${D.logs.map(g=>`<tr><td>${dt(g.at)}</td><td>${esc(g.who)}</td><td>${esc(g.lock||'')}</td><td>${g.cmd==='lock'?'施錠':'解錠'}</td><td>${g.ok?'完了':`<span class="err">エラー</span> <small class="muted">${esc(g.reason||'')}</small>`}</td></tr>`).join('')}</table>`:'<div class="muted" style="margin-top:6px">履歴なし</div>'}</div>`;
  $('main').querySelector('[data-api]').onclick=()=>keyApiEdit(st);
  $('main').querySelectorAll('[data-lk]').forEach(b=>b.onclick=()=>keyLockEdit(L.find(l=>l.id===b.dataset.lk)));
  const add=$('kvAdd'); if(add) add.onclick=()=>keyVendorEdit(st,null);
  $('main').querySelectorAll('[data-kv]').forEach(a=>a.onclick=()=>keyVendorEdit(st,D.vendors[+a.dataset.kv]));
  $('main').querySelectorAll('[data-kq]').forEach(b=>b.onclick=()=>keyVendorQr(D.vendors[+b.dataset.kq]));
};
function keyApiEdit(st){
  const md=modal(`<h2 style="margin:0">API キー</h2><div class="muted" style="font-size:13px">セサミの開発者ページ（CANDY HOUSE）の API キー。保存後は非表示</div>
    <label>API キー<input id="kaK" type="password" autocomplete="off"></label><div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{ const q=await rpc('admin_key_api_set',{p_store:st,p_key:md.querySelector('#kaK').value}); if(!q.ok) return; md.remove(); toast('保存しました'); PAGES.o_key(); });
}
// セサミのアプリの共有 QR（ssm://UI?t=sk&sk=…）：sk を base64 で戻すと、2〜17バイト目が秘密鍵、最後の16バイトがセサミの UUID
//   セサミ4 などは99バイト（84〜99バイト目）、セサミ5 などは39バイト（24〜39バイト目）。2026-11-03 更衣室が39バイトで読取エラー
function keyFromShare(txt){ try{ let sk=new URL(String(txt).replace(/^ssm:\/\//,'https://x/')).searchParams.get('sk'); if(!sk) return null; sk=sk.replace(/ /g,'+'); // QR の sk の「＋」は、そのまま読むと空白になる（2026-11-03）
  const b=Uint8Array.from(atob(sk.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)); if(b.length<39) return null;
  const h=a=>[...a].map(x=>x.toString(16).padStart(2,'0')).join(''), u=h(b.length>=99?b.slice(83,99):b.slice(-16));
  return { secret:h(b.slice(1,17)), uuid:`${u.slice(0,8)}-${u.slice(8,12)}-${u.slice(12,16)}-${u.slice(16,20)}-${u.slice(20)}` }; }catch(e){ return null; } }
function keyLockEdit(l){
  const md=modal(`<h2 style="margin:0">${esc(l.name)}のセサミ</h2><div class="muted" style="font-size:13px">セサミのアプリ → この鍵 → 共有（オーナーかマネージャー）の QR の画像を選択すると入力されます。保存後は非表示</div>
    <label>共有 QR の画像<input id="klF" type="file" accept="image/*"></label><div id="klM" class="muted" style="font-size:13px"></div>
    <label>UUID<input id="klU" type="password" autocomplete="off"></label><label>秘密鍵<input id="klS" type="password" autocomplete="off"></label>
    <div class="bar"><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  const q=id=>md.querySelector('#'+id);
  q('klF').onchange=async()=>{ const f=q('klF').files[0]; if(!f) return; q('klM').textContent='読取中…';
    try{ const im=await createImageBitmap(f), c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const x=c.getContext('2d'); x.drawImage(im,0,0);
      // 画面全体のスクリーンショットでは、ほかの QR を先に拾うことがある → 使えない QR は白で消して探し直す（2026-11-03）
      let k=null; for(let i=0;i<5&&!k;i++){ const d=x.getImageData(0,0,c.width,c.height), qr=window.jsQR&&jsQR(d.data,c.width,c.height); if(!qr) break;
        k=keyFromShare(qr.data); if(!k){ const L=qr.location, xs=[L.topLeftCorner.x,L.topRightCorner.x,L.bottomLeftCorner.x,L.bottomRightCorner.x], ys=[L.topLeftCorner.y,L.topRightCorner.y,L.bottomLeftCorner.y,L.bottomRightCorner.y];
          const x0=Math.min(...xs), y0=Math.min(...ys), m=(Math.max(...xs)-x0)*.2; x.fillStyle='#fff'; x.fillRect(x0-m,y0-m,Math.max(...xs)-x0+2*m,Math.max(...ys)-y0+2*m); } }
      if(!k){ q('klM').innerHTML='<span class="err">読取エラー。別の画像を選択するか、UUID と秘密鍵を入力してください</span>'; return; }
      q('klU').value=k.uuid; q('klS').value=k.secret; q('klM').textContent='読取完了。保存してください'; }catch(e){ q('klM').innerHTML='<span class="err">読取エラー</span>'; } };
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{ const r=await rpc('admin_key_secret_set',{p_lock:l.id,p_uuid:q('klU').value,p_secret:q('klS').value}); if(!r.ok) return; md.remove(); toast('保存しました'); PAGES.o_key(); });
}
function keyVendorEdit(st,v){ const isNew=!v; v=v||{name:'',days:[1,2,3,4,5,6,0],from:'10:00',to:'12:00',until:null};
  const tm=(id,val)=>`<select id="${id}" style="width:auto">${Array.from({length:96},(_,i)=>`${String(Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`).map(t=>`<option ${t===val?'selected':''}>${t}</option>`).join('')}</select>`;
  const md=modal(`<h2 style="margin:0">${isNew?'業者の追加':esc(v.name)}</h2><label>名称<input id="kvN" value="${esc(v.name)}"></label>
    <div><div style="font-size:13px;color:var(--muted)">曜日</div><div style="display:flex;gap:6px;flex-wrap:wrap">${KEY_WD_ORDER.map(i=>`<label style="display:flex;align-items:center;gap:4px;margin:0"><input type="checkbox" data-kd="${i}" ${v.days.includes(i)?'checked':''} style="width:auto">${KEY_WD[i]}</label>`).join('')}</div></div>
    <div><div style="font-size:13px;color:var(--muted)">時間</div><div style="display:flex;gap:8px;align-items:center">${tm('kvF',v.from)}〜${tm('kvT',v.to)}</div></div>
    <label>期限<select id="kvU"><option value="">無期限</option><option value="d" ${v.until?'selected':''}>日付指定</option></select></label><label id="kvDw">期限日<input type="date" id="kvD" value="${esc(v.until||'')}"></label>
    <div class="bar">${isNew?'':'<button class="ghost" data-k="del" style="color:var(--warn);margin-right:auto">削除</button>'}<button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">保存</button></div>`);
  const q=id=>md.querySelector('#'+id), paint=()=>{ q('kvDw').style.display=q('kvU').value?'':'none'; }; q('kvU').onchange=paint; paint();
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  const del=md.querySelector('[data-k=del]'); if(del) del.onclick=async()=>{ if(!await uiConfirm(`「${v.name}」を削除しますか？\nこの QR では解錠できなくなります`,'削除','danger')) return; const r=await rpc('admin_key_vendor_void',{p_id:v.id}); if(!r.ok) return; md.remove(); toast('削除しました'); PAGES.o_key(); };
  md.querySelector('[data-k=ok]').onclick=guard(md.querySelector('[data-k=ok]'),async()=>{
    const until=q('kvU').value?q('kvD').value:null; if(q('kvU').value&&!until){ await uiAlert('期限日を入力してください'); return; }
    const r=await rpc('admin_key_vendor_save',{p_store:st,p_id:isNew?null:v.id,p_name:q('kvN').value,p_days:[...md.querySelectorAll('[data-kd]:checked')].map(e=>+e.dataset.kd),p_from:q('kvF').value,p_to:q('kvT').value,p_until:until});
    if(!r.ok) return; md.remove(); toast('保存しました'); await PAGES.o_key(); if(isNew) keyVendorQr({name:q('kvN').value.trim(),text:r.data.text,token:r.data.token}); });
}
function keyVendorQr(v){ const u=KEY_URL+'?t='+encodeURIComponent(v.token), qr=qrcode(0,'M'); qr.addData(u); qr.make();
  const md=modal(`<h2 style="margin:0">${esc(v.name)}</h2><div style="text-align:left">${qr.createSvgTag(5,8)}<div style="font-size:14px;line-height:1.8">${esc(v.text)}</div>
    <div class="muted" style="font-size:13px">業者のスマホのカメラで読むと鍵の画面を表示します。ホーム画面に追加して使います</div></div>
    <div class="bar"><button class="ghost" data-k="cp">リンクのコピー</button><button class="primary" data-k="no">閉じる</button></div>`);
  md.querySelector('[data-k=no]').onclick=()=>md.remove();
  md.querySelector('[data-k=cp]').onclick=async()=>{ try{ await navigator.clipboard.writeText(u); toast('コピーしました'); }catch(e){ await uiAlert(u); } };
}
