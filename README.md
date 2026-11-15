# my-library

ブラウザで本をひらくように読む、縦書きの文芸誌サイトの「型」です。
index.html をブラウザで開くと読めます。

## 構成

- `index.html` / `css/` / `js/` … 本の型（見た目と動き）
- `literatures/` … 本の中身（表紙の絵・書名・作品）。**Git の管理外で、GitHub には上がりません**
- `literatures/sample/` … 中身の書き方の文例。これだけは Git で管理します

`literatures/book.js` が無いとき（clone した直後など）は、文例で本が組まれます。
`index.html?sample` と開くと、中身があっても文例で表示します。

## 中身の置き方

1. `literatures/sample/book.js` を `literatures/book.js` にコピーし、書名・目次などを書きかえる
2. 作品ごとに `literatures/sample/sakuhin.js` と同じ形のファイルを `literatures/` に置き、`book.js` の `contents` に名前を足す
3. 表紙の絵やロゴなどの画像も `literatures/` に置き、`book.js` に名前を書く

## Claude Code について

`literatures/` の中身（`sample/` 以外）は、Claude Code が読み書きしない設定にしています。

- `.claude/settings.json` … `literatures/` 直下のファイルの読み取りを禁止（permissions.deny）
- `.claude/hooks/guard-literatures.py` … deny で書けない部分（フォルダの中、シェルからの読み取り）を止めるフック
