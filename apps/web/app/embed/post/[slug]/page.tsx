// apps/web/app/embed/post/[slug]/page.tsx
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import BlogBody from "@/components/blog/BlogBody";

export const dynamic = "force-dynamic";

type Params = { slug: string };

type PostDoc = {
  title?: string;
  content?: string;
  status?: string;
};

export default async function EmbedPostPage({ params }: { params: Params }) {
  const slug = decodeURIComponent(params.slug);

  // ✅ docId = slug 前提（今は一致してる）
  const snap = await adminDb.collection("posts").doc(slug).get();
  if (!snap.exists) notFound();

  const data = snap.data() as PostDoc;
  if ((data.status ?? "draft") !== "published") notFound();

  const title = data.title ?? "(no title)";
  const content = data.content ?? "";

  const styles = {
    wrap: {
      padding: "10px 6px",
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "transparent",
    } as const,

    head: {
      margin: "6px 0 12px",
      padding: "0 4px",
    } as const,

    h1: {
      fontSize: 18,
      margin: 0,
      fontWeight: 900,
      letterSpacing: "0.01em",
      color: "#111827",
    } as const,

    card: {
      borderRadius: 18,
      border: "1px solid rgba(0,0,0,0.08)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.88))",
      boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
      padding: "14px 14px",
    } as const,

    body: { fontSize: 14, lineHeight: 1.9 } as const,
  };

  return (
    <main style={styles.wrap}>
      <header style={styles.head}>
        <h1 style={styles.h1}>{title}</h1>
      </header>

      <section style={styles.card}>
        <div style={styles.body}>
          <BlogBody content={content} />
        </div>
      </section>
    </main>
  );
}
