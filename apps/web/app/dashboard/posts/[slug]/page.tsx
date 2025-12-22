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
  status?: "draft" | "published" | string;
  wpLink?: string;
  wp?: { link?: string | null };
};

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
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
  const isPublished = status === "published";

  const site = getSiteConfig();
  const origin = normalizeOrigin(
    site.urlOrigin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://www.kangaroo-post.com"
  );

  const embedPostUrl = `${origin}/embed/post/${encodeURIComponent(slug)}`;
  const iframeCode = `<iframe src="${embedPostUrl}" style="width:100%;border:0;" loading="lazy"></iframe>`;

  const wpLink =
    (typeof data.wpLink === "string" && data.wpLink) ||
    (typeof data.wp?.link === "string" && data.wp.link) ||
    null;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      {/* 戻る */}
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

      {/* ヘッダー */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-xs text-gray-500">
          {isPublished
            ? "公開済みの記事です。内容の修正もできます。"
            : "まずは内容を整えて、公開してみましょう。"}
        </p>
      </header>

      {/* 編集フォーム（常に主役） */}
      <BlogEditorForm
        slug={slug}
        initialTitle={title}
        initialContent={content}
        initialStatus={status}
      />

      {/* 公開後だけ：次の一手 */}
      {isPublished && (
        <section className="space-y-3 rounded-2xl border bg-white/70 p-4 shadow-sm">
          <div className="text-sm font-semibold">
            公開しました 🎉 次に、サイトに表示してみましょう
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-700">
              表示用リンク
            </div>
            <textarea
              readOnly
              className="w-full rounded-lg border bg-white px-2 py-2 font-mono text-[11px]"
              rows={2}
              value={embedPostUrl}
            />
            <p className="text-[11px] text-gray-500">
              まずはリンクを貼るだけでもOKです。
            </p>
          </div>

          <details className="rounded-xl border bg-white p-3">
            <summary className="cursor-pointer text-xs font-semibold text-gray-700">
              高度な使い方：iframeで埋め込む
            </summary>
            <div className="mt-2 space-y-2">
              <textarea
                readOnly
                className="w-full rounded-lg border bg-white px-2 py-2 font-mono text-[11px]"
                rows={3}
                value={iframeCode}
              />
            </div>
          </details>

          {wpLink && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-700">
                WordPress 公開URL
              </div>
              <a
                href={wpLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 underline"
              >
                {wpLink}
              </a>
            </div>
          )}
        </section>
      )}

      {/* 下書き時の補足 */}
      {!isPublished && (
        <section className="rounded-2xl border bg-white/60 p-4 text-xs text-gray-600">
          公開すると、ここに「サイトに表示するためのリンク」が表示されます。
        </section>
      )}
    </main>
  );
}
