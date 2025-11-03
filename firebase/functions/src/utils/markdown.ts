// firebase/functions/src/utils/markdown.ts

/**
 * テンプレの未解決 {{...}} を含む行を削除し、
 * 連続空行や孤立した引用/見出し、重複セクション(FAQ/CTA)も整理。
 */
export function stripPlaceholders(md: string): string {
  let out = md ?? "";

  // 1) 未解決 {{...}} を含む行を丸ごと削除
  out = out.replace(/^.*\{\{[^}]+\}\}.*$/gm, "");

  // 2) 内容のない引用見出し（例: "> 競合を見る：" 単独行）を削除
  out = out.replace(/^>\s*(競合を見る|関連記事)[：: ]*\s*\n(?=\n|$)/gm, "");

  // 3) 連続空行を1つに圧縮
  out = out.replace(/\n{3,}/g, "\n\n");

  // 4) 末尾の空白/空行
  out = out.trim();

  return out;
}

/**
 * 同じ見出しセクションが複数回出たとき（例: 「## よくある質問」）に
 * 最初の1つだけ残して後続を除去する。
 */
export function dedupeSections(md: string, headings: string[]): string {
  const lines = (md ?? "").split("\n");
  const seen = new Set<string>();
  const result: string[] = [];
  let skipMode = false;
  let skipHeading = "";

  const isTargetH2 = (line: string) => {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (!m) return null;
    const title = m[1].trim();
    return headings.includes(title) ? title : null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 新しい H2 開始？
    const h = line.startsWith("## ") ? isTargetH2(line) : null;

    if (h) {
      if (seen.has(h)) {
        // 2個目以降の同名セクションはスキップON
        skipMode = true;
        skipHeading = h;
        continue;
      } else {
        seen.add(h);
        skipMode = false;
        skipHeading = "";
      }
    } else if (skipMode) {
      // 次の H2 までスキップ
      if (/^##\s+/.test(line)) {
        // 次のH2に遭遇 → スキップ解除の判定
        const h2 = isTargetH2(line);
        if (h2) {
          if (seen.has(h2)) {
            // これも既出なら、この見出し自体もスキップして継続
            continue;
          } else {
            seen.add(h2);
            skipMode = false;
            skipHeading = "";
            // ここからは出力再開
          }
        } else {
          // 別見出し名の H2 は出力再開
          skipMode = false;
          skipHeading = "";
        }
      } else {
        // セクション内容（スキップ中）
        continue;
      }
    }

    result.push(line);
  }

  const joined = result
    .join("\n")
    // 連続空行を整える
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return joined;
}

/**
 * 総合クリーンアップ：プレースホルダ除去 → 重複セクション除去
 */
export function normalizeMarkdown(md: string): string {
  let out = stripPlaceholders(md);
  // 重複しやすい代表見出し（必要なら追加）
  out = dedupeSections(out, ["よくある質問", "申込みはこちら（CTA）"]);
  return out;
}
