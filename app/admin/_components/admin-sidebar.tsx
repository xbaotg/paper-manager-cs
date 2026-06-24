"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  BookOpen,
  ChevronLeft,
  ShieldCheck,
  Target,
  Building2,
  GraduationCap,
  FileBarChart,
  Database,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ADMIN_NAV = [
  { label: "Tổng quan", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "KPI", href: "/admin/kpi", icon: Target, exact: false },
  { label: "Phát triển đội ngũ", href: "/admin/development", icon: GraduationCap, exact: false },
  { label: "Giảng viên", href: "/admin/lecturers", icon: Users, exact: false },
  { label: "Bộ môn", href: "/admin/bo-mon", icon: Building2, exact: false },
  { label: "Bài báo", href: "/admin/papers", icon: FileText, exact: false },
  { label: "Đề tài & Hướng dẫn", href: "/admin/llkh", icon: ScrollText, exact: false },
  { label: "Tạp chí/Hội nghị", href: "/admin/venues", icon: BookOpen, exact: false },
  { label: "Báo cáo", href: "/admin/reports", icon: FileBarChart, exact: false },
  { label: "Tài khoản", href: "/admin/users", icon: ShieldCheck, exact: false },
  { label: "Dữ liệu & Logs", href: "/admin/data", icon: Database, exact: false },
];

// Trưởng bộ môn: monitoring views scoped to their bộ môn (no management tools).
const HEAD_NAV = [
  { label: "KPI bộ môn", href: "/head", icon: Target, exact: true },
  { label: "Phát triển đội ngũ", href: "/head/development", icon: GraduationCap, exact: false },
  { label: "Giảng viên", href: "/head/lecturers", icon: Users, exact: false },
];

export type SidebarVariant = "admin" | "head";

export function AdminSidebar({
  collapsed,
  onToggle,
  variant = "admin",
}: {
  collapsed: boolean;
  onToggle: () => void;
  variant?: SidebarVariant;
}) {
  const pathname = usePathname();
  const navItems = variant === "head" ? HEAD_NAV : ADMIN_NAV;

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={`sticky top-0 h-screen flex flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 h-16 px-4 border-b border-border/50">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-foreground font-heading font-semibold"
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <BookOpen className="size-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-sm whitespace-nowrap">CS Research Hub</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                className={`size-5 shrink-0 ${
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-3 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer justify-center"
          onClick={onToggle}
        >
          <ChevronLeft
            className={`size-4 transition-transform duration-300 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
          {!collapsed && <span className="ml-2 text-xs">Thu gọn</span>}
        </Button>
      </div>
    </aside>
  );
}
