// ---------- 書類の撮影（紙の四隅を見つけて切り取り・まっすぐに直して白黒・PDF）と、画面の中のカメラ（撮る前に角の丸・自動で撮る・撮った後に角の修正） ----------
// POS の閉店作業②「領収書精算」とマイページのスカウト請求書（オーナー 2026-11-24「同じ処理を通す」）で同じ部品を使う。中身は前の POS の 19_close_receipt.js のまま
// カメラが使えなかった印は、POS では S.clCamNo（テストも使う）、ほかのサイトでは CL_CAM.clCamNo
const CL_CAM = {};
function clCamFlag(){ return (typeof S !== 'undefined' && S) ? S : CL_CAM; }
let clJsPdf=null;
function clLoadPdf(){ if(window.jspdf) return Promise.resolve(); if(!clJsPdf) clJsPdf=new Promise((ok,ng)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'; s.onload=ok; s.onerror=()=>{ clJsPdf=null; ng(new Error('PDF の部品を読み込めません')); }; document.head.appendChild(s); }); return clJsPdf; }
// 書類のスキャンのように：長い辺 1600px・白黒・紙の地を白く
/* （オーナー「周りの余計な部分もある。トリミングされてない」）：写真の中の白い紙（いちばん大きい明るいかたまり）の四隅を見つけて切り取り、まっすぐに直してから白黒にする。紙が見つからない時（白い机の上など）は写真のまま */
function clCorners(x,w,h){ const k=240/Math.max(w,h), sw=Math.max(8,Math.round(w*k)), sh=Math.max(8,Math.round(h*k)); const c=document.createElement('canvas'); c.width=sw; c.height=sh; const y=c.getContext('2d'); y.drawImage(x.canvas,0,0,sw,sh);
  const d=y.getImageData(0,0,sw,sh).data, N=sw*sh, L=new Uint8Array(N), hist=new Array(256).fill(0); for(let i=0;i<N;i++){ const r=d[i*4],g=d[i*4+1],b=d[i*4+2], mx=Math.max(r,g,b), l=Math.max(0,Math.min(255,Math.round(mx*(1-4*(mx-Math.min(r,g,b))/Math.max(1,mx))))); L[i]=l; hist[l]++; } /* 明るさだけで分けると、照明が当たった木目の机も紙に入って角がずれる → 色の無さ（明るさに対する色の割合）で分ける。影になった紙も色は無いので残る */
  let sum=0; for(let t=0;t<256;t++) sum+=t*hist[t]; let sB=0,wB=0,best=0,th=128; for(let t=0;t<256;t++){ wB+=hist[t]; if(!wB) continue; const wF=N-wB; if(!wF) break; sB+=t*hist[t]; const mB=sB/wB, mF=(sum-sB)/wF, v=wB*wF*(mB-mF)*(mB-mF); if(v>best){ best=v; th=t; } }
  const lab=new Int32Array(N).fill(-1), q=new Int32Array(N); let big=-1, bigN=0, bigE=0;
  for(let i=0;i<N;i++){ if(L[i]<=th||lab[i]>=0) continue; let hd=0,tl=0,e=0; q[tl++]=i; lab[i]=i; while(hd<tl){ const j=q[hd++], jx=j%sw, jy=(j-jx)/sw; if(!jx||!jy||jx===sw-1||jy===sh-1) e++; for(const n of [j-sw,j+sw,jx>0?j-1:-1,jx<sw-1?j+1:-1]){ if(n<0||n>=N||lab[n]>=0||L[n]<=th) continue; lab[n]=i; q[tl++]=n; } } if(tl>bigN){ bigN=tl; big=i; bigE=e; } }
  if(big>=0&&(bigE>=(sw+sh)*0.5||bigN>N*0.97)){ const E=clEdgeQuad(x,w,h); if(E) return E; } /* 明るい台：台と紙が1つのかたまりになり、写真のふちに広く付く → 紙のふちの線で探す */
  if(big<0||bigN<N*0.12||bigN>N*0.97) return null;
  let Q=clSides(lab,big,sw,sh,bigN); if(!Q){ let tl=null,tr=null,br=null,bl=null; for(let i=0;i<N;i++){ if(lab[i]!==big) continue; const px=i%sw, py=(i-px)/sw; if(!tl||px+py<tl[0]+tl[1]) tl=[px,py]; if(!br||px+py>br[0]+br[1]) br=[px,py]; if(!tr||px-py>tr[0]-tr[1]) tr=[px,py]; if(!bl||px-py<bl[0]-bl[1]) bl=[px,py]; } Q=[tl,tr,br,bl]; }
  return Q.map(([px,py])=>[(px+0.5)/k,(py+0.5)/k]); }
/* 明るい灰色の台（石・白っぽい机）の上の紙：台も紙も色が無く、影で紙の一部が台より暗くなるので、明るさでは分けられない（銀座の 1,870円の領収書が台ごと PDF になった「トリミングがされてない」）。
   紙のふちのまっすぐな線を探し、4本の線で囲んだ四角のうち、4辺とも線がふちに沿って続いている一番大きなものを紙とする（中の表の罫線は紙より小さい・台の手前の線は紙の横の辺が続かない）。見つからない時は null */
// 紙のふちの線を探すための下ごしらえ：小さくした写真の明るさの変わり目（強さ E と向き A）
function clEdgeMap(x,w,h){ const k=400/Math.max(w,h), sw=Math.max(8,Math.round(w*k)), sh=Math.max(8,Math.round(h*k)), c=document.createElement('canvas'); c.width=sw; c.height=sh; const y=c.getContext('2d'); y.drawImage(x.canvas,0,0,sw,sh);
  const d=y.getImageData(0,0,sw,sh).data, N=sw*sh, G=new Float32Array(N), M=new Float32Array(N), A=new Float32Array(N); for(let i=0;i<N;i++) G[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  const gv=(X,Y)=>G[Math.max(0,Math.min(sh-1,Y))*sw+Math.max(0,Math.min(sw-1,X))];
  for(let Y=0;Y<sh;Y++) for(let X=0;X<sw;X++){ const gx=gv(X+1,Y-1)+2*gv(X+1,Y)+gv(X+1,Y+1)-gv(X-1,Y-1)-2*gv(X-1,Y)-gv(X-1,Y+1), gy=gv(X-1,Y+1)+2*gv(X,Y+1)+gv(X+1,Y+1)-gv(X-1,Y-1)-2*gv(X,Y-1)-gv(X+1,Y-1), i=Y*sw+X; M[i]=Math.hypot(gx,gy); A[i]=Math.atan2(gy,gx); }
  const srt=Float32Array.from(M).sort(), thr=Math.max(40,srt[Math.floor(N*0.9)]), E=new Uint8Array(N); for(let i=0;i<N;i++) E[i]=M[i]>thr?1:0;
  return {k,sw,sh,N,E,A}; }
// まっすぐな線を強い順に40本（向き t は 1度きざみ・r は原点からの距離）
function clEdgeLines(m){ const {sw,sh,N,E,A}=m, NT=180, R=Math.ceil(Math.hypot(sw,sh)), acc=new Int32Array(NT*(2*R+1)), cs=[], sn=[]; for(let t=0;t<NT;t++){ cs.push(Math.cos(t*Math.PI/NT)); sn.push(Math.sin(t*Math.PI/NT)); }
  for(let i=0;i<N;i++){ if(!E[i]) continue; const X=i%sw, Y=(i-X)/sw; let a=A[i]; if(a<0) a+=Math.PI; const t0=Math.round(a*NT/Math.PI); for(let dt=-6;dt<=6;dt++){ const t=((t0+dt)%NT+NT)%NT; acc[t*(2*R+1)+Math.round(X*cs[t]+Y*sn[t])+R]++; } }
  const pk=[]; for(let t=0;t<NT;t++) for(let r=0;r<2*R+1;r++){ const v=acc[t*(2*R+1)+r]; if(v<Math.min(sw,sh)*0.15) continue; let mx=true; for(let dt=-3;dt<=3&&mx;dt++) for(let dr=-4;dr<=4;dr++){ if(!dt&&!dr) continue; const tt=t+dt, rr=r+dr; const T=(tt+NT)%NT, RR=tt<0||tt>=NT?2*R-rr:rr; if(RR<0||RR>2*R) continue; const u=acc[T*(2*R+1)+RR]; if(u>v||(u===v&&(dt<0||(!dt&&dr<0)))){ mx=false; break; } } if(mx) pk.push({t,r:r-R,v}); }
  pk.sort((a,b)=>b.v-a.v); return {L:pk.slice(0,40),cs,sn,NT}; }
function clEdgeQuad(x,w,h){ const m=clEdgeMap(x,w,h), {k,sw,sh,N,E}=m, {L:Lk,cs,sn,NT}=clEdgeLines(m);
  const ang=(a,b)=>{ const z=Math.abs(a.t-b.t)%NT; return Math.min(z,NT-z); }, meet=(a,b)=>{ const D=cs[a.t]*sn[b.t]-sn[a.t]*cs[b.t]; if(Math.abs(D)<1e-6) return null; return [(a.r*sn[b.t]-b.r*sn[a.t])/D,(cs[a.t]*b.r-cs[b.t]*a.r)/D]; };
  const P=[]; for(let i=0;i<Lk.length;i++) for(let j=i+1;j<Lk.length;j++){ const a=Lk[i], b=Lk[j]; if(ang(a,b)>8) continue; const dd=Math.abs(a.t===b.t?a.r-b.r:a.r+(Math.abs(a.t-b.t)>NT/2?b.r:-b.r)); if(dd<Math.min(sw,sh)*0.15) continue; P.push([a,b]); }
  const sup=(p,q)=>{ const L=Math.hypot(q[0]-p[0],q[1]-p[1]), n=Math.max(8,Math.round(L/2)); let hit=0,cnt=0,run=0,gap=0; for(let s=0;s<=n;s++){ const f=0.06+0.88*s/n, X=p[0]+(q[0]-p[0])*f, Y=p[1]+(q[1]-p[1])*f; if(X<1||Y<1||X>sw-2||Y>sh-2) return 0; cnt++; let ok=false; for(let dy=-2;dy<=2&&!ok;dy++) for(let dx=-2;dx<=2;dx++){ if(E[Math.round(Y+dy)*sw+Math.round(X+dx)]){ ok=true; break; } } if(ok){ hit++; run=0; } else if(++run>gap) gap=run; } return !cnt||gap>Math.max(3,n*0.05)?0:hit/cnt; }; /* 辺の途中で線が長く切れている（紙の横の辺を台の手前まで伸ばした所など）四角は取らない */
  let best=null; for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){ const [a,b]=P[i], [c2,d2]=P[j]; const g=ang(a,c2); if(Math.abs(g-NT/2)>12) continue;
    const Q=[meet(a,c2),meet(a,d2),meet(b,d2),meet(b,c2)]; if(Q.some(p=>!p||p[0]<-2||p[1]<-2||p[0]>sw+1||p[1]>sh+1)) continue;
    const ar=Math.abs(Q.reduce((z,p,m)=>{ const q=Q[(m+1)%4]; return z+p[0]*q[1]-q[0]*p[1]; },0))/2; if(ar<N*0.08||ar>N*0.95) continue;
    const s=Math.min(...Q.map((p,m)=>sup(p,Q[(m+1)%4]))); if(s<0.7) continue; if(!best||ar>best.ar) best={Q,ar}; }
  if(!best) return null;
  const Q=best.Q, cx=Q.reduce((z,p)=>z+p[0],0)/4, cy=Q.reduce((z,p)=>z+p[1],0)/4; Q.sort((p,q)=>Math.atan2(p[1]-cy,p[0]-cx)-Math.atan2(q[1]-cy,q[0]-cx)); /* 左上から時計回り */
  let s0=0; for(let m=1;m<4;m++) if(Q[m][0]+Q[m][1]<Q[s0][0]+Q[s0][1]) s0=m; const O=[0,1,2,3].map(m=>Q[(s0+m)%4]);
  return O.map(([px,py])=>[Math.max(0,Math.min(w-1,px/k)),Math.max(0,Math.min(h-1,py/k))]); }
// 紙の4辺に線を引き、となりの線の交わる所を角にする。指で角が隠れても、見えている辺から隠れた角を補える（一番端の点を角にすると、隠れた所で四角がゆがむ）。辺が見つからない・形がおかしい時は null（一番端の点で切る）
function clSides(lab,big,sw,sh,n){ const P=[]; for(let i=0;i<lab.length;i++){ if(lab[i]!==big) continue; const x=i%sw, y=(i-x)/sw; if(!x||!y||x===sw-1||y===sh-1||lab[i-1]!==big||lab[i+1]!==big||lab[i-sw]!==big||lab[i+sw]!==big) P.push([x,y]); }
  P.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]), hull=L=>{ const H=[]; for(const p of L){ while(H.length>1&&cr(H[H.length-2],H[H.length-1],p)<=0) H.pop(); H.push(p); } H.pop(); return H; }, C=hull(P).concat(hull(P.slice().reverse())); if(C.length<4) return null;
  let best=Infinity, t=0; for(let i=0;i<C.length;i++){ const a=C[i], b=C[(i+1)%C.length], u=Math.atan2(b[1]-a[1],b[0]-a[0]), c=Math.cos(u), s=Math.sin(u); let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; for(const p of C){ const X=p[0]*c+p[1]*s, Y=p[1]*c-p[0]*s; if(X<x0)x0=X; if(X>x1)x1=X; if(Y<y0)y0=Y; if(Y>y1)y1=Y; } if((x1-x0)*(y1-y0)<best){ best=(x1-x0)*(y1-y0); t=u; } }
  while(t>Math.PI/4) t-=Math.PI/2; while(t<=-Math.PI/4) t+=Math.PI/2; const c=Math.cos(t), s=Math.sin(t), R=p=>[p[0]*c+p[1]*s,p[1]*c-p[0]*s]; let cu=0,cv=0; C.forEach(p=>{ const [u,v]=R(p); cu+=u/C.length; cv+=v/C.length; });
  const S={}, tn=Math.tan(Math.PI/9); for(let i=0;i<C.length;i++){ const a=C[i], b=C[(i+1)%C.length], [au,av]=R(a), [bu,bv]=R(b), du=bu-au, dv=bv-av, len=Math.hypot(du,dv); let k=null, f=1;
    if(Math.abs(dv)<=tn*Math.abs(du)){ k=(av+bv)/2<cv?'t':'b'; f=du<0?-1:1; } else if(Math.abs(du)<=tn*Math.abs(dv)){ k=(au+bu)/2<cu?'l':'r'; f=dv<0?-1:1; } if(!k) continue;
    const z=S[k]||(S[k]={w:0,x:0,y:0,dx:0,dy:0}); z.w+=len; z.x+=len*(a[0]+b[0])/2; z.y+=len*(a[1]+b[1])/2; z.dx+=f*(b[0]-a[0]); z.dy+=f*(b[1]-a[1]); }
  if(!S.t||!S.b||!S.l||!S.r) return null; const X=(A,B)=>{ const ax=A.x/A.w, ay=A.y/A.w, bx=B.x/B.w, by=B.y/B.w, d=A.dx*B.dy-A.dy*B.dx; if(Math.abs(d)<1e-9) return null; const m=((bx-ax)*B.dy-(by-ay)*B.dx)/d; return [ax+m*A.dx, ay+m*A.dy]; };
  const Q=[X(S.t,S.l),X(S.t,S.r),X(S.b,S.r),X(S.b,S.l)]; if(Q.some(p=>!p||p[0]<-sw*0.1||p[0]>sw*1.1||p[1]<-sh*0.1||p[1]>sh*1.1)) return null;
  const A=Math.abs(Q.reduce((z,p,i)=>{ const q=Q[(i+1)%4]; return z+p[0]*q[1]-q[0]*p[1]; },0))/2; return A>=n*0.9&&A<=n*1.6?Q:null; }
/* 字を黒く・紙を白く：周りの明るさ（紙の地）で割って、影や照明のむらを消してから濃淡を付ける（Apple のスキャンの白黒に近づける） */
function clInk(G, W, H){
  const R = Math.max(8, Math.round(Math.max(W, H) / 60)), W1 = W + 1, I = new Float64Array(W1 * (H + 1)), D = new Uint8ClampedArray(W * H);
  for(let j = 0; j < H; j++){ let s = 0; for(let i = 0; i < W; i++){ s += G[j * W + i]; I[(j + 1) * W1 + i + 1] = I[j * W1 + i + 1] + s; } }
  for(let j = 0; j < H; j++){ const y0 = Math.max(0, j - R), y1 = Math.min(H, j + R + 1);
    for(let i = 0; i < W; i++){ const x0 = Math.max(0, i - R), x1 = Math.min(W, i + R + 1);
      const mean = (I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0));
      const r = G[j * W + i] / Math.max(40, mean * 1.08); D[j * W + i] = r >= 0.92 ? 255 : Math.pow(Math.max(0, (r - 0.45) / 0.47), 1.6) * 255; } }
  return D;
}

/* 撮った写真（canvas）を、角 Q（無ければ自動で探す）で切り取ってまっすぐに直し、長い辺 1600 点・字を黒く紙を白く。
   先に切り取ってから縮めるので、紙が小さく写っていても細かさが残る。src・P は撮った後の［修正］で使う */
function clScanCv(c, Q){
  const w = c.width, h = c.height, x = c.getContext('2d', { willReadFrequently: true });
  const P = Q || clCorners(x, w, h), sd = x.getImageData(0, 0, w, h).data, dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  let W = w, H = h, map = (u, v) => [u * (w - 1), v * (h - 1)];
  if(P){ const [p0, p1, p2, p3] = P; W = Math.max(dist(p0, p1), dist(p3, p2)); H = Math.max(dist(p0, p3), dist(p1, p2));
    const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0], dx3 = p0[0] - p1[0] + p2[0] - p3[0], dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1], dy3 = p0[1] - p1[1] + p2[1] - p3[1], den = dx1 * dy2 - dx2 * dy1;
    const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0, hh = den ? (dx1 * dy3 - dx3 * dy1) / den : 0, a = p1[0] - p0[0] + g * p1[0], b = p3[0] - p0[0] + hh * p3[0], e = p1[1] - p0[1] + g * p1[1], f = p3[1] - p0[1] + hh * p3[1];
    map = (u, v) => { const z = g * u + hh * v + 1; return [(a * u + b * v + p0[0]) / z, (e * u + f * v + p0[1]) / z]; }; }
  const s = Math.min(1, 1600 / Math.max(W, H)); W = Math.max(1, Math.round(W * s)); H = Math.max(1, Math.round(H * s));
  const lum = n => 0.299 * sd[n * 4] + 0.587 * sd[n * 4 + 1] + 0.114 * sd[n * 4 + 2], G = new Float32Array(W * H);
  for(let j = 0; j < H; j++) for(let i = 0; i < W; i++){
    const [sx, sy] = map(W > 1 ? i / (W - 1) : 0, H > 1 ? j / (H - 1) : 0);
    const x0 = Math.max(0, Math.min(w - 2, Math.floor(sx))), y0 = Math.max(0, Math.min(h - 2, Math.floor(sy))), fx = Math.max(0, Math.min(1, sx - x0)), fy = Math.max(0, Math.min(1, sy - y0)), n = y0 * w + x0;
    G[j * W + i] = (lum(n) * (1 - fx) + lum(n + 1) * fx) * (1 - fy) + (lum(n + w) * (1 - fx) + lum(n + w + 1) * fx) * fy; }
  const D = clInk(G, W, H), o = document.createElement('canvas'); o.width = W; o.height = H; const ox = o.getContext('2d'), od = ox.createImageData(W, H);
  for(let i = 0; i < W * H; i++){ od.data[i * 4] = od.data[i * 4 + 1] = od.data[i * 4 + 2] = D[i]; od.data[i * 4 + 3] = 255; }
  ox.putImageData(od, 0, 0); return { w: W, h: H, url: o.toDataURL('image/jpeg', 0.8), src: c, P };
}

async function clScan(file){ const img=await new Promise((ok,ng)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ng(new Error('写真を読み込めません')); i.src=URL.createObjectURL(file); });
  const k=Math.min(1,3200/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement('canvas'); c.width=Math.round(img.naturalWidth*k); c.height=Math.round(img.naturalHeight*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(img.src); return clScanCv(c,null); } /* 切り取り・字を黒く紙を白くは clScanCv。POS の中のカメラで撮った時も同じ */
async function clScanPdf(sc){ await clLoadPdf(); const W=210, H=Math.round(W*sc.h/sc.w*10)/10; const pdf=new window.jspdf.jsPDF({unit:'mm',format:[W,H],orientation:H>=W?'p':'l'}); pdf.addImage(sc.url,'JPEG',0,0,W,H); return pdf.output('blob'); }

/* 撮る前に紙の4つの角に丸・自動で撮る・撮った後に角を修正（オーナー「アップルのようにスキャンは撮る前に合わせたら？」「角に丸をつけて角を検出はできない？」→ ア）。
   POS の画面の中にカメラの映像を出す。カメラを使えない端末・許可されなかった時は、今までどおり iPad のカメラ（［撮影］の中の入力欄）で撮る */
const CL_CAM_STILL = 1000; // 丸がこの時間（ミリ秒）同じ所にあれば自動で撮る

function clCamOk(){ return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && !clCamFlag().clCamNo; }

/* ［撮影］の label（中に入力欄）に付ける：カメラを使える時は POS の中のカメラ、使えない時は今までどおり入力欄 */
function clCamWire(lb, done){
  if(!lb || lb.dataset.cam) return; lb.dataset.cam = '1';
  lb.addEventListener('click', e => { if(!clCamOk()) return; e.preventDefault(); clCamOpen(done); });
}

/* 映像の上に丸を描く位置（映像は枠の中に収めて表示） */
function clCamFit(v, box){
  const bw = box.clientWidth, bh = box.clientHeight, vw = v.videoWidth || 1, vh = v.videoHeight || 1;
  const k = Math.min(bw / vw, bh / vh); return { k, ox: (bw - vw * k) / 2, oy: (bh - vh * k) / 2, bw, bh };
}

/* 4つの角に丸（見つからない時は何も出さない） */
function clCamDots(cv, Q, f){
  cv.width = f.bw; cv.height = f.bh; const x = cv.getContext('2d'); x.clearRect(0, 0, f.bw, f.bh); if(!Q) return;
  const c = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(); /* 丸は色の決まりの --brand（olive.css） */
  x.lineWidth = 4; x.strokeStyle = c;
  for(const [px, py] of Q){ x.beginPath(); x.arc(f.ox + px * f.k, f.oy + py * f.k, 16, 0, 7); x.globalAlpha = .35; x.fillStyle = c; x.fill(); x.globalAlpha = 1; x.stroke(); }
}

/* 4つの角がほとんど動いていないか（対角の 3% 以内） */
function clCamSame(A, B, w, h){
  if(!A || !B) return false; const t = Math.hypot(w, h) * 0.03;
  return A.every((p, i) => Math.hypot(p[0] - B[i][0], p[1] - B[i][1]) <= t);
}

/* 小さくした映像で角を探す（clCorners は 19_close_receipt.js） */
function clCamFind(v, sm){
  const vw = v.videoWidth, vh = v.videoHeight; if(!vw) return null;
  const k = 480 / Math.max(vw, vh); sm.width = Math.round(vw * k); sm.height = Math.round(vh * k);
  const x = sm.getContext('2d', { willReadFrequently: true }); x.drawImage(v, 0, 0, sm.width, sm.height);
  const P = clCorners(x, sm.width, sm.height); return P ? P.map(([px, py]) => [px / k, py / k]) : null;
}

/* POS の中のカメラ：丸が止まったら自動で撮る。シャッターでも撮れる。撮れたら done(写真の canvas, 角) */
async function clCamOpen(done){
  let st;
  try{ st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false }); }
  catch(e){ clCamFlag().clCamNo = true; await uiAlert('カメラを使えません。再度［撮影］を押すと、iPad のカメラで撮影します'); return; }
  const m = mkModal(56); m.innerHTML = `<div class="box clcam"><button type="button" class="xb dx" data-x aria-label="閉じる">×</button><div class="clcv"><video playsinline muted autoplay></video><canvas></canvas></div><div class="clcb"><button type="button" class="clsh" data-sh aria-label="撮影"></button></div></div>`;
  document.body.appendChild(m);
  const v = m.querySelector('video'), cv = m.querySelector('canvas'), box = m.querySelector('.clcv'), sm = document.createElement('canvas');
  let Q = null, still = 0, end = false;
  const stop = () => { end = true; st.getTracks().forEach(t => t.stop()); m.remove(); };
  const shot = () => {
    if(end || !v.videoWidth) return; const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); const q = Q; stop(); done(c, q);
  };
  m.querySelector('[data-x]').onclick = stop; m.querySelector('[data-sh]').onclick = shot;
  v.srcObject = st; try{ await v.play(); }catch(_){}
  const camTick = () => {
    if(end) return; let P = null; try{ P = clCamFind(v, sm); }catch(_){}
    const now = performance.now(); if(P && clCamSame(P, Q, v.videoWidth, v.videoHeight)){ if(!still) still = now; } else still = 0;
    Q = P; clCamDots(cv, Q, clCamFit(v, box));
    if(Q && still && now - still >= CL_CAM_STILL) return shot();
    setTimeout(camTick, 200);
  };
  camTick();
}

/* 撮った後の［修正］：写真の上の4つの丸を指で紙の角へ動かす → OK で切り取り直す。done(新しい角) */
function clCamFix(sc, done){
  const c = sc.src, w = c.width, h = c.height, P = (sc.P || [[w * .1, h * .1], [w * .9, h * .1], [w * .9, h * .9], [w * .1, h * .9]]).map(p => p.slice());
  const m = mkModal(58); m.innerHTML = `<div class="box clcam"><div class="clcv" style="touch-action:none"><canvas data-ph></canvas><canvas data-dt></canvas></div><div class="bar" style="justify-content:flex-end;padding:10px 12px;margin:0"><button class="ghost" data-c>キャンセル</button><button class="primary" data-ok>OK</button></div></div>`;
  document.body.appendChild(m);
  const box = m.querySelector('.clcv'), ph = m.querySelector('[data-ph]'), dt = m.querySelector('[data-dt]');
  const fit = () => { const bw = box.clientWidth, bh = box.clientHeight, k = Math.min(bw / w, bh / h); return { k, ox: (bw - w * k) / 2, oy: (bh - h * k) / 2, bw, bh }; };
  const draw = () => { const f = fit(); ph.width = f.bw; ph.height = f.bh; ph.getContext('2d').drawImage(c, f.ox, f.oy, w * f.k, h * f.k); clCamDots(dt, P, f); };
  let on = -1;
  const fixAt = e => { const r = box.getBoundingClientRect(), f = fit(); return [(e.clientX - r.left - f.ox) / f.k, (e.clientY - r.top - f.oy) / f.k]; };
  box.onpointerdown = e => { const [px, py] = fixAt(e), f = fit(); let best = 1e9; P.forEach(([qx, qy], i) => { const dd = Math.hypot(qx - px, qy - py) * f.k; if(dd < best){ best = dd; on = i; } }); if(best > 60) on = -1; else box.setPointerCapture(e.pointerId); };
  box.onpointermove = e => { if(on < 0) return; const [px, py] = fixAt(e); P[on] = [Math.max(0, Math.min(w - 1, px)), Math.max(0, Math.min(h - 1, py))]; clCamDots(dt, P, fit()); };
  box.onpointerup = box.onpointercancel = () => { on = -1; };
  m.querySelector('[data-c]').onclick = () => m.remove();
  m.querySelector('[data-ok]').onclick = () => { m.remove(); done(P); };
  requestAnimationFrame(draw);
}
