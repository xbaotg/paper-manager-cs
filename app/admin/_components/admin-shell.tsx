"use client";

import { useState } from "react";
import { Menu, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSidebar, type SidebarVariant } from "./admin-sidebar";
import { ChangePasswordDialog } from "@/app/_components/change-password-dialog";
import { ViewModeSwitch } from "@/app/_components/view-mode-switch";
import { logout } from "@/app/actions/auth";

export function AdminShell({
  username,
  children,
  variant = "admin",
  canSwitchToUser = false,
}: {
  username: string;
  children: React.ReactNode;
  variant?: SidebarVariant;
  canSwitchToUser?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} variant={variant} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 h-full">
            <AdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} variant={variant} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 flex items-center gap-3 h-16 px-6 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden cursor-pointer"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex-1" />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15">
            <User className="size-3.5" /> {username}
          </span>
          {canSwitchToUser && <ViewModeSwitch target="user" />}
          <ChangePasswordDialog />
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm" className="cursor-pointer gap-1.5">
              <LogOut className="size-4" /> Đăng xuất
            </Button>
          </form>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
