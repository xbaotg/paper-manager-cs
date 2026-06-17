"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import type { Lecturer } from "@/lib/data";

interface LecturerComboboxProps {
  lecturers: Lecturer[];
  value: number | null;
  onChange: (id: number | null) => void;
  topMatches?: { lecturer: Lecturer; score: number }[];
  // Lecturers to surface first when there is no active search (e.g. the byline's
  // internal authors). Shown without a match-score label, unlike `topMatches`.
  priorityLecturers?: Lecturer[];
  placeholder?: string;
  isHighConfidence?: boolean;
  nullOptionLabel?: string;
}

export function LecturerCombobox({
  lecturers,
  value,
  onChange,
  topMatches = [],
  priorityLecturers = [],
  placeholder = "Tìm kiếm giảng viên...",
  isHighConfidence = false,
  nullOptionLabel = "Khách / Ngoài khoa",
}: LecturerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedLecturer = useMemo(
    () => lecturers.find((l) => l.id === value),
    [lecturers, value]
  );

  // The option used when value is null
  const nullOption = { id: null, name: nullOptionLabel };

  const filtered = useMemo(() => {
    let result: any[] = [];
    
    if (!search.trim()) {
      // No search: prefer the caller's priority list (e.g. byline authors), then
      // fuzzy top matches, then the first handful of all lecturers.
      if (priorityLecturers.length > 0) {
        result = priorityLecturers;
      } else if (topMatches.length > 0) {
        result = topMatches.map(m => m.lecturer);
      } else {
        result = lecturers.slice(0, 10);
      }
    } else {
      const q = search.toLowerCase();
      result = lecturers.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.department?.toLowerCase().includes(q)
      ).slice(0, 20);
    }
    
    // Always insert null option at the top or bottom
    return [nullOption, ...result];
  }, [search, lecturers, topMatches, priorityLecturers]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        const item = filtered[highlightIndex];
        if (item) {
          onChange(item.id);
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

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={`flex h-9 w-full items-center justify-between rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          value !== null ? (isHighConfidence ? "border-green-500/50 bg-green-500/5" : "border-indigo-500/50 bg-indigo-500/5") : "border-input bg-transparent"
        }`}
      >
        <span className={`truncate min-w-0 ${value === null ? "text-muted-foreground" : "font-medium"}`}>
          {value === null ? nullOptionLabel : `${selectedLecturer?.title || ""}. ${selectedLecturer?.name}`}
        </span>
        <ChevronDown className="size-4 opacity-50 shrink-0 ml-2" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-10 left-0 right-0 z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 size-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          
          <div ref={listRef} className="max-h-[200px] overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="py-2 text-center text-sm text-muted-foreground">Không tìm thấy giảng viên</div>
            ) : (
              filtered.map((item, idx) => {
                const isSelected = value === item.id;
                const isHighlight = idx === highlightIndex;
                
                // Show matching score if it's from topMatches and no active search
                let scoreText = "";
                if (!search && item.id !== null) {
                  const tm = topMatches.find(m => m.lecturer.id === item.id);
                  if (tm) scoreText = `(Khớp: ${Math.round(tm.score * 100)}%)`;
                }

                return (
                  <button
                    key={item.id === null ? "external" : item.id}
                    type="button"
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer ${
                      isHighlight ? "bg-accent text-accent-foreground" : ""
                    }`}
                    onClick={() => {
                      onChange(item.id);
                      setSearch("");
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                  >
                    <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                      <span className={`break-words ${item.id === null ? "italic text-muted-foreground" : "font-medium"}`}>
                        {item.id === null ? item.name : `${item.title}. ${item.name}`}
                      </span>
                      {item.id !== null && (
                        <span className="text-[10px] text-muted-foreground break-words">
                          {item.email} {item.department && `- ${item.department}`} {scoreText}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="size-4 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
