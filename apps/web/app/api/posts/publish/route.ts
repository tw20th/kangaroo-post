// apps/web/app/api/posts/publish/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";

type Body = { slug?: string };

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const siteId = getServerSiteId();
    const body = (await req.json().catch(() => ({}))) as Body;
    const slug = body.slug;

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "slug が必要です。" },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("posts").doc(slug);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { ok: false, error: "記事が見つかりません。" },
        { status: 404 }
      );
    }

    const data = snap.data() as {
      ownerUserId?: string;
      siteId?: string;
      workspaceId?: string;
    };

    if (data.ownerUserId !== user.uid || data.siteId !== siteId) {
      return NextResponse.json(
        { ok: false, error: "権限がありません。" },
        { status: 403 }
      );
    }

    if (!data.workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Workspace が紐づいていません。生成し直すか、workspaceId を付与してください。",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    await ref.set(
      {
        status: "published",
        publishedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      status: "published",
      workspaceId: data.workspaceId,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("publish post error", err);
    return NextResponse.json(
      { ok: false, error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
