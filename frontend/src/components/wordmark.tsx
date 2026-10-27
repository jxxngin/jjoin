import Image from "next/image";

// "jjoin" 글자 로고. 라이트에서는 남색, 다크에서는 흰색 버전을 보여 준다.
// 숨겨진 쪽은 기본 lazy 로딩이라 내려받지 않는다. 그래서 preload 대신 fetchPriority를 쓴다.
// 원본은 design/logo/logo_letter.png, 앱에서 쓰는 366×160 버전은 public/logo-letter*.png.
const WIDTH = 366;
const HEIGHT = 160;

export function Wordmark({ height, priority }: { height: number; priority?: boolean }) {
  const width = Math.round((WIDTH / HEIGHT) * height);

  return (
    <>
      <Image
        src="/logo-letter.png"
        alt="jjoin"
        width={width}
        height={height}
        fetchPriority={priority ? "high" : undefined}
        className="block dark:hidden"
      />
      <Image
        src="/logo-letter-white.png"
        alt="jjoin"
        width={width}
        height={height}
        fetchPriority={priority ? "high" : undefined}
        className="hidden dark:block"
      />
    </>
  );
}
