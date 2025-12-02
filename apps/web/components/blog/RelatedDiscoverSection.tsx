// apps/web/components/blog/RelatedDiscoverSection.tsx
import FeaturedCard from "@/components/common/FeaturedCard";
import type { RelatedDiscoverBlog } from "@/lib/queries";

type RelatedDiscoverSectionProps = {
  blogs: RelatedDiscoverBlog[];
};

/**
 * Discover 記事の下に表示する「関連記事（Discover）」セクション
 * - 2〜3件くらいを想定
 * - ゆずは世界観のやさしい FeaturedCard を縦並び
 */
export default function RelatedDiscoverSection({
  blogs,
}: RelatedDiscoverSectionProps) {
  if (!blogs.length) {
    return null;
  }

  return (
    <section className="mt-10 border-t border-black/5 pt-6">
      <h2 className="mb-4 text-sm font-semibold tracking-tight text-neutral-800">
        この記事とあわせて読みたい Discover
      </h2>

      <div className="flex flex-col gap-3">
        {blogs.map((b) => (
          <FeaturedCard
            key={b.slug}
            href={`/blog/${b.slug}`}
            title={b.title}
            description={b.summary ?? b.metaDescription ?? undefined}
            label="静かに読まれている記事"
            imageUrl={b.imageUrl ?? undefined}
          />
        ))}
      </div>
    </section>
  );
}
