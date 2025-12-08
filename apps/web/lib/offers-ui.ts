// apps/web/lib/offers-ui.ts

// UI で使う会社タイプ
export type CompanyType =
  | "living"
  | "gadget"
  | "trial"
  | string
  | null
  | undefined;

/**
 * companyType をバッジ用の日本語ラベルに変換
 */
export function labelForCompanyType(type: CompanyType): string {
  if (!type) return "暮らし全般";
  switch (type) {
    case "living":
      return "くらし全般";
    case "gadget":
      return "ガジェット・家電";
    case "trial":
      return "お試し・期間限定";
    default:
      // Firestore に将来別の値を入れても、とりあえずそのまま表示
      return String(type);
  }
}

/**
 * companyType に応じたテーマ画像パスを返す
 * （/public/images/offers 配下に配置）
 */
export function getThemeThumbnail(type: CompanyType): string {
  switch (type) {
    case "living":
      return "/images/offers/theme-living.jpg";
    case "gadget":
      return "/images/offers/theme-gadget.jpg";
    case "trial":
      return "/images/offers/theme-trial.jpg";
    default:
      return "/images/offers/theme-default.jpg";
  }
}
