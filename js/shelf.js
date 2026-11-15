// 文芸誌 — 背景の本棚（光で描く）
// ※ これはプログラムのファイルです。書きかえないでください。
//   本の文字（題・作品など）を変えるときは、literatures/book.js（sample の外のほう）を書きかえます。
//
// 3 枚の絵を重ねて描いています。
//   下：棚の奥からもれる光（呼吸するように明るさが変わる）
//   中：本・棚板・柱の影絵（本と本のすき間から、下の光がのぞく）
//   上：明るい棚からあふれる光のにじみ
(function () {
  const root = document.getElementById('shelf');
  if (!root) return;

  const glowCanvas = root.querySelector('.shelf__glow');
  const bookCanvas = root.querySelector('.shelf__books');
  const bloomCanvas = root.querySelector('.shelf__bloom');
  const glowCtx = glowCanvas.getContext('2d');
  const bookCtx = bookCanvas.getContext('2d');
  const bloomCtx = bloomCanvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 表紙の色
  const LIGHT = [243, 228, 200];                       // 扉からさす光 #f3e4c8
  const BOOK_COLORS = ['#0b0e13', '#0d1116', '#10141a', '#12171e', '#151a21'];
  const BOARD = '#0b0e12';
  const POST = '#090b0f';

  const GLOW_SCALE = 0.5; // 光はやわらかいので、粗い解像度で十分（動きが軽くなる）

  // 棚に隠れている一冊（この本）。ほかの棚と同じように、でもより強い光で静かに明滅する。
  // ふれると js/main.js が棚から取り出す
  const SPINE = 0.085;        // 本の厚み ÷ 高さ（css/style.css の --thick と同じ割合）
  const SPOT_PERIOD = 4200;   // 明滅の周期（ミリ秒）
  let spot = null;            // その本の場所 { x, y, w, h }（画面の上での位置と大きさ）
  let taken = false;          // 取り出したあとか
  let takenAt = 0;
  let putAt = -Infinity;      // しまった時刻（光がゆっくりもどる）
  let hover = false;          // ふれそうなとき（マウスが乗っている）は、明るさを保つ
  const listeners = [];       // 本棚を組みなおしたときに知らせる先

  // 絵を描かずに乱数だけ進めるための、からっぽの筆（ほかの棚の並びを、もとのままにするため）
  const DRY = { fillStyle: '', fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {} };

  let cells = [];
  let width = 0;
  let height = 0;

  const light = (a) => `rgba(${LIGHT[0]}, ${LIGHT[1]}, ${LIGHT[2]}, ${a.toFixed(3)})`;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // 毎回同じ並びになるように、決まった種から乱数をつくる
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- 本を一冊描く ----------
  function drawBook(ctx, x, y, w, h, level, rnd) {
    ctx.fillStyle = BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)];
    ctx.fillRect(x, y, w, h);

    // 背後の光が本のふちをなぞる
    ctx.fillStyle = light(level * (0.7 + rnd() * 0.3));
    ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = light(level * 0.45);
    ctx.fillRect(x, y, 0.8, h);
    ctx.fillRect(x + w - 0.8, y, 0.8, h);

    // 背表紙の帯（題箋のような）
    if (h > 30 && w > 8 && rnd() < 0.2) {
      ctx.fillStyle = light(level * 0.08);
      ctx.fillRect(x + 1.5, y + h * (0.1 + rnd() * 0.18), w - 3, 2 + rnd() * 5);
    }
  }

  // この本の背（表紙と同じ紺に、上下の細い箔の線）
  function drawSpotBook(ctx, s, level) {
    ctx.fillStyle = '#1a2029';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = light(Math.max(level, 0.3) * 0.9);
    ctx.fillRect(s.x, s.y, s.w, 1);
    ctx.fillStyle = light(0.22);
    ctx.fillRect(s.x + 1, s.y + s.h * 0.06, s.w - 2, 0.8);
    ctx.fillRect(s.x + 1, s.y + s.h * 0.94, s.w - 2, 0.8);
  }

  // 取り出したあと：本のあったところを抜いて、奥の光がのぞくすき間にする
  function clearGap() {
    if (spot) bookCtx.clearRect(spot.x - 0.5, spot.y - 1, spot.w + 1, spot.h + 1);
  }

  // ---------- 棚ひとマスに本を並べる ----------
  // withSpot のときは、棚の左から 3 割ほどのところに、この本を立てる
  function fillCell(ctx, cell, rnd, withSpot) {
    const { x0, x1, y1, level } = cell;
    const innerH = cell.y1 - cell.y0;
    let x = x0 + 3 + rnd() * 12;

    while (true) {
      const room = x1 - 3 - x;
      if (room < 7) break;

      if (withSpot && !spot && x > x0 + (x1 - x0) * 0.3) {
        const h = innerH * 0.84;
        const w = h * SPINE;
        if (w + 3 <= room) {
          spot = { x: x + 1, y: y1 - h, w: w, h: h, cell: cell };
          drawSpotBook(ctx, spot, level);
          x += w + 2.5;
          continue;
        }
      }

      const r = rnd();

      // 空いている場所
      if (r < 0.05 && room > 80) {
        x += 26 + rnd() * 40;
        continue;
      }

      // 平積み
      if (r < 0.11 && room > 48) {
        const n = 2 + Math.floor(rnd() * 4);
        const w = Math.min(room - 4, 34 + rnd() * 30);
        let y = y1;
        for (let i = 0; i < n; i++) {
          const t = 5 + rnd() * 7;
          drawBook(ctx, x + 2 + (rnd() - 0.5) * 5, y - t, w, t, level, rnd);
          y -= t + 0.6;
        }
        x += w + 4 + rnd() * 6;
        continue;
      }

      // もたれかかった本（列の終わり）
      if (r > 0.93 && room > 34 && room < 90) {
        const angle = 0.12 + rnd() * 0.16;
        const w = 9 + rnd() * 6;
        const h = innerH * (0.6 + rnd() * 0.22);
        const need = h * Math.sin(angle) + w * Math.cos(angle) + 1;
        if (need <= room) {
          ctx.save();
          ctx.translate(x + h * Math.sin(angle) + 1, y1);
          ctx.rotate(-angle);
          drawBook(ctx, 0, -h, w, h, level, rnd);
          ctx.restore();
          break;
        }
      }

      // ふつうに立っている本
      const w = Math.min(room, rnd() < 0.15 ? 18 + rnd() * 8 : 7 + rnd() * 11);
      const h = innerH * (0.52 + rnd() * 0.38);
      drawBook(ctx, x, y1 - h, w, h, level, rnd);
      x += w + (rnd() < 0.65 ? 0.6 + rnd() * 1.6 : 2 + rnd() * 5);
    }
  }

  // ---------- 本棚ぜんたいを組み立てる ----------
  function build() {
    width = window.innerWidth;
    height = window.innerHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    bookCanvas.width = Math.round(width * dpr);
    bookCanvas.height = Math.round(height * dpr);
    bookCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    glowCanvas.width = Math.round(width * GLOW_SCALE);
    glowCanvas.height = Math.round(height * GLOW_SCALE);
    glowCtx.setTransform(GLOW_SCALE, 0, 0, GLOW_SCALE, 0, 0);

    bloomCanvas.width = glowCanvas.width;
    bloomCanvas.height = glowCanvas.height;
    bloomCtx.setTransform(GLOW_SCALE, 0, 0, GLOW_SCALE, 0, 0);

    const rnd = seeded(20261115);
    const bayW = clamp(width / 5, 190, 320);   // 棚の横幅
    const rowH = clamp(height / 4.2, 130, 200); // 棚の高さ
    const post = 12;
    const board = 10;
    const bays = Math.ceil(width / bayW) + 2;
    const rows = Math.ceil(height / rowH) + 2;
    const left = width / 2 - (bays * bayW) / 2;
    const top = height / 2 - (rows * rowH) / 2;

    const ctx = bookCtx;
    ctx.clearRect(0, 0, width, height);
    cells = [];
    spot = null;

    const cellAt = (r, b) => ({
      x0: left + b * bayW + post / 2,
      x1: left + (b + 1) * bayW - post / 2,
      y0: top + r * rowH + board / 2,
      y1: top + (r + 1) * rowH - board / 2,
    });

    // この本を隠す棚：画面に収まっている棚のうち、左寄り・少し上のもの
    let spotCell = '';
    let best = Infinity;
    for (let r = 0; r < rows; r++) {
      for (let b = 0; b < bays; b++) {
        const c = cellAt(r, b);
        if (c.x0 < 0 || c.x1 > width || c.y0 < 0 || c.y1 > height) continue;
        const score = Math.abs((c.x0 + c.x1) / 2 / width - 0.22) + Math.abs((c.y0 + c.y1) / 2 / height - 0.42);
        if (score < best) { best = score; spotCell = r + ':' + b; }
      }
    }

    // 本
    for (let r = 0; r < rows; r++) {
      for (let b = 0; b < bays; b++) {
        const cell = cellAt(r, b);
        const roll = rnd();
        // 暗い書庫の、ところどころに明かりがともっている
        cell.bright = roll > 0.7;                            // ひときわ明るい棚（約 3 割）
        cell.level = roll < 0.4 ? 0.02 + rnd() * 0.04       // ほとんど暗い棚
                   : cell.bright ? 0.6 + rnd() * 0.3
                   : 0.12 + rnd() * 0.13;
        // 明るい棚は速く深く、ほかの棚はゆっくり静かに呼吸する
        cell.period = cell.bright ? 2800 + rnd() * 2400 : 7000 + rnd() * 7000;
        cell.phase = rnd() * Math.PI * 2;
        if (cell.x1 < 0 || cell.x0 > width || cell.y1 < 0 || cell.y0 > height) continue;
        cells.push(cell);
        if (r + ':' + b === spotCell) {
          fillCell(DRY, cell, rnd);                      // 乱数の進み方を、もとの本棚と同じにしておく
          fillCell(ctx, cell, seeded(1116), true);       // この棚だけは、この本を入れて並べなおす
        } else {
          fillCell(ctx, cell, rnd);
        }
      }
    }

    // 棚板（下に影を落とす）
    for (let r = 0; r <= rows; r++) {
      const y = top + r * rowH;
      const shadow = ctx.createLinearGradient(0, y + board / 2, 0, y + board / 2 + 24);
      shadow.addColorStop(0, 'rgba(6, 8, 12, 0.6)');
      shadow.addColorStop(1, 'rgba(6, 8, 12, 0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(0, y + board / 2, width, 24);
      ctx.fillStyle = BOARD;
      ctx.fillRect(0, y - board / 2, width, board);
    }

    // 棚板の上のふちが、その棚の光を受ける
    for (const cell of cells) {
      ctx.fillStyle = light(cell.level * 0.6);
      ctx.fillRect(cell.x0, cell.y1, cell.x1 - cell.x0, 1);
    }

    // 柱
    for (let b = 0; b <= bays; b++) {
      const x = left + b * bayW;
      const side = (from, to) => {
        const g = ctx.createLinearGradient(from, 0, to, 0);
        g.addColorStop(0, 'rgba(6, 8, 12, 0.5)');
        g.addColorStop(1, 'rgba(6, 8, 12, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(Math.min(from, to), 0, Math.abs(to - from), height);
      };
      side(x + post / 2, x + post / 2 + 18);
      side(x - post / 2, x - post / 2 - 18);
      ctx.fillStyle = POST;
      ctx.fillRect(x - post / 2, 0, post, height);
      ctx.fillStyle = light(0.04);
      ctx.fillRect(x - post / 2, 0, 1, height);
      ctx.fillRect(x + post / 2 - 1, 0, 1, height);
    }

    if (taken) clearGap();
    listeners.forEach(function (fn) { fn(); });
  }

  // ---------- この本の光 ----------
  function drawSpotLight(time) {
    if (!spot) return;
    const cx = spot.x + spot.w / 2;
    const cy = spot.y + spot.h * 0.55;

    if (taken) {
      // 抜いたあとのすき間から、奥の光がもれる
      const gap = glowCtx.createLinearGradient(0, spot.y, 0, spot.y + spot.h);
      gap.addColorStop(0, light(0.15));
      gap.addColorStop(1, light(0.55));
      glowCtx.fillStyle = gap;
      glowCtx.fillRect(spot.x - 2, spot.y, spot.w + 4, spot.h);
    }

    // 取り出すと、本の光はすっと消える。しまうと、ゆっくりもどる
    const fade = taken ? clamp(1 - (time - takenAt) / 1400, 0, 1) : clamp((time - putAt) / 1600, 0, 1);
    if (fade <= 0) return;
    let pulse = 1;
    if (!reduceMotion.matches) {
      const wave = (Math.sin((time / SPOT_PERIOD) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      pulse = Math.pow(wave, 1.4);
    }
    const s = (hover ? 0.85 + 0.15 * pulse : 0.12 + 0.88 * pulse) * fade;

    // 奥からの光：本のまわりのすき間から、ほかの棚より強くもれる（その段の中だけ）
    const r0 = spot.h * 1.0;
    const g = glowCtx.createRadialGradient(cx, cy, 0, cx, cy, r0);
    g.addColorStop(0, light(1.0 * s));
    g.addColorStop(0.35, light(0.5 * s));
    g.addColorStop(1, light(0));
    glowCtx.fillStyle = g;
    const c = spot.cell;
    glowCtx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);

    // 手前に大きくにじむ光
    const r1 = spot.h * (0.75 + 0.3 * pulse);
    const b = bloomCtx.createRadialGradient(cx, cy, 0, cx, cy, r1);
    b.addColorStop(0, light(0.6 * s));
    b.addColorStop(0.3, light(0.25 * s));
    b.addColorStop(1, light(0));
    bloomCtx.fillStyle = b;
    bloomCtx.fillRect(cx - r1, cy - r1, r1 * 2, r1 * 2);
    // 本そのものが内側から光り、ふちがくっきり輝く
    bloomCtx.fillStyle = light(0.4 * s);
    bloomCtx.fillRect(spot.x, spot.y, spot.w, spot.h);
    bloomCtx.strokeStyle = light(1.0 * s);
    bloomCtx.lineWidth = 2;
    bloomCtx.strokeRect(spot.x, spot.y, spot.w, spot.h);
  }

  // ---------- 棚の奥の光 ----------
  function drawGlow(time) {
    const ctx = glowCtx;
    ctx.clearRect(0, 0, width, height);
    bloomCtx.clearRect(0, 0, width, height);
    for (const cell of cells) {
      // pulse: 0（いちばん暗い）〜 1（いちばん明るい）
      let pulse = 1;
      if (!reduceMotion.matches) {
        const wave = (Math.sin((time / cell.period) * Math.PI * 2 + cell.phase) + 1) / 2;
        pulse = cell.bright ? Math.pow(wave, 1.6) : wave; // 明るい棚は、ふっとふくらむように
      }
      const breathe = cell.bright ? 0.3 + 0.7 * pulse : 0.6 + 0.4 * pulse;
      const a = cell.level * breathe;
      const w = cell.x1 - cell.x0;
      const h = cell.y1 - cell.y0;
      const cx = (cell.x0 + cell.x1) / 2;
      const cy = cell.y1 - h * 0.12;
      const radius = cell.bright ? w * (0.55 + 0.2 * pulse) : w * 0.6;

      // 棚の奥の低いところから、光がひろがる
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      g.addColorStop(0, light(a));
      g.addColorStop(0.35, light(a * 0.5));
      g.addColorStop(0.7, light(a * 0.12));
      g.addColorStop(1, light(0));
      ctx.fillStyle = g;
      ctx.fillRect(cell.x0, cell.y0, w, h);

      // 奥の下のほうに、細い明かりが仕込まれているように
      const s = ctx.createLinearGradient(0, cell.y1 - h * 0.2, 0, cell.y1);
      s.addColorStop(0, light(0));
      s.addColorStop(1, light(a * 0.6));
      ctx.fillStyle = s;
      ctx.fillRect(cell.x0, cell.y1 - h * 0.2, w, h * 0.2);

      // 明るい棚は、光が枠の外まであふれる
      if (cell.bright) {
        const r = w * (0.7 + 0.35 * pulse);
        const b = bloomCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        b.addColorStop(0, light(cell.level * pulse * 0.45));
        b.addColorStop(0.4, light(cell.level * pulse * 0.15));
        b.addColorStop(1, light(0));
        bloomCtx.fillStyle = b;
        bloomCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
    drawSpotLight(time);
  }

  // ---------- 光の中をただよう粒 ----------
  // 明るい棚の光だまりに集めて、ただよう粒と、ときどききらめく粒をおく
  function makeMotes() {
    const holder = document.getElementById('motes');
    if (!holder || reduceMotion.matches) return;
    holder.replaceChildren();
    const lit = cells.filter((c) => c.bright);
    const pool = lit.length ? lit : cells;
    if (!pool.length) return;
    const rnd = seeded(8);

    const place = (m, cell, fromTop) => {
      const h = cell.y1 - cell.y0;
      m.style.setProperty('--x', (cell.x0 + rnd() * (cell.x1 - cell.x0)).toFixed(0) + 'px');
      m.style.setProperty('--y', (cell.y0 + h * fromTop + rnd() * h * (1 - fromTop)).toFixed(0) + 'px');
    };

    for (let i = 0; i < 26; i++) {           // ただよう粒
      const m = document.createElement('span');
      m.className = 'mote';
      const duration = 14 + rnd() * 12;
      place(m, pool[Math.floor(rnd() * pool.length)], 0.3);
      m.style.setProperty('--size', (1.5 + rnd() * 2).toFixed(1) + 'px');
      m.style.setProperty('--dx', ((rnd() - 0.5) * 60).toFixed(0) + 'px');
      m.style.setProperty('--duration', duration.toFixed(1) + 's');
      m.style.setProperty('--delay', (-rnd() * duration).toFixed(1) + 's');
      holder.appendChild(m);
    }

    for (let i = 0; i < 16; i++) {           // きらめく粒
      const m = document.createElement('span');
      m.className = 'mote mote--glint';
      const duration = 2.5 + rnd() * 3.5;
      place(m, pool[Math.floor(rnd() * pool.length)], 0.55);
      m.style.setProperty('--size', (1.5 + rnd() * 1.5).toFixed(1) + 'px');
      m.style.setProperty('--duration', duration.toFixed(1) + 's');
      m.style.setProperty('--delay', (-rnd() * duration * 3).toFixed(1) + 's');
      holder.appendChild(m);
    }
  }

  // ---------- うごかす ----------
  let last = 0;
  function frame(time) {
    if (time - last > 33) { // 1 秒に 30 回ほどで十分
      drawGlow(time);
      last = time;
    }
    requestAnimationFrame(frame);
  }

  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      build();
      drawGlow(performance.now());
      makeMotes();
    }, 150);
  });

  // js/main.js から使う
  window.Kotoba = window.Kotoba || {};
  window.Kotoba.shelf = {
    // この本の場所（画面の上での位置と大きさ）。見つからなければ null
    spot: function () { return spot ? { x: spot.x, y: spot.y, w: spot.w, h: spot.h } : null; },
    // 取り出した：棚にすき間をあけ、光を消していく
    take: function () {
      if (taken) return;
      taken = true;
      takenAt = performance.now();
      clearGap();
      if (reduceMotion.matches) drawGlow(takenAt + 2000);   // 動きを減らす設定のときは、すぐに
    },
    // しまった：すき間に本をもどし、また明滅させる
    put: function () {
      if (!taken) return;
      taken = false;
      putAt = performance.now();
      if (spot) drawSpotBook(bookCtx, spot, spot.cell.level);
      if (reduceMotion.matches) drawGlow(putAt + 2000);
    },
    setHover: function (on) {
      hover = !!on;
      if (reduceMotion.matches) drawGlow(performance.now());
    },
    // 画面の大きさが変わって本棚を組みなおしたとき
    onLayout: function (fn) { listeners.push(fn); },
  };

  build();
  drawGlow(performance.now());
  makeMotes();
  requestAnimationFrame(function () { root.classList.add('is-ready'); });
  if (!reduceMotion.matches) requestAnimationFrame(frame);
})();
