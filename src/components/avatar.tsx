// 카카오 프로필 이미지는 외부 도메인이라 next/image 설정 없이 <img>로 쓴다.
export function Avatar({
  src,
  size = "md",
}: {
  src: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "size-8" : "size-10";

  if (!src) {
    return (
      // 문단 안에도 넣을 수 있도록 span을 쓴다.
      <span
        className={`${sizeClass} inline-block shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`${sizeClass} shrink-0 rounded-full object-cover`}
    />
  );
}
