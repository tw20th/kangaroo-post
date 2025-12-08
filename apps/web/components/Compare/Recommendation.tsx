// apps/web/components/Compare/Recommendation.tsx
import Link from "next/link";

export default function Recommendation() {
  return (
    <section className="space-y-4 rounded-3xl bg-slate-50 p-4 md:p-6">
      <h2 className="text-base font-semibold md:text-lg">
        まとめ：こんなときは、このタイプから見るとラクかもです
      </h2>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-emerald-50 p-4 text-xs md:text-sm">
          <p className="font-semibold">🏠 引っ越し・新生活・仮住まいのとき</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>冷蔵庫・洗濯機・ベッドを一気にそろえたい</li>
            <li>数カ月〜2年くらいの利用を考えている</li>
          </ul>
          <p className="mt-2">
            →{" "}
            <Link
              href="#"
              className="text-emerald-700 underline underline-offset-2"
            >
              生活まるごとレンタルのタイプ
            </Link>{" "}
            と{" "}
            <Link
              href="#"
              className="text-emerald-700 underline underline-offset-2"
            >
              かして！どっとこむ
            </Link>{" "}
            を中心に見てみるとイメージしやすいです。
          </p>
        </div>

        <div className="rounded-2xl bg-sky-50 p-4 text-xs md:text-sm">
          <p className="font-semibold">
            📷 ライブ・イベント・旅行・推し活のとき
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>双眼鏡やカメラを数日だけ借りたい</li>
            <li>スーツケースなどもまとめて借りたい</li>
          </ul>
          <p className="mt-2">
            →{" "}
            <Link
              href="#"
              className="text-sky-700 underline underline-offset-2"
            >
              ガジェット短期レンタルのタイプ
            </Link>{" "}
            と{" "}
            <Link
              href="#"
              className="text-sky-700 underline underline-offset-2"
            >
              ゲオあれこれレンタル
            </Link>{" "}
            などを見ると、「この目的ならどれが近そうか」がつかみやすくなります。
          </p>
        </div>

        <div className="rounded-2xl bg-amber-50 p-4 text-xs md:text-sm">
          <p className="font-semibold">
            ✨ 高額家電やガジェットを買う前に試したいとき
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>ちゃんと使いこなせるか不安</li>
            <li>実際のサイズ感や音の大きさを自宅で確かめたい</li>
          </ul>
          <p className="mt-2">
            →{" "}
            <Link
              href="#"
              className="text-amber-700 underline underline-offset-2"
            >
              買う前に試せるレンタルのタイプ
            </Link>{" "}
            や{" "}
            <Link
              href="#"
              className="text-amber-700 underline underline-offset-2"
            >
              パナソニック Bistro のお試し
            </Link>{" "}
            を見ると、「買う／借りる」のバランスが考えやすくなります。
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-700 md:text-sm">
        どれが「正解」というよりも、{" "}
        <span className="font-semibold">
          いまの自分の生活にいちばんフィットしそうなタイプ
        </span>
        を見つけられれば十分かな、と思っています。ん、ちょっとイメージが湧いてきたかも…
        くらいの感覚で大丈夫です。
      </p>
    </section>
  );
}
