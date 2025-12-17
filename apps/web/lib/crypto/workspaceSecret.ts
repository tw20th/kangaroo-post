// apps/web/lib/crypto/workspaceSecret.ts
import "server-only";
import crypto from "node:crypto";

const ENV_KEY = process.env.WORKSPACE_SECRET_KEY;

function getKey(): Buffer {
  if (!ENV_KEY) {
    throw new Error("Missing env: WORKSPACE_SECRET_KEY");
  }
  return crypto.createHash("sha256").update(ENV_KEY).digest();
}

/** Workspace 用：平文 → 暗号文字列 */
export function encryptWorkspaceSecret(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

/** Workspace 用：暗号文字列 → 平文（サーバー専用） */
export function decryptWorkspaceSecret(payload: string): string {
  const key = getKey();
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

  return decrypted.toString("utf8");
}
