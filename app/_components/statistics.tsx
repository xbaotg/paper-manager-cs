"use client";

import { useEffect, useRef } from "react";
import { BarChart3, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Paper } from "@/lib/data";

export function Statistics({ papers }: { papers: Paper[] }) {
  // Papers by year
  const yearCounts: Record<number, number> = {};
  papers.forEach((p) => {
    yearCounts[p.year] = (yearCounts[p.year] || 0) + 1;
  });
  const years = Object.keys(yearCounts)
    .map(Number)
    .sort((a, b) => a - b);
  const maxYear = Math.max(...Object.values(yearCounts), 1);

  // Top venues
  const venueCounts: Record<string, number> = {};
  papers.forEach((p) => {
    venueCounts[p.venue] = (venueCounts[p.venue] || 0) + 1;
  });
  const sortedVenues = Object.entries(venueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const maxVenue = sortedVenues.length > 0 ? sortedVenues[0][1] : 1;

  return (
    <section id="statistics" className="py-24 bg-card">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="text-center mb-12">
          <span className="eyebrow block mb-4">Thống kê</span>
          <h2 className="text-3xl sm:text-4xl font-semibold font-heading mb-4">
            Tổng quan nghiên cứu
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Biểu đồ thống kê hoạt động công bố khoa học của Khoa qua các năm.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Bar Chart: Papers by Year */}
          <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold font-heading flex items-center gap-2 mb-8">
                <BarChart3 className="size-5 text-primary" />
                Bài báo theo năm
              </h3>
              <div className="flex items-end gap-3 h-44">
                {years.map((year, i) => {
                  const count = yearCounts[year];
                  const pct = (count / maxYear) * 100;
                  return (
                    <div
                      key={year}
                      className="flex-1 flex flex-col items-center justify-end h-full"
                    >
                      <AnimatedBar pct={pct} count={count} delay={i * 100} />
                      <span className="text-xs text-muted-foreground font-medium mt-2">
                        {year}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Horizontal Bars: Top Venues */}
          <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold font-heading flex items-center gap-2 mb-6">
                <ClipboardList className="size-5 text-primary" />
                Top hội nghị / tạp chí
              </h3>
              <div className="space-y-4">
                {sortedVenues.map(([venue, count]) => {
                  const pct = (count / maxVenue) * 100;
                  return (
                    <div key={venue} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">{venue}</span>
                        <span className="text-sm font-semibold font-heading text-primary">
                          {count}
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-1000"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function AnimatedBar({
  pct,
  count,
  delay,
}: {
  pct: number;
  count: number;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.height = `${pct}%`;
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pct]);

  return (
    <div className="relative w-full flex items-end justify-center" style={{ height: "100%" }}>
      <div
        ref={ref}
        className="w-full max-w-[48px] bg-gradient-to-t from-primary to-primary/60 rounded-t-md transition-all cursor-pointer hover:brightness-110"
        style={{
          height: "0%",
          transitionDuration: "800ms",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          transitionDelay: `${delay}ms`,
        }}
      >
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-semibold font-heading text-primary whitespace-nowrap">
          {count}
        </span>
      </div>
    </div>
  );
}
