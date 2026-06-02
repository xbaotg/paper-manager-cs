"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  VIEW_MODE_COOKIE,
  encryptSession,
  sessionCookieOptions,
  viewModeCookieOptions,
  homeFor,
  COOKIE_PATH,
  type ViewMode,
} from "@/lib/session";
import { getUserByUsername } from "@/lib/queries/users";
import { requireUser, isDualMode } from "@/lib/dal";

export interface LoginState {
  error?: string;
}

// useActionState-compatible login. On success it sets the session cookie and
// redirects by role; on failure it returns an error message.
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Vui lòng nhập tên đăng nhập và mật khẩu." };
  }

  const user = getUserByUsername(username);
  // Always run a compare to avoid leaking which usernames exist (timing).
  const hash = user?.password_hash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await bcrypt.compare(password, hash);

  if (!user || !user.is_active || !ok) {
    return { error: "Tên đăng nhập hoặc mật khẩu không đúng." };
  }

  const isAdmin = !!user.is_admin;
  const token = await encryptSession({
    userId: user.id,
    role: user.role,
    lecturerId: user.lecturer_id,
    boMonId: user.bo_mon_id,
    isAdmin,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());

  // Fresh login starts at the default view (no mode cookie yet) — dual users
  // land in /admin and switch from there.
  redirect(homeFor({ role: user.role, isAdmin, lecturerId: user.lecturer_id, mode: null }));
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: COOKIE_PATH });
  jar.delete({ name: VIEW_MODE_COOKIE, path: COOKIE_PATH });
  redirect("/login");
}

// Switch a dual-capable user's active view between the admin area and their
// lecturer self-view. Only meaningful for users who can manage AND have their
// own lecturer profile; anyone else is just routed to their real home. Used as
// a form action (bound to the target mode).
export async function switchViewMode(mode: ViewMode): Promise<void> {
  const user = await requireUser();
  if (!isDualMode(user)) {
    redirect(homeFor({ role: user.role, isAdmin: user.isAdmin, lecturerId: user.lecturerId, mode: null }));
  }
  (await cookies()).set(VIEW_MODE_COOKIE, mode, viewModeCookieOptions());
  redirect(mode === "admin" ? "/admin" : "/me");
}
