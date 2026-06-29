"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, ArrowRight } from "lucide-react";
import { countPendingSubmissionsServer } from "../../actions/submissions";

// Compact banner on the admin dashboard linking to the student-submission queue.
// Hidden when there's nothing to review, so it never adds noise on a clean day.
export function PendingSubmissionsCard() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    countPendingSubmissionsServer().then(setCount).catch(() => setCount(null));
  }, []);

  if (!count) return null;

  return (
    <Link
      href="/admin/submissions"
      className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-700 transition-colors hover:bg-amber-500/15"
    >
      <Inbox className="size-5 shrink-0" />
      <span className="text-sm font-medium">
        <strong className="font-semibold">{count}</strong> bài sinh viên đang chờ duyệt
      </span>
      <ArrowRight className="size-4 ml-auto shrink-0" />
    </Link>
  );
}
