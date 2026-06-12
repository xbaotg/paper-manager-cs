"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Mail,
  Phone,
  ScrollText,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { LecturerForm } from "../_components/lecturer-form";
import { ConfirmDialog } from "../_components/confirm-dialog";
import { type Lecturer, type Paper } from "@/lib/data";
import type { BoMon } from "@/lib/queries/bo_mon";
import { getDatabase, addLecturerServer, updateLecturerServer, deleteLecturerServer } from "@/app/actions";
import { getBoMonOptions } from "@/app/actions/bo_mon";

export default function LecturersPage() {
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [boMon, setBoMon] = useState<BoMon[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lecturer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lecturer | null>(null);

  useEffect(() => {
    Promise.all([getDatabase(), getBoMonOptions()]).then(([db, bm]) => {
      setLecturers(db.lecturers);
      setPapers(db.papers);
      setBoMon(bm);
      setLoaded(true);
    }).catch(err => {
      console.error(err);
      setLecturers([]);
      setPapers([]);
      setBoMon([]);
      setLoaded(true);
    });
  }, []);

  const boMonName = useMemo(() => {
    const m = new Map<number, string>();
    boMon.forEach((b) => m.set(b.id, b.nameVi));
    return m;
  }, [boMon]);

  // Paper counts per lecturer
  const paperCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    papers.forEach((p) => {
      (p.lecturerIds || []).forEach((lid) => {
        counts[lid] = (counts[lid] || 0) + 1;
      });
    });
    return counts;
  }, [papers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return lecturers;
    return lecturers.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q) ||
        l.department.toLowerCase().includes(q)
    );
  }, [lecturers, search]);

  async function handleSave(lecturer: Lecturer) {
    if (editing) {
      const db = await updateLecturerServer(editing.id, lecturer);
      setLecturers(db.lecturers);
      toast.success("Cập nhật giảng viên thành công!");
    } else {
      const db = await addLecturerServer(lecturer);
      setLecturers(db.lecturers);
      toast.success("Thêm giảng viên thành công!");
    }
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const db = await deleteLecturerServer(deleteTarget.id);
    setLecturers(db.lecturers);
    toast.success("Xoá giảng viên thành công!");
    setDeleteTarget(null);
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading flex items-center gap-2">
            <Users className="size-6 text-primary" />
            Quản lý giảng viên
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lecturers.length} giảng viên đã đăng ký
          </p>
        </div>
        <Button
          className="cursor-pointer bg-cta text-cta-foreground hover:bg-cta/90"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" data-icon="inline-start" />
          Thêm giảng viên
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Tìm kiếm giảng viên..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10"
        />
      </div>

      {/* Table */}
      <Card className="border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 w-[30%]">
                  Giảng viên
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 w-[25%]">
                  Liên hệ
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 w-[15%]">
                  Đơn vị
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-center w-[10%]">
                  Bài báo
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-right w-[20%]">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <Users className="size-8 text-primary/20 mx-auto mb-2" />
                    Không tìm thấy giảng viên nào
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lecturer) => (
                  <TableRow
                    key={lecturer.id}
                    className="hover:bg-muted/40 transition-colors group"
                  >
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-semibold text-primary shrink-0 border border-primary/15">
                          {lecturer.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(-2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <Link
                            href={`/admin/lecturers/${lecturer.id}`}
                            className="font-medium text-sm hover:text-primary hover:underline"
                          >
                            {lecturer.name}
                          </Link>
                          <Badge
                            variant="secondary"
                            className="text-[10px] mt-0.5 bg-primary/8 text-primary"
                          >
                            {lecturer.title}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Mail className="size-3.5" />
                          {lecturer.email}
                        </p>
                        {lecturer.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Phone className="size-3.5" />
                            {lecturer.phone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm text-muted-foreground">
                        {lecturer.boMonId != null
                          ? boMonName.get(lecturer.boMonId) ?? lecturer.department
                          : lecturer.department}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                        {paperCounts[lecturer.id] || 0}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Link
                          href={`/admin/lecturers/${lecturer.id}/llkh`}
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" }) + " cursor-pointer opacity-60 hover:opacity-100 hover:text-primary"}
                          title="Lý lịch khoa học"
                        >
                          <ScrollText className="size-4" />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditing(lecturer);
                            setFormOpen(true);
                          }}
                          title="Chỉnh sửa"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer opacity-60 hover:opacity-100 hover:text-destructive"
                          onClick={() => setDeleteTarget(lecturer)}
                          title="Xoá"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Lecturer Form Dialog */}
      <LecturerForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        onSave={handleSave}
        editingLecturer={editing}
        boMon={boMon}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Xoá giảng viên"
        description={`Bạn có chắc chắn muốn xoá giảng viên "${deleteTarget?.name}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá"
        onConfirm={handleDelete}
      />
    </div>
  );
}
