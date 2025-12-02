// apps/web/app/admin/site-keywords/SiteKeywordsPageClient.tsx
"use client";

import { useState, useMemo } from "react";

type Intent = "service" | "compare" | "guide";

type SiteKeyword = {
  id: string;
  siteId: string;
  keyword: string;
  intent: Intent;
  status: "active" | "paused";
  poolKey?: string | null;
  painRuleId?: string | null;
  usedCount: number;
  lastUsedAt?: number | null;
  lastBlogSlug?: string | null;
  score: number;
};

export default function SiteKeywordsPage({
  initialItems,
}: {
  initialItems: SiteKeyword[];
}) {
  const [intentFilter, setIntentFilter] = useState<Intent | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">(
    "all"
  );

  const filtered = useMemo(() => {
    return initialItems.filter((k) => {
      if (intentFilter !== "all" && k.intent !== intentFilter) return false;
      if (statusFilter !== "all" && k.status !== statusFilter) return false;
      return true;
    });
  }, [initialItems, intentFilter, statusFilter]);

  return (
    <div className="container-kariraku py-8 space-y-4">
      <h1 className="text-xl font-semibold">キーワード管理（siteKeywords）</h1>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <span>Intent</span>
          <select
            className="border rounded px-2 py-1"
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value as Intent | "all")}
          >
            <option value="all">全部</option>
            <option value="service">service（商品紹介）</option>
            <option value="compare">compare（比較）</option>
            <option value="guide">guide（悩みガイド）</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span>Status</span>
          <select
            className="border rounded px-2 py-1"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "paused")
            }
          >
            <option value="all">全部</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">keyword</th>
              <th className="px-3 py-2 text-left">intent</th>
              <th className="px-3 py-2 text-left">status</th>
              <th className="px-3 py-2 text-left">poolKey</th>
              <th className="px-3 py-2 text-left">used</th>
              <th className="px-3 py-2 text-left">lastBlog</th>
              <th className="px-3 py-2 text-left">score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((k) => (
              <tr key={k.id} className="border-t">
                <td className="px-3 py-2">{k.keyword}</td>
                <td className="px-3 py-2">{k.intent}</td>
                <td className="px-3 py-2">{k.status}</td>
                <td className="px-3 py-2">{k.poolKey ?? "-"}</td>
                <td className="px-3 py-2">{k.usedCount}</td>
                <td className="px-3 py-2">
                  {k.lastBlogSlug ? (
                    <code className="text-xs">{k.lastBlogSlug}</code>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2">{k.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
