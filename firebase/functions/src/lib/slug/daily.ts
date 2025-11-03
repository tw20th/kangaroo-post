// firebase/functions/src/lib/slug/daily.ts

/** URL/slug 安全化（最小限・安定） */
function sanitize(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * productKey を元に “日付入り” の一意スラッグを作る。
 * 例: dailySlug("kariraku","clovertradingshop:10000018", 2025-10-26)
 *   -> "kariraku_clovertradingshop%3a10000018_20251026"
 */
export function dailySlug(
  siteId: string,
  productKey: string,
  when: Date = new Date()
): string {
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, "0");
  const d = String(when.getDate()).padStart(2, "0");
  const ymd = `${y}${m}${d}`;
  // productKey は URL セーフに（: や / を保持したままエンコード）
  const safeKey = encodeURIComponent(productKey);
  return `${sanitize(siteId)}_${safeKey}_${ymd}`;
}

/**
 * サイト単位で “その日1本だけ” のスラッグを作る（比較/ダイジェスト用途）。
 * 例: makeDailySlug("kariraku", 2025-10-26) -> "daily-kariraku-20251026"
 */
export function makeDailySlug(siteId: string, date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `daily-${sanitize(siteId)}-${y}${m}${d}`;
}
