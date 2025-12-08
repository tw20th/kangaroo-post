// apps/web/app/story/trial-buy/page.tsx
import Link from "next/link";

export const revalidate = 1800;

export default function TrialBuyStoryPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* ヒーロー（淡いグラデーション） */}
      <section className="rounded-3xl bg-gradient-to-br from-amber-50 to-slate-50 p-6 md:p-10 shadow-sm">
        <p className="text-xs font-medium text-amber-600">
          高額家電・ガジェットのストーリー
        </p>

        <h1 className="mt-2 text-2xl font-bold leading-relaxed md:text-3xl">
          「気になっている家電があるけれど、
          <br className="md:hidden" />
          まだ“買う”とまでは言い切れないときの悩み
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
          スチームオーブンレンジ、ドラム式洗濯乾燥機、高性能なカメラやPC…。
          生活が少しラクになりそうな予感はあるけれど、
          価格もサイズもそれなりで、「本当に自分に合うかな？」と足が止まることがあります。
          その“ちょっとだけ迷っている感じ”を整理するための読みものです。
        </p>

        {/* 右側画像（後で差し替えOK） */}
        <div className="mt-6 flex h-40 items-center justify-center rounded-2xl border border-dashed border-amber-200 bg-white/40 text-sm text-slate-400 md:h-48">
          ここに「買う前にじっくり試している」イメージ画像を配置予定
        </div>
      </section>

      {/* ストーリー本文 */}
      <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-800 md:text-base">
        <p>
          キッチンに立つたびに、
          「ここにあのオーブンレンジがあったらどうだろう」と想像してみる。
          洗濯物を干しながら、
          「ドラム式だったら、もう少し時間に余裕ができるのかな」と考えてみる。
        </p>

        <p>
          そんなふうに、日常の中で何度か頭をよぎるようになると、
          商品ページを開いては閉じて…をくり返してしまうことがあります。
          んー、良さそうなんだけど、
          「本当に使いこなせるかな」「置き場所、大丈夫かな」と、
          小さなひっかかりが残ったままになってしまう感じです。
        </p>

        <p>
          そこで選択肢に入ってくるのが、
          <span className="font-semibold">
            「まずはレンタルでじっくり試してみる」
          </span>
          というやり方です。
        </p>
      </section>

      {/* こういうときに trial-buy がフィットしやすい */}
      <section className="mt-10 rounded-2xl bg-surface-featured p-5 shadow-soft md:p-6">
        <h2 className="text-base font-semibold text-amber-800 md:text-lg">
          ぜんぶ“買う”前に、少しだけ肩の力を抜いてみる選び方
        </h2>

        <p className="mt-2 text-sm text-slate-700 md:text-base">
          「買う前に試せるレンタル」が役に立ちやすいのは、こんな場面かもしれません。
        </p>

        <ul className="mt-3 space-y-1 text-sm text-slate-800 md:text-base">
          <li>・高額家電を検討していて、使いこなせるか少し不安なとき</li>
          <li>
            ・サイズ感や音の大きさ、設置したときの圧迫感を自宅で確かめたいとき
          </li>
          <li>・「買ってから後悔したくないな」と感じているとき</li>
        </ul>

        <p className="mt-3 text-xs text-slate-600 md:text-sm">
          一度レンタルで生活に混ぜてみることで、
          「自分の暮らしにちゃんとなじみそうか」が見えやすくなります。
        </p>
      </section>

      {/* 比較ページへの誘導 */}
      <section className="mt-10 space-y-4 text-sm leading-relaxed text-slate-800 md:text-base">
        <h2 className="text-base font-semibold text-amber-800 md:text-lg">
          いくつか候補を見比べてから決めたいな…と思ったら
        </h2>

        <p>
          ゲオの「買えるレンタル」や、パナソニック{" "}
          <span className="font-semibold">Bistro</span> の定額利用など、
          「試してから買う」「試してみてから決める」に近いサービスだけを
          集めた比較ページがあります。 どれが一番お得かを決めるというよりも、
          <span className="font-semibold">
            自分の迷い方に近いサービスを見つける
          </span>
          くらいの気持ちで眺めてもらえたら十分です。
        </p>

        <Link
          href="/compare/trial-buy"
          className="inline-flex items-center justify-center rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
        >
          買う前に試せるレンタルをやさしく比べてみる
        </Link>

        <p className="text-xs text-slate-500 md:text-sm">
          まだ「買う」と決めていない段階のモヤモヤも、そのままで大丈夫です。
          ん、ちょっとイメージが整理できたかも…くらいの気持ちでページを閉じてもらえたら。
        </p>
      </section>
    </main>
  );
}
