# ルール

- 返事は必ず日本語。途中の報告も最後の報告も。出す前に日本語か必ず確かめる
- 指示に無い変更は絶対にしない。必要なら先に聞く
- 確認したいことがある時は、質問して返事を待ってから作業する（聞かずに走り出さない）
- 2択で聞いて「はい」だけの返事なら、もう一度聞き直す
- 細かい許可はいちいち取らず、やることをまとめて伝えたら一気に進める
- 入力枠の高さは必ずそろえる
- POS の顧客画面（pos/）と顧客サイト（customer/）は同じデザインにする。変更は両方に入れる
- すべてのサイト（POS・顧客サイト・タイムカード・管理サイト）の情報はつながっている。どこかで変えたら、それを表示している全部のサイトに最新の情報が出るようにする
- 公開は preview.html だけ。本番（pos/index.html・customer/index.html）はユーザーの指示があるまで触らない
- 作ったものは、見せる前に自分で開いて確認する
- 返事の最後に毎回このリンクを付ける
  POS preview：https://olive-system.github.io/olive-pos-web/pos/preview.html
  顧客サイト preview：https://olive-system.github.io/olive-pos-web/customer/preview.html
  タイムカード：https://olive-system.github.io/olive-pos-web/timecard/
  管理サイト：https://olive-system.github.io/olive-pos-web/admin/preview.html
- 会話が重くなったら、言われる前に引き継ぎ文を出す
- SQL を渡す時は、実行する SQL のすぐ下に、その PR（Merge する）のリンクを置く（さかのぼらなくていいように）
