//apps/web/app/dashboard/posts/[slug]/page.tsx
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";
import { getSiteConfig } from "@/lib/site-config";
import BlogEditorForm from "@/components/dashboard/BlogEditorForm";

export const dynamic = "force-dynamic";

type PostDoc = {
  ownerUserId: string;
  siteId: string;
  workspaceId?: string;
  slug: string;
  title?: string;
  content?: string;
  status?: string;
  wpLink?: string;
  wp?: { link?: string | null };
};

function buildIframe(src: string, height = 900) {
  return `<iframe src="${src}" style="width:100%;border:0;display:block;height:${height}px;" loading="lazy"></iframe>`;
}

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

  const site = getSiteConfig();
  const origin = (site.urlOrigin || "https://www.kangaroo-post.com").replace(
    /\/+$/,
    ""
  );

  const embedPostUrl = `${origin}/embed/post/${encodeURIComponent(slug)}`;
  const embedPostIframe = buildIframe(embedPostUrl, 1100);

  const wpLink =
    (typeof data.wpLink === "string" ? data.wpLink : "") ||
    (typeof data.wp?.link === "string" ? data.wp.link : "");

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
        <div className="text-sm font-semibold">埋め込み（個別記事）</div>
        <p className="mt-2 text-xs text-gray-600">
          WordPress
          の固定ページなどに貼り付けてください（公開済み記事のみ表示されます）。
        </p>

        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold text-gray-700">URL</div>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 text-xs">
            {embedPostUrl}
          </pre>

          <div className="text-xs font-semibold text-gray-700">
            iframeコード（推奨）
          </div>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 text-xs">
            {embedPostIframe}
          </pre>

          {wpLink ? (
            <>
              <div className="text-xs font-semibold text-gray-700">
                WordPress公開URL（連携済み）
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 text-xs">
                {wpLink}
              </pre>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              ※
              WordPress連携で投稿すると、ここにWPのURLが表示されます（一覧→WP記事が成立）。
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white/70 p-4 shadow-sm">
        <div className="text-sm font-semibold">本文プレビュー（簡易）</div>
        <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-800">
          {content.length > 0 ? content : "（本文が空です）"}
        </pre>
      </section>
    </main>
  );
}
