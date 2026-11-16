// 文芸誌 — 本をひらく／めくる／とじる
// ※ これはプログラムのファイルです。書きかえないでください。
//   本の文字（題・作品など）を変えるときは、literatures/ の本のフォルダ（kaminoko など）の中を書きかえます。
//
// 中身（literatures/）を読みこみ、ページを組んでから動きはじめます。
(function () {
Kotoba.load()
  .catch(function (error) { console.error(error); return []; })
  .then(function (entries) {
    Kotoba.buildPages(entries);
    start();
  });

function start() {
  const book = document.getElementById('book');
  const cover = document.getElementById('cover');
  const hint = document.getElementById('hint');

  // 背表紙に書名を入れる（表紙の題が一文字ずつに分かれる前に）
  book.querySelector('.book__spine-title').textContent =
    book.querySelector('.cover__title').textContent || book.dataset.title || '';

  // ---------- 表紙の文字を一文字ずつに分ける ----------
  // 題名はゆっくり一文字ずつ、そのあと大学名などがさらさらと落ちてくる
  let lettersEnd = 0;   // ふれてから、すべての文字が落ちきるまでの秒数
  (function prepareLetters() {
    let titleCount = 0;
    let creditCount = 0;
    document.querySelectorAll('[data-fall]').forEach(function (line) {
      const isTitle = line.dataset.fall === 'title';
      const chars = Array.from(line.textContent);
      line.textContent = '';
      chars.forEach(function (ch) {
        const span = document.createElement('span');
        span.className = 'glyph';
        span.textContent = ch === ' ' ? '\u00a0' : ch;   // 空白がつぶれないように
        const n = isTitle ? titleCount++ : creditCount++;
        if (isTitle) {
          span.style.setProperty('--fall-name', 'fall-title');
          span.style.setProperty('--delay', (n * 0.55).toFixed(2) + 's');
          span.style.setProperty('--fall', '1.9s');
        } else {
          span.style.setProperty('--fall-name', 'fall-credit');
          span.style.setProperty('--delay', (3.5 + n * 0.06).toFixed(2) + 's');
          span.style.setProperty('--fall', '1.3s');
          span.style.setProperty('--side', n % 2 === 0 ? '1' : '-1');  // 左右交互に、すこし揺らす
        }
        lettersEnd = Math.max(lettersEnd,
          parseFloat(span.style.getPropertyValue('--delay')) + parseFloat(span.style.getPropertyValue('--fall')));
        line.appendChild(span);
      });
    });
  })();

  // ---------- 表紙にふれると、文字が落ちてくる ----------
  let lit = false;
  let litTimers = [];   // 本をしまったら、取り消す
  function lightUp() {
    if (lit || putting) return;   // 本をしまっているあいだは、文字を落とさない
    lit = true;
    book.classList.add('is-lit');
    litTimers = [
      // 表紙に文字を降らせない本は、光がふくらんだら、すぐに案内する
      setTimeout(function () { hint.textContent = 'もう一度ふれて、ひらく'; }, lettersEnd > 0 ? 5000 : 1800),
      // 文字が出揃ったら、しおりのボタンを出せるようにする
      setTimeout(function () { bookmark.lettersDone(); }, (lettersEnd + 0.3) * 1000),
    ];
  }

  // ---------- ページをめくる ----------
  // leaves[0] が表紙、そのあとが中の紙（js/pages.js が作ったもの）
  const leaves = Array.from(book.querySelectorAll('.leaf'));
  const firstButton = document.getElementById('first');
  const block = book.querySelector('.block');   // 裏表紙の内側。右のふちが本の背
  const coverLabel = cover.getAttribute('aria-label');
  let current = 0;   // めくった紙の枚数（0 = 閉じている）

  function turnTime(leaf) {
    return (parseFloat(getComputedStyle(leaf).transitionDuration) || 1) * 1000;
  }

  // 紙の奥行き（--d）：いま見えている紙を 0 にして、その下の紙ほど奥へ。
  //   左（めくっていない紙）は前のものほど上、右（めくった紙）はあとでめくったものほど上。
  //   見開きの左右がいつも同じ平面・同じ大きさになり、重なり順もはっきりする
  function restack() {
    let unflipped = 0;
    leaves.forEach(function (leaf) {
      if (!leaf.classList.contains('is-flipped')) leaf.style.setProperty('--d', unflipped++);
    });
    let flipped = 0;
    for (let i = leaves.length - 1; i >= 0; i--) {
      if (leaves[i].classList.contains('is-flipped')) leaves[i].style.setProperty('--d', flipped++);
    }
    block.style.setProperty('--d', unflipped);   // 裏表紙の内側は、めくっていない紙のさらに下
  }

  // index 番目の紙をめくる（flipped = true）／もどす（false）
  function turn(index, flipped, delay) {
    const leaf = leaves[index];
    function go() {
      leaf.classList.toggle('is-flipped', flipped);
      restack();
      leaf.classList.remove('is-turning');
      void leaf.offsetWidth;                 // 影のアニメーションを最初から
      leaf.classList.add('is-turning');
      clearTimeout(leaf._turning);
      leaf._turning = setTimeout(function () { leaf.classList.remove('is-turning'); }, turnTime(leaf));
    }
    if (delay) setTimeout(go, delay); else go();
  }

  // 小口（重なった紙のふち）の厚み：左はまだ読んでいない紙、右は読んだ紙。
  // 本の厚さぜんぶ（edgeAll）を、読んだ割合で左右に分ける
  function updateEdges() {
    const n = leaves.length;
    const edgeAll = Math.min(book.offsetWidth * 0.045, Math.max(5, n * 0.75));
    const read = current / n;
    book.style.setProperty('--edge-l', (current === 0 ? 0 : edgeAll * (1 - read)).toFixed(2) + 'px');
    book.style.setProperty('--edge-r', (edgeAll * read).toFixed(2) + 'px');
  }

  function update() {
    restack();
    updateEdges();
    firstButton.disabled = current <= 1;
    cover.setAttribute('aria-label', current > 0 ? '1 ページ目（扉）' : coverLabel);
    bookmark.update(current);
    if (Kotoba.effects) Kotoba.effects.show(current);   // 場面の演出（雨・光の刃・にじみ）
  }

  function openBook() {
    if (current > 0) return;
    turn(0, true);
    current = 1;
    book.classList.add('is-open');
    update();
  }

  // めくった紙を、上から順にさらさらと戻して閉じる（stagger は 1 枚ごとの間。ふだんは 0.12 秒）。
  // 閉じ終わるまでのミリ秒を返す
  function closeBook(stagger) {
    if (current === 0) return 0;
    if (typeof stagger !== 'number') stagger = 120;
    const last = current;
    for (let i = last - 1; i >= 0; i--) turn(i, false, (last - 1 - i) * stagger);
    setTimeout(function () { book.classList.remove('is-open'); }, (last - 1) * stagger);
    current = 0;
    update();
    cover.focus({ preventScroll: true });
    return (last - 1) * stagger + turnTime(cover);
  }

  function next() {
    if (current === 0) { openBook(); return; }
    if (current >= leaves.length) return;
    turn(current, true);
    current += 1;
    update();
  }

  function prev() {
    if (current <= 1) { closeBook(); return; }
    current -= 1;
    turn(current, false);
    update();
  }

  // target 枚めくった見開きへ（ひらいているときだけ）。間の紙を、さらさらと続けてめくる／戻す
  function goTo(target) {
    if (current === 0) return;
    target = Math.max(1, Math.min(leaves.length, target));
    const from = current;
    if (target > from) {
      for (let i = from; i < target; i++) turn(i, true, (i - from) * 120);
    } else {
      for (let i = from - 1; i >= target; i--) turn(i, false, (from - 1 - i) * 120);
    }
    current = target;
    update();
  }
  function goLast() { goTo(leaves.length); }   // おわりのページへ
  function goFirst() { goTo(1); }              // はじめのページへ（1 ページ目の扉）

  // しおり（js/bookmark.js）
  const bookmark = Kotoba.createBookmark({ count: leaves.length, goTo: goTo });

  // ---------- 本棚から本を取り出す ----------
  // 本ははじめ、背景の本棚の一冊として隠れていて、ほかより強い光で明滅している（js/shelf.js）。
  // ふれると棚から抜け出し、表紙をこちらへ向けながら真ん中へ来る
  const stage = document.querySelector('.stage');
  const pick = document.getElementById('pick');
  const shelf = window.Kotoba.shelf;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shelved() { return book.classList.contains('is-shelved'); }

  // ふれるところを、棚の本の上に重ねる（細い本でも指でふれられる幅を取る）
  function placePick() {
    const spot = shelf && shelf.spot();
    if (!spot || !shelved()) return false;
    const padX = Math.max(0, (44 - spot.w) / 2) + 6;
    pick.style.left = (spot.x - padX) + 'px';
    pick.style.top = (spot.y - 8) + 'px';
    pick.style.width = (spot.w + padX * 2) + 'px';
    pick.style.height = (spot.h + 16) + 'px';
    return true;
  }

  function pullOut() {
    if (!shelved()) return;
    const spot = shelf && shelf.spot();
    const hadFocus = document.activeElement === pick;
    pick.hidden = true;
    if (shelf) shelf.setHover(false);
    hint.textContent = '';
    book.classList.remove('is-shelved');
    stage.classList.remove('is-shelved');
    if (shelf) shelf.take();

    function done() {
      book.classList.remove('is-pulling');
      hint.textContent = '表紙にふれて';
      if (hadFocus) cover.focus({ preventScroll: true });
    }
    if (!spot || reduceMotion || !book.animate) { done(); return; }

    const p = path(spot);
    book.classList.add('is-pulling');
    const motion = book.animate([
      // 棚の中（背をこちらに向けて立っている）
      { offset: 0,    transform: p.onShelf, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      // すっと手前へ引き出す
      { offset: 0.26, transform: p.pulled, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
      // 弧をえがいて真ん中へ。表紙がこちらを向いてくる
      { offset: 0.62, transform: p.turning, easing: 'cubic-bezier(0.3, 0, 0.25, 1)' },
      // 真ん中に、表紙をこちらへ向けて置かれる
      { offset: 1,    transform: p.center },
    ], { duration: 3600 });
    motion.finished.then(done, done);   // 終わったら（途中で止まっても）次へ
  }

  // 棚と真ん中のあいだの道すじ（取り出すときと、しまうときで同じ道を通る）。
  // 棚の上の本と、本の背がぴったり重なる姿から、真ん中で表紙をこちらへ向けた姿まで。
  // 背は本の右のふちにあり、-90 度まわすとこちらを向く（奥行きのぶん、遠近で少し大きく見えるのを差し引く）
  function path(spot) {
    const rect = book.getBoundingClientRect();   // 閉じて真ん中にあるときの本
    const P = parseFloat(getComputedStyle(stage).perspective) || rect.height * 3;
    let s = spot.h / rect.height;
    const k = P / (P - (rect.width / 2) * s);
    s /= k;
    const dx = (spot.x - (rect.left + rect.width / 2)) / k;
    const dy = (spot.y + spot.h / 2 - (rect.top + rect.height / 2)) / k;
    const pullZ = P * 0.22;   // 手前へ引き出す距離
    const mid = s + (1 - s) * 0.5;
    const at = function (x, y, z, turn, tilt, scale) {
      return 'translate3d(' + x + 'px, ' + y + 'px, ' + z + 'px) rotateY(' + turn + 'deg) rotateZ(' + tilt + 'deg) ' +
        'scale3d(' + scale + ', ' + scale + ', ' + scale + ')';
    };
    return {
      onShelf: at(dx, dy, 0, -90, 0, s),
      pulled:  at(dx * 0.94, dy - spot.h * 0.05, pullZ, -84, 0, s),
      turning: at(dx * 0.4, dy * 0.4 - rect.height * 0.06, pullZ * 0.55, -38, -3, mid),
      center:  at(0, 0, 0, 0, 0, 1),
    };
  }

  // ---------- 本を本棚にしまう ----------
  // ひらいていれば閉じてから、背をこちらへ向けながら、出てきた道をもどって棚の元の場所へ。
  // しまい終えると、はじめの画面（光る一冊を、さがして）にもどる
  let putting = false;
  function putBack(event) {
    if (shelved() || putting || book.classList.contains('is-pulling')) return;
    if (!(shelf && shelf.spot())) { closeBook(); return; }   // 本棚が無いときは、閉じるだけ
    const byKeyboard = !!event && event.detail === 0;
    putting = true;
    litTimers.forEach(clearTimeout);   // 「もう一度ふれて、ひらく」などの予定を取り消す
    litTimers = [];
    hint.textContent = '';
    // めくった紙を、さっと戻して閉じる（ページが多くても 1.5 秒ほどで）
    const wait = closeBook(Math.min(120, 1500 / Math.max(1, current - 1)));
    setTimeout(function () { flyBack(byKeyboard); }, wait + 150);
  }

  function flyBack(byKeyboard) {
    const spot = shelf.spot();   // 画面の大きさが変わっていれば、新しい場所へ
    let motion = null;
    stage.classList.add('is-shelved');

    function done() {
      shelf.put();
      book.classList.add('is-shelved');
      book.classList.remove('is-putting', 'is-lit');
      if (motion) motion.cancel();
      // はじめの状態にもどす（もう一度取り出すと、表紙の文字がまた落ちてくる）
      lit = false;
      bookmark.reset();
      hint.textContent = '光る一冊を、さがして';
      placePick();
      pick.hidden = false;
      if (byKeyboard) pick.focus({ preventScroll: true });
      putting = false;
    }
    if (!spot || reduceMotion || !book.animate) { done(); return; }

    const p = path(spot);
    book.classList.add('is-putting');
    motion = book.animate([
      // 真ん中から、ふわりと持ち上げる
      { offset: 0,    transform: p.center, easing: 'cubic-bezier(0.45, 0, 0.6, 1)' },
      // 弧をえがいて棚へ。背がこちらを向いてくる
      { offset: 0.4,  transform: p.turning, easing: 'cubic-bezier(0.4, 0, 0.5, 1)' },
      // 棚の前で、背をこちらへ向ける
      { offset: 0.72, transform: p.pulled, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' },
      // すっと棚の奥へ押しこむ
      { offset: 1,    transform: p.onShelf },
    ], { duration: 3400, fill: 'forwards' });
    motion.finished.then(done, done);
  }

  if (placePick()) {
    pick.hidden = false;
    pick.addEventListener('click', pullOut);
    pick.addEventListener('pointerenter', function () { shelf.setHover(true); });
    pick.addEventListener('pointerleave', function () { shelf.setHover(false); });
    pick.addEventListener('focus', function () { shelf.setHover(true); });
    pick.addEventListener('blur', function () { shelf.setHover(false); });
    shelf.onLayout(placePick);
  } else {
    // 本棚の本が見つからないときは、はじめから本を出しておく
    book.classList.remove('is-shelved');
    stage.classList.remove('is-shelved');
    hint.textContent = '表紙にふれて';
  }

  // 表紙にマウスが乗ったら、文字が落ちてくる
  cover.addEventListener('pointerenter', function (event) {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') lightUp();
  });
  // キーボードで表紙を選んだときも、文字が落ちてくる（タップでは反応させない）
  cover.addEventListener('focus', function () {
    if (cover.matches(':focus-visible')) lightUp();
  });

  // 本にふれたとき
  //   閉じているとき … 表紙にふれると文字が落ちてきて、もう一度ふれるとひらく（スマホは 2 回タップ）
  //   ひらいているとき … 背より左（左のページ）で次へ、右（右のページ）で前へ。
  //                     右綴じなので、紙は右へめくれる。1 ページ目で右にふれると本を閉じる
  book.addEventListener('click', function (event) {
    if (shelved() || putting || book.classList.contains('is-pulling')) return;   // 棚の中・出し入れのあいだは待つ
    if (current === 0) {
      if (!event.target.closest('#cover')) return;
      if (!lit) { lightUp(); return; }
      openBook();
      return;
    }
    if (event.detail === 0) {                 // キーボードで押したとき（位置が無い）
      if (event.target.closest('#cover')) prev();
      return;
    }
    const spine = block.getBoundingClientRect().right;
    if (event.clientX < spine) next(); else prev();
  });

  document.getElementById('shelve').addEventListener('click', putBack);
  firstButton.addEventListener('click', goFirst);
  document.getElementById('close').addEventListener('click', function () { closeBook(); });

  // キーボード：← で次へ、→ で前へ（右綴じなので）、Home ではじめ、End でおわり、Esc で閉じる
  document.addEventListener('keydown', function (event) {
    // 本が棚の中にあるあいだ・出し入れのあいだは、何もしない
    if (shelved() || putting || book.classList.contains('is-pulling')) return;
    if (event.key === 'ArrowLeft') next();
    else if (event.key === 'ArrowRight') prev();
    else if (event.key === 'Home') goFirst();
    else if (event.key === 'End') goLast();
    else if (event.key === 'Escape') closeBook();
  });

  update();
}
})();
