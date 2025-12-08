// apps/web/lib/queries-offers.ts
import {
  fsRunQuery,
  vNum,
  vStr,
  type FsValue,
  docIdFromName,
} from "@/lib/firestore-rest";

export type OfferProfile = {
  companyType?: string | null;
  shortCopy?: string | null;
  priceLabel?: string | null;
  minTermLabel?: string | null;
};

export type OfferRow = {
  id: string;
  siteId?: string | null;
  advertiser?: string | null;
  programId?: string | null;
  programName?: string | null;
  displayName?: string | null;
  affiliateUrl?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  profile?: OfferProfile;
};

type FsDoc = { name: string; fields: Record<string, FsValue> };

function buildDisplayName(f: Record<string, FsValue>): string {
  const serviceName = vStr(f, "service.name");
  const title = vStr(f, "title");
  const displayName = vStr(f, "displayName");
  const advertiser = vStr(f, "advertiser");

  return (
    serviceName || title || displayName || advertiser || "サービス名未設定"
  );
}

function buildShortCopy(f: Record<string, FsValue>): string | null {
  const c1 = vStr(f, "ui.compareHighlight");
  const c2 = vStr(f, "ui.highlightLabel");
  const c3 = vStr(f, "highlightLabel");
  const c4 = vStr(f, "service.overview");
  const c5 = vStr(f, "description");

  const text = c1 || c2 || c3 || c4 || c5 || "";
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function fetchOffersForSite(
  siteId: string,
  companyType?: string | null
): Promise<OfferRow[]> {
  const where: {
    field: string;
    op:
      | "EQUAL"
      | "ARRAY_CONTAINS"
      | "GREATER_THAN"
      | "LESS_THAN"
      | "GREATER_THAN_OR_EQUAL"
      | "LESS_THAN_OR_EQUAL";
    value: string | number | boolean | null;
  }[] = [
    {
      field: "siteIds",
      op: "ARRAY_CONTAINS",
      value: siteId,
    },
    {
      field: "status",
      op: "EQUAL",
      value: "active",
    },
  ];

  if (companyType && companyType !== "all") {
    where.push({
      field: "profile.companyType",
      op: "EQUAL",
      value: companyType,
    });
  }

  const rows = (await fsRunQuery({
    collection: "offers",
    where,
    orderBy: [{ field: "priority", direction: "DESCENDING" as const }],
    limit: 50,
  })) as FsDoc[];

  return rows
    .map((row) => {
      const f = row.fields ?? {};

      const profileCompanyType = vStr(f, "profile.companyType");
      const shortCopy = buildShortCopy(f);
      const priceLabel =
        vStr(f, "ui.priceLabel") || vStr(f, "pricing.priceLabel");
      const minTermLabel =
        vStr(f, "ui.minTermLabel") || vStr(f, "pricing.minTermLabel");

      const profile: OfferProfile | undefined =
        profileCompanyType || shortCopy || priceLabel || minTermLabel
          ? {
              companyType: profileCompanyType,
              shortCopy: shortCopy ?? undefined,
              priceLabel: priceLabel ?? undefined,
              minTermLabel: minTermLabel ?? undefined,
            }
          : undefined;

      return {
        id: vStr(f, "id") || docIdFromName(row.name),
        siteId: vStr(f, "siteIdPrimary") || vStr(f, "siteId"),
        advertiser: vStr(f, "advertiser"),
        programId: vStr(f, "programId"),
        programName: vStr(f, "programId")
          ? vStr(f, "service.name") || vStr(f, "programName")
          : vStr(f, "service.name") || vStr(f, "programName"),
        displayName: buildDisplayName(f),
        affiliateUrl: vStr(f, "affiliateUrl"),
        createdAt: vNum(f, "createdAt"),
        updatedAt: vNum(f, "updatedAt"),
        profile,
      } satisfies OfferRow;
    })
    .sort((a, b) => {
      const at = a.updatedAt ?? a.createdAt ?? 0;
      const bt = b.updatedAt ?? b.createdAt ?? 0;
      return bt - at;
    });
}
