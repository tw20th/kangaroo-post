// apps/web/app/compare/trial-buy/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SERVICE_TYPES,
  SERVICES,
  type ServiceInfo,
  type ServiceTypeDef,
} from "@/lib/compare-data";

export const revalidate = 60;

export default function TrialBuyComparePage() {
  const typeDef: ServiceTypeDef | undefined = SERVICE_TYPES.find(
    (t) => t.id === "trial-buy"
  );
  const services: ServiceInfo[] = SERVICES.filter(
    (s) => s.type === "trial-buy"
  );

  if (!typeDef) {
    notFound();
  }

  if (services.length === 0) {
    return (
      <main className="container-kariraku space-y-6 px-4 pb-16 pt-10">
        <header className="space-y-2">
          <p className="text-xs text-amber-600">
            買う前に試せるレンタルの比較ページ
          </p>
          <h1 className="text-2xl font-bold md:text-3xl">
            {typeDef.title} を比べるページ
          </h1>
          <p className="text-sm text-slate-700 md:text-base">
            {typeDef.description}
          </p>
          <p className="text-xs text-slate-500">※ 本ページは広告を含みます</p>
        </header>

        <p className="text-sm text-slate-700">
          まだこのタイプで比較できるサービスが登録されていません。順次追加予定です。
        </p>

        <p className="mt-4 text-xs text-slate-600">
          <Link href="/offers" className="underline">
            ← 家電レンタル・サブスクの一覧にもどる
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="container-kariraku space-y-10 px-4 pb-16 pt-10">
      {/* ① 冒頭：やさしい結論ゾーン */}
      <header className="space-y-4">
        <p className="text-xs text-amber-600">
          買う前に試せるレンタルの比較ページ
        </p>
        <h1 className="text-2xl font-bold md:text-3xl">
          {typeDef.title} をやさしく比べるページ
        </h1>
        <p className="text-sm text-slate-700 md:text-base">
          {typeDef.description}
        </p>
        <p className="text-xs text-slate-500">
          「いますぐ買う」か「いったん見送る」かの間にある、
          <span className="font-semibold">
            「まずは自分の生活になじむか試してみる」
          </span>
          という選び方を整理したページです。
        </p>
      </header>

      {/* ② ざっくり結論：サービスごとの“ひとことで言うと” */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold md:text-lg">
          まずはざっくり：「どのサービスが、どんな試し方に向いていそうか」
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <article
              key={service.id}
              className="flex flex-col justify-between rounded-2xl border border-amber-50 bg-amber-50/70 p-4 text-xs text-slate-800 shadow-[0_4px_18px_rgba(15,23,42,0.04)] md:text-sm"
            >
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 md:text-base">
                  {service.name}
                </h3>
                {service.tagline && (
                  <p className="text-xs leading-relaxed text-slate-700 md:text-sm">
                    {service.tagline}
                  </p>
                )}
                {service.badges && service.badges.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {service.badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-amber-700"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <Link
                  href={service.href}
                  className="text-[11px] font-semibold text-amber-700 underline underline-offset-2"
                >
                  公式ページの詳細を見る
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ③ タイプの特徴とチェックポイント */}
      <section className="grid gap-6 rounded-3xl bg-slate-50 p-5 md:grid-cols-2 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-semibold md:text-lg">
            「買う前に試す」タイプのレンタルが向いている場面
          </h2>
          <ul className="space-y-1 text-sm text-slate-800 md:text-base">
            {typeDef.bulletPoints.map((point) => (
              <li key={point}>・{point}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold md:text-lg">
            比べるときに見ておきたいポイント
          </h2>
          <ul className="space-y-1 text-sm text-slate-800 md:text-base">
            {typeDef.compareHints.map((hint) => (
              <li key={hint}>・{hint}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600 md:text-sm">
            すべてを完璧に比べようとするとしんどくなるので、
            「このあたりだけは軽くチェックしておこう」くらいの使い方で大丈夫です。
          </p>
        </div>
      </section>

      {/* ④ ゆるい違いのまとめ（文章ベース） */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold md:text-lg">
          もう少しだけ違いを知りたい人向けの、ゆるいまとめ
        </h2>
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-relaxed text-slate-800 md:p-5 md:text-base">
          <p>
            ここでは、細かい料金表ではなく、
            「それぞれどんな試し方に向いているか」をざっくり整理しています。
          </p>
          <ul className="space-y-1">
            <li>
              ・<span className="font-semibold">ゲオ（買えるレンタル）</span>
              ：スマホ・PC・家電などガジェット系を中心に、
              レンタル後そのまま購入できるプランがあるタイプ。
              「最終的には買うつもりだけど、まずは状態や使い心地を確かめたい」人向け。
            </li>
            <li>
              ・<span className="font-semibold">パナソニック Bistro</span>
              ：高機能オーブンレンジを、メーカー公式の定額利用でじっくり試せるタイプ。
              実際の設置感や、ふだんの料理との相性を確認したい人向け。
            </li>
          </ul>
          <p className="text-xs text-slate-600 md:text-sm">
            正確な料金・キャンペーン・在庫状況は、必ず各公式サイトでご確認ください。
            ここでは、「自分の悩み方に近いのはどちらか」を見つけるための手がかりとして使ってもらえれば十分です。
          </p>
        </div>
      </section>

      {/* ⑤ ラストのひと押し＋ストーリーページへのリンク */}
      <section className="space-y-3 rounded-3xl bg-amber-50/70 p-5 md:p-6">
        <h2 className="text-base font-semibold md:text-lg">
          「買う」か「見送る」かの前に、もう一度ゆっくり考えたいときに
        </h2>
        <p className="text-sm leading-relaxed text-slate-800 md:text-base">
          高額な買い物ほど、「なんとなく勢いで決める」のはこわくなりますよね。
          いったんレンタルで暮らしに混ぜてみることで、
          「これは本当に自分の助けになりそうだな」「今じゃなくてもいいかな」が
          少しだけはっきりしてきます。
        </p>
        <p className="text-xs text-slate-600 md:text-sm">
          もっと気持ちの部分から整理したいときは{" "}
          <Link
            href="/story/trial-buy"
            className="text-amber-700 underline underline-offset-2"
          >
            買う前に試せるレンタルのストーリーページ
          </Link>{" "}
          にもどって、
          「どんな場面で迷っているのか」をもう一度ゆっくり眺めてみても良いかなと思います。
        </p>
      </section>
    </main>
  );
}
