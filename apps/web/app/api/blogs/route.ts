//apps/web/app/api/blogs/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";

export const dynamic = "force-dynamic";

type BlogDoc = {
  ownerUserId: string;
  siteId: string;

  slug: string;
  title?: string;
  content?: string;

  status?: "draft" | "published" | string;
  type?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
};

type BlogUpdateBody = {
  title?: string;
  content?: string;
  status?: "draft" | "published";
};

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as Array<keyof T>).forEach((k) => {
    const v = obj[k];
    if (v !== undefined) out[k] = v;
  });
  return out;
}

async function getMyBlogBySlug(params: {
  uid: string;
  siteId: string;
  slug: string;
}): Promise<{ id: string; data: BlogDoc } | null> {
  const snap = await adminDb
    .collection("blogs")
    .where("ownerUserId", "==", params.uid)
    .where("siteId", "==", params.siteId)
    .where("slug", "==", params.slug)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() as BlogDoc };
}

/**
 * GET /api/blogs?slug=xxx
 * 自分のブログだけ返す（なければ null）
 */
export async function GET(req: Request) {
  const user = await getOptionalUser();
  if (!user)
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );

  const siteId = getServerSiteId();
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug)
    return NextResponse.json(
      { ok: false, error: "missing_slug" },
      { status: 400 }
    );

  const found = await getMyBlogBySlug({ uid: user.uid, siteId, slug });
  if (!found) return NextResponse.json({ ok: true, blog: null });

  return NextResponse.json({
    ok: true,
    blog: { id: found.id, ...found.data },
  });
}

/**
 * PATCH /api/blogs?slug=xxx
 * title/content/status を更新（自分のブログのみ）
 */
export async function PATCH(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user)
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );

    const siteId = getServerSiteId();
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug)
      return NextResponse.json(
        { ok: false, error: "missing_slug" },
        { status: 400 }
      );

    const body = (await req.json().catch(() => null)) as BlogUpdateBody | null;
    if (!body)
      return NextResponse.json(
        { ok: false, error: "bad_request" },
        { status: 400 }
      );

    // 自分のブログを取得（所有者チェック込み）
    const found = await getMyBlogBySlug({ uid: user.uid, siteId, slug });
    if (!found)
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404 }
      );

    const now = Date.now();

    // ✅ 公開に切り替わった瞬間だけ publishedAt を入れる
    const currentStatus = found.data.status ?? "draft";
    const nextStatus = body.status;
    const becamePublished =
      nextStatus === "published" && currentStatus !== "published";

    const update = stripUndefined({
      title: body.title,
      content: body.content,
      status: body.status,
      updatedAt: now,
      publishedAt: becamePublished ? now : undefined,
    });

    await adminDb
      .collection("blogs")
      .doc(found.id)
      .set(update, { merge: true });

    const latest = await adminDb.collection("blogs").doc(found.id).get();
    const latestData = latest.data() as BlogDoc;

    return NextResponse.json({
      ok: true,
      blog: { id: latest.id, ...latestData },
    });
  } catch (e) {
    console.error("[api/blogs][PATCH] error:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
