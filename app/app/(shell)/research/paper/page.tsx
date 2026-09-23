import { PaperStudio } from "@/components/paper/PaperStudio";
import { getSessionUser } from "@/lib/server/session";
import { redirect } from "next/navigation";

export default async function ResearchPaperPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <PaperStudio ownerId={`${user.id}:${user.sessionVersion}`} />;
}
