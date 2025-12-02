// apps/web/app/admin/blogs/page.tsx
import { getFirestore } from "firebase-admin/firestore";
import "@/lib/firebase/server-init";
import { BlogStatusTable } from "@/components/admin/BlogStatusTable";
import type { BlogAdminListRow, BlogStatus } from "@/types/blog";

type RawBlog = {
  title?: string;
  status?: string;
  latestScore?: number;
  createdAt?: number;
  updatedAt?: number;
};

export const dynamic = "force-dynamic";

async function fetchBlogsForAdmin(): Promise<BlogAdminListRow[]> {
  const db = getFirestore();

  const snap = await db
    .collection("blogs")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data() as RawBlog;

    const status: BlogStatus =
      (data.status as BlogStatus | undefined) ?? "draft";

    return {
      slug: doc.id,
      title: String(data.title ?? "(タイトル未設定)"),
      status,
      latestScore:
        typeof data.latestScore === "number" ? data.latestScore : null,
      createdAt: typeof data.createdAt === "number" ? data.createdAt : null,
      updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : null,
    };
  });
}

export default async function AdminBlogsIndexPage() {
  const blogs = await fetchBlogsForAdmin();

  return (
    <main className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">
          ブログ一覧（公開ステータス管理）
        </h1>
        <p className="text-xs text-gray-500">
          最新 100 件の記事について、公開 / 下書きをここから切り替えできます。
        </p>
      </header>

      <BlogStatusTable blogs={blogs} />
    </main>
  );
}
