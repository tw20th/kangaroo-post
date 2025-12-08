// firebase/functions/src/lib/seo/titlePatternsRunner.ts
import { getFirestore } from "firebase-admin/firestore";

/**
 * タイトル分析のメインロジック（AI処理）
 * blogs の title 一覧を AI に渡して「よく使われる型・傾向」を JSON で返してもらい、
 * sites/{siteId}/seo/titlePatterns に保存する。
 */
export async function analyzeTitlesForSite(siteId: string): Promise<void> {
  const db = getFirestore();

  console.log("[TitlePatterns] analyzing", { siteId });

  // blogs コレクションから記事を読み込む
  const snap = await db.collection("blogs").where("siteId", "==", siteId).get();

  const titles: string[] = [];
  snap.forEach((doc) => {
    const t = doc.get("title");
    if (typeof t === "string" && t.trim().length > 0) {
      titles.push(t.trim());
    }
  });

  if (!titles.length) {
    console.warn("[TitlePatterns] no titles found", { siteId });
    return;
  }

  // --- AI に投げるプロンプトを組み立てる ------------------------

  const titlesList = titles
    .slice(0, 200) // 念のため上限
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  const prompt = `
あなたは日本語のコンテンツ編集者です。
以下はサイト「${siteId}」で実際に使われている記事タイトル一覧です。

${titlesList}

これらをざっくり眺めて、

- よく使われている「タイトルの型（パターン）」の名前
- その型の説明（どんな意図・ニュアンスか）
- その型に属しそうな例タイトル
- 改善の方向性（もっと Discover / ガイド / 比較でおすすめに出やすくするには？）
- 今後追加すると良さそうな新パターン案

などを JSON 形式でまとめてください。

出力は **必ず JSON だけ** にしてください。
構造は柔らかくて構いませんが、少なくとも次のキーを含めてください:

{
  "patterns": [
    {
      "id": "short_label",
      "name": "パターン名",
      "description": "どんな意図・場面で使うタイトルか",
      "examples": ["例タイトル1", "例タイトル2", "..."]
    }
  ],
  "notes": "全体傾向や改善の方向性のメモ",
  "suggested_new_patterns": [
    {
      "name": "新しいパターン案",
      "description": "どんなときに使うか"
    }
  ]
}
`.trim();

  // --- AI に投げて「タイトルの型」を抽出する --------------------

  // ゆるめの JSON スキーマ（ほぼ何でも通す）
  const TITLE_PATTERNS_SCHEMA = {
    type: "object",
    additionalProperties: true,
  } as const;

  const { getOpenAI } = await import("../infra/openai.js");
  const openai = getOpenAI();

  const res = await openai.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
    temperature: 0.4,
    max_output_tokens: 1500,
    text: {
      format: {
        type: "json_schema",
        name: "TitlePatterns",
        schema: TITLE_PATTERNS_SCHEMA,
        strict: false, // ゆるく受け取る
      },
    },
  });

  // output_text を安全に取り出す
  const outputText = (res as { output_text?: string }).output_text ?? "{}";
  const body = String(outputText);

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    parsed = { error: "parse_failed", raw: body };
  }

  // Firestore に保存（毎週上書き）
  const payload: Record<string, unknown> =
    typeof parsed === "object" && parsed !== null
      ? { updatedAt: Date.now(), ...parsed }
      : { updatedAt: Date.now(), parsed };

  await db
    .collection("sites")
    .doc(siteId)
    .collection("seo")
    .doc("titlePatterns")
    .set(payload, { merge: true });

  console.log("[TitlePatterns] saved", { siteId });
}
