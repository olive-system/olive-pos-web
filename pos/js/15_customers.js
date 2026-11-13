// ---------- 顧客（基本情報・キープボトル・来店履歴） ----------
S.cuSel=null;
$('navCust').onclick=async()=>{ show('v-cust'); await loadMasters(); { const r=await cuPull(); if(r.data) S.customers=r.data; } /* お客様は変わった分だけ読む */ renderCuList(); renderCuForm(); await loadCuInfo(); renderCuList(); };
document.querySelectorAll('#cuModes [data-cm]').forEach(b=>b.onclick=()=>{ S.cuMode=b.dataset.cm; renderCuList(); });
$('cuSearch').oninput=()=>renderCuList();
function renderCuList(){ const q=$('cuSearch').value.trim();
  if(!S.cuMonthsSel) S.cuMonthsSel=btMonths();
  const ms=$('cuMonths');
  const opts=[...new Set([1,2,3,6,12,S.cuMonthsSel])].sort((a,b)=>a-b);
  /* 12か月は「1年以上ご来店なし」。選択肢は「○か月以上ご来店なし」。［全員］［ご来店なし］ボタンはなくし、この欄で「全員」か期間を選ぶ */ ms.innerHTML=`<option value="" ${S.cuMode==='old'?'':'selected'}>全員</option>`+opts.map(n=>`<option value="${n}" ${S.cuMode==='old'&&n===S.cuMonthsSel?'selected':''}>${n%12?n+"か月":n/12+"年"}以上ご来店なし</option>`).join('');
  ms.onchange=()=>{ if(!ms.value){ S.cuMode='all';
  renderCuList();
  return;
  } S.cuMonthsSel=Number(ms.value);
  S.cuMode='old';
  renderCuList();
  };
  const cut=btCutoff(S.cuMonthsSel);
  const reqN=Object.values(S.cuInfo.req||{}).reduce((a,n)=>a+n,0);
  if(S.cuMode==='req'&&!reqN) S.cuMode='all';
  $('cuReqChip').style.display=reqN?'':'none';
  $('cuReqChip').textContent=`申請 ${reqN}件`;
  document.querySelectorAll('#cuModes [data-cm]').forEach(b=>b.classList.toggle('on',b.dataset.cm===S.cuMode));
  let list=S.customers.slice().sort((a,b)=>cuAct(b)-cuAct(a)||jaCmp(a.name,b.name)||String(a.id).localeCompare(String(b.id))) /* 最近出てきた順（来店・予約・情報の更新。オーナー。顧客サイトと同じ） */.filter(c=>!q||(c.name||'').includes(q)||(c.company||'').includes(q)||(c.receipt_name||'').includes(q)||(S.cuInfo.kn[c.id]||[]).some(k=>k.includes(q))||kanaHit(c,q));
  if(S.cuMode==='req') list=list.filter(c=>S.cuInfo.req[c.id]);
  if(S.cuMode==='old') list=list.filter(c=>cuBase(c.id)&&cuBase(c.id)<=cut).sort((a,b)=>cuBase(a.id).localeCompare(cuBase(b.id)));
  /* 人数と、出しきれない人数を出す（300名まで。顧客サイトと同じ） */ $('cuCount').textContent=`${list.length}名`+(S.cuMode==='old'?`（最終来店が ${cuMd(cut)} 以前）`:''); const more=Math.max(0,list.length-300); list=list.slice(0,300);
  $('cuList').innerHTML=list.map(c=>cuRowHtml(c,cut)).join('')+(more?`<div class="muted" style="font-size:13px;padding:8px 0">ほか ${more}名（検索で絞り込んでください）</div>`:'')||'<div class="muted">該当なし</div>';
  $('cuList').querySelectorAll('[data-id]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.id; S.cuSel=id; renderCuList(); renderCuForm(); /* 選んだお客様は最新の内容を読み直す（顧客サイトでの変更を出す） */ const r=await sb.from('customers').select(CUSEL).eq('id',id).maybeSingle(); cuK(r.data); const c=S.customers.find(x=>x.id===id); if(r.error||!c||S.cuSel!==id) return; if(!r.data){ S.customers=S.customers.filter(x=>x.id!==id); S.cuSel=null; renderCuList(); renderCuForm(); toast('このお客様は削除されています'); return; } if(JSON.stringify(r.data)!==JSON.stringify(c)){ Object.assign(c,r.data); renderCuList(); renderCuForm(); } }); }
/* 顧客一覧の1行 */
function cuRowHtml(c,cut){ const last=S.cuInfo.last[c.id], n=S.cuInfo.cnt[c.id]||0;
    const old=S.cuMode==='old'&&cuBase(c.id)&&cuBase(c.id)<=cut;
    return `<button class="row ${c.id===S.cuSel?'on':''}" data-id="${c.id}" style="text-align:left;width:100%"><span class="nm">${esc(c.name)}${c.store_id&&c.store_id!==S.store.id?' <small class="muted">他店</small>':''}${c.company?` <small class="muted">${esc(c.company)}</small>`:''}${c.is_industry?' <span class="badge k">同業</span>':''}<small class="muted" style="white-space:normal;margin-left:12px;${old?'color:var(--warn)':''}">${[last?cuMd(last):'来店なし',c.kakari_staff_id?esc(snm(c.kakari_staff_id))+(S.staffAll.some(x=>x.id===c.kakari_staff_id&&!x.is_active)?'（退店）':''):'',esc(bnLine(S.cuInfo.bn[c.id],n))].filter(Boolean).join('・')}</small>${S.cuInfo.req[c.id]?` <span class="badge warnb">申請 ${S.cuInfo.req[c.id]}件</span>`:''}</span></button>`;
}
/* ＋新規は名前の小窓を出さず、空の入力画面をすぐ出す（オーナー「最初のポップアップのワンアクションいらない」）。［登録］で作る。検索の文字はお名前（かなだけならフリガナ）に入れる */
S.cuDraft=null;
$('cuNew').onclick=()=>{ const q=$('cuSearch').value.trim(), kq=!!q&&!kanaBad(kanaFix(q)); S.cuDraft={id:null,store_id:S.store.id,name:kq?'':q,kana:kq?kanaFix(q):null,is_industry:false}; S.cuSel='__new'; renderCuList(); renderCuForm(); setTimeout(()=>{ const i=$('cuForm').querySelector(kq?'[data-k=name]':q?'[data-k=kana]':'[data-k=name]'); if(i) i.focus(); },50); };
const CUF=[['name','お名前'],['kana','フリガナ'],['birthday','お誕生日'],['receipt_name','領収書名'],['kakari_staff_id',''+KL+''],['good_cast_ids','反応◎'],['company','会社名'],['company_address','会社住所'],['memo','メモ']]; // 反応の良かったキャスト（3名まで。退店したキャストも記録として残し「（退店）」と表示、新しくは選べない）
// 反応の良かったキャスト＝そのお客様の直近30回のご来店（取消の伝票は除く）で反応◎が多い上位3名（自動）
async function cuGoodLoad(c){ const e=()=>($('cuGood')&&S.cuSel===c.id)?$('cuGood'):null; const bc=await sb.from('bill_customers').select('bill_id,bills!inner(business_date,opened_at,status)').eq('customer_id',c.id); if(bc.error){ if(e()) e().textContent='—'; return; } const ids=[...new Set((bc.data||[]).filter(x=>x.bills&&x.bills.status!=='void').sort((a,b)=>(b.bills.business_date+b.bills.opened_at).localeCompare(a.bills.business_date+a.bills.opened_at)).map(x=>x.bill_id))].slice(0,30); let rows=[]; for(let i=0;i<ids.length;i+=100){ const r=await sb.from('good_reactions').select('staff_id').in('bill_id',ids.slice(i,i+100)); if(r.error){ if(e()) e().textContent='—'; return; } rows=rows.concat(r.data||[]); }
  const m={}; rows.forEach(x=>m[x.staff_id]=(m[x.staff_id]||0)+1); if(!S.staffAll.length) await loadStaffAll(); const top=Object.entries(m).sort((a,b)=>b[1]-a[1]||jaCmp(S.staffAll.find(x=>x.id===a[0])?.display_name,S.staffAll.find(x=>x.id===b[0])?.display_name)).slice(0,3); if(!e()) return; /* 同じ回数は名前順（顧客サイトと同じ） */
  e().innerHTML=top.length?top.map(([id,n])=>{ const s=S.staffAll.find(x=>x.id===id); return `<span style="margin-right:16px;white-space:nowrap;display:inline-block">${esc(s?.display_name||'')}${s&&!s.is_active?'<small class="muted">（退店）</small>':''} <small class="muted">${n}回</small></span>`; }).join(''):'<span class="muted">なし</span>'; }
// 連絡先交換（LINEマイページからキャストが提出）。そのお客様と交換したキャストの名前。顧客は自動では選ばない（名前があいまいなため）ので、黒服がわかる時だけ「未選択の連絡先交換」から選択（オーナー。顧客サイトと同じ）
async function cuCxLoad(c){ const box=()=>($('cuCx')&&S.cuSel===c.id)?$('cuCx'):null; const r=await sb.rpc('pos_contacts',{p_customer:c.id}); if(!box()) return; if(r.error){ box().innerHTML=''; return; }
  const d=r.data||{}, key=x=>String(x||'').replace(/[\s　]/g,''), un=(d.unlinked||[]).slice().sort((a,b)=>(key(b.name)===key(c.name))-(key(a.name)===key(c.name)));
  box().innerHTML=`<div class="muted" style="font-size:13px">連絡先交換</div><div style="font-size:16px;padding:4px 0">${(d.casts||[]).length?d.casts.map(esc).join('・'):'<span class="muted">なし</span>'}</div>`+(un.length?`<div style="display:flex;gap:6px;align-items:center;margin-top:4px"><select id="cuCxSel" style="flex:1 1 0;min-width:0;width:0"><option value="">未選択の連絡先交換</option>${un.map(x=>`<option value="${x.id}">${esc(x.name)} 様（${esc(x.cast)} ${reqMd(x.date)}）</option>`).join('')}</select><button class="ghost sm" id="cuCxGo" style="flex:none">選択</button></div>`:'');
  const go=$('cuCxGo'); if(go) go.onclick=async()=>{ const id=$('cuCxSel').value; if(!id){ await uiAlert('連絡先交換を選んでください'); return; } const x=un.find(z=>z.id===id); if(!await uiConfirm(`${x.name} 様（${x.cast}）の連絡先交換を\n${c.name} 様にしますか？`)) return; go.disabled=true; const q=await sb.rpc('pos_contact_link',{p_id:id,p_customer:c.id}); if(q.error){ go.disabled=false; await uiAlert(q.error.message); return; } toast('顧客を選択しました'); cuCxLoad(c); }; }
CU_SITE.rnInp='width:100%'; CU_SITE.rnBtn='height:40px;padding:0 14px'; /* 本名の欄（lib/olive/customer.js の rnBox）の入力欄と［追加］の形 */
const rnList=v=>String(v||'').split('\n').map(x=>x.trim()).filter(Boolean), rnFirst=v=>rnList(v)[0]||'';
