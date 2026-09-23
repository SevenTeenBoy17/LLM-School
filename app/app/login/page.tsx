import { LoginClient } from "./LoginClient";

type LoginPageProps = {
  searchParams: Promise<{ from?: string | string[] }>;
};

function safeReturnPath(value: string | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/login" || value.startsWith("/login?")) return null;
  if (value.startsWith("/api/")) return null;
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { from } = await searchParams;
  const returnPath = safeReturnPath(Array.isArray(from) ? from[0] : from);

  return <LoginClient returnPath={returnPath} />;
}
