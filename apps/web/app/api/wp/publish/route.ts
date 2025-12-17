// apps/web/app/api/posts/publish/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";
import { decryptWorkspaceSecret } from "@/lib/crypto/workspaceSecret";

type Body = { slug?: string };

// Firestoreのpostsドキュメント形（必要な分だけ）
type PostDoc = {
  ownerUserId?: string;
  siteId?: string;
  workspaceId?: string;

  slug: string;
  title?: string;
  content?: string;
  status?: "draft" | "published" | string;
};

// Workspace側のWP設定（必要な分だけ）
// ※「configをworkspaceに入れる」方針なので、config.wp* を想定
type WorkspaceDoc = {
  ownerUserId?: string;
  siteId?: string;
  config?: {
    wpUrl?: string;
    wpUser?: string;
    // 🔒 ここは “暗号化済み” を想定（フィールド名はプロジェクトに合わせてOK）
    wpAppPasswordEnc?: string;
  };
};

type WpCreatePostResult = {
  ok: true;
  wpPostId: number;
  wpLink?: string;
};

function normalizeWpBaseUrl(wpUrl: string): string {
  // https://example.com/wp-json/wp/v2/posts にしたいので末尾スラッシュを消す
  return wpUrl.replace(/\/+$/, "");
}

async function postToWordPress(params: {
  wpUrl: string;
  wpUser: string;
  wpAppPassword: string;
  title: string;
  content: string;
}): Promise<WpCreatePostResult> {
  const base = normalizeWpBaseUrl(params.wpUrl);
  const endpoint = `${base}/wp-json/wp/v2/posts`;

  // Application Password は Basic認証（username:appPassword）
  const token = Buffer.from(
    `${params.wpUser}:${params.wpAppPassword}`
  ).toString("base64");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: params.title,
      content: params.content,
      status: "publish", // ← まずはMVPなので publish。下書き運用なら "draft"
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    // WPはエラーJSONを返すことが多いので、そのまま返すと原因特定できる
    throw new Error(
      `WordPress投稿に失敗しました (${res.status}): ${text.slice(0, 500)}`
    );
  }

  const json = JSON.parse(text) as { id?: number; link?: string };
  if (typeof json.id !== "number") {
    throw new Error("WordPress投稿に失敗しました（idが取得できません）");
  }

  return { ok: true, wpPostId: json.id, wpLink: json.link };
}

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

    // 1) Post取得 & 権限チェック
    const postRef = adminDb.collection("posts").doc(slug);
    const postSnap = await postRef.get();
    if (!postSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "記事が見つかりません。" },
        { status: 404 }
      );
    }

    const post = postSnap.data() as PostDoc;

    if (post.ownerUserId !== user.uid || post.siteId !== siteId) {
      return NextResponse.json(
        { ok: false, error: "権限がありません。" },
        { status: 403 }
      );
    }

    if (!post.workspaceId) {
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

    // 2) まずは Firestore 上で published にする（埋め込み表示のため）
    await postRef.set(
      {
        status: "published",
        publishedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    // 3) Workspace からWP設定を読む（あればWPへ自動投稿）
    const wsSnap = await adminDb
      .collection("workspaces")
      .doc(post.workspaceId)
      .get();

    if (!wsSnap.exists) {
      // workspaceが消えてても、posts publish 自体は成功で返す（MVP優先）
      return NextResponse.json({
        ok: true,
        status: "published",
        workspaceId: post.workspaceId,
        wp: { ok: false, skipped: true, reason: "workspace_not_found" },
      });
    }

    const ws = wsSnap.data() as WorkspaceDoc;

    // 所有者/サイトも念のためチェック（偽装防止）
    if (ws.ownerUserId !== user.uid || ws.siteId !== siteId) {
      return NextResponse.json({
        ok: true,
        status: "published",
        workspaceId: post.workspaceId,
        wp: { ok: false, skipped: true, reason: "workspace_forbidden" },
      });
    }

    const wpUrl = ws.config?.wpUrl;
    const wpUser = ws.config?.wpUser;
    const wpAppPasswordEnc = ws.config?.wpAppPasswordEnc;

    // WP未設定ならスキップ（これがMVP的に一番ラク）
    if (!wpUrl || !wpUser || !wpAppPasswordEnc) {
      return NextResponse.json({
        ok: true,
        status: "published",
        workspaceId: post.workspaceId,
        wp: { ok: false, skipped: true, reason: "wp_not_configured" },
      });
    }

    // 4) 復号してWP投稿
    const wpAppPassword = decryptWorkspaceSecret(wpAppPasswordEnc);

    const title = post.title ?? post.slug;
    const content = post.content ?? "";

    const wpResult = await postToWordPress({
      wpUrl,
      wpUser,
      wpAppPassword,
      title,
      content,
    });

    // 5) 投稿結果をpostsにメモ（任意だけど便利）
    await postRef.set(
      {
        wp: {
          postId: wpResult.wpPostId,
          link: wpResult.wpLink ?? null,
          postedAt: now,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      status: "published",
      workspaceId: post.workspaceId,
      wp: {
        ok: true,
        postId: wpResult.wpPostId,
        link: wpResult.wpLink ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("publish post error", err);
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
