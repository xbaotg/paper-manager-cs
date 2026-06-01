"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "./confirm-dialog";
import {
  createBoMonAction,
  updateBoMonAction,
  deleteBoMonAction,
  type BoMonListItem,
} from "@/app/actions/bo_mon";

export function BoMonManager({ initial }: { initial: BoMonListItem[] }) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BoMonListItem | null>(null);
  const [code, setCode] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [nameEn, setNameEn] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<BoMonListItem | null>(null);

  function openCreate() {
    setEditing(null);
    setCode("");
    setNameVi("");
    setNameEn("");
    setDialogOpen(true);
  }

  function openEdit(b: BoMonListItem) {
    setEditing(b);
    setCode(b.code);
    setNameVi(b.nameVi);
    setNameEn(b.nameEn);
    setDialogOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const res = editing
        ? await updateBoMonAction(editing.id, { code, nameVi, nameEn })
        : await createBoMonAction({ code, nameVi, nameEn });
      if (res.ok) {
        if (res.data) setItems(res.data);
        toast.success(editing ? "Đã cập nhật bộ môn" : "Đã tạo bộ môn");
        setDialogOpen(false);
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const res = await deleteBoMonAction(target.id);
      if (res.ok) {
        if (res.data) setItems(res.data);
        toast.success("Đã xoá bộ môn");
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
      setDeleteTarget(null);
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> Bộ môn
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} bộ môn · dùng cho phân công và tổng hợp KPI theo bộ môn
          </p>
        </div>
        <Button onClick={openCreate} className="cursor-pointer gap-1.5">
          <Plus className="size-4" /> Thêm bộ môn
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Tên bộ môn</TableHead>
              <TableHead className="text-center">Giảng viên</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono font-medium">{b.code}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{b.nameVi}</div>
                  {b.nameEn && <div className="text-xs text-muted-foreground">{b.nameEn}</div>}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{b.lecturerCount}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" className="cursor-pointer" title="Sửa" onClick={() => openEdit(b)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="cursor-pointer text-destructive"
                      title="Xoá"
                      onClick={() => setDeleteTarget(b)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Chưa có bộ môn nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa bộ môn" : "Thêm bộ môn"}</DialogTitle>
            <DialogDescription>Mã bộ môn phải là duy nhất (vd: TTNT, ĐPT).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mã bộ môn</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="vd: TTNT" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tên (Tiếng Việt)</label>
              <Input value={nameVi} onChange={(e) => setNameVi(e.target.value)} placeholder="vd: Trí tuệ Nhân tạo" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tên (Tiếng Anh)</label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="vd: Artificial Intelligence" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Huỷ</Button>
            <Button onClick={handleSave} disabled={pending} className="cursor-pointer">
              {pending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Xoá bộ môn?"
        description={`Bộ môn "${deleteTarget?.nameVi}" sẽ bị xoá. Giảng viên thuộc bộ môn này sẽ được đưa về bộ môn mặc định ở lần khởi động kế tiếp.`}
        confirmLabel="Xoá"
        onConfirm={handleDelete}
      />
    </div>
  );
}
