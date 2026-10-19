// ---------- まだ作っていない画面 ----------
function pagePending(k){ $('main').innerHTML=`<h1>${esc(nameOf(k))}</h1><div class="card muted">この画面はこれから作ります</div>`; }

const PAGES={};
// 見られる画面が1つもない時
PAGES.none=()=>{ $('main').innerHTML=`<div class="card muted">見られる画面がありません。オーナーに「表示設定」で選んでもらってください</div>`; };

