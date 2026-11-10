// ---------- 印刷（Epson TM-m30III：TM Print Assistant経由。設定でブラウザ印刷に切替可） ----------
const PRINT={ method: localStorage.getItem('print_method'+SLOT)||'tmpa' };
function padLine(l,r,w=32){ l=String(l); r=String(r); const lw=[...l].reduce((a,c)=>a+(c.charCodeAt(0)>255?2:1),0), rw=[...r].reduce((a,c)=>a+(c.charCodeAt(0)>255?2:1),0); const sp=Math.max(1,w-lw-rw); return l+' '.repeat(sp)+r; }
function buildLines(kind){ const b=cur,T=b.totals,t=tables.find(x=>x.id===b.table_id); const L=[]; const d=new Date();
  L.push({c:true,b:true,t:store?.name||'OLIVE'}); L.push({c:true,t:kind==='estimate'?'【 概 算 】':kind==='detail'?'【 明 細 】':'【 御 会 計 】'});
  L.push({t:`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${hm(d)}  ${t?.name||''}  ${b.guest_count}名`});
  const custs=(b.bill_customers||[]).map(c=>customers.find(x=>x.id===c.customer_id)?.name).filter(Boolean).join('・'); if(custs) L.push({t:custs+' 様'});
  L.push({t:'-'.repeat(32)});
  if(T.set) L.push({t:padLine(`セット ${b.set_minutes}分 ×${b.set_guest_count??b.guest_count}`,T.set.toLocaleString())}); if(T.vip_set) L.push({t:padLine('VIP代',T.vip_set.toLocaleString())});
  (b.bill_extensions||[]).forEach(e=>L.push({t:padLine(`延長 ${e.minutes}分 ×${e.qty}`,(e.unit_price*e.qty).toLocaleString())})); if(T.vip_ext) L.push({t:padLine(`VIP${settings.ext_minutes}分延長`,T.vip_ext.toLocaleString())});
  groupItems((b.bill_items||[]).filter(i=>!i.is_void)).forEach(i=>{ L.push({t:padLine(`${i.name} ×${i.qty}`,(i.unit_price*i.qty).toLocaleString())}); if(kind==='detail'){ const sp=(i.bill_item_splits||[]).map(s=>staffAll.find(x=>x.id===s.staff_id)?.display_name).filter(Boolean).join('/'); if(sp) L.push({t:'   → '+sp}); } });
  L.push({t:'-'.repeat(32)});
  L.push({t:padLine('小計',T.subtotal.toLocaleString())}); if(T.service) L.push({t:padLine(`サービス料 ${T.service_rate}%`,T.service.toLocaleString())}); L.push({t:padLine(`消費税 ${T.tax_rate}%`,T.tax.toLocaleString())});
  if(T.adjustment) L.push({t:padLine(T.adjustment<0?'値引':'値増',T.adjustment.toLocaleString())});
  L.push({b:true,t:padLine('合計',T.amount_due.toLocaleString()+'円')});
  if(kind==='bill'&&(b.payments||[]).length){ L.push({t:'-'.repeat(32)}); (b.payments||[]).filter(p=>p.amount>0).forEach(p=>L.push({t:padLine(METHOD[p.method],p.amount.toLocaleString())})); }
  if(kind==='detail'){ const cs=(b.bill_casts||[]).map(c=>(staffAll.find(s=>s.id===c.staff_id)?.display_name||'')+(c.is_kakari?'('+KL+')':'')+(ROLE[c.role]?'('+ROLE[c.role]+')':'')).join('、'); if(cs) L.push({t:'キャスト：'+cs}); }
  if(kind==='estimate') L.push({c:true,t:'※概算です。金額は変わることがあります'});
  return L; }
function linesToXml(L){ let x='<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><text lang="ja"/><text font="font_a"/>';
  for(const l of L){ x+=`<text align="${l.c?'center':'left'}"/><text em="${l.b?'true':'false'}"/><text>${esc(l.t)}&#10;</text>`; }
  x+='<feed line="3"/><cut type="feed"/></epos-print>'; return x; }
function linesToHtml(L){ return L.map(l=>`<div style="text-align:${l.c?'center':'left'};font-weight:${l.b?'700':'400'};white-space:pre">${esc(l.t)||'&nbsp;'}</div>`).join(''); }
function doPrint(L){ if(PRINT.method==='browser'){ $('printArea').innerHTML=linesToHtml(L); setTimeout(()=>window.print(),50); return; }
  const url='tmprintassistant://tmprintassistant.epson.com/print?ver=1&data-type=eposprintxml&reselect=yes&data='+encodeURIComponent(linesToXml(L))+'&back='+encodeURIComponent(location.href);
  location.href=url; }
$('prEst').onclick=()=>doPrint(buildLines('estimate')); $('prBill').onclick=()=>doPrint(buildLines('bill')); $('prDetail').onclick=()=>doPrint(buildLines('detail'));
$('prReceipt').onclick=async()=>{ // 領収書（v10.41）：入金のあった金額まで。発行のたびにサインし、receipts に記録する。出し切った後は再発行扱い（理由必須）
  const recv=(cur.payments||[]).filter(p=>p.amount>0&&p.received_at); const received=recv.reduce((a,p)=>a+p.amount,0); const cap=Math.min(received,cur.totals?.amount_due??0);
  if(cap<=0){ toast('入金がまだないため、領収書は発行できません'); return; }
  const prev=await sb.from('receipts').select('amount,cash_amount,reissue_reason').eq('bill_id',cur.id).order('issued_at');
  if(prev.error){ toast('領収書の記録を読めません：'+prev.error.message); return; }
  const first=(prev.data||[]).filter(r=>!r.reissue_reason); const issued=first.reduce((a,r)=>a+r.amount,0); const remain=cap-issued; let why=null, max=remain;
  if(remain<=0){ max=cap; why=await askReason(`この伝票の領収書は、入金額 ${yen(cap)} の分まで発行済です（${(prev.data||[]).length}回）。再発行します。`); if(!why)return; }
  const lastAmt=Number((prev.data||[]).slice(-1)[0]?.amount)||max; const cashAll=recv.filter(p=>p.method==='cash').reduce((a,p)=>a+p.amount,0); const usedCash=why?0:first.reduce((a,r)=>a+(r.cash_amount||0),0);
  const c0=(cur.bill_customers||[]).map(c=>customers.find(x=>x.id===c.customer_id)).filter(Boolean)[0];
  openReceipt({max, amount:remain>0?remain:Math.min(lastAmt,max), name:c0?.receipt_none?'':rnFirst(c0?.receipt_name)||c0?.name||'', names:c0?.receipt_none?[]:rnList(c0?.receipt_name), /* v12.61・SQL 368：領収書 不要のお客様は宛名を入れない */ guests:cur.set_guest_count??cur.guest_count, cashAvail:Math.max(0,cashAll-usedCash), why}); };
// 領収書の絵（横長 1240×576）。印刷は 90度回して 80mm 幅（576ドット）で出す
// v12.62：デザインを「静かな明朝」に（オーナー 2026-11-05 案ア。見本 作業場/領収書_デザイン_案.png）。二重の細い枠・明朝と Baskerville・金額は二重線・右にロゴとお店。言葉は前と同じ
// 印刷は白黒（明るさ 150 未満が黒）。明朝の細い字（W3）は 20px 未満だと線が切れるので、小さい字は W6。1px＝1ドットなので、画数の多い字は 18px 以上にする
function drawReceipt(cv,d){ const W=1240,H=576; cv.width=W; cv.height=H; const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#000'; g.strokeStyle='#000'; g.textBaseline='alphabetic';
  const MI=(px,w)=>`${w||(px<20?600:300)} ${px}px "Hiragino Mincho ProN","Hiragino Mincho Pro","Yu Mincho","Noto Serif JP",serif`, BK=(px,it)=>`${it?'italic ':''}400 ${px}px Baskerville,"Baskerville Old Face",Georgia,serif`, yen=n=>`¥${Number(n||0).toLocaleString()}`;
  const sp=(t,x,y,ls,al)=>{ /* 字間をあけて書く（al：left / right / center）。書いた幅を返す */ const cs=[...String(t)], w=cs.reduce((s,c)=>s+g.measureText(c).width,0)+ls*(cs.length-1); let sx=al==='right'?x-w:al==='center'?x-w/2:x; g.textAlign='left'; for(const c of cs){ g.fillText(c,sx,y); sx+=g.measureText(c).width+ls; } return w; };
  const hl=(x1,y1,x2,y2)=>{ g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); };
  g.lineWidth=1; g.strokeRect(18,18,W-36,H-36); g.strokeRect(26,26,W-52,H-52);
  g.font=BK(44,1); sp('Receipt',64,98,3); g.font=MI(21); sp(`${d.issue.getFullYear()}年${d.issue.getMonth()+1}月${d.issue.getDate()}日`,740,96,2,'right'); hl(64,118,740,118);
  g.textAlign='left'; g.font=MI(34,600); g.fillText(d.name||'',64,196,600); g.font=MI(24); g.fillText('様',694,196); hl(64,212,740,212);
  g.font=BK(66); const aw=sp(`${yen(d.amount)}-`,64,300,2); g.font=MI(18); g.textAlign='left'; g.fillText('（消費税込み）',64+aw+14,298); hl(64,318,740,318); hl(64,323,740,323);
  g.font=MI(21,600); g.fillText(`${d.rate}%対象 ${yen(d.amount)}　　内消費税 (${yen(d.tax)})`,64,362); g.fillText(`現金 ${yen(d.cash)}　　カード ${yen(d.card)}`,64,393);
  g.font=MI(22,400); g.fillText(`但　${d.guests||'　　'}名様ご飲食代として`,64,446,676); /* v12.62：ご利用日は印刷しない（オーナー 2026-11-05） */ g.font=MI(21,600); g.fillText('上記正に領収いたしました',64,488); const sx=64+g.measureText('上記正に領収いたしました').width+18;
  if(d.stamp){ g.setLineDash([4,4]); g.strokeRect(656,340,84,64); g.setLineDash([]); g.font=MI(14); g.textAlign='center'; g.fillText('収入印紙',698,378); } /* v12.62：収入印紙の枠は印紙が要る時だけ */
  hl(790,70,790,H-70); const cx=(790+W-26)/2; g.font=MI(19); const info=[...rcAddr(g,d.address,390),d.tel?('TEL '+d.tel):'',d.regno?('登録番号 '+d.regno):''].filter(Boolean); /* 印刷は 1px＝1ドット。15px では画数の多い字がつぶれるので 19px。郵便番号は1行目に分け、入らない住所は横に縮めずに折り返す（オーナー 2026-11-09） */
  if(d.logo){ /* ロゴがある時は、店名はロゴに見えないふつうの字にし、ロゴから登録番号までを縦の線（70〜H-70）の真ん中に置く（オーナー 2026-11-08） */
    const r=Math.min(250/d.logo.width,90/d.logo.height), lw=d.logo.width*r, lh=d.logo.height*r, gap=70, top=Math.round(H/2-(lh+gap+17+38+30*Math.max(info.length-1,0)+5)/2);
    g.drawImage(d.logo,cx-lw/2,top,lw,lh); const yn=top+lh+gap+17; g.font=MI(19,600); g.textAlign='center'; g.fillText(d.store||'',cx,yn,380);
    g.font=MI(19); info.forEach((t,i)=>g.fillText(t,cx,yn+38+30*i)); }
  else { g.font=MI(22,600); sp(d.store||'',cx,222,6,'center'); hl(cx-24,244,cx+24,244);
    g.font=MI(19); g.textAlign='center'; info.forEach((t,i)=>g.fillText(t,cx,282+30*i)); }
  const R=30,cy=480,scx=sx+R; if(d.sig){ g.save(); g.beginPath(); g.arc(scx,cy,R-3,0,Math.PI*2); g.clip(); g.drawImage(d.sig,scx-R+4,cy-R+4,(R-4)*2,(R-4)*2); g.restore(); } g.lineWidth=1; g.beginPath(); g.arc(scx,cy,R,0,Math.PI*2); g.stroke(); }
// 住所を領収書の行に分ける：郵便番号だけで1行、残りは幅 mw に入るように（空白の所で、無ければ字の途中で）折り返す
function rcAddr(g,a,mw){ a=String(a||'').trim(); if(!a) return []; const m=a.match(/^(〒?\s*\d{3}-?\d{4})[\s　]*([\s\S]*)$/), out=m?[m[1].replace(/\s+/g,'')]:[]; let r=(m?m[2]:a).replace(/\s+/g,' ').trim();
  while(r&&g.measureText(r).width>mw){ let k=r.length; while(k>1&&g.measureText(r.slice(0,k)).width>mw) k--; const sp=r.lastIndexOf(' ',k); if(sp>0) k=sp; out.push(r.slice(0,k).trim()); r=r.slice(k).trim(); }
  if(r) out.push(r); return out; }
function receiptPrint(cv){ const W=576,H=1240; const r=document.createElement('canvas'); r.width=W; r.height=H; const g=r.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.translate(W,0); g.rotate(Math.PI/2); g.drawImage(cv,0,0);
  imagePrint(r); }
// 576ドット幅の絵を印刷する（領収書・名札で共通）。白黒は明るさ 150 未満が黒
function imagePrint(r){ const W=r.width,H=r.height, g=r.getContext('2d');
  if(PRINT.method==='browser'){ $('printArea').innerHTML=`<img src="${r.toDataURL('image/png')}" style="width:72mm">`; setTimeout(()=>window.print(),80); return; }
  const px=g.getImageData(0,0,W,H).data, bw=W/8, buf=new Uint8Array(bw*H); for(let yy=0;yy<H;yy++) for(let xx=0;xx<W;xx++){ const i=(yy*W+xx)*4; if((px[i]*299+px[i+1]*587+px[i+2]*114)/1000<150) buf[yy*bw+(xx>>3)]|=(0x80>>(xx&7)); }
  let bin=''; for(let i=0;i<buf.length;i+=8192) bin+=String.fromCharCode.apply(null,buf.subarray(i,i+8192));
  const xml=`<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><image width="${W}" height="${H}" color="color_1" mode="mono">${btoa(bin)}</image>${r.dataset.nt?'<cut type="feed"/>':'<feed line="3"/><cut type="feed"/>'}</epos-print>`;
  location.href='tmprintassistant://tmprintassistant.epson.com/print?ver=1&data-type=eposprintxml&reselect=yes&data='+encodeURIComponent(xml)+'&back='+encodeURIComponent(location.href); }
// ボトルの名札（v12.66・v12.67 オーナー 2026-11-06）：名札のカード（よこ 53mm・たて 55mm・「様」の付いた丸い枠にキープ名）をレシートの紙に
// v12.67：はさみで切るのを1か所に（オーナー「左右をカットする手間」「点線もいらない」）。カードのたてを紙の出る向きにして、印刷機が 55mm ちょうどで切る。カードの横は紙の端に合わせる（反対側の1か所だけ切る）
// 印刷機は刃と印字の位置が約 10mm 離れている（NT.off）ので、紙の最初の off mm には印刷できない。カードの上は何も書かない所なので、そこに当てる
const NT={ ch:55, cw:53, edge:4, off:10.3, bw:40, bh:11, bb:7, px:48, mw:30, mk:2 }; /* ch/cw：カード・edge：紙の端から印刷できる所までの幅・off：刃と印字の位置の差・bw/bh/bb：丸い枠（幅・高さ・カードの下からの位置）・px：字の高さ・mw：名前の幅の上限・mk：切る所の目印の長さ（mm） */
function nametagPrint(name){ const D=8, W=576, H=Math.round((NT.ch-NT.off)*D); const r=document.createElement('canvas'); r.width=W; r.height=H; const g=r.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#000'; g.strokeStyle='#000';
  const x0=-NT.edge*D, bw=NT.bw*D, bh=NT.bh*D, bx=x0+(NT.cw*D-bw)/2, by=H-(NT.bb*D)-bh, rad=bh/2; /* カードの左＝紙の左の端（印刷できる所の 4mm 外） */
  g.lineWidth=2; g.beginPath(); g.moveTo(bx+rad,by); g.lineTo(bx+bw-rad,by); g.arc(bx+bw-rad,by+rad,rad,-Math.PI/2,Math.PI/2); g.lineTo(bx+rad,by+bh); g.arc(bx+rad,by+rad,rad,Math.PI/2,Math.PI*1.5); g.closePath(); g.stroke();
  const MI=(px,w)=>`${w} ${px}px "Hiragino Mincho ProN","Hiragino Mincho Pro","Yu Mincho","Noto Serif JP",serif`; g.textBaseline='middle';
  g.font=MI(32,600); g.textAlign='right'; g.fillText('様',bx+bw-3*D,by+bh/2+2);
  const mw=NT.mw*D, cx=bx+(bw-6*D)/2, cy=by+bh/2+2; g.textAlign='center';
  const t=name.trim(); g.font=MI(NT.px,600); const tw=g.measureText(t).width; g.save(); g.translate(cx,cy); if(tw>mw) g.scale(mw/tw,1); g.fillText(t,0,0); g.restore(); /* キープ名をそのまま1行（入らない時は字の幅を細く） */
  const mx=x0+NT.cw*D; g.lineWidth=2; g.beginPath(); g.moveTo(mx,0); g.lineTo(mx,NT.mk*D); g.moveTo(mx,H-NT.mk*D); g.lineTo(mx,H); g.stroke(); /* v12.68：はさみで切る所の目印（上と下に短い線。オーナー 2026-11-06「やっぱりイ」） */
  r.dataset.nt=1; imagePrint(r); } /* 絵の終わりまで送って切る（3行の余白を入れない）：紙の長さ＝off＋絵の長さ＝55mm */
// サイン画面（大きく別に出す）。OK でサインの canvas、キャンセルで null
function askSign(){ return new Promise(res=>{ const m=document.createElement('div'); m.style.cssText='position:fixed;inset:0;z-index:70;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px'; const S=Math.floor(Math.min(innerWidth*0.9,innerHeight*0.72));
  m.innerHTML=`<canvas style="width:${S}px;height:${S}px;border:3px solid var(--ink);border-radius:50%;touch-action:none;background:#fff"></canvas><div class="bar"><button class="ghost" data-k="redo">再入力</button><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">OK</button></div>`; document.body.appendChild(m);
  const sc=m.querySelector('canvas'), SW=600; sc.width=SW; sc.height=SW; const sg=sc.getContext('2d'); let drawn=false, down=false; const clear=()=>{ sg.fillStyle='#fff'; sg.fillRect(0,0,SW,SW); sg.strokeStyle='#111'; sg.lineWidth=21; sg.lineCap='round'; sg.lineJoin='round'; drawn=false; okB.disabled=true; }; const okB=m.querySelector('[data-k=ok]'); clear();
  const pos=e=>{ const r=sc.getBoundingClientRect(); return [(e.clientX-r.left)*SW/r.width,(e.clientY-r.top)*SW/r.height]; };
  sc.onpointerdown=e=>{ e.preventDefault(); down=true; try{ sc.setPointerCapture(e.pointerId); }catch(_){} const [x,y]=pos(e); sg.beginPath(); sg.moveTo(x,y); sg.lineTo(x+0.1,y+0.1); sg.stroke(); drawn=true; okB.disabled=false; };
  sc.onpointermove=e=>{ if(!down) return; e.preventDefault(); const [x,y]=pos(e); sg.lineTo(x,y); sg.stroke(); }; sc.onpointerup=sc.onpointercancel=()=>{ down=false; };
  m.querySelector('[data-k=redo]').onclick=clear; m.querySelector('[data-k=no]').onclick=()=>{ m.remove(); res(null); }; okB.onclick=()=>{ if(!drawn) return; m.remove(); res(sc); }; }); }
// 収入印紙の金額（いらない時は 0）：現金で受け取った分（税抜き）で決まる。カードの分は領収書に「カード」と書くので数えない（印紙税の金銭の受取書）
// 内税は伝票の消費税を領収書の金額の割合で分ける（伝票の消費税とそろえる）
const rcTax=(a,rate)=>{ const t=cur.totals||{}, due=Number(t.amount_due)||0; return due>0&&t.tax!=null?Math.round(Number(t.tax)*a/due):Math.floor(a*rate/(100+rate)); };
const stampYen=(cash,rate)=>{ const x=cash-rcTax(cash,rate); if(x<50000) return 0; for(const [u,v] of [[1e6,200],[2e6,400],[3e6,600],[5e6,1000],[1e7,2000],[2e7,4000],[3e7,6000],[5e7,10000],[1e8,20000]]) if(x<=u) return v; return 40000; };
function openReceipt(o){ const rate=Number(cur.totals?.tax_rate)||10; const m=mkModal(60);
  m.innerHTML=`<div class="box" style="width:min(980px,96vw);max-height:94vh;overflow:auto"><div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:6px 10px"><label>宛名<input data-rc="name" style="width:100%"></label><label>金額<input data-rc="amount" inputmode="numeric" style="width:100%;text-align:right"></label><label>人数<input data-rc="guests" inputmode="numeric" style="width:100%;text-align:right"></label><label>現金<input data-rc="cash" inputmode="numeric" style="width:100%;text-align:right"></label><label>カード<input data-rc="card" readonly style="width:100%;text-align:right;background:var(--soft)"></label></div>${(o.names||[]).length>1?`<div class="chips" data-rcnames style="margin-top:6px">${o.names.map((n,i)=>`<button type="button" class="chip ${i?'':'on'}" style="padding:6px 12px;font-size:14px">${esc(n)}</button>`).join('')}</div>`:''}<div data-rcmix class="hidden" style="color:var(--warn);font-size:14px;margin-top:6px">この伝票は現金とカードの両方で払われています。この領収書の現金・カードの分け方を確かめてください（現金の欄を直すと、残りがカードになります）</div>
  <canvas data-rc="pv" style="width:100%;border:1px solid var(--line);margin-top:10px;display:block"></canvas>
  <div style="display:flex;align-items:center;margin-top:10px"><span data-rc="stamp" class="badge hidden" style="background:var(--warn);font-size:15px;padding:6px 14px">収入印紙</span><div class="bar" style="margin-left:auto"><button class="ghost" data-rc="no">キャンセル</button><button class="primary" data-rc="ok">発行</button></div></div></div>`;
  document.body.appendChild(m); const q=k=>m.querySelector(`[data-rc=${k}]`); const num=k=>numIn(q(k).value);
  q('name').value=o.name||''; q('amount').value=o.amount; q('guests').value=''; let cashTouched=false; q('cash').value=Math.min(o.amount,o.cashAvail);
  let sigCv=null;
  let logo=null; if(settings?.receipt_logo){ const im=new Image(); im.onload=()=>{ logo=im; paint(); }; im.src=settings.receipt_logo; }
  const data=()=>{ const amount=num('amount'); const cash=Math.min(num('cash'),amount); const now=new Date(); return { name:q('name').value.trim(), amount, guests:num('guests')||null, cash, card:amount-cash, rate, tax:rcTax(amount,rate), issue:now, store:store?.name||'', address:store?.address||'', tel:store?.phone||store?.tel||'', regno:settings?.invoice_reg_no||'', logo, sig:sigCv, stamp:stampYen(cash,rate) }; };
  const paint=()=>{ const d=data(); q('card').value=d.card; q('stamp').classList.toggle('hidden',!d.stamp); /* v12.62：収入印紙が要る時だけしるし（オーナー 2026-11-05 案イ） */ drawReceipt(q('pv'),d); };
  q('amount').oninput=()=>{ if(!cashTouched) q('cash').value=Math.min(num('amount'),o.cashAvail); /* v11.95：現金とカードの両方で払われた伝票は、金額を変えたら現金の欄を確かめるように出す（ゲネプロ #38） */ const mx=m.querySelector('[data-rcmix]'); if(mx) mx.classList.toggle('hidden',!(o.cashAvail>0&&o.cashAvail<o.amount&&num('amount')!==o.amount)); paint(); }; q('cash').oninput=()=>{ cashTouched=true; paint(); }; q('name').oninput=q('guests').oninput=paint;
  m.querySelectorAll('[data-rcnames] .chip').forEach(b=>b.onclick=()=>{ q('name').value=b.textContent; m.querySelectorAll('[data-rcnames] .chip').forEach(x=>x.classList.toggle('on',x===b)); paint(); }); /* v12.57：領収書名が2社以上の時は宛名の下で選択 */
  q('no').onclick=()=>m.remove(); paint();
  const ok=q('ok'); ok.onclick=guard(ok,async()=>{ const d=data(); if(!d.amount||d.amount<1){ toast('金額が正しくありません'); return; } if(d.amount>o.max){ toast(`上限は ${yen(o.max)} です`); return; } if(num('cash')>d.amount){ toast('現金が金額を超えています'); return; } if(d.stamp){ m.style.zIndex=59; await uiAlert(`収入印紙　${yen(d.stamp)}`); m.style.zIndex=60; } /* 小窓（z-index 60）を領収書の画面の上に出す */ /* v12.62：要る印紙の金額は発行の時に小窓で（オーナー 2026-11-05） */ const sg=await askSign(); if(!sg) return; sigCv=sg;
    const s2=document.createElement('canvas'); s2.width=s2.height=180; s2.getContext('2d').drawImage(sigCv,0,0,180,180); const jd=`${d.issue.getFullYear()}-${String(d.issue.getMonth()+1).padStart(2,'0')}-${String(d.issue.getDate()).padStart(2,'0')}`;
    const r=await insOnce('receipts',{store_id:store.id,bill_id:cur.id,issue_date:jd,visit_date:cur.business_date,name:d.name||null,guest_count:d.guests,amount:d.amount,cash_amount:d.cash,card_amount:d.card,tax_amount:d.tax,signature:s2.toDataURL('image/png'),reissue_reason:o.why||null}); if(r.error){ toast('領収書を記録できません：'+r.error.message); return; }
    await logOp(o.why?'領収書再発行':'領収書発行',{name:d.name||null,amount:d.amount},o.why); paint(); receiptPrint(q('pv')); m.remove(); }); }
$('extAdd').textContent=`${settings?.ext_minutes||30}分延長`;
$('extAdd').onclick=guard($('extAdd'),async()=>{ const { error } = await insOnce('bill_extensions',{bill_id:cur.id,minutes:settings.ext_minutes,unit_price:settings.ext_unit_price,qty:cur.guest_count,is_auto:false}); if(error){ if(await stale(error)) return; toast(error.message); return; } await logOp('延長追加（手動）',{minutes:settings.ext_minutes,amount:settings.ext_unit_price*cur.guest_count}); await openBill(cur.id); });
$('bBack').onclick=()=>{ if(billFrom==='bills'){ renderSettings('bills'); show('v-settings'); return; } loadHall(); show('v-hall'); };
// v11.12：先に「削除しますか？」を出す（やめられる）。続けて理由（必須）
$('bVoid').onclick=async()=>{ const tn=tables.find(t=>t.id===cur.table_id)?.name||''; if(!await uiConfirm(`${tk(tn)}の伝票を削除しますか？\n履歴は残ります`))return; const by=await askBy(); if(by===null) return; const why0=await askReason(`${tk(tn)}の伝票を削除します。`); if(!why0)return; const why=by?`${why0}（${by}）`:why0; const vb=$('bVoid'); if(vb.disabled) return; vb.disabled=true; /* v11.27：取消できたのを確かめてから操作ログに書く（前はログが先で、失敗しても「取消」が残った） */
  try{ const u=await cashClosed(()=>sb.rpc('pos_rows_set',{p_table:'bills',p_where:{id:(cur.id)??null,'status!':('void')??null},p:{status:'void',closed_at:new Date().toISOString(),...(DBLOG?{void_reason:why}:{})}}),`伝票の削除（${tn}）`); /* v12.07・SQL 220：現金の入金がある伝票は、精算済みの日は精算の取消の後に削除 */
    if(u.error?.cancel){}
    else if(u.error||!(u.data||[]).length){ await uiAlert(u.error?'伝票を削除できませんでした：'+u.error.message:'伝票を削除できませんでした（ほかの端末で変更されています）'); }
    else if(!DBLOG) await logOp('伝票取消',{total:cur.totals?.amount_due??null,guest_count:cur.guest_count,items:(cur.bill_items||[]).filter(i=>!i.is_void).map(i=>`${i.name}×${i.qty}`)},why);
  } finally{ vb.disabled=false; } loadHall(); show('v-hall'); };
$('bOrder').onclick=()=>openOrder();
$('bPay').onclick=async()=>{ if(cur&&cur.status==='open'){ const miss=[]; if(!(cur.bill_customers||[]).length) miss.push('お客様が登録されていません'); if(!(cur.bill_casts||[]).some(c=>c.is_kakari)) miss.push(''+KL+'が登録されていません'); if(miss.length){ await uiAlert(miss.join('\n')); return; } } renderPay(); show('v-pay'); };

