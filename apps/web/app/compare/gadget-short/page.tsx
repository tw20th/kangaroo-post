// apps/web/app/compare/gadget-short/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SERVICE_TYPES,
  SERVICES,
  type ServiceInfo,
  type ServiceTypeDef,
} from "@/lib/compare-data";

export const revalidate = 60;

export default function GadgetShortComparePage() {
  const typeDef: ServiceTypeDef | undefined = SERVICE_TYPES.find(
    (t) => t.id === "gadget-short"
  );
  const services: ServiceInfo[] = SERVICES.filter(
    (s) => s.type === "gadget-short"
  );

  if (!typeDef) {
    notFound();
  }

  if (services.length === 0) {
    return (
      <main className="container-kariraku space-y-6 px-4 pb-16 pt-10">
        <header className="space-y-2">
          <p className="text-xs text-sky-600">
            ガジェット短期レンタルの比較ページ
          </p>
          <h1 className="text-2xl font-bold md:text-3xl">
            {typeDef.title} を比べるページ
          </h1>
          <p className="text-sm text-slate-600 md:text-base">
            {typeDef.description}
          </p>
          <p className="text-xs text-slate-500">※ 本ページは広告を含みます</p>
        </header>

        <p className="text-sm text-slate-700">
          まだこのタイプで比較できるサービスが登録されていません。順次追加予定です。
        </p>

        <p className="mt-4 text-xs text-slate-600">
          <Link href="/offers" className="underline">
            ← 家電・ガジェットレンタルの一覧にもどる
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="container-kariraku space-y-10 px-4 pb-16 pt-10">
      {/* ① 冒頭：やさしい結論ゾーン */}
      <header className="space-y-4">
        <p className="text-xs text-sky-600">
          ガジェット短期レンタルの比較ページ
        </p>
        <h1 className="text-2xl font-bold md:text-3xl">
          {typeDef.title} をやさしく比べるページ
        </h1>
        <p className="text-sm text-slate-700 md:text-base">
          {typeDef.description}
        </p>
        <p className="text-xs text-slate-500">
          「どれが一番お得か」というより、
          <span className="font-semibold">
            自分のイベントや用途にいちばん近いサービスはどれか
          </span>
          を探すページです。数字はざっくりで OK なつくりにしています。
        </p>
      </header>

      {/* ② ざっくり結論：サービスごとの「ひとことで言うと」 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold md:text-lg">
          まずはざっくり：「どのサービスが、どんな場面に向いていそうか」
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.id}
              className="flex flex-col justify-between rounded-2xl border border-sky-50 bg-sky-50/70 p-4 text-xs text-slate-800 shadow-[0_4px_18px_rgba(15,23,42,0.04)] md:text-sm"
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
                        className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-sky-700"
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
                  className="text-[11px] font-semibold text-sky-700 underline underline-offset-2"
                >
                  公式ページの詳細を見る
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ③ タイプの特徴と、比べるときのチェックポイント */}
      <section className="grid gap-6 rounded-3xl bg-slate-50 p-5 md:grid-cols-2 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-semibold md:text-lg">
            ガジェット短期レンタルって、どんなときに向いている？
          </h2>
          <ul className="space-y-1 text-sm text-slate-800 md:text-base">
            {typeDef.bulletPoints.map((point) => (
              <li key={point}>・{point}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold md:text-lg">
            サービスを比べるときに、見ておきたいところ
          </h2>
          <ul className="space-y-1 text-sm text-slate-800 md:text-base">
            {typeDef.compareHints.map((hint) => (
              <li key={hint}>・{hint}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-600 md:text-sm mt-2">
            すべて細かく覚える必要はありません。
            「このあたりをざっくり眺めておけば、大きなミスはしにくそう」
            くらいのチェックリストとしてどうぞ。
          </p>
        </div>
      </section>

      {/* ④ もう少しちゃんと読みたい人向け：ゆるい違いのまとめ */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold md:text-lg">
          もう少しだけ違いを知りたい人向けの、ゆるいまとめ
        </h2>
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-relaxed text-slate-800 md:p-5 md:text-base">
          <p>
            料金や在庫は日々変わるので、ここでは細かい数字よりも、
            「それぞれどんな方向に強いサービスか」をざっくり整理しています。
          </p>
          <ul className="space-y-1">
            <li>
              ・<span className="font-semibold">ゲオあれこれレンタル</span>：
              カメラ・双眼鏡・家電などジャンルが広く、イベントや旅行で
              「いろいろまとめて借りたい」人向け
            </li>
            <li>
              ・<span className="font-semibold">DMMいろいろレンタル</span>：
              家電以外にスーツケース・ベビー用品など、
              ライフスタイル全体をまとめて見たい人向け
            </li>
            <li>
              ・<span className="font-semibold">Rentry</span>：
              カメラ・レンズ・ドローンなど撮影系に特化していて、
              「写真や動画をちゃんと残したい」人向け
            </li>
          </ul>
          <p className="text-xs text-slate-600 md:text-sm">
            正確な料金や条件は、必ず各公式サイトでご確認ください。
            ここではあくまで、「どのサービスを候補に入れるか」を決めるための地図として使ってもらえれば十分です。
          </p>
        </div>
      </section>

      {/* ⑤ ラストのひと押し＋ストーリーページへのリンク */}
      <section className="space-y-3 rounded-3xl bg-sky-50/70 p-5 md:p-6">
        <h2 className="text-base font-semibold md:text-lg">
          どれが一番お得かよりも、
          <br className="md:hidden" />
          「このイベントにはどれが合いそうか」で考えてみる
        </h2>
        <p className="text-sm leading-relaxed text-slate-800 md:text-base">
          ライブ・推し活・旅行・家族の記念日…。
          ガジェット短期レンタルは、その日その時間のために
          ちょっとだけ力を借りるようなイメージに近いかもしれません。
          まー、このページを一周見てみて「自分はこのあたりのサービスから見ていけばよさそう」
          と感じられたら、それだけで十分かなと思います。
        </p>
        <p className="text-xs text-slate-600 md:text-sm">
          もっと雰囲気から考えたいときは{" "}
          <Link
            href="/story/gadget-short"
            className="underline underline-offset-2 text-sky-700"
          >
            ガジェット短期レンタルのストーリーページ
          </Link>{" "}
          に戻って、「どんな場面で使いたいのか」からゆっくりイメージしてみても大丈夫です。
        </p>
      </section>
    </main>
  );
}
