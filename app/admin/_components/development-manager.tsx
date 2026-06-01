"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { GraduationCap, Plus, Pencil, Trash2, CalendarClock, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "./confirm-dialog";
import {
  upsertDevelopmentAction,
  deleteDevelopmentAction,
  getProgressAction,
  upsertProgressAction,
  deleteProgressAction,
  type DevelopmentSnapshot,
} from "@/app/actions/development";
import type { DevelopmentItem, DevelopmentProgress, DevelopmentStatus } from "@/lib/queries/development";

const STATUS_LABEL: Record<DevelopmentStatus, string> = {
  planned: "Dự kiến",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  paused: "Tạm dừng",
};

function statusBadge(s: DevelopmentStatus) {
  const cls =
    s === "completed" ? "text-green-600 border-green-600/40"
    : s === "in_progress" ? "text-blue-600 border-blue-600/40"
    : s === "paused" ? "text-muted-foreground"
    : "text-amber-600 border-amber-600/40";
  return <Badge variant="outline" className={cls}>{STATUS_LABEL[s]}</Badge>;
}

export function DevelopmentManager({ initial }: { initial: DevelopmentSnapshot }) {
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DevelopmentItem | null>(null);
  const [lecturerId, setLecturerId] = useState("");
  const [currentDegree, setCurrentDegree] = useState("ThS");
  const [expectedYear, setExpectedYear] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [status, setStatus] = useState<DevelopmentStatus>("planned");
  const [notes, setNotes] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<DevelopmentItem | null>(null);

  // progress dialog
  const [progressItem, setProgressItem] = useState<DevelopmentItem | null>(null);
  const [progress, setProgress] = useState<DevelopmentProgress[]>([]);
  const [pYear, setPYear] = useState("");
  const [pQuarter, setPQuarter] = useState("1");
  const [pNote, setPNote] = useState("");

  const { items, lecturers, mentors, phdActual, milestones } = data;
  const withRoadmap = new Set(items.map((i) => i.lecturerId));
  const menteeCandidates = lecturers.filter((l) => editing || !withRoadmap.has(l.id));
  const noMentorMentors = mentors.filter((m) => m.menteeCount === 0);

  function openCreate() {
    setEditing(null);
    setLecturerId("");
    setCurrentDegree("ThS");
    setExpectedYear("");
    setMentorId("");
    setStatus("planned");
    setNotes("");
    setDialogOpen(true);
  }

  function openEdit(it: DevelopmentItem) {
    setEditing(it);
    setLecturerId(String(it.lecturerId));
    setCurrentDegree(it.currentDegree);
    setExpectedYear(it.expectedYear != null ? String(it.expectedYear) : "");
    setMentorId(it.mentorId != null ? String(it.mentorId) : "");
    setStatus(it.status);
    setNotes(it.notes ?? "");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!lecturerId) { toast.error("Chọn giảng viên."); return; }
    startTransition(async () => {
      const res = await upsertDevelopmentAction({
        lecturerId: Number(lecturerId),
        currentDegree,
        targetDegree: "TS",
        expectedYear: expectedYear ? Number(expectedYear) : null,
        mentorId: mentorId ? Number(mentorId) : null,
        status,
        notes: notes.trim() || null,
      });
      if (res.ok && res.data) {
        setData(res.data);
        toast.success(editing ? "Đã cập nhật lộ trình" : "Đã thêm lộ trình");
        setDialogOpen(false);
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const t = deleteTarget;
    startTransition(async () => {
      const res = await deleteDevelopmentAction(t.id);
      if (res.data) setData(res.data);
      toast.success("Đã xoá lộ trình");
      setDeleteTarget(null);
    });
  }

  function openProgress(it: DevelopmentItem) {
    setProgressItem(it);
    setPYear(String(new Date().getFullYear()));
    setPQuarter("1");
    setPNote("");
    startTransition(async () => setProgress(await getProgressAction(it.id)));
  }

  function handleAddProgress() {
    if (!progressItem || !pNote.trim()) { toast.error("Nhập nội dung báo cáo quý."); return; }
    startTransition(async () => {
      const res = await upsertProgressAction({
        developmentId: progressItem.id,
        year: Number(pYear),
        quarter: Number(pQuarter),
        note: pNote.trim(),
        status: null,
      });
      if (res.ok && res.data) {
        setProgress(res.data);
        setPNote("");
        toast.success("Đã lưu tiến độ quý");
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  function handleDeleteProgress(id: number) {
    if (!progressItem) return;
    startTransition(async () => {
      const res = await deleteProgressAction(id, progressItem.id);
      if (res.data) setProgress(res.data);
    });
  }

  const lastMilestone = milestones[milestones.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
            <GraduationCap className="size-6 text-primary" /> Phát triển đội ngũ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lộ trình nâng cao trình độ lên Tiến sĩ giai đoạn 2026–2030.
          </p>
        </div>
        <Button onClick={openCreate} className="cursor-pointer gap-1.5">
          <Plus className="size-4" /> Thêm lộ trình
        </Button>
      </div>

      {/* Milestone + mentor summary */}
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
              <Users className="size-4 text-primary" /> Phân công hướng dẫn (PGS.TS/TS)
            </div>
            {noMentorMentors.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-600">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>{noMentorMentors.length} GV chưa hướng dẫn ai (yêu cầu mỗi PGS.TS/TS kèm tối thiểu 1 người).</span>
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

      {/* Roadmap table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Giảng viên</TableHead>
              <TableHead>Bộ môn</TableHead>
              <TableHead className="text-center">Hiện tại → Mục tiêu</TableHead>
              <TableHead className="text-center">Năm hoàn thành</TableHead>
              <TableHead>GV hướng dẫn</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="font-medium">{it.lecturerName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{it.boMonName ?? "—"}</TableCell>
                <TableCell className="text-center text-sm">{it.currentDegree} → {it.targetDegree}</TableCell>
                <TableCell className="text-center">{it.expectedYear ?? "—"}</TableCell>
                <TableCell className="text-sm">{it.mentorName ?? <span className="text-amber-600">Chưa phân công</span>}</TableCell>
                <TableCell>{statusBadge(it.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" className="cursor-pointer" title="Tiến độ quý" onClick={() => openProgress(it)}>
                      <CalendarClock className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="cursor-pointer" title="Sửa" onClick={() => openEdit(it)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="cursor-pointer text-destructive" title="Xoá" onClick={() => setDeleteTarget(it)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Chưa có lộ trình nào. Thêm cho các GV chưa đạt Tiến sĩ.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa lộ trình" : "Thêm lộ trình"}</DialogTitle>
            <DialogDescription>Mục tiêu mặc định là Tiến sĩ (TS).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Giảng viên</label>
              <Select value={lecturerId} onValueChange={(v) => setLecturerId(v ?? "")} disabled={!!editing}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Chọn giảng viên..." /></SelectTrigger>
                <SelectContent>
                  {menteeCandidates.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)} className="cursor-pointer">
                      {l.title}. {l.name} ({l.academicRank})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Trình độ hiện tại</label>
                <Select value={currentDegree} onValueChange={(v) => setCurrentDegree(v ?? "ThS")}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NCS" className="cursor-pointer">NCS (nghiên cứu sinh)</SelectItem>
                    <SelectItem value="ThS" className="cursor-pointer">ThS (thạc sĩ)</SelectItem>
                    <SelectItem value="CN" className="cursor-pointer">CN (cử nhân)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Năm hoàn thành dự kiến</label>
                <Input type="number" min={2026} max={2035} placeholder="VD: 2030" value={expectedYear} onChange={(e) => setExpectedYear(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Giảng viên hướng dẫn</label>
              <Select value={mentorId || "none"} onValueChange={(v) => setMentorId(v && v !== "none" ? v : "")}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Chọn GV hướng dẫn..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">— Chưa phân công —</SelectItem>
                  {mentors.map((m) => (
                    <SelectItem key={m.mentorId} value={String(m.mentorId)} className="cursor-pointer">{m.mentorName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Trạng thái</label>
              <Select value={status} onValueChange={(v) => setStatus((v as DevelopmentStatus) ?? "planned")}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as DevelopmentStatus[]).map((s) => (
                    <SelectItem key={s} value={s} className="cursor-pointer">{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ghi chú theo dõi</label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="VD: chuẩn bị hồ sơ 2026, bảo vệ 2030..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Huỷ</Button>
            <Button onClick={handleSave} disabled={pending} className="cursor-pointer">{pending ? "Đang lưu..." : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quarterly progress dialog */}
      <Dialog open={!!progressItem} onOpenChange={(o) => { if (!o) setProgressItem(null); }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Tiến độ hằng quý — {progressItem?.lecturerName}</DialogTitle>
            <DialogDescription>Báo cáo tiến độ học tập/nghiên cứu/công bố theo quý.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input type="number" min={2026} max={2035} value={pYear} onChange={(e) => setPYear(e.target.value)} className="w-24" placeholder="Năm" />
              <Select value={pQuarter} onValueChange={(v) => setPQuarter(v ?? "1")}>
                <SelectTrigger className="w-24 cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)} className="cursor-pointer">Quý {q}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={pNote} onChange={(e) => setPNote(e.target.value)} placeholder="Nội dung..." className="flex-1" />
              <Button onClick={handleAddProgress} disabled={pending} className="cursor-pointer">Lưu</Button>
            </div>
            <div className="max-h-[280px] overflow-y-auto space-y-1.5">
              {progress.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Chưa có báo cáo quý nào.</p>}
              {progress.map((p) => (
                <div key={p.id} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
                  <Badge variant="secondary" className="shrink-0">{p.year} Q{p.quarter}</Badge>
                  <span className="flex-1">{p.note}</span>
                  <Button variant="ghost" size="icon-sm" className="cursor-pointer text-destructive shrink-0" onClick={() => handleDeleteProgress(p.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Xoá lộ trình?"
        description={`Lộ trình của "${deleteTarget?.lecturerName}" sẽ bị xoá (kèm các báo cáo quý).`}
        confirmLabel="Xoá"
        onConfirm={handleDelete}
      />
    </div>
  );
}
