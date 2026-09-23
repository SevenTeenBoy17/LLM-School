export type SchoolResourceIconName = "library" | "upload" | "slides" | "lesson" | "worksheet" | "folder" | "activity" | "media";

export function SchoolResourceIcon({ name, size = 40, className = "" }: {
  name: SchoolResourceIconName; size?: number; className?: string;
}) {
  return <span aria-hidden="true" className={className} style={{
    display: "inline-block", width: size, height: size, flexShrink: 0,
    background: `url(/art/school-resources/${name}.webp) center / contain no-repeat`,
  }} />;
}
