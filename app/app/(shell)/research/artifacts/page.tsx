import { ArtifactWorkspace } from "@/components/research/artifact-workspace/ArtifactWorkspace";
import { ResearchIdentityBoundary } from "@/components/research/workspace-shared";

export default function ResearchArtifactsPage() {
  return <ResearchIdentityBoundary><ArtifactWorkspace /></ResearchIdentityBoundary>;
}
