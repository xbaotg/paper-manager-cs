"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Venue } from "@/lib/venues";
import { issnByName, type IssnHit } from "@/lib/issn";

interface VenueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Venue | null;
  /** Force "create" mode even with prefilled initialData (e.g. a draft from the
   *  venue picker), so the code stays editable. Defaults to inferring from
   *  initialData (present = edit existing). */
  isNew?: boolean;
  onSave: (venue: Venue, isNew: boolean) => void;
}

export function VenueFormDialog({ open, onOpenChange, initialData, isNew, onSave }: VenueFormDialogProps) {
  const [customCode, setCustomCode] = useState("");
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState(1);
  const [customRank, setCustomRank] = useState("Khác");
  const [customScopus, setCustomScopus] = useState(0);
  const [customIssn, setCustomIssn] = useState("");
  const [issnHits, setIssnHits] = useState<IssnHit[] | null>(null);
  const [issnLoading, setIssnLoading] = useState(false);

  // Editing an EXISTING venue locks the code (papers reference it). A prefilled
  // draft (isNew) is still a create, so its code stays editable.
  const isEditing = isNew !== undefined ? !isNew : !!initialData;

  useEffect(() => {
    if (open) {
      setIssnHits(null);
      if (initialData) {
        setCustomCode(initialData.code || "");
        setCustomName(initialData.nameEn || "");
        setCustomType(initialData.type || 1);
        setCustomRank(initialData.rank || "Khác");
        setCustomScopus(initialData.scopusIndexed || 0);
        setCustomIssn(initialData.issn || "");
      } else {
        setCustomCode("");
        setCustomName("");
        setCustomType(1);
        setCustomRank("Khác");
        setCustomScopus(0);
        setCustomIssn("");
      }
    }
  }, [open, initialData]);

  // Suggest ISSNs for the name typed above. Several journals can share a name
  // ("Informatica"), so this offers the candidates and lets a human choose
  // rather than guessing — the batch fill on the venue list already took every
  // case that could be decided automatically.
  async function handleFindIssn() {
    setIssnLoading(true);
    try {
      const hits = await issnByName(customName);
      setIssnHits(hits);
      if (hits.length === 1) setCustomIssn(hits[0].issn);
    } finally {
      setIssnLoading(false);
    }
  }

  function handleSave() {
    if (!customCode.trim() || !customName.trim()) {
      alert("Vui lòng nhập Tên hiển thị và Mã Code.");
      return;
    }

    const result: Venue = {
      ...(initialData || { id: Date.now() }), // Keep existing ID or create new
      code: customCode.trim().toUpperCase(),
      nameEn: customName.trim(),
      nameVi: customName.trim(),
      type: customType,
      rank: customRank,
      scopusIndexed: customScopus,
      issn: customIssn.trim()
    };

    onSave(result, !isEditing);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Chỉnh sửa Hội nghị/Tạp chí" : "Tạo Hội nghị / Tạp chí mới"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Chỉnh sửa thông tin này sẽ áp dụng ưu tiên trên dữ liệu gốc." : "Nhập thông tin cho hội nghị/tạp chí tùy chỉnh hiện tại."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Tên hiển thị</label>
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="ABC Conference 2024" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Mã code</label>
            <Input 
              value={customCode} 
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())} 
              placeholder="ABC24" 
              disabled={isEditing} 
            />
            {isEditing && <span className="text-xs text-muted-foreground">Không thể thay đổi mã của hội nghị/tạp chí đã tồn tại.</span>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Loại hình</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                value={customType}
                onChange={(e) => setCustomType(Number(e.target.value))}
              >
                <option value={1}>Hội nghị (Conf)</option>
                <option value={2}>Tạp chí (Journal)</option>
                <option value={3}>Khác (Other)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Scopus Indexed</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                value={customScopus}
                onChange={(e) => setCustomScopus(Number(e.target.value))}
              >
                <option value={0}>Không (No)</option>
                <option value={1}>Có (Yes)</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Xếp hạng công bố (Rank)</label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              value={customRank}
              onChange={(e) => setCustomRank(e.target.value)}
            >
              <option value="Khác">Khác / Chưa phân loại</option>
              <option value="A*">A*</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">ISSN</label>
            <div className="flex gap-2">
              <Input
                value={customIssn}
                onChange={(e) => setCustomIssn(e.target.value)}
                placeholder="2169-3536"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleFindIssn}
                disabled={issnLoading || customName.trim().length < 3}
                className="shrink-0"
              >
                {issnLoading ? "Đang tra…" : "Tra ISSN"}
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              Dùng cho form STM và mẫu D03. Tra theo tên hiển thị ở trên (nguồn: OpenAlex).
            </span>
            {issnHits?.length === 0 && (
              <span className="text-xs text-amber-600">Không tìm thấy tạp chí nào khớp tên này.</span>
            )}
            {!!issnHits?.length && (
              <div className="flex flex-col gap-1">
                {issnHits.map((h) => (
                  <button
                    key={h.issn}
                    type="button"
                    onClick={() => setCustomIssn(h.issn)}
                    className={`flex items-baseline gap-2 rounded-md border px-2 py-1 text-left text-xs hover:bg-muted ${
                      h.issn === customIssn ? "border-primary bg-primary/5" : "border-transparent"
                    }`}
                  >
                    <span className="font-mono shrink-0">{h.issn}</span>
                    <span className="truncate text-muted-foreground">{h.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave}>Lưu thông tin</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
