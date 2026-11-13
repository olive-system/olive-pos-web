// LINE で入力するヒアリングシート（任意）（オーナーが紙の41項目から33項目を選んだ。元 もらったもの/ヒアリングシートの項目_銀座.md）
// あいさつの［ヒアリングシート］→ ?go=sheet。応募の人の画面なので「LINEマイページ」は出さない。報酬は出さない。銀座と広島で 希望条件の例・営業連絡の人数 がちがう
// その人のページ（21_applicant.js）の「面接」の箱に、入力の中身を出す
const SH_HR = () => STORE === 'hiroshima';
const SHEET = staff => sheetDef(staff, SH_HR()); /* 項目は lib/olive/sheet.js（POS・管理サイトの書類でも使う） */
const SH_FS = 'width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);height:46px';
// 入力の画面（応募の人・お店の両方で使う）。staff はお店（面接官メモの欄も）
function sheetBody(H, staff){ const fld = (k, t, o, v) => t === 'seg' ? `<div class="seg" data-sh="${k}">${o.map(x => `<button type="button" data-v="${esc(x)}" class="${x === v ? 'on' : ''}" style="white-space:nowrap;padding:9px 4px">${esc(x)}</button>`).join('')}</div>`
    : t === 'sel' ? `<select data-sh="${k}" style="${SH_FS}">${o.map(x => `<option value="${esc(x)}" ${x === (v || '') ? 'selected' : ''}>${esc(x || '選択')}</option>`).join('')}</select>`
    : t === 'num' ? `<div style="display:flex;align-items:center;gap:6px"><input data-sh="${k}" type="number" inputmode="numeric" min="0" value="${esc(v ?? '')}" style="${SH_FS};flex:1;min-width:0"><span class="muted" style="flex:none">${esc(o)}</span></div>`
    : `<input data-sh="${k}" type="${t === 'tel' ? 'tel' : t === 'date' ? 'date' : 'text'}" ${t === 'tel' ? 'inputmode="tel" autocomplete="tel"' : ''} maxlength="100" placeholder="${esc(o || '')}" value="${esc(v ?? '')}" style="${SH_FS}">`;
  return SHEET(staff).map(([sec, items]) => `<div class="card"><div class="gh">${sec}</div>${items.map(([k, lb, t, o, dep]) => `<div data-row="${k}" ${dep ? `data-dep="${dep}"` : ''} style="margin-top:10px"><div class="f">${esc(lb)}</div>${fld(k, t, o, H[k])}</div>`).join('')}</div>`).join(''); }
function sheetWire(M){ const val = k => { const s = M.querySelector(`.seg[data-sh="${k}"] button.on`); if(s) return s.dataset.v; const e = M.querySelector(`[data-sh="${k}"]:not(.seg)`); return e ? e.value.trim() : ''; };
  const deps = () => M.querySelectorAll('[data-dep]').forEach(r => { const on = val(r.dataset.dep) === (r.dataset.dep === 'exp' ? 'あり' : 'はい'); r.style.display = on ? '' : 'none'; }); /* 経験「あり」・体験「はい」の時だけ */
  M.querySelectorAll('.seg[data-sh]').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => { const on = !b.classList.contains('on'); s.querySelectorAll('button').forEach(x => x.classList.remove('on')); if(on) b.classList.add('on'); deps(); }));
  deps();
  return staff => { const o = {}; SHEET(staff).forEach(([, items]) => items.forEach(([k, , , , dep]) => { const r = M.querySelector(`[data-row="${k}"]`); if(dep && r && r.style.display === 'none') return; const v = val(k); if(v !== '') o[k] = v; })); return o; }; }

// お店：その人のページの［編集］（本人の入力に書き足し・直し、面接官メモ）
async function sheetStaff(id, store, back){
  setBack(back); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('ap_get', { p_token: TOKEN, p_store: store || null, p_id: id }); if(r.error){ fail(r.error.message); return; }
  show(`<div class="ttl">ヒアリングシート　${esc(r.data.name || r.data.line_name || '')}</div>${sheetBody(r.data.hearing || {}, true)}<button class="btn" id="shOk">保存</button><div style="height:20px"></div>`);
  const get = sheetWire($('main'));
  $('shOk').onclick = async e => { e.target.disabled = true; const q = await sb.rpc('ap_hearing_save', { p_token: TOKEN, p_store: store || null, p_id: id, p: get(true) });
    if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; } back(); };
}

async function sheetForm(idt){
  const g = await sb.rpc('applicant_sheet_get', { p_store: STORE, p_id_token: idt }); if(g.error){ fail(g.error.message); return; }
  if(g.data.locked){ show('<div class="ttl">ヒアリングシート</div><div class="card">送信済です</div>'); return; } /* お店が［編集］で保存したら本人は修正不可（オーナー） */
  /* オーナー「途中保存したい」：入力のたびにこの端末に残し、LINE を閉じても次に開いた時に戻す（送信できたら消す） */
  const dk = 'olive_cast_draft_sheet_' + STORE; let dv = {}; try{ dv = JSON.parse(localStorage.getItem(dk) || '{}').v || {}; }catch(e){}
  show(`<div class="ttl">ヒアリングシート</div>${g.data.sent_at ? '<div class="card sm">送信済です。変更する時は、再度送信してください</div>' : ''}${sheetBody(Object.assign({}, g.data.hearing || {}, dv), false)}<button class="btn" id="shOk">送信</button><div style="height:20px"></div>`);
  const get = sheetWire($('main'));
  const keep = () => setTimeout(() => { if(!$('shOk') || $('main').querySelector('.ttl')?.textContent !== 'ヒアリングシート') return; /* ほかの画面に移った後は残さない */ try{ localStorage.setItem(dk, JSON.stringify({ at: Date.now(), v: get(false) })); }catch(e){} }, 0);
  $('main').addEventListener('input', keep); $('main').addEventListener('click', e => { if(e.target.closest('.seg')) keep(); });
  $('shOk').onclick = async e => { const o = get(false); if(!Object.keys(o).length){ await uiAlert('入力してから送信してください'); return; }
    e.target.disabled = true; const q = await sb.rpc('applicant_sheet_save', { p_store: STORE, p_id_token: idt, p: o });
    if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; }
    try{ localStorage.removeItem(dk); }catch(e){}
    show('<div class="card">送信しました。<br>ありがとうございます。<br><br>お会いできるのを楽しみにしております。</div>'); };
}
