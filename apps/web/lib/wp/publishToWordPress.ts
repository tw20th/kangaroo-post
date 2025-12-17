// apps/web/lib/wp/publishToWordPress.ts
import "server-only";

type PublishArgs = {
  wpUrl: string;
  wpUser: string;
  wpAppPassword: string;

  title: string;
  content: string;

  /** "publish" or "draft" */
  status: "publish" | "draft";

  /** 任意：WPに渡したい場合 */
  slug?: string;
};

type WpPostResponse = {
  id: number;
  link: string;
  status: string;
};

function normalizeWpBaseUrl(url: string): string {
  // 末尾の / を削る
  const u = url.trim().replace(/\/+$/, "");
  if (!u) throw new Error("wpUrl is empty");
  return u;
}

function toBasicAuth(user: string, appPassword: string): string {
  // WP Application Password はスペースが入ることがある（表示上）
  // 実体はそのままでも通るが、念のため trim だけ
  const token = Buffer.from(`${user}:${appPassword.trim()}`, "utf8").toString(
    "base64"
  );
  return `Basic ${token}`;
}

export async function publishToWordPress(
  args: PublishArgs
): Promise<WpPostResponse> {
  const base = normalizeWpBaseUrl(args.wpUrl);

  // WP REST: /wp-json/wp/v2/posts
  const endpoint = `${base}/wp-json/wp/v2/posts`;

  const payload: Record<string, unknown> = {
    title: args.title,
    content: args.content,
    status: args.status,
  };

  if (typeof args.slug === "string" && args.slug.trim().length > 0) {
    payload.slug = args.slug.trim();
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: toBasicAuth(args.wpUser, args.wpAppPassword),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    // WPのエラー本文がJSONのこともあるが、まずは text で安全に出す
    const snippet = text.length > 600 ? `${text.slice(0, 600)}...` : text;
    throw new Error(
      `WordPress API error (${res.status}): ${snippet || "empty response"}`
    );
  }

  // 成功時の JSON
  const json = JSON.parse(text) as Partial<WpPostResponse> & {
    id?: unknown;
    link?: unknown;
    status?: unknown;
  };

  if (typeof json.id !== "number") {
    throw new Error("WordPress response missing id");
  }

  const link = typeof json.link === "string" ? json.link : "";
  const status = typeof json.status === "string" ? json.status : "unknown";

  return { id: json.id, link, status };
}
