/* 画面で起きたエラーを1つの表（client_errors）に送る。お店の iPad で起きたエラーに、言われる前に気づいて直すため（07 の X1・SQL 426）。
   全部のサイトの一番初めに読む。タイムカードの古い Safari でも動くように、新しい書き方（?. など）は使わない */
(function(){
  var SITE = (location.pathname.match(/\/(pos|admin|cast|customer|timecard|key)\//) || [])[1] || '';
  var sent = {}, count = 0, MAX = 20;
  var ver = function(){ var m = document.head && document.head.innerHTML.match(/v\d+\.\d+/); return m ? m[0] : ''; };
  /* 店：マイページは STORE（銀座・広島の文字）、POS・タイムカードは store（ログインした店） */
  var whichStore = function(){
    try{ if(typeof STORE === 'string' && STORE) return STORE; }catch(e){}
    try{ if(typeof store === 'object' && store && store.id) return store.id; }catch(e){}
    return '';
  };
  /* ブラウザの拡張やほかのサイトの読み込みなど、こちらで直せない物は送らない */
  var skip = function(m, src){ return !m || /^Script error\.?$/.test(m) || /ResizeObserver loop/.test(m) || (src && !/olive-system\.github\.io|localhost|127\.0\.0\.1/.test(src)); };
  function send(o){
    if(!SITE || count >= MAX) return;
    var k = o.msg + '|' + (o.src || ''); if(sent[k]) return; sent[k] = 1; count++;
    var go = function(tries){
      if(typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined'){ if(tries < 10) setTimeout(function(){ go(tries + 1); }, 1500); return; }
      var body = { p: { site: SITE, page: (location.pathname.split('/').pop() || '') + location.hash, ver: ver(), msg: o.msg, src: o.src || '', ua: navigator.userAgent, store: whichStore() } };
      try{ fetch(SUPABASE_URL + '/rest/v1/rpc/client_error_add', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY }, body: JSON.stringify(body) }).catch(function(){}); }catch(e){}
    };
    go(0);
  }
  window.addEventListener('error', function(e){
    var src = e.filename ? e.filename.split('/').slice(-2).join('/') + ':' + e.lineno : '';
    if(skip(e.message, e.filename)) return;
    send({ msg: String(e.message).slice(0, 500), src: src });
  });
  window.addEventListener('unhandledrejection', function(e){
    var r = e.reason, m = r && (r.message || r.msg) ? (r.message || r.msg) : String(r);
    var st = r && r.stack ? String(r.stack).split('\n')[1] || '' : '';
    if(skip(m, '')) return;
    send({ msg: String(m).slice(0, 500), src: st.replace(/^\s*at\s*/, '').replace(/^.*\/olive-pos-web\//, '').slice(0, 300) });
  });
  window.oliveErr = send; /* 画面のコードで受け止めたエラーも送れるように（例 oliveErr({msg:'…'})） */
})();
