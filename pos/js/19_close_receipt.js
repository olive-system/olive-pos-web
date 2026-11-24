// ---------- 閉店作業 ② 入出金の領収書精算（撮影・白黒の PDF・読み取り・メール） ----------
// ② 入出金の「領収書精算」は撮影 → 白黒の PDF と読み取った金額の小窓 → OK で登録（オーナー「領収書の写真をここでアップロード」「白黒のPDFがいい」「金額を自動で」）
// PDF は置き場 receipts の {店}/{入出金の id}.pdf。金額は Edge Function「receipt-read」が読む（読めない時は空のまま手で入れる）
const CL_RCPT='領収書精算', CL_RCPT_SC='領収書精算（スカウト料）', CL_RMAIL='領収書メールの送信'; /* スカウト料はオーナーの言葉のまま。撮影の流れは領収書精算と同じで、名前だけ分けて人件費に入れる（SQL 696） */
const clRcptMemo=()=>$('clMemoSel')?.value===CL_RCPT_SC?CL_RCPT_SC:CL_RCPT;
// 精算の手引きの項目を確かめる（オーナー「宛名・日付・軽減税率・但し書き・発行店名・電話番号・登録番号・飲食の参加者・自分の名前・鮮明さ」）
// ・receipt-read が全部の項目を読み、合っているかはここで決める。不備が1つでもあると OK を押せない
// ・不備の項目はその場で入力して修正できる（入力できたら通す）。登録番号が無い時は［記載なし］を押すだけで通す（理由は聞かない。住所・電話番号が無い時は今までどおり通さない）。不鮮明の時は再撮影だけ（入力欄は出さない）
// ・立替者名（右下の手書きの名前）は cash_movements.payer に入れ、② の一覧に出す。確かめた中身は receipt_check
// ・登録番号を国税庁の公表サイトで照らすのは、アプリケーション ID が届いてから（今は T と13桁の形だけ）
// レシート（宛名の欄が無いもの）は宛名を見ない（オーナー「レシートには宛名は入っていません」）
// 立替者名は紙に書かないので、写真の写りに関係なく、その日に出勤した黒服のプルダウンから選ぶ（オーナー「建て替え者はレシートに記入しない」「出勤している黒服で」）
const CL_RK=[['to','宛名'],['date','日付'],['reduced','軽減税率'],['purpose','但し書き'],['issuer','発行店名'],['tel','電話番号'],['inv','登録番号'],['guests','参加者名'],['payer','立替者名'],['clear','鮮明度']];
const clInvOk=v=>/^T\d{13}$/.test(v);
const clNoInv=m=>{ const v=m&&m.receipt_check&&m.receipt_check.inv; return !!v&&(!!v.none||!!v.note); }; /* ② の一覧に出す「記載なし」の印（前の形の理由つきも同じ） */
async function clPayers(d){ if(!S.staffAll.length) await loadStaffAll(); const r=await sb.from('attendance_events').select('staff_id').eq('store_id',S.store.id).eq('business_date',d).in('event_type',['clock_in','douhan']); if(r.error) return null; const on=new Set((r.data||[]).map(e=>e.staff_id)); return S.staffAll.filter(s=>s.kind==='hall'&&on.has(s.id)); }
// AI に送る写真は小さくする（送る量と AI が読む量が減り、待ち時間が短くなる。オーナー「イ」）。保存する PDF は元の大きさのまま。細長いレシートの字がつぶれないよう、長辺ではなく面積（60万画素）で縮める
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
// 領収書の小窓の文（写真・金額・読み取った中身・再撮影・キャンセル・OK）
function clRcptBox(){
  return `<div class="box clrc" style="width:min(860px,96vw)"><div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(clRcptMemo())}</div>
    <div style="display:flex;gap:16px;align-items:flex-start"><div data-im style="flex:none;width:min(360px,42vw);height:min(540px,60vh);border:1px solid var(--line);border-radius:8px;background:#fff;overflow:hidden"></div>
    <div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--line)"><span>金額</span><input data-a type="number" inputmode="numeric" placeholder="読み取り中…" style="width:150px;text-align:right"></div><div data-ck></div></div></div>
    <div class="bar" style="justify-content:flex-end;margin-top:12px"><label class="cllb g" data-re>再撮影<input type="file" accept="image/*" capture="environment" style="display:none"></label><button class="ghost" data-fx>修正</button><button class="ghost" data-c>キャンセル</button><button class="primary" data-ok disabled>OK</button></div></div>`;
}
// 読み取った中身の行（宛名・日付・登録番号など。不備は入れ直せる）
function clRcptRows(X,PY,blur){
  return CL_RK.map(([k,n])=>{ const x=X[k], inp=!blur&&k!=='clear'&&(x.ng||x.typed);
      const v=k==='payer'?`<select data-py${x.ng?' class="ng"':''}><option value="">選択</option>${PY.map(p=>`<option${p.display_name===x.v?' selected':''}>${esc(p.display_name)}</option>`).join('')}</select>`:k==='inv'&&x.none?`<span>記載なし</span>`:inp?`<input data-in="${k}" value="${esc(x.typed?x.v:'')}" placeholder="${esc(x.v||'記載なし')}"${x.ng?' class="ng"':''}>${k==='inv'?`<button class="ghost sm" data-cf${x.ng?'':' style="display:none"'}>記載なし</button>`:''}`:`<span${x.ng?' class="ngt"':''}>${esc(x.v||'記載なし')}</span>`;
      return `<div class="r"><span class="k">${n}</span><span class="v">${v}</span><span class="s">${clMark(x.ng)}</span></div>`; }).join('');
}
// 行の入れ直し・支払った人・登録番号の記載なし
function clRcptRowWire(CK,X,can,draw){
  CK.querySelectorAll('[data-in]').forEach(i=>i.oninput=()=>{ const k=i.dataset.in, x=X[k]; x.v=k==='inv'?i.value.trim().toUpperCase():i.value.trim(); x.typed=true; x.ng=k==='inv'?!clInvOk(x.v):!x.v; i.classList.toggle('ng',x.ng); i.closest('.r').querySelector('.s').innerHTML=clMark(x.ng); const cf=i.parentNode.querySelector('[data-cf]'); if(cf) cf.style.display=x.ng?'':'none'; can(); });
  const py=CK.querySelector('[data-py]'); if(py) py.onchange=()=>{ Object.assign(X.payer,{v:py.value,ng:!py.value,typed:true}); py.classList.toggle('ng',X.payer.ng); py.closest('.r').querySelector('.s').innerHTML=clMark(X.payer.ng); can(); };
  const cf=CK.querySelector('[data-cf]'); if(cf) cf.onclick=()=>{ Object.assign(X.inv,{v:'',none:true,ng:false,typed:false}); draw(); }; /* 押すだけで「記載なし」で通す（オーナー） */
}
// OK：PDF を作って保存し、レジ出金に登録する
async function clRcptSave(m,d,sc,X,amount){
    let blob; try{ blob=await (sc.pdf||clScanPdf(sc)); }catch(e){ await uiAlert('PDF を作成できません：'+(e.message||'')); return; }
    const chk={}; for(const [k] of CL_RK) chk[k]={v:X[k].v,...(X[k].typed?{typed:true}:{}),...(X[k].none?{none:true}:{})};
    const id=crypto.randomUUID(), path=`${S.store.id}/${id}.pdf`; const up=await sb.storage.from('receipts').upload(path,blob,{contentType:'application/pdf',upsert:false}); if(up.error){ await uiAlert('領収書を保存できません：'+up.error.message); return; }
    const r=await sb.rpc('pos_rows_add',{p_table:'cash_movements',p:{id,store_id:S.store.id,business_date:d,kind:'out',amount,memo:clRcptMemo(),receipt_path:path,payer:X.payer.v||null,receipt_check:chk}}); if(r.error){ await sb.storage.from('receipts').remove([path]); await uiAlert('登録できません：'+r.error.message); return; }
    await logOp('レジ出金の登録',{date:d,amount,memo:clRcptMemo(),receipt:true,payer:X.payer.v||null},null,true); m.remove(); renderClosing();
}
async function clRcptShot(file,d){ let sc; try{ sc=file instanceof Blob?await clScan(file):file; }catch(e){ await uiAlert('撮影した写真を読み込めません：'+(e.message||'')); return; } /* file は写真、または POS の中のカメラで撮って切り取った物（clScanCv の結果） */
  const m=mkModal(55); /* 入力した黒服の小窓（uiDlg・60）が上に出るように */
  m.innerHTML=clRcptBox();
  document.body.appendChild(m); const A=m.querySelector('[data-a]'), CK=m.querySelector('[data-ck]'), OK=m.querySelector('[data-ok]'), RE=m.querySelector('[data-re]'); let X=null, PY=[];
  clPayers(d).then(L=>{ if(!L){ uiAlert(RDERR_T); return; } PY=L; if(X) draw(); });
  const can=()=>{ OK.disabled=!(X&&CL_RK.every(([k])=>!X[k].ng)&&clNum(A.value)>0); RE.className='cllb '+(X&&CL_RK.some(([k])=>X[k].ng)?'p':'g'); }; /* 不備がある時は再撮影を主ボタンの色に */
  const draw=()=>{ if(!X){ CK.innerHTML=CL_RK.map(([,n])=>`<div class="r"><span class="k">${n}</span><span class="v muted">読み取り中…</span><span class="s"></span></div>`).join(''); can(); return; }
    const blur=X.clear.ng;
    CK.innerHTML=clRcptRows(X,PY,blur);
    clRcptRowWire(CK,X,can,draw);
    can(); };
  const show=s=>{ sc=s; /* （オーナー「PDF 化になってるかもわからない」）：できあがった PDF をそのまま表示（OK で保存するのもこの PDF）。PDF を表示できない端末では同じ中身の写真 */ const fr=m.querySelector('[data-im]'), im=`<img src="${s.url}" style="display:block;width:100%;height:100%;object-fit:contain">`; fr.innerHTML=im; s.pdf=clScanPdf(s); s.pdf.then(bl=>{ if(sc!==s||!document.body.contains(m)) return; if(fr.dataset.u) URL.revokeObjectURL(fr.dataset.u); fr.dataset.u=URL.createObjectURL(bl); fr.innerHTML=`<object data="${fr.dataset.u}" type="application/pdf" style="width:100%;height:100%">${im}</object>`; }).catch(e=>{ if(sc===s) uiAlert('PDF を作成できません：'+(e.message||'')); });
    A.value=''; A.placeholder='読み取り中…'; X=null; draw(); const me=s; clRead(s.url).then(q=>{ if(sc!==me||!document.body.contains(m)) return; A.placeholder='金額'; X=clCheck(q?.read); if(q?.amount!=null&&!A.value) A.value=q.amount; draw(); if(!q?.read) toast('領収書を読み取れませんでした。項目を入力してください'); }); };
  A.oninput=can; show(sc); m.querySelector('[data-c]').onclick=()=>{ const u=m.querySelector('[data-im]').dataset.u; if(u) URL.revokeObjectURL(u); m.remove(); };
  const redo=f=>{ try{ show(f()); }catch(e){ uiAlert('撮影した写真を読み込めません：'+(e.message||'')); } };
  clCamWire(RE,(c,q)=>redo(()=>clScanCv(c,q))); m.querySelector('[data-fx]').onclick=()=>clCamFix(sc,P=>redo(()=>clScanCv(sc.src,P)));
  const ri=RE.querySelector('input'); ri.onchange=async()=>{ const f=ri.files&&ri.files[0]; ri.value=''; if(!f) return; try{ show(await clScan(f)); }catch(e){ await uiAlert('撮影した写真を読み込めません：'+(e.message||'')); } };
  OK.onclick=guard(OK,async()=>{ const amount=clNum(A.value); if(!amount){ toast('金額を入力してください'); A.focus(); return; } if(!X||CL_RK.some(([k])=>X[k].ng)) return; if(await askBy()===null) return;
    await clRcptSave(m,d,sc,X,amount); }); }
// ② 入出金の登録の完了（オーナー「お客様登録は内海 01:08 完了と書いてある。こんな感じで、誰が完了させたのかを書こう」）
// ① と同じ形：確認者を選んで［完了］→ 見出しの下に「内海 01:08 完了」。記録は pos_audit_log の「入出金の登録の完了」（detail：business_date・by）。完了の後に登録が増えたら［完了］に戻る
const CL_MVD='入出金の登録の完了';
async function clMvRender(d,moves,saved,D){ let top=$('clMvTop'), el=$('clMvDone'); if(!top||!el) return;
  const lg=await clGet(D,'mvd_log',()=>sb.from('pos_audit_log').select('created_at,detail').eq('store_id',S.store.id).eq('action',CL_MVD).eq('detail->>business_date',d).order('created_at',{ascending:false}).limit(1)); top=$('clMvTop'); el=$('clMvDone'); if(!top||!el||S.clDate!==d) return; /* 読む間に描き直されると前の欄は画面から外れるので、今の欄を取り直す（2回重なって呼ばれた時に確認者の欄が出なかった） */ if(lg.error){ el.innerHTML=RDERR; return; }
  const last=(lg.data||[])[0], done=last&&!(moves||[]).some(m=>m.created_at>last.created_at);
  top.innerHTML=done?`<div style="font-size:16px;font-variant-numeric:tabular-nums;margin-bottom:6px">${esc(last.detail?.by||'')}　<small class="muted">${hmJst(last.created_at)}</small>　完了</div>`:'';
  if(done||saved){ el.innerHTML=''; return; }
  const who=S.staffAll.filter(s=>s.is_active&&(s.kind==='hall'||(s.kakari_only&&s.display_name!=='店')));
  el.innerHTML=`<div style="display:flex;gap:10px;align-items:center;margin-top:8px"><select id="clMvWho" style="width:auto;min-width:0"><option value="">確認者</option>${who.map(s=>`<option value="${esc(s.display_name)}">${esc(s.display_name)}</option>`).join('')}</select><button class="primary sm" id="clMvOk" disabled>完了</button></div>`;
  $('clMvWho').onchange=()=>{ $('clMvOk').disabled=!$('clMvWho').value; };
  $('clMvOk').onclick=guard($('clMvOk'),async()=>{ const by=$('clMvWho').value; if(!by) return; await logOp(CL_MVD,{business_date:d,by},null,true); toast('完了しました'); clMvRender(d,moves,saved); }); }
// 一覧の書類のしるし：PDF を大きく表示
async function clRcptView(mv){ if(!mv?.receipt_path) return; const s=await sb.storage.from('receipts').createSignedUrl(mv.receipt_path,600); if(s.error||!s.data?.signedUrl){ await uiAlert('表示できません：'+(s.error?.message||'')); return; }
  const m=mkModal(60); m.innerHTML=`<div class="box" style="width:min(620px,94vw)"><button class="xb dx" data-x aria-label="閉じる">×</button><div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(mv.memo||'')}　${yen(mv.amount)}</div><iframe src="${esc(s.data.signedUrl)}" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:8px;background:#fff"></iframe></div>`;
  document.body.appendChild(m); m.querySelector('[data-x]').onclick=()=>m.remove(); }
// ③ 領収書メール（オーナー「入出金の登録と領収書のメールを分ける」「何件あるのかだけ、1行とか2行で」）
// 確認者を選んで［メール送信］→ ショートカット「領収書メール」が直接動き、宛先・件名・PDF の入ったメールの画面を開く → 送信を押すだけ（オーナー「ボタンを押すとメールアプリが立ち上がり、タイトルと PDF が自動で添付されて、送信ボタンを押すだけ」）
// 前は iPad の共有の画面からショートカットを選ぶ形で、スタッフが「メール」を選ぶと件名が空・mail.txt が付いたまま届いた（銀座）。共有の画面を出さないよう、shortcuts:// でショートカットを名前で呼ぶ。渡す文は 1行目＝宛先〔管理サイト「領収書メールの宛先」〕・2行目＝件名・3行目＝PDF の期限つきリンク（空白で区切る）。ショートカットがリンクから PDF を読み込んで付ける（iPad ごとに最初の1回だけ「送ってよいか」が出るので「常に許可」）
// 送信の後は ① と同じ形で「確認者 時刻 送信」（メールアプリで送信まで済んだかは POS ではわからないので、ショートカットを開いた記録）
function clGo(u){ location.href=u; } // テストで差しかえる
/* ③ のオーナー登録のスカウト請求書の行（件数・確認者の上。② の一覧と同じ形。黒服は消せないので × は無い） */
const clScoutWire=(el,SC)=>el.querySelectorAll('[data-scpdf]').forEach(b=>b.onclick=()=>{ const x=SC.find(z=>z.id===b.dataset.scpdf); if(x) clRcptView({receipt_path:x.path,memo:'スカウト料（オーナー登録）',amount:x.amount}); }); /* 書類のマークで請求書を大きく表示 */
const clScoutRows=SC=>SC.length?`<div class="clmv" style="margin-bottom:10px">${SC.map(x=>`<div class="r"><span class="badge gray">請求書</span><span class="t">スカウト料（オーナー登録）</span><span><button class="xb" data-scpdf="${x.id}" aria-label="請求書">${FX('filetext')}</button></span><span class="p"></span><span class="a">${yen(x.amount)}</span><span></span></div>`).join('')}</div>`:'';
/* ③ のメールに付ける PDF の期限つきリンク（領収書と、オーナー登録のスカウト請求書）。押した時にすぐ開けるよう先に作る（待ってから開くと端末に止められることがある） */
function clRcptLinks(d,R,SC){ const one=async(path,name)=>{ const u=await sb.storage.from('receipts').createSignedUrl(path,86400,{download:name}); if(u.error||!u.data?.signedUrl) throw new Error(u.error?.message||'領収書を読み込めません'); return u.data.signedUrl; };
  return Promise.all(R.map(m=>one(m.receipt_path,`${d}_${m.memo||CL_RCPT}_${m.amount}円.pdf`)).concat(SC.map(x=>one(x.path,`${d}_スカウト料（オーナー登録）_${x.amount}円.pdf`)))); }
async function clRcptRender(d,moves,D){ const el=$('clRcpt'); if(!el) return; const R=(moves||[]).filter(m=>m.receipt_path);
  const sq=await clGet(D,'scout',()=>sb.rpc('pos_scout_list',{p_day:d})); if(!$('clRcpt')||S.clDate!==d) return; const SC=sq.error?[]:(sq.data||[]); /* 698 が入る前は関数が無いので 0件 */
  if(!R.length&&!SC.length){ el.innerHTML='<div class="muted">領収書なし</div>'; return; }
  const lg=await clGet(D,'rcpt_log',()=>sb.from('pos_audit_log').select('created_at,detail').eq('store_id',S.store.id).eq('action',CL_RMAIL).eq('detail->>business_date',d).order('created_at',{ascending:false}).limit(1)); if(!$('clRcpt')||S.clDate!==d) return; if(lg.error){ el.innerHTML=RDERR; return; }
  const last=(lg.data||[])[0], sent=new Set(last?.detail?.ids||[]), done=last&&R.every(m=>sent.has(m.id))&&SC.every(x=>x.mail_day), N=`<span style="width:${SC.length?200:96}px;flex:none">${R.length?`領収書 ${R.length}件`:'領収書なし'}${SC.length?`・請求書 ${SC.length}件`:''}</span>`;
  const links=clRcptLinks(d,R,SC); links.catch(()=>{}); /* 押した時にすぐ開けるよう先に作る（待ってから開くと端末に止められることがある） */
  const who=S.staffAll.filter(s=>s.is_active&&(s.kind==='hall'||(s.kakari_only&&s.display_name!=='店')));
  el.innerHTML=clScoutRows(SC)+(done?`<div style="display:flex;gap:10px;align-items:center;font-size:16px;font-variant-numeric:tabular-nums">${N}${esc(last.detail?.by||'')}　<small class="muted">${hmJst(last.created_at)}</small>　送信<button class="ghost sm" id="clRcptAgain" style="margin-left:8px">再送信</button></div>`
    :`<div style="display:flex;gap:10px;align-items:center;font-size:16px">${N}<select id="clRcptWho" style="width:auto;min-width:0"><option value="">確認者</option>${who.map(s=>`<option value="${esc(s.display_name)}">${esc(s.display_name)}</option>`).join('')}</select><button class="primary sm" id="clRcptSend" disabled>メール送信</button></div>`);
  clScoutWire(el,SC);
  const send=async by=>{ const to=String(S.settings?.receipt_mail_to||'').trim(); if(!to){ await uiAlert('領収書メールの宛先がありません\n管理サイトの POS設定「店の情報」で入力してください'); return; }
    let U; try{ U=await links; }catch(e){ await uiAlert('領収書を読み込めません：'+(e.message||'')); return; }
    const subject=`【${S.store?.name||''}】現金払い（名前→${by}）`;
    clGo('shortcuts://run-shortcut?name='+encodeURIComponent('領収書メール')+'&input=text&text='+encodeURIComponent(`${to}\n${subject}\n${U.join(' ')}`));
    await logOp(CL_RMAIL,{business_date:d,by,count:R.length+SC.length,ids:R.map(m=>m.id).concat(SC.map(x=>x.id))},null,true);
    if(SC.length){ const k=await sb.rpc('pos_scout_mailed',{p_day:d,p_ids:SC.map(x=>x.id)}); if(k.error) toast(k.error.message); }
    clRcptRender(d,moves); };
  if($('clRcptWho')){ $('clRcptWho').onchange=()=>{ $('clRcptSend').disabled=!$('clRcptWho').value; }; $('clRcptSend').onclick=()=>send($('clRcptWho').value); }
  if($('clRcptAgain')) $('clRcptAgain').onclick=()=>send(last.detail?.by||''); }
