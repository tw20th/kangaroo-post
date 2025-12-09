// apps/web/app/dashboard/page.tsx
import { adminDb } from "@/lib/firebaseAdmin";
import GeneratePostForm from "@/components/dashboard/GeneratePostForm";

export const dynamic = "force-dynamic";

type BlogItem = {
  slug: string;
  title: string;
  status: string;
  createdAt: string;
};

// createdAt が Timestamp / Date / string などバラバラでも安全に扱うためのヘルパー
function toIsoDate(value: unknown): string {
  // すでに文字列ならそのまま返す
  if (typeof value === "string") return value;

  // Date インスタンス
  if (value instanceof Date) return value.toISOString();

  // Firestore Timestamp 想定（toDate() を持っているオブジェクト）
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  // それ以外は「今」を入れておく
  return new Date().toISOString();
}

async function getLatestBlogs(limit = 20): Promise<BlogItem[]> {
  const snap = await adminDb
    .collection("blogs")
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

    const createdAt = toIsoDate(data.createdAt);

    return {
      slug: data.slug ?? doc.id,
      title: data.title ?? "(no title)",
      status: data.status ?? "draft",
      createdAt,
    };
  });
}

export default async function DashboardPage() {
  const blogs = await getLatestBlogs();

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          カンガルーポスト ダッシュボード
        </h1>
        <p className="text-sm text-gray-600">
          サイト更新がしんどいときに、ここから記事づくりをおまかせできます。
        </p>
      </header>

      {/* 記事生成フォーム */}
      <section className="space-y-3 rounded-2xl border bg-white/70 p-4 shadow-sm">
        <h2 className="text-base font-semibold">新しい記事を自動生成する</h2>
        <p className="text-xs text-gray-600">
          とりあえず「書きたいテーマ」や「悩み」を一文だけ入れてもOKです。
        </p>
        <GeneratePostForm />
      </section>

      {/* 下書き一覧 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">最近の下書き</h2>
        {blogs.length === 0 ? (
          <p className="text-sm text-gray-500">
            まだ下書きはありません。上のフォームから、最初の1本をつくってみましょう。
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-white/70 text-sm shadow-sm">
            {blogs.map((b) => (
              <li
                key={b.slug}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="font-medium">{b.title}</div>
                  <div className="text-xs text-gray-500">
                    {b.status === "draft" ? "下書き" : "公開済み"} /{" "}
                    {new Date(b.createdAt).toLocaleString("ja-JP")}
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                  {b.slug}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
