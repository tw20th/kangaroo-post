"use client";
import * as React from "react";

type Props = {
  slug: string;
  siteId?: string; // ★ 追加
  endpoint?: string;
};

/**
 * 表示時に1回だけ:
 * - 旧来の /trackClick に { slug, type: "view" }
 * - 新しい /api/track に { type: "blog", siteId, blogSlug, where: "view" }
 */
export default function TrackBlog({ slug, siteId, endpoint }: Props) {
  const url = endpoint || process.env.NEXT_PUBLIC_TRACK_URL || "/trackClick"; // Hosting で Functions に rewrite する前提

  React.useEffect(() => {
    try {
      const payload = JSON.stringify({ slug, type: "view" as const });
      // 旧来のトラッキング（既存のダッシュボード用）
      if ("sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        (navigator as any).sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      /* no-op */
    }

    // 新しいブログ用トラッキング（/api/track）
    if (siteId) {
      try {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "blog" as const,
            siteId,
            blogSlug: slug,
            where: "compare",
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* no-op */
      }
    }
  }, [slug, siteId, url]);

  return null;
}
