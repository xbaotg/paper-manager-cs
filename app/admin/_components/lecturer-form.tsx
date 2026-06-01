"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, RotateCcw } from "lucide-react";
import {
  type Lecturer,
  type LecturerTitle,
  type AcademicRank,
  LECTURER_TITLE_LABELS,
  ACADEMIC_RANK_LABELS,
  academicRankFromTitle,
} from "@/lib/data";
import type { BoMon } from "@/lib/queries/bo_mon";

interface LecturerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (lecturer: Lecturer) => void;
  editingLecturer?: Lecturer | null;
  boMon: BoMon[];
}

const emptyForm = {
  name: "",
  email: "",
  title: "ThS" as LecturerTitle,
  academicRank: "ThS" as AcademicRank,
  boMonId: "" as string,
  department: "Khoa Khoa học máy tính",
  phone: "",
};

export function LecturerForm({
  open,
  onOpenChange,
  onSave,
  editingLecturer,
  boMon,
}: LecturerFormProps) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (editingLecturer) {
      setForm({
        name: editingLecturer.name,
        email: editingLecturer.email,
        title: editingLecturer.title,
        academicRank: editingLecturer.academicRank ?? academicRankFromTitle(editingLecturer.title),
        boMonId: editingLecturer.boMonId != null ? String(editingLecturer.boMonId) : "",
        department: editingLecturer.department,
        phone: editingLecturer.phone || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingLecturer, open]);

  // When the title changes, keep the normalized rank in sync unless it was
  // manually set to NCS (which no title implies).
  function handleTitleChange(val: LecturerTitle) {
    setForm((f) => ({
      ...f,
      title: val,
      academicRank: f.academicRank === "NCS" ? "NCS" : academicRankFromTitle(val),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) return;

    const lecturer: Lecturer = {
      id: editingLecturer?.id ?? Date.now(),
      name: form.name.trim(),
      email: form.email.trim(),
      title: form.title,
      department: form.department.trim(),
      phone: form.phone.trim() || undefined,
      academicRank: form.academicRank,
      boMonId: form.boMonId ? Number(form.boMonId) : null,
    };

    onSave(lecturer);
    onOpenChange(false);
    setForm(emptyForm);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingLecturer ? "Chỉnh sửa giảng viên" : "Thêm giảng viên mới"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold font-heading">
              Họ và tên <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="VD: Nguyễn Văn A"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold font-heading">
              Email <span className="text-destructive">*</span>
            </label>
            <Input
              type="email"
              placeholder="VD: a.nguyen@uit.edu.vn"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold font-heading">
                Học hàm / Học vị
              </label>
              <Select
                value={form.title}
                onValueChange={(val) => handleTitleChange(val as LecturerTitle)}
              >
                <SelectTrigger className="h-11 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LECTURER_TITLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="cursor-pointer">
                      {k} — {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold font-heading">
                Điện thoại
              </label>
              <Input
                type="tel"
                placeholder="VD: 0912345678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-11"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold font-heading">
                Hạng KPI (học hàm/học vị)
              </label>
              <Select
                value={form.academicRank}
                onValueChange={(val) =>
                  setForm({ ...form, academicRank: val as AcademicRank })
                }
              >
                <SelectTrigger className="h-11 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACADEMIC_RANK_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="cursor-pointer">
                      {k} — {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Dùng để áp chỉ tiêu công bố theo hạng. Chọn NCS cho nghiên cứu sinh.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold font-heading">Bộ môn</label>
              <Select
                value={form.boMonId || "none"}
                onValueChange={(val) =>
                  setForm({ ...form, boMonId: val && val !== "none" ? val : "" })
                }
              >
                <SelectTrigger className="h-11 cursor-pointer">
                  <SelectValue placeholder="Chọn bộ môn..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">
                    — Chưa phân bộ môn —
                  </SelectItem>
                  {boMon.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)} className="cursor-pointer">
                      {b.code} — {b.nameVi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold font-heading">
              Đơn vị
            </label>
            <Input
              placeholder="VD: Khoa Khoa học máy tính"
              value={form.department}
              onChange={(e) =>
                setForm({ ...form, department: e.target.value })
              }
              className="h-11"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 cursor-pointer h-11"
              onClick={() => onOpenChange(false)}
            >
              <RotateCcw className="size-4" data-icon="inline-start" />
              Huỷ bỏ
            </Button>
            <Button
              type="submit"
              className="flex-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11"
            >
              <Save className="size-4" data-icon="inline-start" />
              {editingLecturer ? "Cập nhật" : "Thêm mới"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
