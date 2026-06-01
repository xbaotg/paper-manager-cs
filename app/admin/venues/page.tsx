"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Building2, BookOpen, Search, Plus, Trash2, Edit, ChevronLeft, ChevronRight, AlertTriangle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VenueFormDialog } from "../_components/venue-form-dialog";
import { 
  VENUES, 
  hydrateVenues, 
  deleteVenue, 
  saveCustomVenue, 
  editVenue,
  type Venue 
} from "@/lib/venues";

const ITEMS_PER_PAGE = 20;

export default function VenuesManagementPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [forceRender, setForceRender] = useState(0); // Quick trigger to update UI after mock hydration DB changes
  const [loaded, setLoaded] = useState(false);

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeVenue, setActiveVenue] = useState<Venue | null>(null);
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [venueToDelete, setVenueToDelete] = useState<Venue | null>(null);

  useEffect(() => {
    hydrateVenues();
    setLoaded(true);
  }, []);

  const filteredVenues = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    forceRender; // Dependency simply to force re-evaluation of the static VENUES reference
    const q = search.toLowerCase().trim();
    if (!q) return VENUES;
    return VENUES.filter(v => 
      v.code.toLowerCase().includes(q) || 
      v.nameEn.toLowerCase().includes(q) || 
      v.nameVi.toLowerCase().includes(q)
    );
  }, [search, forceRender]);

  const maxPages = Math.ceil(filteredVenues.length / ITEMS_PER_PAGE);
  const currentData = useMemo(() => {
    return filteredVenues.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [filteredVenues, page]);

  // Handle page resets
  useEffect(() => {
    if (page > maxPages && maxPages > 0) setPage(maxPages);
    if (page < 1 && maxPages > 0) setPage(1);
  }, [maxPages, page]);

  function handleAdd() {
    setActiveVenue(null);
    setIsFormOpen(true);
  }

  function handleEdit(venue: Venue) {
    setActiveVenue(venue);
    setIsFormOpen(true);
  }

  function handleConfirmDelete() {
    if (venueToDelete) {
      deleteVenue(venueToDelete.code);
      setForceRender(c => c + 1);
      setIsDeleteOpen(false);
      setVenueToDelete(null);
    }
  }

  function handleFormSave(venue: Venue, isNew: boolean) {
    if (isNew) {
      saveCustomVenue(venue);
    } else {
      editVenue(venue.code, {
        nameEn: venue.nameEn,
        nameVi: venue.nameVi,
        type: venue.type,
        rank: venue.rank,
        scopusIndexed: venue.scopusIndexed
      });
    }
    setForceRender(c => c + 1);
  }

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading">Quản lý tạp chí / hội nghị</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tổng cộng: {VENUES.length} nền tảng xuất bản
          </p>
        </div>
        <Button onClick={handleAdd} className="gap-2 shrink-0">
          <Plus className="size-4" />
          Thêm nền tảng mới
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input 
            placeholder="Tìm kiếm mã hoặc tên..." 
            className="pl-9 bg-background shadow-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Trang {page} / {maxPages || 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(p => Math.min(maxPages, p + 1))}
              disabled={page >= maxPages || maxPages === 0}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-card rounded-xl border shadow-sm flex flex-col min-h-[60vh]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-5 py-4 w-12 text-center rounded-tl-xl border-b">#</th>
                <th className="px-5 py-4 border-b">Mã / Tên hiển thị</th>
                <th className="px-5 py-4 border-b text-center">Rank</th>
                <th className="px-5 py-4 border-b text-center">Scopus</th>
                <th className="px-5 py-4 border-b text-center">Type</th>
                <th className="px-5 py-4 border-b text-right rounded-tr-xl">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {currentData.length > 0 ? (
                currentData.map((v, i) => (
                  <tr key={`${v.id}-${v.code}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 text-muted-foreground text-center">
                      {(page - 1) * ITEMS_PER_PAGE + i + 1}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-primary">{v.code}</div>
                      <div className="text-muted-foreground text-xs mt-1 truncate max-w-[300px] lg:max-w-[450px]">
                        {v.nameEn}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {v.rank ? (
                        <Badge variant="secondary">{v.rank}</Badge>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {v.scopusIndexed === 1 ? (
                        <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/25">Yes</Badge> // scopus
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex justify-center text-muted-foreground">
                        {v.type === 1 ? <span title="Conference"><Building2 className="size-4" /></span> : <span title="Journal"><BookOpen className="size-4 text-emerald-500" /></span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon-sm" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => handleEdit(v)}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon-sm" 
                          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setVenueToDelete(v);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    Không tìm thấy hội nghị hay tạp chí nào khớp với tiêu chí.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VenueFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialData={activeVenue}
        onSave={handleFormSave}
      />

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex flex-col gap-2 text-destructive">
              <AlertTriangle className="size-8" />
              Bạn có chắc muốn xoá Hội nghị/Tạp chí này?
            </DialogTitle>
            <DialogDescription className="pt-2">
              Hành động này sẽ ẩn nền tảng này khỏi hệ thống ngay lập tức.
              <div className="mt-4 p-3 bg-muted rounded-md text-sm text-foreground font-medium">
                {venueToDelete?.code} - {venueToDelete?.nameEn}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 text-right">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Xác nhận Xoá</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
