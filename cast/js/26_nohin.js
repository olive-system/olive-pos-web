// 開店作業「納品物」の仕入れ：納品書を撮影すると、仕入れ先・品・納品書の本数を読み取って並べる。黒服は数えて違う品だけ本数を修正（図5・オーナー「ア この画面」2026-11-19）
//  納品書1枚＝1つのまとまり。［追加］で2枚目。読み取りは Edge Function nohin-read（写真は残さず読むだけ）。納品書の写真は保存の時に開店作業の写真として置き場へ送る
//  返品の箱は今のまま（rtCard）。前の「発注と入荷」「差の内訳」の箱は出さない（発注は記録しない。図4）
const nhSlips = {};   // 入力中の納品書（描き直しても残す）
const nhFs = 'box-sizing:border-box;font:inherit;font-size:16px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)';
const nhRow = () => ({ pid: '', name: '', slip: '', qty: '', read: '', free: false });
const nhInit = (x, D) => { if(nhSlips[x.id]) return nhSlips[x.id];
  const R = D.rows || [], key = r => r.photo_id || r.supplier || '', G = [];
  R.forEach(r => { let g = G.find(s => s.key === key(r)); if(!g){ g = { key: key(r), photo_id: r.photo_id || '', supplier: r.supplier || '', date: '', file: null, url: '', rows: [] }; G.push(g); }
    g.rows.push({ pid: r.product_id || '', name: r.product_id ? '' : r.name, slip: r.slip_qty == null ? '' : String(r.slip_qty), qty: String(r.qty), read: '', free: !r.product_id }); });
  if(!G.length) G.push({ key: '', photo_id: '', supplier: '', date: '', file: null, url: '', rows: [] });
  return nhSlips[x.id] = G; };
const nhMd = d => { const m = String(d || '').match(/^\d{4}-(\d{2})-(\d{2})$/); return m ? mdW(d) : ''; };
// 1行：照らせた品は品名、照らせない品は品の選択（下に納品書の品名）。納品書の本数・本数の欄・×
const nhLine = (P, g, a, i, j) => { const nm = a.pid && !a.free ? esc((P.find(p => p.id === a.pid) || {}).name || '') : '';
  const pick = `<select data-nhp="${i}:${j}" style="flex:1;min-width:0;${nhFs}"><option value="">品を選択</option>${prodOpts(P, a).replace('<option value="">選択</option>', '')}</select>`;
  return `<div style="padding:8px 2px;border-top:1px solid var(--line)"><div style="display:flex;align-items:center;gap:8px">${nm && !a.read ? `<span style="flex:1;min-width:0">${nm}</span>` : pick}
    ${a.slip !== '' ? `<span class="muted sm" style="width:4.6em">納品書 ${esc(a.slip)}</span>` : ''}<input data-nhq="${i}:${j}" value="${esc(a.qty)}" inputmode="numeric" maxlength="3" style="width:64px;text-align:right;${nhFs}"><span class="muted sm" style="width:1.5em">本</span><button class="xb" data-nhx="${i}:${j}" aria-label="削除" style="width:24px">×</button></div>
    ${a.read ? `<div class="muted sm" style="margin-top:4px">納品書：${esc(a.read)}</div>` : ''}<input data-nhn="${i}:${j}" maxlength="60" placeholder="品名" value="${esc(a.name)}" style="display:${a.free ? 'block' : 'none'};width:100%;margin-top:6px;${nhFs}"></div>`; };
const nhSlipHtml = (P, g, i) => { const sm = 'display:inline-block;width:auto;padding:6px 12px;font-size:14px;margin:0', shot = !!(g.file || g.photo_id);
  const cam = t => `<label class="btn g" style="${sm}">${t}<input type="file" accept="image/*" capture="environment" data-nhc="${i}" style="display:none"></label>`;
  const top = shot
    ? `<div style="display:flex;align-items:center;gap:10px;margin:8px 0 4px">${g.url ? `<img src="${g.url}" alt="" style="width:72px;height:54px;object-fit:cover;border:1px solid var(--line);border-radius:6px">` : `<div style="width:72px;height:54px;border:1px solid var(--line);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px">撮影済み</div>`}
        <div style="flex:1;min-width:0"><b>${esc(g.supplier || (g.reading ? '' : '仕入れ先不明'))}</b><div class="muted sm">${g.reading ? '読み取り中…' : nhMd(g.date)}</div></div>${cam('再撮影')}</div>`
    : `<div style="display:flex;align-items:center;gap:10px;margin:8px 0 4px"><label style="width:72px;height:54px;border:1.5px dashed var(--muted);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;cursor:pointer">撮影<input type="file" accept="image/*" capture="environment" data-nhc="${i}" style="display:none"></label><div class="muted sm" style="flex:1">納品書</div>${i ? `<button class="xb" data-nhd="${i}" aria-label="削除" style="width:24px">×</button>` : ''}</div>`;
  return `<div style="${i ? 'border-top:2px solid var(--line);margin-top:8px;padding-top:4px' : ''}">${top}${g.reading ? '' : [...g.rows, nhRow()].map((a, j) => nhLine(P, g, a, i, j)).join('')}</div>`; };
function hcBodyShiire(H){ const {x, r, D, sv} = H; const G = nhInit(x, D), P = D.products || [];
  const body = `<div class="card"><div style="display:flex;align-items:center"><b style="flex:1">仕入れ</b><button class="btn g" id="nhAdd" style="display:inline-block;width:auto;padding:6px 12px;font-size:14px">追加</button></div>${G.map((g, i) => nhSlipHtml(P, g, i)).join('')}</div>${rtCard(x, r)}${sv('完了')}`;
  // 本数が空欄・0 の行は送らない（届かなかった品）。納品書の写真の番号は、保存の時に置き場へ送ってから付ける（nhPhotoIds）
  const getData = ids => { let k = 0;
    const un = G.flatMap(g => g.rows).find(a => !a.pid && !a.free && /^[1-9]/.test(a.qty));   // 読み取りで照らせない品は、選ぶまで保存しない
    if(un) throw new Error(`${un.read || '品'}の品を選択してください`); const ph = G.map(g => g.file ? (ids || [])[k++] || '' : g.photo_id);
    return { rows: G.flatMap((g, i) => g.rows.filter(a => (a.pid || a.name.trim()) && /^[1-9]\d{0,2}$/.test(a.qty)).map(a => ({ ...(a.free || !a.pid ? { name: a.name.trim() } : { product_id: a.pid }), qty: a.qty, slip_qty: a.slip, supplier: g.supplier, photo_id: ph[i] }))), ...rtData(x) }; };
  return { body, getData }; }
const nhFiles = x => (nhSlips[x.id] || []).filter(g => g.file).map(g => g.file);
// 撮影したら：縮めて読み取りへ。読めた品を並べる（照らせない品は選択）。失敗は黙らずに知らせて、手で入力できる形に戻す（スキル olive-photo-shoot）
async function nhRead(x, g, f, again){
  g.file = f; g.photo_id = ''; g.reading = true; try{ g.url = URL.createObjectURL(f); }catch(e){} again();
  try{
    const img = await slB64(await shrinkJpeg(f));
    const q = await sb.functions.invoke('nohin-read', { body: { token: TOKEN, image: img } });
    const v = q.data || {}; if(q.error && !v.reason) throw q.error;
    g.supplier = v.supplier || ''; g.date = v.date || '';
    g.rows = (v.rows || []).map(a => ({ pid: a.product_id || '', name: '', slip: String(a.qty), qty: String(a.qty), read: a.product_id ? '' : a.name, free: false }));
    g.reading = false; again();
    if(!g.rows.length) await uiAlert(v.reason && /上限/.test(v.reason) ? v.reason : '読み取れませんでした。品と本数を入力してください');
  }catch(e){ g.reading = false; again(); await uiAlert('読み取れませんでした。品と本数を入力してください'); }
}
function hcWireShiire(H, again){ const {x, D} = H; const G = nhSlips[x.id], q = s => $('main').querySelectorAll(s), ij = v => v.split(':').map(Number);
  $('nhAdd').onclick = () => { G.push({ key: '', photo_id: '', supplier: '', date: '', file: null, url: '', rows: [] }); again(); };
  q('[data-nhc]').forEach(b => b.onchange = () => { const f = b.files[0]; b.value = ''; if(f) nhRead(x, G[+b.dataset.nhc], f, again); });
  q('[data-nhd]').forEach(b => b.onclick = () => { G.splice(+b.dataset.nhd, 1); again(); });
  const row = v => { const [i, j] = ij(v), g = G[i]; if(j >= g.rows.length) g.rows.push(nhRow()); return g.rows[j]; };   // 一番下の空の行に入れたら、行を足す
  q('[data-nhp]').forEach(b => b.onchange = () => { const a = row(b.dataset.nhp); a.free = b.value === 'free'; a.pid = a.free ? '' : b.value; if(a.qty === '' && a.slip === '' && !a.free) a.qty = '1'; again(); });
  q('[data-nhq]').forEach(b => b.oninput = () => { row(b.dataset.nhq).qty = b.value.trim(); });
  q('[data-nhn]').forEach(b => b.oninput = () => { row(b.dataset.nhn).name = b.value; });
  q('[data-nhx]').forEach(b => b.onclick = () => { const [i, j] = ij(b.dataset.nhx); if(j < G[i].rows.length) G[i].rows.splice(j, 1); again(); });
  rtWire(x, again);
}
