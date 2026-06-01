import { requireManager } from "@/lib/dal";
import { AdminShell } from "./_components/admin-shell";

// Server-side auth gate for the whole manager area. Proxy already redirects
// unauthenticated requests; this enforces the manager role authoritatively
// (lecturers are bounced to /me by requireManager).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireManager();
  return <AdminShell username={user.username}>{children}</AdminShell>;
}
