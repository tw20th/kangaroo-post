// apps/web/app/api/workspaces/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getOptionalUser } from "@/lib/auth/server";
import { getServerSiteId } from "@/lib/site-server";
import { encryptWorkspaceSecret } from "@/lib/crypto/workspaceSecret";

export const dynamic = "force-dynamic";

type WorkspaceDoc = {
  ownerUserId: string;
  siteId: string;

  siteName: string;
  topUrl: string;

  blogSectionLabel?: string;
  blogSectionSlug: string;

  widgetEnabled?: boolean;
  widgetLimit?: number;

  industry?: string;
  keywordPreferences?: string;

  wpUrl?: string;
  wpUser?: string;

  // ✅ 平文は保存しない
  wpAppPasswordEncrypted?: string;

  status: "active" | "inactive";
  createdAt: number;
  updatedAt: number;
};

type WorkspaceUpsertBody = {
  siteName: string;
  topUrl: string;
  blogSectionLabel?: string;
  blogSectionSlug: string;
  widgetEnabled?: boolean;
  widgetLimit?: number;
  industry?: string;
  keywordPreferences?: string;

  wpUrl?: string;
  wpUser?: string;

  // フロントからは平文が来る（保存時のみ）
  wpAppPassword?: string;
};

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return Object.fromEntries(entries) as T;
}

function toApiWorkspace(id: string, data: WorkspaceDoc) {
  const hasPw =
    typeof data.wpAppPasswordEncrypted === "string" &&
    data.wpAppPasswordEncrypted.length > 0;

  // ✅ パスワードは絶対に返さない
  return {
    id,
    ...data,
    wpAppPassword: "",
    wpAppPasswordSet: hasPw,
  };
}

async function getMyWorkspaceDoc(uid: string, siteId: string) {
  const bySiteSnap = await adminDb
    .collection("workspaces")
    .where("ownerUserId", "==", uid)
    .where("siteId", "==", siteId)
    .limit(1)
    .get();

  const bySiteDoc = bySiteSnap.docs[0];
  if (bySiteDoc) {
    return { id: bySiteDoc.id, ...(bySiteDoc.data() as WorkspaceDoc) };
  }

  const legacySnap = await adminDb
    .collection("workspaces")
    .where("ownerUserId", "==", uid)
    .limit(1)
    .get();

  const legacyDoc = legacySnap.docs[0];
  if (!legacyDoc) return null;

  const legacyData = legacyDoc.data() as WorkspaceDoc;

  if (!("siteId" in legacyData) || legacyData.siteId !== siteId) {
    await adminDb
      .collection("workspaces")
      .doc(legacyDoc.id)
      .set({ siteId, updatedAt: Date.now() }, { merge: true });
  }

  return { id: legacyDoc.id, ...(legacyData as WorkspaceDoc), siteId };
}

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const siteId = getServerSiteId();
    const body = (await req
      .json()
      .catch(() => null)) as WorkspaceUpsertBody | null;

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "bad_request" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const existing = await getMyWorkspaceDoc(user.uid, siteId);

    // ✅ pw は「入力がある時だけ」暗号化して保存
    const pw =
      typeof body.wpAppPassword === "string" ? body.wpAppPassword.trim() : "";
    const wpAppPasswordEncrypted =
      pw.length > 0 ? encryptWorkspaceSecret(pw) : undefined;

    const base: WorkspaceDoc = {
      ownerUserId: user.uid,
      siteId,

      siteName: body.siteName,
      topUrl: body.topUrl,
      blogSectionLabel: body.blogSectionLabel,
      blogSectionSlug: body.blogSectionSlug,

      widgetEnabled: body.widgetEnabled,
      widgetLimit: body.widgetLimit,

      industry: body.industry,
      keywordPreferences: body.keywordPreferences,

      wpUrl: body.wpUrl,
      wpUser: body.wpUser,
      wpAppPasswordEncrypted,

      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const data = stripUndefined(base);

    if (!existing) {
      const ref = await adminDb.collection("workspaces").add(data);
      const snap = await ref.get();
      const saved = snap.data() as WorkspaceDoc;

      return NextResponse.json({
        ok: true,
        workspace: toApiWorkspace(ref.id, saved),
      });
    }

    // ✅ pw未入力なら wpAppPasswordEncrypted は undefined → stripUndefinedで更新されない（保持）
    await adminDb
      .collection("workspaces")
      .doc(existing.id)
      .set(data, { merge: true });

    const latest = (
      await adminDb.collection("workspaces").doc(existing.id).get()
    ).data() as WorkspaceDoc;

    return NextResponse.json({
      ok: true,
      workspace: toApiWorkspace(existing.id, latest),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[api/workspaces][POST] error:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  const body = (await req
    .json()
    .catch(() => null)) as Partial<WorkspaceUpsertBody> | null;
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const ref = adminDb.collection("workspaces").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ ok: false }, { status: 404 });

  const current = snap.data() as WorkspaceDoc;
  if (current.ownerUserId !== user.uid) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const patch: Partial<WorkspaceDoc> = {
    updatedAt: Date.now(),
  };

  if (typeof body.siteName === "string") patch.siteName = body.siteName;
  if (typeof body.topUrl === "string") patch.topUrl = body.topUrl;
  if (typeof body.blogSectionLabel === "string")
    patch.blogSectionLabel = body.blogSectionLabel;
  if (typeof body.blogSectionSlug === "string")
    patch.blogSectionSlug = body.blogSectionSlug;

  if (typeof body.widgetEnabled === "boolean")
    patch.widgetEnabled = body.widgetEnabled;
  if (typeof body.widgetLimit === "number")
    patch.widgetLimit = body.widgetLimit;

  if (typeof body.industry === "string") patch.industry = body.industry;
  if (typeof body.keywordPreferences === "string")
    patch.keywordPreferences = body.keywordPreferences;

  if (typeof body.wpUrl === "string") patch.wpUrl = body.wpUrl;
  if (typeof body.wpUser === "string") patch.wpUser = body.wpUser;

  // ✅ pw は「入力がある時だけ更新」（空文字は“更新しない”扱い）
  if (typeof body.wpAppPassword === "string") {
    const pw = body.wpAppPassword.trim();
    if (pw.length > 0) {
      patch.wpAppPasswordEncrypted = encryptWorkspaceSecret(pw);
    }
  }

  await ref.set(stripUndefined(patch as Record<string, unknown>), {
    merge: true,
  });

  const updated = (await ref.get()).data() as WorkspaceDoc;
  return NextResponse.json({
    ok: true,
    workspace: toApiWorkspace(id, updated),
  });
}

export async function GET(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const siteId = getServerSiteId();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const ref = adminDb.collection("workspaces").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json(
          { ok: false, error: "not_found" },
          { status: 404 }
        );
      }

      const data = snap.data() as WorkspaceDoc;
      if (data.ownerUserId !== user.uid) {
        return NextResponse.json(
          { ok: false, error: "forbidden" },
          { status: 403 }
        );
      }

      return NextResponse.json({
        ok: true,
        workspace: toApiWorkspace(snap.id, data),
      });
    }

    const me = await getMyWorkspaceDoc(user.uid, siteId);
    if (!me) return NextResponse.json({ ok: true, workspace: null });

    const { id: meId, ...rest } = me as { id: string } & WorkspaceDoc;
    return NextResponse.json({
      ok: true,
      workspace: toApiWorkspace(meId, rest),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[api/workspaces][GET] error:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
