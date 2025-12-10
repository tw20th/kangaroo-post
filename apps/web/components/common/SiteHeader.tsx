// apps/web/components/common/SiteHeader.tsx
import Link from "next/link";
import { getSiteEntry } from "@/lib/site-server";

type NavItem = {
  href: string;
  label: string;
};

type SiteEntryLike = {
  id?: string;
  siteId?: string;
  displayName: string;
};

function getNavItems(siteId: string): NavItem[] {
  switch (siteId) {
    case "kangaroo-post":
      return [
        { href: "/blog", label: "ブログ" },
        { href: "/dashboard", label: "ダッシュボード" },
      ];

    case "kariraku":
      return [
        { href: "/offers", label: "家電レンタル" },
        { href: "/blog", label: "悩みガイド" },
      ];

    case "workiroom":
      return [
        { href: "/offers", label: "在宅ワークアイテム" },
        { href: "/blog", label: "ヒント記事" },
      ];

    case "hadasmooth":
      return [
        { href: "/offers", label: "医療脱毛クリニック" },
        { href: "/blog", label: "悩みガイド" },
      ];

    // ★ 新規 2 サイト
    case "weblabo":
      return [
        { href: "/offers", label: "Webサービス比較" },
        { href: "/blog", label: "ノウハウ記事" },
      ];

    case "joblabo":
      return [
        { href: "/offers", label: "転職エージェント" },
        { href: "/blog", label: "キャリアガイド" },
      ];

    default:
      return [
        { href: "/offers", label: "サービス一覧" },
        { href: "/blog", label: "ブログ" },
      ];
  }
}

export default function SiteHeader() {
  const raw = getSiteEntry() as SiteEntryLike;
  const siteId = raw.siteId ?? raw.id ?? "default";
  const siteName = raw.displayName;

  const navItems = getNavItems(siteId);

  return (
    <header className="border-b border-black/5 bg-white/70 backdrop-blur-sm">
      <div className="container-kariraku flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-brand-600" />
          <span className="font-semibold tracking-tight">{siteName}</span>
        </Link>

        <nav className="text-sm">
          <ul className="flex items-center gap-5">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
