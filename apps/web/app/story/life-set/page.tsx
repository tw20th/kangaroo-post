// apps/web/app/story/life-set/page.tsx
import Link from "next/link";

export const revalidate = 1800;

export default function LifeSetStoryPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* ヒーロー（淡いグラデーション） */}
      <section className="rounded-3xl bg-gradient-to-br from-emerald-50 to-slate-50 p-6 md:p-10 shadow-sm">
        <p className="text-xs font-medium text-emerald-600">
          家具・家電レンタルのストーリー
        </p>

        <h1 className="mt-2 text-2xl font-bold leading-relaxed md:text-3xl">
          引っ越し前に「家電を一式そろえるかどうか」迷ったときの、
          <br className="md:hidden" />
          小さなストーリー
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-700 md:text-base">
          新しい部屋はもう決まったけれど、冷蔵庫や洗濯機、ベッドなどをどうそろえるかは
          まだふんわりしている…。そんな「暮らしの準備の途中」で出てくるモヤっとを、
          いちど静かに整理してみるための読みものです。
        </p>

        {/* 右側画像（後で差し替えOK） */}
        <div className="mt-6 flex h-40 items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-white/40 text-sm text-slate-400 md:h-48">
          ここに「引っ越し前の空っぽの部屋」イメージ画像を配置予定
        </div>
      </section>

      {/* 本文：short story */}
      <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-800 md:text-base">
        <p>
          契約書にサインをして、不動産屋さんを出た帰り道。
          手元には間取り図のコピーと、次回の予定がメモされた小さな紙だけが残っています。
        </p>
        <p>
          さっきまで見ていた部屋は、まだ何も置かれていない、まっさらな空間でした。
          窓から入る光の向きや、コンセントの位置を思い出しながら、
          「ここに冷蔵庫で、こっちに洗濯機かな…」と、頭の中だけ少しだけ先に進んでいく感じ。
        </p>
        <p>
          とはいえ、冷蔵庫・洗濯機・電子レンジ・ベッド…と書き出していくと、
          それぞれがそれなりの値段とサイズで、「ぜんぶ一気に買うの、けっこう大ごとだな…」と
          ふと足が重くなる瞬間もあったりします。まー、その気持ちはとても自然なものかなと思います。
        </p>
      </section>

      {/* こんなときに「一式レンタル」が候補になりやすい、の整理 */}
      <section className="mt-10 rounded-2xl bg-surface-featured px-5 py-5 text-sm text-slate-800 shadow-soft md:px-6 md:py-6 md:text-base">
        <h2 className="text-base font-semibold text-slate-900 md:text-lg">
          「全部そろえるのはちょっと重たいかも」と感じたときに
        </h2>
        <p className="mt-2">
          一式レンタルは、「買わない」選択というより、
          <span className="font-semibold">
            「いまの自分の暮らし方に合わせて、そろえ方を一度ゆるめてみる」
          </span>
          くらいのニュアンスに近いかもしれません。
        </p>
        <ul className="mt-3 space-y-1">
          <li>・いつまでこの部屋に住むか、まだはっきり決めきれていないとき</li>
          <li>
            ・単身赴任や仮住まいで、「とりあえず生活できる状態」を早く整えたいとき
          </li>
          <li>
            ・最初から新品を全部そろえるのは、出費も気持ちも少ししんどいな…と感じるとき
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-600 md:text-sm">
          どれかひとつでも当てはまるなら、「生活まるごとレンタル（家具・家電セット）」という
          選び方が、いちど候補に入ってもよいタイミングかもしれません。
        </p>
      </section>

      {/* 比較ページへのやさしい誘導 */}
      <section className="mt-10 space-y-4 text-sm leading-relaxed text-slate-800 md:text-base">
        <h2 className="text-base font-semibold md:text-lg text-emerald-800">
          いまの自分の状況に、すこしでも近いところはありましたか？
        </h2>
        <p>
          「あ、ちょっとわかるかも」と感じる部分があれば、家具・家電をまるごと借りられる
          サービスを、もう少しだけ丁寧に見比べてみるのもひとつの手かなと思います。
          がっつり比較するというより、
          <span className="font-semibold">
            「自分はこのあたりを見ておけばよさそうだな」
          </span>
          と目星をつけるくらいの気持ちで大丈夫です。
        </p>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <Link
            href="/compare/life-set"
            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            一式レンタルのサービスをやさしく比べてみる
          </Link>
          <p className="text-xs text-slate-600 md:text-sm">
            ※ 「かして！どっとこむ」「ラクリアーズ」「Happy!レンタル」など、
            生活まるごとレンタルに近いサービスだけを、少し少なめにしぼって整理したページです。
          </p>
        </div>

        <p className="text-xs text-slate-500 md:text-sm">
          まだ決める段階じゃないな…というときは、またあとでこのページに戻ってきても大丈夫です。
          ん、ちょっとだけイメージが整理できたかも…くらいの感覚で、そっと置いておいてもらえたら。
        </p>
      </section>
    </main>
  );
}
