// 始めの処理。全部のファイルを読んでから動かすので、いちばん最後に読み込む
kReg(EF);
if(EMB){ token=null; editTok=null; editExp=0; embAsk().then(d=>{ if(d&&d.token) start(); else { show('vLogin'); $('loginErr').textContent=d&&d.error||'顧客サイトを開けません'; } }); } else if(token){ keyDb('readwrite',s=>s.put(token,'olive_cs_token')); start(); } else keyDb('readonly',s=>s.get('olive_cs_token')).then(b=>{ if(b){ token=b; LS0.set('olive_cs_token',b); } start(); }); /* 片方の引き出しが空なら、もう片方から戻す */
