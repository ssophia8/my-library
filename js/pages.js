// 文芸誌 — 中身からページを組む
// ※ これはプログラムのファイルです。書きかえないでください。
//   本の文字（題・作品など）を変えるときは、literatures/ の本のフォルダ（kaminoko など）の中を書きかえます。
//
// js/loader.js が読みこんだ中身（作品・画像）を目次の順に並べ、
// 2 ページ目から先の紙（.leaf）を作って本の中に入れます。
//
//   1 枚の紙 = 表（左ページ・偶数）＋ 裏（右ページ・奇数）
//   右綴じなので、左ページを右へめくると、その裏が右ページになります。
(function () {
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- 縦書きの文字の組み ----------
  //   ｜漢字《かな》・漢字《かな》 … ふりがな（ルビ）
  //   1〜2 けたの数字            … 縦中横（横に並べて 1 字分に）
  //   3 けた以上の数字           … 全角にして、1 字ずつ縦に
  //   大文字の英字（IT・NHK など）… 1 字ずつ立てて縦に
  //   marks に書いた言葉         … 色をつける（作品ごとに。.is-marked）
  const RUBY = /[｜|]([^｜|《》\n]+)《([^》\n]+)》|([一-鿿々〆ヶ]+)《([^》\n]+)》/g;

  function plainText(text) {
    return String(text || '').replace(RUBY, function (all, b1, r1, b2) { return b1 || b2; });
  }

  function appendGlyphs(parent, text) {
    const pattern = /[0-9]+|[A-Z]+/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(text))) {
      if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      const run = match[0];
      if (/[0-9]/.test(run[0]) && run.length <= 2) {
        parent.appendChild(element('span', 'tcy', run));
      } else if (/[0-9]/.test(run[0])) {
        parent.appendChild(document.createTextNode(run.replace(/[0-9]/g, function (d) {
          return String.fromCharCode(d.charCodeAt(0) + 0xfee0);
        })));
      } else {
        parent.appendChild(element('span', 'upright', run));
      }
      last = match.index + run.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function appendMarked(parent, text, marks) {
    if (!marks || !marks.length) { appendGlyphs(parent, text); return; }
    const escaped = marks.map(function (m) { return m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    const pattern = new RegExp(escaped.join('|'), 'g');
    let last = 0;
    let match;
    while ((match = pattern.exec(text))) {
      if (match.index > last) appendGlyphs(parent, text.slice(last, match.index));
      const span = element('span', 'is-marked');
      appendGlyphs(span, match[0]);
      parent.appendChild(span);
      last = match.index + match[0].length;
    }
    if (last < text.length) appendGlyphs(parent, text.slice(last));
  }

  // 文字列を、ふりがな・縦中横・色つきの言葉を組みこんだ要素にして parent に入れる
  function typeset(parent, text, marks) {
    text = String(text || '');
    const pattern = new RegExp(RUBY.source, 'g');
    let last = 0;
    let match;
    while ((match = pattern.exec(text))) {
      if (match.index > last) appendMarked(parent, text.slice(last, match.index), marks);
      const ruby = element('ruby');
      appendMarked(ruby, match[1] || match[3], marks);
      ruby.appendChild(element('rt', null, match[2] || match[4]));
      parent.appendChild(ruby);
      last = match.index + match[0].length;
    }
    if (last < text.length) appendMarked(parent, text.slice(last), marks);
    return parent;
  }

  // 作品の文章を、縦書きの段落に。1 行が 1 段落、空行はそのまま 1 行あき
  //   scenes（場面の演出）の at に書いた言葉には目印（data-anchor）をつけて、何ページ目に来るかを測る
  function workToFlow(work) {
    const flow = element('div', 'flow');
    // 扉がある作品や showTitle: false の作品は、本文のはじめに題と作者名を出さない（目次には出る）
    if ((work.title || work.author) && !work.tobira && work.showTitle !== false) {
      const header = element('header', 'flow__header');
      if (work.title) header.appendChild(typeset(element('h2'), work.title));
      if (work.author) header.appendChild(element('p', 'author', work.author));
      flow.appendChild(header);
    }
    const marks = work.marks || [];
    const scenes = (work.scenes || []).map(function (scene, i) {
      return Object.assign({ id: i, found: false }, scene);
    });

    // 1 段落を組む（場面の目印があれば、その言葉を目印で包む）
    function appendLine(line) {
      if (/^[＊*※◇◆]+$/.test(line.replace(/[\s　]/g, ''))) {   // 場面の区切り（＊）は行の真ん中に
        flow.appendChild(element('p', 'break', line.replace(/[\s　]/g, '')));
        return;
      }
      const p = element('p');
      const hits = [];
      scenes.forEach(function (scene) {
        if (scene.found || !scene.at) return;
        const index = line.indexOf(scene.at);
        if (index < 0) return;
        scene.found = true;
        hits.push({ index: index, scene: scene });
      });
      hits.sort(function (a, b) { return a.index - b.index; });
      let last = 0;
      hits.forEach(function (hit) {
        if (hit.index < last) return;
        typeset(p, line.slice(last, hit.index), marks);
        const anchor = element('span', 'anchor');
        anchor.dataset.anchor = String(hit.scene.id);
        typeset(anchor, hit.scene.at, marks);
        p.appendChild(anchor);
        last = hit.index + hit.scene.at.length;
      });
      typeset(p, line.slice(last), marks);
      flow.appendChild(p);
    }
    flow._scenes = scenes;

    const lines = String(work.text || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(function (line) { return line.replace(/^[ \t]+|[ \t]+$/g, ''); });  // 半角の空白は取る（全角の字下げは残す）
    while (lines.length && lines[0].trim() === '') lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.forEach(function (line) {
      if (line.trim() === '') flow.appendChild(element('p', 'blank', ' '));
      else appendLine(line);
    });
    if (work.signature) flow.appendChild(element('p', 'signature', work.signature));
    scenes.forEach(function (scene) {
      if (scene.at && !scene.found) console.warn('場面の目印が本文に見つかりません:', scene.at);
    });
    return flow;
  }

  // 目次：このあとに並ぶ作品の、題・作者名・はじまりのページ数
  function tocToFlow(toc, entries, tocIndex) {
    const flow = element('div', 'flow flow--toc');
    const header = element('header', 'flow__header');
    header.appendChild(element('h2', null, toc.title));
    flow.appendChild(header);
    entries.forEach(function (entry, index) {
      if (index <= tocIndex || entry.type !== 'work') return;
      const item = element('p', 'toc__item');
      item.appendChild(element('span', 'toc__title', entry.title || ''));
      item.appendChild(element('span', 'toc__leader'));
      if (entry.author) item.appendChild(element('span', 'toc__author', entry.author));
      const page = element('span', 'toc__page');
      const number = element('span', 'toc__number', '000');  // ページ数はあとで入れる（幅だけ取っておく）
      number.dataset.work = String(index);
      page.appendChild(number);
      item.appendChild(page);
      flow.appendChild(item);
    });
    return flow;
  }

  // 縦書き一段組の文章が何ページ分になるかを測る。
  // 場面の目印（data-anchor）が、何ページ目（0 から）の、どのあたりに来るかも測る
  function measurePages(flow) {
    const probe = element('div', 'page measure');
    const win = element('div', 'page__flow-window');
    win.appendChild(flow.cloneNode(true));
    probe.appendChild(win);
    document.body.appendChild(probe);
    const flowRect = win.firstChild.getBoundingClientRect();
    const winRect = win.getBoundingClientRect();
    const total = flowRect.width;
    const perPage = winRect.width;
    const anchors = {};
    win.querySelectorAll('[data-anchor]').forEach(function (anchor) {
      const rect = anchor.getClientRects()[0] || anchor.getBoundingClientRect();
      const fromRight = flowRect.right - rect.right;            // 文章のはじめ（右）からの距離
      const page = Math.max(0, Math.floor((fromRight + 1) / perPage));
      anchors[anchor.dataset.anchor] = {
        page: page,
        x: 1 - ((fromRight - page * perPage) + rect.width / 2) / perPage,   // 窓の左から 0〜1
        y: Math.min(1, Math.max(0, (rect.top - winRect.top) / winRect.height)),
      };
    });
    probe.remove();
    return { count: Math.max(1, Math.ceil((total - 1) / perPage)), anchors: anchors };
  }

  function buildPages(entries) {
    const book = document.getElementById('book');
    const cover = document.getElementById('cover');
    const pages = [];   // 2 ページ目から順に
    let pageNumber = 2;

    function makePage(content, options) {
      const page = element('div', 'page');
      page.dataset.page = String(pageNumber);
      if (content) page.appendChild(content);
      if (options && options.blank) {
        page.classList.add('page--blank');
      } else if (!(options && options.hideNumber)) {
        page.appendChild(element('span', 'page__number', String(pageNumber)));
      }
      pages.push(page);
      pageNumber += 1;
    }

    // 右ページ（奇数）からはじめたいとき、左ページなら白紙を 1 枚はさむ
    function startOnRight() {
      if (pageNumber % 2 === 0) makePage(null, { blank: true });
    }

    // 縦書きの文章を、あふれた分だけページを足しながら流しこむ
    function addFlowPages(flow) {
      const measured = measurePages(flow);
      const first = pageNumber;
      const parts = [];
      for (let n = 0; n < measured.count; n++) {
        const win = element('div', 'page__flow-window');
        const part = flow.cloneNode(true);
        part.style.setProperty('--n', n);                     // n ページ目に見える部分までずらす
        if (n > 0) part.setAttribute('aria-hidden', 'true');  // 読み上げは 1 回だけ
        win.appendChild(part);
        makePage(win);
        parts.push(part);
      }
      // 場面の演出を、ページ数に結びつける（js/effects.js が使う）
      (flow._scenes || []).forEach(function (scene) {
        const where = measured.anchors[String(scene.id)];
        if (!where) return;
        const number = first + where.page;
        scenes.push(Object.assign({}, scene, { page: number, x: where.x, y: where.y }));
        if (scene.effect === 'bleed') {
          // 水彩のにじみ：その言葉のあたりの、文字の奥ににじむ
          const page = pages[number - 2];
          const bleed = element('div', 'bleed');
          bleed.setAttribute('aria-hidden', 'true');
          bleed.style.setProperty('--bx', where.x.toFixed(3));
          bleed.style.setProperty('--by', where.y.toFixed(3));
          for (let i = 0; i < 4; i++) bleed.appendChild(element('span', 'bleed__blot bleed__blot--' + (i + 1)));
          page.insertBefore(bleed, page.firstChild);
        }
      });
      return parts;
    }
    const scenes = [];

    const startPage = [];   // 作品ごとの、はじまりのページ数（目次に使う）
    const tocParts = [];    // 目次のページ（あとでページ数を書きこむ）

    entries.forEach(function (entry, index) {
      if (entry.start === 'right') startOnRight();

      if (entry.type === 'image') {
        const box = element('div', 'page__center');
        const image = element('img', 'page__image');
        window.Kotoba.watchImage(image, entry.image);
        image.src = entry.image;
        image.alt = entry.alt;
        box.appendChild(image);
        makePage(box);
      } else if (entry.type === 'toc') {
        tocParts.push.apply(tocParts, addFlowPages(tocToFlow(entry, entries, index)));
      } else if (entry.type === 'work') {
        startPage[index] = pageNumber;
        if (entry.tobira) {
          // 扉：画像を 1 ページいっぱいに。ページ数は数えるが、見せない
          const box = element('div', 'page__full');
          const image = element('img', 'page__full-image');
          window.Kotoba.watchImage(image, entry.tobira);
          image.src = entry.tobira;
          image.alt = entry.tobiraAlt || (entry.title ? '「' + entry.title + '」扉' : '扉');
          box.appendChild(image);
          makePage(box, { hideNumber: true });
        }
        addFlowPages(workToFlow(entry));
      }
    });

    // 目次に、作品のはじまるページ数を書きこむ
    tocParts.forEach(function (part) {
      part.querySelectorAll('[data-work]').forEach(function (number) {
        number.textContent = String(startPage[number.dataset.work] || '');
      });
    });

    // 2 ページずつ（表＝左、裏＝右）1 枚の紙にする（重なりの奥行きは js/main.js の restack が決める）
    let anchor = cover;
    for (let i = 0; i < pages.length; i += 2) {
      const leaf = element('div', 'leaf');
      const front = element('div', 'leaf__face leaf__front');
      pages[i].classList.add('page--left');
      front.appendChild(pages[i]);

      const back = element('div', 'leaf__face leaf__back');
      const backPage = pages[i + 1] || element('div', 'page page--blank');
      backPage.classList.add('page--right');
      back.appendChild(backPage);

      leaf.appendChild(front);
      leaf.appendChild(back);
      anchor.after(leaf);
      anchor = leaf;
    }

    window.Kotoba.scenes = scenes;
  }

  window.Kotoba.buildPages = buildPages;
  window.Kotoba.typeset = typeset;
  window.Kotoba.plainText = plainText;
})();
