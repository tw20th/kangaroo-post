// firebase/functions/src/scripts/tools/setAdminClaim.ts
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// 🔧 Firebase Admin の初期化
if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
    // 🔴 ここが超重要：Firebase のプロジェクトIDを明示
    projectId: "a8-affiliate-a2489",
  });
}

async function main() {
  // ✅ Firebase Authentication の「ユーザー」一覧でコピーした UID を貼る
  const adminUid = "B6gAnMXikWhxofzChmOdBQoh9aY2";

  await getAuth().setCustomUserClaims(adminUid, { isAdmin: true });

  console.log(`✅ Set isAdmin=true to user: ${adminUid}`);
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
