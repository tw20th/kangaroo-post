// apps/web/components/products/ProductFilterList.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { OfferLite } from "@/components/offers/OfferCompareTable";

type Scene = "all" | "move" | "single" | "cost";

type Props = {
  items: OfferLite[];
};

function sceneLabel(scene: Scene): string {
  switch (scene) {
    case "move":
      return "引越し・転勤向け";
    case "single":
      return "一人暮らし向け";
    case "cost":
      return "初期費用をおさえたい";
    case "all":
    default:
      return "すべて";
  }
}

function matchScene(scene: Scene, item: OfferLite): boolean {
  if (scene === "all") return true;

  const haystack = [
    ...(item.badges ?? []),
    ...(item.notes ?? []),
    item.ui?.compareHighlight ?? "",
    item.title,
  ].join(" ");

  const text = haystack.toLowerCase();

  if (scene === "move") {
    return (
      text.includes("引越") ||
      text.includes("転勤") ||
      text.includes("短期") ||
      text.includes("一時")
    );
  }

  if (scene === "single") {
    return (
      text.includes("一人暮らし") ||
      text.includes("ひとり暮らし") ||
      text.includes("新生活")
    );
  }

  if (scene === "cost") {
    return (
      text.includes("格安") ||
      text.includes("コスパ") ||
      text.includes("初期費用") ||
      text.includes("安く")
    );
  }

  return true;
}

export default function ProductFilterList({ items }: Props) {
  const [scene, setScene] = useState<Scene>("all");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (!matchScene(scene, item)) return false;

      if (maxPrice != null && typeof item.priceMonthly === "number") {
        if (item.priceMonthly > maxPrice) return false;
      }

      return true;
    });
  }, [items, scene, maxPrice]);

  const handlePriceChange = (value: string) => {
    if (value === "") {
      setMaxPrice(null);
    } else {
      const n = Number(value);
      setMaxPrice(Number.isNaN(n) ? null : n);
    }
  };

  return (
    <div className="space-y-4">
      {/* フィルター UI */}
      <div className="rounded-xl border bg-white p-4 text-sm space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs text-gray-500">シーンでしぼる</span>
          <div className="flex flex-wrap gap-2">
            {(["all", "move", "single", "cost"] as Scene[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScene(s)}
                className={
                  scene === s
                    ? "rounded-full bg-emerald-600 px-3 py-1 text-xs text-white"
                    : "rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                }
              >
                {sceneLabel(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs text-gray-500">月額の目安</span>
          <select
            value={maxPrice ?? ""}
            onChange={(e) => handlePriceChange(e.target.value)}
            className="rounded border px-2 py-1 text-xs"
          >
            <option value="">指定なし</option>
            <option value={4000}>〜4,000円</option>
            <option value={6000}>〜6,000円</option>
            <option value={8000}>〜8,000円</option>
            <option value={10000}>〜10,000円</option>
          </select>
          <span className="text-xs text-gray-400">
            （目安。サービスにより異なります）
          </span>
        </div>

        <div className="text-xs text-gray-500">
          該当サービス：{filtered.length}件
        </div>
      </div>

      {/* 一覧カード */}
      <ul className="space-y-3">
        {filtered.map((o) => {
          const href = o.affiliateUrl || `/offers/${encodeURIComponent(o.id)}`;

          const monthly =
            typeof o.priceMonthly === "number"
              ? `月額 ${o.priceMonthly.toLocaleString()}円〜`
              : o.ui?.priceLabel ?? "料金は公式サイトで確認";

          const minTerm =
            o.ui?.minTermLabel ??
            (typeof o.minTermMonths === "number"
              ? `最低 ${o.minTermMonths}ヶ月〜`
              : "最低利用期間は公式サイトで確認");

          return (
            <li
              key={o.id}
              className="rounded-2xl border bg-white p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {o.isRecommended && (
                    <span className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      おすすめ
                    </span>
                  )}
                  <h2 className="text-sm font-semibold">{o.title}</h2>
                </div>
                {o.ui?.compareHighlight && (
                  <p className="text-xs text-emerald-700">
                    {o.ui.compareHighlight}
                  </p>
                )}
                <div className="text-xs text-gray-600">
                  {monthly} ／ {minTerm}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {o.badges?.slice(0, 4).map((b) => (
                    <span
                      key={b}
                      className="inline-flex rounded-full border px-2 py-0.5 text-[11px]"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 md:mt-0 md:text-right">
                <Link
                  href={href}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  公式サイトを見る →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-600">
          条件に合うサービスが見つかりませんでした。条件をゆるめてお試しください。
        </p>
      )}
    </div>
  );
}
