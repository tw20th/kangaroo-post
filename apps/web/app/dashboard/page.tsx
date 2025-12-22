// apps/web/app/dashboard/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import GeneratePostForm from "@/components/dashboard/GeneratePostForm";
import WorkspaceSettingsForm from "@/components/dashboard/WorkspaceSettingsForm";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";
import { getSiteConfig } from "@/lib/site-config";

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
    .collection("posts")
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

  const site = getSiteConfig();
  const originRaw =
    (site.urlOrigin && site.urlOrigin.length > 0
      ? site.urlOrigin
      : process.env.NEXT_PUBLIC_APP_URL) ?? "";

  const origin = originRaw ? normalizeOrigin(originRaw) : "";
  const embedUrl = origin ? `${origin}${embedPath}` : embedPath;

  const iframeCode = `<iframe src="${embedUrl}" style="width:100%;border:0;" loading="lazy"></iframe>`;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-xs font-semibold text-gray-700">表示用リンク</div>
        <textarea
          readOnly
          className="w-full rounded-lg border bg-white px-2 py-2 font-mono text-[11px]"
          rows={2}
          value={embedUrl}
        />
        <p className="text-[11px] text-gray-500">
          まずは「リンク」を貼るだけでもOKです（iframeは必要になったら使えます）
        </p>
      </div>

      <details className="rounded-xl border bg-white p-3">
        <summary className="cursor-pointer text-xs font-semibold text-gray-700">
          高度な使い方：iframeで埋め込む（推奨）
        </summary>
        <div className="mt-2 space-y-2">
          <div className="text-[11px] text-gray-500">
            ※ 固定ページやHTMLブロックに貼り付けてください
          </div>
          <textarea
            readOnly
            className="w-full rounded-lg border bg-white px-2 py-2 font-mono text-[11px]"
            rows={3}
            value={iframeCode}
          />
          {!origin && (
            <p className="text-[11px] text-amber-700">
              ※
              URLのベースが未設定なので、相対パスです。本番ではフルURL推奨です。
            </p>
          )}
        </div>
      </details>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { seed?: string };
}) {
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

  // ✅ seed を取り出す（stringだけ採用）
  const seed = typeof searchParams?.seed === "string" ? searchParams.seed : "";

  const hasPosts = posts.length > 0;

  // 状態①：未登録（workspaceId が null）
  if (!initialWorkspaceId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <header className="space-y-2">
            <h1 className="text-xl font-semibold">ダッシュボード</h1>
            <p className="text-sm text-gray-600">
              まずは、あなたのサイトを登録しましょう。
            </p>
          </header>

          <WorkspaceSettingsForm
            initialWorkspaceId={null}
            variant="onboarding"
          />

          <p className="text-[11px] text-gray-500">
            ※ 登録が終わると、次に「テスト記事」を作れます。
          </p>
        </div>
      </main>
    );
  }

  // ✅ ここから先は workspaceId が必ず string
  const workspaceId = initialWorkspaceId;

  // 状態②：登録済み・記事なし
  if (!hasPosts) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-xl font-semibold">ダッシュボード</h1>
            <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
              <div className="text-sm font-semibold">
                サイト登録は完了しました 🎉
              </div>
              <p className="mt-1 text-xs text-gray-600">
                次に、テスト用の記事を1本作ってみましょう。
              </p>
            </div>
          </header>

          <section className="space-y-3 rounded-2xl border bg-white/70 p-4 shadow-sm">
            <h2 className="text-base font-semibold">テスト記事をつくる</h2>

            {/* ✅ seed を渡す（ここが体験の肝） */}
            <GeneratePostForm
              workspaceId={workspaceId}
              mode="test"
              seed={seed}
            />
          </section>

          <details className="rounded-2xl border bg-white/70 p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-gray-800">
              詳細設定（あとでOK）
            </summary>
            <div className="mt-4">
              <WorkspaceSettingsForm
                initialWorkspaceId={workspaceId}
                variant="settings"
              />
            </div>
          </details>
        </div>
      </main>
    );
  }

  // 状態③：記事あり（通常）
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">ダッシュボード</h1>

        <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
          <div className="text-sm font-semibold">記事ができています ☀️</div>
          <p className="mt-1 text-xs text-gray-600">
            サイトに表示してみましょう（最初はリンクでもOKです）。
          </p>
        </div>
      </header>

      <section className="space-y-2 rounded-2xl border bg-white/70 p-4 shadow-sm">
        <h2 className="text-base font-semibold">サイトに表示する</h2>
        <EmbedCodeBox workspaceId={workspaceId} />
      </section>

      <section className="space-y-3 rounded-2xl border bg-white/70 p-4 shadow-sm">
        <h2 className="text-base font-semibold">新しい記事を自動生成する</h2>
        <p className="text-xs text-gray-600">
          とりあえず「書きたいテーマ」や「悩み」を一文だけ入れてもOKです。
        </p>

        {/* ✅ seed を渡す（トップから来た時にそのまま書ける） */}
        <GeneratePostForm workspaceId={workspaceId} mode="normal" seed={seed} />
      </section>

      {/* 最近の下書き */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">最近の下書き</h2>

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
      </section>

      {/* 詳細設定 */}
      <details className="rounded-2xl border bg-white/70 p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          詳細設定（あとでOK）
        </summary>
        <div className="mt-4">
          <WorkspaceSettingsForm
            initialWorkspaceId={workspaceId}
            variant="settings"
          />
        </div>
      </details>
    </main>
  );
}
