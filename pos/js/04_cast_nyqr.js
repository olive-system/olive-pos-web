// ---------- 入店説明の小窓の「LINE QR 印刷」（SQL 762）：やることの1つとして済／未を見せる ----------
// 在籍の編集の［印刷］（04_cast_lineqr.js）で刷ると自動で済。前に紙で渡した子のため、手でも済にできる（QR 未登録でも可）
// 札の色・罰金・タイムカードには使わない（入店説明2 の決まりとは別）
let caNyQrOpen=null;   // 未をタップした子（担当者と［印刷済み］を出す）
function caNyQrRow(s){ const q=caNy.q?.[s.id]; if(!q) return ''; const lab='<b style="flex:none;width:120px;white-space:nowrap">LINE QR 印刷</b>';
  const v=q.done?`<span><b style="color:var(--gold)">済</b>${q.by||q.at?`（${esc([q.by,q.at].filter(Boolean).join(' '))}）`:''}</span>`:
    caNyQrOpen===s.id?`<span style="color:var(--warn);font-weight:700">未</span><span class="muted" style="font-size:13px">担当者</span><select data-nyqb style="min-width:140px;height:40px;padding:0 8px">${hallList().map(h=>`<option value="${h.id}" ${mgrOf(s)?.id===h.id?'selected':''}>${esc(h.display_name)}</option>`).join('')}</select><button class="sm" data-nyqok style="background:var(--gold);color:#fff;height:40px">印刷済み</button>`:
    `<u data-nyqo style="color:var(--warn);font-weight:700;cursor:pointer">未</u>${q.reg?'':'<span class="badge gray">QR 未登録</span>'}`;
  return `<div style="display:flex;align-items:center;gap:10px;min-height:52px;border-top:1px solid var(--line);flex-wrap:wrap">${lab}${v}</div>`; }
function caNyQrBind(m,s,draw){ const o=m.querySelector('[data-nyqo]'); if(o) o.onclick=()=>{ caNyQrOpen=s.id; draw(); };
  const ok=m.querySelector('[data-nyqok]'); if(!ok) return;
  ok.onclick=async()=>{ const by=m.querySelector('[data-nyqb]')?.value; if(!by){ toast('担当者を選択してください'); return; } ok.disabled=true;
    const r=await sb.rpc('pos_nyuten_qr_done',{p_staff:s.id,p_by:by}); if(r.error){ ok.disabled=false; toast(r.error.message); return; }
    if(caNy.q) caNy.q[s.id]=r.data; caNyQrOpen=null; caNy.at=0; draw(); }; }
// 在籍の編集の［印刷］の後：何回刷っても済の日付は最後に刷った日（オーナー「QR の印刷は何回でもできるようにしてほしい」）。印刷は済んでいるので、ここで失敗しても知らせない
function caNyQrPrinted(id){ sb.rpc('pos_line_qr_printed',{p_staff:id}).then(r=>{ if(!r.error&&r.data&&caNy.q) caNy.q[id]=r.data; caNy.at=0; }); }
