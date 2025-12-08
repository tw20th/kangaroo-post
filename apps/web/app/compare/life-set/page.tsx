// apps/web/app/compare/life-set/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SERVICE_TYPES,
  SERVICES,
  type ServiceInfo,
  type ServiceTypeDef,
} from "@/lib/compare-data";

export const revalidate = 60;

export default function LifeSetComparePage() {
  const typeDef: ServiceTypeDef | undefined = SERVICE_TYPES.find(
    (t) => t.id === "life-set"
  );
  const services: ServiceInfo[] = SERVICES.filter((s) => s.type === "life-set");

  if (!typeDef) {
    notFound();
  }

  if (services.length === 0) {
    return (
      <main className="container-kariraku space-y-6 px-4 pb-16 pt-10">
        <header className="space-y-2">
          <p className="text-xs text-emerald-600">
            家具・家電レンタルの比較ページ
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
            ← 家電レンタルの一覧にもどる
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="container-kariraku space-y-10 px-4 pb-16 pt-10">
      {/* ① 冒頭：やさしい結論ゾーン */}
      <header className="space-y-4">
        <p className="text-xs text-emerald-600">
          家具・家電レンタルの比較ページ
        </p>
        <h1 className="text-2xl font-bold md:text-3xl">
          {typeDef.title} をやさしく比べるページ
        </h1>
        <p className="text-sm text-slate-700 md:text-base">
          {typeDef.description}
        </p>
        <p className="text-xs text-slate-500">
          最初にざっくり方向性だけ知りたい人向けに、
          「どのサービスがどんな人に向いているか」を先にまとめています。
          そのあとで、少しだけ詳しい違いを見ていく流れになっています。
        </p>
      </header>

      {/* ② ざっくり結論：サービスごとの「ひとことで言うと」 */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold md:text-lg">
          まずはざっくり：「どのサービスが、どんな人に向いていそうか」
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.id}
              className="flex flex-col justify-between rounded-2xl border border-emerald-50 bg-emerald-50/70 p-4 text-xs text-slate-800 shadow-[0_4px_18px_rgba(15,23,42,0.04)] md:text-sm"
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
                        className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-emerald-700"
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
                  className="text-[11px] font-semibold text-emerald-700 underline underline-offset-2"
                >
                  公式ページの詳細を見る
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ③ タイプの特徴と、比べるときに見ておきたいポイント */}
      <section className="grid gap-6 rounded-3xl bg-slate-50 p-5 md:grid-cols-2 md:p-6">
        <div className="space-y-3">
          <h2 className="text-base font-semibold md:text-lg">
            生活まるごとレンタルって、どんなときに向いている？
          </h2>
          <ul className="space-y-1 text-sm text-slate-800 md:text-base">
            {typeDef.bulletPoints.map((point) => (
              <li key={point}>・{point}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold md:text-lg">
            サービスを比べるときに、チェックしておきたいところ
          </h2>
          <ul className="space-y-1 text-sm text-slate-800 md:text-base">
            {typeDef.compareHints.map((hint) => (
              <li key={hint}>・{hint}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-600 md:text-sm">
            すべてを完璧に覚える必要はありません。
            「このあたりを見ておけば大きなミスはしにくいかも」くらいの目安として使ってください。
          </p>
        </div>
      </section>

      {/* ④ もう少しちゃんと読みたい人向け：違いのまとめ（テキストだけ） */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold md:text-lg">
          もう少しだけ違いを知りたい人向けの、ゆるいまとめ
        </h2>
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-relaxed text-slate-800 md:p-5 md:text-base">
          <p>
            サービスごとの細かい料金や在庫は日々変わるので、ここでは数字を細かく並べるよりも、
            「どのサービスがどんな方向に強いか」だけを整理しています。
          </p>
          <ul className="space-y-1">
            <li>
              ・<span className="font-semibold">かして！どっとこむ</span>
              ：家電＋家具セットが多く、ファミリー〜単身赴任まで幅広く使いやすい
            </li>
            <li>
              ・<span className="font-semibold">ラクリアーズ</span>
              ：サブスクに近い形で、新品を長めに使いたい人向け
            </li>
            <li>
              ・<span className="font-semibold">Happy!レンタル</span>
              ：一人暮らしや仮住まいで、「必要なものだけ」をそろえたい人向け
            </li>
          </ul>
          <p className="text-xs text-slate-600 md:text-sm">
            正確な料金や条件は、かならず各公式サイトでご確認ください。
            ここではあくまで、「ざっくり方向性をつかむための地図」として使ってもらえればうれしいです。
          </p>
        </div>
      </section>

      {/* ⑤ ラストのやさしいひと押し */}
      <section className="space-y-3 rounded-3xl bg-emerald-50/70 p-5 md:p-6">
        <h2 className="text-base font-semibold md:text-lg">
          どれが「正解」かよりも、
          <br className="md:hidden" />
          いまの生活にいちばんフィットするかどうか
        </h2>
        <p className="text-sm leading-relaxed text-slate-800 md:text-base">
          新生活の家電って、一度にすべてを決めるとすごくエネルギーがいります。
          まー、このページをきっかけに「自分はこのあたりのサービスから見ていけばよさそうだな」
          くらいの輪郭がつかめていれば十分かなと思っています。
        </p>
        <p className="text-xs text-slate-600 md:text-sm">
          もう少し悩みたいときは、{" "}
          <Link href="/story/life-set" className="underline underline-offset-2">
            一式レンタルのストーリーページ
          </Link>
          に戻って、「どんな暮らし方をしたいか」からゆっくり考えてみても大丈夫です。
        </p>
      </section>
    </main>
  );
}
