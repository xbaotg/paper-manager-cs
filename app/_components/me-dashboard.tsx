"use client";

import Link from "next/link";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Award, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PaperFormAdmin } from "@/app/admin/_components/paper-form-admin";
import { ConfirmDialog } from "@/app/admin/_components/confirm-dialog";
import { addPaperServer, updatePaperServer, deletePaperServer } from "@/app/actions";
import { getPaperImpactScore, getVenueRankBucket } from "@/lib/venues";
import type { Paper, Lecturer } from "@/lib/data";

export function MeDashboard({
  lecturerId,
  lecturerName,
  initialPapers,
  lecturers,
}: {
  lecturerId: number;
  lecturerName: string;
  initialPapers: Paper[];
  lecturers: Lecturer[];
}) {
  const [papers, setPapers] = useState<Paper[]>(initialPapers);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Paper | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Paper | null>(null);
  const [, startTransition] = useTransition();

  const totalImpact = useMemo(
    () => papers.reduce((s, p) => s + getPaperImpactScore(p.venue), 0),
    [papers]
  );

  // Keep only this lecturer's papers from a full DB snapshot.
  function mine(all: Paper[]): Paper[] {
    return all.filter((p) => p.lecturerIds?.includes(lecturerId));
  }

  function handleSave(paper: Paper) {
    startTransition(async () => {
      try {
        const db = editing
          ? await updatePaperServer(editing.id, paper)
          : await addPaperServer(paper);
        setPapers(mine(db.papers));
        toast.success(editing ? "Đã cập nhật bài báo" : "Đã thêm bài báo");
        setFormOpen(false);
        setEditing(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      try {
        const db = await deletePaperServer(target.id);
        setPapers(mine(db.papers));
        toast.success("Đã xoá bài báo");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra");
      }
      setDeleteTarget(null);
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight">Bài báo của tôi</h1>
          <p className="text-sm text-muted-foreground mt-1">{lecturerName}</p>
        </div>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="cursor-pointer gap-1.5"
        >
          <Plus className="size-4" /> Thêm bài báo
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{papers.length}</div>
              <div className="text-xs text-muted-foreground">Tổng bài báo</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Award className="size-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{totalImpact.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Điểm công bố (ước tính)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên bài báo</TableHead>
              <TableHead className="w-20">Năm</TableHead>
              <TableHead className="w-28">Nơi đăng</TableHead>
              <TableHead className="w-24 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {papers.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/papers/${p.id}`} className="font-medium hover:text-primary hover:underline">{p.title}</Link>
                  <div className="text-xs text-muted-foreground truncate max-w-md">{p.authors}</div>
                </TableCell>
                <TableCell>{p.year}</TableCell>
                <TableCell>
                  <Badge variant="outline" title={getVenueRankBucket(p.venue)}>{p.venue}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center justify-center size-8 rounded-md hover:bg-muted text-muted-foreground">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                    <Button variant="ghost" size="icon-sm" className="cursor-pointer"
                            onClick={() => { setEditing(p); setFormOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="cursor-pointer text-destructive"
                            onClick={() => setDeleteTarget(p)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {papers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Chưa có bài báo nào. Nhấn “Thêm bài báo” để bắt đầu.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaperFormAdmin
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        onSave={handleSave}
        lecturers={lecturers}
        editingPaper={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Xoá bài báo?"
        description={`"${deleteTarget?.title ?? ""}" sẽ bị xoá khỏi danh sách.`}
        confirmLabel="Xoá"
        onConfirm={handleDelete}
      />
    </div>
  );
}
