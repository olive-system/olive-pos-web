// ---------- LINE QR（SQL 758）：本人がマイページで登録した友だち追加の QR を、カードに印刷して渡す ----------
// 在籍の詳細の「LINEマイページ」の下に「LINE QR　登録済み［印刷］」。未登録の子は「未登録」だけ
// 感熱紙は熱で黒くなるので、熱いラミネーターは使えない（［印刷］の下に1行）
const LQ_ROW=`<div id="cLqRow" style="display:none"><span>LINE QR</span><span><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="color:var(--ink)" id="cLq">…</b><button class="ghost sm" id="cLqBtn" style="display:none;padding:2px 10px">印刷</button></span><small class="muted" id="cLqNote" style="display:none">加熱ラミネート不可（感熱紙）</small></span></div>`;
function cfLineQr(s){ sb.rpc('pos_line_qr').then(r=>{ const row=$('cLqRow'); if(!row||S.cSel!==s||r.error) return; row.style.display='contents'; const u=(r.data||{})[s.id], b=$('cLqBtn');
    $('cLq').textContent=u?'登録済み':'未登録'; b.style.display=u?'':'none'; $('cLqNote').style.display=u?'block':'none';
    b.onclick=async()=>{ b.disabled=true; try{ await lineQrPrint(s.display_name,u); await logOp('LINE QR を印刷',{name:s.display_name}); caNyQrPrinted(s.id); } finally{ b.disabled=false; } }; }); }
// カード：80×46mm（ボトルの名札と同じ向き。紙の幅 80mm をよこにし、プリンターが 46mm で切る。はさみは要らない）。オーナー（11/26 見本の OK）「名刺（49×85mm）より一回り小さく」「ロゴは？名前は小さくしていい」
// 左に印刷のロゴ（概算・会計と同じ）と源氏名、右に QR（約 25mm 角）。印刷できない頭の NT.off mm を除いた所で、中身はカードのたての真ん中から 1mm 下（印刷の位置が少しずれても欠けないように）
const LQC={ h:46, logoW:30, logoH:10, nameH:4.2, gap:7, lgap:4 }; /* mm */
async function lineQrPrint(name,url){ await needLib('qrcode'); const D=8, W=576, H=Math.round((LQC.h-NT.off)*D), r=document.createElement('canvas'); r.width=W; r.height=H; const g=r.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#000';
  const c0=Math.round((LQC.h/2-NT.off)*D), q=qrcode(0,'M'); q.addData(url); q.make(); const n=q.getModuleCount(), cs=Math.floor(2*c0/n), qw=cs*n, cy=c0+D; /* 1マスは整数のドット */
  const gap=LQC.gap*D, room=W-qw-gap-2*NT.edge*D; let lc=null, lw=0, lh=0;
  if(S.settings?.receipt_logo){ try{ const im=new Image(); im.src=S.settings.receipt_logo; await im.decode(); lw=Math.min(room,LQC.logoW*D); lh=Math.round(im.height*lw/im.width); if(lh>LQC.logoH*D){ lh=LQC.logoH*D; lw=Math.round(im.width*lh/im.height); } lc=slipLogo(im,lw); lh=lc.height; }catch(_){ lc=null; lw=lh=0; } } /* ロゴが読めない時は、ロゴなしで出す */
  const MI=px=>`600 ${px}px "Hiragino Mincho ProN","Hiragino Mincho Pro","Yu Mincho","Noto Serif JP",serif`, ch=[...name]; let nh=Math.round(LQC.nameH*D), ls, nw;
  for(;;){ g.font=MI(nh); ls=Math.round(nh*0.15); nw=ch.reduce((a,x)=>a+g.measureText(x).width,0)+ls*(ch.length-1); if(nw<=room||nh<=3*D) break; nh-=2; } /* 長い名前は入るまで小さく */
  const colW=Math.max(lw,nw), lg=lc?LQC.lgap*D:0, colH=lh+lg+nh, x0=Math.round((W-(colW+gap+qw))/2), ty=cy-Math.round(colH/2);
  if(lc) g.drawImage(lc,x0+Math.round((colW-lw)/2),ty); g.textBaseline='top'; g.textAlign='left'; let x=x0+Math.round((colW-nw)/2); for(const t of ch){ g.fillText(t,x,ty+lh+lg); x+=g.measureText(t).width+ls; }
  const qx=x0+colW+gap, qy=cy-Math.round(qw/2); for(let i=0;i<n;i++) for(let j=0;j<n;j++) if(q.isDark(i,j)) g.fillRect(qx+j*cs,qy+i*cs,cs,cs);
  r.dataset.nt=1; imagePrint(r); } /* 絵の終わりで切る（余白の行を入れない）：紙の長さ＝NT.off＋絵の長さ＝46mm */
