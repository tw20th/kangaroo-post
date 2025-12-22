// エミュレータ判定（firebase-tools が必ず入れる env だけを見る）
export const IS_EMULATOR =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  process.env.FIREBASE_EMULATOR_HUB !== undefined ||
  process.env.FIRESTORE_EMULATOR_HOST !== undefined ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== undefined;

/**
 * Emulator 安全モード
 * - エミュレータなら自動で ON
 * - 本番では何もしない
 * - .env / dotenv 不要
 */
export function requireLocalSafetyMode() {
  if (!IS_EMULATOR) return;

  // エミュレータでは常に安全モード
  process.env.LOCAL_SAFETY_MODE = "true";
}

/**
 * エミュレータでは禁止したい処理用
 */
export function blockInEmulator(
  message = "This operation is blocked in emulator mode."
) {
  if (IS_EMULATOR) {
    throw new Error(message);
  }
}
