// 기본 프로필(파스텔 유령) 색. DB check 제약(0010_avatar_color.sql)과 맞춰야 한다.
// 원본 이미지는 design/pastel-avatars, 앱에서 쓰는 256px 버전은 public/avatars.
export const AVATAR_COLORS = {
  lavender: { label: "라벤더", hex: "#bdace9" },
  sky: { label: "하늘", hex: "#95c4ee" },
  mint: { label: "민트", hex: "#9bd1bb" },
  pink: { label: "분홍", hex: "#e8acc8" },
  peach: { label: "복숭아", hex: "#f1b59b" },
  butter: { label: "버터", hex: "#e2d08d" },
} as const;

export type AvatarColor = keyof typeof AVATAR_COLORS;

export function isAvatarColor(value: string): value is AvatarColor {
  return value in AVATAR_COLORS;
}

export function ghostAvatarUrl(color: AvatarColor) {
  return `/avatars/ghost-${color}.png`;
}
