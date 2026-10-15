"use client";

// HTML을 읽는 즉시 실행되는 인라인 스크립트. (Next 가이드 "Preventing Flash" 방식)
// 브라우저에서 React가 <script>를 그리면 "실행되지 않는다"는 개발 경고가 뜨므로,
// 서버 HTML에서는 text/javascript로 실행시키고 브라우저 렌더에서는 text/plain으로 바꿔 둔다.
// 첫 화면에서 이미 한 번 실행됐으니 다시 실행할 필요는 없다.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
