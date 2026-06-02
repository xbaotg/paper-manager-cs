import { requireAdminArea } from "@/lib/dal";
import { AdminShell } from "./_components/admin-shell";

// Server-side auth gate for the whole admin area. Proxy already redirects
// unauthenticated requests; this enforces admin capability authoritatively
// (non-admins are bounced home). A dual-capable user (lecturer promoted to
// admin) viewing in "user" mode is sent to /me by requireAdminArea; if they're
// here they can switch back to their self-view.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminArea();
  return (
    <AdminShell username={user.username} canSwitchToUser={user.lecturerId != null}>
      {children}
    </AdminShell>
  );
}
