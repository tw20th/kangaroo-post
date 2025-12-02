// apps/web/app/api/admin/companies/route.ts
// 企業マスタ一覧を返す API

import { NextResponse } from "next/server";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  orderBy,
  query,
  type Firestore,
} from "firebase/firestore";

type CompanyItem = {
  id: string;
  displayName: string;
};

// ---- このファイル専用の Firebase 初期化 ----
let appSingleton: FirebaseApp | null = null;
let dbSingleton: Firestore | null = null;

function getDb(): Firestore {
  if (dbSingleton) return dbSingleton;

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  };

  const apps = getApps();
  appSingleton =
    apps.length > 0 ? apps[0] : initializeApp(firebaseConfig as any);

  dbSingleton = getFirestore(appSingleton);
  return dbSingleton;
}

// ---- GET /api/admin/companies ----
export async function GET() {
  try {
    const db = getDb();

    const q = query(collection(db, "companies"), orderBy("displayName", "asc"));

    const snap = await getDocs(q);

    const companies: CompanyItem[] = snap.docs.map((doc) => {
      const data = doc.data() as { displayName?: string };
      return {
        id: doc.id,
        displayName: data.displayName ?? "",
      };
    });

    return NextResponse.json({ companies });
  } catch (err) {
    console.error("[SiteCompanies] loadCompanies error", err);
    return NextResponse.json(
      { error: "failed_to_load_companies" },
      { status: 500 }
    );
  }
}
