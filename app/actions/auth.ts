"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  encryptSession,
  sessionCookieOptions,
} from "@/lib/session";
import { getUserByUsername } from "@/lib/queries/users";
import { homeForRole } from "@/lib/dal";

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

  const token = await encryptSession({
    userId: user.id,
    role: user.role,
    lecturerId: user.lecturer_id,
    boMonId: user.bo_mon_id,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());

  redirect(homeForRole(user.role));
}

export async function logout(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/paper" });
  redirect("/login");
}
