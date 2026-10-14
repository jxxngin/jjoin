import type { EventStatus } from "@/lib/event-status";

export const statusStyles: Record<EventStatus, { label: string; className: string }> = {
  recruiting: { label: "모집중", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  full: { label: "마감", className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" },
  ended: { label: "종료", className: "bg-stone-200 text-stone-500 dark:bg-stone-800" },
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const { label, className } = statusStyles[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
