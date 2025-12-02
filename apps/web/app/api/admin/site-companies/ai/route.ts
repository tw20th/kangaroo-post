// apps/web/app/api/admin/site-companies/ai/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// フロントから送ってくるデータ
type AiProfileRequest = {
  siteName: string;
  companyName: string;
  vertical: string;
  targetUsers?: string;
  strengths?: string;
  weaknesses?: string;
  shippingSpeed?: string;
  areas?: string;
  cancellationPolicy?: string;
  importantNotes?: string;
};

// フロントに返すデータ（文字列版）
type AiProfileSuggestion = {
  vertical?: string;
  targetUsers?: string;
  strengths?: string;
  weaknesses?: string;
  shippingSpeed?: string;
  areas?: string;
  cancellationPolicy?: string;
  importantNotes?: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("[SiteCompanies AI] OPENAI_API_KEY is missing");
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as AiProfileRequest;

    const systemPrompt = `
あなたは中小企業向けの家電レンタル比較サイトの編集担当です。
ユーザーにとってわかりやすく、誇大広告にならない「企業プロフィール」の下書きを作成します。
出力は必ず JSON オブジェクト 1つだけにしてください。前後に日本語の説明は書かないでください。
`;

    const userPrompt = `
サイト名: ${body.siteName}
企業名: ${body.companyName}
ジャンル(vertical): ${body.vertical}

このサイト上で、どんなユーザーにどんな魅力を伝えると良いかを考えてください。

出力フォーマット（すべて文字列。複数あるものは「・」や改行で区切ってOK）:

{
  "vertical": "rental など（必要があれば微調整してOK）",
  "targetUsers": "単身赴任の人\\n在宅ワーク民\\n一人暮らし直後の人 など",
  "strengths": "最短2〜3日で届く\\n中古でもメンテが丁寧 など",
  "weaknesses": "最低利用期間がやや長め\\n地方は送料が高くなりやすい など",
  "shippingSpeed": "例: 最短2〜3営業日で発送 など",
  "areas": "例: 全国（一部地域を除く） など",
  "cancellationPolicy": "例: 最低利用期間◯ヶ月、途中解約は問い合わせ推奨 など",
  "importantNotes": "公式サイトでよくある質問も含めて確認してほしい など"
}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error("[SiteCompanies AI] empty content from OpenAI");
      return NextResponse.json(
        { error: "Empty response from AI" },
        { status: 500 }
      );
    }

    let parsed: AiProfileSuggestion;
    try {
      parsed = JSON.parse(content) as AiProfileSuggestion;
    } catch (e) {
      console.error("[SiteCompanies AI] JSON parse error", e, content);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const suggestion: AiProfileSuggestion = {
      vertical: parsed.vertical ?? body.vertical ?? "rental",
      targetUsers: parsed.targetUsers ?? body.targetUsers ?? "",
      strengths: parsed.strengths ?? body.strengths ?? "",
      weaknesses: parsed.weaknesses ?? body.weaknesses ?? "",
      shippingSpeed: parsed.shippingSpeed ?? body.shippingSpeed ?? "",
      areas: parsed.areas ?? body.areas ?? "",
      cancellationPolicy:
        parsed.cancellationPolicy ?? body.cancellationPolicy ?? "",
      importantNotes: parsed.importantNotes ?? body.importantNotes ?? "",
    };

    // フロントの期待に合わせて { suggestion } で返す
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error("[SiteCompanies AI] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
