// apps/web/app/admin/blogs/[slug]/page.tsx

import { notFound } from "next/navigation";
import { getFirestore } from "firebase-admin/firestore";

import "@/lib/firebase/server-init";
import { AnalysisHistoryPanel } from "@/components/admin/AnalysisHistoryPanel";
import { BlogStatusPanel } from "@/components/admin/BlogStatusPanel";
import type {
  BlogAdminView,
  BlogAnalysisEntry,
  BlogStatus,
} from "@/types/blog";

type PageProps = {
  params: { slug: string };
};

async function fetchBlogForAdmin(slug: string): Promise<BlogAdminView | null> {
  const db = getFirestore();
  const ref = db.collection("blogs").doc(slug);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data() || {};
  const historyRaw = data.analysisHistory as BlogAnalysisEntry[] | undefined;

  const status: BlogStatus =
    data.status === "published" ? "published" : "draft";

  return {
    slug,
    title: String(data.title ?? ""),
    status,
    analysisHistory: Array.isArray(historyRaw) ? historyRaw : [],
  };
}

export default async function AdminBlogPage({ params }: PageProps) {
  const blog = await fetchBlogForAdmin(params.slug);
  if (!blog) notFound();

  const hasHistory = blog.analysisHistory.length > 0;

  return (
    <main className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">{blog.title}</h1>
        <p className="text-xs text-gray-500">
          slug: <span className="font-mono">{blog.slug}</span>
        </p>
      </header>

      {/* 公開 / 非公開 切り替えパネル */}
      <BlogStatusPanel slug={blog.slug} status={blog.status} />

      {/* 分析履歴パネル or 空状態 */}
      {hasHistory ? (
        <AnalysisHistoryPanel blog={blog} />
      ) : (
        <p className="text-sm text-gray-500">
          まだ分析履歴がありません（今夜20時の自動分析後に表示されます）
        </p>
      )}
    </main>
  );
}
