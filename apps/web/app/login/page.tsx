// apps/web/app/login/page.tsx
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth/server";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) redirect("/dashboard");

  return <LoginClient />;
}
