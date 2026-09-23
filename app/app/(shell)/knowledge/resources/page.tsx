import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { canAccessSchoolResources, homeFor } from "@/lib/nav";
import { SchoolResourceLibrary } from "@/components/school-resources/SchoolResourceLibrary";

export default async function SchoolResourcesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?from=%2Fknowledge%2Fresources");
  if (!canAccessSchoolResources(user.role)) redirect(homeFor(user.role));
  return <SchoolResourceLibrary key={`${user.id}:${user.sessionVersion}`} accountId={user.id} author={user.name} />;
}
