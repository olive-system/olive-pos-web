// ---------- 閉店作業 ② 入出金の領収書精算（撮影・白黒の PDF・読み取り・メール） ----------
// v12.75・SQL 390：② 入出金の「領収書精算」は撮影 → 白黒の PDF と読み取った金額の小窓 → OK で登録（オーナー 2026-11-07「領収書の写真をここでアップロード」「白黒のPDFがいい」「金額を自動で」）
// PDF は置き場 receipts の {店}/{入出金の id}.pdf。金額は Edge Function「receipt-read」が読む（読めない時は空のまま手で入れる）
const CL_RCPT='領収書精算', CL_RMAIL='領収書メールの送信';
let clJsPdf=null;
function clLoadPdf(){ if(window.jspdf) return Promise.resolve(); if(!clJsPdf) clJsPdf=new Promise((ok,ng)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'; s.onload=ok; s.onerror=()=>{ clJsPdf=null; ng(new Error('PDF の部品を読み込めません')); }; document.head.appendChild(s); }); return clJsPdf; }
// 書類のスキャンのように：長い辺 1600px・白黒・紙の地を白く
/* v12.76（オーナー 2026-11-07「周りの余計な部分もある。トリミングされてない」）：写真の中の白い紙（いちばん大きい明るいかたまり）の四隅を見つけて切り取り、まっすぐに直してから白黒にする。紙が見つからない時（白い机の上など）は写真のまま */
function clCorners(x,w,h){ const k=240/Math.max(w,h), sw=Math.max(8,Math.round(w*k)), sh=Math.max(8,Math.round(h*k)); const c=document.createElement('canvas'); c.width=sw; c.height=sh; const y=c.getContext('2d'); y.drawImage(x.canvas,0,0,sw,sh);
  const d=y.getImageData(0,0,sw,sh).data, N=sw*sh, L=new Uint8Array(N), hist=new Array(256).fill(0); for(let i=0;i<N;i++){ const r=d[i*4],g=d[i*4+1],b=d[i*4+2], mx=Math.max(r,g,b), l=Math.max(0,Math.min(255,Math.round(mx*(1-4*(mx-Math.min(r,g,b))/Math.max(1,mx))))); L[i]=l; hist[l]++; } /* 明るさだけで分けると、照明が当たった木目の机も紙に入って角がずれる → 色の無さ（明るさに対する色の割合）で分ける。影になった紙も色は無いので残る */
  let sum=0; for(let t=0;t<256;t++) sum+=t*hist[t]; let sB=0,wB=0,best=0,th=128; for(let t=0;t<256;t++){ wB+=hist[t]; if(!wB) continue; const wF=N-wB; if(!wF) break; sB+=t*hist[t]; const mB=sB/wB, mF=(sum-sB)/wF, v=wB*wF*(mB-mF)*(mB-mF); if(v>best){ best=v; th=t; } }
  const lab=new Int32Array(N).fill(-1), q=new Int32Array(N); let big=-1, bigN=0, bigE=0;
  for(let i=0;i<N;i++){ if(L[i]<=th||lab[i]>=0) continue; let hd=0,tl=0,e=0; q[tl++]=i; lab[i]=i; while(hd<tl){ const j=q[hd++], jx=j%sw, jy=(j-jx)/sw; if(!jx||!jy||jx===sw-1||jy===sh-1) e++; for(const n of [j-sw,j+sw,jx>0?j-1:-1,jx<sw-1?j+1:-1]){ if(n<0||n>=N||lab[n]>=0||L[n]<=th) continue; lab[n]=i; q[tl++]=n; } } if(tl>bigN){ bigN=tl; big=i; bigE=e; } }
  if(big>=0&&(bigE>=(sw+sh)*0.5||bigN>N*0.97)){ const E=clEdgeQuad(x,w,h); if(E) return E; } /* 明るい台：台と紙が1つのかたまりになり、写真のふちに広く付く → 紙のふちの線で探す */
  if(big<0||bigN<N*0.12||bigN>N*0.97) return null;
  let Q=clSides(lab,big,sw,sh,bigN); if(!Q){ let tl=null,tr=null,br=null,bl=null; for(let i=0;i<N;i++){ if(lab[i]!==big) continue; const px=i%sw, py=(i-px)/sw; if(!tl||px+py<tl[0]+tl[1]) tl=[px,py]; if(!br||px+py>br[0]+br[1]) br=[px,py]; if(!tr||px-py>tr[0]-tr[1]) tr=[px,py]; if(!bl||px-py<bl[0]-bl[1]) bl=[px,py]; } Q=[tl,tr,br,bl]; }
  return Q.map(([px,py])=>[(px+0.5)/k,(py+0.5)/k]); }
/* 明るい灰色の台（石・白っぽい机）の上の紙：台も紙も色が無く、影で紙の一部が台より暗くなるので、明るさでは分けられない（2026-11-12 銀座の 1,870円の領収書が台ごと PDF になった「トリミングがされてない」）。
   紙のふちのまっすぐな線を探し、4本の線で囲んだ四角のうち、4辺とも線がふちに沿って続いている一番大きなものを紙とする（中の表の罫線は紙より小さい・台の手前の線は紙の横の辺が続かない）。見つからない時は null */
function clEdgeQuad(x,w,h){ const k=400/Math.max(w,h), sw=Math.max(8,Math.round(w*k)), sh=Math.max(8,Math.round(h*k)), c=document.createElement('canvas'); c.width=sw; c.height=sh; const y=c.getContext('2d'); y.drawImage(x.canvas,0,0,sw,sh);
  const d=y.getImageData(0,0,sw,sh).data, N=sw*sh, G=new Float32Array(N), M=new Float32Array(N), A=new Float32Array(N); for(let i=0;i<N;i++) G[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  const at=(X,Y)=>G[Math.max(0,Math.min(sh-1,Y))*sw+Math.max(0,Math.min(sw-1,X))];
  for(let Y=0;Y<sh;Y++) for(let X=0;X<sw;X++){ const gx=at(X+1,Y-1)+2*at(X+1,Y)+at(X+1,Y+1)-at(X-1,Y-1)-2*at(X-1,Y)-at(X-1,Y+1), gy=at(X-1,Y+1)+2*at(X,Y+1)+at(X+1,Y+1)-at(X-1,Y-1)-2*at(X,Y-1)-at(X+1,Y-1), i=Y*sw+X; M[i]=Math.hypot(gx,gy); A[i]=Math.atan2(gy,gx); }
  const srt=Float32Array.from(M).sort(), thr=Math.max(40,srt[Math.floor(N*0.9)]), E=new Uint8Array(N); for(let i=0;i<N;i++) E[i]=M[i]>thr?1:0;
  const NT=180, R=Math.ceil(Math.hypot(sw,sh)), acc=new Int32Array(NT*(2*R+1)), cs=[], sn=[]; for(let t=0;t<NT;t++){ cs.push(Math.cos(t*Math.PI/NT)); sn.push(Math.sin(t*Math.PI/NT)); }
  for(let i=0;i<N;i++){ if(!E[i]) continue; const X=i%sw, Y=(i-X)/sw; let a=A[i]; if(a<0) a+=Math.PI; const t0=Math.round(a*NT/Math.PI); for(let dt=-6;dt<=6;dt++){ const t=((t0+dt)%NT+NT)%NT; acc[t*(2*R+1)+Math.round(X*cs[t]+Y*sn[t])+R]++; } }
  const pk=[]; for(let t=0;t<NT;t++) for(let r=0;r<2*R+1;r++){ const v=acc[t*(2*R+1)+r]; if(v<Math.min(sw,sh)*0.15) continue; let mx=true; for(let dt=-3;dt<=3&&mx;dt++) for(let dr=-4;dr<=4;dr++){ if(!dt&&!dr) continue; const tt=t+dt, rr=r+dr; const T=(tt+NT)%NT, RR=tt<0||tt>=NT?2*R-rr:rr; if(RR<0||RR>2*R) continue; const u=acc[T*(2*R+1)+RR]; if(u>v||(u===v&&(dt<0||(!dt&&dr<0)))){ mx=false; break; } } if(mx) pk.push({t,r:r-R,v}); }
  pk.sort((a,b)=>b.v-a.v); const Lk=pk.slice(0,40);
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
async function clScan(file){ const img=await new Promise((ok,ng)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ng(new Error('写真を読み込めません')); i.src=URL.createObjectURL(file); });
  const k=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)), w=Math.round(img.naturalWidth*k), h=Math.round(img.naturalHeight*k);
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.drawImage(img,0,0,w,h); URL.revokeObjectURL(img.src);
  const sd=x.getImageData(0,0,w,h).data, L=new Float32Array(w*h); for(let i=0;i<w*h;i++) L[i]=0.299*sd[i*4]+0.587*sd[i*4+1]+0.114*sd[i*4+2];
  const P=clCorners(x,w,h), dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
  let W=w, Hh=h, map=(u,v)=>[u*(w-1),v*(h-1)];
  if(P){ const [p0,p1,p2,p3]=P; W=Math.round(Math.max(dist(p0,p1),dist(p3,p2))); Hh=Math.round(Math.max(dist(p0,p3),dist(p1,p2))); const s=Math.min(1,1600/Math.max(W,Hh)); W=Math.max(1,Math.round(W*s)); Hh=Math.max(1,Math.round(Hh*s));
    const dx1=p1[0]-p2[0], dx2=p3[0]-p2[0], dx3=p0[0]-p1[0]+p2[0]-p3[0], dy1=p1[1]-p2[1], dy2=p3[1]-p2[1], dy3=p0[1]-p1[1]+p2[1]-p3[1], den=dx1*dy2-dx2*dy1;
    const g=den?(dx3*dy2-dx2*dy3)/den:0, hh=den?(dx1*dy3-dx3*dy1)/den:0, a=p1[0]-p0[0]+g*p1[0], b=p3[0]-p0[0]+hh*p3[0], e=p1[1]-p0[1]+g*p1[1], f=p3[1]-p0[1]+hh*p3[1];
    map=(u,v)=>{ const z=g*u+hh*v+1; return [(a*u+b*v+p0[0])/z,(e*u+f*v+p0[1])/z]; }; }
  const o=document.createElement('canvas'); o.width=W; o.height=Hh; const ox=o.getContext('2d'), od=ox.createImageData(W,Hh), a2=od.data;
  for(let j=0;j<Hh;j++) for(let i=0;i<W;i++){ const [sx,sy]=map(W>1?i/(W-1):0,Hh>1?j/(Hh-1):0); const x0=Math.max(0,Math.min(w-2,Math.floor(sx))), y0=Math.max(0,Math.min(h-2,Math.floor(sy))), fx=Math.max(0,Math.min(1,sx-x0)), fy=Math.max(0,Math.min(1,sy-y0)), n=y0*w+x0;
    const l=(L[n]*(1-fx)+L[n+1]*fx)*(1-fy)+(L[n+w]*(1-fx)+L[n+w+1]*fx)*fy, v=Math.max(0,Math.min(255,(l-110)*1.9+128)), q=(j*W+i)*4; a2[q]=a2[q+1]=a2[q+2]=v; a2[q+3]=255; }
  ox.putImageData(od,0,0); return {w:W,h:Hh,url:o.toDataURL('image/jpeg',0.72)}; }
async function clScanPdf(sc){ await clLoadPdf(); const W=210, H=Math.round(W*sc.h/sc.w*10)/10; const pdf=new window.jspdf.jsPDF({unit:'mm',format:[W,H],orientation:H>=W?'p':'l'}); pdf.addImage(sc.url,'JPEG',0,0,W,H); return pdf.output('blob'); }
// v12.82・SQL 400：精算の手引きの項目を確かめる（オーナー 2026-11-08「宛名・日付・軽減税率・但し書き・発行店名・電話番号・登録番号・飲食の参加者・自分の名前・鮮明さ」）
// ・receipt-read が全部の項目を読み、合っているかはここで決める。不備が1つでもあると OK を押せない
// ・不備の項目はその場で入力して修正できる（入力できたら通す）。登録番号が無い時は［確認］→ 理由のコメントで通す。不鮮明の時は再撮影だけ（入力欄は出さない）
// ・立替者名（右下の手書きの名前）は cash_movements.payer に入れ、② の一覧に出す。確かめた中身は receipt_check
// ・登録番号を国税庁の公表サイトで照らすのは、アプリケーション ID が届いてから（今は T と13桁の形だけ）
// v12.86：レシート（宛名の欄が無いもの）は宛名を見ない（オーナー 2026-11-08「レシートには宛名は入っていません」）
// v12.90：立替者名は紙に書かないので、写真の写りに関係なく、その日に出勤した黒服のプルダウンから選ぶ（オーナー 2026-11-08「建て替え者はレシートに記入しない」「出勤している黒服で」）
const CL_RK=[['to','宛名'],['date','日付'],['reduced','軽減税率'],['purpose','但し書き'],['issuer','発行店名'],['tel','電話番号'],['inv','登録番号'],['guests','参加者名'],['payer','立替者名'],['clear','鮮明度']];
const clInvOk=v=>/^T\d{13}$/.test(v);
async function clPayers(d){ if(!staffAll.length) await loadStaffAll(); const r=await sb.from('attendance_events').select('staff_id').eq('store_id',store.id).eq('business_date',d).in('event_type',['clock_in','douhan']); if(r.error) return null; const on=new Set((r.data||[]).map(e=>e.staff_id)); return staffAll.filter(s=>s.kind==='hall'&&on.has(s.id)); }
// AI に送る写真は小さくする（送る量と AI が読む量が減り、待ち時間が短くなる。オーナー 2026-11-08「イ」）。保存する PDF は元の大きさのまま。細長いレシートの字がつぶれないよう、長辺ではなく面積（60万画素）で縮める
async function clSmall(url){ const i=new Image(); await new Promise((ok,ng)=>{ i.onload=ok; i.onerror=ng; i.src=url; }); const k=Math.min(1,Math.sqrt(600000/(i.naturalWidth*i.naturalHeight))); if(k>=1) return url; const c=document.createElement('canvas'); c.width=Math.round(i.naturalWidth*k); c.height=Math.round(i.naturalHeight*k); c.getContext('2d').drawImage(i,0,0,c.width,c.height); return c.toDataURL('image/jpeg',0.8); }
async function clRead(url){ try{ const r=await sb.functions.invoke('receipt-read',{body:{image:(await clSmall(url)).split(',')[1]}}); if(r.error) return null; const n=Number(r.data?.amount); return {amount:Number.isFinite(n)&&n>0?Math.round(n):null,read:r.data?.read||null}; }catch(_){ return null; } }
// 読み取った中身 → 項目ごとの {v:表示, ng:不備}。読めなかった時（r が null）は鮮明度だけ「未確認」で通し、ほかは入力
function clCheck(r){ const s=x=>String(x??'').trim(), X={};
  const to=s(r?.addressee); X.to=r?.doc==='レシート'?{v:'レシート',ok:true}:{v:to,ok:/OLIVE/i.test(to.normalize('NFKC').replace(/\s/g,''))};
  const dt=s(r?.date); X.date={v:dt.replace(/-/g,'/'),ok:!!dt};
  const rd=s(r?.reduced); X.reduced={v:rd==='記載あり'?'※ 8%対象':rd==='対象なし'?'対象なし':'',ok:rd==='記載あり'||rd==='対象なし'};
  const pp=s(r?.purpose), pc=r?.purpose_clear!==false; X.purpose={v:pp&&!pc?pp+'（用途不明）':pp,ok:!!pp&&pc};
  X.issuer={v:s(r?.issuer),ok:!!s(r?.issuer)}; X.tel={v:s(r?.tel),ok:!!s(r?.tel)};
  const iv=s(r?.invoice_no); X.inv={v:iv,ok:clInvOk(iv)};
  X.guests=r&&!r.eating?{v:'飲食以外',ok:true}:{v:s(r?.guests),ok:!!s(r?.guests)};
  X.payer={v:'',ok:false};
  X.clear=r?{v:r.clear?'良好':'不鮮明',ok:!!r.clear}:{v:'未確認',ok:true};
  for(const k in X){ X[k].ng=!X[k].ok; delete X[k].ok; } return X; }
const clMark=ng=>ng?'<span class="ngt">不備</span>':'<span class="okm">✓</span>';
async function clRcptShot(file,d){ let sc; try{ sc=await clScan(file); }catch(e){ await uiAlert('撮影した写真を読み込めません：'+(e.message||'')); return; }
  const m=mkModal(55); /* 入力した黒服の小窓（uiDlg・60）が上に出るように */
  m.innerHTML=`<div class="box clrc" style="width:min(860px,96vw)"><div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(CL_RCPT)}</div>
    <div style="display:flex;gap:16px;align-items:flex-start"><div data-im style="flex:none;width:min(360px,42vw);height:min(540px,60vh);border:1px solid var(--line);border-radius:8px;background:#fff;overflow:hidden"></div>
    <div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--line)"><span>金額</span><input data-a type="number" inputmode="numeric" placeholder="読み取り中…" style="width:150px;text-align:right"></div><div data-ck></div></div></div>
    <div class="bar" style="justify-content:flex-end;margin-top:12px"><label class="cllb g" data-re>再撮影<input type="file" accept="image/*" capture="environment" style="display:none"></label><button class="ghost" data-c>キャンセル</button><button class="primary" data-ok disabled>OK</button></div></div>`;
  document.body.appendChild(m); const A=m.querySelector('[data-a]'), CK=m.querySelector('[data-ck]'), OK=m.querySelector('[data-ok]'), RE=m.querySelector('[data-re]'); let X=null, PY=[];
  clPayers(d).then(L=>{ if(!L){ uiAlert(RDERR_T); return; } PY=L; if(X) draw(); });
  const can=()=>{ OK.disabled=!(X&&CL_RK.every(([k])=>!X[k].ng)&&clNum(A.value)>0); RE.className='cllb '+(X&&CL_RK.some(([k])=>X[k].ng)?'p':'g'); }; /* 不備がある時は再撮影を主ボタンの色に */
  const draw=()=>{ if(!X){ CK.innerHTML=CL_RK.map(([,n])=>`<div class="r"><span class="k">${n}</span><span class="v muted">読み取り中…</span><span class="s"></span></div>`).join(''); can(); return; }
    const blur=X.clear.ng;
    CK.innerHTML=CL_RK.map(([k,n])=>{ const x=X[k], inp=!blur&&k!=='clear'&&(x.ng||x.typed);
      const v=k==='payer'?`<select data-py${x.ng?' class="ng"':''}><option value="">選択</option>${PY.map(p=>`<option${p.display_name===x.v?' selected':''}>${esc(p.display_name)}</option>`).join('')}</select>`:k==='inv'&&x.note?`<span>記載なし</span><small class="muted">${esc(x.note)}</small>`:inp?`<input data-in="${k}" value="${esc(x.typed?x.v:'')}" placeholder="${esc(x.v||'記載なし')}"${x.ng?' class="ng"':''}>${k==='inv'?`<button class="ghost sm" data-cf${x.ng?'':' style="display:none"'}>確認</button>`:''}`:`<span${x.ng?' class="ngt"':''}>${esc(x.v||'記載なし')}</span>`;
      return `<div class="r"><span class="k">${n}</span><span class="v">${v}</span><span class="s">${clMark(x.ng)}</span></div>`; }).join('');
    CK.querySelectorAll('[data-in]').forEach(i=>i.oninput=()=>{ const k=i.dataset.in, x=X[k]; x.v=k==='inv'?i.value.trim().toUpperCase():i.value.trim(); x.typed=true; x.ng=k==='inv'?!clInvOk(x.v):!x.v; i.classList.toggle('ng',x.ng); i.closest('.r').querySelector('.s').innerHTML=clMark(x.ng); const cf=i.parentNode.querySelector('[data-cf]'); if(cf) cf.style.display=x.ng?'':'none'; can(); });
    const py=CK.querySelector('[data-py]'); if(py) py.onchange=()=>{ Object.assign(X.payer,{v:py.value,ng:!py.value,typed:true}); py.classList.toggle('ng',X.payer.ng); py.closest('.r').querySelector('.s').innerHTML=clMark(X.payer.ng); can(); };
    const cf=CK.querySelector('[data-cf]'); if(cf) cf.onclick=async()=>{ const w=await uiDlg('登録番号の記載がない理由を入力してください',true,'','理由を入力してください'); if(w===null) return; if(!w.trim()){ toast('理由を入力してください'); return; } Object.assign(X.inv,{v:'',note:w.trim(),ng:false,typed:false}); draw(); };
    can(); };
  const show=s=>{ sc=s; /* v12.76（オーナー「PDF 化になってるかもわからない」）：できあがった PDF をそのまま表示（OK で保存するのもこの PDF）。PDF を表示できない端末では同じ中身の写真 */ const fr=m.querySelector('[data-im]'), im=`<img src="${s.url}" style="display:block;width:100%;height:100%;object-fit:contain">`; fr.innerHTML=im; s.pdf=clScanPdf(s); s.pdf.then(bl=>{ if(sc!==s||!document.body.contains(m)) return; if(fr.dataset.u) URL.revokeObjectURL(fr.dataset.u); fr.dataset.u=URL.createObjectURL(bl); fr.innerHTML=`<object data="${fr.dataset.u}" type="application/pdf" style="width:100%;height:100%">${im}</object>`; }).catch(e=>{ if(sc===s) uiAlert('PDF を作成できません：'+(e.message||'')); });
    A.value=''; A.placeholder='読み取り中…'; X=null; draw(); const me=s; clRead(s.url).then(q=>{ if(sc!==me||!document.body.contains(m)) return; A.placeholder='金額'; X=clCheck(q?.read); if(q?.amount!=null&&!A.value) A.value=q.amount; draw(); if(!q?.read) toast('領収書を読み取れませんでした。項目を入力してください'); }); };
  A.oninput=can; show(sc); m.querySelector('[data-c]').onclick=()=>{ const u=m.querySelector('[data-im]').dataset.u; if(u) URL.revokeObjectURL(u); m.remove(); };
  const ri=RE.querySelector('input'); ri.onchange=async()=>{ const f=ri.files&&ri.files[0]; ri.value=''; if(!f) return; try{ show(await clScan(f)); }catch(e){ await uiAlert('撮影した写真を読み込めません：'+(e.message||'')); } };
  OK.onclick=guard(OK,async()=>{ const amount=clNum(A.value); if(!amount){ toast('金額を入力してください'); A.focus(); return; } if(!X||CL_RK.some(([k])=>X[k].ng)) return; if(await askBy()===null) return;
    let blob; try{ blob=await (sc.pdf||clScanPdf(sc)); }catch(e){ await uiAlert('PDF を作成できません：'+(e.message||'')); return; }
    const chk={}; for(const [k] of CL_RK) chk[k]={v:X[k].v,...(X[k].typed?{typed:true}:{}),...(X[k].note?{note:X[k].note}:{})};
    const id=crypto.randomUUID(), path=`${store.id}/${id}.pdf`; const up=await sb.storage.from('receipts').upload(path,blob,{contentType:'application/pdf',upsert:false}); if(up.error){ await uiAlert('領収書を保存できません：'+up.error.message); return; }
    const r=await sb.rpc('pos_rows_add',{p_table:'cash_movements',p:{id,store_id:store.id,business_date:d,kind:'out',amount,memo:CL_RCPT,receipt_path:path,payer:X.payer.v||null,receipt_check:chk}}); if(r.error){ await sb.storage.from('receipts').remove([path]); await uiAlert('登録できません：'+r.error.message); return; }
    await logOp('レジ出金の登録',{date:d,amount,memo:CL_RCPT,receipt:true,payer:X.payer.v||null},null,true); m.remove(); renderClosing(); }); }
// v12.82：② 入出金の登録の完了（オーナー 2026-11-08「お客様登録は内海 01:08 完了と書いてある。こんな感じで、誰が完了させたのかを書こう」）
// ① と同じ形：確認者を選んで［完了］→ 見出しの下に「内海 01:08 完了」。記録は pos_audit_log の「入出金の登録の完了」（detail：business_date・by）。完了の後に登録が増えたら［完了］に戻る
const CL_MVD='入出金の登録の完了';
async function clMvRender(d,moves,saved){ const top=$('clMvTop'), el=$('clMvDone'); if(!top||!el) return;
  const lg=await sb.from('pos_audit_log').select('created_at,detail').eq('store_id',store.id).eq('action',CL_MVD).eq('detail->>business_date',d).order('created_at',{ascending:false}).limit(1); if(!$('clMvDone')||clDate!==d) return; if(lg.error){ el.innerHTML=RDERR; return; }
  const last=(lg.data||[])[0], done=last&&!(moves||[]).some(m=>m.created_at>last.created_at);
  top.innerHTML=done?`<div style="font-size:16px;font-variant-numeric:tabular-nums;margin-bottom:6px">${esc(last.detail?.by||'')}　<small class="muted">${hmJst(last.created_at)}</small>　完了</div>`:'';
  if(done||saved){ el.innerHTML=''; return; }
  const who=staffAll.filter(s=>s.is_active&&(s.kind==='hall'||(s.kakari_only&&s.display_name!=='店')));
  el.innerHTML=`<div style="display:flex;gap:10px;align-items:center;margin-top:8px"><select id="clMvWho" style="width:auto;min-width:0"><option value="">確認者</option>${who.map(s=>`<option value="${esc(s.display_name)}">${esc(s.display_name)}</option>`).join('')}</select><button class="primary sm" id="clMvOk" disabled>完了</button></div>`;
  $('clMvWho').onchange=()=>{ $('clMvOk').disabled=!$('clMvWho').value; };
  $('clMvOk').onclick=guard($('clMvOk'),async()=>{ const by=$('clMvWho').value; if(!by) return; await logOp(CL_MVD,{business_date:d,by},null,true); toast('完了しました'); clMvRender(d,moves,saved); }); }
// 一覧の書類のしるし：PDF を大きく表示
async function clRcptView(mv){ if(!mv?.receipt_path) return; const s=await sb.storage.from('receipts').createSignedUrl(mv.receipt_path,600); if(s.error||!s.data?.signedUrl){ await uiAlert('表示できません：'+(s.error?.message||'')); return; }
  const m=mkModal(60); m.innerHTML=`<div class="box" style="width:min(620px,94vw)"><button class="xb dx" data-x aria-label="閉じる">×</button><div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(mv.memo||'')}　${yen(mv.amount)}</div><iframe src="${esc(s.data.signedUrl)}" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:8px;background:#fff"></iframe></div>`;
  document.body.appendChild(m); m.querySelector('[data-x]').onclick=()=>m.remove(); }
// ③ 領収書メール（v12.75・オーナー 2026-11-07「入出金の登録と領収書のメールを分ける」「何件あるのかだけ、1行とか2行で」）
// 確認者を選んで［メール送信］→ ショートカット「領収書メール」が直接動き、宛先・件名・PDF の入ったメールの画面を開く → 送信を押すだけ（オーナー 2026-11-12「ボタンを押すとメールアプリが立ち上がり、タイトルと PDF が自動で添付されて、送信ボタンを押すだけ」）
// 前は iPad の共有の画面からショートカットを選ぶ形で、スタッフが「メール」を選ぶと件名が空・mail.txt が付いたまま届いた（2026-11-12 銀座）。共有の画面を出さないよう、shortcuts:// でショートカットを名前で呼ぶ。渡す文は 1行目＝宛先〔管理サイト「領収書メールの宛先」〕・2行目＝件名・3行目＝PDF の期限つきリンク（空白で区切る）。ショートカットがリンクから PDF を読み込んで付ける（iPad ごとに最初の1回だけ「送ってよいか」が出るので「常に許可」）
// 送信の後は ① と同じ形で「確認者 時刻 送信」（メールアプリで送信まで済んだかは POS ではわからないので、ショートカットを開いた記録）
function clGo(u){ location.href=u; } // テストで差しかえる
async function clRcptRender(d,moves){ const el=$('clRcpt'); if(!el) return; const R=(moves||[]).filter(m=>m.receipt_path);
  if(!R.length){ el.innerHTML='<div class="muted">領収書なし</div>'; return; }
  const lg=await sb.from('pos_audit_log').select('created_at,detail').eq('store_id',store.id).eq('action',CL_RMAIL).eq('detail->>business_date',d).order('created_at',{ascending:false}).limit(1); if(!$('clRcpt')||clDate!==d) return; if(lg.error){ el.innerHTML=RDERR; return; }
  const last=(lg.data||[])[0], sent=new Set(last?.detail?.ids||[]), done=last&&R.every(m=>sent.has(m.id)), N=`<span style="width:96px;flex:none">領収書 ${R.length}件</span>`;
  const links=Promise.all(R.map(async m=>{ const u=await sb.storage.from('receipts').createSignedUrl(m.receipt_path,86400,{download:`${d}_${CL_RCPT}_${m.amount}円.pdf`}); if(u.error||!u.data?.signedUrl) throw new Error(u.error?.message||'領収書を読み込めません'); return u.data.signedUrl; })); links.catch(()=>{}); /* 押した時にすぐ開けるよう先に作る（待ってから開くと端末に止められることがある） */
  const who=staffAll.filter(s=>s.is_active&&(s.kind==='hall'||(s.kakari_only&&s.display_name!=='店')));
  el.innerHTML=done?`<div style="display:flex;gap:10px;align-items:center;font-size:16px;font-variant-numeric:tabular-nums">${N}${esc(last.detail?.by||'')}　<small class="muted">${hmJst(last.created_at)}</small>　送信<button class="ghost sm" id="clRcptAgain" style="margin-left:8px">再送信</button></div>`
    :`<div style="display:flex;gap:10px;align-items:center;font-size:16px">${N}<select id="clRcptWho" style="width:auto;min-width:0"><option value="">確認者</option>${who.map(s=>`<option value="${esc(s.display_name)}">${esc(s.display_name)}</option>`).join('')}</select><button class="primary sm" id="clRcptSend" disabled>メール送信</button></div>`;
  const send=async by=>{ const to=String(settings?.receipt_mail_to||'').trim(); if(!to){ await uiAlert('領収書メールの宛先がありません\n管理サイトの POS設定「店の情報」で入力してください'); return; }
    let U; try{ U=await links; }catch(e){ await uiAlert('領収書を読み込めません：'+(e.message||'')); return; }
    const subject=`【${store?.name||''}】現金払い（名前→${by}）`;
    clGo('shortcuts://run-shortcut?name='+encodeURIComponent('領収書メール')+'&input=text&text='+encodeURIComponent(`${to}\n${subject}\n${U.join(' ')}`));
    await logOp(CL_RMAIL,{business_date:d,by,count:R.length,ids:R.map(m=>m.id)},null,true); clRcptRender(d,moves); };
  if($('clRcptWho')){ $('clRcptWho').onchange=()=>{ $('clRcptSend').disabled=!$('clRcptWho').value; }; $('clRcptSend').onclick=()=>send($('clRcptWho').value); }
  if($('clRcptAgain')) $('clRcptAgain').onclick=()=>send(last.detail?.by||''); }
