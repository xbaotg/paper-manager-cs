"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  findPapersForLecturer,
  applyLecturerToPapers,
  type AttributionCandidate,
} from "@/app/actions/attribution";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lecturer: { id: number; name: string } | null;
  // Called after applying so the parent can refresh its paper-derived state.
  onApplied?: () => void;
}

export function LecturerAttributionDialog({ open, onOpenChange, lecturer, onApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AttributionCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open || !lecturer) return;
    let cancelled = false;
    setLoading(true);
    setItems(null);
    setSelected(new Set());
    findPapersForLecturer(lecturer.id)
      .then((res) => {
        if (cancelled) return;
        setItems(res);
        // Pre-select the high-confidence matches (>= 0.9).
        setSelected(new Set(res.filter((c) => c.score >= 0.9).map((c) => c.paperId)));
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, lecturer]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApply() {
    if (!lecturer || !items) return;
    const chosen = items.filter((c) => selected.has(c.paperId));
    if (chosen.length === 0) return;
    setApplying(true);
    try {
      const res = await applyLecturerToPapers(
        lecturer.id,
        chosen.map((c) => ({ paperId: c.paperId, authorIndex: c.authorIndex }))
      );
      if (res.ok) {
        toast.success(`Đã gán ${lecturer.name} vào ${res.updated} bài báo`);
        onApplied?.();
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Gán thất bại");
      }
    } finally {
      setApplying(false);
    }
  }

  const allSelected = !!items && items.length > 0 && selected.size === items.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!applying) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[720px] max-h-[88vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="size-5 text-primary" /> Gán giảng viên vào bài báo
          </DialogTitle>
          <DialogDescription>
            Tìm các bài có tác giả (ngoài khoa) trùng tên với{" "}
            <span className="font-semibold text-foreground">{lecturer?.name}</span> rồi gán thành tác giả
            nội bộ — giữ nguyên thứ tự tác giả.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin" /> Đang quét các bài báo…
          </div>
        ) : !items || items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Không tìm thấy bài nào có tác giả ngoài khoa trùng tên.
          </p>
        ) : (
          <div className="flex flex-col gap-3 py-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Tìm thấy <strong className="text-foreground">{items.length}</strong> bài • chọn {selected.size}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((c) => c.paperId)))}
              >
                {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </Button>
            </div>

            <div className="divide-y rounded-lg border">
              {items.map((c) => (
                <label key={c.paperId} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 cursor-pointer accent-primary shrink-0"
                    checked={selected.has(c.paperId)}
                    onChange={() => toggle(c.paperId)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{c.year}</span>
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="size-3" /> khớp: <span className="font-medium text-foreground">{c.matchedName}</span>
                      </span>
                      <Badge variant="outline" className="text-[10px]">{Math.round(c.score * 100)}%</Badge>
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5 break-words line-clamp-1">{c.authors}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {items && items.length > 0 && (
          <DialogFooter className="mt-2 border-t pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={applying}>Huỷ</Button>
            <Button
              onClick={handleApply}
              disabled={applying || selected.size === 0}
              className="bg-cta text-cta-foreground hover:bg-cta/90"
            >
              {applying ? <Loader2 className="size-4 animate-spin mr-2" /> : <UserCheck className="size-4 mr-2" />}
              Gán {selected.size} bài
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
