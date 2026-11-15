// 文芸誌 — しおり（ミッドナイトブルーの鳥の羽）
// ※ これはプログラムのファイルです。書きかえないでください。
//   本の文字（題・作品など）を変えるときは、literatures/book.js（sample の外のほう）を書きかえます。
//
// 「しおりをはさむ」を押すと、大きな羽が上からゆらゆらと降りてきて、いまの見開きの背にはさまる。
//   しおりの見開きでは羽ぜんぶが見え、ほかのページでは本の上のふちから先だけがのぞく。
// 「しおりまでもどる」で、しおりの見開きまで紙をめくる。
// しおりの場所はこのブラウザに覚えておくので、読みこみ直しても残る。
(function () {
  // ---------- 羽の絵（SVG） ----------
  // たて長の羽。左の羽弁が広く、右がせまい。羽枝の筋、ところどころの裂け目、根元の綿毛
  function featherSVG() {
    const rachisX = function (y) { return 60.8 + 7.2 * (548 - y) / 534; };  // 軸の x（下 548 → 先 14）
    let barbs = '';
    for (let y = 22; y <= 540; y += 4.2) {
      const x = rachisX(y);
      barbs += 'M' + (x - 0.8).toFixed(1) + ' ' + y.toFixed(1) +
        ' Q' + (x - 28).toFixed(1) + ' ' + (y - 10).toFixed(1) + ' ' + (x - 64).toFixed(1) + ' ' + (y - 38).toFixed(1);
      barbs += 'M' + (x + 0.8).toFixed(1) + ' ' + y.toFixed(1) +
        ' Q' + (x + 24).toFixed(1) + ' ' + (y - 9).toFixed(1) + ' ' + (x + 52).toFixed(1) + ' ' + (y - 34).toFixed(1);
    }
    // 先の丸い、幅のある羽弁（左が広く、右がせまい）
    const vane = 'M60.8 548 C36 540 12 498 9 428 C6 340 8 240 18 160 C26 96 42 34 62 12 ' +
                 'C66 7 72 7 76 13 C92 40 102 110 105 196 C109 300 105 400 94 468 C86 518 72 542 60.8 548 Z';
    return '' +
      '<svg viewBox="0 0 120 640" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        // ミッドナイトブルー：ふちほど深く、軸のまわりにだけ、かすかな青み
        '<linearGradient id="feather-fill" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#070b1f"/><stop offset="0.4" stop-color="#141c44"/>' +
          '<stop offset="0.56" stop-color="#1e2a5e"/><stop offset="0.7" stop-color="#141c44"/>' +
          '<stop offset="1" stop-color="#070b1f"/>' +
        '</linearGradient>' +
        '<linearGradient id="feather-sheen" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#9fb2ff" stop-opacity="0.16"/>' +
          '<stop offset="0.45" stop-color="#9fb2ff" stop-opacity="0"/>' +
          '<stop offset="1" stop-color="#000" stop-opacity="0.3"/>' +
        '</linearGradient>' +
        '<linearGradient id="feather-rachis" x1="0" y1="1" x2="0" y2="0">' +
          '<stop offset="0" stop-color="#f3e4c8" stop-opacity="0.85"/>' +
          '<stop offset="1" stop-color="#f3e4c8" stop-opacity="0.3"/>' +
        '</linearGradient>' +
        // 羽弁の形から、裂け目を抜いた型
        '<mask id="feather-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="640">' +
          '<path d="' + vane + '" fill="#fff"/>' +
          '<path d="M0 372 L0 381 L38 408 Z M2 228 L2 236 L34 260 Z M114 294 L114 302 L82 326 Z M108 120 L108 127 L84 146 Z" fill="#000"/>' +
        '</mask>' +
      '</defs>' +
      '<g mask="url(#feather-mask)">' +
        '<rect width="120" height="640" fill="url(#feather-fill)"/>' +
        '<path d="' + barbs + '" fill="none" stroke="#f3e4c8" stroke-opacity="0.11" stroke-width="0.7"/>' +
        '<path d="' + barbs + '" fill="none" stroke="#060a1c" stroke-opacity="0.35" stroke-width="0.6" transform="translate(0 2.2)"/>' +
        '<rect width="120" height="640" fill="url(#feather-sheen)"/>' +
        '<path d="' + vane + '" fill="none" stroke="#f3e4c8" stroke-opacity="0.28" stroke-width="1"/>' +
      '</g>' +
      // 根元の綿毛
      '<g fill="none" stroke-linecap="round">' +
        '<path d="M60.6 552 q-8 0 -13 -9 q-2 -4 -6 -5 M60.6 558 q-11 2 -18 -5 M60.6 564 q-7 -1 -12 -9 ' +
                 'M60.5 571 q-9 4 -15 -1 M60.5 579 q-5 3 -9 0 M60.6 555 q7 -1 11 -9 q2 -3 5 -3 ' +
                 'M60.6 562 q10 1 15 -6 M60.6 569 q6 2 11 -3 M60.5 576 q7 3 10 -1" ' +
              'stroke="#1e2a5e" stroke-opacity="0.55" stroke-width="1.1"/>' +
        '<path d="M60.6 557 q-9 0 -14 -7 M60.6 566 q8 1 12 -5" stroke="#f3e4c8" stroke-opacity="0.14" stroke-width="0.5"/>' +
      '</g>' +
      // 軸（先にいくほど細く）と、羽柄
      '<path d="M59.4 548 L67.6 16 L68.3 16 L62.3 548 Z" fill="url(#feather-rachis)"/>' +
      '<path d="M60.8 548 C60.4 580 60.1 610 60 636" stroke="#f3e4c8" stroke-opacity="0.75" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
      '</svg>';
  }

  window.Kotoba.createBookmark = function (book) {
    const stage = document.querySelector('.stage');
    const marks = document.getElementById('marks');
    const putButton = document.getElementById('mark-put');
    const goButton = document.getElementById('mark-go');
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const feather = document.createElement('div');
    feather.className = 'feather';
    feather.setAttribute('aria-hidden', 'true');
    feather.innerHTML = featherSVG();
    stage.appendChild(feather);

    // しおりの場所（めくった紙の枚数）。本ごとに分けて覚える
    const key = 'kotoba-bookmark:' + document.title;
    function load() {
      try {
        const value = parseInt(localStorage.getItem(key), 10);
        return value >= 1 && value <= book.count ? value : null;
      } catch (error) { return null; }
    }
    function save(value) {
      try { localStorage.setItem(key, String(value)); } catch (error) { /* 覚えられなくても、いまは使える */ }
    }

    function forget() {
      try { localStorage.removeItem(key); } catch (error) { /* 何もしない */ }
    }

    let saved = load();
    let current = 0;
    let ready = false;     // 表紙の文字が出揃ったか
    let lifting = false;   // はずした羽が、舞い上がっているところか

    function render() {
      const open = current > 0;
      const here = open && saved != null && saved === current;
      marks.classList.toggle('is-shown', ready && open);
      // しおりの見開きにいるあいだは「はずす」、ほかのページでは「はさむ」（はさみ直す）
      putButton.textContent = here ? 'しおりをはずす' : 'しおりをはさむ';
      putButton.disabled = !open;
      goButton.disabled = !open || saved == null || saved === current;
      feather.classList.toggle('is-placed', open && (saved != null || lifting));
      feather.classList.toggle('is-here', here || lifting);
    }

    function restart(name) {
      feather.classList.remove('is-falling', 'is-landed', 'is-lifting');
      void feather.offsetWidth;          // 動きを、最初から
      feather.classList.add(name);
    }

    putButton.addEventListener('click', function () {
      if (current === 0) return;
      if (saved === current) {
        // はずす：羽がふわりと舞い上がって、上へ消えていく
        saved = null;
        forget();
        lifting = !reduceMotion;
        render();
        if (lifting) restart('is-lifting');
        return;
      }
      // はさむ：上から羽が降りてくる
      saved = current;
      save(saved);
      lifting = false;
      render();
      if (reduceMotion) return;
      restart('is-falling');
    });
    goButton.addEventListener('click', function () {
      if (saved != null) book.goTo(saved);
    });
    feather.addEventListener('animationend', function (event) {
      if (event.target !== feather) return;
      if (event.animationName === 'feather-fall') {
        feather.classList.remove('is-falling');
        feather.classList.add('is-landed');   // はさまったところで、ふわりと光る
      } else if (event.animationName === 'feather-land') {
        feather.classList.remove('is-landed');
      } else if (event.animationName === 'feather-lift') {
        feather.classList.remove('is-lifting');
        lifting = false;
        render();
      }
    });

    return {
      update: function (value) { current = value; render(); },
      lettersDone: function () { ready = true; render(); },
      // 本を本棚にしまったとき：次に取り出して文字が出揃うまで、ボタンを出さない
      reset: function () { ready = false; render(); }
    };
  };
})();
