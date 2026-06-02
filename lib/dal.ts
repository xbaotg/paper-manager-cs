import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  VIEW_MODE_COOKIE,
  decryptSession,
  homeFor,
  type Role,
  type ViewMode,
} from "./session";
import { getUserById } from "./queries/users";

export interface CurrentUser {
  id: number;
  username: string;
  role: Role;
  lecturerId: number | null;
  boMonId: number | null;
  isAdmin: boolean;
}

// Admin capability: a real manager OR a lecturer granted the admin elevation.
// This is the authoritative permission used by every admin gate/action; the
// view-mode switch never changes it (mode is presentation, not permission).
export function canManage(u: { role: Role; isAdmin: boolean }): boolean {
  return u.role === "manager" || u.isAdmin;
}

// A dual-capable user can manage AND has their own lecturer self-view — these
// are the only users for whom the admin/user mode switch is meaningful.
export function isDualMode(u: CurrentUser): boolean {
  return canManage(u) && u.lecturerId != null;
}

// Read + verify the session cookie. Returns null when absent/invalid.
// Cached per-request so repeated calls in a render don't re-decrypt.
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return decryptSession(token);
});

// Authoritative lookup: confirm the user still exists and is active.
// This is the real check (proxy is only optimistic). Cached per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const user = getUserById(session.userId);
  if (!user || !user.is_active) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    lecturerId: user.lecturer_id,
    boMonId: user.bo_mon_id,
    isAdmin: !!user.is_admin,
  };
});

// Active view-mode preference (dual users only). Cached per request. Returns
// null when unset/invalid — callers apply the default.
export const getViewMode = cache(async (): Promise<ViewMode | null> => {
  const raw = (await cookies()).get(VIEW_MODE_COOKIE)?.value;
  return raw === "admin" || raw === "user" ? raw : null;
});

// Guards for use at the top of protected layouts/pages/actions.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Authoritative landing route for a user: capability + (for dual users) their
// active view mode. Used by login and by the require* redirects.
export async function homeForUser(user: CurrentUser): Promise<string> {
  const mode = isDualMode(user) ? await getViewMode() : null;
  return homeFor({ role: user.role, isAdmin: user.isAdmin, lecturerId: user.lecturerId, mode });
}

// Capability gate for admin server ACTIONS. Mode-independent: a promoted
// lecturer keeps admin rights even while viewing in "user" mode (the mode is a
// view preference, not a security boundary). Non-admins are bounced home.
export async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canManage(user)) redirect(await homeForUser(user));
  return user;
}

// Admin AREA gate for the /admin layout. Adds mode-awareness on top of the
// capability check: a dual user browsing in "user" mode is sent to their /me
// self-view so the switch actually changes what they see.
export async function requireAdminArea(): Promise<CurrentUser> {
  const user = await requireManager();
  if (user.lecturerId != null && (await getViewMode()) === "user") redirect("/me");
  return user;
}

export async function requireLecturer(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "lecturer") redirect(await homeForUser(user));
  return user;
}

export async function requireHead(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "head") redirect(await homeForUser(user));
  // A head must be scoped to a bộ môn; an unscoped head is misconfigured.
  if (user.boMonId == null) redirect("/login");
  return user;
}
