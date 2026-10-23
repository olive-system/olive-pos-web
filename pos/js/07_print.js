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
  (b.bill_items||[]).filter(i=>!i.is_void).forEach(i=>{ L.push({t:padLine(`${i.name} ×${i.qty}`,(i.unit_price*i.qty).toLocaleString())}); if(kind==='detail'){ const sp=(i.bill_item_splits||[]).map(s=>staffAll.find(x=>x.id===s.staff_id)?.display_name).filter(Boolean).join('/'); if(sp) L.push({t:'   → '+sp}); } });
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
  openReceipt({max, amount:remain>0?remain:Math.min(lastAmt,max), name:c0?.receipt_name||c0?.name||'', guests:cur.set_guest_count??cur.guest_count, cashAvail:Math.max(0,cashAll-usedCash), why}); };
// 領収書の絵（横長 1240×576）。印刷は 90度回して 80mm 幅（576ドット）で出す
function drawReceipt(cv,d){ const W=1240,H=576; cv.width=W; cv.height=H; const g=cv.getContext('2d'); const F=(px,w)=>`${w||400} ${px}px "Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif`; g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#000'; g.strokeStyle='#000'; g.textBaseline='alphabetic';
  const LW=1.5, AMT={px:38,w:300}; /* v10.42：線の太さ・金額の文字（サイズ・太さ）はここで変える */ g.lineWidth=LW; g.strokeRect(10,10,W-20,H-20);
  g.font='italic 700 58px Georgia,"Times New Roman",serif'; g.textAlign='left'; g.fillText('Receipt',44,84);
  g.font=F(26); g.textAlign='right'; g.fillText(`${d.issue.getFullYear()}年${d.issue.getMonth()+1}月${d.issue.getDate()}日`,W-44,80);
  g.textAlign='left'; g.font=F(36,700); g.fillText(d.name||'',56,168,560); g.font=F(30); g.fillText('様',650,168); g.lineWidth=LW; g.beginPath(); g.moveTo(44,182); g.lineTo(700,182); g.stroke();
  g.lineWidth=LW; g.strokeRect(44,206,700,96); g.font=F(AMT.px,AMT.w); g.textAlign='center'; g.fillText(`¥${Number(d.amount||0).toLocaleString()}-`,350,254+Math.round(AMT.px*0.36)); g.font=F(20); g.textAlign='right'; g.fillText('（消費税込み）',734,290);
  g.textAlign='left'; g.font=F(23); g.fillText(`${d.rate}%対象 ¥${Number(d.amount||0).toLocaleString()}　　内消費税 (¥${Number(d.tax||0).toLocaleString()})`,50,340); g.fillText(`現金 ¥${Number(d.cash||0).toLocaleString()}　　カード ¥${Number(d.card||0).toLocaleString()}`,50,374);
  g.font=F(26); g.fillText(`但　${d.guests||'　　'}名様ご飲食代として${d.visit?`（ご利用日 ${d.visit}）`:''}`,50,428); g.font=F(21); g.fillText('上記正に領収いたしました',50,464); const sx=50+g.measureText('上記正に領収いたしました').width+16;
  g.setLineDash([6,5]); g.lineWidth=LW; g.strokeRect(648,336,96,70); g.setLineDash([]); g.font=F(15); g.textAlign='center'; g.fillText('収入印紙',696,376);
  const X=780; if(d.logo){ const r=Math.min(300/d.logo.width,130/d.logo.height); g.drawImage(d.logo,X,120,d.logo.width*r,d.logo.height*r); }
  g.textAlign='left'; g.font=F(30,700); g.fillText(d.store||'',X,300,300); g.font=F(18); let y=332; for(const t of [d.address,d.tel?('TEL '+d.tel):'',d.regno?('登録番号 '+d.regno):'']){ if(t){ g.fillText(t,X,y,300); y+=26; } }
  const R=33,cx=sx+R,cy=468; if(d.sig){ g.save(); g.beginPath(); g.arc(cx,cy,R-3,0,Math.PI*2); g.clip(); g.drawImage(d.sig,cx-R+4,cy-R+4,(R-4)*2,(R-4)*2); g.restore(); } g.lineWidth=LW; g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.stroke(); }
function receiptPrint(cv){ const W=576,H=1240; const r=document.createElement('canvas'); r.width=W; r.height=H; const g=r.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.translate(W,0); g.rotate(Math.PI/2); g.drawImage(cv,0,0);
  if(PRINT.method==='browser'){ $('printArea').innerHTML=`<img src="${r.toDataURL('image/png')}" style="width:72mm">`; setTimeout(()=>window.print(),80); return; }
  const px=g.getImageData(0,0,W,H).data, bw=W/8, buf=new Uint8Array(bw*H); for(let yy=0;yy<H;yy++) for(let xx=0;xx<W;xx++){ const i=(yy*W+xx)*4; if((px[i]*299+px[i+1]*587+px[i+2]*114)/1000<150) buf[yy*bw+(xx>>3)]|=(0x80>>(xx&7)); }
  let bin=''; for(let i=0;i<buf.length;i+=8192) bin+=String.fromCharCode.apply(null,buf.subarray(i,i+8192));
  const xml=`<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><image width="${W}" height="${H}" color="color_1" mode="mono">${btoa(bin)}</image><feed line="3"/><cut type="feed"/></epos-print>`;
  location.href='tmprintassistant://tmprintassistant.epson.com/print?ver=1&data-type=eposprintxml&reselect=yes&data='+encodeURIComponent(xml)+'&back='+encodeURIComponent(location.href); }
// サイン画面（大きく別に出す）。OK でサインの canvas、キャンセルで null
function askSign(){ return new Promise(res=>{ const m=document.createElement('div'); m.style.cssText='position:fixed;inset:0;z-index:70;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px'; const S=Math.floor(Math.min(innerWidth*0.9,innerHeight*0.72));
  m.innerHTML=`<canvas style="width:${S}px;height:${S}px;border:3px solid var(--ink);border-radius:50%;touch-action:none;background:#fff"></canvas><div class="bar"><button class="ghost" data-k="redo">再入力</button><button class="ghost" data-k="no">キャンセル</button><button class="primary" data-k="ok">OK</button></div>`; document.body.appendChild(m);
  const sc=m.querySelector('canvas'), SW=600; sc.width=SW; sc.height=SW; const sg=sc.getContext('2d'); let drawn=false, down=false; const clear=()=>{ sg.fillStyle='#fff'; sg.fillRect(0,0,SW,SW); sg.strokeStyle='#111'; sg.lineWidth=21; sg.lineCap='round'; sg.lineJoin='round'; drawn=false; okB.disabled=true; }; const okB=m.querySelector('[data-k=ok]'); clear();
  const pos=e=>{ const r=sc.getBoundingClientRect(); return [(e.clientX-r.left)*SW/r.width,(e.clientY-r.top)*SW/r.height]; };
  sc.onpointerdown=e=>{ e.preventDefault(); down=true; try{ sc.setPointerCapture(e.pointerId); }catch(_){} const [x,y]=pos(e); sg.beginPath(); sg.moveTo(x,y); sg.lineTo(x+0.1,y+0.1); sg.stroke(); drawn=true; okB.disabled=false; };
  sc.onpointermove=e=>{ if(!down) return; e.preventDefault(); const [x,y]=pos(e); sg.lineTo(x,y); sg.stroke(); }; sc.onpointerup=sc.onpointercancel=()=>{ down=false; };
  m.querySelector('[data-k=redo]').onclick=clear; m.querySelector('[data-k=no]').onclick=()=>{ m.remove(); res(null); }; okB.onclick=()=>{ if(!drawn) return; m.remove(); res(sc); }; }); }
function openReceipt(o){ const rate=Number(cur.totals?.tax_rate)||10; const m=document.createElement('div'); m.className='modal on'; m.style.zIndex=60;
  m.innerHTML=`<div class="box" style="width:min(980px,96vw);max-height:94vh;overflow:auto"><div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:6px 10px"><label>宛名<input data-rc="name" style="width:100%"></label><label>金額<input data-rc="amount" inputmode="numeric" style="width:100%;text-align:right"></label><label>人数<input data-rc="guests" inputmode="numeric" style="width:100%;text-align:right"></label><label>現金<input data-rc="cash" inputmode="numeric" style="width:100%;text-align:right"></label><label>カード<input data-rc="card" readonly style="width:100%;text-align:right;background:var(--soft)"></label></div><div data-rcmix class="hidden" style="color:var(--warn);font-size:14px;margin-top:6px">この伝票は現金とカードの両方で払われています。この領収書の現金・カードの分け方を確かめてください（現金の欄を直すと、残りがカードになります）</div>
  <canvas data-rc="pv" style="width:100%;border:1px solid var(--line);margin-top:10px;display:block"></canvas>
  <div style="display:flex;margin-top:10px"><div class="bar" style="margin-left:auto"><button class="ghost" data-rc="no">キャンセル</button><button class="primary" data-rc="ok">発行</button></div></div></div>`;
  document.body.appendChild(m); const q=k=>m.querySelector(`[data-rc=${k}]`); const num=k=>parseInt(String(q(k).value).replace(/[^0-9]/g,'')||'0',10);
  q('name').value=o.name||''; q('amount').value=o.amount; q('guests').value=''; let cashTouched=false; q('cash').value=Math.min(o.amount,o.cashAvail);
  let sigCv=null;
  let logo=null; if(settings?.receipt_logo){ const im=new Image(); im.onload=()=>{ logo=im; paint(); }; im.src=settings.receipt_logo; }
  const data=()=>{ const amount=num('amount'); const cash=Math.min(num('cash'),amount); const now=new Date(); return { name:q('name').value.trim(), amount, guests:num('guests')||null, cash, card:amount-cash, rate, tax:Math.floor(amount*rate/(100+rate)), issue:now, visit:businessDate()!==cur.business_date?jmd(cur.business_date):'', store:store?.name||'', address:store?.address||'', tel:store?.phone||store?.tel||'', regno:settings?.invoice_reg_no||'', logo, sig:sigCv }; };
  const paint=()=>{ const d=data(); q('card').value=d.card; drawReceipt(q('pv'),d); };
  q('amount').oninput=()=>{ if(!cashTouched) q('cash').value=Math.min(num('amount'),o.cashAvail); /* v11.95：現金とカードの両方で払われた伝票は、金額を変えたら現金の欄を確かめるように出す（ゲネプロ #38） */ const mx=m.querySelector('[data-rcmix]'); if(mx) mx.classList.toggle('hidden',!(o.cashAvail>0&&o.cashAvail<o.amount&&num('amount')!==o.amount)); paint(); }; q('cash').oninput=()=>{ cashTouched=true; paint(); }; q('name').oninput=q('guests').oninput=paint;
  q('no').onclick=()=>m.remove(); paint();
  const ok=q('ok'); ok.onclick=guard(ok,async()=>{ const d=data(); if(!d.amount||d.amount<1){ toast('金額が正しくありません'); return; } if(d.amount>o.max){ toast(`上限は ${yen(o.max)} です`); return; } if(num('cash')>d.amount){ toast('現金が金額を超えています'); return; } const sg=await askSign(); if(!sg) return; sigCv=sg;
    const s2=document.createElement('canvas'); s2.width=s2.height=180; s2.getContext('2d').drawImage(sigCv,0,0,180,180); const jd=`${d.issue.getFullYear()}-${String(d.issue.getMonth()+1).padStart(2,'0')}-${String(d.issue.getDate()).padStart(2,'0')}`;
    const r=await sb.from('receipts').insert({store_id:store.id,bill_id:cur.id,issue_date:jd,visit_date:cur.business_date,name:d.name||null,guest_count:d.guests,amount:d.amount,cash_amount:d.cash,card_amount:d.card,tax_amount:d.tax,signature:s2.toDataURL('image/png'),reissue_reason:o.why||null}); if(r.error){ toast('領収書を記録できません：'+r.error.message); return; }
    await logOp(o.why?'領収書再発行':'領収書発行',{name:d.name||null,amount:d.amount},o.why); paint(); receiptPrint(q('pv')); m.remove(); }); }
$('extAdd').textContent=`${settings?.ext_minutes||30}分延長`;
$('extAdd').onclick=guard($('extAdd'),async()=>{ const { error } = await sb.from('bill_extensions').insert({bill_id:cur.id,minutes:settings.ext_minutes,unit_price:settings.ext_unit_price,qty:cur.guest_count,is_auto:false}); if(error){ toast(error.message); return; } await logOp('延長追加（手動）',{minutes:settings.ext_minutes,amount:settings.ext_unit_price*cur.guest_count}); await openBill(cur.id); });
$('bBack').onclick=()=>{ if(billFrom==='bills'){ renderSettings('bills'); show('v-settings'); return; } loadHall(); show('v-hall'); };
// v11.12：先に「削除しますか？」を出す（やめられる）。続けて理由（必須）
$('bVoid').onclick=async()=>{ const tn=tables.find(t=>t.id===cur.table_id)?.name||''; if(!await uiConfirm(`${tk(tn)}の伝票を削除しますか？\n履歴は残ります`))return; const by=await askBy(); if(by===null) return; const why0=await askReason(`${tk(tn)}の伝票を削除します。`); if(!why0)return; const why=by?`${why0}（${by}）`:why0; const vb=$('bVoid'); if(vb.disabled) return; vb.disabled=true; /* v11.27：取消できたのを確かめてから操作ログに書く（前はログが先で、失敗しても「取消」が残った） */
  try{ const u=await cashClosed(()=>sb.from('bills').update({status:'void',closed_at:new Date().toISOString(),...(DBLOG?{void_reason:why}:{})}).eq('id',cur.id).neq('status','void').select('id'),`伝票の削除（${tn}）`); /* v12.07・SQL 220：現金の入金がある伝票は、精算済みの日は精算の取消の後に削除 */
    if(u.error?.cancel){}
    else if(u.error||!(u.data||[]).length){ await uiAlert(u.error?'伝票を削除できませんでした：'+u.error.message:'伝票を削除できませんでした（ほかの端末で変更されています）'); }
    else if(!DBLOG) await logOp('伝票取消',{total:cur.totals?.amount_due??null,guest_count:cur.guest_count,items:(cur.bill_items||[]).filter(i=>!i.is_void).map(i=>`${i.name}×${i.qty}`)},why);
  } finally{ vb.disabled=false; } loadHall(); show('v-hall'); };
$('bOrder').onclick=()=>openOrder();
$('bPay').onclick=async()=>{ if(cur&&cur.status==='open'){ const miss=[]; if(!(cur.bill_customers||[]).length) miss.push('お客様が登録されていません'); if(!(cur.bill_casts||[]).some(c=>c.is_kakari)) miss.push(''+KL+'が登録されていません'); if(miss.length){ await uiAlert(miss.join('\n')); return; } } renderPay(); show('v-pay'); };

