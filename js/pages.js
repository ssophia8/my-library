// 文芸誌 — 中身からページを組む
// ※ これはプログラムのファイルです。書きかえないでください。
//   本の文字（題・作品など）を変えるときは、literatures/book.js（sample の外のほう）を書きかえます。
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

  // 作品の文章を、縦書きの段落に。1 行が 1 段落、空行はそのまま 1 行あき
  function workToFlow(work) {
    const flow = element('div', 'flow');
    // 扉がある作品は、扉に題と作者名があるので、本文のはじめには出さない（目次には出る）
    if ((work.title || work.author) && !work.tobira) {
      const header = element('header', 'flow__header');
      if (work.title) header.appendChild(element('h2', null, work.title));
      if (work.author) header.appendChild(element('p', 'author', work.author));
      flow.appendChild(header);
    }
    const lines = String(work.text || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(function (line) { return line.replace(/^[ \t]+|[ \t]+$/g, ''); });  // 半角の空白は取る（全角の字下げは残す）
    while (lines.length && lines[0].trim() === '') lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.forEach(function (line) {
      if (line.trim() === '') flow.appendChild(element('p', 'blank', ' '));
      else flow.appendChild(element('p', null, line));
    });
    if (work.signature) flow.appendChild(element('p', 'signature', work.signature));
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

  // 縦書き一段組の文章が何ページ分になるかを測る
  function measurePages(flow) {
    const probe = element('div', 'page measure');
    const win = element('div', 'page__flow-window');
    win.appendChild(flow.cloneNode(true));
    probe.appendChild(win);
    document.body.appendChild(probe);
    const total = win.firstChild.getBoundingClientRect().width;
    const perPage = win.getBoundingClientRect().width;
    probe.remove();
    return Math.max(1, Math.ceil((total - 1) / perPage));
  }

  function buildPages(entries) {
    const book = document.getElementById('book');
    const cover = document.getElementById('cover');
    const pages = [];   // 2 ページ目から順に
    let pageNumber = 2;

    function makePage(content, options) {
      const page = element('div', 'page');
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
      const count = measurePages(flow);
      const parts = [];
      for (let n = 0; n < count; n++) {
        const win = element('div', 'page__flow-window');
        const part = flow.cloneNode(true);
        part.style.setProperty('--n', n);                     // n ページ目に見える部分までずらす
        if (n > 0) part.setAttribute('aria-hidden', 'true');  // 読み上げは 1 回だけ
        win.appendChild(part);
        makePage(win);
        parts.push(part);
      }
      return parts;
    }

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

    // 2 ページずつ（表＝左、裏＝右）1 枚の紙にする
    let z = 1;
    let anchor = cover;
    for (let i = 0; i < pages.length; i += 2) {
      const leaf = element('div', 'leaf');
      leaf.style.setProperty('--z', z++);

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

    // 裏表紙の内側は、いちばん下
    const block = book.querySelector('.block');
    if (block) block.style.setProperty('--z', z);
  }

  window.Kotoba.buildPages = buildPages;
})();
