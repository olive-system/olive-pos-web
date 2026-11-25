/* 写真を送る前に小さくする（長い辺 1600・JPEG）。前は管理サイトとマイページに同じコピーがあった（07 の B4）。撮る・選ぶボタンの決まりはスキル olive-photo-shoot */
async function shrinkJpeg(file){ const img=await new Promise((ok,ng)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ng; i.src=URL.createObjectURL(file); });
  const k=Math.min(1,1600/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height); return await new Promise(ok=>c.toBlob(ok,'image/jpeg',0.85)); }
/* 紙の書類（従業者名簿・契約書・ヒアリングシート）は白と黒の2色にして軽くする（オーナー：グレーでは 7% しか小さくならず、2色にした。顔が写る本人確認書類とバストアップはカラーのまま）。
   影や明るさのむらがあっても字が残るように、1つずつ「まわりの明るさ」と比べて白か黒かを決める（まわりとの差が小さい所は白。暗い所のざらつきが黒い点になると重くなった）。
   白と黒だけの PNG（1点1ビット）で送る。JPEG はくっきりした線が苦手で、2色にするとカラーより重くなった。CompressionStream が無い古い端末はふつうの PNG */
const PAPER_KINDS=['roster','contract','sheet'];
const pngCrc=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; t[n]=c>>>0; } return u=>{ let c=0xffffffff; for(let i=0;i<u.length;i++) c=t[(c^u[i])&255]^(c>>>8); return (c^0xffffffff)>>>0; }; })();
async function png1bit(bits,w,h){ const rb=Math.ceil(w/8), raw=new Uint8Array((rb+1)*h);
  for(let y=0;y<h;y++) for(let q=0;q<w;q++) if(bits[y*w+q]) raw[y*(rb+1)+1+(q>>3)]|=0x80>>(q&7);
  const z=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const chunk=(type,data)=>{ const o=new Uint8Array(12+data.length), v=new DataView(o.buffer); v.setUint32(0,data.length); for(let i=0;i<4;i++) o[4+i]=type.charCodeAt(i); o.set(data,8); v.setUint32(8+data.length,pngCrc(o.subarray(4,8+data.length))); return o; };
  const hd=new Uint8Array(13), hv=new DataView(hd.buffer); hv.setUint32(0,w); hv.setUint32(4,h); hd[8]=1; hd[9]=0;
  return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',hd),chunk('IDAT',z),chunk('IEND',new Uint8Array(0))],{type:'image/png'}); }
async function shrinkPaper(file){ const img=await new Promise((ok,ng)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ng; i.src=URL.createObjectURL(file); });
  const k=Math.min(1,1600/Math.max(img.width,img.height)), c=document.createElement('canvas'), w=c.width=Math.round(img.width*k), h=c.height=Math.round(img.height*k), x=c.getContext('2d');
  x.drawImage(img,0,0,w,h); const d=x.getImageData(0,0,w,h), a=d.data, g=new Float64Array(w*h), S=new Float64Array((w+1)*(h+1)), r=Math.max(8,Math.round(Math.max(w,h)/50)), white=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++) g[i]=0.299*a[i*4]+0.587*a[i*4+1]+0.114*a[i*4+2];
  for(let y=0;y<h;y++){ let row=0; for(let q=0;q<w;q++){ row+=g[y*w+q]; S[(y+1)*(w+1)+q+1]=S[y*(w+1)+q+1]+row; } }
  for(let y=0;y<h;y++){ const y0=Math.max(0,y-r), y1=Math.min(h,y+r+1); for(let q=0;q<w;q++){ const x0=Math.max(0,q-r), x1=Math.min(w,q+r+1), i=y*w+q;
    const m=(S[y1*(w+1)+x1]-S[y0*(w+1)+x1]-S[y1*(w+1)+x0]+S[y0*(w+1)+x0])/((y1-y0)*(x1-x0)); white[i]=g[i]<m*0.85&&m-g[i]>16?0:1; } }
  if(typeof CompressionStream==='function') return await png1bit(white,w,h);
  for(let i=0;i<w*h;i++){ const v=white[i]?255:0; a[i*4]=a[i*4+1]=a[i*4+2]=v; } x.putImageData(d,0,0); return await new Promise(ok=>c.toBlob(ok,'image/png')); }
/* 書類の種類で縮め方を選ぶ（紙の書類は2色・ほかはカラー） */
const shrinkDoc=(kind,file)=>PAPER_KINDS.includes(kind)?shrinkPaper(file):shrinkJpeg(file);
/* 縮めた写真を data:image/…;base64,… の文字にする（ふつうの写真は jpeg・紙の書類は png）（データベースに置く写真。マイページの面接・POS の書類） */
const blob64=blob=>new Promise((ok,ng)=>{ const f=new FileReader(); f.onload=()=>ok(f.result); f.onerror=ng; f.readAsDataURL(blob); });
