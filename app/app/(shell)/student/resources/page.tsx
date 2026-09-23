import { redirect } from "next/navigation";
import { canAccessStudent, homeFor } from "@/lib/nav";
import { getSessionUser } from "@/lib/server/session";
import { StudentResourceCenter } from "@/components/school-resources/StudentResourceCenter";

export default async function StudentResourcesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?from=%2Fstudent%2Fresources");
  if (!canAccessStudent(user.role)) redirect(homeFor(user.role));
  return <StudentResourceCenter key={`${user.id}:${user.sessionVersion}`} accountId={user.id} />;
}
