"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, Building, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LecturerCombobox } from "@/app/_components/lecturer-combobox";
import type { Lecturer } from "@/lib/data";

export type AuthorEntry =
  | { type: "internal"; id: number; name: string; email?: string }
  | { type: "external"; name: string };

interface AuthorshipInputProps {
  lecturers: Lecturer[];
  value: AuthorEntry[];
  onChange: (val: AuthorEntry[]) => void;
}

// Each author has a display NAME (verbatim as written in the paper) and, separately,
// an optional link to an internal lecturer. Linking never changes the display name —
// the byline keeps "Tien Do" while the chip is attributed to lecturer "Đỗ Văn Tiến".
export function AuthorshipInput({ lecturers, value, onChange }: AuthorshipInputProps) {
  const [draft, setDraft] = useState("");
  const byId = (id: number) => lecturers.find((l) => l.id === id);

  const moveUp = (i: number) => {
    if (i === 0) return;
    const items = [...value];
    [items[i - 1], items[i]] = [items[i], items[i - 1]];
    onChange(items);
  };
  const moveDown = (i: number) => {
    if (i === value.length - 1) return;
    const items = [...value];
    [items[i + 1], items[i]] = [items[i], items[i + 1]];
    onChange(items);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const setName = (i: number, name: string) =>
    onChange(value.map((a, idx) => (idx === i ? { ...a, name } : a)));

  // Link / unlink an author to a lecturer WITHOUT touching its display name.
  const setLink = (i: number, lecturerId: number | null) => {
    onChange(
      value.map((a, idx) => {
        if (idx !== i) return a;
        if (lecturerId == null) return { type: "external", name: a.name };
        const l = byId(lecturerId);
        return { type: "internal", id: lecturerId, name: a.name, email: l?.email };
      })
    );
  };

  const addAuthor = () => {
    const names = draft.split(",").map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    onChange([...value, ...names.map((n) => ({ type: "external" as const, name: n }))]);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {value.length === 0 && (
          <div className="text-center py-6 border rounded-lg bg-muted/20 border-dashed text-muted-foreground text-sm">
            Chưa có tác giả nào. Nhập tên bên dưới (đúng như trong bài).
          </div>
        )}

        {value.map((author, idx) => {
          const linked = author.type === "internal" ? byId(author.id) : null;
          return (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-card border shadow-sm p-3 rounded-lg">
              <span className="font-mono text-sm font-semibold text-muted-foreground w-6 shrink-0 text-center">
                #{idx + 1}
              </span>

              {/* Display name — verbatim from the paper, always editable */}
              <Input
                value={author.name}
                onChange={(e) => setName(idx, e.target.value)}
                placeholder="Tên tác giả như trong bài"
                className="h-9 flex-1 min-w-0 font-medium"
              />

              {/* Internal lecturer link (or external) */}
              <div className="sm:w-[230px] shrink-0">
                <LecturerCombobox
                  lecturers={lecturers}
                  value={author.type === "internal" ? author.id : null}
                  onChange={(id) => setLink(idx, id)}
                  nullOptionLabel="— Tác giả ngoài —"
                  placeholder="Ngoài / chọn GV nội bộ"
                />
              </div>

              {/* Status badge */}
              <div className="shrink-0">
                {author.type === "internal" ? (
                  <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px] px-1.5 py-0 whitespace-nowrap" title={linked ? `${linked.title}. ${linked.name}` : undefined}>
                    <Building className="size-3 mr-1" /> Nội bộ{linked ? ` · ${linked.name}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-slate-500/10 text-slate-500 border-slate-500/20 text-[10px] px-1.5 py-0 whitespace-nowrap">
                    <UserPlus className="size-3 mr-1" /> Ngoài
                  </Badge>
                )}
              </div>

              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => moveUp(idx)} disabled={idx === 0}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => moveDown(idx)} disabled={idx === value.length - 1}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(idx)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add author(s) by name, then link each to a lecturer above if internal.
          A plain div (not a nested form) so it can live inside the paper form. */}
      <div className="flex gap-2 bg-muted/30 p-3 rounded-xl border border-dashed border-border/60">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAuthor(); } }}
          placeholder="Thêm tác giả (tên như trong bài, phân tách bằng dấu phẩy)"
          className="h-9 bg-background"
        />
        <Button type="button" onClick={addAuthor} variant="secondary" className="h-9 whitespace-nowrap bg-background shadow-sm hover:bg-accent border border-border">
          <Plus className="size-4 mr-1" /> Thêm
        </Button>
      </div>
    </div>
  );
}
