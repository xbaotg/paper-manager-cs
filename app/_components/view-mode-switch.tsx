"use client";

import { ShieldCheck, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { switchViewMode } from "@/app/actions/auth";

// Header control for dual-capable users (a lecturer promoted to admin). Submits
// a bound server action that flips the view-mode cookie and redirects to the
// target area. `target` is the mode to switch INTO.
export function ViewModeSwitch({ target }: { target: "admin" | "user" }) {
  const action = switchViewMode.bind(null, target);
  return (
    <form action={action}>
      <Button type="submit" variant="outline" size="sm" className="cursor-pointer gap-1.5">
        {target === "admin" ? (
          <>
            <ShieldCheck className="size-4" /> Chế độ quản trị
          </>
        ) : (
          <>
            <GraduationCap className="size-4" /> Chế độ giảng viên
          </>
        )}
      </Button>
    </form>
  );
}
