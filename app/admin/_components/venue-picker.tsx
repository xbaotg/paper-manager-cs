"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Search, X, Building2, BookOpen, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VENUES, hydrateVenues, saveCustomVenue, type Venue } from "@/lib/venues";
import { VenueFormDialog } from "./venue-form-dialog";

interface VenuePickerProps {
  value: string;
  onChange: (venue: string, venueObj?: Venue) => void;
  label?: string;
  placeholder?: string;
}

function getRankColor(rank: string) {
  if (!rank) return "bg-muted text-muted-foreground";
  if (rank === "A*") return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
  if (rank === "A") return "bg-orange-500/15 text-orange-700 border-orange-500/30";
  if (rank === "B") return "bg-blue-500/15 text-blue-600 border-blue-500/30";
  if (rank === "Q1") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (rank === "Q2") return "bg-teal-500/15 text-teal-700 border-teal-500/30";
  if (rank === "Q3") return "bg-slate-500/15 text-slate-600 border-slate-500/30";
  if (rank === "Q4") return "bg-gray-500/15 text-gray-600 border-gray-500/30";
  return "bg-muted text-muted-foreground";
}

function getTypeLabel(type: number) {
  if (type === 1) return "Conf";
  if (type === 2) return "Journal";
  return "Other";
}

function getTypeIcon(type: number) {
  if (type === 1) return <Building2 className="size-3.5 text-blue-500" />;
  return <BookOpen className="size-3.5 text-emerald-500" />;
}

export function VenuePicker({
  value,
  onChange,
  label = "Hội nghị / Tạp chí",
  placeholder = "Tìm kiếm hội nghị, tạp chí...",
}: VenuePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Custom Venue Dialog State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [transientVenue, setTransientVenue] = useState<Venue | null>(null);

  // Find the currently selected venue
  const selectedVenue = useMemo(
    () => VENUES.find((v) => v.code === value),
    [value]
  );

  // Load override venues from LS
  useEffect(() => {
    hydrateVenues();
  }, []);

  // Filter venues
  const filtered = useMemo(() => {
    if (!search.trim()) return VENUES.slice(0, 50); // Show first 50 by default
    const q = search.toLowerCase();
    const results = VENUES.filter(
      (v) =>
        v.code.toLowerCase().includes(q) ||
        v.nameEn.toLowerCase().includes(q) ||
        v.nameVi.toLowerCase().includes(q)
    ).slice(0, 50);

    const exactMatch = results.some(v => v.code.toLowerCase() === q);
    if (!exactMatch && search.trim().length >= 2) {
      // Create a transient venue mapped for prompt
      const newCode = search.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) || "NEW";
      results.push({
        id: Date.now(),
        code: `[${newCode}]`,
        nameEn: search.trim(),
        nameVi: search.trim(),
        type: 1, // default to conf
        rank: "Khác", 
        scopusIndexed: 0,
        isCustomChoice: true
      } as any);
    }
    
    return results;
  }, [search, VENUES.length]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightIndex]) {
          const v = filtered[highlightIndex];
          onChange(v.code, v);
          setSearch("");
          setOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  }

  function selectVenue(v: Venue) {
    if ((v as any).isCustomChoice) {
      setTransientVenue({
        ...v,
        code: v.code.replace(/[\[\]]/g, "")
      });
      setSearch("");
      setOpen(false);
      setShowCreateModal(true);
      return;
    }
    onChange(v.code, v);
    setSearch("");
    setOpen(false);
  }

  function handleSaveCustomVenue(newVenue: Venue, isNew: boolean) {
    saveCustomVenue(newVenue);
    onChange(newVenue.code, newVenue);
  }

  function clearVenue() {
    onChange("", undefined);
    setSearch("");
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      {label && (
        <label className="text-sm font-semibold font-heading">
          {label} <span className="text-destructive">*</span>
        </label>
      )}

      {/* Selected venue display or search input */}
      {selectedVenue && !open ? (
        <div className="flex items-center gap-2 h-11 px-3 border border-border rounded-md bg-background hover:bg-accent/50 transition-colors group">
          {getTypeIcon(selectedVenue.type)}
          <span className="font-semibold text-sm text-primary">
            {selectedVenue.code}
          </span>
          <span className="text-sm text-muted-foreground truncate flex-1">
            — {selectedVenue.nameEn}
          </span>
          {selectedVenue.rank && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 border ${getRankColor(selectedVenue.rank)}`}
            >
              {selectedVenue.rank}
            </Badge>
          )}
          {selectedVenue.scopusIndexed === 1 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border border-amber-500/25"
            >
              Scopus
            </Badge>
          )}
          <button
            type="button"
            onClick={clearVenue}
            className="ml-1 p-0.5 rounded hover:bg-destructive/10 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="ml-0.5 p-0.5 rounded hover:bg-accent cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlightIndex(0);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="relative z-50">
          <div
            ref={listRef}
            className="absolute top-0 left-0 right-0 max-h-[280px] overflow-auto rounded-lg border border-border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95"
          >
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Không tìm thấy kết quả
              </div>
            ) : (
              filtered.map((v, idx) => {
                const isCustom = (v as any).isCustomChoice;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm cursor-pointer transition-colors border-b border-border/30 last:border-0 ${
                      idx === highlightIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => selectVenue(v)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                  >
                    {isCustom ? (
                       <div className="flex items-center gap-2 text-indigo-600 font-medium">
                          <Plus className="size-4 shrink-0" />
                          <span>Tạo hội nghị/tạp chí tùy chỉnh: <span className="font-semibold underline decoration-indigo-300 underline-offset-2">"{v.nameEn}"</span></span>
                       </div>
                    ) : (
                      <>
                        {getTypeIcon(v.type)}
                        <span className="font-semibold text-primary min-w-[60px]">
                          {v.code}
                        </span>
                        <span className="text-muted-foreground break-words flex-1 text-xs text-left">
                          {v.nameEn}
                        </span>
                        {v.rank && (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 border shrink-0 ${getRankColor(v.rank)}`}
                          >
                            {v.rank}
                          </Badge>
                        )}
                        {v.scopusIndexed === 1 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border border-amber-500/25 shrink-0"
                          >
                            Scopus
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 shrink-0">
                          {getTypeLabel(v.type)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })
            )}
            {filtered.length >= 50 && (
              <div className="py-2 text-center text-xs text-muted-foreground bg-muted/30">
                Nhập thêm để thu hẹp kết quả...
              </div>
            )}
          </div>
        </div>
      )}

      <VenueFormDialog
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        initialData={transientVenue}
        onSave={handleSaveCustomVenue}
      />
    </div>
  );
}
