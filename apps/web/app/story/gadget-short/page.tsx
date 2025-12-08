// apps/web/app/story/gadget-short/page.tsx
import Link from "next/link";

export const revalidate = 1800;

export default function GadgetShortStoryPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* ヒーロー（淡いグラデーションで最初のページと統一） */}
      <section className="rounded-3xl bg-gradient-to-br from-sky-50 to-slate-50 p-6 md:p-10 shadow-sm">
        <p className="text-xs font-medium text-sky-600">
          家電・ガジェットのストーリー
        </p>

        <h1 className="mt-2 text-2xl font-bold leading-relaxed md:text-3xl">
          「ライブの日が近づくにつれて、
          <br className="md:hidden" />
          ふっと浮かぶ “カメラどうしよう問題”
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
          推し活や旅行、家族のイベントなど、
          「この日だけはちゃんと残したい」という瞬間がありますよね。
          でもカメラや双眼鏡を買うとなると、
          金額も種類も多くて、ちょっと腰が重くなることもあります。
          そのあたりの“静かなモヤモヤ”を、そっと整理するためのストーリーです。
        </p>

        {/* 右側画像（後で差し替えOK） */}
        <div className="mt-6 h-40 rounded-2xl border border-dashed border-sky-200 bg-white/40 md:h-48 flex items-center justify-center text-slate-400 text-sm">
          ここに「イベント前の小さな準備」イメージ画像を配置予定
        </div>
      </section>

      {/* ストーリーテキスト */}
      <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-800 md:text-base">
        <p>
          ライブのチケットを取って、日付をカレンダーに書き込んだ瞬間。
          少しだけ気分が上がると同時に、
          「あれ、双眼鏡どうしよう」「スマホだけで撮れるかな…」と
          ふっと小さな不安が顔を出すことがあります。
        </p>

        <p>
          SNS では “この機種が良かった” という話も流れてくるけれど、
          いざ自分で選ぼうとすると、機能や価格の違いが多すぎて
          「んー…今買うのはちょっと違う気もする」と立ち止まったり。
        </p>

        <p>
          そんなときに視界の端に入ってくるのが、 数日だけ借りられる
          “ガジェット短期レンタル” という選択肢です。
        </p>
      </section>

      {/* このタイミングならレンタルが候補になる */}
      <section className="mt-10 rounded-2xl bg-surface-featured p-5 shadow-soft md:p-6">
        <h2 className="text-base font-semibold md:text-lg text-sky-800">
          「買うほどではないけれど、ちゃんと使いたい」日に
        </h2>

        <p className="mt-2 text-sm text-slate-700 md:text-base">
          ガジェット短期レンタルがフィットしやすいのは、こんな場面かもしれません。
        </p>

        <ul className="mt-3 space-y-1 text-sm text-slate-800 md:text-base">
          <li>・推し活やライブで、双眼鏡やカメラを“数日だけ”使いたいとき</li>
          <li>・旅行で荷物を最小限にしたくて、必要な機材だけ借りたいとき</li>
          <li>・最新モデルを試したいけれど、買うのはまだ決めきれないとき</li>
        </ul>

        <p className="mt-3 text-xs text-slate-600 md:text-sm">
          いきなり買わなくても、「この用途ならこれで十分かも」という感覚がつかめるので、
          気持ちが少し軽くなることが多いです。
        </p>
      </section>

      {/* 比較ページへの誘導 */}
      <section className="mt-10 space-y-4 text-sm leading-relaxed text-slate-800 md:text-base">
        <h2 className="text-base font-semibold md:text-lg text-sky-800">
          ちょっと試しに見てみたいな…と思ったら
        </h2>

        <p>
          ゲオ・DMM・Rentry など、短期レンタルに強いサービスだけを
          分かりやすくまとめた比較ページがあります。
          「どれが良いか決める」よりも、
          <span className="font-semibold">自分の用途に近いものを見つける</span>
          くらいの気持ちで大丈夫です。
        </p>

        <Link
          href="/compare/gadget-short"
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          ガジェット短期レンタルをやさしく比べてみる
        </Link>

        <p className="text-xs text-slate-500 md:text-sm">
          まだ決めなくて大丈夫です。 “あ、こういう形もあるんだ”
          と知っておくだけでも、だいぶラクになります。
        </p>
      </section>
    </main>
  );
}
