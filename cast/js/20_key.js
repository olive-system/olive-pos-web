// v1.07・SQL 326：鍵（セサミの解錠）。この人に鍵がある時だけ、トップの最後に「鍵」（今日の解錠可能時間）。オーナー 2026-11-02「ワンタッチで開けたい」
//   キャスト＝更衣室・黒服＝店と更衣室（広島は店）。押すとスマホのブラウザで鍵の画面を表示 → ホーム画面に追加して使う。退店・連携解除で使えなくなる
let KEY_MY;
async function keyTile(){
  if(KEY_MY === undefined){ const r = await sb.rpc('cast_key_my', { p_token: TOKEN }); KEY_MY = r.error ? null : r.data; }
  const t = $('main').querySelector('.tiles[data-me]') || $('main').querySelector('.tiles'); /* v1.17：黒服は「個人」の見出しの中 */ if(!KEY_MY || !t || t.querySelector('[data-go=key]')) return;
  t.insertAdjacentHTML('beforeend', `<button class="tile" data-go="key"><b>鍵</b>${KEY_MY.window ? `<small>${esc(KEY_MY.window)}</small>` : ''}</button>`);
  t.querySelector('[data-go=key]').onclick = () => { const u = new URL('../key/?t=' + encodeURIComponent(KEY_MY.t), location.href).href; try{ liff.openWindow({ url: u, external: true }); }catch(e){ location.href = u; } };
}
