// apps/web/utils/markdown.ts
/**
 * 記事テキストのクイック整形
 * - 先頭/末尾の ```markdown フェンスを剥がす
 * - A8の入れ子バナー [![広告バナー](img)](url "…") を CTA に変換
 * - [広告バナー](url "…") も CTA に
 * - A8系の画像(![](...))を全面除去
 * - ・ を Markdown 箇条書きに / 全角番号リスト→半角に
 * - 連続空行圧縮
 */
export function normalizeBlogMarkdown(src: string): string {
  let s = src ?? "";

  // ```markdown ～ ``` で全体を囲っている場合は中身だけ取り出す
  s = s.replace(
    /^```(?:\s*markdown)?\s*\r?\n([\s\S]*?)\r?\n```$/i,
    (_m, inner: string) => inner
  );

  // A8入れ子バナー [![広告バナー](img)](URL "title")
  s = s.replace(
    /\[\!\[広告バナー\]\((?:https?:\/\/[^\s)]+)\)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/gi,
    (_m, url: string) => `\n\n:::cta[公式サイトへ](${url})\n\n`
  );

  // シンプルな [広告バナー](URL "title")
  s = s.replace(
    /\[広告バナー\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/gi,
    (_m, url: string) => `\n\n:::cta[公式サイトへ](${url})\n\n`
  );

  // A8系の画像(![](...))は削除（www*.a8.net / px.a8.net など）
  s = s.replace(
    /!\[[^\]]*]\((https?:\/\/(?:www\d*\.)?a8\.net\/[^\s)]+|https?:\/\/px\.a8\.net\/[^\s)]+)\)/gi,
    ""
  );

  // ・をMarkdown箇条書きへ
  s = s.replace(/^\s*・/gm, "- ");

  // 全角数字 ０-９ を半角にして「１．」→「1. 」
  s = s.replace(/^\s*[０-９]+．/gm, (m) => {
    const half = m
      .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
      .replace("．", ". ");
    return half;
  });

  // 余分な空行を圧縮
  s = s.replace(/\n{3,}/g, "\n\n");

  // 余りがちな "nofollow" 単独のリンク断片を除去
  s = s.replace(/\)\s*"nofollow"\)?/g, ")");

  // 不完全な CTA 残骸（例: ":::cta公式サイトへ" / ":::cta" だけの行）を除去
  s = s.replace(/^\s*:::+\s*cta[^\[\(]*$/gim, "");

  // もし ":::cta ラベル (URL)" のようなスペース区切りが来たら救済（まれに発生）
  s = s.replace(
    /^\s*:::+\s*cta\s+([^\(\[\r\n]+?)\s*\(\s*(https?:\/\/[^\s)]+)\s*\)\s*$/gim,
    (_m, label: string, url: string) =>
      `\n\n:::cta[${label.trim()}](${url})\n\n`
  );

  return s.trim();
}

/** 目次用：h2/h3 を抽出（normalize 後の Markdown を渡してください） */
export function extractToc(
  md: string
): { level: 2 | 3; text: string; id: string }[] {
  const items: { level: 2 | 3; text: string; id: string }[] = [];
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\u3000-\u9fff-]+/g, " ")
      .trim()
      .replace(/\s+/g, "-");

  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^(#{2,3})\s+(.*)$/);
    if (m) {
      items.push({
        level: m[1].length === 2 ? 2 : 3,
        text: m[2].trim(),
        id: slugify(m[2].trim()),
      });
    }
  }
  return items;
}

// A8判定(画像URLなど用)
export const isA8Url = (u?: string) =>
  !!u && /(\/\/(?:www\d*\.)?a8\.net\/|\/\/px\.a8\.net\/)/i.test(u);
