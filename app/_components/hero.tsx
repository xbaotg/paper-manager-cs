"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Paper } from "@/lib/data";

function Counter({
  target,
  label,
}: {
  target: number;
  label: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches;
          if (prefersReducedMotion) {
            setCount(target);
            return;
          }
          const duration = 1200;
          const start = performance.now();
          function step(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(target * eased));
            if (progress < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div
      ref={ref}
      className="bg-card border border-border rounded-md p-6 text-center hover:-translate-y-0.5 transition-transform cursor-default"
    >
      <div className="text-3xl font-semibold text-foreground font-heading tracking-tight">{count}</div>
      <div className="eyebrow-sm text-muted-foreground mt-2">{label}</div>
    </div>
  );
}

export function Hero({ papers }: { papers: Paper[] }) {
  const totalPapers = papers.length;
  const uniqueVenues = new Set(papers.map((p) => p.venue)).size;
  const uniqueAuthors = new Set(
    papers.flatMap((p) =>
      p.authors
        .split(/[,&]/)
        .map((a) => a.trim())
        .filter(Boolean)
    )
  ).size;

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center pt-28 pb-16 bg-background border-b border-border"
    >
      <div className="container mx-auto px-6 max-w-5xl text-center">
        <div className="eyebrow inline-flex items-center gap-2 mb-7 text-foreground">
          <Star className="size-4 text-accent-purple" />
          Khoa Khoa học máy tính
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold font-heading leading-[1.04] tracking-tight mb-6 text-foreground">
          Quản lý Công bố Khoa học &amp; KPI
        </h1>

        <p className="text-lg sm:text-xl text-body max-w-2xl mx-auto mb-10 leading-relaxed text-muted-foreground">
          Nền tảng theo dõi công bố khoa học, chỉ tiêu KPI và phát triển đội ngũ
          của Khoa Khoa học Máy tính — nhập liệu, tổng hợp và báo cáo nhanh chóng.
        </p>

        <div className="flex flex-wrap gap-3 justify-center mb-16">
          <Link href="#submit">
            <Button size="lg" className="cursor-pointer px-6">
              <Plus className="size-4" data-icon="inline-start" />
              Nhập bài báo ngay
            </Button>
          </Link>
          <Link href="#publications">
            <Button variant="outline" size="lg" className="cursor-pointer px-6">
              <ClipboardList className="size-4" data-icon="inline-start" />
              Xem danh sách
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          <Counter target={totalPapers} label="Bài báo" />
          <Counter target={uniqueVenues} label="Hội nghị / Tạp chí" />
          <Counter target={uniqueAuthors} label="Tác giả" />
        </div>
      </div>
    </section>
  );
}
