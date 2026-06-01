import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, decryptSession, type Role } from "./session";
import { getUserById } from "./queries/users";

export interface CurrentUser {
  id: number;
  username: string;
  role: Role;
  lecturerId: number | null;
  boMonId: number | null;
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
  };
});

// Guards for use at the top of protected layouts/pages/actions.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// The landing route for a given role, used to bounce a user out of an area
// they may not enter.
export function homeForRole(role: Role): string {
  if (role === "manager") return "/admin";
  if (role === "head") return "/head";
  return "/me";
}

export async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "manager") redirect(homeForRole(user.role));
  return user;
}

export async function requireLecturer(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "lecturer") redirect(homeForRole(user.role));
  return user;
}

export async function requireHead(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "head") redirect(homeForRole(user.role));
  // A head must be scoped to a bộ môn; an unscoped head is misconfigured.
  if (user.boMonId == null) redirect("/login");
  return user;
}
