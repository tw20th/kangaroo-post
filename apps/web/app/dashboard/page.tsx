// apps/web/app/dashboard/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import GeneratePostForm from "@/components/dashboard/GeneratePostForm";
import WorkspaceSettingsForm from "@/components/dashboard/WorkspaceSettingsForm";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";

export const dynamic = "force-dynamic";

type PostItem = {
  slug: string;
  title: string;
  status: "draft" | "published" | string;
  createdAt: string; // ISO string
};

type FirestoreTimestampLike = {
  toDate: () => Date;
};

function toIsoDate(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as FirestoreTimestampLike).toDate === "function"
  ) {
    return (value as FirestoreTimestampLike).toDate().toISOString();
  }

  return new Date().toISOString();
}

async function getLatestPosts(params: {
  ownerUserId: string;
  siteId: string;
  limit?: number;
}): Promise<PostItem[]> {
  const limit = params.limit ?? 20;

  const snap = await adminDb
    .collection("posts") // ✅ blogs → posts
    .where("ownerUserId", "==", params.ownerUserId)
    .where("siteId", "==", params.siteId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data() as {
      slug?: string;
      title?: string;
      status?: string;
      createdAt?: unknown;
    };

    return {
      slug: data.slug ?? doc.id,
      title: data.title ?? "(no title)",
      status: data.status ?? "draft",
      createdAt: toIsoDate(data.createdAt),
    };
  });
}

async function getMyWorkspaceId(params: {
  ownerUserId: string;
  siteId: string;
}): Promise<string | null> {
  const snap = await adminDb
    .collection("workspaces")
    .where("ownerUserId", "==", params.ownerUserId)
    .where("siteId", "==", params.siteId)
    .limit(1)
    .get();

  const doc = snap.docs[0];
  return doc ? doc.id : null;
}

function buildEmbedPath(workspaceId: string): string {
  return `/embed/${encodeURIComponent(workspaceId)}`;
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function EmbedCodeBox({ workspaceId }: { workspaceId: string }) {
  const embedPath = buildEmbedPath(workspaceId);

  const origin =
    process.env.NEXT_PUBLIC_APP_URL &&
    process.env.NEXT_PUBLIC_APP_URL.length > 0
      ? normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
      : "";

  const embedUrl = origin ? `${origin}${embedPath}` : embedPath;

  const code = `<iframe src="${embedUrl}" style="width:100%;border:0;" loading="lazy"></iframe>`;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600">
        相手サイトに <span className="font-semibold">このコード</span>{" "}
        を貼ると、 「公開済みの記事」が表示されます。
      </p>

      <div className="text-xs text-gray-500">Workspace ID: {workspaceId}</div>

      <textarea
        readOnly
        className="w-full rounded-lg border bg-white px-2 py-2 font-mono text-[11px]"
        rows={3}
        value={code}
      />

      {!origin && (
        <p className="text-[11px] text-amber-700">
          ※ NEXT_PUBLIC_APP_URL
          が未設定なので、いまは相対パスです。本番ではフルURL推奨です。
        </p>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login");

  const siteId = getServerSiteId();

  const initialWorkspaceId = await getMyWorkspaceId({
    ownerUserId: user.uid,
    siteId,
  });

  const posts = await getLatestPosts({
    ownerUserId: user.uid,
    siteId,
    limit: 20,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      {/* ...上はそのまま... */}

      <WorkspaceSettingsForm initialWorkspaceId={initialWorkspaceId} />

      <section className="space-y-2 rounded-2xl border bg-white/70 p-4 shadow-sm">
        <h2 className="text-base font-semibold">
          相手サイトに貼る埋め込みコード
        </h2>

        {!initialWorkspaceId ? (
          <p className="text-xs text-gray-600">
            先に「サイト設定（Workspace）」を保存すると、ここに埋め込みコードが表示されます。
          </p>
        ) : (
          <EmbedCodeBox workspaceId={initialWorkspaceId} />
        )}
      </section>

      <section className="space-y-3 rounded-2xl border bg-white/70 p-4 shadow-sm">
        <h2 className="text-base font-semibold">新しい記事を自動生成する</h2>
        <p className="text-xs text-gray-600">
          とりあえず「書きたいテーマ」や「悩み」を一文だけ入れてもOKです。
        </p>
        <GeneratePostForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">最近の下書き</h2>

        {posts.length === 0 ? (
          <p className="text-sm text-gray-500">
            まだ下書きはありません。上のフォームから、最初の1本をつくってみましょう。
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-white/70 text-sm shadow-sm">
            {posts.map((p) => {
              const isDraft = p.status === "draft";

              return (
                <li
                  key={p.slug}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="truncate font-medium">{p.title}</div>
                    <div className="text-xs text-gray-500">
                      <span
                        className={`mr-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${
                          isDraft
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {isDraft ? "下書き" : "公開済み"}
                      </span>
                      {new Date(p.createdAt).toLocaleString("ja-JP")}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/dashboard/posts/${encodeURIComponent(p.slug)}`}
                      className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-gray-50"
                    >
                      編集
                    </Link>

                    <span className="hidden rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 md:inline">
                      {p.slug}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
