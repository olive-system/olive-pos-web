// ---------- 印刷（Epson TM-m30III：TM Print Assistant経由。設定でブラウザ印刷に切替可） ----------
const PRINT={ method: localStorage.getItem('print_method'+SLOT)||'tmpa' };
// 伝票の印刷（［概算印刷］Estimate・［会計印刷］Bill・［明細印刷］Details）。オーナー（2026-11-17）「ロゴ入り・OLIVE らしいデザイン」「シンプルに洗練して」
// 概算：今の金額と、30分・60分延長した場合の金額だけ（延長した場合は pos_bill_est＝calc_bill を呼ぶ。SQL 562）／会計：金額だけ（下の drawBill・（消費税込）は付けない）／明細：品・バックのキャスト・小計・サービス料・消費税・合計（伝票のキャストは出さない。オーナー「いらん」）
// お客様の名前・日付・卓・端数切上は出さない（オーナー「いらん」）。字は font_a の 1.7 倍（オーナー「1.7倍」。前の字は 3mm で「小さくて見えない」と言われた）
const PZ=1.7;
const VIPL='VIP charge'; /* 明細の VIP の部屋の料金の言い方（オーナー「VIP代ってダサい」） */
const hmS=t=>hmJst(t).replace(/^0/,''); /* 〜1:30（時の頭の 0 は付けない。オーナー「〜1:30の方がかっこいい」） */
// d：{ kind:'estimate'|'bill'|'detail', title, logo, store, rows:[{l,m,r}]（概算：l＝延長・m＝〜何時・r＝金額）, items:[{l,r,s}]（明細：s＝バックのキャスト）, sums:[{l,r}], due, pays:[{l,r}], note }
// c：描く道具（g＝canvas・W＝幅・fs＝字の大きさ・y＝今の高さ）。部品は c.y を進める
function slipTools(z){ const W=576, cv=document.createElement('canvas'); cv.width=W; cv.height=8000; const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,cv.height); g.fillStyle='#000'; g.strokeStyle='#000'; g.textBaseline='alphabetic';
  const c={ cv, g, W, fs:22*z, y:0, yen:n=>'¥'+(Number(n)||0).toLocaleString(),
    MI:(px,w)=>`${w||600} ${Math.round(px)}px "Hiragino Mincho ProN","Hiragino Mincho Pro","Yu Mincho","Noto Serif JP",serif`, BK:(px,it)=>`${it?'italic ':''}400 ${Math.round(px)}px Baskerville,"Baskerville Old Face",Georgia,serif` };
  c.hl=(y,x1,x2)=>{ g.lineWidth=1; g.beginPath(); g.moveTo(x1,Math.round(y)+.5); g.lineTo(x2,Math.round(y)+.5); g.stroke(); };
  c.sp=(t,y,ls)=>{ /* 字間をあけて真ん中に */ const cs=[...String(t)], w=cs.reduce((s,ch)=>s+g.measureText(ch).width,0)+ls*(cs.length-1); let x=(W-w)/2; g.textAlign='left'; for(const ch of cs){ g.fillText(ch,x,y); x+=g.measureText(ch).width+ls; } };
  c.wrap=(t,mw)=>{ /* 幅 mw に入るように折り返す */ const out=[]; let cur=''; for(const ch of [...String(t)]){ if(cur&&g.measureText(cur+ch).width>mw){ out.push(cur); cur=ch===' '||ch==='　'?'':ch; } else cur+=ch; } out.push(cur); return out; };
  c.lr=(l,r,y,fl,fr)=>{ g.textAlign='left'; g.font=fl; g.fillText(l,0,y); g.textAlign='right'; g.font=fr; g.fillText(r,W,y); };
  return c; }
// ロゴ（白黒にすると薄い葉が消えるので、色のある所を全部黒にする）。幅 lw の絵を返す
function slipLogo(im,lw){ const lh=Math.round(im.height*lw/im.width), lc=document.createElement('canvas'); lc.width=lw; lc.height=lh; const lg=lc.getContext('2d'); lg.drawImage(im,0,0,lw,lh); const px=lg.getImageData(0,0,lw,lh);
  for(let k=0;k<px.data.length;k+=4){ const on=px.data[k+3]>24&&(px.data[k]+px.data[k+1]+px.data[k+2])<720; px.data[k]=px.data[k+1]=px.data[k+2]=on?0:255; px.data[k+3]=255; } lg.putImageData(px,0,0); return lc; }
// 見出しと細い線（概算・明細）。店名はロゴが無い時だけ（オーナー「上にロゴあるし、いらない」）
function slipHead(c,d){ const {g,W,fs}=c; c.y=Math.round(fs*0.6);
  if(d.logo){ const lw=Math.round(Math.min(340,W*0.6)), lc=slipLogo(d.logo,lw); g.drawImage(lc,Math.round((W-lw)/2),c.y); c.y+=lc.height; }
  else { c.y+=Math.round(fs*1.3); g.font=c.MI(fs*0.75,400); c.sp(d.store||'',c.y,fs*0.12); }
  c.y+=Math.round(fs*2.6); g.font=c.BK(fs*1.45,true); c.sp(d.title||'',c.y,fs*0.12); /* 見出しは領収書の Receipt と同じ Baskerville の斜体 */
  c.y+=Math.round(fs*1.0); c.hl(c.y,W/2-fs*1.2,W/2+fs*1.2); c.y+=Math.round(fs*1.6); }
// 概算：〜何時の金額と、延長した場合（〜何時 の始まりをそろえる。延長の言葉の長さで、ずれないように）
function slipEst(c,d){ const {g,W,fs}=c, mx=Math.round(fs*4.6);
  d.rows.forEach((r,i)=>{ c.y+=Math.round(fs*(i?2.5:1.6)); g.textAlign='left'; if(r.l){ g.font=c.MI(fs*0.8,400); g.fillText(r.l,0,c.y); } g.font=c.MI(fs*0.95,600); g.fillText(r.m,mx,c.y); g.textAlign='right'; g.font=c.BK(fs*(i?1.45:1.75)); g.fillText(c.yen(r.r),W,c.y); }); }
// 明細：品（長い名前は折り返す）とバックのキャスト・内訳・合計
function slipDetail(c,d){ const {g,W,fs}=c;
  (d.items||[]).forEach((it,i)=>{ g.font=c.BK(fs); const aw=g.measureText(c.yen(it.r)).width; g.font=c.MI(fs*0.85,400); c.wrap(it.l,W-aw-fs).forEach((t,k)=>{ c.y+=Math.round(fs*(k?1.15:(i?1.5:0.9))); g.textAlign='left'; g.font=c.MI(fs*0.85,400); g.fillText(t,0,c.y); });
    g.textAlign='right'; g.font=c.BK(fs); g.fillText(c.yen(it.r),W,c.y); if(it.s){ c.y+=Math.round(fs*1.1); g.textAlign='left'; g.font=c.MI(fs*0.7,400); g.fillText('→ '+it.s,fs*1.2,c.y,W-fs*1.2); } });
  c.y+=Math.round(fs); c.hl(c.y,0,W);
  (d.sums||[]).forEach((s,i)=>{ c.y+=Math.round(fs*(i?1.4:1.6)); c.lr(s.l,s.r,c.y,c.MI(fs*0.8,400),c.BK(fs*0.95)); });
  c.y+=Math.round(fs*2.3); c.lr('合計',c.yen(d.due),c.y,c.MI(fs*0.95,600),c.BK(fs*1.75)); }
// 会計票（Bill）：写真の手書きの会計票と同じ形（オーナー 2026-11-21「③」）。左上に小さい Receipt・金額だけ（¥ も , も付けず、3桁ごとに少し空ける）・金額の下に短い線・ロゴは小さく右下
// 細い線が潰れないよう（203dpi＝1mm 8ドット）、Receipt は Bill の見出しと同じ大きさ・短い線は2ドット・ロゴは幅 170。支払い方法が2つの時だけ、その金額を線の下に並べる
function slipMoney(g,n,x,y,gap,al){ const gs=String(Math.max(0,Math.round(Number(n)||0))).replace(/\B(?=(\d{3})+$)/g,',').split(','), ws=gs.map(t=>g.measureText(t).width), tot=ws.reduce((u,v)=>u+v,0)+gap*(gs.length-1); let sx=al==='right'?x-tot:x-tot/2; g.textAlign='left'; gs.forEach((t,k)=>{ g.fillText(t,sx,y); sx+=ws[k]+gap; }); }
function drawBill(d,z){ const c=slipTools(z), {g,W,fs}=c, MX=56, LW=170; let y=Math.round(fs*1.9);
  g.textAlign='left'; g.font=c.BK(fs*1.45,true); g.fillText(d.title,MX,y);
  const bh=Math.round(fs*3.6); y+=Math.round(fs*0.8); g.font=c.BK(fs*2.4); slipMoney(g,d.due,W/2,y+Math.round(bh/2+fs*0.85),fs*0.75,'center'); y+=bh;
  g.lineWidth=2; g.beginPath(); g.moveTo(W/2-60,y-Math.round(fs*0.1)+.5); g.lineTo(W/2+60,y-Math.round(fs*0.1)+.5); g.stroke();
  (d.pays||[]).forEach((p,i)=>{ y+=Math.round(fs*(i?1.4:1.7)); g.textAlign='left'; g.font=c.MI(fs*0.8,400); g.fillText(p.l,MX,y); g.font=c.BK(fs); slipMoney(g,p.r,W-MX,y,fs*0.5,'right'); });
  if(d.logo){ const lc=slipLogo(d.logo,LW); y+=Math.round(fs*0.5); g.drawImage(lc,W-MX-LW,y); y+=lc.height; }
  y+=Math.round(fs*0.9); const out=document.createElement('canvas'); out.width=W; out.height=y; out.getContext('2d').drawImage(c.cv,0,0); return out; }
// 領収書と同じ明朝と Baskerville。ロゴ・見出し・金額を、余白と細い線で並べる。576 ドット幅の絵（imagePrint で白黒に）
function drawSlip(d,z){ if(d.kind==='bill') return drawBill(d,z); const c=slipTools(z), {g,W,fs}=c; slipHead(c,d);
  (d.kind==='estimate'?slipEst:slipDetail)(c,d);
  if(d.note){ c.y+=Math.round(fs*1.5); g.textAlign='right'; g.font=c.MI(fs*0.75,400); g.fillText(d.note,W,c.y); } /* 金額の下に右寄せ */
  c.y+=Math.round(fs*1.4); const out=document.createElement('canvas'); out.width=W; out.height=c.y; out.getContext('2d').drawImage(c.cv,0,0); return out; }
// 伝票から紙の中身を作る（概算は延長した場合の金額をデータベースで出す）。出せない時は null
async function slipData(kind){ const b=S.cur, T=b.totals; if(!T) return null;
  const d={ kind, title:kind==='estimate'?'Estimate':kind==='bill'?'Receipt':'Details', store:S.store?.name||'OLIVE', due:T.amount_due, note:kind==='estimate'?'（消費税込）':'' };
  const src=S.settings?.receipt_logo; if(src){ try{ const im=new Image(); im.src=src; await im.decode(); d.logo=im; }catch(_){} } /* ロゴが読めない時は、ロゴなしで出す */
  if(kind==='estimate'){ const r=await sb.rpc('pos_bill_est',{p_bill:b.id}); if(r.error){ toast('概算の金額を出せません：'+r.error.message); return null; }
    d.rows=[{l:'',m:'〜'+hmS(r.data.until),r:r.data.now.amount_due},...(r.data.ext||[]).map(e=>({l:`${e.minutes}分延長`,m:'〜'+hmS(e.until),r:e.due}))]; }
  if(kind==='bill'){ const ps=(b.payments||[]).filter(p=>p.amount>0); d.pays=ps.length>1?ps.map(p=>({l:METHOD[p.method],r:p.amount})):[]; } /* 支払い方法が1つの時は、合計と同じ数字なので出さない */
  if(kind==='detail'){ const yen=n=>'¥'+(Number(n)||0).toLocaleString(), it=[];
    /* 延長は POS の伝票の画面と同じく1行にまとめる（30分延長 ×回数。延長ごとの人数は出さない）。VIP の延長は VIP charge のすぐ下（オーナー「VIP chargeの下に延長分のVIP charge」） */
    const ex=b.bill_extensions||[], xl=`${S.settings.ext_minutes}分延長 ×${ex.length}`;
    if(T.set) it.push({l:`セット ${b.set_minutes}分 ×${b.set_guest_count??b.guest_count}`,r:T.set}); if(ex.length) it.push({l:xl,r:ex.reduce((a,e)=>a+e.unit_price*e.qty,0)});
    if(T.vip_set) it.push({l:VIPL,r:T.vip_set}); if(T.vip_ext) it.push({l:`${VIPL} ${xl}`,r:T.vip_ext}); /* 並びはセット・延長・VIP（itemsInOrder の前の3つ） */
    itemsInOrder(groupItems((b.bill_items||[]).filter(i=>!i.is_void)),posItemKind).forEach(i=>it.push({l:`${i.name} ×${i.qty}`,r:i.unit_price*i.qty,s:(i.bill_item_splits||[]).map(s=>S.staffAll.find(x=>x.id===s.staff_id)?.display_name).filter(Boolean).join('/')}));
    d.items=it; d.sums=[{l:'小計',r:yen(T.subtotal)}]; if(T.service) d.sums.push({l:`サービス料 ${T.service_rate}%`,r:yen(T.service)}); d.sums.push({l:`消費税 ${T.tax_rate}%`,r:yen(T.tax)}); if(T.adjustment) d.sums.push({l:T.adjustment<0?'値引':'値増',r:yen(T.adjustment)}); }
  return d; }
const slipPrint=kind=>async()=>{ const d=await slipData(kind); if(d) imagePrint(drawSlip(d,PZ)); };
$('prEst').onclick=slipPrint('estimate'); $('prBill').onclick=slipPrint('bill'); $('prDetail').onclick=slipPrint('detail');
$('prReceipt').onclick=async()=>{ // 領収書：入金のあった金額まで。発行のたびにサインし、receipts に記録する。出し切った後は再発行扱い（理由必須）
  const recv=(S.cur.payments||[]).filter(p=>p.amount>0&&p.received_at); const received=recv.reduce((a,p)=>a+p.amount,0); const cap=Math.min(received,S.cur.totals?.amount_due??0);
  if(cap<=0){ toast('入金がまだないため、領収書は発行できません'); return; }
  const prev=await sb.from('receipts').select('amount,cash_amount,reissue_reason').eq('bill_id',S.cur.id).order('issued_at');
  if(prev.error){ toast('領収書の記録を読めません：'+prev.error.message); return; }
  const first=(prev.data||[]).filter(r=>!r.reissue_reason); const issued=first.reduce((a,r)=>a+r.amount,0); const remain=cap-issued; let why=null, max=remain;
  if(remain<=0){ max=cap; why=await askReason(`この伝票の領収書は、入金額 ${yen(cap)} の分まで発行済です（${(prev.data||[]).length}回）。再発行します。`); if(!why)return; }
  const lastAmt=Number((prev.data||[]).slice(-1)[0]?.amount)||max; const cashAll=recv.filter(p=>p.method==='cash').reduce((a,p)=>a+p.amount,0); const usedCash=why?0:first.reduce((a,r)=>a+(r.cash_amount||0),0);
  const c0=(S.cur.bill_customers||[]).map(c=>S.customers.find(x=>x.id===c.customer_id)).filter(Boolean)[0];
  openReceipt({max, amount:remain>0?remain:Math.min(lastAmt,max), name:c0?.receipt_none?'':rnFirst(c0?.receipt_name)||c0?.name||'', names:c0?.receipt_none?[]:rnList(c0?.receipt_name), /* 領収書 不要のお客様は宛名を入れない */ guests:S.cur.set_guest_count??S.cur.guest_count, cashAvail:Math.max(0,cashAll-usedCash), why}); };
// 領収書の絵（横長 1240×576）。印刷は 90度回して 80mm 幅（576ドット）で出す
// デザインを「静かな明朝」に（オーナー 案ア。見本 作業場/領収書_デザイン_案.png）。二重の細い枠・明朝と Baskerville・金額は二重線・右にロゴとお店。言葉は前と同じ
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
  g.font=MI(22,400); g.fillText(`但　${d.guests||'　　'}名様ご飲食代として`,64,446,676); /* ご利用日は印刷しない（オーナー） */ g.font=MI(21,600); g.fillText('上記正に領収いたしました',64,488); const sx=64+g.measureText('上記正に領収いたしました').width+18;
  if(d.stamp){ g.setLineDash([4,4]); g.strokeRect(656,340,84,64); g.setLineDash([]); g.font=MI(14); g.textAlign='center'; g.fillText('収入印紙',698,378); } /* 収入印紙の枠は印紙が要る時だけ */
  rcDrawShop(g,d,W,H,MI,sp,hl);
  const R=30,cy=480,scx=sx+R; if(d.sig){ g.save(); g.beginPath(); g.arc(scx,cy,R-3,0,Math.PI*2); g.clip(); g.drawImage(d.sig,scx-R+4,cy-R+4,(R-4)*2,(R-4)*2); g.restore(); } g.lineWidth=1; g.beginPath(); g.arc(scx,cy,R,0,Math.PI*2); g.stroke(); }
// 領収書の右の欄：縦の線と、店名・ロゴ・住所・電話・登録番号
function rcDrawShop(g,d,W,H,MI,sp,hl){
  hl(790,70,790,H-70); const cx=(790+W-26)/2; g.font=MI(19); const info=[...rcAddr(g,d.address,390),d.tel?('TEL '+d.tel):'',d.regno?('登録番号 '+d.regno):''].filter(Boolean); /* 印刷は 1px＝1ドット。15px では画数の多い字がつぶれるので 19px。郵便番号は1行目に分け、入らない住所は横に縮めずに折り返す（オーナー） */
  if(d.logo){ /* ロゴがある時は、店名はロゴに見えないふつうの字にし、ロゴから登録番号までを縦の線（70〜H-70）の真ん中に置く（オーナー） */
    const r=Math.min(250/d.logo.width,90/d.logo.height), lw=d.logo.width*r, lh=d.logo.height*r, gap=70, top=Math.round(H/2-(lh+gap+17+38+30*Math.max(info.length-1,0)+5)/2);
    g.drawImage(d.logo,cx-lw/2,top,lw,lh); const yn=top+lh+gap+17; g.font=MI(19,600); g.textAlign='center'; g.fillText(d.store||'',cx,yn,380);
    g.font=MI(19); info.forEach((t,i)=>g.fillText(t,cx,yn+38+30*i)); }
  else { g.font=MI(22,600); sp(d.store||'',cx,222,6,'center'); hl(cx-24,244,cx+24,244);
    g.font=MI(19); g.textAlign='center'; info.forEach((t,i)=>g.fillText(t,cx,282+30*i)); }
}
// 住所を領収書の行に分ける：郵便番号だけで1行、残りは幅 mw に入るように（空白の所で、無ければ字の途中で）折り返す
function rcAddr(g,a,mw){ a=String(a||'').trim(); if(!a) return []; const m=a.match(/^(〒?\s*\d{3}-?\d{4})[\s　]*([\s\S]*)$/), out=m?[m[1].replace(/\s+/g,'')]:[]; let r=(m?m[2]:a).replace(/\s+/g,' ').trim();
  while(r&&g.measureText(r).width>mw){ let k=r.length; while(k>1&&g.measureText(r.slice(0,k)).width>mw) k--; const sp=r.lastIndexOf(' ',k); if(sp>0) k=sp; out.push(r.slice(0,k).trim()); r=r.slice(k).trim(); }
  if(r) out.push(r); return out; }
function receiptPrint(cvs){ imagePrint([].concat(cvs).map(cv=>{ const W=576,H=1240; const r=document.createElement('canvas'); r.width=W; r.height=H; const g=r.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.translate(W,0); g.rotate(Math.PI/2); g.drawImage(cv,0,0); return r; })); }   /* 何枚かの領収書は1回の印刷の頼みにまとめる */
// 576ドット幅の絵を印刷する（領収書・名札で共通）。白黒は明るさ 150 未満が黒
// 1枚の絵を印刷機の白黒の画像の文に（1枚ごとに切る）
function eposImage(r){ const W=r.width,H=r.height, g=r.getContext('2d');
  const px=g.getImageData(0,0,W,H).data, bw=W/8, buf=new Uint8Array(bw*H); for(let yy=0;yy<H;yy++) for(let xx=0;xx<W;xx++){ const i=(yy*W+xx)*4; if((px[i]*299+px[i+1]*587+px[i+2]*114)/1000<150) buf[yy*bw+(xx>>3)]|=(0x80>>(xx&7)); }
  let bin=''; for(let i=0;i<buf.length;i+=8192) bin+=String.fromCharCode.apply(null,buf.subarray(i,i+8192));
  return `<image width="${W}" height="${H}" color="color_1" mode="mono">${btoa(bin)}</image>${r.dataset.nt?'<cut type="feed"/>':'<feed line="3"/><cut type="feed"/>'}`; }
function imagePrint(rs){ const L=[].concat(rs);
  if(PRINT.method==='browser'){ $('printArea').innerHTML=L.map(r=>`<img src="${r.toDataURL('image/png')}" style="width:72mm;display:block;break-after:page">`).join(''); setTimeout(()=>window.print(),80); return; }
  const xml=`<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">${L.map(eposImage).join('')}</epos-print>`;
  location.href='tmprintassistant://tmprintassistant.epson.com/print?ver=1&data-type=eposprintxml&reselect=yes&data='+encodeURIComponent(xml)+'&back='+encodeURIComponent(location.href); }
// ボトルの名札（オーナー）：名札のカード（よこ 53mm・たて 55mm・「様」の付いた丸い枠にキープ名）をレシートの紙に
// はさみで切るのを1か所に（オーナー「左右をカットする手間」「点線もいらない」）。カードのたてを紙の出る向きにして、印刷機が 55mm ちょうどで切る。カードの横は紙の端に合わせる（反対側の1か所だけ切る）
// 印刷機は刃と印字の位置が約 10mm 離れている（NT.off）ので、紙の最初の off mm には印刷できない。カードの上は何も書かない所なので、そこに当てる
const NT={ ch:55, cw:53, edge:4, off:10.3, bw:40, bh:11, bb:5, px:48, mw:30, mk:2 }; /* ch/cw：カード・edge：紙の端から印刷できる所までの幅・off：刃と印字の位置の差・bw/bh/bb：丸い枠（幅・高さ・カードの下からの位置。bb は札の窓に合わせた）・px：字の高さ・mw：名前の幅の上限・mk：切る所の目印の長さ（mm） */
function nametagPrint(name){ const D=8, W=576, H=Math.round((NT.ch-NT.off)*D); const r=document.createElement('canvas'); r.width=W; r.height=H; const g=r.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#000'; g.strokeStyle='#000';
  const x0=-NT.edge*D, bw=NT.bw*D, bh=NT.bh*D, bx=x0+(NT.cw*D-bw)/2, by=H-(NT.bb*D)-bh, rad=bh/2; /* カードの左＝紙の左の端（印刷できる所の 4mm 外） */
  g.lineWidth=2; g.beginPath(); g.moveTo(bx+rad,by); g.lineTo(bx+bw-rad,by); g.arc(bx+bw-rad,by+rad,rad,-Math.PI/2,Math.PI/2); g.lineTo(bx+rad,by+bh); g.arc(bx+rad,by+rad,rad,Math.PI/2,Math.PI*1.5); g.closePath(); g.stroke();
  const MI=(px,w)=>`${w} ${px}px "Hiragino Mincho ProN","Hiragino Mincho Pro","Yu Mincho","Noto Serif JP",serif`; g.textBaseline='middle';
  g.font=MI(32,600); g.textAlign='right'; g.fillText('様',bx+bw-3*D,by+bh/2+2);
  const mw=NT.mw*D, cx=bx+(bw-6*D)/2, cy=by+bh/2+2; g.textAlign='center';
  const t=name.trim(); g.font=MI(NT.px,600); const tw=g.measureText(t).width; g.save(); g.translate(cx,cy); if(tw>mw) g.scale(mw/tw,1); g.fillText(t,0,0); g.restore(); /* キープ名をそのまま1行（入らない時は字の幅を細く） */
  const mx=x0+NT.cw*D; g.lineWidth=2; g.beginPath(); g.moveTo(mx,0); g.lineTo(mx,NT.mk*D); g.moveTo(mx,H-NT.mk*D); g.lineTo(mx,H); g.stroke(); /* はさみで切る所の目印（上と下に短い線。オーナー「やっぱりイ」） */
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
const rcTax=(a,rate)=>{ const t=S.cur.totals||{}, due=Number(t.amount_due)||0; return due>0&&t.tax!=null?Math.round(Number(t.tax)*a/due):Math.floor(a*rate/(100+rate)); };
const stampYen=(cash,rate)=>{ const x=cash-rcTax(cash,rate); if(x<50000) return 0; for(const [u,v] of [[1e6,200],[2e6,400],[3e6,600],[5e6,1000],[1e7,2000],[2e7,4000],[3e7,6000],[5e7,10000],[1e8,20000]]) if(x<=u) return v; return 40000; };
// 発行した領収書を記録する（サインは 180px の PNG）
function rcSave(o,d,sig){
    const s2=document.createElement('canvas'); s2.width=s2.height=180; s2.getContext('2d').drawImage(sig,0,0,180,180); const jd=`${d.issue.getFullYear()}-${String(d.issue.getMonth()+1).padStart(2,'0')}-${String(d.issue.getDate()).padStart(2,'0')}`;
    return insOnce('receipts',{store_id:S.store.id,bill_id:S.cur.id,issue_date:jd,visit_date:S.cur.business_date,name:d.name||null,guest_count:d.guests,amount:d.amount,cash_amount:d.cash,card_amount:d.card,tax_amount:d.tax,signature:s2.toDataURL('image/png'),reissue_reason:o.why||null}); }
// 領収書の画面の文（宛名・金額・人数・現金・カード・見本・ボタン）
function rcHtml(o){
  return `<div class="box" style="width:min(980px,96vw);max-height:94vh;overflow:auto"><div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;gap:6px 10px"><label>宛名<input data-rc="name" style="width:100%"></label><label>金額<input data-rc="amount" inputmode="numeric" style="width:100%;text-align:right"></label><label>枚数<input data-rc="n" inputmode="numeric" maxlength="2" style="width:100%;text-align:right"></label>`+
    `<label>人数<input data-rc="guests" inputmode="numeric" style="width:100%;text-align:right"></label><label>現金<input data-rc="cash" inputmode="numeric" style="width:100%;text-align:right"></label><label>カード<input data-rc="card" readonly style="width:100%;text-align:right;background:var(--soft)"></label></div>${(o.names||[]).length>1?`<div class="chips" data-rcnames style="margin-top:6px">${o.names.map((n,i)=>`<button type="button" class="chip ${i?'':'on'}" style="padding:6px 12px;font-size:14px">${esc(n)}</button>`).join('')}</div>`:''}<div data-rcmix class="hidden" style="color:var(--warn);font-size:14px;margin-top:6px">この伝票は現金とカードの両方で払われています。この領収書の現金・カードの分け方を確かめてください（現金の欄を直すと、残りがカードになります）</div>
  <canvas data-rc="pv" style="width:100%;border:1px solid var(--line);margin-top:10px;display:block"></canvas>
  <div style="display:flex;align-items:center;gap:10px;margin-top:10px"><span data-rc="split" style="font-size:16px"></span><span data-rc="stamp" class="badge hidden" style="background:var(--warn);font-size:15px;padding:6px 14px">収入印紙</span><div class="bar" style="margin-left:auto"><button class="ghost" data-rc="no">キャンセル</button><button class="primary" data-rc="ok">発行</button></div></div></div>`;
}
// 同じ金額で何枚かに分ける（オーナー 11/20「100円単位で、総額は変わらずに」）：2枚目以降＝（総額÷枚数）の100円未満を切り捨て、1枚目＝残り全部
function rcSplit(total, n){ n=Math.max(1,Math.min(10,Math.floor(n)||1)); if(n===1) return [total]; const e=Math.floor(total/n/100)*100; return [total-e*(n-1), ...Array(n-1).fill(e)]; }
// 現金も同じ形で分け、1枚の金額を超えた分は次の枚へ（現金とカードで払った伝票）
function rcCashSplit(cash, A){ const C=rcSplit(cash, A.length).map((c,i)=>Math.min(c,A[i])); let left=cash-C.reduce((a,c)=>a+c,0); for(let i=0;i<C.length&&left>0;i++){ const add=Math.min(left,A[i]-C[i]); C[i]+=add; left-=add; } return C; }
const rcSplitText=A=>{ const y=v=>yen(v), n=A.length; return n<2?'':A[0]===A[1]?`${y(A[1])} × ${n}枚`:`${y(A[0])} × 1枚・${y(A[1])} × ${n-1}枚`; };
// ［発行］の後：要る収入印紙を知らせる → 黒服のサインは1回 → 1枚ずつ記録 → まとめて印刷。記録できた分だけ印刷する
async function rcIssue(o,L,data,rate,m){
  const st=L.map(x=>stampYen(x.c,rate)); if(st.some(v=>v)){ m.style.zIndex=59; await uiAlert(L.length<2?`収入印紙　${yen(st[0])}`:'収入印紙　'+st.map((v,i)=>v?`${i+1}枚目 ${yen(v)}`:'').filter(Boolean).join('・')); m.style.zIndex=60; } /* 小窓（z-index 60）を領収書の画面の上に出す。要る印紙の金額は発行の時に小窓で（オーナー） */
  const sg=await askSign(); if(!sg) return null;   /* サインは1回で、何枚でも同じサイン（オーナー「ア サインは1回」） */
  const cvs=[]; for(const x of L){ const d={...data(x),sig:sg}; const r=await rcSave(o,d,sg); if(r.error){ toast('領収書を記録できません：'+r.error.message); if(cvs.length) receiptPrint(cvs); return null; }
    await logOp(o.why?'領収書再発行':'領収書発行',{name:d.name||null,amount:d.amount,...(L.length>1?{sheets:L.length}:{})},o.why); const cv=document.createElement('canvas'); drawReceipt(cv,d); cvs.push(cv); }
  receiptPrint(cvs); return sg; }
function openReceipt(o){ const rate=Number(S.cur.totals?.tax_rate)||10; const m=mkModal(60);
  m.innerHTML=rcHtml(o);
  document.body.appendChild(m); const q=k=>m.querySelector(`[data-rc=${k}]`); const num=k=>numIn(q(k).value);
  q('name').value=o.name||''; q('amount').value=o.amount; q('n').value='1'; q('guests').value=''; let cashTouched=false; q('cash').value=Math.min(o.amount,o.cashAvail);
  let sigCv=null;
  let logo=null; if(S.settings?.receipt_logo){ const im=new Image(); im.onload=()=>{ logo=im; paint(); }; im.src=S.settings.receipt_logo; }
  const total=()=>{ const amount=num('amount'); const cash=Math.min(num('cash'),amount); return {amount,cash}; };
  const sheets=()=>{ const t=total(), A=rcSplit(t.amount,num('n')), C=rcCashSplit(t.cash,A); return A.map((a,i)=>({a,c:C[i]})); };
  const data=(sh)=>{ const {a:amount,c:cash}=sh||sheets()[0]; const now=new Date(); return { name:q('name').value.trim(), amount, guests:num('guests')||null, cash, card:amount-cash, rate, tax:rcTax(amount,rate), issue:now, store:S.store?.name||'', address:S.store?.address||'', tel:S.store?.phone||S.store?.tel||'', regno:S.settings?.invoice_reg_no||'', logo, sig:sigCv, stamp:stampYen(cash,rate) }; };
  const paint=()=>{ const t=total(), L=sheets(), d=data(L[0]); q('card').value=t.amount-t.cash; q('split').textContent=rcSplitText(L.map(x=>x.a)); q('stamp').classList.toggle('hidden',!L.some(x=>stampYen(x.c,rate))); /* 収入印紙が要る時だけしるし（オーナー 案イ） */ drawReceipt(q('pv'),d); };   /* 見本の絵は1枚目 */
  q('amount').oninput=()=>{ if(!cashTouched) q('cash').value=Math.min(num('amount'),o.cashAvail); /* 現金とカードの両方で払われた伝票は、金額を変えたら現金の欄を確かめるように出す（ゲネプロ #38） */ const mx=m.querySelector('[data-rcmix]'); if(mx) mx.classList.toggle('hidden',!(o.cashAvail>0&&o.cashAvail<o.amount&&num('amount')!==o.amount)); paint(); }; q('cash').oninput=()=>{ cashTouched=true; paint(); }; q('name').oninput=q('guests').oninput=q('n').oninput=paint;
  m.querySelectorAll('[data-rcnames] .chip').forEach(b=>b.onclick=()=>{ q('name').value=b.textContent; m.querySelectorAll('[data-rcnames] .chip').forEach(x=>x.classList.toggle('on',x===b)); paint(); }); /* 領収書名が2社以上の時は宛名の下で選択 */
  q('no').onclick=()=>m.remove(); paint();
  const ok=q('ok'); ok.onclick=guard(ok,async()=>{ const t=total(), n=num('n'); if(!t.amount||t.amount<1){ toast('金額が正しくありません'); return; } if(t.amount>o.max){ toast(`上限は ${yen(o.max)} です`); return; } if(num('cash')>t.amount){ toast('現金が金額を超えています'); return; }
    if(!(n>=1&&n<=10)){ toast('枚数は1〜10にしてください'); return; } const L=sheets(); if(L.some(x=>x.a<1)){ toast('金額が枚数に対して少なすぎます'); return; }
    const sg=await rcIssue(o,L,data,rate,m); if(sg){ sigCv=sg; paint(); m.remove(); } }); }
$('extAdd').textContent=`${S.settings?.ext_minutes||30}分延長`;
$('extAdd').onclick=guard($('extAdd'),async()=>{ const { error } = await insOnce('bill_extensions',{bill_id:S.cur.id,minutes:S.settings.ext_minutes,unit_price:S.settings.ext_unit_price,qty:S.cur.guest_count,is_auto:false}); if(error){ if(await stale(error)) return; toast(error.message); return; } await logOp('延長追加（手動）',{minutes:S.settings.ext_minutes,amount:S.settings.ext_unit_price*S.cur.guest_count}); await openBill(S.cur.id); });
$('bBack').onclick=()=>{ if(S.billFrom==='bills'){ renderSettings('bills'); show('v-settings'); return; } loadHall(); show('v-hall'); };
// 先に「削除しますか？」を出す（やめられる）。続けて理由（必須）
$('bVoid').onclick=async()=>{ const tn=billTable(S.cur); if(!await uiConfirm(`${tk(tn)}の伝票を削除しますか？\n履歴は残ります`,'削除','danger'))return; const by=await askBy(); if(by===null) return; const why0=await askReason(`${tk(tn)}の伝票を削除します。`); if(!why0)return; const why=by?`${why0}（${by}）`:why0; const vb=$('bVoid'); if(vb.disabled) return; vb.disabled=true; /* 取消できたのを確かめてから操作ログに書く（前はログが先で、失敗しても「取消」が残った） */
  try{ const u=await cashClosed(()=>sb.rpc('pos_rows_set',{p_table:'bills',p_where:{id:(S.cur.id)??null,'status!':('void')??null},p:{status:'void',closed_at:new Date().toISOString(),...(S.DBLOG?{void_reason:why}:{})}}),`伝票の削除（${tn}）`); /* 現金の入金がある伝票は、精算済みの日は精算の取消の後に削除 */
    if(u.error?.cancel){}
    else if(u.error||!(u.data||[]).length){ await uiAlert(u.error?'伝票を削除できませんでした：'+u.error.message:'伝票を削除できませんでした（ほかの端末で変更されています）'); }
    else if(!S.DBLOG) await logOp('伝票取消',{total:S.cur.totals?.amount_due??null,guest_count:S.cur.guest_count,items:(S.cur.bill_items||[]).filter(i=>!i.is_void).map(i=>`${i.name}×${i.qty}`)},why);
  } finally{ vb.disabled=false; } loadHall(); show('v-hall'); };
$('bOrder').onclick=()=>openOrder();
$('bPay').onclick=async()=>{ if(!S.cur?.totals) return; if(S.cur.status==='open'){ const miss=[]; if(!(S.cur.bill_customers||[]).length) miss.push('お客様が登録されていません'); if(!(S.cur.bill_casts||[]).some(c=>c.is_kakari)) miss.push(''+KL+'が登録されていません'); if(miss.length){ await uiAlert(miss.join('\n')); return; }
    const r=await sb.rpc('pos_pay_open',{p_bill:S.cur.id}); if(r.error){ toast(r.error.message); return; } const opened=await openBill(S.cur.id); if(!opened||S.cur.status!=='open') return; } /* お会計の説明中に延長が付かないよう、開いた時刻で止める（SQL 548） */ renderPay(); show('v-pay'); };

