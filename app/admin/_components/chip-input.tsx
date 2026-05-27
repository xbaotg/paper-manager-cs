"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";

export interface ChipItem {
  id: number;
  label: string;
}

interface ChipInputProps {
  items: ChipItem[];
  selected: ChipItem[];
  onChange: (selected: ChipItem[]) => void;
  placeholder?: string;
  label?: string;
}

export function ChipInput({
  items,
  selected,
  onChange,
  placeholder = "Nhập tên...",
  label,
}: ChipInputProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = items.filter(
    (item) =>
      !selected.some((s) => s.id === item.id) &&
      item.label.toLowerCase().includes(query.toLowerCase())
  );

  const addItem = useCallback(
    (item: ChipItem) => {
      onChange([...selected, item]);
      setQuery("");
      setHighlightIdx(0);
      inputRef.current?.focus();
    },
    [selected, onChange]
  );

  const removeItem = useCallback(
    (id: number) => {
      onChange(selected.filter((s) => s.id !== id));
    },
    [selected, onChange]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Backspace" && query === "" && selected.length > 0) {
      removeItem(selected[selected.length - 1].id);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && filtered.length > 0 && open) {
      e.preventDefault();
      addItem(filtered[highlightIdx]);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="text-sm font-semibold font-heading block mb-2">
          {label}
        </label>
      )}
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-primary/50 transition-all cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-sm font-medium border border-primary/20 animate-in fade-in-0 zoom-in-95 duration-150"
          >
            {item.label}
            <button
              type="button"
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                removeItem(item.id);
              }}
              aria-label={`Xoá ${item.label}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : "Thêm..."}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          autoComplete="off"
        />
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto animate-in fade-in-0 slide-in-from-top-2 duration-150">
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`w-full text-left px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                idx === highlightIdx
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-foreground"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                addItem(item);
              }}
              onMouseEnter={() => setHighlightIdx(idx)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl p-3 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-top-2 duration-150">
          Không tìm thấy giảng viên nào
        </div>
      )}
    </div>
  );
}
