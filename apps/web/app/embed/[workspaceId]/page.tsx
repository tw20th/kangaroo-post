// apps/web/app/embed/[workspaceId]/page.tsx
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

  wpLink?: string;
  wp?: { link?: string | null };

  updatedAt?: unknown;
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

function asDateLabel(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    const carrier = v as { toDate: () => Date };
    const d = carrier.toDate();
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }
  if (v instanceof Date) {
    return `${v.getFullYear()}/${v.getMonth() + 1}/${v.getDate()}`;
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }
  }
  return null;
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

    const title =
      typeof data.title === "string" && data.title.trim().length > 0
        ? data.title.trim()
        : "(no title)";

    const updatedLabel = asDateLabel(data.updatedAt);

    // ✅ docId = slug 前提（今は一致してるので d.id でOK）
    const href = wpLink
      ? wpLink
      : `${appOrigin}/embed/post/${encodeURIComponent(d.id)}`;

    return {
      id: d.id,
      title,
      href,
      isWp: Boolean(wpLink),
      updatedLabel,
    };
  });

  const styles = {
    wrap: {
      padding: 12,
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    } as const,

    header: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 6,
      marginBottom: 12,
    } as const,

    headTitle: {
      fontSize: 13,
      fontWeight: 700,
      color: "#111827",
      letterSpacing: "0.01em",
    } as const,

    headLead: {
      fontSize: 11,
      opacity: 0.75,
      lineHeight: 1.6,
    } as const,

    list: {
      display: "grid",
      gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
      gap: 10,
      margin: 0,
      padding: 0,
      listStyle: "none",
    } as const,

    // ✅ 760px embed幅でも 2カラムになりすぎないように控えめに
    listWideMedia: `
      @media (min-width: 720px) {
        .kp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `,

    card: {
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 16,
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.88))",
      boxShadow: "0 8px 22px rgba(0,0,0,0.06)",
      padding: 14,
      transition: "transform 120ms ease, box-shadow 120ms ease",
    } as const,

    cardHover: `
      .kp-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 26px rgba(0,0,0,0.08);
      }
    `,

    rowTop: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 10,
    } as const,

    badge: (isWp: boolean) =>
      ({
        fontSize: 11,
        padding: "4px 9px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.08)",
        background: isWp ? "rgba(16,185,129,0.10)" : "rgba(59,130,246,0.08)",
        color: isWp ? "#065f46" : "#1e3a8a",
        whiteSpace: "nowrap",
        fontWeight: 700,
      } as const),

    meta: { fontSize: 11, opacity: 0.7 } as const,

    aTitle: {
      display: "block",
      fontSize: 14,
      fontWeight: 800,
      textDecoration: "none",
      color: "#111827",
      lineHeight: 1.5,
      marginBottom: 10,
    } as const,

    actions: {
      display: "flex",
      justifyContent: "flex-end",
    } as const,

    button: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      fontWeight: 800,
      padding: "8px 10px",
      borderRadius: 12,
      border: "1px solid rgba(16,185,129,0.35)",
      background: "rgba(16,185,129,0.10)",
      color: "#065f46",
      textDecoration: "none",
    } as const,

    empty: {
      fontSize: 13,
      padding: "10px 0",
      opacity: 0.8,
    } as const,
  };

  return (
    <main style={styles.wrap}>
      {/* embed内だけにstyleタグ */}
      <style>{styles.listWideMedia}</style>
      <style>{styles.cardHover}</style>

      <div style={styles.header}>
        <div style={styles.headTitle}>
          {picked.siteName ? `${picked.siteName} の最新記事` : "最新記事"}
        </div>
        <div style={styles.headLead}>
          ※「WP連携」なら WordPress記事へ / 未連携なら
          カンガルーポストの個別表示へ移動します。
        </div>
      </div>

      {items.length === 0 ? (
        <div style={styles.empty}>まだ公開された記事がありません。</div>
      ) : (
        <ul className="kp-grid" style={styles.list}>
          {items.map((p) => (
            <li key={p.id} className="kp-card" style={styles.card}>
              <div style={styles.rowTop}>
                <span style={styles.badge(p.isWp)}>
                  {p.isWp ? "WP連携" : "埋め込み"}
                </span>
                {p.updatedLabel ? (
                  <span style={styles.meta}>更新: {p.updatedLabel}</span>
                ) : null}
              </div>

              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.aTitle}
              >
                {p.title}
              </a>

              <div style={styles.actions}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.button}
                >
                  続きを読む →
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
