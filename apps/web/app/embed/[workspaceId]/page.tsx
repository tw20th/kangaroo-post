// apps/web/app/embed/[workspaceId]/page.tsx
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

type Params = { workspaceId: string };

function normalizeTopUrl(input: string): string {
  const trimmed = input.trim();

  // すでに http/https が付いているならそのまま
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // スキーム無しなら https を付ける
  return `https://${trimmed}`;
}

function joinUrl(
  topUrl: string,
  blogSectionSlug: string,
  slug: string
): string {
  const base = normalizeTopUrl(topUrl).replace(/\/+$/, "");
  const section = blogSectionSlug.replace(/^\/+|\/+$/g, "");
  const s = slug.replace(/^\/+|\/+$/g, "");
  return `${base}/${section}/${s}`;
}

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
    const data = d.data() as { slug?: string; title?: string };
    return {
      slug: data.slug ?? d.id,
      title: data.title ?? "(no title)",
    };
  });

  const canLink =
    typeof picked.topUrl === "string" &&
    picked.topUrl.length > 0 &&
    typeof picked.blogSectionSlug === "string" &&
    picked.blogSectionSlug.length > 0;

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
            const href = canLink
              ? joinUrl(
                  picked.topUrl as string,
                  picked.blogSectionSlug as string,
                  p.slug
                )
              : null;

            return (
              <li key={p.slug} style={{ marginBottom: 6 }}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, textDecoration: "underline" }}
                  >
                    {p.title}
                  </a>
                ) : (
                  <span style={{ fontSize: 13 }}>{p.title}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!canLink && (
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.7 }}>
          ※リンク先を有効にするには Workspace
          の「トップURL」と「ブログのスラッグ」を設定してください。
        </div>
      )}
    </main>
  );
}
