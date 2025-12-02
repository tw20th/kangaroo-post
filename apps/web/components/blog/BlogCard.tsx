// apps/web/components/blog/BlogCard.tsx
import Link from "next/link";
import Image from "next/image";

type BlogCardProps = {
  slug: string;
  title: string;
  summary?: string | null;
  content?: string;
  imageUrl?: string | null;
  imageCredit?: string | null;
  imageCreditLink?: string | null;
  publishedAt?: number | null;
  updatedAt?: number | null;
  // 他の場所から意図せず渡される props を潰さないための保険
  [key: string]: unknown;
};

function formatDate(ts?: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function makeQuickSummary(summary?: string | null, content?: string): string {
  if (summary && summary.trim().length > 0) return summary.trim();

  if (!content) return "";
  const plain = content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length > 80 ? `${plain.slice(0, 80)}…` : plain;
}

export default function BlogCard(props: BlogCardProps) {
  const { slug, title, summary, content, imageUrl, publishedAt, updatedAt } =
    props;

  const displaySummary = makeQuickSummary(summary ?? undefined, content);
  const published = publishedAt ?? updatedAt ?? null;

  return (
    <li>
      <article className="group flex h-full flex-col overflow-hidden rounded-card border border-black/5 bg-surface-featured shadow-soft transition hover:shadow-softHover">
        <Link href={`/blog/${slug}`} className="flex h-full flex-col">
          {/* 画像エリア：比率固定 & 少しだけ動き */}
          <div className="relative w-full overflow-hidden bg-surface-soft">
            <div className="relative aspect-[16/9] w-full">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                  画像なしの記事
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/5" />
            </div>
          </div>

          {/* テキストエリア */}
          <div className="flex flex-1 flex-col px-4 py-3">
            <div className="mb-1 text-[11px] font-medium text-emerald-700">
              ブログ記事
            </div>
            <h2 className="line-clamp-2 text-sm font-semibold tracking-tight text-gray-900">
              {title}
            </h2>

            {displaySummary && (
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-600">
                {displaySummary}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
              <span>
                {published ? `公開: ${formatDate(published)}` : "公開日: -"}
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 group-hover:text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>詳しく読む</span>
              </span>
            </div>
          </div>
        </Link>
      </article>
    </li>
  );
}
