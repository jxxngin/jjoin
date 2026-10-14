import Link from "next/link";

export type ViewMode = "list" | "calendar";

// 목록 / 캘린더 전환. basePath에 ?view=calendar를 붙여 캘린더로 간다.
export function ViewToggle({ basePath, mode }: { basePath: string; mode: ViewMode }) {
  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ${
      active ? "bg-white shadow-sm dark:bg-stone-700" : "text-stone-500"
    }`;

  return (
    <div className="flex rounded-full bg-stone-100 p-1 dark:bg-stone-900">
      <Link href={basePath} className={tab(mode === "list")} replace scroll={false}>
        목록
      </Link>
      <Link
        href={`${basePath}?view=calendar`}
        className={tab(mode === "calendar")}
        replace
        scroll={false}
      >
        캘린더
      </Link>
    </div>
  );
}
