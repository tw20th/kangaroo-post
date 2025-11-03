// apps/web/components/blog/BlogBody.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolink from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import { normalizeBlogMarkdown } from "@/utils/markdown";

// ★ Client-safe CTA（server-only依存なし）
function AffiliateCta({
  href,
  label = "公式サイトへ",
  className = "",
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
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

type Props = { content: string };

const isA8 = (u?: string) => !!u && /(^|\/\/)px\.a8\.net/i.test(u);

export default function BlogBody({ content }: Props) {
  const md = React.useMemo(() => normalizeBlogMarkdown(content), [content]);

  const components = {
    a({ href, children, ...rest }: any) {
      if (isA8(href)) {
        return (
          <AffiliateCta
            href={href as string}
            className="mt-4"
            label="公式サイトへ"
          />
        );
      }
      return (
        <a
          {...rest}
          href={href}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="underline"
        >
          {children}
        </a>
      );
    },
    img({ src, alt }: any) {
      // A8の画像バナーは非表示
      if (isA8(src)) return null;
      return (
        <img
          src={src}
          alt={alt ?? ""}
          className="rounded-xl mx-auto my-4 max-h-[420px] w-auto"
        />
      );
    },
    ul(props: any) {
      return <ul {...props} className="list-disc pl-6 space-y-1" />;
    },
    ol(props: any) {
      return <ol {...props} className="list-decimal pl-6 space-y-1" />;
    },
    blockquote(props: any) {
      return (
        <blockquote
          {...props}
          className="border-l-4 pl-4 italic text-gray-700"
        />
      );
    },
    h2(props: any) {
      return <h2 {...props} className="mt-10 mb-3 text-2xl font-bold" />;
    },
    h3(props: any) {
      return <h3 {...props} className="mt-8 mb-2 text-xl font-semibold" />;
    },
    code({ inline, children, ...rest }: any) {
      return inline ? (
        <code {...rest} className="px-1 py-0.5 rounded bg-gray-100">
          {children}
        </code>
      ) : (
        <pre className="rounded-xl bg-gray-100 p-4 overflow-auto text-sm">
          <code {...rest}>{children}</code>
        </pre>
      );
    },
    // :::cta[ラベル](URL) をボタン化（不完全なものは無視）
    p({ children }: any) {
      const txt = Array.isArray(children)
        ? children.join("")
        : String(children ?? "");
      const line = txt.trim();

      // 正式トークンならCTA化
      const m = /^:::cta\[(.+?)\]\((https?:\/\/[^\s)]+)\)$/.exec(line);
      if (m) return <AffiliateCta href={m[2]} label={m[1]} className="my-6" />;

      // "::cta..." で始まるがトークン不成立 → 残骸は出さない
      if (/^:::+\s*cta/i.test(line)) return null;

      return <p className="leading-7 my-3">{children}</p>;
    },
  };

  return (
    <div className="prose prose-neutral max-w-none prose-img:rounded-xl prose-headings:scroll-mt-20">
      <ReactMarkdown
        components={components as any}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolink, { behavior: "wrap" }],
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
