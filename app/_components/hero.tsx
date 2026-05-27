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
      className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-6 text-center hover:-translate-y-0.5 transition-transform cursor-default"
    >
      <div className="text-3xl font-bold text-primary font-heading">{count}</div>
      <div className="text-xs text-muted-foreground font-medium mt-1">
        {label}
      </div>
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
      className="relative min-h-screen flex items-center pt-28 pb-16 overflow-hidden"
    >
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 -z-10 animate-gradient"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.985 0.005 293), oklch(0.94 0.04 293), oklch(0.9 0.06 293), oklch(0.96 0.02 293))",
        }}
      />
      <div className="absolute -top-1/3 -right-1/4 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl -z-10" />
      <div className="absolute -bottom-1/4 -left-1/6 w-[400px] h-[400px] rounded-full bg-cta/6 blur-3xl -z-10" />

      <div className="container mx-auto px-6 max-w-5xl text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-primary/8 border border-primary/15 text-sm font-medium text-primary">
          <Star className="size-4" />
          Khoa Khoa học máy tính
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading leading-tight mb-6">
          Quản lý{" "}
          <span className="bg-gradient-to-r from-primary to-cta bg-clip-text text-transparent">
            Công bố Khoa học
          </span>{" "}
          dễ dàng
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Nền tảng giúp các thành viên trong Khoa nhập thông tin bài báo, thống
          kê và tổng hợp danh sách công bố khoa học một cách nhanh chóng.
        </p>

        <div className="flex flex-wrap gap-4 justify-center mb-16">
          <Link href="#submit">
            <Button
              size="lg"
              className="cursor-pointer bg-cta text-cta-foreground hover:bg-cta/90 shadow-lg shadow-cta/25 text-sm font-semibold px-6"
            >
              <Plus className="size-4" data-icon="inline-start" />
              Nhập bài báo ngay
            </Button>
          </Link>
          <Link href="#publications">
            <Button
              variant="outline"
              size="lg"
              className="cursor-pointer text-sm font-semibold px-6"
            >
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
