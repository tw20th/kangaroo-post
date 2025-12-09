// apps/web/app/page.tsx
import Link from "next/link";
import type { FsValue } from "@/lib/firestore-rest";
import { fsRunQuery, vNum, vStr, docIdFromName } from "@/lib/firestore-rest";
import { getServerSiteId } from "@/lib/site-server";
import { decodePainRules, type PainRuleLite } from "@/lib/pain-rules";
import BlogsSection, { type BlogSummary } from "@/components/home/BlogsSection";
import OfferGallery from "@/components/offers/OfferGallery";
import HeroBadges from "@/components/home/HeroBadges";
import DiscoverCarousel from "@/components/home/DiscoverCarousel";

export const revalidate = 60;
export const dynamic = "force-dynamic";

/* ===== Firestore REST 用の軽い型 ===== */

type BrandLite = { primary?: string; accent?: string; logoUrl?: string };

type SiteConfigDoc = {
  siteId: string;
  displayName?: string;
  brand?: BrandLite;
  categoryPreset?: string[];
  homeCopy?: {
    title?: string;
    subtitle?: string;
    dataSourceLabel?: string;
    note?: string;
    featuredTitle?: string;
    blogsTitle?: string;
  };
  painRules?: PainRuleLite[];
};

type FirestoreField = {
  stringValue?: string;
  arrayValue?: { values?: { stringValue?: string }[] };
  mapValue?: { fields?: Record<string, FirestoreField> };
};

type FsDoc = { name: string; fields: Record<string, FsValue> };

/* ===== サイト設定ロード ===== */

async function loadSiteConfig(siteId: string): Promise<SiteConfigDoc> {
  const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FB_API_KEY;
  if (!projectId || !apiKey) return fallbackConfig(siteId);

  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sites/${encodeURIComponent(
      siteId
    )}`
  );
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return fallbackConfig(siteId);

    const json = (await res.json()) as
      | { fields?: Record<string, unknown> }
      | undefined;

    const rawFields = (json?.fields as Record<string, FirestoreField>) ?? {};
    const f = json?.fields ?? {};

    const getField = (k: string): FirestoreField | undefined => rawFields[k];

    const str = (k: string): string | undefined =>
      getField(k)?.stringValue ?? undefined;

    const arr = (k: string): string[] | undefined => {
      const values = getField(k)?.arrayValue?.values;
      if (!values || values.length === 0) return undefined;
      return values.map((v) => v.stringValue ?? "").filter((s) => s.length > 0);
    };

    const brandFields = getField("brand")?.mapValue?.fields ?? {};
    const bstr = (k: string): string | undefined =>
      brandFields[k]?.stringValue ?? undefined;

    const hcFields =
      getField("homeCopy")?.mapValue?.fields ??
      ({} as Record<string, FirestoreField>);

    const cfg: SiteConfigDoc = {
      siteId,
      displayName: str("displayName") ?? "カンガルーポスト",
      brand: {
        primary: bstr("primary"),
        accent: bstr("accent"),
        logoUrl: bstr("logoUrl"),
      },
      categoryPreset: arr("categoryPreset"),
      homeCopy:
        Object.keys(hcFields).length > 0
          ? {
              title: hcFields.title?.stringValue,
              subtitle: hcFields.subtitle?.stringValue,
              dataSourceLabel: hcFields.dataSourceLabel?.stringValue,
              note: hcFields.note?.stringValue,
              featuredTitle: hcFields.featuredTitle?.stringValue,
              blogsTitle: hcFields.blogsTitle?.stringValue,
            }
          : undefined,
      painRules: decodePainRules(f),
    };

    return withDerivedCopy(cfg);
  } catch {
    // 🔴 Firestore にアクセスできなくても、必ずローカルのデフォルトで動かす
    return fallbackConfig(siteId);
  }
}

/* ===== Firestore fallback ===== */

function fallbackConfig(siteId: string): SiteConfigDoc {
  const cfg: SiteConfigDoc = {
    siteId,
    displayName: "カンガルーポスト",
    brand: { primary: "#16a34a", accent: "#0ea5e9", logoUrl: "" },
    categoryPreset: [],
    painRules: [
      {
        id: "update_is_hard",
        label: "サイト更新がめんどう・続かない",
        tags: ["サイト運営", "更新負担を減らす"],
      },
      {
        id: "no_time",
        label: "記事を書きたいけど時間がない",
        tags: ["時間がない", "自動化したい"],
      },
      {
        id: "want_result",
        label: "ゆるく続けながら、ちゃんと成果もほしい",
        tags: ["ゆるく続けたい", "成果を出したい"],
      },
    ],
  };
  return withDerivedCopy(cfg);
}

/* ===== サイトIDごとのデフォルト文言 ===== */

function withDerivedCopy(cfg: SiteConfigDoc): SiteConfigDoc {
  const id = cfg.siteId;

  const defaultsBySite: Record<
    string,
    {
      title: string;
      subtitle: string;
      featured: string;
      blogs: string;
      dataSource: string;
      note: string;
    }
  > = {
    // 🦘 カンガルーポスト（SaaS）用
    "kangaroo-post": {
      title: "記事づくりの負担を、そっと肩代わりする。",
      subtitle:
        "カンガルーポストは、サイト更新が苦手な人のための“おまかせ記事生成サービス”です。やさしい文章で、コツコツと記事を増やしていきます。",
      featured: "まず知ってほしいこと",
      blogs: "自動生成された記事一覧",
      dataSource: "このサイトで自動生成された記事",
      note: "内容はAIによる自動生成を含みますが、やさしく丁寧な文章になるよう設計しています。",
    },
    // 旧: kariraku
    kariraku: {
      title: "借りて、暮らしと引越しの負担を軽くする。",
      subtitle:
        "引越し・転勤・一人暮らしのスタートに、冷蔵庫や洗濯機を“必要な期間だけ”レンタル。",
      featured: "家電レンタル特集",
      blogs: "新着ブログ",
      dataSource: "A8.net の提携サービス",
      note: "本ページは広告を含みます。",
    },
    // 旧: workiroom
    workiroom: {
      title: "在宅ワークの悩みを、スマートに軽くする。",
      subtitle:
        "在宅ワーカーの「集中できない」「疲れやすい」「部屋が整わない」そんな小さなストレスを、ガジェットの力でラクにするサイトです。",
      featured: "デスク周りを整えるアイテム",
      blogs: "在宅ワークのヒント記事",
      dataSource: "A8.net の提携ガジェット",
      note: "本ページは広告を含みます。",
    },
    // デフォルト
    default: {
      title: "比較・最安情報をやさしく整理するメディア",
      subtitle:
        "暮らしと仕事に役立つアイテムを、やさしい視点で比較・解説するサイトです。",
      featured: "注目の特集",
      blogs: "新着ブログ",
      dataSource: "各種提携サービス",
      note: "本ページは広告を含みます。",
    },
  };

  const d = defaultsBySite[id] ?? defaultsBySite.default;
  const hc = cfg.homeCopy ?? {};
  cfg.homeCopy = {
    title: hc.title ?? d.title,
    subtitle: hc.subtitle ?? d.subtitle,
    dataSourceLabel: hc.dataSourceLabel ?? d.dataSource,
    note: hc.note ?? d.note,
    featuredTitle: hc.featuredTitle ?? d.featured,
    blogsTitle: hc.blogsTitle ?? d.blogs,
  };
  return cfg;
}

/* ===== Firestore: 最新ブログ取得 ===== */

async function fetchLatestBlogs(
  siteId: string,
  limit = 3
): Promise<BlogSummary[]> {
  try {
    const docs = await fsRunQuery({
      collection: "blogs",
      where: [
        { field: "status", value: "published" },
        { field: "siteId", value: siteId },
      ],
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      limit,
    });

    return docs.map((d) => {
      const f = d.fields as Record<string, FsValue>;
      return {
        slug: docIdFromName(d.name),
        title: vStr(f, "title") ?? "(no title)",
        summary: vStr(f, "summary") ?? "",
        imageUrl: vStr(f, "imageUrl"),
        updatedAt: vNum(f, "updatedAt") ?? 0,
      };
    });
  } catch {
    const docs = await fsRunQuery({
      collection: "blogs",
      where: [
        { field: "status", value: "published" },
        { field: "siteId", value: siteId },
      ],
      limit,
    }).catch(() => [] as FsDoc[]);

    return docs.map((d) => {
      const f = d.fields as Record<string, FsValue>;
      return {
        slug: docIdFromName(d.name),
        title: vStr(f, "title") ?? "(no title)",
        summary: vStr(f, "summary") ?? "",
        imageUrl: vStr(f, "imageUrl"),
        updatedAt: vNum(f, "updatedAt") ?? 0,
      };
    });
  }
}

/* ===== Firestore: Discover（おすすめ）記事取得 ===== */

async function fetchDiscoverBlogs(
  siteId: string,
  limit = 6
): Promise<BlogSummary[]> {
  try {
    const docs = await fsRunQuery({
      collection: "blogs",
      where: [
        { field: "status", value: "published" },
        { field: "siteId", value: siteId },
        { field: "type", value: "discover" },
      ],
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      limit,
    });

    return docs.map((d) => {
      const f = d.fields as Record<string, FsValue>;
      return {
        slug: docIdFromName(d.name),
        title: vStr(f, "title") ?? "(no title)",
        summary: vStr(f, "summary") ?? "",
        imageUrl: vStr(f, "imageUrl"),
        updatedAt: vNum(f, "updatedAt") ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/* ===== サイト別 UI 設定 ===== */

type PainCard = { title: string; body: string; href: string };

type SiteUiConfig = {
  showOfferGallery: boolean;
  heroCtaPrimary?: { href: string; label: string };
  heroCtaSecondary?: { href: string; label: string };
  painHeading: string;
  painCtaLabel: string;
  painItems: PainCard[];
};

function getSiteUiConfig(siteId: string): SiteUiConfig {
  if (siteId === "kariraku") {
    return {
      showOfferGallery: true,
      heroCtaPrimary: {
        href: "/offers?v=hero",
        label: "家電レンタルを比較する",
      },
      heroCtaSecondary: {
        href: "/blog?type=discover",
        label: "読みものから選び方を知る",
      },
      painHeading: "こんなとき、家電レンタルが役に立ちます",
      painCtaLabel: "この悩みに合うサービスを見る",
      painItems: [
        {
          title: "引越し・転勤前後の負担を軽くしたい",
          body: "数ヶ月だけ冷蔵庫や洗濯機がほしい。買っても次の部屋で使えるかわからない…そんなときに。",
          href: "/offers?scene=move",
        },
        {
          title: "初期費用をできるだけ抑えたい",
          body: "敷金・礼金・引越し料金でお金がかさむ時期に、家電だけ“月額”でなら始めやすくなります。",
          href: "/compare?theme=cost",
        },
        {
          title: "一人暮らしのスタートを身軽にしたい",
          body: "とりあえず最低限そろえて、暮らしながら必要なものを見極めたい人向けの選び方です。",
          href: "/offers?scene=single",
        },
      ],
    };
  }

  if (siteId === "workiroom") {
    return {
      showOfferGallery: false,
      heroCtaPrimary: {
        href: "/blog",
        label: "ヒント記事を読んでみる",
      },
      painHeading: "こんなとき、作業環境を見直すとラクになります",
      painCtaLabel: "この悩みに合うアイテムを見る",
      painItems: [
        {
          title: "長時間座っていると腰や肩がつらい",
          body: "在宅ワークで座りっぱなしが続くと、姿勢が崩れて腰や肩に負担がかかります。チェア周りのガジェットや健康管理ツールで、すこしだけラクにする工夫を集めています。",
          href: "/blog?tag=body-care",
        },
        {
          title: "部屋が狭くて作業スペースが作れない",
          body: "ワンルームやリビングの一角でも、折りたたみデスクや収納グッズを組み合わせることで“ミニ書斎スペース”をつくるアイデアを紹介します。",
          href: "/blog?tag=small-room",
        },
        {
          title: "家だと集中できず、ついダラダラしてしまう",
          body: "照明・タイマー・音など、集中しやすい空気をつくる小さなガジェットや、ゆるく続けられる集中のリズムをまとめています。",
          href: "/blog?tag=focus",
        },
      ],
    };
  }

  // 汎用
  return {
    showOfferGallery: false,
    heroCtaPrimary: {
      href: "/blog",
      label: "最新の記事を見る",
    },
    painHeading: "こんなとき、このサイトがお役に立てるかもしれません",
    painCtaLabel: "この悩みに合うアイテムを見る",
    painItems: [
      {
        title: "長時間座ると体がつらい",
        body: "デスクワークでの腰や肩の負担を少しでも軽くするための椅子・クッション選びをまとめています。",
        href: "/products?scene=back-pain",
      },
      {
        title: "作業スペースが散らかりがち",
        body: "モニターや小物が増えてきたときに、デスク周りを整えるための収納アイテムを紹介します。",
        href: "/products?scene=desk-organize",
      },
      {
        title: "作業に集中できる環境をつくりたい",
        body: "照明・ヘッドホン・タイマーなど、集中のスイッチを入れやすくするガジェットをピックアップしています。",
        href: "/blog?tag=focus",
      },
    ],
  };
}

/* ===== 悩みカードコンポーネント ===== */

type PainScenarioCardsProps = {
  heading: string;
  ctaLabel: string;
  items: PainCard[];
};

function PainScenarioCards({
  heading,
  ctaLabel,
  items,
}: PainScenarioCardsProps) {
  return (
    <section className="space-y-4">
      <h2 className="h2 text-base md:text-lg">{heading}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="group rounded-2xl border bg-white/60 px-4 py-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md"
          >
            <h3 className="mb-1 font-semibold leading-snug">{item.title}</h3>
            <p className="text-xs leading-relaxed text-gray-600">{item.body}</p>
            <span className="mt-2 inline-flex items-center text-xs font-semibold text-emerald-700 group-hover:underline">
              {ctaLabel}
              <span className="ml-1">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ===== ページ本体 ===== */

export default async function Page() {
  const siteId = getServerSiteId();
  const site = await loadSiteConfig(siteId);
  const ui = getSiteUiConfig(siteId);

  const [latestBlogs, discoverBlogs] = await Promise.all([
    fetchLatestBlogs(siteId, 3),
    fetchDiscoverBlogs(siteId, 6),
  ]);

  const title = site.homeCopy?.title ?? "比較・最安情報";
  const subtitle = site.homeCopy?.subtitle ?? "";
  const featuredTitle = site.homeCopy?.featuredTitle ?? "注目の特集";
  const blogsTitle = site.homeCopy?.blogsTitle ?? "新着ブログ";
  const dataSourceLabel = site.homeCopy?.dataSourceLabel ?? "";
  const note = site.homeCopy?.note ?? "";

  const discoverTitle =
    siteId === "kariraku"
      ? "暮らしに寄りそうおすすめ記事"
      : siteId === "workiroom"
      ? "在宅ワークのヒント・読みもの"
      : "おすすめの記事";

  return (
    <main className="container-kariraku space-y-8 py-10">
      <nav className="text-sm text-gray-500">
        <span className="opacity-70">ホーム</span>
      </nav>

      <header className="mb-2 space-y-2">
        <h1 className="h1">{title}</h1>
        <p className="lead">{subtitle}</p>
        <HeroBadges dataSourceLabel={dataSourceLabel} note={note} />
      </header>

      {/* 悩み → 提案ブロック */}
      <PainScenarioCards
        heading={ui.painHeading}
        ctaLabel={ui.painCtaLabel}
        items={ui.painItems}
      />

      {/* ヒーロー CTA（最大2ボタン） */}
      {(ui.heroCtaPrimary || ui.heroCtaSecondary) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {ui.heroCtaPrimary && (
            <Link href={ui.heroCtaPrimary.href} className="btn btn-brand">
              {ui.heroCtaPrimary.label}
              <span className="ml-1">→</span>
            </Link>
          )}
          {ui.heroCtaSecondary && (
            <Link href={ui.heroCtaSecondary.href} className="btn btn-ghost">
              {ui.heroCtaSecondary.label}
              <span className="ml-1">→</span>
            </Link>
          )}
        </div>
      )}

      {/* カリラクだけ：家電レンタル特集 */}
      {ui.showOfferGallery && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="h2">{featuredTitle}</h2>
            <Link href="/offers" className="text-sm underline">
              すべて見る
            </Link>
          </div>
          <OfferGallery siteId={siteId} variant="grid" limit={9} />
        </section>
      )}

      {/* Discover 記事 */}
      {discoverBlogs.length > 0 && (
        <DiscoverCarousel title={discoverTitle} items={discoverBlogs} />
      )}

      {/* 新着ブログ */}
      <BlogsSection title={blogsTitle} items={latestBlogs} />
    </main>
  );
}
