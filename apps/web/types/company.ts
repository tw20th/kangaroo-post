// apps/web/types/company.ts

export type CompanyUrlType =
  | "top"
  | "pricing"
  | "plans"
  | "faq"
  | "terms"
  | "guide"
  | "other";

export type CompanyUrl = {
  id: string; // フォーム用ID
  type: CompanyUrlType;
  label: string;
  url: string;
};

export type Company = {
  id: string; // companyId
  displayName: string;
  brandName?: string;
  officialUrl: string;
  logoUrl?: string;
  groupType?: "manufacturer" | "retailer" | "platform" | "other";
  listed?: boolean;
  notes?: string;
  urls: CompanyUrl[];
};

/** サイト別の企業プロフィール（companyProfiles） */
export type CompanyProfile = {
  id: string; // = companyId（document ID）
  siteId: string;
  companyId: string;

  vertical: string; // 例: "rental" / "wifi" など

  // 共通フィールド
  targetUsers: string[]; // おすすめしたい人像
  strengths: string[]; // 強み
  weaknesses: string[]; // 注意点・弱み

  // kariraku（レンタル）向けの例
  shippingSpeed?: string; // 配送スピード
  areas?: string; // 対応エリア
  cancellationPolicy?: string; // 解約・途中解約
  importantNotes: string[]; // 特に伝えておきたいこと
};
