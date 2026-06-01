import { BookOpen, LogOut } from "lucide-react";
import { requireLecturer } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { ChangePasswordDialog } from "@/app/_components/change-password-dialog";

// Auth gate for the lecturer (GV) self-service area.
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireLecturer();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 h-16 px-6 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-2 font-heading font-semibold">
          <BookOpen className="size-5 text-primary" /> Khu vực của tôi
        </div>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground font-medium">{user.username}</span>
        <ChangePasswordDialog />
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm" className="cursor-pointer gap-1.5">
            <LogOut className="size-4" /> Đăng xuất
          </Button>
        </form>
      </header>
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
