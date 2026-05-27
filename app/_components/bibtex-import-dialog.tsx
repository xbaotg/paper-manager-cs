"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Sparkles, Check, AlertCircle } from "lucide-react";
import { parseAndMatchBibtex, normalizeAuthorName, searchOpenAlex, type ParsedBibtex } from "@/lib/bibtex";
import { getDatabase, saveAuthorAliasServer } from "@/app/actions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Lecturer } from "@/lib/data";
import { LecturerCombobox } from "./lecturer-combobox";
import { type AuthorEntry } from "./authorship-input";
import { VenuePicker } from "@/app/admin/_components/venue-picker";
import type { Venue } from "@/lib/venues";

interface BibtexImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lecturers: Lecturer[];
  onConfirm: (data: {
    title: string;
    year: string;
    venue: string;
    authors: AuthorEntry[];
    doi?: string;
    url?: string;
  }) => void;
}

export function BibtexImportDialog({
  open,
  onOpenChange,
  lecturers,
  onConfirm
}: BibtexImportDialogProps) {
  const [bibtexStr, setBibtexStr] = useState("");
  const [parsedData, setParsedData] = useState<ParsedBibtex | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState("");

  // Search UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ParsedBibtex[] | null>(null);

  // Editable parsed fields
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [venueCode, setVenueCode] = useState("");
  const [doi, setDoi] = useState("");
  const [url, setUrl] = useState("");
  
  // Author mapping state
  const [authorMappings, setAuthorMappings] = useState<(number | null)[]>([]);
  const [savedAliases, setSavedAliases] = useState<Record<string, number>>({});

  // Load saved aliases on open
  useEffect(() => {
    if (open) {
      getDatabase().then(db => setSavedAliases(db.authorAliases)).catch(console.error);
    }
  }, [open]);

  const handleParse = async () => {
    if (!bibtexStr.trim()) {
      setError("Vui lòng nhập định dạng BibTeX");
      return;
    }
    
    setIsParsing(true);
    setError("");
    
    try {
      // simulate minimal loading for UX
      await new Promise(r => setTimeout(r, 400));
      
      const result = parseAndMatchBibtex(bibtexStr, lecturers, savedAliases);
      if (!result) {
        setError("Không thể phân tích BibTeX. Vui lòng kiểm tra lại định dạng.");
        setIsParsing(false);
        return;
      }

      setParsedData(result);
      setTitle(result.title);
      setYear(result.year ? String(result.year) : "");
      setVenueCode(result.venueMatch?.code || "");
      setDoi(result.doi || "");
      setUrl(result.url || "");
      
      // Default mappings
      const initialMappings = result.authors.map(a => a.mappedLecturerId);
      setAuthorMappings(initialMappings);
    } catch (err) {
      setError("Có lỗi xảy ra khi phân tích.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Vui lòng nhập tên bài báo");
      return;
    }
    setIsSearching(true);
    setError("");
    setSearchResults(null);
    try {
      const results = await searchOpenAlex(searchQuery, lecturers, savedAliases);
      if (results.length === 0) {
        setError("Không tìm thấy kết quả nào phù hợp.");
      } else {
        setSearchResults(results);
      }
    } catch (err) {
      setError("Đã xảy ra lỗi khi tìm kiếm.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: ParsedBibtex) => {
    setParsedData(result);
    setTitle(result.title);
    setYear(result.year ? String(result.year) : "");
    setVenueCode(result.venueMatch?.code || "");
    setDoi(result.doi || "");
    setUrl(result.url || "");
    const initialMappings = result.authors.map(a => a.mappedLecturerId);
    setAuthorMappings(initialMappings);
  };

  const handleConfirm = () => {
    const finalAuthors: AuthorEntry[] = [];
    
    // Track new aliases to save
    const updatedAliases = { ...savedAliases };
    let hasNewAliases = false;

    parsedData?.authors.forEach((author, idx) => {
      const mapping = authorMappings[idx];
      if (mapping !== null) {
        // internal
        const l = lecturers.find(x => x.id === mapping);
        if (l) {
          finalAuthors.push({ 
            type: "internal", 
            id: l.id, 
            name: `${l.title}. ${l.name}`, 
            email: l.email 
          });
        }
        // Save/Update mapping alias for future imports
        const normName = normalizeAuthorName(author.rawName);
        if (updatedAliases[normName] !== mapping) {
          updatedAliases[normName] = mapping;
          saveAuthorAliasServer(normName, mapping).catch(console.error);
          hasNewAliases = true;
        }
      } else {
        // external
        finalAuthors.push({ type: "external", name: author.rawName });
      }
    });

    onConfirm({
      title,
      year,
      venue: venueCode || parsedData?.venueRaw || "",
      authors: finalAuthors,
      doi,
      url
    });
    
    // Save new alias dictionary locally for immediate next usage if dialog stays open
    if (hasNewAliases) {
      setSavedAliases(updatedAliases);
    }
    
    // Reset and close
    setBibtexStr("");
    setParsedData(null);
    onOpenChange(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) { // on close
      setBibtexStr("");
      setSearchQuery("");
      setSearchResults(null);
      setParsedData(null);
      setError("");
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-500" />
            Nhập thông minh
          </DialogTitle>
          <DialogDescription>
            Tìm kiếm bài báo tự động từ kho dữ liệu mở OpenAlex hoặc nhập mã nguồn BibTeX.
          </DialogDescription>
        </DialogHeader>

        {!parsedData ? (
          <Tabs defaultValue="search" className="py-2 flex flex-col w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">Nhập theo tên</TabsTrigger>
              <TabsTrigger value="bibtex">Mã nguồn BibTeX</TabsTrigger>
            </TabsList>
            
            <TabsContent value="search" className="flex flex-col gap-4 py-4 focus-visible:outline-none">
              <div className="flex gap-2">
                <Input
                  placeholder="Nhập tên bài báo cần thêm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || !searchQuery}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                  {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                </Button>
              </div>
              
              {error && !bibtexStr && (
                <div className="text-sm text-destructive flex items-center gap-1.5 font-medium">
                  <AlertCircle className="size-4" /> {error}
                </div>
              )}

              {searchResults && (
                <div className="flex flex-col gap-3 mt-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Kết quả (Từ OpenAlex)</span>
                  {searchResults.map((res, i) => (
                    <div key={i} className="flex flex-col gap-2 p-3 border rounded-lg bg-card/40 hover:bg-muted/30 transition-colors">
                      <div className="font-semibold text-sm leading-tight text-indigo-700 text-left">{res.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 text-left">
                        {res.authors.map(a => a.rawName).join(", ")}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                          {res.year && <Badge variant="secondary" className="px-1.5 py-0 rounded text-[9px]">{res.year}</Badge>}
                          {res.venueMatch?.code || res.venueRaw || "N/A"}
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSelectSearchResult(res)}>
                          Chọn
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="bibtex" className="flex flex-col gap-4 py-4 focus-visible:outline-none">
              <Textarea
                placeholder={`@inproceedings{gia2024enhancing,\n  title={Enhancing road object detection...},\n  author={Gia, Bao Tran and ...},\n  ...\n}`}
                className="font-mono text-xs min-h-[160px]"
                value={bibtexStr}
                onChange={(e) => setBibtexStr(e.target.value)}
              />
              {error && bibtexStr && (
                <div className="text-sm text-destructive flex items-center gap-1.5 font-medium">
                  <AlertCircle className="size-4" /> {error}
                </div>
              )}
              <Button 
                onClick={handleParse} 
                disabled={isParsing || !bibtexStr}
                className="bg-indigo-600 hover:bg-indigo-700 text-white self-center min-w-[150px]"
              >
                {isParsing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Search className="size-4 mr-2" />}
                Phân tích BibTeX
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col gap-5 py-4">
            <div className="space-y-4 rounded-md border border-border p-4 bg-muted/20">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Tên bài báo</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Năm</label>
                  <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Hội nghị / Tạp chí</label>
                  <VenuePicker 
                    value={venueCode} 
                    onChange={setVenueCode} 
                    label="" 
                    placeholder="Chọn nơi công bố..." 
                  />
                  {parsedData.venueRaw && !venueCode && (
                     <p className="text-[11px] text-muted-foreground italic">Raw: {parsedData.venueRaw}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">DOI</label>
                  <Input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="DOI của bài báo" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">URL</label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL của bài báo" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                Ghép nối tác giả
                <Badge variant="outline" className="text-xs font-normal">
                  {parsedData.authors.length} tác giả
                </Badge>
              </h4>
              
              <div className="grid gap-3">
                {parsedData.authors.map((author, index) => {
                  const currMappedId = authorMappings[index];
                  const isHighConfidence = author.topMatches[0] && author.topMatches[0].score >= 0.8 && currMappedId === author.topMatches[0].lecturer.id;
                  
                  return (
                    <div key={index} className="flex flex-col sm:flex-row gap-3 p-3 border border-border/50 rounded-lg bg-card text-card-foreground shadow-sm items-start sm:items-center">
                      <div className="sm:w-[35%] w-full">
                        <p className="text-sm font-medium leading-none">{author.rawName}</p>
                        <p className="text-xs text-muted-foreground mt-1">Từ BibTeX</p>
                      </div>
                      
                      <div className="flex-1 w-full flex items-center gap-2">
                        <LecturerCombobox
                          lecturers={lecturers}
                          value={currMappedId}
                          onChange={(id) => {
                            const newMap = [...authorMappings];
                            newMap[index] = id;
                            setAuthorMappings(newMap);
                          }}
                          topMatches={author.topMatches}
                          isHighConfidence={isHighConfidence}
                        />
                        
                        {currMappedId !== null && isHighConfidence && (
                           <div title={author.mappedByAlias ? "Nối theo lịch sử của bạn" : "Tự động nối bằng hệ thống"} className="text-green-600 bg-green-500/10 p-1.5 rounded-full shrink-0">
                             <Check className="size-4" />
                           </div>
                        )}
                        {currMappedId === null && (
                          <div title="Tác giả được đẩy vào danh sách ngoài Khoa" className="text-muted-foreground p-1.5 shrink-0">
                            <span className="text-xs font-medium">Khách</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {parsedData && (
          <DialogFooter className="mt-2 border-t pt-4">
            <Button variant="ghost" onClick={() => setParsedData(null)}>
              Nhập lại BibTeX
            </Button>
            <Button onClick={handleConfirm} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Sử dụng các thông tin này
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
