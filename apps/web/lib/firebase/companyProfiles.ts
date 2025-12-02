// apps/web/lib/firebase/companyProfiles.ts

import type { Firestore } from "firebase/firestore";
import { getDb, getFs, numOrTsToNumber } from "@/lib/firebase";
import type { CompanyProfile } from "@/types/company";

const COLLECTION_PATH = "sites"; // sites/{siteId}/companyProfiles/{companyId}

function getClientDb(): Firestore {
  const db = getDb();
  if (!db) {
    throw new Error("Firestore client is not available (browser only)");
  }
  return db;
}

export async function fetchCompanyProfiles(
  siteId: string
): Promise<CompanyProfile[]> {
  const db = getClientDb();
  const { collection, getDocs } = getFs();

  const colRef = collection(db, `${COLLECTION_PATH}/${siteId}/companyProfiles`);

  const snap = await getDocs(colRef);

  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as {
      siteId?: string;
      companyId?: string;
      vertical?: string;
      targetUsers?: string[];
      strengths?: string[];
      weaknesses?: string[];
      shippingSpeed?: string;
      areas?: string;
      cancellationPolicy?: string;
      importantNotes?: string[];
      createdAt?: unknown;
      updatedAt?: unknown;
    };

    const profile: CompanyProfile = {
      id: docSnap.id,
      siteId: data.siteId ?? siteId,
      companyId: data.companyId ?? docSnap.id,
      vertical: data.vertical ?? "rental",
      targetUsers: Array.isArray(data.targetUsers) ? data.targetUsers : [],
      strengths: Array.isArray(data.strengths) ? data.strengths : [],
      weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
      shippingSpeed: data.shippingSpeed,
      areas: data.areas,
      cancellationPolicy: data.cancellationPolicy,
      importantNotes: Array.isArray(data.importantNotes)
        ? data.importantNotes
        : [],
    };

    // createdAt/updatedAt は今は使わないけど、欲しくなったらここで numOrTsToNumber を適用する

    void numOrTsToNumber(data.createdAt);
    void numOrTsToNumber(data.updatedAt);

    return profile;
  });
}

export async function fetchCompanyProfile(
  siteId: string,
  companyId: string
): Promise<CompanyProfile | null> {
  const db = getClientDb();
  const { doc, getDoc } = getFs();

  const docRef = doc(
    db,
    `${COLLECTION_PATH}/${siteId}/companyProfiles/${companyId}`
  );
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;

  const data = snap.data() as {
    siteId?: string;
    companyId?: string;
    vertical?: string;
    targetUsers?: string[];
    strengths?: string[];
    weaknesses?: string[];
    shippingSpeed?: string;
    areas?: string;
    cancellationPolicy?: string;
    importantNotes?: string[];
    createdAt?: unknown;
    updatedAt?: unknown;
  };

  const profile: CompanyProfile = {
    id: snap.id,
    siteId: data.siteId ?? siteId,
    companyId: data.companyId ?? snap.id,
    vertical: data.vertical ?? "rental",
    targetUsers: Array.isArray(data.targetUsers) ? data.targetUsers : [],
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
    shippingSpeed: data.shippingSpeed,
    areas: data.areas,
    cancellationPolicy: data.cancellationPolicy,
    importantNotes: Array.isArray(data.importantNotes)
      ? data.importantNotes
      : [],
  };

  void numOrTsToNumber(data.createdAt);
  void numOrTsToNumber(data.updatedAt);

  return profile;
}

export async function saveCompanyProfile(
  profile: CompanyProfile
): Promise<void> {
  const db = getClientDb();
  const { doc, setDoc, serverTimestamp } = getFs();

  const { id, ...rest } = profile;

  const docRef = doc(
    db,
    `${COLLECTION_PATH}/${profile.siteId}/companyProfiles/${id}`
  );

  const payload = {
    ...rest,
    siteId: profile.siteId,
    companyId: profile.companyId,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(docRef, payload, { merge: true });
}
