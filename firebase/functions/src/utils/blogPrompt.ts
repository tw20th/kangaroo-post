import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type TemplateVars = Record<
  string,
  string | number | boolean | null | undefined
>;

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
   * 使用するテンプレファイル名（任意）。
   * 例:
   *  - "blogTemplate_kariraku_daily.txt"
   *  - "blogTemplate_kariraku_service.txt"
   *  - "blogTemplate_kariraku_compare.txt"
   * 未指定ならサイトに応じて自動選択（kariraku 以外は a8 汎用）
   */
  templateName?: string;

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

/**
 * 超軽量テンプレ置換。
 * - {{key}} を vars[key] で単純置換
 * - ネスト/ #each など高度な構文は扱わない（必要なら generateContentWithTemplate を使用）
 */
function simpleInterpolate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** サイトIDと指定からテンプレファイル名を決める（後方互換あり） */
function chooseTemplateFilename(params: BuildPromptParams): string {
  if (params.templateName) return params.templateName;

  // kariraku 固有テンプレ（デフォルトは daily）
  if (params.siteId === "kariraku") {
    return "blogTemplate_kariraku_daily.txt";
  }

  // 既存 a8 汎用にフォールバック
  return "blogTemplate_a8.txt";
}

/**
 * プロンプト文字列を構築。
 * - kariraku: blogTemplate_kariraku_*.txt を読み込む
 * - それ以外: blogTemplate_a8.txt を既定で使用
 * - simpleInterpolate で {{key}} を差し替え（必要十分でなければ generateContentWithTemplate を利用推奨）
 */
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
