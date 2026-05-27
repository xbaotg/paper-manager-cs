import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  const links = [
    { label: "Tính năng", href: "/#features" },
    { label: "Nhập bài báo", href: "/#submit" },
    { label: "Danh sách", href: "/#publications" },
    { label: "Thống kê", href: "/#statistics" },
    { label: "Giảng viên", href: "/admin" },
  ];

  return (
    <footer className="bg-[oklch(0.18_0.04_293)] text-white/60 py-10">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-heading font-semibold">
            <BookOpen className="size-5 text-primary/80" />
            CS Research Hub
          </div>
          <ul className="flex flex-wrap gap-6">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <Separator className="my-6 bg-white/10" />
        <p className="text-center text-xs">
          &copy; 2024 Khoa Khoa học máy tính. Paper Manager CS.
        </p>
      </div>
    </footer>
  );
}
