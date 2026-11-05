// v1.22・SQL 352：共有メモ（オーナー 2026-11-04「広島と黒服のマイページに共有メモ」「広島の黒服は広島の黒服と私、銀座の黒服は銀座の黒服と私」
//   「パスワードも含まれるので、共有する人を限定したい」「メモのところで共有する人を私が選べるように」。見本 共有メモ_案5）
//   メモは店ごと・1件ずつ（件名・本文・リンク・ファイル（写真・PDF））。共有された黒服とオーナー（ママ＝shift_all）だけ。共有された黒服は件名・本文・リンク・ファイルを編集
//   作成・削除・共有する黒服・「パスワードあり」の印はオーナーのみ。パスワードありのメモを共有していた黒服が退店すると「要変更」（保存すると消える）
// v1.30・SQL 369：黒服も作成（オーナー 2026-11-05「メモ自体を増やしていきたい」「私が権限を設定するまでは全員に見れてていい」。見本 共有メモ_案6）。
//   黒服が作成したメモは、オーナーが共有を設定するまで店の黒服全員に表示。黒服も「パスワードあり」を付けられる（外すのはオーナーのみ）
let MEMO_ST = null, MEMO_FILES = [];

// トップのボタン：黒服は「店舗情報」の中に（v1.30：0件でも。黒服も作成できるため）。オーナーはいつも
function memoTile(){
  sb.rpc('memo_list', { p_token: TOKEN }).then(r => {
    if(r.error) return;
    const D = r.data, L = D.memos || [], n = L.filter(x => x.needs_change).length;
    const t = $('main').querySelector('.tiles[data-info]') || $('main').querySelector('.tiles'); if(!t || t.querySelector('[data-go=memo]')) return;
    t.insertAdjacentHTML('beforeend', `<button class="tile" data-go="memo"><b>共有メモ</b>${n ? `<small style="color:var(--warn)">要変更 ${n}件</small>` : L.length ? `<small>${L.length}件</small>` : ''}</button>`);
    t.querySelector('[data-go=memo]').onclick = () => memoList();
  });
}

async function memoList(store){
  setBack(home); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('memo_list', { p_token: TOKEN, p_store: store || MEMO_ST || null }); if(r.error){ fail(r.error.message); return; }
  const D = r.data, L = D.memos || []; MEMO_ST = D.store;
  const sw = D.owner && D.stores ? `<div class="seg">${D.stores.map(s => `<button data-mst="${s.code}" class="${s.code === D.store ? 'on' : ''}">${s.code === 'ginza' ? '銀座' : s.code === 'hiroshima' ? '広島' : esc(s.name)}</button>`).join('')}</div>` : '';
  show(`${sw}<div style="display:flex;justify-content:space-between;align-items:center;margin:0 2px 8px"><b>共有メモ</b>${D.owner || D.can_new ? '<button class="lkb" id="mmNew">追加</button>' : ''}</div>
    <div class="card"${L.length ? ' style="padding-top:4px"' : ''}>${L.map((x, i) => `<button data-mm="${x.id}" style="display:flex;width:100%;gap:8px;align-items:center;text-align:left;font:inherit;color:var(--ink);background:none;border:0;padding:10px 0;cursor:pointer;${i ? 'border-top:1px solid var(--line)' : ''}">
      <span style="flex:1;min-width:0"><b>${esc(x.title)}</b>${x.needs_change ? ' <small style="border:1px solid var(--warn);color:var(--warn);border-radius:6px;padding:0 6px">要変更</small>' : ''}</span><small class="muted" style="white-space:nowrap">${esc(x.updated)} 更新</small></button>`).join('') || '<div class="muted sm">共有メモはありません</div>'}</div>`);
  $('main').querySelectorAll('[data-mst]').forEach(b => b.onclick = () => { if(b.dataset.mst !== D.store) memoList(b.dataset.mst); });
  $('main').querySelectorAll('[data-mm]').forEach(b => b.onclick = () => memoView(b.dataset.mm));
  if($('mmNew')) $('mmNew').onclick = () => memoEdit(null, D);
}

// 外のページはスマホのブラウザで開く（日報のフォームと同じ）
function memoOpenUrl(u){ try{ liff.openWindow({ url: u, external: true }); }catch(e){ location.href = u; } }

async function memoView(id){
  setBack(() => memoList()); show('<div class="card c muted">読み込み中…</div>');
  const r = await sb.rpc('memo_get', { p_token: TOKEN, p_id: id }); if(r.error){ fail(r.error.message); return; }
  const M = r.data, F = M.files || [];
  const row = (k, n, attr) => `<div class="row" style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px;align-items:center"><span class="sm" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${k}　${esc(n)}</span><button class="btn g" ${attr} style="width:auto;padding:8px 18px;white-space:nowrap">表示</button></div>`;
  show(`<div style="display:flex;justify-content:space-between;align-items:center;margin:0 2px 8px;gap:8px"><b>${esc(M.title)}</b><button class="lkb" id="mmEd">編集</button></div>
    ${M.needs_change ? `<div class="card"><b class="err">要変更</b><span class="sm">　${esc(M.change_note || '')}</span></div>` : ''}
    <div class="card">${M.body ? `<div style="white-space:pre-wrap;line-height:1.7;word-break:break-all">${esc(M.body)}</div>` : ''}
      ${M.link_url ? row('リンク', M.link_name || M.link_url, 'id="mmLk"') : ''}${F.map((f, i) => row(f.t === 'pdf' ? 'PDF' : '写真', f.n, `data-mf="${i}"`)).join('')}
      <div class="muted sm" style="margin-top:10px">更新 ${esc(M.updated)}${M.updated_by ? ' ' + esc(M.updated_by) : ''}</div></div>`);
  $('mmEd').onclick = async () => { const q = M.owner ? await sb.rpc('memo_list', { p_token: TOKEN, p_store: M.store }) : { data: null }; if(q.error){ await uiAlert(q.error.message); return; } memoEdit(M, q.data); };
  if($('mmLk')) $('mmLk').onclick = () => memoOpenUrl(M.link_url);
  $('main').querySelectorAll('[data-mf]').forEach(b => b.onclick = () => memoFileOpen(M.id, F[Number(b.dataset.mf)].p));
}

// ファイルを見る：2分だけの入場券をもらってから、2分の署名つきのアドレスで開く
async function memoFileOpen(id, p){
  const q = await sb.rpc('memo_file_open', { p_token: TOKEN, p_id: id, p_path: p }); if(q.error){ await uiAlert(q.error.message); return; }
  const s = await sb.storage.from('memo-files').createSignedUrl(p, 120); if(s.error || !s.data){ await uiAlert('表示できません：' + ((s.error && s.error.message) || '')); return; }
  memoOpenUrl(s.data.signedUrl);
}

// 作成・編集。M＝今のメモ（作成は null）、D＝memo_list（オーナーの時は黒服の一覧と店。黒服の作成は自分の店）
function memoEdit(M, D){
  const own = !!(D && D.owner), store = M ? M.store : D.store, mem = new Set((M && M.members) || []);
  MEMO_FILES = ((M && M.files) || []).map(f => ({ ...f }));
  setBack(() => M ? memoView(M.id) : memoList());
  const fld = 'width:100%;box-sizing:border-box;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card);color:var(--ink)';
  show(`<div class="card"><label class="f" for="mmT">件名</label><input id="mmT" maxlength="60" value="${esc(M ? M.title : '')}" style="${fld};margin-bottom:12px">
      <label class="f" for="mmB">本文</label><textarea id="mmB" maxlength="5000" style="min-height:140px">${esc(M ? M.body : '')}</textarea>
      <label class="f" for="mmLn" style="margin-top:12px">リンク</label><input id="mmLn" maxlength="60" placeholder="名前" value="${esc((M && M.link_name) || '')}" style="${fld};margin-bottom:6px"><input id="mmLu" inputmode="url" placeholder="https://" value="${esc((M && M.link_url) || '')}" style="${fld};font-size:14px">
      <label class="f" style="margin-top:12px">ファイル（写真・PDF）</label><div id="mmFs"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px"><label class="btn g" style="width:auto;padding:8px 18px;margin:0">追加<input id="mmF" type="file" accept="image/jpeg,image/png,application/pdf" style="display:none"></label></div></div>
    <div class="card"><label style="display:flex;align-items:center;gap:10px"><input type="checkbox" id="mmPw" ${M && M.has_password ? 'checked' : ''} ${!own && M && M.has_password ? 'disabled' : ''} style="width:20px;height:20px;accent-color:var(--pri)">パスワードあり</label></div>
    ${own ? `<div class="card"><div class="f" style="margin-bottom:0">共有</div>${(D.halls || []).map(h => `<label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)"><input type="checkbox" data-mh="${h.id}" ${mem.has(h.id) ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--pri)">${esc(h.name)}</label>`).join('') || '<div class="muted sm">黒服がいません</div>'}</div>` : ''}
    <button class="btn" id="mmSv">保存</button>${own && M ? '<button class="btn g" id="mmDel" style="margin-top:8px">削除</button>' : ''}`);
  const paintFs = () => { $('mmFs').innerHTML = MEMO_FILES.map((f, i) => `<div class="row" style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px;align-items:center"><span class="sm" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.t === 'pdf' ? 'PDF' : '写真'}　${esc(f.n)}</span><button class="xb" data-mfx="${i}" aria-label="削除">×</button></div>`).join('') || '<div class="muted sm">なし</div>';
    $('mmFs').querySelectorAll('[data-mfx]').forEach(b => b.onclick = () => { MEMO_FILES.splice(Number(b.dataset.mfx), 1); paintFs(); }); };
  paintFs();
  $('mmF').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if(!f) return;
    if(MEMO_FILES.length >= 10){ await uiAlert('ファイルは10件までです'); return; }
    const pdf = f.type === 'application/pdf', ext = pdf ? 'pdf' : 'jpg';
    if(!pdf && !/^image\//.test(f.type)){ await uiAlert('写真か PDF を選んでください'); return; }
    if(f.size > 20 * 1024 * 1024){ await uiAlert('20MB までのファイルを選んでください'); return; }
    $('mmFs').insertAdjacentHTML('beforeend', '<div class="muted sm" id="mmUp" style="margin-top:8px">アップロード中…</div>');
    try{
      const blob = pdf ? f : await shrinkJpeg(f);
      const p = await sb.rpc('memo_file_new', { p_token: TOKEN, p_ext: ext }); if(p.error) throw new Error(p.error.message);
      const up = await sb.storage.from('memo-files').upload(p.data, blob, { contentType: pdf ? 'application/pdf' : 'image/jpeg', upsert: false }); if(up.error) throw new Error(up.error.message);
      MEMO_FILES.push({ p: p.data, n: f.name || (pdf ? 'ファイル.pdf' : '写真.jpg'), t: pdf ? 'pdf' : 'img' });
    }catch(err){ await uiAlert('アップロードできませんでした：' + err.message); }
    paintFs(); };
  $('mmSv').onclick = async () => { const b = $('mmSv'); b.disabled = true;
    const q = await sb.rpc('memo_save', { p_token: TOKEN, p_id: M ? M.id : null, p_store: store, p_title: $('mmT').value, p_body: $('mmB').value, p_link_name: $('mmLn').value, p_link_url: $('mmLu').value,
      p_has_password: own ? $('mmPw').checked : ($('mmPw').checked || null), p_files: MEMO_FILES, p_members: own ? [...$('main').querySelectorAll('[data-mh]')].filter(x => x.checked).map(x => x.dataset.mh) : null });
    if(q.error){ b.disabled = false; await uiAlert(q.error.message); return; }
    MEMO_ST = store; memoView(q.data.id); };
  if($('mmDel')) $('mmDel').onclick = async () => { if(!await uiConfirm(`${M.title}\n共有メモを削除しますか？`, '削除')) return;
    const q = await sb.rpc('memo_delete', { p_token: TOKEN, p_id: M.id }); if(q.error){ await uiAlert(q.error.message); return; } memoList(store); };
}
