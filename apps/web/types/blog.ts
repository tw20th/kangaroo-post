// apps/web/types/blog.ts

// ブログの公開ステータス
export type BlogStatus = "draft" | "published" | "archived";

// nightly analyze 1件ぶん
export type BlogAnalysisEntry = {
  score: number;
  checks?: Record<string, boolean | number>;
  suggestions: string[];
  titleSuggestion: string | null;
  outlineSuggestion: string | null;
  createdAt: number;
  source: string;
};

// /admin/blogs/[slug] 用
export type BlogAdminView = {
  slug: string;
  title: string;
  status: BlogStatus;
  analysisHistory: BlogAnalysisEntry[];
};

// /admin/blogs 用の一覧1行ぶん
export type BlogAdminListRow = {
  slug: string;
  title: string;
  status: BlogStatus;
  latestScore: number | null;
  createdAt: number | null;
  updatedAt: number | null;
};
