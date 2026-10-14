import Link from "next/link";

export type ViewMode = "list" | "calendar";

// 목록 / 캘린더 전환. 기본 보기는 basePath 그대로, 다른 쪽은 ?view=… 를 붙인다.
export function ViewToggle({
  basePath,
  mode,
  defaultMode = "list",
}: {
  basePath: string;
  mode: ViewMode;
  defaultMode?: ViewMode;
}) {
  const href = (target: ViewMode) => (target === defaultMode ? basePath : `${basePath}?view=${target}`);
  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ${
      active ? "bg-white shadow-sm dark:bg-stone-700" : "text-stone-500"
    }`;

  return (
    <div className="flex rounded-full bg-stone-100 p-1 dark:bg-stone-900">
      <Link href={href("list")} className={tab(mode === "list")} replace scroll={false}>
        목록
      </Link>
      <Link href={href("calendar")} className={tab(mode === "calendar")} replace scroll={false}>
        캘린더
      </Link>
    </div>
  );
}
