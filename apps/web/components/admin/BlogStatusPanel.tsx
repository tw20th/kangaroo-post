// apps/web/components/admin/BlogStatusPanel.tsx
"use client";

import { useTransition } from "react";
import type { BlogStatus } from "@/types/blog";
import { updateBlogStatus } from "@/app/admin/blogs/[slug]/actions";

type Props = {
  slug: string;
  status: BlogStatus;
};

export function BlogStatusPanel({ slug, status }: Props) {
  const [pending, startTransition] = useTransition();

  const isPublished = status === "published";

  const handlePublish = () => {
    startTransition(() => updateBlogStatus(slug, "published"));
  };

  const handleDraft = () => {
    startTransition(() => updateBlogStatus(slug, "draft"));
  };

  return (
    <section className="rounded-xl border bg-white p-4 text-sm shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="font-semibold">公開ステータス</div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isPublished
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-gray-50 text-gray-600 border border-gray-200"
          }`}
        >
          {isPublished ? "公開中" : "下書き"}
        </span>
      </div>

      <p className="mb-3 text-[11px] text-gray-500">
        AIで自動生成 /
        リライトされた記事を、ここから公開・非公開に切り替えできます。
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {isPublished ? (
          <button
            type="button"
            onClick={handleDraft}
            disabled={pending}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {pending ? "更新中…" : "下書きに戻す"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            disabled={pending}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {pending ? "公開中…" : "公開する"}
          </button>
        )}

        <span className="text-[11px] text-gray-400">
          状態変更後、ブログ一覧と記事ページが自動で更新されます。
        </span>
      </div>
    </section>
  );
}
