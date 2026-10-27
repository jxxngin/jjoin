import { GROUP_COLORS, type GroupColor } from "@/lib/group-style";

// 그룹 대표 이모지를 색깔 타일 위에 보여 준다.
export function GroupAvatar({
  emoji,
  color,
  size = "md",
}: {
  emoji: string;
  color: GroupColor;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "size-16 rounded-2xl text-4xl" : "size-11 rounded-xl text-2xl";

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${sizeClass} ${GROUP_COLORS[color].tile}`}
    >
      {emoji}
    </span>
  );
}
