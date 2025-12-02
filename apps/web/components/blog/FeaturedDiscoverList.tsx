// apps/web/components/blog/FeaturedDiscoverList.tsx
import Link from "next/link";

type FeaturedBlog = {
  slug: string;
  title: string;
  summary?: string | null;
};

type Props = {
  blogs: FeaturedBlog[];
};

export default function FeaturedDiscoverList({ blogs }: Props) {
  if (!blogs || blogs.length === 0) return null;

  return (
    <section className="mt-5 rounded-2xl bg-surface-soft/70 px-5 py-4">
      <div className="text-xs font-semibold text-emerald-800">
        今読まれている Discover
      </div>
      <p className="mt-1 text-xs text-gray-600">
        ふだんのモヤモヤにそっと寄りそう、静かに読まれている小さな読みものです。
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {blogs.map((b) => (
          <Link
            key={b.slug}
            href={`/blog/${b.slug}`}
            className="group flex flex-col rounded-2xl bg-surface-featured/90 px-4 py-3 text-sm shadow-soft hover:shadow-softHover"
          >
            <div className="mb-2 inline-flex items-center gap-1 text-[11px] text-gray-500">
              <span className="rounded-full bg-gray-100 px-2 py-0.5">
                静かに読まれている記事
              </span>
            </div>
            <div className="line-clamp-2 text-xs font-semibold text-gray-900">
              {b.title}
            </div>
            {b.summary && (
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-gray-600">
                {b.summary}
              </p>
            )}
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-700 group-hover:text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>この記事を読む</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
