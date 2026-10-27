import { ToggleTab } from "@/components/toggle-tab";

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

  return (
    <div className="flex rounded-full bg-stone-100 p-1 dark:bg-stone-900">
      {/* 목록은 왼쪽, 캘린더는 오른쪽 페이지처럼 넘어간다. (SlideView) */}
      <ToggleTab href={href("list")} active={mode === "list"} transition="view-back">
        목록
      </ToggleTab>
      <ToggleTab href={href("calendar")} active={mode === "calendar"} transition="view-forward">
        캘린더
      </ToggleTab>
    </div>
  );
}
