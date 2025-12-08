// apps/web/components/Compare/ServiceCards.tsx
import Link from "next/link";

type ServiceCard = {
  id: string;
  type: "living" | "gadget" | "trial";
  name: string;
  catchCopy: string;
  badges: string[];
  affiliateUrl: string;
};

const services: ServiceCard[] = [
  {
    id: "kasite",
    type: "living",
    name: "かして！どっとこむ",
    catchCopy: "冷蔵庫・洗濯機・ベッドまで一式そろえやすい老舗レンタル",
    badges: ["家電＋家具セット", "ファミリーOK", "全国配送"],
    affiliateUrl: "https://px.a8.net/svt/ejp?a8mat=45GDPD+G5OKCI+OE2+HV7V6",
  },
  {
    id: "rakulease",
    type: "living",
    name: "ラクリアーズ",
    catchCopy: "すべて新品・サブスク感覚で“月額でそろえる”タイプ",
    badges: ["すべて新品", "サブスク型", "初期費用0円"],
    affiliateUrl: "#",
  },
  {
    id: "happy",
    type: "living",
    name: "Happy!レンタル",
    catchCopy: "一人暮らし向けに、必要なものだけピンポイントで借りやすい",
    badges: ["一人暮らし向け", "短期〜中期", "家具＋家電"],
    affiliateUrl: "#",
  },
  {
    id: "geo",
    type: "gadget",
    name: "ゲオあれこれレンタル",
    catchCopy:
      "カメラ・双眼鏡・PC・家電など、イベントや旅行向けの“短期レンタル”が得意",
    badges: ["短期レンタル", "コンビニ返却", "往復送料無料※"],
    affiliateUrl: "https://px.a8.net/svt/ejp?a8mat=45GDPD+G534QQ+5212+5Z6WY",
  },
  {
    id: "dmm",
    type: "gadget",
    name: "DMMいろいろレンタル",
    catchCopy: "ガジェット以外に、ファッション・ベビー用品などとにかく幅広い",
    badges: ["ジャンル数が豊富", "短期レンタル", "買えるレンタルあり"],
    affiliateUrl: "#",
  },
  {
    id: "rentry",
    type: "gadget",
    name: "Rentry",
    catchCopy: "カメラ・レンズ特化で、撮影系アイテムの種類がとても多いサービス",
    badges: ["カメラ特化", "初心者向けガイド", "往復送料無料※"],
    affiliateUrl: "#",
  },
  {
    id: "geo-trial",
    type: "trial",
    name: "ゲオ（買えるレンタル）",
    catchCopy:
      "まずレンタル→気に入ったらそのまま購入できる“買えるレンタル”プランあり",
    badges: ["買えるレンタル", "月額あり", "ガジェットお試し"],
    affiliateUrl: "https://px.a8.net/svt/ejp?a8mat=45GDPD+G534QQ+5212+5Z6WY",
  },
  {
    id: "bistro",
    type: "trial",
    name: "パナソニック Bistro 定額利用",
    catchCopy: "高機能オーブンレンジを、自宅でじっくり試してから検討できる",
    badges: ["高機能家電お試し", "メーカー公式", "レシピ充実"],
    affiliateUrl: "#",
  },
];

const typeLabels: Record<
  "living" | "gadget" | "trial",
  { title: string; lead: string; accentClass: string; emoji: string }
> = {
  living: {
    title: "生活まるごとレンタル（家具・家電セット）",
    lead: "引っ越し・単身赴任・仮住まいなどで、冷蔵庫・洗濯機・ベッドなど「生活に必要なもの一式」をまとめてそろえたい人向けのタイプ。",
    accentClass: "bg-emerald-600 text-white",
    emoji: "🏠",
  },
  gadget: {
    title: "ガジェット短期レンタル（カメラ・双眼鏡・PCなど）",
    lead: "ライブ・イベント・旅行・推し活などで、カメラや双眼鏡・ノートPCなどを「数日〜数週間だけ」使いたい人向けのタイプ。",
    accentClass: "bg-sky-600 text-white",
    emoji: "📷",
  },
  trial: {
    title: "買う前に試せるレンタル（お試し・買えるレンタル）",
    lead: "「いきなり買うのはちょっと不安…」という高額家電・ガジェットを、まずは自宅で試してから判断したい人向けのタイプです。",
    accentClass: "bg-amber-600 text-white",
    emoji: "✨",
  },
};

export default function ServiceCards() {
  const grouped: Record<"living" | "gadget" | "trial", ServiceCard[]> = {
    living: services.filter((s) => s.type === "living"),
    gadget: services.filter((s) => s.type === "gadget"),
    trial: services.filter((s) => s.type === "trial"),
  };

  return (
    <section className="space-y-10">
      {(Object.keys(grouped) as Array<"living" | "gadget" | "trial">).map(
        (type) => {
          const group = grouped[type];
          const info = typeLabels[type];

          // ★ アンカーIDを追加
          const anchorId =
            type === "living"
              ? "type-life"
              : type === "gadget"
              ? "type-gadget"
              : "type-trial";

          return (
            <section key={type} id={anchorId} className="space-y-4">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${info.accentClass}`}
                >
                  {info.emoji} {info.title}
                </span>
              </div>
              <p className="text-xs text-slate-700 md:text-sm">{info.lead}</p>

              <div className="grid gap-4 md:grid-cols-3">
                {group.map((service) => (
                  <article
                    key={service.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
                  >
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">{service.name}</h3>
                      <p className="text-xs text-slate-600">
                        {service.catchCopy}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {service.badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Link
                        href="#tables"
                        className="text-[11px] text-slate-500 underline underline-offset-2"
                      >
                        詳しい比較・条件をチェック
                      </Link>
                      <Link
                        href={service.affiliateUrl}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        公式ページを見る
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        }
      )}
    </section>
  );
}
