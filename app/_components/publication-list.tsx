"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { isUnpublished, type SubmissionStatus } from "@/lib/data";
import { SubmissionStatusBadge } from "@/app/_components/submission-status-badge";

// Venue-derived fields are resolved server-side (the venue catalog is only
// hydrated on the server) and passed in pre-computed, so this client component
// just sorts + renders.
export interface PublicationItem {
  id: number;
  year: number;
  title: string;
  venue: string;
  venueRank: string;
  bucket: string;
  isScopus: boolean;
  submissionStatus?: SubmissionStatus;
  credited: boolean;
}

export function PublicationList({ items }: { items: PublicationItem[] }) {
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const sorted = useMemo(
    () => [...items].sort((a, b) => (dir === "desc" ? b.year - a.year : a.year - b.year) || b.id - a.id),
    [items, dir]
  );

  return (
    <div className="rounded-md border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">
              <button
                type="button"
                onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
                className="inline-flex items-center gap-1 hover:text-primary cursor-pointer"
                title={dir === "desc" ? "Năm: mới → cũ (bấm để đảo)" : "Năm: cũ → mới (bấm để đảo)"}
              >
                Năm <ArrowDownUp className="size-3" />
                <span className="text-[10px] text-muted-foreground">{dir === "desc" ? "↓" : "↑"}</span>
              </button>
            </TableHead>
            <TableHead>Bài báo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">Chưa có công bố.</TableCell></TableRow>
          )}
          {sorted.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="align-top font-medium pt-4">{p.year}</TableCell>
              <TableCell className="align-top pt-4 pb-4">
                <Link href={`/papers/${p.id}`} className="font-medium hover:text-primary hover:underline inline-flex items-start gap-1">
                  {p.title}
                  <ArrowUpRight className="size-3 mt-1 shrink-0 opacity-50" />
                </Link>
                <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                  {p.venue ? <span>{p.venue}</span> : <i>Chưa rõ nơi đăng</i>}
                  {p.venueRank && <Badge variant="outline" className="text-[10px]" title={p.bucket}>{p.venueRank}</Badge>}
                  {isUnpublished(p.submissionStatus) && <SubmissionStatusBadge status={p.submissionStatus} className="text-[10px]" />}
                  {p.isScopus && <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/40">Scopus</Badge>}
                  {p.credited && <Badge variant="outline" className="text-[10px] text-primary border-primary/40">Được tính KPI</Badge>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
