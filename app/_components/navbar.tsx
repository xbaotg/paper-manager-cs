"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Plus, Menu, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Tính năng", href: "/#features" },
    { label: "Nhập bài báo", href: "/#submit" },
    { label: "Danh sách", href: "/#publications" },
    { label: "Thống kê", href: "/#statistics" },
    { label: "Giảng viên", href: "/admin" },
  ];

  const adminLink = { label: "Admin", href: "/admin", icon: Shield };

  return (
    <nav
      className={`fixed top-4 left-4 right-4 z-50 flex items-center justify-between h-16 px-6 rounded-2xl border border-border/50 bg-background/75 backdrop-blur-xl transition-shadow ${scrolled ? "shadow-lg" : ""}`}
    >
      <Link
        href="#"
        className="flex items-center gap-2 font-heading font-bold text-lg text-foreground"
      >
        <BookOpen className="size-6 text-primary" />
        CS Research Hub
      </Link>

      {/* Desktop */}
      <ul className="hidden md:flex items-center gap-8">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden md:flex items-center gap-2">
        <Link href="/admin">
          <Button variant="outline" size="sm" className="cursor-pointer">
            <Shield className="size-4" data-icon="inline-start" />
            Admin
          </Button>
        </Link>
        <Link href="/#submit">
          <Button size="sm" className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" data-icon="inline-start" />
            Thêm bài báo
          </Button>
        </Link>
      </div>

      {/* Mobile toggle */}
      <button
        className="md:hidden p-2 cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-background/95 backdrop-blur-xl rounded-xl border border-border shadow-lg md:hidden">
          <ul className="flex flex-col gap-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="block text-sm font-medium text-muted-foreground hover:text-primary transition-colors py-1"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/admin" onClick={() => setOpen(false)}>
                <Button variant="outline" size="sm" className="w-full cursor-pointer">
                  <Shield className="size-4" data-icon="inline-start" />
                  Admin
                </Button>
              </Link>
            </li>
            <li>
              <Link href="/#submit" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="size-4" data-icon="inline-start" />
                  Thêm bài báo
                </Button>
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
