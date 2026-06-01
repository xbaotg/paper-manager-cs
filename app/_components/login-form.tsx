"use client";

import { useActionState } from "react";
import { Lock, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, type LoginState } from "@/app/actions/auth";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(login, {});

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8 bg-card border border-border shadow-layered rounded-md p-8 pt-10 text-center">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center shadow-inner">
          <Lock className="size-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold font-heading tracking-tight">Đăng nhập hệ thống</h1>
          <p className="text-sm text-muted-foreground">
            Hệ thống quản lý KPI &amp; công bố khoa học
          </p>
        </div>
        <form action={formAction} className="space-y-4">
          <div className="space-y-3 text-left">
            <Input
              name="username"
              type="text"
              placeholder="Tên đăng nhập"
              autoComplete="username"
              required
              className="h-11 bg-background"
              autoFocus
            />
            <Input
              name="password"
              type="password"
              placeholder="Mật khẩu"
              autoComplete="current-password"
              required
              className="h-11 bg-background"
            />
            {state.error && (
              <p className="text-xs text-destructive font-medium mt-1">{state.error}</p>
            )}
          </div>
          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all font-heading"
          >
            {isPending ? "Đang đăng nhập..." : (
              <>
                Đăng nhập <ArrowRight className="size-4 ml-2" />
              </>
            )}
          </Button>
        </form>
        <div className="pt-4 border-t flex justify-center mt-4">
          <div className="flex items-center gap-2 text-muted-foreground font-heading font-semibold text-xs py-2">
            <BookOpen className="size-4" /> CS Research Hub
          </div>
        </div>
      </div>
    </div>
  );
}
