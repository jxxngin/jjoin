// 그룹 프로필 꾸미기 선택지. DB의 check 제약(0009_group_profile.sql)과 맞춰야 한다.

export const GROUP_COLORS = {
  orange: { label: "주황", tile: "bg-orange-400/25", swatch: "bg-orange-400" },
  rose: { label: "분홍", tile: "bg-rose-400/25", swatch: "bg-rose-400" },
  amber: { label: "노랑", tile: "bg-amber-300/35", swatch: "bg-amber-300" },
  emerald: { label: "초록", tile: "bg-emerald-400/25", swatch: "bg-emerald-400" },
  sky: { label: "하늘", tile: "bg-sky-400/25", swatch: "bg-sky-400" },
  violet: { label: "보라", tile: "bg-violet-400/25", swatch: "bg-violet-400" },
  stone: { label: "회색", tile: "bg-stone-400/25", swatch: "bg-stone-400" },
} as const;

export type GroupColor = keyof typeof GROUP_COLORS;

export const GROUP_EMOJIS = [
  "👥", "🍻", "🍖", "☕", "🍜", "🍰",
  "⚽", "🏀", "🏸", "🎳", "🏃", "🧗",
  "🎮", "🎤", "🎬", "📚", "✈️", "🏕️",
  "🎓", "💼", "🎨", "🎸", "🐶", "🔥",
];

export const DEFAULT_GROUP_EMOJI = "👥";
export const DEFAULT_GROUP_COLOR: GroupColor = "orange";

export function isGroupColor(value: string): value is GroupColor {
  return value in GROUP_COLORS;
}
