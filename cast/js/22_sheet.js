// v1.21・SQL 350：LINE で入力するヒアリングシート（任意）（2026-11-04 オーナーが紙の41項目から33項目を選んだ。元 もらったもの/ヒアリングシートの項目_銀座（2026-10-27）.md）
//   あいさつの［ヒアリングシート］→ ?go=sheet。応募の人の画面なので「LINEマイページ」は出さない。報酬は出さない。銀座と広島で 希望条件の例・営業連絡の人数 がちがう
//   その人のページ（21_applicant.js）の「面接」の箱に、入力の中身を出す
const SH_HR = () => STORE === 'hiroshima';
// [キー, 見出し, 形, 選ぶもの／例]。形：text・tel・date・num（単位）・seg（選ぶ）・sel（プルダウン）
const SHEET = staff => [
  ['本人のこと', [
    ['job', '昼職・学生', 'seg', ['昼職', '学生']],
    ['birth', '生年月日', 'date'],
    ['tel', '電話番号', 'tel'],
    ['addr', '住所', 'text'],
    ['commute', '交通手段（実費）', 'text', '例：電車・タクシー'],
    ['wish', '希望条件', 'text', SH_HR() ? '例：月収 ○万円・時給 ○円' : '例：時給 ○円／日給 ○円'],
    ['media', 'どこで知りましたか', 'text', '例：Instagram・ホームページ・ご紹介'],
  ]],
  ['お仕事のこと', [
    ['position', '希望ポジション', 'seg', ['キャスト', '黒服']],
    ['alcohol', 'お酒は飲めますか', 'seg', ['飲める', '少し', '飲めない']],
    ['partner', 'パートナーはいますか', 'seg', ['はい', 'いいえ']],
    ['braces', '歯科矯正（今、器具をつけていますか）', 'seg', ['はい', 'いいえ']],
    ['height', '身長', 'num', 'cm'], ['weight', '体重', 'num', 'kg'], ['bust', 'バスト', 'text', '例：C'],
    ['exp', 'このお仕事の経験', 'seg', ['あり', 'なし']],
    ['prev_shop', '前のお店の名前', 'text', '', 'exp'], ['prev_wage', '前のお店の時給', 'num', '円', 'exp'], ['prev_term', '前のお店の勤務期間', 'text', '例：1年', 'exp'], ['prev_sales', '前のお店の個人売上', 'num', '円', 'exp'],
    ['guests', 'OLIVE に呼べるお客様', 'num', '人'], ['guests_1m', 'そのうち1か月以内に呼べるお客様', 'num', '人'],
    ['douhan', '同伴はできますか（時間的に）', 'seg', ['可能', '不可能']],
    ['after', 'アフター（2〜3時に解散）はできますか', 'seg', ['可能', '不可能']],
  ]],
  ['出勤のこと', [
    ['days', '出勤希望日数（週）', 'sel', ['', '1日', '2日', '3日', '4日', '5日', '6日']],
    ['time_from', '希望時間帯（から）', 'sel', ['', '19:50', '20:00', '20:30', '21:00', '21:30', '22:00']], ['time_to', '希望時間帯（まで）', 'sel', ['', '0:00', '0:30', '1:00', '1:30', '2:00', 'ラスト']],
    ['term', '希望期間', 'seg', ['短期', '無期限']],
    ['start', 'いつから出勤できますか', 'seg', ['今週', '来週', 'それ以降']],
    ['trial', '体験入店の希望', 'seg', ['はい', 'いいえ']],
    ['trial_d1', '体験の候補日 1', 'date', '', 'trial'], ['trial_d2', '体験の候補日 2', 'date', '', 'trial'], ['trial_d3', '体験の候補日 3', 'date', '', 'trial'],
  ]],
  ['お約束', [
    ['hair', 'ヘアセット（2,000円前後）', 'seg', ['可能', '不可能']],
    ['fare', '交通費は実費・1時まで', 'seg', ['可能', 'たまになら', '不可能']],
    ['contact', 'お客様と連絡先交換・営業連絡', 'seg', ['可能', '不可能']],
    ['contact_n', `1日${SH_HR() ? '10' : '30'}名以上、営業連絡の時間が取れますか`, 'seg', ['可能', '不可能']],
  ]],
  ...(staff ? [['面接官メモ', [   /* v1.21：お店が書き込む欄（紙の「面接官 Memo」。オーナー 2026-11-04「ヒアリングシートには結構こちらで書き込む」） */
    ['genji', '源氏名の案', 'text'],
    ['ref', '紹介した人', 'text'],
    ['check17', '17点確認', 'seg', ['完了', '未完了']],
  ]]] : [])];
const SH_FS = 'width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);height:46px';
// 入力の中身を「見出し：答え」の行にする（その人のページで使う）
// 生年月日から今日の年齢（v1.32：オーナー 2026-11-05「生年月日の横に自動で年齢」）
function shAge(b){ const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(b || ''); if(!m) return ''; const t = new Date(Date.now() + 9 * 3600e3), y = t.getUTCFullYear(), md = (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
  const a = y - +m[1] - (md < +m[2] * 100 + +m[3] ? 1 : 0); return a >= 0 && a < 120 ? `（${a}歳）` : ''; }
function sheetLines(h){ if(!h) return []; const L = [];
  SHEET(true).forEach(([, items]) => items.forEach(([k, lb, t, o]) => { const v = h[k]; if(v == null || v === '') return; L.push([lb, t === 'num' ? `${v}${o}` : k === 'birth' ? `${v}${shAge(v)}` : v]); })); return L; }

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
  if(g.data.locked){ show('<div class="ttl">ヒアリングシート</div><div class="card">送信済です</div>'); return; } /* v1.44・SQL 392：お店が［編集］で保存したら本人は修正不可（オーナー 2026-11-07） */
  show(`<div class="ttl">ヒアリングシート</div>${g.data.sent_at ? '<div class="card sm">送信済です。変更する時は、再度送信してください</div>' : ''}${sheetBody(g.data.hearing || {}, false)}<button class="btn" id="shOk">送信</button><div style="height:20px"></div>`);
  const get = sheetWire($('main'));
  $('shOk').onclick = async e => { const o = get(false); if(!Object.keys(o).length){ await uiAlert('入力してから送信してください'); return; }
    e.target.disabled = true; const q = await sb.rpc('applicant_sheet_save', { p_store: STORE, p_id_token: idt, p: o });
    if(q.error){ e.target.disabled = false; await uiAlert(q.error.message); return; }
    show('<div class="card">送信しました。<br>ありがとうございます。<br><br>お会いできるのを楽しみにしております。</div>'); };
}
