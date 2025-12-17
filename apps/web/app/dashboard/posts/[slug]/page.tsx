// apps/web/app/dashboard/posts/[slug]/page.tsx
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";
import BlogEditorForm from "@/components/dashboard/BlogEditorForm";

export const dynamic = "force-dynamic";

type PostDoc = {
  ownerUserId: string;
  siteId: string;
  slug: string;
  title?: string;
  content?: string;
  status?: string;
};

export default async function DashboardPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getOptionalUser();
  if (!user) redirect("/login");

  const siteId = getServerSiteId();
  const slug = params.slug;

  const snap = await adminDb.collection("posts").doc(slug).get();
  if (!snap.exists) notFound();

  const data = snap.data() as PostDoc;
  if (data.ownerUserId !== user.uid || data.siteId !== siteId) notFound();

  const title = data.title ?? "(no title)";
  const content = data.content ?? "";
  const status = data.status ?? "draft";

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-sm text-gray-600 hover:underline"
        >
          ← ダッシュボードへ戻る
        </Link>

        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
          {slug}
        </span>
      </div>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-xs text-gray-500">
          タイトル・本文を編集して保存できます。
        </p>
      </header>

      <BlogEditorForm
        slug={slug}
        initialTitle={title}
        initialContent={content}
        initialStatus={status}
      />

      <section className="rounded-2xl border bg-white/70 p-4 shadow-sm">
        <div className="text-sm font-semibold">本文プレビュー（簡易）</div>
        <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-800">
          {content.length > 0 ? content : "（本文が空です）"}
        </pre>
      </section>
    </main>
  );
}
