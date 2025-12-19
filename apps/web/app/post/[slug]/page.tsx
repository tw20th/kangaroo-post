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

export default async function PostPublicPage({ params }: { params: Params }) {
  const slug = decodeURIComponent(params.slug);

  // まずは docId 直参照（今の設計だとこれが一番確実）
  const snap = await adminDb.collection("posts").doc(slug).get();

  if (!snap.exists) notFound();

  const data = snap.data() as PostDoc;

  // 公開だけ表示（MVP中のガード）
  if (data.status !== "published") notFound();

  const title = data.title ?? "(no title)";
  const content = data.content ?? "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>

      <div className="mt-6">
        <BlogBody content={content} />
      </div>
    </main>
  );
}
