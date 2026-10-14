import type { EventStatus } from "@/lib/event-status";

export const statusStyles: Record<EventStatus, { label: string; className: string }> = {
  recruiting: { label: "모집중", className: "bg-brand/10 text-brand" },
  full: { label: "마감", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" },
  ended: { label: "종료", className: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800" },
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const { label, className } = statusStyles[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
