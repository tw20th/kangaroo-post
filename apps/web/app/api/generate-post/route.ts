// apps/web/app/api/generate-post/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { adminDb } from "@/lib/firebaseAdmin";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";

const MODEL = "gpt-4o-mini";

type GeneratePostBody = {
  title?: string;
  keyword?: string;
  workspaceId?: string;
};

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as GeneratePostBody;

    const title = body.title;
    const keyword = body.keyword;
    const workspaceId = body.workspaceId;

    if (!title && !keyword) {
      return NextResponse.json(
        { ok: false, error: "title か keyword のどちらかは必須です。" },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Workspace が未設定です。先にサイト設定を保存してください。",
        },
        { status: 400 }
      );
    }

    const siteId = getServerSiteId();

    // ✅ Workspace 所有者チェック
    const wsSnap = await adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .get();
    if (!wsSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Workspace が見つかりません。" },
        { status: 404 }
      );
    }
    const ws = wsSnap.data() as { ownerUserId?: string; siteId?: string };
    if (ws.ownerUserId !== user.uid || ws.siteId !== siteId) {
      return NextResponse.json(
        { ok: false, error: "この Workspace に対する権限がありません。" },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY が設定されていません。" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const topic = title ?? keyword ?? "ブログ記事";

    const prompt = `
あなたは「カンガルーポスト」という、サイト更新が苦手な人の味方になる記事生成サービスのライターです。

- 読者は「サイト更新や記事作成がしんどい・苦手」と感じている中小企業や個人事業主
- 文章はやさしく、相手のペースに合わせて寄りそうトーン
- 専門用語はできるだけかみ砕いて説明
- 結論を押しつけず、「こういう選択肢もありますよ」と提案するイメージ

以下のテーマで、日本語のブログ記事を Markdown 形式で書いてください。

- テーマ: 「${topic}」
- 想定読者: サイト更新や記事づくりが苦手な人
- 構成:
  1. 導入（共感・悩みの言語化）
  2. 課題の背景（なぜそう感じるのか）
  3. やさしい解決の考え方（頑張りすぎない工夫）
  4. 具体的なステップ（見出しと箇条書きを交えて）
  5. まとめ（「できることから一つだけやってみましょう」で締める）

- 絵文字は控えめに、ところどころでOK
- 見出しには h2, h3 を使う
- 3000〜4000文字くらいを目安に
`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "あなたはやさしく寄りそう日本語ライターです。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "記事生成に失敗しました。（contentが空です）" },
        { status: 500 }
      );
    }

    const now = Date.now();
    const slug = `post-${now}`;
    const nowDate = new Date();

    const payload = {
      slug,
      siteId,
      workspaceId,
      ownerUserId: user.uid,
      title: title ?? `自動生成記事 ${now}`,
      content,
      status: "draft" as const,
      type: "normal",
      createdAt: nowDate,
      updatedAt: nowDate,
    };

    // ✅ ここが変更：blogs → posts
    await adminDb.collection("posts").doc(slug).set(payload);

    return NextResponse.json({
      ok: true,
      slug,
      title: payload.title,
      editUrl: `/dashboard/posts/${encodeURIComponent(slug)}`,
      embedUrl: `/embed/${encodeURIComponent(workspaceId)}`,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("generate-post error", err);
    return NextResponse.json(
      { ok: false, error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
