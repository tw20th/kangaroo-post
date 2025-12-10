// apps/web/app/api/track/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb, FieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs"; // 画像の外部ドメイン設定と合わせる

type Body = {
  type: "offer" | "blog";
  siteId: string;
  offerId?: string | null;
  blogSlug?: string | null;
  href?: string | null; // クリック遷移先（外部リンクなど）
  where?: string | null; // 例: "offer-detail.hero" など
  ts?: number; // クライアント側で渡す場合、なければ serverTimestamp
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const {
      type,
      siteId,
      offerId = null,
      blogSlug = null,
      href = null,
      where = null,
      ts,
    } = body;

    // 必須欠けはノイズにしない（200でスキップ）
    if (!type || !siteId) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    // ★ adminDb は「関数」ではなく Firestore インスタンス
    const db = adminDb;

    const payload = {
      type,
      siteId,
      offerId: offerId ?? null,
      blogSlug: blogSlug ?? null,
      href: href ?? null,
      where: where ?? null,
      ts: ts ?? Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      ua: req.headers.get("user-agent") ?? null,
      ip: (req as any).ip ?? null, // ここは既存のまま
      ref: req.headers.get("referer") ?? null,
    };

    const write = db
      .collection("tracks")
      .doc(siteId)
      .collection("clicks")
      .doc();

    const key = `${type}_${offerId ?? blogSlug ?? "unknown"}`;
    const aggRef = db.collection("stats").doc(`clicks_${key}`);

    // ★ tx に Transaction 型を付けて noImplicitAny を回避
    await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      tx.set(write, payload);
      tx.set(
        aggRef,
        {
          count: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
