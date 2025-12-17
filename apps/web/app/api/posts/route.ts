// apps/web/app/api/posts/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";

export const dynamic = "force-dynamic";

type PostDoc = {
  ownerUserId: string;
  siteId: string;
  workspaceId?: string;

  slug: string;
  title?: string;
  content?: string;

  status?: "draft" | "published" | string;
  type?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
};

type PostUpdateBody = {
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

/**
 * GET /api/posts?slug=xxx
 */
export async function GET(req: Request) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const siteId = getServerSiteId();
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "missing_slug" },
      { status: 400 }
    );
  }

  const snap = await adminDb.collection("posts").doc(slug).get();
  if (!snap.exists) return NextResponse.json({ ok: true, post: null });

  const data = snap.data() as PostDoc;

  if (data.ownerUserId !== user.uid || data.siteId !== siteId) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, post: { id: snap.id, ...data } });
}

/**
 * PATCH /api/posts?slug=xxx
 */
export async function PATCH(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const siteId = getServerSiteId();
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "missing_slug" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as PostUpdateBody | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "bad_request" },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("posts").doc(slug);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404 }
      );
    }

    const current = snap.data() as PostDoc;
    if (current.ownerUserId !== user.uid || current.siteId !== siteId) {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 }
      );
    }

    const now = new Date();

    const currentStatus = current.status ?? "draft";
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

    await ref.set(update, { merge: true });

    const latest = await ref.get();
    const latestData = latest.data() as PostDoc;

    return NextResponse.json({
      ok: true,
      post: { id: latest.id, ...latestData },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[api/posts][PATCH] error:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
