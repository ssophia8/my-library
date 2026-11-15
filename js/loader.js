// 文芸誌 — 本の中身を literatures/ から読みこむ
// ※ これはプログラムのファイルです。書きかえないでください。
//   本の文字（題・作品など）を変えるときは、literatures/book.js（sample の外のほう）を書きかえます。
//
// このサイトは「型」（index.html・css・js）と「中身」（literatures/）に分かれています。
// 中身（表紙の絵・書名・作品）は Git の管理外なので、GitHub には上がりません。
//
//   literatures/book.js         … 本の情報と目次（Kotoba.book({...})）
//   literatures/〇〇.js          … 作品（Kotoba.work({...})）
//   literatures/sample/          … 文例。これだけは Git で管理します
//
// literatures/book.js が無いとき（GitHub から取ってきたばかりのときなど）や、
// index.html?sample と開いたときは、literatures/sample/ の文例で本を組みます。
//
// ブラウザでファイルを直接ひらいても動くように、中身は <script> として読みこみます。
(function () {
  let book = null;     // Kotoba.book(...) で渡された本の情報
  let entries = [];    // 目次の順に並べた、ページの中身（作品・画像・目次）
  let currentBase = ''; // 中身のフォルダ（literatures/ か literatures/sample/）

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { script.remove(); reject(new Error('読みこめません: ' + src)); };
      document.head.appendChild(script);
    });
  }

  // ---------- うまく読みこめなかったことを、画面の左上で知らせる ----------
  // （中身を Claude に見せなくても、どこを直せばよいかが本人にわかるように）
  function folderName(base) {
    return base.replace(/\/$/, '') + ' フォルダ';
  }
  function showProblem(message) {
    let box = document.getElementById('problems');
    if (!box) {
      box = document.createElement('div');
      box.id = 'problems';
      box.className = 'problems';
      box.setAttribute('role', 'status');
      box.innerHTML = '<p class="problems__title">うまく読みこめなかったものがあります</p><ul class="problems__list"></ul>' +
        '<button type="button" class="problems__close">とじる</button>';
      box.querySelector('.problems__close').addEventListener('click', function () { box.remove(); });
      document.body.appendChild(box);
    }
    const item = document.createElement('li');
    item.textContent = message;
    box.querySelector('.problems__list').appendChild(item);
  }
  // 画像が見つからないときに知らせる
  function watchImage(image, base, name) {
    image.addEventListener('error', function () {
      showProblem('画像「' + name + '」が見つかりません。' + folderName(base) + 'に、同じ名前で入っているか確かめてください。');
    });
  }

  function loadBook(base) {
    book = null;
    return loadScript(base + 'book.js').then(function () {
      if (!book) {
        const error = new Error(base + 'book.js に Kotoba.book(...) がありません');
        error.broken = true;   // ファイルはあるのに読めない＝書きまちがい
        throw error;
      }
      return base;
    });
  }

  // 目次（contents）を上から順に。作品のファイルは 1 つずつ順番に読みこむ
  //   'sakuhin.js'                    … 作品のファイル
  //   { image: 'logo.png', alt: '' }  … 画像を 1 ページの真ん中に
  //   { toc: true }                   … 目次のページ（このあとに並ぶ作品の題・作者名・ページ数）
  function loadContents(base) {
    entries = [];
    currentBase = base;
    return (book.contents || []).reduce(function (chain, item) {
      return chain.then(function () {
        if (typeof item === 'string') {
          const before = entries.length;
          return loadScript(base + item).then(function () {
            if (entries.length === before) {
              showProblem('「' + item + '」に書きまちがいがあるようで、作品として読めませんでした。' +
                'VS Code でこのファイルを開くと、まちがいのあるところに赤い波線が出ます' +
                '（⌘ + shift + M で、何行目かの一覧も見られます）。' +
                '本文を囲む ` が両方あるか、\' や , が抜けていないか、全角（’ や ，）になっていないかを見てください。');
            }
          }, function () {
            showProblem('「' + item + '」が見つかりません。' + folderName(base) + 'に、同じ名前で入っているか確かめてください。');
          });
        }
        if (item && item.image) {
          entries.push({ type: 'image', image: base + item.image, alt: item.alt || '', start: item.start });
        } else if (item && item.toc) {
          entries.push({ type: 'toc', title: typeof item.toc === 'string' ? item.toc : '目次', start: item.start });
        }
      });
    }, Promise.resolve());
  }

  // ---------- 表紙・扉に、書名などを入れる ----------
  function dressCover(base) {
    const lines = (book.credit || []).concat(book.editor ? [book.editor] : []);

    if (book.title) document.title = book.title;

    const cover = document.getElementById('cover');
    const label = (book.title ? '『' + book.title + '』表紙。' : '表紙。') + (book.coverAlt || '');
    cover.setAttribute('aria-label', label);

    const image = cover.querySelector('.cover__front img');
    if (book.cover) {
      watchImage(image, base, book.cover);
      image.addEventListener('error', function () { image.remove(); });   // 絵が無ければ無地の表紙
      image.src = base + book.cover;
    } else {
      image.remove();
    }

    // 表紙の文字（ふれると落ちてくる）
    cover.querySelector('.cover__title').textContent = book.title || '';
    cover.querySelectorAll('.cover__line').forEach(function (line, i) {
      if (lines[i]) line.textContent = lines[i]; else line.remove();
    });

    // 扉（1 ページ目）
    const titlePage = document.querySelector('.title-page');
    titlePage.querySelector('.title-page__title').textContent = book.title || '';
    const credit = titlePage.querySelector('.title-page__credit');
    (book.credit || []).forEach(function (text, i) {
      if (i > 0) credit.appendChild(document.createElement('br'));
      credit.appendChild(document.createTextNode(text));
    });
    titlePage.querySelector('.title-page__editor').textContent = book.editor || '';
  }

  // ほかのファイル（js/shelf.js など）が先に入れたものは残して、継ぎ足す
  window.Kotoba = Object.assign(window.Kotoba || {}, {
    // literatures/book.js から呼ぶ
    book: function (data) { book = data || {}; },
    // 作品のファイルから呼ぶ（tobira に画像の名前を書くと、作品の前に扉のページが入る）
    work: function (data) {
      const work = Object.assign({ type: 'work' }, data);
      if (work.tobira) work.tobira = currentBase + work.tobira;
      entries.push(work);
    },

    // js/pages.js から使う：画像（path は中身のフォルダからの場所）が見つからないときに知らせる
    watchImage: function (image, path) {
      const cut = path.lastIndexOf('/') + 1;
      watchImage(image, path.slice(0, cut), path.slice(cut));
    },

    // 中身を読みこんで表紙を整え、ページの中身を返す
    load: function () {
      const wantSample = /(^|[?&])sample(=|&|$)/.test(location.search.slice(1));
      const first = wantSample
        ? Promise.reject(new Error('sample'))
        : loadBook('literatures/').catch(function (error) {
          if (error.broken) {
            showProblem('literatures フォルダの book.js に書きまちがいがあるようです。かわりに見本の本を出しています。' +
              '\' や , が抜けていないか、全角（’ や ，）になっていないかを見てください。');
          }
          throw error;
        });
      return first
        .catch(function () { return loadBook('literatures/sample/'); })
        .then(function (base) {
          return loadContents(base).then(function () {
            dressCover(base);
            return entries;
          });
        });
    }
  });
})();
