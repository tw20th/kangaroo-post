"use client";
import Link from "next/link";

export type OfferLite = {
  id: string;
  title: string;
  affiliateUrl: string;
  badges: string[];
  priceMonthly?: number | null;
  minTermMonths?: number | null;
  notes?: string[];
  ui?: {
    priceLabel?: string;
    minTermLabel?: string;
    compareHighlight?: string;
    isPriceDynamic?: boolean;
  };
  /** 一覧や比較で先頭を「おすすめ」扱いしたいとき用 */
  isRecommended?: boolean;
};

const isExternal = (url: string) => /^https?:\/\//i.test(url);

export default function OfferCompareTable({
  items,
  caption,
}: {
  items: OfferLite[];
  caption?: string;
}) {
  if (!items?.length) return null;

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-[800px] w-full text-sm">
        {caption && (
          <caption className="text-left p-3 text-gray-600">{caption}</caption>
        )}
        <thead className="bg-gray-50">
          <tr className="text-left">
            <th className="p-3 font-semibold">サービス</th>
            <th className="p-3 font-semibold">月額目安</th>
            <th className="p-3 font-semibold">最低利用期間</th>
            <th className="p-3 font-semibold">特徴</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => {
            const href =
              o.affiliateUrl || `/offers/${encodeURIComponent(o.id)}`;
            const external = isExternal(o.affiliateUrl);

            const priceCell =
              o.ui?.priceLabel ??
              (typeof o.priceMonthly === "number"
                ? `¥${o.priceMonthly.toLocaleString()}〜`
                : "—");

            const termCell =
              o.ui?.minTermLabel ??
              (typeof o.minTermMonths === "number"
                ? `${o.minTermMonths}ヶ月〜`
                : "—");

            return (
              <tr key={o.id} className="border-t">
                {/* サービス名 + 比較ハイライト + おすすめバッジ */}
                <td className="p-3 align-top">
                  <div className="flex items-start gap-3">
                    {o.isRecommended && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">
                        おすすめ
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">{o.title}</div>
                      {o.ui?.compareHighlight && (
                        <div className="mt-1 text-xs text-gray-500">
                          {o.ui.compareHighlight}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* 月額目安 */}
                <td className="p-3 align-top whitespace-nowrap">{priceCell}</td>

                {/* 最低利用期間 */}
                <td className="p-3 align-top whitespace-nowrap">{termCell}</td>

                {/* 特徴バッジ */}
                <td className="p-3 align-top">
                  <div className="flex flex-wrap gap-2">
                    {o.badges?.slice(0, 4).map((b) => (
                      <span
                        key={b}
                        className="inline-block rounded-full border px-2 py-0.5 text-xs"
                      >
                        {b}
                      </span>
                    ))}
                    {o.notes?.slice(0, 2).map((n, i) => (
                      <span
                        key={i}
                        className="inline-block rounded-full border px-2 py-0.5 text-xs"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </td>

                {/* CTA */}
                <td className="p-3 text-right align-top">
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="nofollow sponsored"
                      className="inline-flex items-center rounded-lg bg-emerald-600 text-white px-3 py-2 hover:bg-emerald-700"
                    >
                      公式へ →
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="inline-flex items-center rounded-lg bg-emerald-600 text-white px-3 py-2 hover:bg-emerald-700"
                    >
                      公式へ →
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
