import { GraduationCap, UserCheck, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DevelopmentItem, DevelopmentProgress, DevelopmentStatus } from "@/lib/queries/development";

const STATUS_LABEL: Record<DevelopmentStatus, string> = {
  planned: "Dự kiến",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  paused: "Tạm dừng",
};

export function MeDevelopment({
  item,
  progress,
}: {
  item: DevelopmentItem | null;
  progress: DevelopmentProgress[];
}) {
  if (!item) return null; // only shown to staff with an active PhD roadmap

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-5 text-primary" />
        <h2 className="font-heading font-semibold">Lộ trình phát triển của tôi</h2>
        <Badge variant="outline" className="ml-auto">{STATUS_LABEL[item.status]}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Lộ trình</div>
          <div className="font-medium">{item.currentDegree} → {item.targetDegree}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="size-3" /> Năm hoàn thành dự kiến</div>
          <div className="font-medium">{item.expectedYear ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><UserCheck className="size-3" /> GV hướng dẫn</div>
          <div className="font-medium">{item.mentorName ?? "Chưa phân công"}</div>
        </div>
      </div>

      {item.notes && (
        <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">{item.notes}</p>
      )}

      {progress.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Tiến độ hằng quý</div>
          {progress.map((p) => (
            <div key={p.id} className="flex items-start gap-2 text-sm">
              <Badge variant="secondary" className="shrink-0">{p.year} Q{p.quarter}</Badge>
              <span>{p.note}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
