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
  isRecommended?: boolean;
  compareHighlight?: string;
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
    <div className="w-full overflow-x-auto rounded-2xl border border-black/5 bg-white/80">
      <table className="w-full min-w-[720px] text-sm">
        {caption && (
          <caption className="p-3 text-left text-xs text-gray-600 md:text-sm">
            {caption}
          </caption>
        )}
        <thead className="bg-gray-50">
          <tr className="text-left">
            <th className="p-3 font-semibold">サービス</th>
            <th className="p-3 font-semibold whitespace-nowrap">月額目安</th>
            <th className="p-3 font-semibold whitespace-nowrap">
              最低利用期間
            </th>
            <th className="p-3 font-semibold">特徴</th>
            <th className="p-3" />
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

            const highlight = o.compareHighlight ?? o.ui?.compareHighlight;
            const features: string[] = [
              ...(o.badges ?? []),
              ...(o.notes ?? []),
            ].slice(0, 3);

            return (
              <tr
                key={o.id}
                className={`border-t ${
                  o.isRecommended ? "bg-emerald-50/60" : "bg-white"
                }`}
              >
                <td className="p-3 align-top">
                  <div className="flex items-start gap-3">
                    {o.isRecommended && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">
                        おすすめ
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">{o.title}</div>
                      {highlight && (
                        <div className="mt-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          {highlight}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                <td className="whitespace-nowrap p-3 align-top">{priceCell}</td>

                <td className="whitespace-nowrap p-3 align-top">{termCell}</td>

                <td className="p-3 align-top">
                  <div className="flex flex-wrap gap-2">
                    {features.map((f, i) => (
                      <span
                        key={`${o.id}-feature-${i}`}
                        className="inline-block rounded-full border px-2 py-0.5 text-xs"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="p-3 text-right align-top">
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="nofollow sponsored"
                      className="btn btn-brand"
                    >
                      公式サイトへ
                    </a>
                  ) : (
                    <Link href={href} className="btn btn-brand">
                      公式サイトへ
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
