// firebase/functions/src/utils/generateBlogContent.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getOpenAI } from "../lib/infra/openai.js";
import { buildPrompt, BuildPromptParams, TemplateVars } from "./blogPrompt.js";

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

/* ========== 小ユーティリティ ========== */
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
// ドット＆インデックス参照 resolver
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
// {{var}} 置換
function replaceVars(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(
    /\{\{\s*([a-zA-Z0-9_.\[\]-]+)\s*\}\}/g,
    (_m: string, key: string) => {
      const v = resolveByPath(vars, key);
      return toStr(v);
    }
  );
}
// {{#each arr}} ... {{/each}} 対応
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

/** テンプレをAIなしで埋める */
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

/* ========== JSON スキーマ定義（JSONを強制） ========== */
type JsonOut = {
  title?: string;
  excerpt?: string;
  slugKeys?: string[];
  toc?: string[];
  sections?: Array<{ h2?: string; bodyMd?: string }>;
  faq?: Array<{ q?: string; a?: string }>;
  cta?: { label?: string; note?: string };
};

// === JSON Schema (strict 用) ===
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
        required: ["h2", "bodyMd"], // ← ネスト必須
      },
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { q: { type: "string" }, a: { type: "string" } },
        required: ["q", "a"], // ← ネスト必須
      },
    },
    cta: {
      type: "object",
      additionalProperties: false,
      properties: { label: { type: "string" }, note: { type: "string" } },
      required: ["label", "note"], // ← ネスト必須
    },
  },
  // ★ これが無くて 400 になっていました
  required: ["title", "excerpt", "slugKeys", "toc", "sections", "faq", "cta"],
} as const;

/* ========== Markdown 組み立て ========== */
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

function looksLikeMarkdown(s: string): boolean {
  const t = s.trim();
  return /^#{1,3}\s+/.test(t) || /^- |\* /.test(t) || /\n##\s+/.test(t);
}

function getOutputText(res: unknown): string {
  const maybe = res as { output_text?: string };
  return typeof maybe?.output_text === "string" ? maybe.output_text : "";
}

/* ========== 本体：AIで生成（空を作らない設計） ========== */
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

  if (process.env.DEBUG_BLOG === "1") {
    console.log("[PROMPT]", String(prompt).slice(0, 600));
  }

  // ← 呼び出しはこれ1回だけ（再宣言しない）
  const res = await openai.responses.create({
    model: MODEL,
    input: prompt,
    temperature: 0.4,
    max_output_tokens: 2000,
    // JSON強制は text.format に移動（openai@6.7.0対応）
    text: {
      format: {
        type: "json_schema",
        name: "BlogOutline",
        schema: BLOG_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  const rawAll = getOutputText(res);
  if (process.env.DEBUG_BLOG === "1") {
    console.log("[AI RAW]", rawAll.slice(0, 600));
  }

  // 1) JSONとして安全に解釈
  const json = safeParse<JsonOut>(rawAll || "{}");
  const mdFromJson = toMarkdown(json).trim();

  // 2) JSONが空でも、万一テキストがMarkdownなら拾う（保険）
  if (!mdFromJson && looksLikeMarkdown(rawAll)) {
    return {
      title: `${params.product.name} 値下げ情報`,
      excerpt: null,
      tags: params.product.tags ?? [],
      content: rawAll.trim(),
      imageUrl: undefined,
    };
  }

  // 3) 最低限のタイトルを保証
  const title =
    json.title && json.title.trim()
      ? json.title
      : `${params.product.name} 値下げ情報`;
  const excerpt = json.excerpt ?? null;
  const tags = Array.isArray(json.slugKeys)
    ? json.slugKeys
    : params.product.tags ?? [];

  return {
    title,
    excerpt,
    tags,
    content: mdFromJson || `# ${title}\n\n${excerpt ?? ""}`.trim(),
    imageUrl: undefined,
  };
}

// ---- JSON parse (厳密化) ----
function safeParse<T>(s: string): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return {} as T;
  }
}
