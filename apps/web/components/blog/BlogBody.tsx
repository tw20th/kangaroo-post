// apps/web/components/blog/BlogBody.tsx
"use client";

/* eslint-disable @next/next/no-img-element */

import React from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeExternalLinks from "rehype-external-links";
import { normalizeBlogMarkdown } from "@/utils/markdown";

function AffiliateCta({
  href,
  label = "公式サイトへ",
  className = "",
  onClick,
}: {
  href: string;
  label?: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={
        "inline-flex items-center justify-center rounded-lg border px-4 py-2 font-medium hover:shadow-sm " +
        className
      }
    >
      {label}
    </a>
  );
}

function PainLink({ tag, label }: { tag: string; label: string }) {
  const href = `/pain/${encodeURIComponent(tag)}`;
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-full border px-3 py-1 text-sm hover:shadow-sm mr-2 mb-2"
    >
      {label}
    </a>
  );
}

type Props = {
  content: string;
  siteId?: string | null;
  painId?: string | null;
  slug?: string;
};

const isA8 = (u?: string) => !!u && /(^|\/\/)px\.a8\.net/i.test(u);

function childrenToPlainText(children: React.ReactNode): string {
  const parts = React.Children.toArray(children).map((c) =>
    typeof c === "string" ? c : ""
  );
  return parts.join("");
}

// ✅ code 用 props（hast 依存なし）
type CodeProps = React.ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
  node?: unknown;
};

export default function BlogBody({ content, siteId, painId, slug }: Props) {
  const md = React.useMemo(
    () => normalizeBlogMarkdown(content ?? ""),
    [content]
  );

  const painTrackEndpoint =
    process.env.NEXT_PUBLIC_PAIN_TRACK_URL || "/trackPainClick";

  const trackPainClick = React.useCallback(
    (href?: string) => {
      if (!painId || !siteId) return;
      try {
        const payload = JSON.stringify({
          painId,
          siteId,
          slug,
          href,
        });

        if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
          const blob = new Blob([payload], { type: "application/json" });
          (
            navigator as unknown as { sendBeacon: (u: string, b: Blob) => void }
          ).sendBeacon(painTrackEndpoint, blob);
        } else {
          fetch(painTrackEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // 計測なので失敗しても黙る
      }
    },
    [painId, siteId, slug, painTrackEndpoint]
  );

  const components: Components = {
    a({ href, children, ...rest }) {
      const url = typeof href === "string" ? href : undefined;
      const isExternal = !!url && /^https?:\/\//i.test(url);
      const isA8Link = isA8(url);

      const isCompareLink =
        !!url &&
        (url === "/compare" ||
          url.startsWith("/compare?") ||
          url.endsWith("/compare/kaden-rental"));

      const onClick = isCompareLink
        ? (e: React.MouseEvent<HTMLAnchorElement>) => {
            if (typeof rest.onClick === "function") {
              rest.onClick(e);
            }
            trackPainClick(url);
          }
        : rest.onClick;

      return (
        <a
          {...rest}
          href={url}
          onClick={onClick}
          target={isExternal ? "_blank" : undefined}
          rel={
            isExternal
              ? `${
                  isA8Link ? "nofollow sponsored" : "nofollow"
                } noopener noreferrer`
              : undefined
          }
          className="underline"
        >
          {children}
        </a>
      );
    },

    img({ src, alt }) {
      const s = typeof src === "string" ? src : undefined;
      if (isA8(s)) return null;

      return (
        <img
          src={s}
          alt={typeof alt === "string" ? alt : ""}
          className="rounded-xl mx-auto my-4 max-h-[420px] w-auto"
        />
      );
    },

    ul(props) {
      return <ul {...props} className="list-disc pl-6 space-y-1" />;
    },

    ol(props) {
      return <ol {...props} className="list-decimal pl-6 space-y-1" />;
    },

    blockquote(props) {
      return (
        <blockquote
          {...props}
          className="border-l-4 pl-4 italic text-gray-700"
        />
      );
    },

    h2(props) {
      return <h2 {...props} className="mt-10 mb-3 text-2xl font-bold" />;
    },

    h3(props) {
      return <h3 {...props} className="mt-8 mb-2 text-xl font-semibold" />;
    },

    // ✅ TS2339 回避済み
    code({ inline, children, ...rest }: CodeProps) {
      if (inline) {
        return (
          <code {...rest} className="px-1 py-0.5 rounded bg-gray-100">
            {children}
          </code>
        );
      }

      return (
        <pre className="rounded-xl bg-gray-100 p-4 overflow-auto text-sm">
          <code {...rest}>{children}</code>
        </pre>
      );
    },

    p({ children }) {
      const line = childrenToPlainText(children).trim();

      const mCta = /^:::cta\[(.+?)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)$/.exec(
        line
      );
      if (mCta) {
        const href = mCta[2];
        const isCompare =
          href === "/compare" ||
          href.startsWith("/compare?") ||
          href.endsWith("/compare/kaden-rental");
        const onClick = isCompare ? () => trackPainClick(href) : undefined;

        return (
          <AffiliateCta
            href={href}
            label={mCta[1]}
            className="my-6"
            onClick={onClick}
          />
        );
      }
      if (/^:::+\s*cta/i.test(line)) return null;

      const mPain = /^:::pain\[(.+?)\]\(([^)]+)\)$/.exec(line);
      if (mPain) {
        return <PainLink tag={mPain[2]} label={mPain[1]} />;
      }
      if (/^:::+\s*pain/i.test(line)) return null;

      return <p className="leading-7 my-3">{children}</p>;
    },
  };

  return (
    <div className="prose prose-neutral max-w-none prose-img:rounded-xl prose-headings:scroll-mt-20">
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [
            rehypeExternalLinks,
            { target: "_blank", rel: ["nofollow", "noopener", "noreferrer"] },
          ],
        ]}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}
