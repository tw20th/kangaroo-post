"use client";
import * as React from "react";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  slug: string;
  siteId?: string; // ★ ブログ用トラッキングに使用
  whereKey?: string; // ★ CTA の位置識別（例: "cta_bestPrice_top"）
};

export default function CtaLink({
  slug,
  siteId,
  whereKey,
  onClick,
  href,
  ...rest
}: Props) {
  // 既存の /trackClick 用
  function sendLegacy(type: "cta") {
    try {
      const endpoint = process.env.NEXT_PUBLIC_TRACK_URL || "/trackClick";
      const payload = JSON.stringify({ slug, type });
      if ("sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        (navigator as any).sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      /* no-op */
    }
  }

  // 新しい /api/track 用（ブログ専用）
  function sendBlogTrack() {
    if (!siteId) return; // siteId が渡されたときだけブログとして計測
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "blog" as const,
          siteId,
          blogSlug: slug,
          href: href ?? null,
          where: whereKey ?? "cta",
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* no-op */
    }
  }

  return (
    <a
      {...rest}
      href={href}
      onClick={(e) => {
        sendLegacy("cta");
        sendBlogTrack();
        onClick?.(e);
      }}
    />
  );
}
