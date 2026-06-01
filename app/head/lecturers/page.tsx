import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { requireHead } from "@/lib/dal";
import { listLecturers } from "@/lib/queries/lecturers";
import { getBoMonById } from "@/lib/queries/bo_mon";
import { ACADEMIC_RANK_LABELS, academicRankFromTitle, type AcademicRank } from "@/lib/data";

export default async function HeadLecturersPage() {
  const me = await requireHead();
  const boMonId = me.boMonId!;
  const bm = getBoMonById(boMonId);
  const lecturers = listLecturers().filter((l) => (l.boMonId ?? null) === boMonId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
          <Users className="size-6 text-primary" /> Giảng viên — {bm?.nameVi ?? "Bộ môn"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{lecturers.length} giảng viên (chỉ xem)</p>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ và tên</TableHead>
              <TableHead>Học hàm/học vị</TableHead>
              <TableHead>Hạng KPI</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lecturers.map((l) => {
              const rank = (l.academicRank ?? academicRankFromTitle(l.title)) as AcademicRank;
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    <Link href={`/head/lecturers/${l.id}`} className="hover:text-primary hover:underline">{l.name}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{rank}</Badge>
                    <span className="text-xs text-muted-foreground ml-2">{ACADEMIC_RANK_LABELS[rank]}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.email}</TableCell>
                </TableRow>
              );
            })}
            {lecturers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Bộ môn chưa có giảng viên.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
