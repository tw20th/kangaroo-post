import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebaseClient";

/**
 * Firebase Auth が「復元完了」するまで待つ。
 * - ログイン済みでも、ページ直後は currentUser が null の瞬間があるのでそれを吸収する
 * - ログインしていない場合でも「準備完了」として resolve する（= null が確定した）
 */
export function waitForAuthReady(): Promise<void> {
  const auth = getClientAuth();

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      unsubscribe();
      resolve();
    });
  });
}
