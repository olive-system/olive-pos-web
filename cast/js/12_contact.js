// v0.17・SQL 117：④連絡先交換の提出。日付は今日だけ。お客様はフルネーム、係を選ぶ。提出すると係に LINE。閉店作業の時に黒服へその日のまとめ（2026-10-16 オーナー）
async function contactList(){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('cast_contact_list', { p_token: TOKEN });
  if(r.error){ fail(r.error.message); return; }
  const rows = r.data.rows || [];
  const md = d => `${Number(String(d).slice(5,7))}/${Number(String(d).slice(8,10))}（${WD[new Date(d+'T00:00:00+09:00').getDay()]}）`;
  show(`<div class="ttl">連絡先交換</div><button class="btn" id="cxNew" style="margin-bottom:12px">提出</button><div class="card"><div class="gh">今月 ${rows.length}人</div>${rows.map(x => `<div style="padding:8px 0;border-top:1px solid var(--line)"><div>${md(x.date)}${esc(x.name)} 様</div>
    <div class="muted sm">係 ${esc(x.kakari)}${x.memo?`・${esc(x.memo)}`:''}</div></div>`).join('')||'<div class="muted sm" style="padding:8px 0;border-top:1px solid var(--line)">今月の提出はありません</div>'}</div>`);
  $('cxNew').onclick = () => contactForm(r.data.today);
}
async function contactForm(today){
  setBack(contactList); show('<div class="card c muted">読み込み中…</div>');
  const st = await sb.rpc('cast_resv_staff', { p_token: TOKEN });
  if(st.error){ fail(st.error.message); return; }
  const fld = 'width:100%;height:48px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--card);color:var(--ink)';
  const me = (st.data||[]).find(s => s.name === ME.name);
  const d = new Date(today+'T00:00:00+09:00');
  show(`<div class="ttl">連絡先交換</div><div class="card"><div class="f">交換した日</div><div style="${fld};display:flex;align-items:center;background:var(--bg);color:var(--muted)">${d.getMonth()+1}月${d.getDate()}日（${WD[d.getDay()]}）　今日</div>
      <label class="f" style="margin-top:8px">お客様（フルネーム）<input id="cxN" maxlength="30" placeholder="例：孫 正義" style="${fld}"></label>
      <div class="muted" style="margin-top:4px;white-space:nowrap;font-size:min(12px,calc((100vw - 58px)/25))">ニックネームではなく、フルネームで入力してください</div>
      <label class="f" style="margin-top:8px">${esc(KL)}<select id="cxK" style="${fld}"><option value="">選んでください</option>${(st.data||[]).map(s => `<option value="${s.id}">${s.id===me?.id?'自分':esc(s.name)}</option>`).join('')}<option value="unknown">わからない</option><option value="none">なし</option></select></label>
      <label class="f" style="margin-top:8px">メモ（任意）<textarea id="cxM" maxlength="300" style="min-height:60px"></textarea></label></div>
    <button class="btn" id="cxGo">提出</button><p class="muted sm" style="margin:10px 2px">提出をすると係に共有されます</p>`);
  const dft = draftBind('contact', ['cxN','cxK','cxM']); if(dft.had){ const n = document.createElement('div'); n.className = 'muted sm'; n.style.margin = '0 2px 8px'; n.textContent = '途中の入力を戻しました'; $('cxN').closest('.card').before(n); }
  $('cxGo').onclick = async () => {
    const n = $('cxN').value.trim().replace(/[\s　]+/g, ' '), k = $('cxK').value, m = $('cxM').value.trim();
    if(!n){ await uiAlert('お客様のフルネームを入力してください'); return; }
    if(!k){ await uiAlert('係を選んでください'); return; }
    if(!await uiConfirm(`${n} 様\n係 ${$('cxK').selectedOptions[0].textContent}\nこの内容で提出しますか？`)) return;
    $('cxGo').disabled = true;
    const mode = k === 'unknown' || k === 'none' ? k : 'staff';
    const q = await sb.rpc('cast_contact_submit', { p_token: TOKEN, p_name: n, p_mode: mode, p_kakari: mode === 'staff' ? k : null, p_memo: m || null });
    if(q.error){ $('cxGo').disabled = false; await uiAlert(q.error.message); return; }
    dft.clear();
    await uiAlert(q.data.notified ? '提出しました。\n係に LINE で共有しました' : '提出しました');
    contactList();
  };
}

