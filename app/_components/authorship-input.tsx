"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Trash2, UserPlus, Building } from "lucide-react";
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

export function AuthorshipInput({ lecturers, value, onChange }: AuthorshipInputProps) {
  const [externalDraft, setExternalDraft] = useState("");

  const moveUp = (index: number) => {
    if (index === 0) return;
    const items = [...value];
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    onChange(items);
  };

  const moveDown = (index: number) => {
    if (index === value.length - 1) return;
    const items = [...value];
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    onChange(items);
  };

  const remove = (index: number) => {
    const items = [...value];
    items.splice(index, 1);
    onChange(items);
  };

  const handleAddExternal = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!externalDraft.trim()) return;
    
    // Split by comma in case user pastes multiple names
    const names = externalDraft.split(",").map(n => n.trim()).filter(Boolean);
    const newItems = names.map(n => ({ type: "external" as const, name: n }));
    
    onChange([...value, ...newItems]);
    setExternalDraft("");
  };

  return (
    <div className="space-y-3">
      {/* List of Authors */}
      <div className="flex flex-col gap-2">
        {value.length === 0 && (
          <div className="text-center py-6 border rounded-lg bg-muted/20 border-dashed text-muted-foreground text-sm">
            Chưa có tác giả nào. Vui lòng thêm bằng các công cụ bên dưới.
          </div>
        )}
        
        {value.map((author, idx) => (
          <div 
            key={`${idx}-${author.name}`} 
            className="flex items-center gap-3 bg-card border shadow-sm p-3 rounded-lg transition-transform"
          >
            <span className="font-mono text-sm font-semibold text-muted-foreground w-5 shrink-0 text-center">
              #{idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm block break-words">{author.name}</span>
              {author.type === "internal" ? (
                <div className="flex items-center mt-1">
                  <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px] px-1.5 py-0">
                    <Building className="size-3 mr-1" />
                    Nội bộ (Khoa KHMT)
                  </Badge>
                  {author.email && <span className="text-[10px] text-muted-foreground ml-2">{author.email}</span>}
                </div>
              ) : (
                <div className="flex items-center mt-1">
                  <Badge variant="secondary" className="bg-slate-500/10 text-slate-500 border-slate-500/20 text-[10px] px-1.5 py-0">
                    <UserPlus className="size-3 mr-1" />
                    Tác giả Ngoài
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Reorder actions */}
            <div className="flex gap-1 shrink-0 px-2 border-x border-border/50">
              <Button 
                variant="ghost" 
                size="icon-sm" 
                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                onClick={() => moveUp(idx)} 
                disabled={idx === 0}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                onClick={() => moveDown(idx)} 
                disabled={idx === value.length - 1}
              >
                <ArrowDown className="size-4" />
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon-sm" 
              className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => remove(idx)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      
      {/* Addition Panel */}
      <div className="flex flex-col items-stretch gap-4 bg-muted/30 p-4 rounded-xl border border-dashed border-border/60 text-left">
        <div className="flex-1 space-y-1.5">
           <label className="text-xs font-semibold uppercase text-muted-foreground font-heading tracking-wider">
             CHỌN TÁC GIẢ NỘI BỘ
           </label>
           <LecturerCombobox
             value={null}
             onChange={(id) => {
               if (id === null) return;
               const l = lecturers.find(x => x.id === id);
               if (l) {
                 // Store the name without the academic-title prefix; the lecturer
                 // link (id) drives the badge. Edit the field for the exact
                 // paper spelling if needed.
                 onChange([...value, { type: "internal", id: l.id, name: l.name, email: l.email }]);
               }
             }}
             lecturers={lecturers}
             placeholder="Tìm giảng viên..."
             nullOptionLabel="-- Thêm giảng viên --"
           />
        </div>
        
        <div className="flex items-center">
          <div className="flex-1 h-px bg-border/80"></div>
          <span className="px-3 text-[10px] font-semibold text-muted-foreground uppercase">HOẶC</span>
          <div className="flex-1 h-px bg-border/80"></div>
        </div>

        <div className="flex-1 space-y-1.5">
           <label className="text-xs font-semibold uppercase text-muted-foreground font-heading tracking-wider">
             NHẬP TÁC GIẢ NGOÀI
           </label>
           <div className="flex gap-2">
             <Input 
               value={externalDraft} 
               onChange={e => setExternalDraft(e.target.value)} 
               placeholder="Nguyễn Văn A, ..."
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddExternal(); } }}
               className="h-9 bg-background"
             />
             <Button type="button" variant="secondary" onClick={handleAddExternal} className="h-9 whitespace-nowrap bg-background shadow-sm hover:bg-accent border border-border">
               Thêm
             </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
