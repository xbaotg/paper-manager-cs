"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateLecturerAvatarServer } from "@/app/actions";

// Self/admin profile-photo control. Downscales the chosen image to a 256px square
// (center-cropped) JPEG data URI, persists it via updateLecturerAvatarServer, and
// keeps a local preview. `onChange` lets a parent (e.g. the admin list) sync.
export function AvatarUploader({
  lecturerId,
  currentUrl,
  name,
  onChange,
}: {
  lecturerId: number;
  currentUrl?: string | null;
  name: string;
  onChange?: (url: string) => void;
}) {
  const [url, setUrl] = useState<string>(currentUrl ?? "");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = name.split(" ").pop()?.charAt(0)?.toUpperCase() || "?";

  function persist(dataUri: string) {
    startTransition(async () => {
      const res = await updateLecturerAvatarServer(lecturerId, dataUri);
      if (res.ok) {
        setUrl(dataUri);
        onChange?.(dataUri);
        toast.success(dataUri ? "Đã cập nhật ảnh đại diện" : "Đã xoá ảnh đại diện");
      } else {
        toast.error(res.error ?? "Không cập nhật được ảnh");
      }
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn một file ảnh.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const out = 256;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          toast.error("Không xử lý được ảnh.");
          return;
        }
        ctx.drawImage(img, sx, sy, min, min, 0, 0, out, out);
        persist(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => toast.error("File ảnh không hợp lệ.");
      img.src = reader.result as string;
    };
    reader.onerror = () => toast.error("Không đọc được file.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16 border border-primary/20 bg-primary/10 text-primary">
        {url && <AvatarImage src={url} alt={name} />}
        <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="space-y-1.5">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => fileRef.current?.click()} className="cursor-pointer gap-1.5">
            <ImagePlus className="size-4" /> {url ? "Đổi ảnh" : "Tải ảnh"}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => persist("")} className="cursor-pointer gap-1.5 text-muted-foreground hover:text-destructive">
              <X className="size-4" /> Xoá
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">Ảnh vuông (JPG/PNG), tự cắt &amp; nén về 256px.</p>
      </div>
    </div>
  );
}
