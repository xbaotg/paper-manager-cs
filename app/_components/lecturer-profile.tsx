import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, Building2, GraduationCap, FileText,
  ShieldCheck, CalendarClock, UserCheck, Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getVenueRankBucket, getVenueRankShort, isVenueScopus } from "@/lib/venues";
import { LECTURER_TITLE_LABELS, ACADEMIC_RANK_LABELS } from "@/lib/data";
import { PublicationList } from "@/app/_components/publication-list";
import type { LecturerProfile } from "@/lib/profile";
import type { DevelopmentStatus } from "@/lib/queries/development";

const ROLE_LABEL: Record<string, string> = {
  manager: "Quản lý",
  head: "Trưởng bộ môn",
  lecturer: "Giảng viên",
};
const STATUS_LABEL: Record<DevelopmentStatus, string> = {
  planned: "Dự kiến",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  paused: "Tạm dừng",
};

function pctColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 100) return "text-green-600 font-semibold";
  if (pct >= 70) return "text-amber-600";
  return "text-destructive";
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-3xl font-semibold font-heading tracking-tight">{value}</div>
      <div className="eyebrow-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export function LecturerProfile({ data, backHref }: { data: LecturerProfile; backHref: string }) {
  const { lecturer, academicRank, boMonName, account, papers, stats, indicators, kpiByPeriod, development, progress } = data;
  const perPerson = indicators.filter((i) => i.agg !== "phd_count");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Quay lại
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="p-6 flex flex-wrap items-start gap-5">
          <div className="size-16 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold shrink-0">
            {lecturer.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold font-heading tracking-tight">{lecturer.name}</h1>
              <Badge variant="secondary">{academicRank}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{LECTURER_TITLE_LABELS[lecturer.title] ?? lecturer.title} · {ACADEMIC_RANK_LABELS[academicRank]}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm pt-1">
              <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5 text-muted-foreground" /> {boMonName ?? lecturer.department}</span>
              <a href={`mailto:${lecturer.email}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Mail className="size-3.5 text-muted-foreground" /> {lecturer.email}</a>
              {lecturer.phone && <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" /> {lecturer.phone}</span>}
              {account && (
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-muted-foreground" /> {account.username} ({ROLE_LABEL[account.role] ?? account.role})
                  {!account.isActive && <Badge variant="outline" className="text-muted-foreground">Vô hiệu</Badge>}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Stat
          label={stats.pending > 0 ? `Bài báo (+${stats.pending} đang xử lý)` : "Bài báo"}
          value={stats.total}
        />
        <Stat label="Bài Scopus" value={stats.scopusIndexed} />
        <Stat label="Bài Q1" value={stats.q1} />
      </div>

      {/* KPI per period */}
      {kpiByPeriod.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading font-semibold flex items-center gap-2"><Target className="size-5 text-primary" /> KPI theo kỳ</h2>
          <div className="rounded-md border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kỳ</TableHead>
                  {perPerson.map((ind) => (
                    <TableHead key={ind.id} className="text-center border-l">{ind.nameVi}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiByPeriod.map(({ period, cells }) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{period.label}</TableCell>
                    {perPerson.map((ind) => {
                      const c = cells.find((x) => x.indicatorId === ind.id);
                      return (
                        <TableCell key={ind.id} className="text-center border-l">
                          <span className="font-semibold">{c?.actual ?? 0}</span>
                          <span className="text-muted-foreground"> / {c?.target ?? "—"}</span>
                          {c?.pct != null && <span className={`ml-2 text-xs ${pctColor(c.pct)}`}>{c.pct}%</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Development roadmap */}
      {development && (
        <section className="space-y-3">
          <h2 className="font-heading font-semibold flex items-center gap-2"><GraduationCap className="size-5 text-primary" /> Lộ trình phát triển</h2>
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Lộ trình</div><div className="font-medium">{development.currentDegree} → {development.targetDegree}</div></div>
                <div><div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="size-3" /> Năm hoàn thành</div><div className="font-medium">{development.expectedYear ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground flex items-center gap-1"><UserCheck className="size-3" /> GV hướng dẫn</div><div className="font-medium">{development.mentorName ?? "Chưa phân công"}</div></div>
              </div>
              <Badge variant="outline">{STATUS_LABEL[development.status]}</Badge>
              {development.notes && <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">{development.notes}</p>}
              {progress.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-medium text-muted-foreground">Tiến độ hằng quý</div>
                  {progress.map((p) => (
                    <div key={p.id} className="flex items-start gap-2 text-sm">
                      <Badge variant="secondary" className="shrink-0">{p.year} Q{p.quarter}</Badge>
                      <span>{p.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Papers */}
      <section className="space-y-3">
        <h2 className="font-heading font-semibold flex items-center gap-2"><FileText className="size-5 text-primary" /> Danh sách công bố ({papers.length})</h2>
        <PublicationList
          items={papers.map((p) => ({
            id: p.id,
            year: p.year,
            title: p.title,
            venue: p.venue,
            venueRank: p.venue ? getVenueRankShort(p.venue) : "",
            bucket: p.venue ? getVenueRankBucket(p.venue) : "Khác",
            isScopus: !!p.venue && isVenueScopus(p.venue),
            submissionStatus: p.submissionStatus,
            credited: p.credited,
          }))}
        />
      </section>
    </div>
  );
}
