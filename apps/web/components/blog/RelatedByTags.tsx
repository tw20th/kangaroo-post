// apps/web/components/blog/RelatedByTags.tsx
import Link from "next/link";
import { fetchRelatedBlogsByTags } from "@/lib/queries";

export default async function RelatedByTags({
  siteId,
  tags,
  currentSlug,
  title = "関連ガイド",
  limit = 3,
}: {
  siteId: string;
  tags: string[];
  currentSlug: string;
  title?: string;
  limit?: number;
}) {
  const items = await fetchRelatedBlogsByTags(siteId, tags, currentSlug, limit);
  if (!items.length) return null;

  return (
    <div>
      <div className="mb-2 text-sm text-gray-600">{title}</div>
      <ul className="space-y-2">
        {items.map((b) => (
          <li key={b.slug} className="text-sm">
            <Link href={`/blog/${b.slug}`} className="underline">
              {b.title}
            </Link>
            {b.summary ? (
              <div className="text-gray-600 line-clamp-2">{b.summary}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
