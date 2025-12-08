// apps/web/components/Compare/TypeIntro.tsx
export default function TypeIntro() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs text-emerald-600">
          家具・家電レンタルのやさしいガイド
        </p>
        <h1 className="text-2xl font-bold leading-relaxed md:text-3xl">
          家具家電レンタルをどう選ぶ？ <br className="md:hidden" />
          タイプ別にやさしく比べるページ
        </h1>
        <p className="text-sm text-slate-600 md:text-base">
          「引っ越しのために一式そろえたい」「イベント用にカメラだけ借りたい」
          「高めの家電を試してから買いたい」… レンタルといっても目的はいろいろ。
          まずは{" "}
          <span className="font-semibold">
            自分に近い「レンタルのタイプ」をサッと選べる
          </span>
          ようにまとめました。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-xs font-semibold text-emerald-700">タイプA</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
            🏠 生活まるごとレンタル
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-700">
            冷蔵庫・洗濯機・ベッドなど、
            引っ越しや単身赴任で「生活に必要なもの一式」をまとめて借りたい人向け。
          </p>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
          <p className="text-xs font-semibold text-sky-700">タイプB</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
            📷 ガジェット短期レンタル
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-700">
            ライブ・旅行・推し活などで、カメラや双眼鏡・
            ノートPCなどを「数日〜数週間だけ」使いたい人向け。
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <p className="text-xs font-semibold text-amber-700">タイプC</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
            ✨ 買う前に試せるレンタル
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-700">
            高額な家電・ガジェットを、まずは自宅で試してから決めたい人向け。
            「買う／借りる」の失敗を減らしたいときに。
          </p>
        </div>
      </div>
    </section>
  );
}
