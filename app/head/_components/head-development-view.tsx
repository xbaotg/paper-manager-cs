import { GraduationCap, CalendarClock, Users, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { DevelopmentSnapshot } from "@/app/actions/development";
import type { DevelopmentStatus } from "@/lib/queries/development";

const STATUS_LABEL: Record<DevelopmentStatus, string> = {
  planned: "Dự kiến",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  paused: "Tạm dừng",
};

export function HeadDevelopmentView({ data }: { data: DevelopmentSnapshot }) {
  const { items, mentors, phdActual, milestones } = data;
  const noMentor = mentors.filter((m) => m.menteeCount === 0);
  const lastMilestone = milestones[milestones.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
          <GraduationCap className="size-6 text-primary" /> Phát triển đội ngũ
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lộ trình nâng cao trình độ lên Tiến sĩ của bộ môn (chỉ xem).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4 text-primary" /> Số GV trình độ Tiến sĩ (toàn Khoa)
            </div>
            <div className="text-3xl font-semibold">
              {phdActual}
              {lastMilestone && (
                <span className="text-sm font-normal text-muted-foreground"> / {lastMilestone.target} (mục tiêu {lastMilestone.year})</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {milestones.map((m) => {
                const met = phdActual >= m.target;
                return (
                  <Badge key={m.year} variant="outline" className={met ? "text-green-600 border-green-600/40" : "text-muted-foreground"}>
                    {m.year}: ≥{m.target} {met ? "✓" : ""}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" /> Hướng dẫn (PGS.TS/TS) trong bộ môn
            </div>
            {noMentor.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-600">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>{noMentor.length} GV chưa hướng dẫn ai.</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {mentors.length === 0 && <span className="text-xs text-muted-foreground">Chưa có PGS.TS/TS.</span>}
              {mentors.map((m) => (
                <Badge key={m.mentorId} variant="outline" className={m.menteeCount === 0 ? "text-amber-600 border-amber-600/40" : ""}>
                  {m.mentorName}: {m.menteeCount}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Giảng viên</TableHead>
              <TableHead className="text-center">Hiện tại → Mục tiêu</TableHead>
              <TableHead className="text-center">Năm hoàn thành</TableHead>
              <TableHead>GV hướng dẫn</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ghi chú</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="font-medium">{it.lecturerName}</TableCell>
                <TableCell className="text-center text-sm">{it.currentDegree} → {it.targetDegree}</TableCell>
                <TableCell className="text-center">{it.expectedYear ?? "—"}</TableCell>
                <TableCell className="text-sm">{it.mentorName ?? <span className="text-amber-600">Chưa phân công</span>}</TableCell>
                <TableCell><Badge variant="outline">{STATUS_LABEL[it.status]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[260px]">{it.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Bộ môn chưa có lộ trình nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
