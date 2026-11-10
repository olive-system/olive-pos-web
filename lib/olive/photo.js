/* 写真を送る前に小さくする（長い辺 1600・JPEG）。前は管理サイトとマイページに同じコピーがあった（07 の B4）。撮る・選ぶボタンの決まりはスキル olive-photo-shoot */
async function shrinkJpeg(file){ const img=await new Promise((ok,ng)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ng; i.src=URL.createObjectURL(file); });
  const k=Math.min(1,1600/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height); return await new Promise(ok=>c.toBlob(ok,'image/jpeg',0.85)); }
