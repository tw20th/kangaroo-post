// apps/web/lib/auth/server.ts
import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

export const SESSION_COOKIE_NAME = "kp_session";

export type SessionUser = {
  uid: string;
  email?: string;
};

const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

export async function getOptionalUser(): Promise<SessionUser | null> {
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;

  try {
    if (useEmulator) {
      // ✅ Emulator時: cookie は idToken として扱う
      const decoded = await adminAuth.verifyIdToken(session);
      return { uid: decoded.uid, email: decoded.email ?? undefined };
    }

    // ✅ 本番時: cookie は session cookie
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return { uid: decoded.uid, email: decoded.email ?? undefined };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
