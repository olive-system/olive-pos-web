// 開店作業「納品物」（kind shiire）と閉店作業「今日の配達・買い出しの確認」（kind kaidashi）：納品書・レシートを撮影すると、仕入れ先・品・納品書の本数を読み取って並べる。
//  黒服は数えて違う品だけ本数を修正（図3・図5・オーナー「ア この画面」2026-11-19）。メニューにある品だけ並べ、読み取れなかった品は一番下の行から足す（オーナー 問5）
//  1枚＝1つのまとまり。［追加］で2枚目。読み取りは Edge Function nohin-read（写真は残さず読むだけ）。写真は保存の時に作業の写真として置き場（todo-photos）へ送る
//  配達・買い出しで現金の仕入れ先（表に無い店も）は金額の欄。保存でレシートを PDF にして領収書の置き場（receipts）へ送り、レジの出金に自動で入る（SQL 644・秘書「ア」）
//  返品の箱は今のまま（rtCard）。前の「発注と入荷」「差の内訳」の箱は出さない（発注は記録しない。図4）
const nhSlips = {};   // 入力中の納品書・レシート（描き直しても残す）
const nhFs = 'box-sizing:border-box;font:inherit;font-size:16px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)';
const nhRow = () => ({ pid: '', name: '', slip: '', qty: '', free: false });
const nhSlip = () => ({ key: '', photo_id: '', supplier: '', date: '', amount: '', receipt_path: '', file: null, url: '', rows: [] });
const nhRowOf = r => ({ pid: r.product_id || '', name: r.product_id ? '' : r.name, slip: r.slip_qty == null ? '' : String(r.slip_qty), qty: String(r.qty), free: !r.product_id });
const nhInit = (x, D) => { if(nhSlips[x.id]) return nhSlips[x.id];
  if(D.slips) return nhSlips[x.id] = D.slips.length ? D.slips.map(g => ({ ...nhSlip(), photo_id: g.photo_id || '', supplier: g.supplier || '', amount: g.amount == null ? '' : String(g.amount), receipt_path: g.receipt_path || '', rows: (g.rows || []).map(nhRowOf) })) : [nhSlip()];
  const R = D.rows || [], key = r => r.photo_id || r.supplier || '', G = [];
  R.forEach(r => { let g = G.find(s => s.key === key(r)); if(!g){ g = { ...nhSlip(), key: key(r), photo_id: r.photo_id || '', supplier: r.supplier || '' }; G.push(g); } g.rows.push(nhRowOf(r)); });
  if(!G.length) G.push(nhSlip());
  return nhSlips[x.id] = G; };
const nhMd = d => { const m = String(d || '').match(/^\d{4}-(\d{2})-(\d{2})$/); return m ? mdW(d) : ''; };
// 現金の仕入れ先か（表に無い店は、レジから払った買い出しとして現金）
const nhCash = (S, g) => { const s = (S || []).find(p => p.name === g.supplier); return s ? s.pay === 'cash' : true; };
// 1行：読み取った品・保存した品は品名、一番下の足す行は品の選択。納品書の本数・本数の欄・×
const nhLine = (P, g, a, i, j) => { const nm = a.pid && !a.free ? esc((P.find(p => p.id === a.pid) || {}).name || '') : '';
  const pick = `<select data-nhp="${i}:${j}" style="flex:1;min-width:0;${nhFs}"><option value="">品を選択</option>${prodOpts(P, a).replace('<option value="">選択</option>', '')}</select>`;
  return `<div style="padding:8px 2px;border-top:1px solid var(--line)"><div style="display:flex;align-items:center;gap:8px">${nm ? `<span style="flex:1;min-width:0">${nm}</span>` : pick}
    ${a.slip !== '' ? `<span class="muted sm" style="width:4.6em">納品書 ${esc(a.slip)}</span>` : ''}<input data-nhq="${i}:${j}" value="${esc(a.qty)}" inputmode="numeric" maxlength="3" style="width:64px;text-align:right;${nhFs}"><span class="muted sm" style="width:1.5em">本</span><button class="xb" data-nhx="${i}:${j}" aria-label="削除" style="width:24px">×</button></div>
    <input data-nhn="${i}:${j}" maxlength="60" placeholder="品名" value="${esc(a.name)}" style="display:${a.free ? 'block' : 'none'};width:100%;margin-top:6px;${nhFs}"></div>`; };
// 配達・買い出しの仕入れ先（選択）と、現金の時の金額
const nhSup = (S, g, i) => { const L = (S || []).map(p => p.name), opt = [...L, ...(g.supplier && !L.includes(g.supplier) ? [g.supplier] : [])];
  return `<select data-nhs="${i}" style="width:100%;${nhFs}"><option value="">仕入れ先を選択</option>${opt.map(n => `<option ${n === g.supplier ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`; };
const nhYen = v => v === '' ? '' : Number(v).toLocaleString('ja-JP');
const nhMoney = (S, g, i) => `<div style="display:flex;align-items:center;gap:8px;padding:8px 2px;border-top:1px solid var(--line)"><span style="flex:1;min-width:0">${nhCash(S, g) ? '現金' : 'カード（出金なし）'}</span>
    ${nhCash(S, g) ? `<input data-nha="${i}" value="${esc(nhYen(g.amount))}" inputmode="numeric" maxlength="9" style="width:96px;text-align:right;${nhFs}"><span class="muted sm" style="width:1.5em">円</span><span style="width:24px"></span>` : ''}</div>`;
const nhSlipHtml = (P, g, i, S) => { const sm = 'display:inline-flex;align-items:center;width:auto;padding:6px 12px;font-size:14px;margin:0', shot = !!(g.file || g.photo_id);
  const cam = t => `<label class="btn g" style="${sm}">${t}<input type="file" accept="image/*" capture="environment" data-nhc="${i}" style="display:none"></label>`;
  const top = shot
    ? `<div style="display:flex;align-items:center;gap:10px;margin:8px 0 4px">${g.url ? `<img src="${g.url}" alt="" style="width:72px;height:54px;object-fit:cover;border:1px solid var(--line);border-radius:6px">` : `<div style="width:72px;height:54px;border:1px solid var(--line);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px">撮影済み</div>`}
        <div style="flex:1;min-width:0">${S && !g.reading ? nhSup(S, g, i) : `<b>${esc(g.supplier || (g.reading ? '' : '仕入れ先不明'))}</b>`}<div class="muted sm">${g.reading ? '読み取り中…' : nhMd(g.date)}</div></div>${cam('再撮影')}</div>`
    : `<div style="display:flex;align-items:center;gap:10px;margin:8px 0 4px"><label style="width:72px;height:54px;border:1.5px dashed var(--muted);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;cursor:pointer">撮影<input type="file" accept="image/*" capture="environment" data-nhc="${i}" style="display:none"></label><div class="muted sm" style="flex:1">${S ? 'レシート・納品書' : '納品書'}</div>${i ? `<button class="xb" data-nhd="${i}" aria-label="削除" style="width:24px">×</button>` : ''}</div>`;
  return `<div style="${i ? 'border-top:2px solid var(--line);margin-top:8px;padding-top:4px' : ''}">${top}${g.reading || !(shot || g.rows.length) ? '' : (S ? nhMoney(S, g, i) : '') + [...g.rows, nhRow()].map((a, j) => nhLine(P, g, a, i, j)).join('')}</div>`; };
const nhCard = (x, r, D, t, S) => { const G = nhInit(x, D), P = D.products || [];
  return `<div class="card"><div style="display:flex;align-items:center"><b style="flex:1">${t}</b><button class="btn g" id="nhAdd" style="display:inline-block;width:auto;padding:6px 12px;font-size:14px">追加</button></div>${G.map((g, i) => nhSlipHtml(P, g, i, S)).join('')}</div>${rtCard(x, r)}`; };
// 本数が空欄・0 の行は送らない（届かなかった品）。写真の番号は、保存の時に置き場へ送ってから付ける（hcSave が ids を渡す）
const nhRowsOut = g => g.rows.filter(a => (a.pid || a.name.trim()) && /^[1-9]\d{0,2}$/.test(a.qty)).map(a => ({ ...(a.free || !a.pid ? { name: a.name.trim() } : { product_id: a.pid }), qty: a.qty, slip_qty: a.slip }));
const nhPhotoIds = (G, ids) => { let k = 0; return G.map(g => g.file ? (ids || [])[k++] || '' : g.photo_id); };
function hcBodyShiire(H){ const {x, r, D, sv} = H; const body = nhCard(x, r, D, '仕入れ') + sv('完了'), G = nhSlips[x.id];
  const getData = ids => { const ph = nhPhotoIds(G, ids); return { rows: G.flatMap((g, i) => nhRowsOut(g).map(a => ({ ...a, supplier: g.supplier, photo_id: ph[i] }))), ...rtData(x) }; };
  return { body, getData }; }
function hcBodyKaidashi(H){ const {x, r, D, sv} = H; const body = nhCard(x, r, D, '配達・買い出し', D.suppliers || []) + sv('完了'), G = nhSlips[x.id];
  const getData = ids => { const ph = nhPhotoIds(G, ids);
    return { slips: G.filter((g, i) => g.file || g.photo_id || g.rows.length).map(g => ({ supplier: g.supplier, amount: g.amount, receipt_path: g.receipt_path, photo_id: ph[G.indexOf(g)], rows: nhRowsOut(g) })), ...rtData(x) }; };
  return { body, getData }; }
const nhFiles = x => (nhSlips[x.id] || []).filter(g => g.file).map(g => g.file);
const nhShot = x => (nhSlips[x.id] || []).some(g => g.file || g.photo_id);   // 1枚でも撮ったか（写真が要る項目の時）
// 配達・買い出しの現金のレシートを PDF にして領収書の置き場へ（POS の領収書精算と同じ置き場・同じ形の名前。番号は hall_receipt_paths でもらう）
let nhJsPdf = null;
const nhLoadPdf = () => window.jspdf ? Promise.resolve() : (nhJsPdf = nhJsPdf || new Promise((ok, ng) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'; s.onload = ok; s.onerror = () => { nhJsPdf = null; ng(new Error('PDF を作成できません')); }; document.head.appendChild(s); }));
async function nhPdf(f){ await nhLoadPdf(); const url = 'data:image/jpeg;base64,' + await slB64(await shrinkJpeg(f));
  const i = await new Promise((ok, ng) => { const m = new Image(); m.onload = () => ok(m); m.onerror = () => ng(new Error('写真を読み込めません')); m.src = url; });
  const W = 210, H = Math.round(W * i.naturalHeight / i.naturalWidth * 10) / 10, pdf = new window.jspdf.jsPDF({ unit: 'mm', format: [W, H], orientation: H >= W ? 'p' : 'l' }); pdf.addImage(url, 'JPEG', 0, 0, W, H); return pdf.output('blob'); }
async function nhReceipts(x, S){ const G = (nhSlips[x.id] || []).filter(g => g.file && nhCash(S, g) && (g.rows.length || g.amount !== ''));
  if(!G.length) return;
  const p = await sb.rpc('hall_receipt_paths', { p_token: TOKEN, p_task: x.id, p_count: G.length }); if(p.error) throw p.error;
  for(let k = 0; k < G.length; k++){ const up = await sb.storage.from('receipts').upload(p.data[k], await nhPdf(G[k].file), { contentType: 'application/pdf', upsert: false });
    if(up.error) throw new Error('レシートを保存できません：' + up.error.message); G[k].receipt_path = p.data[k]; } }
// 撮影したら：縮めて読み取りへ。メニューにある品だけ並べる。失敗は黙らずに知らせて、手で入力できる形に戻す（スキル olive-photo-shoot）
async function nhRead(x, g, f, again){
  g.file = f; g.photo_id = ''; g.receipt_path = ''; g.reading = true; try{ g.url = URL.createObjectURL(f); }catch(e){} again();
  try{
    const img = await slB64(await shrinkJpeg(f));
    const q = await sb.functions.invoke('nohin-read', { body: { token: TOKEN, image: img } });
    const v = q.data || {}; if(q.error && !v.reason) throw q.error;
    g.supplier = v.supplier || ''; g.date = v.date || ''; g.amount = v.amount ? String(v.amount) : '';
    g.rows = (v.rows || []).filter(a => a.product_id).map(a => ({ pid: a.product_id, name: '', slip: String(a.qty), qty: String(a.qty), free: false }));
    g.reading = false; again();
    if(!g.rows.length) await uiAlert(v.reason && /上限/.test(v.reason) ? v.reason : '読み取れませんでした。品と本数を入力してください');
  }catch(e){ g.reading = false; again(); await uiAlert('読み取れませんでした。品と本数を入力してください'); }
}
function hcWireShiire(H, again){ const {x} = H; const G = nhSlips[x.id], q = s => $('main').querySelectorAll(s), ij = v => v.split(':').map(Number);
  $('nhAdd').onclick = () => { G.push(nhSlip()); again(); };
  q('[data-nhc]').forEach(b => b.onchange = () => { const f = b.files[0]; b.value = ''; if(f) nhRead(x, G[+b.dataset.nhc], f, again); });
  q('[data-nhd]').forEach(b => b.onclick = () => { G.splice(+b.dataset.nhd, 1); again(); });
  const row = v => { const [i, j] = ij(v), g = G[i]; if(j >= g.rows.length) g.rows.push(nhRow()); return g.rows[j]; };   // 一番下の空の行に入れたら、行を足す
  q('[data-nhp]').forEach(b => b.onchange = () => { const a = row(b.dataset.nhp); a.free = b.value === 'free'; a.pid = a.free ? '' : b.value; if(a.qty === '' && a.slip === '' && !a.free) a.qty = '1'; again(); });
  q('[data-nhq]').forEach(b => b.oninput = () => { row(b.dataset.nhq).qty = b.value.trim(); });
  q('[data-nhn]').forEach(b => b.oninput = () => { row(b.dataset.nhn).name = b.value; });
  q('[data-nhx]').forEach(b => b.onclick = () => { const [i, j] = ij(b.dataset.nhx); if(j < G[i].rows.length) G[i].rows.splice(j, 1); again(); });
  q('[data-nhs]').forEach(b => b.onchange = () => { G[+b.dataset.nhs].supplier = b.value; again(); });   // 仕入れ先を変えると、現金・カードが変わる
  q('[data-nha]').forEach(b => b.oninput = () => { G[+b.dataset.nha].amount = b.value.replace(/[^\d]/g, ''); });
  rtWire(x, again);
}
const hcWireKaidashi = hcWireShiire;
