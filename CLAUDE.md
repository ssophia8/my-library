# このリポジトリで作業する Claude へ

- 縦書きの文芸誌サイト。`index.html` / `css/` / `js/` が「型」、`literatures/` が「中身」（Git 管理外）。
- **`literatures/` は `literatures/sample/` 以外、読まない・書かない・一覧しない。** シェル（cat など）やコピー経由でも同じ。設定とフック（`.claude/`）でも止めてあるが、止められていない経路があっても読まないこと。
- ブラウザ（headless Chrome など）で動作を確かめるときは、必ず `index.html?sample` で文例を使う。中身が写ったスクリーンショットを撮らない。
- 中身の形式（`Kotoba.book` / `Kotoba.work`）は `literatures/sample/` と `js/loader.js` を見る。
- `git add -f` で `literatures/` を足さない。コミット前に `git status` で `literatures/` の中身が入っていないことを確かめる。
- 利用者は非エンジニア。説明は平易な日本語で。
