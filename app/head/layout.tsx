import { requireHead } from "@/lib/dal";
import { AdminShell } from "../admin/_components/admin-shell";

// Server-side auth gate for the Trưởng bộ môn area. Proxy redirects
// unauthenticated requests; requireHead bounces non-heads and enforces that the
// account is scoped to a bộ môn (its scope is read authoritatively from the DB).
export default async function HeadLayout({ children }: { children: React.ReactNode }) {
  const user = await requireHead();
  return (
    <AdminShell username={user.username} variant="head">
      {children}
    </AdminShell>
  );
}
