export type CompanyType = "living" | "gadget" | "trial";

export interface A8OfferProfile {
  companyType?: CompanyType;
  targetUsers?: string[];
  strengths?: string[];
  weaknesses?: string[];
  importantNotes?: string[];
}

export interface A8Offer {
  id: string;
  title: string;
  description?: string;
  landingUrl?: string;
  affiliateUrl?: string;
  images?: string[];
  badges?: string[];
  tags?: string[];
  siteIds?: string[];
  vertical?: string;

  // ★ ここに追加
  profile?: A8OfferProfile;

  extras?: any;
  creatives?: any[];
}
