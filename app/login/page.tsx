import type { Metadata } from "next";
import { LoginForm } from "@/app/_components/login-form";

export const metadata: Metadata = {
  title: "Đăng nhập — CS Research Hub",
};

export default function LoginPage() {
  return <LoginForm />;
}
