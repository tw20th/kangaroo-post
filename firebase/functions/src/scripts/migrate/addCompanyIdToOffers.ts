// firebase/functions/src/scripts/migrate/addCompanyIdToOffers.ts
/* eslint-disable no-console */

import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

function getDb(): Firestore {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
    });
  }
  return getFirestore();
}

async function main(): Promise<void> {
  const db = getDb();

  console.log("=== addCompanyIdToOffers: start ===");

  const snapshot = await db.collection("offers").get();
  console.log(`found ${snapshot.size} offers`);

  let updatedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as { companyId?: unknown };

    // すでに companyId があるものはスキップ
    if (typeof data.companyId !== "undefined") {
      continue;
    }

    await docSnap.ref.update({
      companyId: null,
    });

    updatedCount += 1;
    if (updatedCount % 50 === 0) {
      console.log(`  updated ${updatedCount} offers...`);
    }
  }

  console.log(`=== addCompanyIdToOffers: done (updated: ${updatedCount}) ===`);
}

// ESM なので top-level で実行
void main().then(
  () => {
    console.log("success");
    process.exit(0);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
