"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Save, Plus, Trash2, Printer, FileDown, ScrollText,
  ImagePlus, X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hydrateVenues } from "@/lib/venues";
import { buildLlkhHtml } from "@/lib/llkh-export";
import { countsAsPublication } from "@/lib/data";
import { saveMyLlkh, saveLlkhForLecturer, type MyLlkhData } from "@/app/actions/llkh";
import {
  type LlkhProfile,
  type LlkhNgoaiNgu,
  type LlkhCongTac,
  type LlkhDaoTao,
  type LlkhDeTai,
  type LlkhHuongDan,
  type LlkhSach,
  type LlkhGiaiThuong,
} from "@/lib/llkh";

// ---------- small building blocks ----------

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function AreaField({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-heading font-semibold text-lg">{title}</h2>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

interface ColDef<T> { key: keyof T & string; label: string; wide?: boolean; }

// Generic add/remove rows editor for the table sections (all row fields are strings).
function RowsEditor<T extends object>({
  label, cols, rows, empty, onChange,
}: {
  label: string;
  cols: ColDef<T>[];
  rows: T[];
  empty: T;
  onChange: (rows: T[]) => void;
}) {
  const update = (i: number, key: keyof T & string, v: string) => {
    const next = rows.map((r, idx) => (idx === i ? ({ ...r, [key]: v } as T) : r));
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChange([...rows, { ...empty }])}>
          <Plus className="size-3.5 mr-1" /> Thêm dòng
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Chưa có dòng nào.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                <Button type="button" variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mt-1">
                {cols.map((c) => (
                  <div key={c.key} className={`space-y-1 ${c.wide ? "sm:col-span-2" : ""}`}>
                    <label className="text-[11px] text-muted-foreground">{c.label}</label>
                    <Input className="h-9" value={String((row as Record<string, unknown>)[c.key] ?? "")} onChange={(e) => update(i, c.key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Add/remove editor for a plain string[] (used for 11.2 Hướng nghiên cứu).
function ListEditor({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChange([...items, ""])}>
          <Plus className="size-3.5 mr-1" /> Thêm dòng
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Chưa có dòng nào.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
              <Input className="h-9" value={it} placeholder={placeholder} onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))} />
              <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- wizard stepper ----------

const STEP_TITLES = [
  "Thông tin chung",
  "Quá trình đào tạo",
  "Quá trình công tác",
  "Hoạt động nghiên cứu",
  "Hoạt động đào tạo",
  "Công trình khoa học",
  "Thông tin khác",
  "Xem lại",
];

function Stepper({ current, furthest, onJump }: {
  current: number; furthest: number; onJump: (n: number) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-1.5">
      {STEP_TITLES.map((title, idx) => {
        const n = idx + 1;
        const reached = n <= furthest;
        const active = n === current;
        const done = n < current;
        return (
          <li key={n}>
            <button
              type="button"
              disabled={!reached}
              onClick={() => reached && onJump(n)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition",
                active
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : reached
                    ? "border-border hover:bg-muted/50 cursor-pointer"
                    : "border-dashed text-muted-foreground opacity-60 cursor-not-allowed"
              )}
            >
              <span className={cn(
                "flex size-5 items-center justify-center rounded-full text-[11px] shrink-0",
                active ? "bg-primary text-primary-foreground" : reached ? "bg-muted" : "bg-muted/50"
              )}>
                {done ? <Check className="size-3" /> : n}
              </span>
              <span className="hidden md:inline">{title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- export helpers ----------

function vietDate(): string {
  const d = new Date();
  return `${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

function asciiName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// ---------- main editor ----------

export function LlkhEditor({
  initial,
  lecturerId,
  backHref = "/me",
  backLabel = "Về trang của tôi",
}: {
  initial: MyLlkhData;
  // When set (admin editing another lecturer), saves target that lecturer.
  lecturerId?: number;
  backHref?: string;
  backLabel?: string;
}) {
  const [P, setP] = useState<LlkhProfile>(initial.profile);
  const [step, setStep] = useState(1);
  const [furthest, setFurthest] = useState(1);
  const [pending, startTransition] = useTransition();
  const photoRef = useRef<HTMLInputElement>(null);
  const { lecturerName, lecturerTitle, papers } = initial;

  function set<K extends keyof LlkhProfile>(key: K, value: LlkhProfile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function goTo(n: number) {
    const next = Math.min(Math.max(n, 1), STEP_TITLES.length);
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Read a 4x6 portrait, downscale to <=600px (keeps the saved blob small since
  // it lives in the profile JSON), store as a JPEG data URI used in the export.
  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn một file ảnh (JPG/PNG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 600;
        let { width, height } = img;
        if (width > max || height > max) {
          const s = max / Math.max(width, height);
          width = Math.round(width * s);
          height = Math.round(height * s);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          toast.error("Không xử lý được ảnh.");
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        set("photo", canvas.toDataURL("image/jpeg", 0.85));
        toast.success("Đã tải ảnh 4x6");
      };
      img.onerror = () => toast.error("File ảnh không hợp lệ.");
      img.src = reader.result as string;
    };
    reader.onerror = () => toast.error("Không đọc được file.");
    reader.readAsDataURL(file);
  }

  function handleSave() {
    startTransition(async () => {
      const res =
        lecturerId != null ? await saveLlkhForLecturer(lecturerId, P) : await saveMyLlkh(P);
      if (res.ok) toast.success("Đã lưu thông tin LLKH");
      else toast.error(res.error ?? "Không lưu được");
    });
  }

  async function buildHtml(forPdf = false) {
    await hydrateVenues();
    return buildLlkhHtml({ lecturerName, lecturerTitle, profile: P, papers, dateStr: vietDate(), forPdf });
  }

  // Print-to-PDF. The forPdf layout zeroes the @page margins so the browser omits
  // its own header/footer (date/URL/page numbers); the user picks "Lưu/Save as PDF"
  // as the destination to download the file.
  async function handleDownloadPdf() {
    const html = await buildHtml(true);
    const w = window.open("", "_blank", "width=920,height=960");
    if (!w) { toast.error("Trình duyệt chặn cửa sổ. Hãy cho phép pop-up rồi thử lại."); return; }
    w.document.open();
    w.document.write(html + "<script>window.onload=function(){window.print();}<\/script>");
    w.document.close();
  }

  async function handleDownloadDoc() {
    const html = await buildHtml();
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LLKH_${asciiName(lecturerName) || "giang_vien"}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Đã tải file Word LLKH");
  }

  const pubCount = papers.filter((p) => countsAsPublication(p.submissionStatus)).length;

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-4" /> {backLabel}
          </Link>
          <h1 className="text-2xl font-semibold font-heading tracking-tight flex items-center gap-2 mt-1">
            <ScrollText className="size-6 text-primary" /> Lý lịch khoa học
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lecturerTitle ? `${lecturerTitle}. ` : ""}{lecturerName} — điền theo từng bước, lưu, rồi xuất theo mẫu UIT.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadPdf} className="cursor-pointer gap-1.5">
            <Printer className="size-4" /> Tải PDF
          </Button>
          <Button variant="outline" onClick={handleDownloadDoc} className="cursor-pointer gap-1.5">
            <FileDown className="size-4" /> Tải Word
          </Button>
          <Button onClick={handleSave} disabled={pending} className="cursor-pointer gap-1.5 bg-cta text-cta-foreground hover:bg-cta/90">
            <Save className="size-4" /> {pending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="rounded-xl border bg-card p-3">
        <Stepper current={step} furthest={furthest} onJump={goTo} />
      </div>

      {/* Step 1 — Thông tin chung */}
      {step === 1 && (
        <Section title="Bước 1 — Thông tin chung">
          <div className="flex items-center gap-4">
            <div className="w-20 h-[7.5rem] shrink-0 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center">
              {P.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={P.photo} alt="Ảnh 4x6" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1.5">
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()} className="cursor-pointer gap-1.5">
                  <ImagePlus className="size-4" /> {P.photo ? "Đổi ảnh" : "Tải ảnh 4x6"}
                </Button>
                {P.photo && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("photo", "")} className="cursor-pointer gap-1.5 text-muted-foreground hover:text-destructive">
                    <X className="size-4" /> Xoá
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Ảnh chân dung 4x6 (JPG/PNG) — hiển thị ở góc phải LLKH khi xuất.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Ngày sinh" value={P.dob} onChange={(v) => set("dob", v)} placeholder="VD: 27/06/1987" />
            <Field label="Nam/Nữ" value={P.gender} onChange={(v) => set("gender", v)} placeholder="Nam / Nữ" />
            <Field label="Trường / Viện" value={P.truong} onChange={(v) => set("truong", v)} />
            <Field label="Phòng / Khoa" value={P.khoa} onChange={(v) => set("khoa", v)} />
            <Field label="Bộ môn" value={P.boMon} onChange={(v) => set("boMon", v)} />
            <Field label="Phòng thí nghiệm" value={P.phongThiNghiem} onChange={(v) => set("phongThiNghiem", v)} />
            <Field label="Chức vụ" value={P.chucVu} onChange={(v) => set("chucVu", v)} />
            <div />
            <Field label="Học vị" value={P.hocVi} onChange={(v) => set("hocVi", v)} placeholder="Tiến sĩ / Thạc sĩ..." />
            <Field label="Năm đạt học vị" value={P.hocViYear} onChange={(v) => set("hocViYear", v)} />
            <Field label="Học hàm" value={P.hocHam} onChange={(v) => set("hocHam", v)} placeholder="PGS / GS..." />
            <Field label="Năm phong học hàm" value={P.hocHamYear} onChange={(v) => set("hocHamYear", v)} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <Field label="Địa chỉ cơ quan" value={P.diaChiCoQuan} onChange={(v) => set("diaChiCoQuan", v)} />
            <Field label="Địa chỉ cá nhân" value={P.diaChiCaNhan} onChange={(v) => set("diaChiCaNhan", v)} />
            <Field label="Điện thoại cơ quan" value={P.dienThoaiCoQuan} onChange={(v) => set("dienThoaiCoQuan", v)} />
            <Field label="Fax cơ quan" value={P.faxCoQuan} onChange={(v) => set("faxCoQuan", v)} />
            <Field label="Điện thoại cá nhân" value={P.dienThoaiCaNhan} onChange={(v) => set("dienThoaiCaNhan", v)} />
            <Field label="Email" value={P.email} onChange={(v) => set("email", v)} />
            <Field label="Mã ORCID" value={P.orcid} onChange={(v) => set("orcid", v)} placeholder="VD: 0000-0002-1825-0097" />
          </div>

          <AreaField label="Giới thiệu / tiểu sử" value={P.gioiThieu} onChange={(v) => set("gioiThieu", v)} rows={3} placeholder="Mô tả ngắn về bản thân, định hướng nghiên cứu..." />

          <RowsEditor<LlkhNgoaiNgu>
            label="Trình độ ngoại ngữ"
            rows={P.ngoaiNgu}
            empty={{ name: "", nghe: "", noi: "", viet: "", doc: "" }}
            onChange={(r) => set("ngoaiNgu", r)}
            cols={[
              { key: "name", label: "Tên ngoại ngữ", wide: true },
              { key: "nghe", label: "Nghe (Tốt/Khá/TB)" },
              { key: "noi", label: "Nói" },
              { key: "viet", label: "Viết" },
              { key: "doc", label: "Đọc hiểu" },
            ]}
          />

          <div className="grid gap-4 pt-1">
            <p className="text-sm font-medium">Lĩnh vực chuyên môn</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Lĩnh vực" value={P.linhVucChuyenMon} onChange={(v) => set("linhVucChuyenMon", v)} />
              <Field label="Chuyên ngành" value={P.chuyenNganh} onChange={(v) => set("chuyenNganh", v)} />
              <Field label="Chuyên môn" value={P.chuyenMon} onChange={(v) => set("chuyenMon", v)} />
            </div>
            <ListEditor label="Hướng nghiên cứu" items={P.huongNghienCuuList} onChange={(v) => set("huongNghienCuuList", v)} placeholder="Một hướng nghiên cứu..." />
          </div>
        </Section>
      )}

      {/* Step 2 — Quá trình đào tạo */}
      {step === 2 && (
        <Section title="Bước 2 — Quá trình đào tạo">
          <RowsEditor<LlkhDaoTao>
            label="Các bậc đào tạo (Đại học, Thạc sĩ, Tiến sĩ, TSKH)"
            rows={P.daoTao}
            empty={{ bac: "", thoiGian: "", noi: "", nganh: "", luanAn: "" }}
            onChange={(r) => set("daoTao", r)}
            cols={[
              { key: "bac", label: "Bậc đào tạo" },
              { key: "thoiGian", label: "Thời gian" },
              { key: "noi", label: "Nơi đào tạo", wide: true },
              { key: "nganh", label: "Chuyên ngành" },
              { key: "luanAn", label: "Tên luận án tốt nghiệp", wide: true },
            ]}
          />
        </Section>
      )}

      {/* Step 3 — Quá trình công tác */}
      {step === 3 && (
        <Section title="Bước 3 — Quá trình công tác">
          <RowsEditor<LlkhCongTac>
            label="Thời gian công tác"
            rows={P.congTac}
            empty={{ from: "", to: "", noi: "", chucVu: "" }}
            onChange={(r) => set("congTac", r)}
            cols={[
              { key: "from", label: "Từ" },
              { key: "to", label: "Đến" },
              { key: "noi", label: "Nơi công tác", wide: true },
              { key: "chucVu", label: "Chức vụ", wide: true },
            ]}
          />
        </Section>
      )}

      {/* Step 4 — Hoạt động nghiên cứu (đề tài/dự án) */}
      {step === 4 && (
        <Section title="Bước 4 — Hoạt động nghiên cứu">
          <RowsEditor<LlkhDeTai>
            label="Đề tài / dự án"
            rows={P.deTai}
            empty={{ ten: "", maSo: "", thoiGian: "", kinhPhi: "", vaiTro: "", ngayNghiemThu: "", ketQua: "" }}
            onChange={(r) => set("deTai", r)}
            cols={[
              { key: "ten", label: "Tên đề tài/dự án", wide: true },
              { key: "maSo", label: "Mã số & cấp quản lý" },
              { key: "thoiGian", label: "Thời gian" },
              { key: "kinhPhi", label: "Kinh phí (triệu đồng)" },
              { key: "vaiTro", label: "Chủ nhiệm / Tham gia" },
              { key: "ngayNghiemThu", label: "Ngày nghiệm thu" },
              { key: "ketQua", label: "Kết quả" },
            ]}
          />
        </Section>
      )}

      {/* Step 5 — Hoạt động đào tạo (hướng dẫn) */}
      {step === 5 && (
        <Section title="Bước 5 — Hoạt động đào tạo">
          <RowsEditor<LlkhHuongDan>
            label="Hướng dẫn SV / HVCH / NCS"
            rows={P.huongDan}
            empty={{ ten: "", luanAn: "", namTN: "", bac: "", sanPham: "" }}
            onChange={(r) => set("huongDan", r)}
            cols={[
              { key: "ten", label: "Tên SV/HVCH/NCS" },
              { key: "namTN", label: "Năm tốt nghiệp" },
              { key: "luanAn", label: "Tên luận án", wide: true },
              { key: "bac", label: "Bậc đào tạo" },
              { key: "sanPham", label: "Sản phẩm đề tài (mã số)" },
            ]}
          />
        </Section>
      )}

      {/* Step 6 — Công trình khoa học */}
      {step === 6 && (
        <Section title="Bước 6 — Công trình khoa học" desc="Các bài báo được tự động lấy từ danh sách công bố của bạn (bài đã chấp nhận/xuất bản) và phân loại tạp chí/hội nghị · quốc tế/trong nước khi xuất. Sách nhập tay ở dưới.">
          <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm">
            <strong>{pubCount}</strong> bài báo sẽ được đưa vào mục &ldquo;Các công trình đã công bố&rdquo; khi xuất LLKH.
          </div>
          <RowsEditor<LlkhSach>
            label="Sách xuất bản Quốc tế"
            rows={P.sachQuocTe}
            empty={{ ten: "", sanPham: "", nhaXB: "", namXB: "", tacGia: "", butDanh: "" }}
            onChange={(r) => set("sachQuocTe", r)}
            cols={[
              { key: "ten", label: "Tên sách", wide: true },
              { key: "nhaXB", label: "Nhà xuất bản" },
              { key: "namXB", label: "Năm xuất bản" },
              { key: "tacGia", label: "Tác giả / đồng tác giả" },
              { key: "butDanh", label: "Bút danh" },
              { key: "sanPham", label: "Sản phẩm đề tài (mã số)" },
            ]}
          />
          <RowsEditor<LlkhSach>
            label="Sách xuất bản trong nước"
            rows={P.sachTrongNuoc}
            empty={{ ten: "", sanPham: "", nhaXB: "", namXB: "", tacGia: "", butDanh: "" }}
            onChange={(r) => set("sachTrongNuoc", r)}
            cols={[
              { key: "ten", label: "Tên sách", wide: true },
              { key: "nhaXB", label: "Nhà xuất bản" },
              { key: "namXB", label: "Năm xuất bản" },
              { key: "tacGia", label: "Tác giả / đồng tác giả" },
              { key: "butDanh", label: "Bút danh" },
              { key: "sanPham", label: "Sản phẩm đề tài (mã số)" },
            ]}
          />
        </Section>
      )}

      {/* Step 7 — Thông tin khác */}
      {step === 7 && (
        <Section title="Bước 7 — Thông tin khác">
          <RowsEditor<LlkhGiaiThuong>
            label="Giải thưởng Khoa học và Công nghệ"
            rows={P.giaiThuong}
            empty={{ ten: "", nam: "" }}
            onChange={(r) => set("giaiThuong", r)}
            cols={[
              { key: "ten", label: "Hình thức & nội dung giải thưởng", wide: true },
              { key: "nam", label: "Năm tặng thưởng" },
            ]}
          />
          <AreaField label="Bằng phát minh, sáng chế (patent)" value={P.patent} onChange={(v) => set("patent", v)} />
          <AreaField label="Bằng giải pháp hữu ích" value={P.giaiPhapHuuIch} onChange={(v) => set("giaiPhapHuuIch", v)} />
          <AreaField label="Thông tin khác" value={P.thongTinKhac} onChange={(v) => set("thongTinKhac", v)} rows={4} />
        </Section>
      )}

      {/* Step 8 — Xem lại */}
      {step === 8 && (
        <Section title="Bước 8 — Xem lại" desc="Kiểm tra nhanh thông tin đã nhập, rồi lưu và xuất theo mẫu UIT.">
          <ReviewSummary P={P} pubCount={pubCount} />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={handleDownloadPdf} className="cursor-pointer gap-1.5">
              <Printer className="size-4" /> Tải PDF
            </Button>
            <Button variant="outline" onClick={handleDownloadDoc} className="cursor-pointer gap-1.5">
              <FileDown className="size-4" /> Tải Word
            </Button>
            <Button onClick={handleSave} disabled={pending} className="cursor-pointer gap-1.5 bg-cta text-cta-foreground hover:bg-cta/90">
              <Save className="size-4" /> {pending ? "Đang lưu..." : "Lưu thông tin"}
            </Button>
          </div>
        </Section>
      )}

      {/* sticky nav + save bar */}
      <div className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur p-3 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => goTo(step - 1)} disabled={step === 1} className="cursor-pointer gap-1.5">
            <ArrowLeft className="size-4" /> Quay lại
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:block">
            Bước {step}/{STEP_TITLES.length} — {STEP_TITLES[step - 1]}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={pending} className="cursor-pointer gap-1.5">
              <Save className="size-4" /> {pending ? "Đang lưu..." : "Lưu"}
            </Button>
            {step < STEP_TITLES.length ? (
              <Button onClick={() => goTo(step + 1)} className="cursor-pointer gap-1.5 bg-cta text-cta-foreground hover:bg-cta/90">
                Tiếp tục <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={pending} className="cursor-pointer gap-1.5 bg-cta text-cta-foreground hover:bg-cta/90">
                <Save className="size-4" /> Hoàn tất
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- review summary (step 8) ----------

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground min-w-40 shrink-0">{label}</span>
      <span className="font-medium break-words">{value || "—"}</span>
    </div>
  );
}

function ReviewSummary({ P, pubCount }: { P: LlkhProfile; pubCount: number }) {
  const huong = P.huongNghienCuuList.filter(Boolean);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-4 space-y-1.5">
        <h3 className="font-semibold text-sm mb-2">Thông tin chung</h3>
        <ReviewRow label="Ngày sinh / Giới tính" value={[P.dob, P.gender].filter(Boolean).join(" · ")} />
        <ReviewRow label="Đơn vị" value={[P.truong, P.khoa, P.boMon].filter(Boolean).join(" · ")} />
        <ReviewRow label="Học vị / Học hàm" value={[P.hocVi, P.hocHam].filter(Boolean).join(" · ") || "—"} />
        <ReviewRow label="Email / ORCID" value={[P.email, P.orcid].filter(Boolean).join(" · ")} />
        <ReviewRow label="Lĩnh vực" value={[P.linhVucChuyenMon, P.chuyenNganh, P.chuyenMon].filter(Boolean).join(" · ")} />
        <ReviewRow label="Hướng nghiên cứu" value={huong.length ? `${huong.length} hướng` : "—"} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <CountCard label="Quá trình đào tạo" n={P.daoTao.length} />
        <CountCard label="Quá trình công tác" n={P.congTac.length} />
        <CountCard label="Đề tài / dự án" n={P.deTai.length} />
        <CountCard label="Hướng dẫn SV/HVCH/NCS" n={P.huongDan.length} />
        <CountCard label="Bài báo (tự động khi xuất)" n={pubCount} />
        <CountCard label="Sách (QT + trong nước)" n={P.sachQuocTe.length + P.sachTrongNuoc.length} />
        <CountCard label="Giải thưởng" n={P.giaiThuong.length} />
        <CountCard label="Ngoại ngữ" n={P.ngoaiNgu.length} />
      </div>
    </div>
  );
}

function CountCard({ label, n }: { label: string; n: number }) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-heading font-semibold text-lg">{n}</span>
    </div>
  );
}
