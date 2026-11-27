/* 画面で起きたエラーを1つの表（client_errors）に送る。お店の iPad で起きたエラーに、言われる前に気づいて直すため（07 の X1）。
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
  var skip = function(m, src){ return !m || /^Script error\.?$/.test(m) || /ResizeObserver loop/.test(m) || /runtime\.sendMessage|Extension context invalidated|chrome-extension:|moz-extension:|safari-web-extension:/.test(m) /* ブラウザの拡張機能のエラー（OLIVE のコードではない。promise のエラーは src が空ですり抜けた） */ || (src && !/olive-system\.github\.io|localhost|127\.0\.0\.1/.test(src)); };
  function send(o){
    if(!SITE || count >= MAX) return;
    var k = o.msg + '|' + (o.src || ''); if(sent[k]) return; sent[k] = 1; count++;
    var go = function(tries){
      if(typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined'){ if(tries < 10) setTimeout(function(){ go(tries + 1); }, 1500); return; }
      /* 本番の表には、お店の画面のエラーだけを入れる。手元の試し・見本の道具（本番のサイトでない画面）と、Mac の自動の確かめ（HeadlessChrome）は送らない（2026-11-18 日報に「お店への影響：あり」と出ていた） */
      if(SUPABASE_URL.indexOf('gjqaxenwvvazhjtziusf') >= 0 && (location.hostname !== 'olive-system.github.io' || /HeadlessChrome/.test(navigator.userAgent))) return;
      var body = { p: { site: SITE, page: (location.pathname.split('/').pop() || '') + location.hash, ver: ver(), msg: o.msg, src: o.src || '', ua: navigator.userAgent, store: whichStore() } };
      try{ fetch(SUPABASE_URL + '/rest/v1/rpc/client_error_add', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY }, body: JSON.stringify(body) }).catch(function(){}); }catch(e){}
    };
    go(0);
  }
  /* 古い端末（iOS 12 の Safari など）は、POS・管理サイト・マイページ・顧客サイトの書き方（?. など）を読めない。
     画面が出ないまま、読めなかったファイルの数だけエラーが記録され、日報に何十回も並んでいた。
     読めない端末には知らせを出し、記録は1回だけにする。タイムカード・鍵は古い iPad で動かす決まりなので対象外 */
  if(/^(pos|admin|cast|customer)$/.test(SITE)){
    var old = false; try{ new Function('var a = {}; return a?.b ?? 1'); }catch(e){ old = true; }
    if(old){
      send({ msg: '古い端末のため表示できません', src: '' }); count = MAX;
      /* マイページはキャストのスマホで開くので「端末」。ほかはお店の iPad */
      var show = function(){
        document.body.style.background = 'var(--bg)';
        document.body.innerHTML = '<div style="padding:40px 16px 0"><div style="max-width:480px;margin:0 auto;padding:20px 16px;background:var(--card);border:1px solid var(--line);border-radius:14px;color:var(--ink);text-align:left;font-size:16px;line-height:1.6">'
          + '<b style="display:block;font-size:18px;margin-bottom:8px">この' + (SITE === 'cast' ? '端末' : ' iPad ') + 'は古いため、表示できません</b>新しい端末で表示してください</div></div>';
      };
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
    }
  }
  /* 新しい版を入れている数分の間は、新しいページと古い部品（端末に10分まで残る）が混ざって、
     読み込みの途中で止まることがある（2026-11-17 #524 の直後の「Can't find variable: mdW」）。
     白い画面や壊れた画面のままにせず、使っている人に「更新中で、数分で戻る」と分かるようにして、自動で読み直す。
     読み込みの途中のエラーだけを見る：開いた後の1つのボタンのまちがいで、使える画面まで止めないため */
  var UPD = (function(){
    if(!/^(pos|admin|cast|customer|timecard)$/.test(SITE)) return null;
    var KEY = 'olive_upd_t', TICK = 30000, LIMIT = 600000, loadedAt = 0, box = null, timer = null;
    var ss = function(k, v){ try{ if(v === undefined) return sessionStorage.getItem(k); if(v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); }catch(e){} return null; };
    window.addEventListener('load', function(){
      loadedAt = Date.now();
      /* 読み直した後に無事に開けたら、10分の数え始めを消す */
      setTimeout(function(){ if(!box) ss(KEY, null); }, 20000);
    });
    var inLoad = function(){ return !loadedAt || Date.now() - loadedAt < 3000; };
    /* 入力の途中（文字を打っている・打った文字がまだ保存されていない）は読み直さない */
    var typing = function(){
      var a = document.activeElement;
      if(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return true;
      var f = document.querySelectorAll('textarea, input[type=text], input[type=number], input[type=tel], input:not([type])');
      for(var i = 0; i < f.length; i++){ if(f[i].value !== f[i].defaultValue) return true; }
      return false;
    };
    var text = function(late){
      var h = late ? '画面を表示できません' : 'システム更新中', m = late ? '店長に連絡してください' : '数分後に自動で再表示します';
      return '<div style="font-size:20px;font-weight:700">' + h + '</div><div style="margin-top:8px;font-size:16px;line-height:1.6">' + m + '</div>';
    };
    var tick = function(){
      var t0 = +ss(KEY) || Date.now(), late = Date.now() - t0 >= LIMIT;
      box.firstChild.innerHTML = text(late);
      if(!typing()) location.reload();
    };
    var show = function(){
      if(box) return;
      if(!ss(KEY)) ss(KEY, String(Date.now()));
      var put = function(){
        if(box || !document.body) return;
        /* 「新しい版があります」の知らせとは同時に出さない */
        var st = document.createElement('style'); st.textContent = '#verBar{display:none!important}'; document.head.appendChild(st);
        box = document.createElement('div'); box.id = 'oliveUpd';
        box.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
        box.innerHTML = '<div style="width:100%;max-width:420px;padding:22px 24px;background:#fff;border-radius:16px;color:var(--ink,#1a1a1a);text-align:left;font-family:\'Zen Kaku Gothic New\',-apple-system,\'Hiragino Sans\',sans-serif"></div>';
        document.body.appendChild(box);
        var t0 = +ss(KEY) || Date.now();
        box.firstChild.innerHTML = text(Date.now() - t0 >= LIMIT);
        timer = setInterval(tick, TICK);
      };
      if(document.body) put(); else document.addEventListener('DOMContentLoaded', put);
    };
    var own = function(u){ return !u || u.indexOf(location.origin) === 0; };
    return {
      /* 読み込みの途中に、自分のサイトのファイルで、名前が見つからない・書き方が読めない・関数が無い */
      onError: function(e){
        if(!inLoad() || !own(e.filename)) return;
        if(/ReferenceError|Can't find variable|is not defined|SyntaxError|Unexpected (token|identifier|end)|is not a function/.test(String(e.message))) show();
      },
      /* 読み込むファイルそのものが取れなかった（入れかえの途中で見つからない） */
      onMissing: function(t){
        if(!inLoad()) return;
        var u = t.src || t.href || '';
        if(/^(SCRIPT|LINK)$/.test(t.tagName) && u && own(u)) show();
      },
      show: show
    };
  })();
  /* ファイルが取れなかった時の知らせは window まで上がらないので、捕まえる側で受ける */
  window.addEventListener('error', function(e){ if(UPD && e.target && e.target !== window && e.target.tagName) UPD.onMissing(e.target); }, true);
  window.addEventListener('error', function(e){
    if(!e.message) return; /* ファイルが取れなかった時（上で受けた） */
    if(UPD) UPD.onError(e);
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
  /* データベースが断った文のうち、作りの漏れで起きる物（権限が無い・関数や表や列が無い・PostgREST が関数を見つけられない）も送る。
     画面は確かめの箱で文を見せるだけで、どこにも残らなかった（2026-11-27 体験の受け取りのサインが 11/17 から permission denied で止まっていたのに気づけなかった）。
     ふつうの断り（入力の誤り・止め＝raise の P0001 など）は送らない */
  var DB_CODE = /^(42501|42883|42P01|42703|PGRST20[0-9])$/, DB_MSG = /permission denied|does not exist|schema cache/i;
  if(window.fetch){
    var fetch0 = window.fetch;
    window.fetch = function(input, init){
      var p = fetch0.apply(this, arguments);
      try{
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if(url.indexOf('/rest/v1/') >= 0 && url.indexOf('client_error_add') < 0){
          p.then(function(res){
            if(!res || res.ok || res.status < 400) return;
            res.clone().json().then(function(j){
              var code = j && j.code ? String(j.code) : '', m = j && j.message ? String(j.message) : '';
              if(!DB_CODE.test(code) && !DB_MSG.test(m)) return;
              var where = url.split('/rest/v1/')[1] || ''; where = where.split('?')[0];
              send({ msg: ('データベースが断った（' + code + '）：' + m).slice(0, 500), src: where.slice(0, 300) });
            })['catch'](function(){});
          })['catch'](function(){});
        }
      }catch(e){}
      return p;
    };
  }
  window.oliveErr = send; /* 画面のコードで受け止めたエラーも送れるように（例 oliveErr({msg:'…'})） */
})();
