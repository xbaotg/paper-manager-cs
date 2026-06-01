"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/app/_components/navbar";
import { Footer } from "@/app/_components/footer";
import { getDatabase } from "@/app/actions";
import { Paper, Lecturer, LECTURER_TITLE_LABELS } from "@/lib/data";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function LecturersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getDatabase().then((db) => {
      setPapers(db.papers);
      setLecturers(db.lecturers);
      setLoaded(true);
    }).catch(console.error);
  }, []);

  // Compute stats per lecturer
  const lecturerStats = useMemo(() => {
    return lecturers.map(lecturer => {
      const lecturerPapers = papers.filter(p => p.lecturerIds?.includes(lecturer.id));
      
      const papersByYear = lecturerPapers.reduce((acc, p) => {
        acc[p.year] = (acc[p.year] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // Sort years max to min
      const years = Object.keys(papersByYear).map(Number).sort((a, b) => b - a);
      const latestPaperYear = years[0] || null;

      return {
        ...lecturer,
        totalPapers: lecturerPapers.length,
        papersByYear,
        latestPaperYear,
        papers: lecturerPapers
      };
    }).sort((a, b) => b.totalPapers - a.totalPapers);
  }, [papers, lecturers]);

  const filteredLecturers = useMemo(() => {
    return lecturerStats.filter(l => 
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.department.toLowerCase().includes(search.toLowerCase())
    );
  }, [lecturerStats, search]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 container mx-auto px-6 pt-28 pb-16 max-w-6xl">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold font-heading text-foreground">Đội ngũ Giảng viên</h1>
            <p className="text-muted-foreground mt-1 text-base">Danh sách giảng viên và thống kê công bố khoa học</p>
          </div>
          <div className="w-full md:w-80">
            <Input 
              placeholder="Tìm kiếm theo tên giảng viên, khoa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background shadow-sm h-10 border-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLecturers.map((lecturer) => (
            <Link href={`/lecturers/${lecturer.id}`} key={lecturer.id} className="block group">
              <Card className="flex flex-col h-full border-muted bg-card hover:border-primary/50 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all pt-4 cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-4 pb-4 px-6 pt-2">
                  <Avatar className="h-14 w-14 border border-primary/20 bg-primary/10 text-primary">
                    <AvatarFallback className="font-semibold text-lg group-hover:scale-110 transition-transform">
                      {lecturer.name.split(' ').pop()?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <CardTitle className="text-lg truncate font-heading group-hover:text-primary transition-colors">{lecturer.name}</CardTitle>
                    <CardDescription className="flex flex-col text-sm truncate mt-1">
                      <span className="font-medium text-foreground">{LECTURER_TITLE_LABELS[lecturer.title] || lecturer.title}</span>
                      <span className="text-xs mt-0.5">{lecturer.department}</span>
                    </CardDescription>
                  </div>
                </CardHeader>
                
                <CardContent className="flex flex-col flex-1 pb-6 px-6 pt-0">
                <div className="bg-muted/30 rounded-xl p-4 mb-5 flex justify-between items-center border border-muted/50">
                  <div className="text-center w-full">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Tổng bài báo</div>
                    <div className="text-3xl font-semibold text-primary font-heading leading-none">{lecturer.totalPapers}</div>
                  </div>
                  {lecturer.latestPaperYear && (
                    <>
                      <div className="h-10 w-px bg-border mx-2"></div>
                      <div className="text-center w-full">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Năm gần nhất</div>
                        <div className="text-xl font-semibold text-foreground font-heading">
                          {lecturer.latestPaperYear}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-auto border-t border-border pt-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Phân bố bài viết theo năm</div>
                  {lecturer.totalPapers === 0 ? (
                    <div className="text-sm text-muted-foreground italic text-center py-2 px-3 bg-muted/20 rounded-md border border-dashed border-border/50">
                      Chưa có dữ liệu bài báo
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-[88px] overflow-y-auto pr-1 stylish-scrollbar">
                      {Object.entries(lecturer.papersByYear)
                        .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
                        .map(([year, count]) => (
                          <Badge key={year} variant="secondary" className="flex items-center gap-1.5 px-2.5 py-1 bg-background border border-border/60 shadow-sm text-xs">
                            <span className="font-medium">{year}</span>
                            <span className="opacity-40 font-normal">|</span>
                            <span className="font-semibold text-primary">{String(count)}</span>
                          </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
              </Card>
            </Link>
          ))}
          {filteredLecturers.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-muted rounded-xl bg-muted/10 h-64 flex flex-col justify-center items-center">
              <div className="text-muted-foreground mb-2">Không tìm thấy giảng viên nào phù hợp</div>
              <div className="text-sm font-medium">Thử thay đổi từ khóa tìm kiếm của bạn</div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}