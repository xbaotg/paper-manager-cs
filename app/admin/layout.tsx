"use client";

import { useState, useEffect } from "react";
import { Menu, Lock, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSidebar } from "./_components/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const expiry = localStorage.getItem("paperManager_admin_auth_expiry");
    if (expiry && Date.now() < parseInt(expiry, 10)) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      localStorage.removeItem("paperManager_admin_auth_expiry");
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "aiclub@uit") {
      const expiry = Date.now() + 60 * 60 * 1000; // 1 hour session
      localStorage.setItem("paperManager_admin_auth_expiry", expiry.toString());
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Mật khẩu không chính xác.");
    }
  };

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
        <div className="w-full max-w-sm space-y-8 bg-card border shadow-xl rounded-2xl p-8 pt-10 text-center animate-fade-in-up">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center shadow-inner">
            <Lock className="size-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-heading tracking-tight">Vùng quản trị</h1>
            <p className="text-sm text-muted-foreground">Nhập mật khẩu để truy cập trang quản lý</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2 text-left">
              <Input
                type="password"
                placeholder="Mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-background"
                autoFocus
              />
              {error && <p className="text-xs text-destructive font-medium mt-1">{error}</p>}
            </div>
            <Button type="submit" className="w-full h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all font-heading">
              Đăng nhập <ArrowRight className="size-4 ml-2" />
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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 h-full">
            <AdminSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
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
          <span className="text-xs text-muted-foreground font-medium px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15">
            Admin Panel
          </span>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
