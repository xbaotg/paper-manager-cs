"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScrollText, Search, ExternalLink, FileDown, FlaskConical, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { LlkhAggregate } from "@/app/actions/llkh";
import type { LlkhProjectRow, LlkhSupervisionRow } from "@/lib/queries/llkh";

type Tab = "projects" | "supervision";

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function LlkhAggregateView({ initial }: { initial: LlkhAggregate }) {
  const [tab, setTab] = useState<Tab>("projects");
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const projects = useMemo(() => {
    if (!needle) return initial.projects;
    return initial.projects.filter((p) =>
      [p.lecturerName, p.ten, p.maSo, p.vaiTro].some((s) => (s ?? "").toLowerCase().includes(needle))
    );
  }, [initial.projects, needle]);
  const supervision = useMemo(() => {
    if (!needle) return initial.supervision;
    return initial.supervision.filter((s) =>
      [s.lecturerName, s.ten, s.luanAn, s.bac].some((x) => (x ?? "").toLowerCase().includes(needle))
    );
  }, [initial.supervision, needle]);

  function exportProjects() {
    downloadCsv(
      "De-tai-du-an-LLKH.csv",
      ["Giảng viên", "Tên đề tài/dự án", "Mã số & cấp QL", "Thời gian", "Kinh phí (triệu)", "Vai trò", "Ngày nghiệm thu", "Kết quả"],
      projects.map((p) => [p.lecturerName, p.ten, p.maSo, p.thoiGian, p.kinhPhi, p.vaiTro, p.ngayNghiemThu, p.ketQua])
    );
  }
  function exportSupervision() {
    downloadCsv(
      "Huong-dan-LLKH.csv",
      ["Giảng viên", "Tên SV/HVCH/NCS", "Tên luận án", "Năm tốt nghiệp", "Bậc đào tạo", "Sản phẩm (mã số)"],
      supervision.map((s) => [s.lecturerName, s.ten, s.luanAn, s.namTN, s.bac, s.sanPham])
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
            <ScrollText className="size-6 text-primary" /> Đề tài & Hướng dẫn
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tổng hợp đề tài/dự án và hướng dẫn SV/HVCH/NCS từ lý lịch khoa học của tất cả giảng viên.
            Sửa bằng cách mở LLKH của từng giảng viên.
          </p>
        </div>
        <Button variant="outline" onClick={tab === "projects" ? exportProjects : exportSupervision} className="cursor-pointer gap-1.5 shrink-0">
          <FileDown className="size-4" /> Xuất CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-1.5">
          <Button
            variant={tab === "projects" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("projects")}
            className="cursor-pointer gap-1.5"
          >
            <FlaskConical className="size-4" /> Đề tài ({initial.projects.length})
          </Button>
          <Button
            variant={tab === "supervision" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("supervision")}
            className="cursor-pointer gap-1.5"
          >
            <GraduationCap className="size-4" /> Hướng dẫn ({initial.supervision.length})
          </Button>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo giảng viên, tên, mã số..." className="pl-9" />
        </div>
      </div>

      {tab === "projects" ? (
        <ProjectsTable rows={projects} />
      ) : (
        <SupervisionTable rows={supervision} />
      )}
    </div>
  );
}

function EditLink({ lecturerId }: { lecturerId: number }) {
  return (
    <Link
      href={`/admin/lecturers/${lecturerId}/llkh`}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
      title="Mở LLKH của giảng viên để sửa"
    >
      Mở LLKH <ExternalLink className="size-3" />
    </Link>
  );
}

function ProjectsTable({ rows }: { rows: LlkhProjectRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-8 text-center">Chưa có đề tài/dự án nào.</p>;
  }
  return (
    <div className="rounded-xl border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Giảng viên</TableHead>
            <TableHead>Tên đề tài / dự án</TableHead>
            <TableHead>Mã số & cấp QL</TableHead>
            <TableHead>Thời gian</TableHead>
            <TableHead>Kinh phí</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead>Nghiệm thu</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium whitespace-nowrap">{p.lecturerName}</TableCell>
              <TableCell className="max-w-xs">{p.ten || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{p.maSo || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{p.thoiGian || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{p.kinhPhi || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{p.vaiTro || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{p.ngayNghiemThu || "—"}</TableCell>
              <TableCell><EditLink lecturerId={p.lecturerId} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SupervisionTable({ rows }: { rows: LlkhSupervisionRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-8 text-center">Chưa có hướng dẫn nào.</p>;
  }
  return (
    <div className="rounded-xl border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Giảng viên</TableHead>
            <TableHead>Tên SV / HVCH / NCS</TableHead>
            <TableHead>Tên luận án</TableHead>
            <TableHead>Năm TN</TableHead>
            <TableHead>Bậc</TableHead>
            <TableHead>Sản phẩm</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium whitespace-nowrap">{s.lecturerName}</TableCell>
              <TableCell className="whitespace-nowrap">{s.ten || "—"}</TableCell>
              <TableCell className="max-w-xs">{s.luanAn || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{s.namTN || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{s.bac || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{s.sanPham || "—"}</TableCell>
              <TableCell><EditLink lecturerId={s.lecturerId} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
