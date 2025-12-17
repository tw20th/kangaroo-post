// apps/web/app/api/auth/session/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/server";

type SessionPostBody = {
  idToken?: string;
};

const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

export async function GET() {
  try {
    const { cookies } = await import("next/headers");
    const cookieValue = cookies().get(SESSION_COOKIE_NAME)?.value;

    if (!cookieValue) {
      return NextResponse.json({ ok: false, signedIn: false }, { status: 401 });
    }

    if (useEmulator) {
      // ✅ Emulator時: cookieValue は「idToken」
      const decoded = await adminAuth.verifyIdToken(cookieValue);

      return NextResponse.json({
        ok: true,
        signedIn: true,
        uid: decoded.uid,
        email: typeof decoded.email === "string" ? decoded.email : undefined,
        emulator: true,
      });
    }

    // ✅ 本番時: cookieValue は「session cookie」
    const decoded = await adminAuth.verifySessionCookie(cookieValue, true);

    return NextResponse.json({
      ok: true,
      signedIn: true,
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
    });
  } catch {
    return NextResponse.json({ ok: false, signedIn: false }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as SessionPostBody | null;
    const idToken = body?.idToken;

    if (!idToken) {
      return NextResponse.json(
        { ok: false, error: "idToken is required" },
        { status: 400 }
      );
    }

    // 14日（必要なら短くしてOK）
    const expiresIn = 14 * 24 * 60 * 60 * 1000;

    const res = NextResponse.json({ ok: true, emulator: useEmulator });

    if (useEmulator) {
      // ✅ Emulator時: session cookie を作らず、idToken を cookie に保存
      res.cookies.set(SESSION_COOKIE_NAME, idToken, {
        httpOnly: true,
        secure: false, // ローカル前提
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(expiresIn / 1000),
      });
      return res;
    }

    // ✅ 本番時: session cookie を作る
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    res.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });

    return res;
  } catch (e) {
    console.error("[auth/session] Failed to create session:", e); // ←ここが重要（stack含む）
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
