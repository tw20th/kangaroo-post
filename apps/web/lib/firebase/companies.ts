// apps/web/lib/firebase/companies.ts

import type { Firestore } from "firebase/firestore";
import { getDb, getFs } from "@/lib/firebase";
import type { Company, CompanyUrl, CompanyUrlType } from "@/types/company";

const COLLECTION_NAME = "companies";

function getClientDb(): Firestore {
  const db = getDb();
  if (!db) {
    throw new Error("Firestore client is not available (browser only)");
  }
  return db;
}

function mapUrlsFromFirestore(raw: unknown): CompanyUrl[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const obj = item as {
        type?: CompanyUrlType;
        label?: string;
        url?: string;
      };

      if (!obj.url) return null;

      return {
        id: `${obj.type ?? "other"}-${obj.url}`,
        type: obj.type ?? "other",
        label: obj.label ?? "",
        url: obj.url,
      };
    })
    .filter((u): u is CompanyUrl => u !== null);
}

function mapUrlsToFirestore(urls: CompanyUrl[]): {
  type: CompanyUrlType;
  label: string;
  url: string;
}[] {
  return urls.map((u) => ({
    type: u.type,
    label: u.label,
    url: u.url,
  }));
}

export async function fetchCompanies(): Promise<Company[]> {
  const db = getClientDb();
  const { collection, getDocs } = getFs();

  const snap = await getDocs(collection(db, COLLECTION_NAME));

  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as {
      displayName?: string;
      brandName?: string;
      officialUrl?: string;
      logoUrl?: string;
      groupType?: "manufacturer" | "retailer" | "platform" | "other";
      listed?: boolean;
      notes?: string;
      urls?: unknown;
    };

    return {
      id: docSnap.id,
      displayName: data.displayName ?? "",
      brandName: data.brandName,
      officialUrl: data.officialUrl ?? "",
      logoUrl: data.logoUrl,
      groupType: data.groupType,
      listed: data.listed ?? false,
      notes: data.notes,
      urls: mapUrlsFromFirestore(data.urls),
    };
  });
}

export async function createCompany(input: Company): Promise<void> {
  const db = getClientDb();
  const { doc, setDoc, serverTimestamp } = getFs();

  const { id, ...rest } = input;

  const payload = {
    ...rest,
    urls: mapUrlsToFirestore(rest.urls),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTION_NAME, id), payload, { merge: false });
}

export async function updateCompany(input: Company): Promise<void> {
  const db = getClientDb();
  const { doc, updateDoc, serverTimestamp } = getFs();

  const { id, ...rest } = input;

  const payload = {
    ...rest,
    urls: mapUrlsToFirestore(rest.urls),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, COLLECTION_NAME, id), payload);
}
