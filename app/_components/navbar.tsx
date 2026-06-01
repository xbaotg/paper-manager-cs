"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Menu, X, LogIn } from "lucide-react";
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
    { label: "Danh sách", href: "/#publications" },
    { label: "Thống kê", href: "/#statistics" },
    { label: "Giảng viên", href: "/lecturers" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-6 lg:px-8 border-b bg-background/85 backdrop-blur-xl transition-colors ${scrolled ? "border-border" : "border-transparent"}`}
    >
      <Link
        href="#"
        className="flex items-center gap-2 font-heading font-semibold text-base text-foreground tracking-tight"
      >
        <BookOpen className="size-5 text-accent-purple" />
        CS Research Hub
      </Link>

      {/* Desktop */}
      <ul className="hidden md:flex items-center gap-8">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden md:flex items-center gap-2">
        <Link href="/login">
          <Button size="sm" className="cursor-pointer">
            <LogIn className="size-4" data-icon="inline-start" />
            Đăng nhập
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
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full cursor-pointer">
                  <LogIn className="size-4" data-icon="inline-start" />
                  Đăng nhập
                </Button>
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
