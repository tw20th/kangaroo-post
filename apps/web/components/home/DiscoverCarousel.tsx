// apps/web/components/home/DiscoverCarousel.tsx
import Link from "next/link";
import type { BlogSummary } from "./BlogsSection";

type Props = {
  title: string;
  items: BlogSummary[];
};

function formatDateYmd(ts?: number) {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export default function DiscoverCarousel({ title, items }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="h2">{title}</h2>
        <Link
          href="/blog?type=discover"
          className="text-xs font-medium text-emerald-700 underline"
        >
          もっと見る
        </Link>
      </div>

      {/* 横スクロールカルーセル */}
      <div className="-mx-4 overflow-x-auto pb-3">
        <div className="flex gap-4 px-4">
          {items.map((b) => (
            <Link
              key={b.slug}
              href={`/blog/${b.slug}`}
              className="min-w-[260px] max-w-xs flex-1 rounded-2xl border bg-white/80 px-4 py-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md"
            >
              <div className="mb-1 text-[11px] font-semibold text-emerald-700">
                おすすめ・読みもの
              </div>
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                {b.title}
              </h3>
              {b.summary && (
                <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-gray-600">
                  {b.summary}
                </p>
              )}
              <div className="mt-2 text-[11px] text-gray-500">
                更新日: {formatDateYmd(b.updatedAt)}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
