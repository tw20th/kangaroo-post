// apps/web/components/admin/BlogStatusTable.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { BlogAdminListRow, BlogStatus } from "@/types/blog";

type Props = {
  blogs: BlogAdminListRow[];
};

export function BlogStatusTable({ blogs }: Props) {
  const [items, setItems] = useState<BlogAdminListRow[]>(blogs);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const formatDate = (ts: number | null): string => {
    if (!ts) return "-";
    try {
      return new Date(ts).toLocaleString("ja-JP", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  const labelForStatus = (status: BlogStatus): string => {
    if (status === "published") return "公開中";
    if (status === "draft") return "下書き";
    return "アーカイブ";
  };

  const nextStatus = (status: BlogStatus): BlogStatus => {
    if (status === "published") return "draft";
    return "published";
  };

  const handleToggle = async (slug: string): Promise<void> => {
    const current = items.find((b) => b.slug === slug);
    if (!current) return;

    const updatedStatus = nextStatus(current.status);

    // 楽観的更新
    setItems((prev) =>
      prev.map((b) => (b.slug === slug ? { ...b, status: updatedStatus } : b))
    );
    setLoadingSlug(slug);

    try {
      const res = await fetch("/api/admin/blog-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, status: updatedStatus }),
      });

      if (!res.ok) {
        // 失敗時は元に戻す
        setItems((prev) =>
          prev.map((b) =>
            b.slug === slug ? { ...b, status: current.status } : b
          )
        );
        console.error("Failed to update status", await res.text());
        alert(
          "ステータスの更新に失敗しました。時間をおいて再試行してください。"
        );
      }
    } catch (error) {
      setItems((prev) =>
        prev.map((b) =>
          b.slug === slug ? { ...b, status: current.status } : b
        )
      );
      console.error(error);
      alert("ネットワークエラーが発生しました。");
    } finally {
      setLoadingSlug(null);
    }
  };

  if (!items.length) {
    return (
      <p className="text-sm text-gray-500">まだブログ記事がありません。</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="px-4 py-2">タイトル</th>
            <th className="px-4 py-2">ステータス</th>
            <th className="px-4 py-2">最新スコア</th>
            <th className="px-4 py-2">最終更新</th>
            <th className="px-4 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.slug} className="border-b last:border-none">
              <td className="px-4 py-2 align-top">
                <Link
                  href={`/admin/blogs/${b.slug}`}
                  className="font-medium hover:underline"
                >
                  {b.title}
                </Link>
                <div className="text-[11px] text-gray-400">slug: {b.slug}</div>
              </td>

              <td className="px-4 py-2 align-top">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${
                    b.status === "published"
                      ? "border border-green-200 bg-green-50 text-green-700"
                      : b.status === "draft"
                      ? "border border-gray-200 bg-gray-50 text-gray-600"
                      : "border border-gray-200 bg-gray-100 text-gray-500"
                  }`}
                >
                  {labelForStatus(b.status)}
                </span>
              </td>

              <td className="px-4 py-2 align-top text-xs text-gray-600">
                {typeof b.latestScore === "number" ? b.latestScore : "-"}
              </td>

              <td className="px-4 py-2 align-top text-xs text-gray-500">
                {formatDate(b.updatedAt ?? b.createdAt)}
              </td>

              <td className="px-4 py-2 align-top text-right">
                <button
                  type="button"
                  onClick={() => void handleToggle(b.slug)}
                  disabled={loadingSlug === b.slug}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    b.status === "published"
                      ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                      : "border border-green-300 text-green-700 hover:bg-green-50"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {loadingSlug === b.slug
                    ? "更新中..."
                    : b.status === "published"
                    ? "下書きに戻す"
                    : "公開にする"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
