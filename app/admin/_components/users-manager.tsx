"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus, KeyRound, Trash2, ShieldCheck, ShieldPlus, ShieldMinus, GraduationCap, Power, Building2, Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "./confirm-dialog";
import {
  createUserAction,
  resetPasswordAction,
  setUserActiveAction,
  setUserAdminAction,
  deleteUserAction,
  generateLecturerAccountsAction,
  type UsersSnapshot,
  type GenerateAccountsResult,
} from "@/app/actions/users";
import type { Role } from "@/lib/session";

type UserItem = UsersSnapshot["users"][number];
type Unlinked = UsersSnapshot["unlinked"][number];
type BoMonItem = UsersSnapshot["boMon"][number];

export function UsersManager({
  initialUsers,
  initialUnlinked,
  initialBoMon,
}: {
  initialUsers: UserItem[];
  initialUnlinked: Unlinked[];
  initialBoMon: BoMonItem[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [unlinked, setUnlinked] = useState(initialUnlinked);
  const [boMon, setBoMon] = useState(initialBoMon);
  const [pending, startTransition] = useTransition();

  // create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("lecturer");
  const [lecturerId, setLecturerId] = useState<string>("");
  const [boMonId, setBoMonId] = useState<string>("");
  const [grantAdmin, setGrantAdmin] = useState(false);

  // reset password dialog
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  // bulk generate result
  const [genResult, setGenResult] = useState<GenerateAccountsResult | null>(null);

  function applySnapshot(data?: UsersSnapshot) {
    if (data) {
      setUsers(data.users);
      setUnlinked(data.unlinked);
      setBoMon(data.boMon);
    }
  }

  function resetCreateForm() {
    setUsername("");
    setPassword("");
    setRole("lecturer");
    setLecturerId("");
    setBoMonId("");
    setGrantAdmin(false);
  }

  function handleCreate() {
    startTransition(async () => {
      const res = await createUserAction({
        username,
        password,
        role,
        lecturerId: role === "lecturer" && lecturerId ? Number(lecturerId) : null,
        boMonId: role === "head" && boMonId ? Number(boMonId) : null,
        isAdmin: role === "lecturer" && grantAdmin,
      });
      if (res.ok) {
        applySnapshot(res.data);
        toast.success("Đã tạo tài khoản");
        setCreateOpen(false);
        resetCreateForm();
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  function handleReset() {
    if (!resetTarget) return;
    startTransition(async () => {
      const res = await resetPasswordAction(resetTarget.id, newPassword);
      if (res.ok) {
        toast.success(`Đã đặt lại mật khẩu cho ${resetTarget.username}`);
        setResetTarget(null);
        setNewPassword("");
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  function handleToggleActive(u: UserItem) {
    startTransition(async () => {
      const res = await setUserActiveAction(u.id, !u.isActive);
      if (res.ok) {
        applySnapshot(res.data);
        toast.success(u.isActive ? "Đã vô hiệu hoá" : "Đã kích hoạt");
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  function handleToggleAdmin(u: UserItem) {
    startTransition(async () => {
      const res = await setUserAdminAction(u.id, !u.isAdmin);
      if (res.ok) {
        applySnapshot(res.data);
        toast.success(u.isAdmin ? "Đã thu hồi quyền quản trị" : "Đã cấp quyền quản trị");
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateLecturerAccountsAction();
      applySnapshot(res.data);
      setGenResult(res);
      if (res.created.length > 0) toast.success(`Đã tạo ${res.created.length} tài khoản giảng viên`);
      else toast.info("Mọi giảng viên đều đã có tài khoản");
    });
  }

  function copyCredentials(items: { username: string; password: string }[]) {
    const text = items.map((c) => `${c.username}\t${c.password}`).join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast.success("Đã sao chép vào clipboard"),
      () => toast.error("Không sao chép được")
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const res = await deleteUserAction(target.id);
      if (res.ok) {
        applySnapshot(res.data);
        toast.success("Đã xoá tài khoản");
      } else {
        toast.error(res.error ?? "Có lỗi xảy ra");
      }
      setDeleteTarget(null);
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight">Tài khoản</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} tài khoản · quản lý truy cập hệ thống
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={pending} className="cursor-pointer gap-1.5">
            <Sparkles className="size-4" /> Tạo tài khoản tự động cho GV
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="cursor-pointer gap-1.5">
            <UserPlus className="size-4" /> Tạo tài khoản
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên đăng nhập</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Giảng viên liên kết</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell>
                  {u.role === "manager" ? (
                    <Badge variant="default" className="gap-1">
                      <ShieldCheck className="size-3" /> Quản lý
                    </Badge>
                  ) : u.role === "head" ? (
                    <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600">
                      <Building2 className="size-3" /> Trưởng bộ môn
                    </Badge>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="secondary" className="gap-1">
                        <GraduationCap className="size-3" /> Giảng viên
                      </Badge>
                      {!!u.isAdmin && (
                        <Badge variant="default" className="gap-1">
                          <ShieldCheck className="size-3" /> Quản trị
                        </Badge>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.role === "head" ? (u.boMonName ?? "—") : (u.lecturerName ?? "—")}
                </TableCell>
                <TableCell>
                  {u.isActive ? (
                    <Badge variant="outline" className="text-green-600 border-green-600/40">
                      Hoạt động
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Vô hiệu
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {u.role === "lecturer" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={u.isAdmin ? "Thu hồi quyền quản trị" : "Cấp quyền quản trị"}
                        className="cursor-pointer"
                        onClick={() => handleToggleAdmin(u)}
                        disabled={pending}
                      >
                        {u.isAdmin ? (
                          <ShieldMinus className="size-4 text-amber-600" />
                        ) : (
                          <ShieldPlus className="size-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Đặt lại mật khẩu"
                      className="cursor-pointer"
                      onClick={() => setResetTarget(u)}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={u.isActive ? "Vô hiệu hoá" : "Kích hoạt"}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(u)}
                      disabled={pending}
                    >
                      <Power className={`size-4 ${u.isActive ? "text-green-600" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Xoá"
                      className="cursor-pointer text-destructive"
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Chưa có tài khoản nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetCreateForm(); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản</DialogTitle>
            <DialogDescription>Tài khoản giảng viên phải liên kết với một hồ sơ GV.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tên đăng nhập</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="vd: thanhnd" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mật khẩu</label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Vai trò</label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lecturer" className="cursor-pointer">Giảng viên (GV)</SelectItem>
                  <SelectItem value="head" className="cursor-pointer">Trưởng bộ môn (theo bộ môn)</SelectItem>
                  <SelectItem value="manager" className="cursor-pointer">Quản lý (BCN / Thư ký / Giáo vụ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "lecturer" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Giảng viên liên kết</label>
                <Select value={lecturerId} onValueChange={(v) => setLecturerId(v ?? "")}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Chọn giảng viên..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinked.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Mọi GV đã có tài khoản</div>
                    ) : (
                      unlinked.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)} className="cursor-pointer">
                          {l.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {role === "lecturer" && (
              <label className="flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={grantAdmin}
                  onChange={(e) => setGrantAdmin(e.target.checked)}
                  className="size-4 cursor-pointer accent-primary"
                />
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <ShieldCheck className="size-4 text-primary" /> Cấp quyền quản trị
                </span>
              </label>
            )}
            {role === "head" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bộ môn phụ trách</label>
                <Select value={boMonId} onValueChange={(v) => setBoMonId(v ?? "")}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Chọn bộ môn..." />
                  </SelectTrigger>
                  <SelectContent>
                    {boMon.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Chưa có bộ môn nào</div>
                    ) : (
                      boMon.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)} className="cursor-pointer">
                          {b.code} — {b.nameVi}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="cursor-pointer">Huỷ</Button>
            <Button onClick={handleCreate} disabled={pending} className="cursor-pointer">
              {pending ? "Đang tạo..." : "Tạo tài khoản"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPassword(""); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
            <DialogDescription>Tài khoản: {resetTarget?.username}</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <label className="text-sm font-medium">Mật khẩu mới</label>
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} className="cursor-pointer">Huỷ</Button>
            <Button onClick={handleReset} disabled={pending} className="cursor-pointer">Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate accounts result */}
      <Dialog open={!!genResult} onOpenChange={(o) => { if (!o) setGenResult(null); }}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản tự động</DialogTitle>
            <DialogDescription>
              {genResult?.created.length ?? 0} tài khoản mới · {genResult?.skipped.length ?? 0} bị bỏ qua
            </DialogDescription>
          </DialogHeader>
          {genResult && genResult.created.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="cursor-pointer gap-1.5" onClick={() => copyCredentials(genResult.created)}>
                  <Copy className="size-3.5" /> Sao chép tất cả
                </Button>
              </div>
              <div className="max-h-[360px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Giảng viên</TableHead>
                      <TableHead>Tên đăng nhập</TableHead>
                      <TableHead>Mật khẩu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {genResult.created.map((c) => (
                      <TableRow key={c.lecturerId}>
                        <TableCell className="text-sm">{c.lecturerName}</TableCell>
                        <TableCell className="font-mono text-sm">{c.username}</TableCell>
                        <TableCell className="font-mono text-sm">{c.password}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">Mẫu: tên rút gọn + viết tắt họ đệm; mật khẩu = tên đăng nhập + 123. Yêu cầu GV đổi mật khẩu sau lần đăng nhập đầu.</p>
            </div>
          )}
          {genResult && genResult.skipped.length > 0 && (
            <div className="space-y-1 text-sm">
              <div className="font-medium">Bỏ qua:</div>
              {genResult.skipped.map((s) => (
                <div key={s.lecturerId} className="text-muted-foreground text-xs">{s.lecturerName} — {s.reason}</div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setGenResult(null)} className="cursor-pointer">Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Xoá tài khoản?"
        description={`Tài khoản "${deleteTarget?.username}" sẽ bị xoá vĩnh viễn.`}
        confirmLabel="Xoá"
        onConfirm={handleDelete}
      />
    </div>
  );
}
