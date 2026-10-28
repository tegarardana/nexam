import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const roles = session.user.roles;
  if (roles.includes("administrator")) {
    redirect("/admin");
  } else if (roles.includes("teacher")) {
    redirect("/teacher");
  } else {
    redirect("/student");
  }
}
