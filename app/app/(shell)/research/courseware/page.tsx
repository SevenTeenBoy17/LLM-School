import { redirect } from "next/navigation";
import { CoursewareStudio } from "@/components/courseware/CoursewareStudio";
import { canAccessCourseware, homeFor } from "@/lib/nav";
import { getSessionUser } from "@/lib/server/session";

export default async function CoursewarePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?from=%2Fresearch%2Fcourseware");
  if (!canAccessCourseware(user.role)) redirect(homeFor(user.role));
  return <CoursewareStudio />;
}

