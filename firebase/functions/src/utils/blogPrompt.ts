// firebase/functions/src/utils/blogPrompt.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * vars には配列・オブジェクトも渡すため、unknown を許容する
 * （generateContentWithTemplate / resolveByPath が unknown 前提で動くため安全）
 */
export type TemplateVars = Record<string, unknown>;

/**
 * intent:
 *  - "service"  : 企業・サービス紹介（companyIntro）
 *  - "compare"  : 比較記事（compare）
 *  - "guide"    : 悩みガイド（painGuide）
 *  - "discover" : Discover 記事
 */
export type BlogIntent = "service" | "compare" | "guide" | "discover";

export type BuildPromptParams = {
  /** 例: "kariraku" */
  siteId: string;
  /** 表示名（例: "Kariraku（カリラク）"） */
  siteName?: string;
  /** 旧来の product 文脈（互換用） */
  product?: { name: string; asin: string; tags?: string[] };
  /** ライティング上のペルソナ（任意） */
  persona?: string;
  /** 想定の悩み（任意） */
  pain?: string;

  /**
   * 記事の意図（新ルール）
   *  - "service"  : 企業・サービス紹介
   *  - "compare"  : 比較記事
   *  - "guide"    : 悩みガイド
   *  - "discover" : Discover 記事
   *
   * ※ 既存コードからはまだ渡されていないかもしれないので optional。
   */
  intent?: BlogIntent;

  /**
   * 使用するテンプレファイル名（任意）。
   * 例:
   *  - "blogTemplate_companyIntro.txt"
   *  - "blogTemplate_painGuide.txt"
   *  - "blogTemplate_compare.txt"
   *  - "blogTemplate_discover.txt"
   *
   * 旧来の:
   *  - "blogTemplate_kariraku_daily.txt"
   *  - "blogTemplate_kariraku_service.txt"
   *  - "blogTemplate_kariraku_compare.txt"
   * などもそのまま渡せば優先して使われる。
   */
  templateName?: string;

  /**
   * 旧ロジックで使っていた「記事タイプ」互換用。
   * intent が無い場合のフォールバックにのみ利用する。
   * 例:
   *  - "company"  : 企業・サービス紹介
   *  - "compare"  : 比較記事
   *  - "guide"    : 悩みガイド
   *  - "daily"    : 日次ガイド（= guide 扱い）
   *  - "discover" : Discover 記事
   */
  legacyType?: "company" | "compare" | "guide" | "daily" | "discover";

  /**
   * テンプレへ流し込む追加変数（任意）。
   * 例: { seasonKeyword: "新生活", compareSlug: "compare-202510" }
   */
  vars?: TemplateVars;
};

/** テンプレ格納ディレクトリを解決 */
function resolvePromptsDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // src/utils から ../lib/prompts へ
  return path.resolve(__dirname, "../lib/prompts");
}

/** 安全にファイルを読む（存在しない場合は空文字） */
function readTextSafe(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/** プリミティブなら文字列に、それ以外は "" にする */
function toPrimitiveString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  ) {
    return String(v);
  }
  return "";
}

/**
 * ドット/インデックスでオブジェクトを辿る resolver
 * 例:
 *  - key: "service.name"  → vars.service.name
 *  - key: "competitors.0.name" → vars.competitors[0].name
 *  - key: "subKeywords.[0]" → vars.subKeywords[0]
 */
function resolveByPath(vars: TemplateVars, key: string): unknown {
  // "subKeywords.[0]" → "subKeywords.0" に正規化
  const norm = key.replace(/\[(\d+)\]/g, ".$1");
  const parts = norm.split(".").filter(Boolean);

  let cur: unknown = vars;
  for (const p of parts) {
    if (Array.isArray(cur)) {
      const idx = Number(p);
      if (Number.isNaN(idx) || idx < 0 || idx >= cur.length) return "";
      cur = cur[idx];
      continue;
    }

    if (typeof cur === "object" && cur !== null) {
      const rec = cur as Record<string, unknown>;
      cur = rec[p];
      continue;
    }

    return "";
  }
  return cur ?? "";
}

/**
 * テンプレ置換。
 * - {{key}} を vars から取得
 * - まずは「完全一致キー」を見る（後方互換）
 * - 見つからなければ resolveByPath で辿る
 * - オブジェクト/配列は文字列化せず "" でスキップ
 */
function simpleInterpolate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(
    /\{\{\s*([a-zA-Z0-9_.\[\]-]+)\s*\}\}/g,
    (_m, key: string) => {
      const dict = vars as Record<string, unknown>;

      // 1) そのままのキーで見る（"service.name" など）
      if (Object.prototype.hasOwnProperty.call(dict, key)) {
        return toPrimitiveString(dict[key]);
      }

      // 2) ドット/インデックスで辿る
      const resolved = resolveByPath(vars, key);
      return toPrimitiveString(resolved);
    }
  );
}

/** サイトIDと指定からテンプレファイル名を決める */
function chooseTemplateFilename(params: BuildPromptParams): string {
  const { templateName, intent, legacyType } = params;

  // 1. 明示指定があればそれを最優先（拡張子 .txt がついていればそのまま）
  if (templateName && templateName.endsWith(".txt")) {
    return templateName;
  }

  // 2. intent ベースの汎用テンプレマッピング
  if (intent === "service") {
    return "blogTemplate_companyIntro.txt";
  }
  if (intent === "compare") {
    return "blogTemplate_compare.txt";
  }
  if (intent === "guide") {
    return "blogTemplate_painGuide.txt";
  }
  if (intent === "discover") {
    return "blogTemplate_discover.txt";
  }

  // 3. intent が無い場合は legacyType から推論（旧コード互換）
  switch (legacyType) {
    case "company":
      return "blogTemplate_companyIntro.txt";
    case "compare":
      return "blogTemplate_compare.txt";
    case "guide":
    case "daily":
      return "blogTemplate_painGuide.txt";
    case "discover":
      return "blogTemplate_discover.txt";
    default:
      // 4. 最後の砦：従来どおり「悩みガイド」をデフォルトに
      return "blogTemplate_painGuide.txt";
  }
}

/** プロンプト文字列を構築 */
export function buildPrompt(params: BuildPromptParams): string {
  const promptsDir = resolvePromptsDir();
  const filename = chooseTemplateFilename(params);
  const fullpath = path.join(promptsDir, filename);

  const templateText = readTextSafe(fullpath);
  if (!templateText) {
    // テンプレが見つからない場合は、最低限の安全なプロンプトを返す（障害回避）
    const pname = params.product?.name ?? "(no product)";
    return `# ${pname} の記事テンプレート\n${params.pain ?? ""}`;
  }

  // 置換に使う基本変数（旧パラメータ互換も含む）
  const baseVars: TemplateVars = {
    "site.id": params.siteId,
    "site.displayName": params.siteName ?? "",
    productName: params.product?.name ?? "",
    asin: params.product?.asin ?? "",
    persona: params.persona ?? "",
    pain: params.pain ?? "",
  };

  const mergedVars: TemplateVars = {
    ...baseVars,
    ...(params.vars ?? {}),
  };

  return simpleInterpolate(templateText, mergedVars);
}
