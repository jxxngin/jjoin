import { ghostAvatarUrl, type AvatarColor } from "@/lib/avatar-style";

// 프로필 사진. 사진이 없으면 그 사람의 색깔 유령, 색도 모르면 회색 원.
// 카카오 프로필 이미지는 외부 도메인이라 next/image 설정 없이 <img>로 쓴다.
export function Avatar({
  src,
  color,
  size = "md",
}: {
  src: string | null;
  color?: AvatarColor | null;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizeClass = { xs: "size-5", sm: "size-8", md: "size-10", lg: "size-24" }[size];
  const url = src ?? (color ? ghostAvatarUrl(color) : null);

  if (!url) {
    return (
      // 문단 안에도 넣을 수 있도록 span을 쓴다.
      <span
        className={`${sizeClass} inline-block shrink-0 rounded-full bg-stone-300 dark:bg-stone-700`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`${sizeClass} shrink-0 rounded-full object-cover`}
    />
  );
}
