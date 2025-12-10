// firebase/functions/src/utils/generateBlogContent.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getOpenAI } from "../lib/infra/openai.js";
import { buildPrompt, BuildPromptParams, TemplateVars } from "./blogPrompt.js";
import { getSiteConfig } from "../lib/sites/siteConfig.js";
import { BASE_TRUST_PROMPT } from "../lib/prompts/baseTrustPrompt.js";

type ProductLite = { name: string; asin: string; tags?: string[] };

export type GenerateParams = {
  product: ProductLite;
  siteId: string;
  siteName: string;
  persona: string;
  pain: string;
  /** 使用するテンプレ名（省略可） */
  templateName?: string;
  /** テンプレに流す追加変数（省略可） */
  vars?: TemplateVars;
};

const MODEL = process.env.MODEL_BLOG || "gpt-4o-mini";

/* =========================================================
   Discover 用タグのデフォルト（サイトごと）
   ========================================================= */
const DISCOVER_TAGS_BY_SITE: Record<string, string[]> = {
  kariraku: ["一人暮らし", "暮らしの工夫", "家電のある生活", "ミニコラム"],
  workiroom: ["在宅ワーク", "デスク環境", "働き方の工夫", "ミニコラム"],
  hadasmooth: ["肌のゆらぎ", "生活リズム", "やさしいケア", "ミニコラム"],
  // 🦘 カンガルーポスト
  "kangaroo-post": [
    "サイト運営",
    "記事作成",
    "自動投稿",
    "続けやすさ",
    "ミニコラム",
  ],
};

async function resolveDiscoverTags(siteId: string): Promise<string[]> {
  try {
    const cfg = await getSiteConfig(siteId);
    const fromProfileUnknown = cfg?.profile?.discover?.tags ?? [];
    const fromProfile = Array.isArray(fromProfileUnknown)
      ? (fromProfileUnknown as unknown[])
      : [];
    const filtered = fromProfile.filter(
      (t): t is string => typeof t === "string" && t.trim().length > 0
    );
    if (filtered.length > 0) return filtered;
  } catch {
    // siteConfig読めなかったらデフォルトにフォールバック
  }

  const fallback = DISCOVER_TAGS_BY_SITE[siteId];
  if (fallback && fallback.length > 0) return fallback;

  return ["暮らしのメモ", "ミニコラム"];
}

/* ========== テンプレファイル読み込み系 ========== */
function promptsDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "../lib/prompts");
}
function readTextSafe(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}
function toStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

/* ========== {{var}} と {{#each}} の簡易テンプレ ========== */
function resolveByPath(obj: unknown, key: string): unknown {
  const parts = key
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (typeof cur !== "object" || cur === null) return "";
    const rec = cur as Record<string, unknown>;
    cur = rec[p];
  }
  return cur ?? "";
}

function replaceVars(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(
    /\{\{\s*([a-zA-Z0-9_.\[\]-]+)\s*\}\}/g,
    (_m: string, key: string) => {
      const v = resolveByPath(vars, key);
      return toStr(v);
    }
  );
}

function renderEachBlocks(tpl: string, vars: Record<string, unknown>): string {
  const eachRe =
    /\{\{\s*#each\s+([a-zA-Z0-9_.\[\]-]+)\s*\}\}([\s\S]*?)\{\{\s*\/each\s*\}\}/g;

  return tpl.replace(eachRe, (_m: string, arrPath: string, inner: string) => {
    const resolved = resolveByPath(vars, arrPath);
    const arr = Array.isArray(resolved) ? (resolved as unknown[]) : null;
    if (!arr || arr.length === 0) return "";

    return arr
      .map((item) => {
        let block = inner.replace(
          /\{\{\s*this\.([a-zA-Z0-9_.\[\]-]+)\s*\}\}/g,
          (_m2: string, k: string) => {
            const v = resolveByPath(item, k);
            return toStr(v);
          }
        );
        block = block.replace(
          /\{\{\s*([a-zA-Z0-9_.\[\]-]+)\s*\}\}/g,
          (_m3: string, k: string) => {
            const vItem = resolveByPath(item, k);
            if (vItem !== "" && vItem !== undefined) return toStr(vItem);
            const vAll = resolveByPath(vars, k);
            return toStr(vAll);
          }
        );
        return block;
      })
      .join("");
  });
}

/** テンプレを AI なしで埋める */
export async function generateContentWithTemplate(
  templateName: string,
  vars: Record<string, unknown>
): Promise<string> {
  const full = path.join(promptsDir(), templateName);
  let tpl = readTextSafe(full);
  if (!tpl) throw new Error(`template not found: ${templateName}`);
  tpl = renderEachBlocks(tpl, vars);
  tpl = replaceVars(tpl, vars);
  return tpl.trim();
}

/* ========== JSON スキーマ定義（旧スタイルの完全 JSON 用） ========== */
type JsonOut = {
  title?: string;
  excerpt?: string;
  slugKeys?: string[];
  toc?: string[];
  sections?: Array<{ h2?: string; bodyMd?: string }>;
  faq?: Array<{ q?: string; a?: string }>;
  cta?: { label?: string; note?: string };
  titleOptions?: Array<{
    title?: string;
    warmScore?: number;
    clarityScore?: number;
    naturalnessScore?: number;
  }>;
};

const BLOG_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    excerpt: { type: "string" },
    slugKeys: { type: "array", items: { type: "string" } },
    toc: { type: "array", items: { type: "string" } },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          h2: { type: "string" },
          bodyMd: { type: "string" },
        },
        required: ["h2", "bodyMd"],
      },
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          q: { type: "string" },
          a: { type: "string" },
        },
        required: ["q", "a"],
      },
    },
    cta: {
      type: "object",
      additionalProperties: false,
      properties: {
        label: { type: "string" },
        note: { type: "string" },
      },
      required: ["label", "note"],
    },
    titleOptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          warmScore: { type: "number" },
          clarityScore: { type: "number" },
          naturalnessScore: { type: "number" },
        },
        required: ["title", "warmScore", "clarityScore", "naturalnessScore"],
      },
    },
  },
  required: ["title"],
} as const;

/* ========== JSON → Markdown（旧スタイル用） ========== */
function toMarkdown(j: JsonOut): string {
  const lines: string[] = [];
  if (j.title) lines.push(`# ${j.title}`);
  if (j.excerpt) lines.push("", String(j.excerpt));
  if (Array.isArray(j.toc) && j.toc.length) {
    lines.push("", "## 目次", ...j.toc.map((t) => `- ${t}`));
  }
  if (Array.isArray(j.sections)) {
    for (const s of j.sections) {
      if (!s) continue;
      if (s.h2) lines.push("", `## ${s.h2}`);
      if (s.bodyMd) lines.push(String(s.bodyMd));
    }
  }
  if (Array.isArray(j.faq) && j.faq.length) {
    lines.push("", "## よくある質問");
    for (const f of j.faq) {
      if (!f) continue;
      if (f.q) lines.push(`**Q. ${f.q}**`);
      if (f.a) lines.push(String(f.a));
      lines.push("");
    }
  }
  if (j.cta?.label || j.cta?.note) {
    lines.push(
      "",
      `> CTA: ${j.cta?.label ?? "公式で詳しく見る"}`,
      j.cta?.note ?? ""
    );
  }
  return lines.join("\n");
}

/* ========== テキストユーティリティ ========== */
function looksLikeMarkdown(s: string): boolean {
  const t = s.trim();
  return /^#{1,3}\s+/.test(t) || /^- |\* /.test(t) || /\n##\s+/.test(t);
}

function getOutputText(res: unknown): string {
  // openai.responses.create の output_text を想定
  const maybe = res as { output_text?: string };
  if (typeof maybe?.output_text === "string") return maybe.output_text;

  // 念のため fallback（古い SDK 互換）
  try {
    const anyRes = res as {
      output?: Array<{
        content?: Array<{ text?: { value?: string } }>;
      }>;
    };
    const v =
      anyRes.output?.[0]?.content?.[0]?.text?.value ??
      ("" as string | undefined);
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

function extractExcerptFromMarkdown(md: string): string | null {
  if (!md.trim()) return null;
  const text = md
    // コードブロックは除去
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 4)
    .join(" ");
  const cleaned = text.replace(/[#>*_`]/g, "");
  if (!cleaned.trim()) return null;
  return cleaned.slice(0, 130);
}

/* ========== 先頭 ```json ... ``` を抜き出す用 ========== */
type HeaderTitleOption = {
  title?: string;
  warmScore?: number;
  clarityScore?: number;
  naturalnessScore?: number;
};

type HeaderMeta = {
  title?: string;
  titleOptions?: HeaderTitleOption[];
};

function extractJsonHeaderAndBody(raw: string): {
  meta: HeaderMeta | null;
  bodyMd: string;
} {
  const text = raw.trimStart();
  if (!text.startsWith("```json") && !text.startsWith("```JSON")) {
    return { meta: null, bodyMd: raw.trim() };
  }

  const firstFenceEnd = text.indexOf("\n", 3);
  if (firstFenceEnd === -1) {
    return { meta: null, bodyMd: raw.trim() };
  }

  const afterFirst = text.slice(firstFenceEnd + 1);
  const closingIndex = afterFirst.indexOf("```");
  if (closingIndex === -1) {
    return { meta: null, bodyMd: raw.trim() };
  }

  const jsonBlock = afterFirst.slice(0, closingIndex).trim();
  const body = afterFirst.slice(closingIndex + 3).trim();

  let meta: HeaderMeta | null = null;
  try {
    const parsed = JSON.parse(jsonBlock) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (Object.prototype.hasOwnProperty.call(parsed, "title") ||
        Object.prototype.hasOwnProperty.call(parsed, "titleOptions"))
    ) {
      const obj = parsed as {
        title?: unknown;
        titleOptions?: unknown;
      };

      const title =
        typeof obj.title === "string" && obj.title.trim().length > 0
          ? obj.title.trim()
          : undefined;

      let titleOptions: HeaderTitleOption[] | undefined;
      if (Array.isArray(obj.titleOptions)) {
        titleOptions = obj.titleOptions
          .map((o) => {
            if (typeof o !== "object" || o === null) return null;
            const rec = o as Record<string, unknown>;
            const t = rec.title;
            const warm = rec.warmScore;
            const clarity = rec.clarityScore;
            const nat = rec.naturalnessScore;
            return {
              title: typeof t === "string" ? t : undefined,
              warmScore: typeof warm === "number" ? warm : undefined,
              clarityScore: typeof clarity === "number" ? clarity : undefined,
              naturalnessScore: typeof nat === "number" ? nat : undefined,
            } as HeaderTitleOption;
          })
          .filter((v): v is HeaderTitleOption => !!v && !!v.title);
      }

      meta = { title, titleOptions };
    }
  } catch {
    meta = null;
  }

  return { meta, bodyMd: body };
}

function pickBestTitleFromMeta(
  meta: HeaderMeta | null,
  fallback: string
): string {
  const baseTitle =
    meta?.title && meta.title.trim().length > 0 ? meta.title.trim() : "";

  const candOptions = Array.isArray(meta?.titleOptions)
    ? meta?.titleOptions
    : null;

  if (candOptions && candOptions.length > 0) {
    const candidates = candOptions
      .map((opt) => {
        const t =
          typeof opt.title === "string" && opt.title.trim().length > 0
            ? opt.title.trim()
            : null;
        if (!t) return null;
        const warm = typeof opt.warmScore === "number" ? opt.warmScore : 0;
        const clarity =
          typeof opt.clarityScore === "number" ? opt.clarityScore : 0;
        const natural =
          typeof opt.naturalnessScore === "number" ? opt.naturalnessScore : 0;
        return {
          title: t,
          total: warm + clarity + natural,
          warm,
          clarity,
          natural,
        };
      })
      .filter(
        (
          v
        ): v is {
          title: string;
          total: number;
          warm: number;
          clarity: number;
          natural: number;
        } => !!v
      );

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.title.length - b.title.length;
      });
      return candidates[0].title;
    }
  }

  if (baseTitle) return baseTitle;
  return fallback;
}

function pickBestTitleFromJson(json: JsonOut, fallback: string): string {
  const meta: HeaderMeta = {
    title: json.title,
    titleOptions: json.titleOptions,
  };
  return pickBestTitleFromMeta(meta, fallback);
}

function hasStructuredSections(json: JsonOut | null): json is JsonOut {
  return !!json && Array.isArray(json.sections) && json.sections.length > 0;
}

/* ========== 本体 ========== */
export async function generateBlogContent(params: GenerateParams) {
  const openai = getOpenAI();

  const prompt = buildPrompt({
    siteId: params.siteId,
    siteName: params.siteName,
    product: params.product,
    persona: params.persona,
    pain: params.pain,
    templateName: params.templateName,
    vars: params.vars,
  } as BuildPromptParams);

  const fullPrompt = `${BASE_TRUST_PROMPT}\n\n${String(prompt)}`;

  if (process.env.DEBUG_BLOG === "1") {
    console.log("[PROMPT]", fullPrompt.slice(0, 600));
  }

  const res = await openai.responses.create({
    model: MODEL,
    input: fullPrompt,
    temperature: 0.4,
    max_output_tokens: 2000,
    text: {
      format: {
        type: "json_schema",
        name: "BlogOutline",
        schema: BLOG_JSON_SCHEMA,
        strict: false, // ← 少し緩めておく（compare みたいなハイブリッド出力対策）
      },
    },
  });

  const rawAll = getOutputText(res);

  if (process.env.DEBUG_BLOG === "1") {
    console.log("[AI RAW]", rawAll.slice(0, 600));
  }

  /* 1. まず「完全 JSON として解釈できるか」を試す */
  let jsonParsed: JsonOut | null = null;
  try {
    const obj = JSON.parse(rawAll) as unknown;
    if (typeof obj === "object" && obj !== null) {
      jsonParsed = obj as JsonOut;
    }
  } catch {
    jsonParsed = null;
  }

  let mdFromJson = "";
  if (hasStructuredSections(jsonParsed)) {
    mdFromJson = toMarkdown(jsonParsed);
  }

  /* 2. それが無理なら、先頭の ```json ... ``` メタだけ抜いて本文にする */
  const { meta: headerMeta, bodyMd } = extractJsonHeaderAndBody(rawAll);

  const markdownBody = mdFromJson || bodyMd || rawAll.trim();

  /* Discover 用フラグ（テンプレ or vars.intent） */
  const varsObj =
    (params.vars as unknown as Record<string, unknown> | undefined) ??
    undefined;
  const isDiscoverIntent =
    params.templateName === "blogTemplate_discover.txt" ||
    (varsObj && varsObj["intent"] === "discover");

  /* 3. タイトル決定ロジック */
  // 🦘 Discover 向けのやさしい fallback タイトル
  const defaultFallbackTitle = isDiscoverIntent
    ? params.product.name && params.product.name.trim().length > 0
      ? `${params.product.name}と暮らしのミニコラム`
      : "今日のちいさなコラム"
    : `${params.product.name} 値下げ情報`;

  let title = defaultFallbackTitle;

  if (jsonParsed) {
    title = pickBestTitleFromJson(jsonParsed, defaultFallbackTitle);
  } else if (headerMeta) {
    title = pickBestTitleFromMeta(headerMeta, defaultFallbackTitle);
  }

  /* 4. 抜粋（excerpt） */
  const excerptFromJson = jsonParsed?.excerpt ?? null;
  const excerpt = excerptFromJson ?? extractExcerptFromMarkdown(markdownBody);

  /* 5. タグ */
  let tags: string[] = [];
  if (Array.isArray(jsonParsed?.slugKeys)) {
    tags = jsonParsed.slugKeys.filter(
      (t): t is string => typeof t === "string" && t.trim().length > 0
    );
  } else if (Array.isArray(params.product.tags)) {
    tags = params.product.tags;
  }

  // Discover intent なら Discover タグをマージ
  if (isDiscoverIntent) {
    const discoverTags = await resolveDiscoverTags(params.siteId);
    if (discoverTags.length > 0) {
      const merged = new Set<string>();
      for (const t of tags) {
        if (t && t.trim().length > 0) merged.add(t);
      }
      for (const t of discoverTags) {
        if (t && t.trim().length > 0) merged.add(t);
      }
      tags = Array.from(merged);
    }
  }

  /* 6. 最終的な Markdown を保証 */
  let finalContent = markdownBody;
  if (!finalContent.trim()) {
    const safeExcerpt = excerpt ?? "";
    finalContent = `# ${title}\n\n${safeExcerpt}`.trim();
  }

  return {
    title,
    excerpt,
    tags,
    content: finalContent,
    imageUrl: undefined,
  };
}
