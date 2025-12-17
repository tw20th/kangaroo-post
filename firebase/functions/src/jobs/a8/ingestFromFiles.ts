// firebase/functions/src/jobs/a8/ingestFromFiles.ts
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/logger";

/* ====== __dirname 対応 ====== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ====== Firebase 初期化 ====== */
if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}

/* ====== スキーマ定義 ====== */
const vendorSchema = z.object({
  vendorId: z.string(),
  name: z.string(),
  siteUrl: z.string().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")).optional(),
  description: z.string().optional(),
  strengths: z.array(z.string()).default([]),
  seo: z
    .object({
      brandKeywords: z.array(z.string()).optional(),
      disallowedPhrases: z.array(z.string()).optional(),
    })
    .optional(),
  updatedAt: z.string().optional(),
});
type VendorDoc = z.infer<typeof vendorSchema>;

const productSchema = z.object({
  productId: z.string(),
  vendorId: z.string(),
  title: z.string(),
  category: z.array(z.string()).default([]),
  specs: z
    .record(z.string(), z.string().or(z.number()).or(z.boolean()))
    .default({}),
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  updatedAt: z.string().optional(),
});
type ProductDoc = z.infer<typeof productSchema>;

const offerSchema = z.object({
  offerId: z.string(),
  productId: z.string(),
  vendorId: z.string(),
  title: z.string(),
  planType: z.enum(["subscription", "one-time", "product", "trial"]).optional(),
  priceMonthly: z.number().nullable().optional(),
  priceOnce: z.number().nullable().optional(),
  minTermMonths: z.number().int().nullable().optional(),
  creatives: z
    .array(
      z.union([
        z.object({
          materialId: z.string().optional(),
          type: z.literal("text"),
          label: z.string().optional(),
          href: z.string().url(),
        }),
        z.object({
          materialId: z.string().optional(),
          type: z.literal("banner"),
          size: z.string().optional(),
          href: z.string().url(),
          imgSrc: z.string().url().optional(),
        }),
      ])
    )
    .optional()
    .default([]),
  shipping: z.object({ policy: z.string().optional() }).optional(),
  cta: z
    .object({
      type: z.enum(["a8", "external"]),
      programId: z.string().optional(),
      href: z.string().url(),
    })
    .optional(),
  promotion: z
    .object({
      couponCode: z.string().nullable().optional(),
      validUntil: z.string().nullable().optional(),
    })
    .optional(),
  status: z.enum(["active", "archived"]).default("active"),
  tags: z.array(z.string()).optional().default([]),
  updatedAt: z.string().optional(),
});
type OfferDoc = z.infer<typeof offerSchema>;

const comparisonSchema = z.union([
  z.object({
    slug: z.string(),
    title: z.string(),
    mode: z.literal("rule"),
    criteria: z.object({
      mustTags: z.array(z.string()).default([]),
      sort: z
        .array(
          z.object({
            field: z.string(),
            dir: z.enum(["asc", "desc"]),
            target: z.enum(["offer", "product"]).default("offer"),
          })
        )
        .default([]),
      limit: z.number().int().optional(),
    }),
    display: z.object({ columns: z.array(z.string()).default([]) }).optional(),
  }),
  z.object({
    slug: z.string(),
    title: z.string(),
    mode: z.literal("manual"),
    items: z.array(z.object({ productId: z.string(), offerId: z.string() })),
    display: z.object({ columns: z.array(z.string()).default([]) }).optional(),
  }),
]);
type ComparisonDoc = z.infer<typeof comparisonSchema>;

/* ====== PATH 設定 ====== */
const DATA_ROOT = path.resolve(process.cwd(), "data");
const SITE_ROOT = path.resolve(process.cwd(), "sites");

/* ====== util: YAML読み込み ====== */
function readYamlFiles<T>(
  dirRel: string,
  schema: z.ZodSchema<T>,
  opts: { sourceId: string; singleFileName?: string } = { sourceId: "" }
): T[] {
  const dir = path.join(DATA_ROOT, opts.sourceId, dirRel);
  if (!fs.existsSync(dir)) return [];
  const all = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  const targets = opts.singleFileName
    ? all.filter((f) => f === opts.singleFileName)
    : all.filter((f) => f.startsWith(`${opts.sourceId}-`) || true);

  return targets.map((f) => {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    return schema.parse(YAML.parse(raw));
  });
}

/* ====== main ====== */
type IngestArgs = {
  siteId: string; // Firestore登録用
  sourceId?: string; // ファイルプレフィックス
  dryRun?: boolean;
};

export async function ingestFromFiles({
  siteId,
  sourceId,
  dryRun = false,
}: IngestArgs): Promise<{
  ok: true;
  siteId: string;
  sourceId: string;
  vendors: number;
  products: number;
  offers: number;
  comparisons: number;
}> {
  if (!siteId) throw new Error("siteId is required");
  const source = sourceId || siteId;
  const db = getFirestore();
  const nowIso = new Date().toISOString();

  // サイト設定を読み込む
  const sitePath = path.join(SITE_ROOT, `${siteId}.json`);
  const siteConfig = fs.existsSync(sitePath)
    ? JSON.parse(fs.readFileSync(sitePath, "utf8"))
    : null;

  const withUpdatedAt = <T>(obj: T): T & { updatedAt: string } => ({
    ...(obj as any),
    updatedAt: (obj as any).updatedAt ?? nowIso,
  });

  const vendors: VendorDoc[] = readYamlFiles("vendors", vendorSchema, {
    sourceId: source,
    singleFileName: `${source}.yaml`,
  });
  const vendorMap = new Map<string, VendorDoc>(
    vendors.map((v) => [v.vendorId, v])
  );

  const products: ProductDoc[] = readYamlFiles("products", productSchema, {
    sourceId: source,
  });
  const productMap = new Map<string, ProductDoc>(
    products.map((p) => [p.productId, p])
  );

  const offers: OfferDoc[] = readYamlFiles("offers", offerSchema, {
    sourceId: source,
  });

  const comparisons: ComparisonDoc[] = readYamlFiles(
    "comparisons",
    comparisonSchema,
    {
      sourceId: source,
    }
  );

  logger.info(
    `[ingestFromFiles] siteId=${siteId}, source=${source}, dryRun=${dryRun} files: vendors=${vendors.length}, products=${products.length}, offers=${offers.length}, comparisons=${comparisons.length}`
  );

  if (dryRun) {
    return {
      ok: true,
      siteId,
      sourceId: source,
      vendors: vendors.length,
      products: products.length,
      offers: offers.length,
      comparisons: comparisons.length,
    };
  }

  /* ==== 書き込み処理 ==== */
  for (const v of vendors) {
    await db
      .collection("vendors")
      .doc(v.vendorId)
      .set(
        {
          ...withUpdatedAt(v),
          siteId,
          siteName: siteConfig?.displayName ?? siteId,
          searchKeywords: [
            v.name,
            ...(v.seo?.brandKeywords ?? []),
            ...(v.strengths ?? []),
          ],
          normalizedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  for (const p of products) {
    const vendor = vendorMap.get(p.vendorId) ?? null;
    await db
      .collection("products")
      .doc(p.productId)
      .set(
        {
          ...withUpdatedAt(p),
          siteId,
          siteName: siteConfig?.displayName ?? siteId,
          vendorSnapshot: vendor
            ? {
                vendorId: vendor.vendorId,
                name: vendor.name,
                siteUrl: vendor.siteUrl,
                logoUrl: vendor.logoUrl ?? null,
              }
            : null,
          searchKeywords: [p.title, ...p.category, ...p.tags],
          normalizedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  for (const o of offers) {
    const vendor = vendorMap.get(o.vendorId) ?? null;
    const product = productMap.get(o.productId) ?? null;
    const planType =
      o.planType === "product" ? "one-time" : o.planType ?? "subscription";

    await db
      .collection("offers")
      .doc(o.offerId)
      .set(
        {
          ...withUpdatedAt(o),
          siteId,
          siteName: siteConfig?.displayName ?? siteId,
          planType,
          priceRange: o.priceMonthly ?? o.priceOnce ?? null,
          vendorSnapshot: vendor
            ? {
                vendorId: vendor.vendorId,
                name: vendor.name,
                siteUrl: vendor.siteUrl,
                logoUrl: vendor.logoUrl ?? null,
              }
            : null,
          productSnapshot: product
            ? {
                productId: product.productId,
                title: product.title,
                category: product.category,
                images: product.images,
                tags: product.tags,
              }
            : null,
          normalizedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  for (const c of comparisons) {
    await db
      .collection("comparisons")
      .doc(c.slug)
      .set(
        {
          ...withUpdatedAt(c),
          siteId,
          siteName: siteConfig?.displayName ?? siteId,
          normalizedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  return {
    ok: true,
    siteId,
    sourceId: source,
    vendors: vendors.length,
    products: products.length,
    offers: offers.length,
    comparisons: comparisons.length,
  };
}

export default ingestFromFiles;
