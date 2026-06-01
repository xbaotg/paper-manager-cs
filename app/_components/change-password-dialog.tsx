"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { changeMyPasswordAction } from "@/app/actions/users";

export function ChangePasswordDialog({ size = "sm" }: { size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() { setCurrent(""); setNext(""); setConfirm(""); }

  function submit() {
    if (next !== confirm) { toast.error("Mật khẩu xác nhận không khớp."); return; }
    startTransition(async () => {
      const res = await changeMyPasswordAction({ currentPassword: current, newPassword: next });
      if (res.ok) {
        toast.success("Đã đổi mật khẩu");
        setOpen(false);
        reset();
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size}
        className="cursor-pointer gap-1.5"
        onClick={() => setOpen(true)}
      >
        <KeyRound className="size-4" /> Đổi mật khẩu
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
            <DialogDescription>Nhập mật khẩu hiện tại và mật khẩu mới (≥ 6 ký tự).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mật khẩu hiện tại</label>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mật khẩu mới</label>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nhập lại mật khẩu mới</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">Huỷ</Button>
            <Button onClick={submit} disabled={pending || !current || !next} className="cursor-pointer">
              {pending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
