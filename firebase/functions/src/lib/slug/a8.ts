// 外部依存なしユーティリティ

function safe(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(
      /[^a-z0-9\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\-_.~]+/giu,
      "-"
    )
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatYmd(ts?: number): string {
  const d = ts ? new Date(ts) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** 短い一意ID（djb2ベース8桁hex） */
function hash8(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  // >>> 0 でunsigned化、toString(16) でhex、padStartで8固定
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** A8系ブログ用の一意slug: a8-<siteId>-<h8>-<YYYYMMDD>[-title40] */
export function a8BlogSlug(
  siteId: string,
  offerId: string,
  title?: string,
  ts?: number
) {
  const ymd = formatYmd(ts);
  const h8 = hash8(`${siteId}:${offerId}`);
  const base = `a8-${safe(siteId)}-${h8}-${ymd}`;
  if (title) {
    const tail = safe(title).slice(0, 40);
    if (tail) return `${base}-${tail}`;
  }
  return base;
}
