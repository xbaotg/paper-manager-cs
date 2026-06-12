"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Printer, Check, ScrollText } from "lucide-react";
import { toast } from "sonner";
import {
  hydrateVenues,
  getVenueByCode,
  getVenueRankShort,
  isVenueScopus,
} from "@/lib/venues";
import { countsAsPublication, type Paper } from "@/lib/data";

interface LlkhExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lecturerName: string;
  lecturerTitle?: string;
  papers: Paper[];
}

interface LlkhGroup {
  label: string;
  items: string[]; // formatted entry text, already ordered
}

const ROMAN = ["I", "II", "III", "IV", "V"];

// Format one paper as an LLKH citation line:
//   Authors (Year), "Title", Venue full name [rank, Scopus].
function formatEntry(p: Paper): string {
  const v = getVenueByCode(p.venue);
  const venueName = v?.nameEn?.trim() || p.venue;
  const rank = (p.quartile || getVenueRankShort(p.venue) || "").trim();
  const tags = [rank, isVenueScopus(p.venue) ? "Scopus" : ""].filter(Boolean).join(", ");
  const authors = p.authors?.trim() || "—";
  return `${authors} (${p.year}), "${p.title}", ${venueName}${tags ? ` [${tags}]` : ""}.`;
}

// Group a lecturer's published/accepted papers into Journals / Conferences /
// Other, newest first within each group.
function buildGroups(papers: Paper[]): LlkhGroup[] {
  const pub = papers
    .filter((p) => countsAsPublication(p.submissionStatus))
    .sort((a, b) => b.year - a.year || b.id - a.id);

  const typeOf = (p: Paper) => getVenueByCode(p.venue)?.type ?? 0;
  const journals = pub.filter((p) => typeOf(p) === 2);
  const confs = pub.filter((p) => typeOf(p) === 1 || typeOf(p) === 4);
  const others = pub.filter((p) => ![1, 2, 4].includes(typeOf(p)));

  return [
    { label: "Bài báo tạp chí", items: journals.map(formatEntry) },
    { label: "Bài báo hội nghị / kỷ yếu", items: confs.map(formatEntry) },
    { label: "Khác", items: others.map(formatEntry) },
  ].filter((g) => g.items.length > 0);
}

function plainText(name: string, title: string | undefined, groups: LlkhGroup[]): string {
  const lines: string[] = [];
  lines.push("LÝ LỊCH KHOA HỌC — DANH MỤC CÔNG BỐ");
  lines.push(`${title ? `${title}. ` : ""}${name}`);
  lines.push("");
  groups.forEach((g, gi) => {
    lines.push(`${ROMAN[gi] ?? gi + 1}. ${g.label.toUpperCase()}`);
    g.items.forEach((it, i) => lines.push(`${i + 1}. ${it}`));
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function printHtml(name: string, title: string | undefined, groups: LlkhGroup[]) {
  const body = groups
    .map((g, gi) => {
      const items = g.items
        .map((it) => `<li>${escapeHtml(it)}</li>`)
        .join("");
      return `<h2>${ROMAN[gi] ?? gi + 1}. ${escapeHtml(g.label)}</h2><ol>${items}</ol>`;
    })
    .join("");

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>LLKH — ${escapeHtml(name)}</title>
<style>
  body{font-family:"Times New Roman",Georgia,serif;max-width:800px;margin:32px auto;padding:0 24px;color:#111;line-height:1.5}
  h1{font-size:18px;text-align:center;margin:0 0 4px}
  .who{text-align:center;font-weight:bold;margin:0 0 20px}
  h2{font-size:14px;margin:18px 0 6px;text-transform:uppercase}
  ol{margin:0 0 8px 0;padding-left:22px}
  li{margin:0 0 6px;text-align:justify}
  @media print{body{margin:0}}
</style></head><body>
<h1>LÝ LỊCH KHOA HỌC — DANH MỤC CÔNG BỐ</h1>
<p class="who">${title ? `${escapeHtml(title)}. ` : ""}${escapeHtml(name)}</p>
${body}
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) {
    toast.error("Trình duyệt chặn cửa sổ in. Hãy dùng nút Sao chép để dán vào file LLKH.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function LlkhExportDialog({
  open,
  onOpenChange,
  lecturerName,
  lecturerTitle,
  papers,
}: LlkhExportDialogProps) {
  const [groups, setGroups] = useState<LlkhGroup[]>([]);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    (async () => {
      // Hydrate so venue full names + ranks resolve custom venues too.
      try { await hydrateVenues(); } catch { /* fall back to static catalog */ }
      if (!cancelled) {
        setGroups(buildGroups(papers));
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, papers]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(plainText(lecturerName, lecturerTitle, groups));
      setCopied(true);
      toast.success("Đã sao chép danh mục công bố.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không sao chép được. Hãy bôi đen và sao chép thủ công.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="size-5 text-indigo-500" />
            Xuất Lý lịch khoa học (LLKH)
          </DialogTitle>
          <DialogDescription>
            Danh mục công bố (bài đã chấp nhận / đã xuất bản) của {lecturerTitle ? `${lecturerTitle}. ` : ""}
            {lecturerName} — sao chép vào file LLKH hoặc in / lưu PDF.
          </DialogDescription>
        </DialogHeader>

        {!ready ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Đang tổng hợp…</div>
        ) : total === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Chưa có bài đã chấp nhận / đã xuất bản để đưa vào LLKH.
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {groups.map((g, gi) => (
              <div key={g.label} className="space-y-2">
                <h3 className="text-sm font-semibold font-heading uppercase tracking-wide">
                  {ROMAN[gi] ?? gi + 1}. {g.label}{" "}
                  <span className="text-muted-foreground font-normal normal-case">({g.items.length})</span>
                </h3>
                <ol className="list-decimal pl-5 space-y-1.5 text-sm">
                  {g.items.map((it, i) => (
                    <li key={i} className="leading-snug text-justify">{it}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-2 border-t pt-4 gap-2">
          <Button variant="outline" onClick={handleCopy} disabled={!ready || total === 0}>
            {copied ? <Check className="size-4 mr-2 text-green-600" /> : <Copy className="size-4 mr-2" />}
            Sao chép
          </Button>
          <Button
            onClick={() => printHtml(lecturerName, lecturerTitle, groups)}
            disabled={!ready || total === 0}
            className="bg-cta text-cta-foreground hover:bg-cta/90"
          >
            <Printer className="size-4 mr-2" />
            In / Lưu PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
