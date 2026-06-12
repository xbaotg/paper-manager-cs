"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, Printer, FileDown, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hydrateVenues } from "@/lib/venues";
import { buildLlkhHtml } from "@/lib/llkh-export";
import { saveMyLlkh, type MyLlkhData } from "@/app/actions/llkh";
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

// ---------- export helpers ----------

function vietDate(): string {
  const d = new Date();
  return `${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

function asciiName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// ---------- main editor ----------

export function LlkhEditor({ initial }: { initial: MyLlkhData }) {
  const [P, setP] = useState<LlkhProfile>(initial.profile);
  const [pending, startTransition] = useTransition();
  const { lecturerName, lecturerTitle, papers } = initial;

  function set<K extends keyof LlkhProfile>(key: K, value: LlkhProfile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveMyLlkh(P);
      if (res.ok) toast.success("Đã lưu thông tin LLKH");
      else toast.error(res.error ?? "Không lưu được");
    });
  }

  async function buildHtml() {
    await hydrateVenues();
    return buildLlkhHtml({ lecturerName, lecturerTitle, profile: P, papers, dateStr: vietDate() });
  }

  async function handlePrint() {
    const html = await buildHtml();
    const w = window.open("", "_blank", "width=920,height=960");
    if (!w) { toast.error("Trình duyệt chặn cửa sổ in. Hãy dùng nút Tải Word."); return; }
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

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link href="/me" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-4" /> Về trang của tôi
          </Link>
          <h1 className="text-2xl font-semibold font-heading tracking-tight flex items-center gap-2 mt-1">
            <ScrollText className="size-6 text-primary" /> Lý lịch khoa học
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lecturerTitle ? `${lecturerTitle}. ` : ""}{lecturerName} — điền thông tin, lưu, rồi xuất theo mẫu UIT.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint} className="cursor-pointer gap-1.5">
            <Printer className="size-4" /> In / PDF
          </Button>
          <Button variant="outline" onClick={handleDownloadDoc} className="cursor-pointer gap-1.5">
            <FileDown className="size-4" /> Tải Word
          </Button>
          <Button onClick={handleSave} disabled={pending} className="cursor-pointer gap-1.5 bg-cta text-cta-foreground hover:bg-cta/90">
            <Save className="size-4" /> {pending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground rounded-lg border border-dashed bg-muted/20 p-3">
        Phần <strong>Các công trình đã công bố</strong> được tự động lấy từ danh sách bài báo của bạn (bài đã chấp nhận/xuất bản),
        phân loại theo tạp chí/hội nghị · quốc tế/trong nước. Các mục còn lại bạn nhập tay ở dưới.
      </p>

      {/* I. THÔNG TIN CHUNG */}
      <Section title="I. Thông tin chung">
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
        </div>

        <RowsEditor<LlkhNgoaiNgu>
          label="8. Trình độ ngoại ngữ"
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
        <RowsEditor<LlkhCongTac>
          label="9. Thời gian công tác"
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
        <RowsEditor<LlkhDaoTao>
          label="10. Quá trình đào tạo"
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
        <div className="grid gap-4 pt-1">
          <Field label="11.1 Lĩnh vực chuyên môn" value={P.linhVucChuyenMon} onChange={(v) => set("linhVucChuyenMon", v)} />
          <AreaField label="11.2 Hướng nghiên cứu" value={P.huongNghienCuu} onChange={(v) => set("huongNghienCuu", v)} placeholder="Mỗi hướng một dòng..." />
        </div>
      </Section>

      {/* II. NGHIÊN CỨU VÀ GIẢNG DẠY */}
      <Section title="II. Nghiên cứu và giảng dạy">
        <RowsEditor<LlkhDeTai>
          label="1. Đề tài / dự án"
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
        <RowsEditor<LlkhHuongDan>
          label="2. Hướng dẫn SV / HVCH / NCS"
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

      {/* III. Sách (publications auto) */}
      <Section title="III. Sách" desc="Các bài báo được tự động lấy từ danh sách công bố của bạn — chỉ cần nhập sách ở đây.">
        <RowsEditor<LlkhSach>
          label="1.1 Sách xuất bản Quốc tế"
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
          label="1.2 Sách xuất bản trong nước"
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

      {/* IV. Giải thưởng */}
      <Section title="IV. Các giải thưởng">
        <RowsEditor<LlkhGiaiThuong>
          label="1. Giải thưởng Khoa học và Công nghệ"
          rows={P.giaiThuong}
          empty={{ ten: "", nam: "" }}
          onChange={(r) => set("giaiThuong", r)}
          cols={[
            { key: "ten", label: "Hình thức & nội dung giải thưởng", wide: true },
            { key: "nam", label: "Năm tặng thưởng" },
          ]}
        />
        <AreaField label="2. Bằng phát minh, sáng chế (patent)" value={P.patent} onChange={(v) => set("patent", v)} />
        <AreaField label="3. Bằng giải pháp hữu ích" value={P.giaiPhapHuuIch} onChange={(v) => set("giaiPhapHuuIch", v)} />
      </Section>

      {/* V. Thông tin khác */}
      <Section title="V. Thông tin khác">
        <AreaField label="Thông tin khác" value={P.thongTinKhac} onChange={(v) => set("thongTinKhac", v)} rows={4} />
      </Section>

      {/* sticky save bar */}
      <div className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur p-3 z-20">
        <div className="max-w-5xl mx-auto flex justify-end gap-2">
          <Button variant="outline" onClick={handleDownloadDoc} className="cursor-pointer gap-1.5">
            <FileDown className="size-4" /> Tải Word
          </Button>
          <Button onClick={handleSave} disabled={pending} className="cursor-pointer gap-1.5 bg-cta text-cta-foreground hover:bg-cta/90">
            <Save className="size-4" /> {pending ? "Đang lưu..." : "Lưu thông tin"}
          </Button>
        </div>
      </div>
    </div>
  );
}
