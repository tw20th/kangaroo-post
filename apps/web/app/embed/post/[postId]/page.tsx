// apps/web/app/embed/post/[postId]/page.tsx
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import BlogBody from "@/components/blog/BlogBody";

export const dynamic = "force-dynamic";

type Params = { postId: string };

type PostDoc = {
  title?: string;
  content?: string;
  status?: string;
};

export default async function EmbedPostPage({ params }: { params: Params }) {
  const postId = decodeURIComponent(params.postId);

  const snap = await adminDb.collection("posts").doc(postId).get();
  if (!snap.exists) notFound();

  const data = snap.data() as PostDoc;

  // ✅ 公開だけ表示（MVP）
  if ((data.status ?? "draft") !== "published") notFound();

  const title = data.title ?? "(no title)";
  const content = data.content ?? "";

  return (
    <main
      style={{
        padding: 16,
        fontFamily: "system-ui",
        background: "transparent",
      }}
    >
      <h1 style={{ fontSize: 18, margin: "0 0 12px", fontWeight: 700 }}>
        {title}
      </h1>

      <div style={{ fontSize: 14, lineHeight: 1.9 }}>
        <BlogBody content={content} />
      </div>
    </main>
  );
}
