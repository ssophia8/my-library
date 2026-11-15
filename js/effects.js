// 図書館 — 場面の演出（雨・光の刃・水彩のにじみ）
// ※ これはプログラムのファイルです。書きかえないでください。
//   どの場面で何が起きるかは、作品のファイルの scenes に書きます（例：literatures/kaminoko/honbun.js）。
//
//   { effect: 'rain',  at: '本文の言葉', level: 0〜1 } … その言葉のページから雨が降る（0 でやむ）。次の rain まで続く
//   { effect: 'blade', at: '本文の言葉' }              … その言葉の見開きで、一筋の光が斜めに差しこむ
//   { effect: 'bleed', at: '本文の言葉' }              … その言葉のあたりに、水彩の色がにじむ（js/pages.js が置く）
//
// js/pages.js が、それぞれの言葉が何ページ目に来たかを Kotoba.scenes に入れておき、
// js/main.js が見開きを変えるたびに Kotoba.effects.show(めくった枚数) を呼びます。
(function () {
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const back = document.getElementById('rain-back');
  const front = document.getElementById('rain-front');
  const stage = document.querySelector('.stage');

  function scenes(effect) {
    return (window.Kotoba.scenes || []).filter(function (s) { return s.effect === effect; });
  }

  // ---------- 雨 ----------
  let width = 0;
  let height = 0;
  let ratio = 1;
  let level = 0;       // いまの雨の強さ（0〜1）
  let target = 0;      // めざす強さ（場面が変わると、ゆっくりそこへ近づく）
  let drops = [];
  let running = false;
  let lastTime = 0;

  function resize() {
    if (!back) return;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    [back, front].forEach(function (canvas) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
    });
    const count = Math.round(width * height / 2600);   // いちばん強い雨のときの粒の数
    drops = [];
    for (let i = 0; i < count; i++) drops.push(newDrop(true));
  }

  function newDrop(anywhere) {
    const near = Math.random();                 // 1 に近いほど手前（長く、速く、太い）
    return {
      x: Math.random() * (width + 200) - 100,
      y: anywhere ? Math.random() * height : -Math.random() * height * 0.3 - 40,
      len: 14 + near * 46,
      speed: 900 + near * 900,                  // 1 秒に進む距離
      width: 0.5 + near * 1.1,
      alpha: 0.18 + near * 0.42,
      near: near,
    };
  }

  const WIND = 0.16;   // 雨のかたむき（右上から左下へ、少しだけ）

  function draw(time) {
    const dt = Math.min(0.05, (time - (lastTime || time)) / 1000);
    lastTime = time;
    // 強さはゆっくり変わる（降りはじめは 2 秒ほど、やむときは 3 秒ほど）
    const rate = target > level ? 0.6 : 0.35;
    level += (target - level) * Math.min(1, dt * rate * 2);
    if (Math.abs(target - level) < 0.003) level = target;

    const bc = back.getContext('2d');
    const fc = front.getContext('2d');
    bc.clearRect(0, 0, width, height);
    fc.clearRect(0, 0, width, height);

    if (level > 0.002) {
      // 雨けむり
      bc.fillStyle = 'rgba(150, 140, 165, ' + (0.07 * level).toFixed(3) + ')';
      bc.fillRect(0, 0, width, height);

      const active = Math.round(drops.length * level);
      bc.lineCap = 'round';
      fc.lineCap = 'round';
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed * dt;
        d.x -= d.speed * dt * WIND;
        if (d.y - d.len > height || d.x < -120) Object.assign(d, newDrop(false));
        if (i >= active) continue;
        // 手前の数粒だけは、本の上にも降る（強い雨のときだけ、うすく）
        const onFront = d.near > 0.86 && level > 0.75;
        const ctx = onFront ? fc : bc;
        const a = d.alpha * (onFront ? 0.55 : 1) * Math.min(1, level * 1.4);
        ctx.strokeStyle = 'rgba(226, 214, 228, ' + a.toFixed(3) + ')';
        ctx.lineWidth = d.width;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.len * WIND, d.y - d.len);
        ctx.stroke();
      }
    }

    if (level === 0 && target === 0) { running = false; lastTime = 0; return; }
    requestAnimationFrame(draw);
  }

  function setRain(value) {
    target = Math.max(0, Math.min(1, value || 0));
    if (stage) stage.classList.toggle('is-raining', target > 0);
    if (reduceMotion || !back) return;      // 動きを減らす設定のときは、雨を降らせない
    if (!running && (target > 0 || level > 0)) {
      running = true;
      requestAnimationFrame(draw);
    }
  }

  // ---------- 光の刃 ----------
  //   .stage.is-blade で、薄暗さ・光・あたたかさが順に動く（css/style.css）。
  //   重ね方（mix-blend-mode）を本と混ぜるために、3 つの層は本と同じ舞台に並べている
  function placeBlade() {
    // ひらいた見開きの、画面の上での場所（左ページ = .block、右ページはその右に同じ大きさ）
    const block = document.querySelector('.book .block');
    if (!block || !stage) return;
    const r = block.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    stage.style.setProperty('--bl', (r.left - s.left) + 'px');
    stage.style.setProperty('--bt', (r.top - s.top) + 'px');
    stage.style.setProperty('--bw', (r.width * 2) + 'px');
    stage.style.setProperty('--bh', r.height + 'px');
  }
  window.addEventListener('resize', function () { if (stage && stage.classList.contains('is-blade')) placeBlade(); });

  function setBlade(on) {
    if (!stage || on === stage.classList.contains('is-blade')) return;
    if (on) placeBlade();
    stage.classList.toggle('is-blade', on);
    stage.classList.toggle('is-blade-still', on && reduceMotion);
  }

  // ---------- 見開きが変わったとき ----------
  //   k = めくった枚数（0 = 閉じている）。見えているのは、右が 2k-1 ページ、左が 2k ページ
  let timer = null;
  function show(k) {
    clearTimeout(timer);
    document.querySelectorAll('.page.is-visible').forEach(function (page) { page.classList.remove('is-visible'); });
    if (!k || k <= 0) { setRain(0); setBlade(false); return; }
    const right = 2 * k - 1;
    const left = 2 * k;
    // 紙がめくれ終わるころに、場面の演出をはじめる
    timer = setTimeout(function () {
      [right, left].forEach(function (n) {
        const page = document.querySelector('.page[data-page="' + n + '"]');
        if (page) page.classList.add('is-visible');
      });
      // 雨：この見開きまでに出てきた、いちばんあとの rain の強さ
      let rain = 0;
      scenes('rain')
        .sort(function (a, b) { return a.page - b.page || a.id - b.id; })
        .forEach(function (s) { if (s.page <= left) rain = s.level || 0; });
      setRain(rain);
      // 光の刃：この見開きに blade の言葉があるとき
      setBlade(scenes('blade').some(function (s) { return s.page === right || s.page === left; }));
    }, 500);
  }

  resize();
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  window.Kotoba = window.Kotoba || {};
  window.Kotoba.effects = { show: show };
})();
