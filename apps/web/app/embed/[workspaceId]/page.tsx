//apps/web/app/embed/[workspaceId]/page.tsx
import { adminDb } from "@/lib/firebaseAdmin";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type Params = { workspaceId: string };

type WsDoc = {
  siteName?: string;
  topUrl?: string;
  blogSectionSlug?: string;
  blogSectionLabel?: string;
  widgetEnabled?: boolean;
  widgetLimit?: number;

  config?: {
    siteName?: string;
    topUrl?: string;
    blogSectionSlug?: string;
    blogSectionLabel?: string;
    widgetEnabled?: boolean;
    widgetLimit?: number;
  };
};

type PostRow = {
  slug?: string;
  title?: string;

  // ✅ 2パターンに対応（どっちでも拾う）
  wpLink?: string;
  wp?: { link?: string | null };
};

function pickWsValue(ws: WsDoc) {
  const cfg = ws.config ?? {};
  return {
    siteName: cfg.siteName ?? ws.siteName,
    topUrl: cfg.topUrl ?? ws.topUrl,
    blogSectionSlug: cfg.blogSectionSlug ?? ws.blogSectionSlug,
    blogSectionLabel: cfg.blogSectionLabel ?? ws.blogSectionLabel,
    widgetEnabled: cfg.widgetEnabled ?? ws.widgetEnabled,
    widgetLimit: cfg.widgetLimit ?? ws.widgetLimit,
  };
}

export default async function EmbedPage({ params }: { params: Params }) {
  const workspaceId = decodeURIComponent(params.workspaceId);

  const site = getSiteConfig();
  const appOrigin = (site.urlOrigin || "https://www.kangaroo-post.com").replace(
    /\/+$/,
    ""
  );

  const wsSnap = await adminDb.collection("workspaces").doc(workspaceId).get();
  if (!wsSnap.exists) {
    return (
      <main style={{ padding: 12, fontFamily: "system-ui" }}>
        <div>Workspace が見つかりません。</div>
      </main>
    );
  }

  const ws = wsSnap.data() as WsDoc;
  const picked = pickWsValue(ws);

  const enabled = picked.widgetEnabled ?? true;
  const limit = Math.min(Math.max(picked.widgetLimit ?? 3, 1), 20);

  if (!enabled) {
    return (
      <main style={{ padding: 12, fontFamily: "system-ui" }}>
        <div>このウィジェットは現在オフになっています。</div>
      </main>
    );
  }

  const snap = await adminDb
    .collection("posts")
    .where("workspaceId", "==", workspaceId)
    .where("status", "==", "published")
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  const items = snap.docs.map((d) => {
    const data = d.data() as PostRow;
    const wpLink =
      (typeof data.wpLink === "string" ? data.wpLink : "") ||
      (typeof data.wp?.link === "string" ? data.wp.link : "");

    return {
      id: d.id,
      slug: data.slug ?? d.id,
      title: data.title ?? "(no title)",
      wpLink: wpLink || "",
    };
  });

  return (
    <main style={{ padding: 12, fontFamily: "system-ui" }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        {picked.siteName ? `${picked.siteName} の最新記事` : "最新記事"}
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 13 }}>まだ公開された記事がありません。</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {items.map((p) => {
            // ✅ WP連携済みならWPへ
            // ✅ 未連携ならカンガルーポスト側の「個別記事embed」へ
            const href = p.wpLink
              ? p.wpLink
              : `${appOrigin}/embed/post/${encodeURIComponent(p.id)}`;

            return (
              <li key={p.id} style={{ marginBottom: 6 }}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, textDecoration: "underline" }}
                >
                  {p.title}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
