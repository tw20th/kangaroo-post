// apps/web/utils/markdown.ts

/**
 * 記事テキストのクイック整形
 * - 先頭/末尾の ```markdown フェンスを剥がす
 * - 先頭の "markdown " という接頭辞を削除
 * - A8の入れ子バナー [![広告バナー](img)](url "…") を CTA に変換
 * - [広告バナー](url "…") も CTA に
 * - A8系の画像(![](...))を全面除去
 * - ・ を Markdown 箇条書きに / 全角番号リスト→半角に
 * - [[pain tag="..." text="..."]] を :::pain[...] に変換
 * - 「メタ情報（そのまま出力）」セクションを本文から削除
 * - 連続空行圧縮 など
 */
export function normalizeBlogMarkdown(src: string): string {
  let s = src ?? "";

  // 1) 先頭に "markdown " って付いてきた場合は削る
  s = s.replace(/^markdown\s+/i, "");

  // 2) ```markdown ～ ``` で全体を囲っている場合は中身だけ取り出す
  //    （言語指定なしの ``` ～ ``` も含めて剥がす）
  const fenced = s.match(/^```[^\n]*\n([\s\S]*?)\n```$/i);
  if (fenced && fenced[1]) {
    s = fenced[1];
  }

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

  // ★ ここまでは既存どおり。テーブル区切り行を消していた処理は削除！
  // （本物のMarkdown表も壊れるので）

  // [[pain tag="腰痛" text="腰の負担を減らす椅子を探す"]] → :::pain[腰の負担を減らす椅子を探す](腰痛)
  s = s.replace(
    /\[\[\s*pain\s+tag="([^"]+)"\s+text="([^"]+)"\s*\]\]/gi,
    (_m, tag: string, text: string) => `\n\n:::pain[${text}](${tag})\n\n`
  );

  // 「メタ情報（そのまま出力）」セクションは本文から丸ごと削る
  // compare 記事専用想定
  s = s.replace(/#{2,3}\s*メタ情報（そのまま出力）[\s\S]*$/m, "");

  // 余分な空行を圧縮
  s = s.replace(/\n{3,}/g, "\n\n");

  // 余りがちな "nofollow" 単独のリンク断片を除去
  s = s.replace(/\)\s*"nofollow"\)?/g, ")");

  // 不完全な CTA 残骸（例: ":::cta公式サイトへ" / ":::cta" だけの行）を除去
  s = s.replace(/^\s*:::+\s*cta[^\[\(]*$/gim, "");

  // 不完全な pain 残骸も除去
  s = s.replace(/^\s*:::+\s*pain[^\[\(]*$/gim, "");

  // もし ":::cta ラベル (URL)" のようなスペース区切りが来たら救済
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
