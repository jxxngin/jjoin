import type { ReactNode } from "react";

// 화면을 불러오는 동안 보이는 로딩 (시안 E1: 흐린 뼈대 + 가운데 큰 유령).
// - 뼈대(children)는 그대로 그려서 어디에 무엇이 뜰지 보여 주고, 0.3초가 지나도 안 끝나면
//   뼈대를 흐리게 하고 가운데에 통통 튀는 유령과 "불러오는 중…"을 띄운다. (빨리 뜨는 화면에서는 깜빡이지 않게)
// - 화면 전체를 대신하는 큰 뼈대에만 쓴다. 댓글 같은 작은 부분 로딩은 지금처럼 뼈대만.
// - 그림은 public/loading/mascot.svg. 움직임은 SVG 안의 SMIL(animateTransform)이 맡는다.
//   SMIL은 CSS로 멈출 수 없어서, '동작 줄이기'를 켠 기기에는 움직임을 뺀 mascot-still.svg를 보여 준다.
// - JS 없이 CSS 애니메이션만 쓴다. (globals.css의 .ghost-loading)
// - 부모가 가운데 정렬(items-center)이어도 뼈대가 0으로 줄지 않게 전체 너비를 차지한다. (초대 화면)
export function GhostLoading({ children }: { children: ReactNode }) {
  return (
    <div className="ghost-loading relative w-full">
      <div className="ghost-loading-skeleton">{children}</div>
      <div className="ghost-loading-ghost" role="status">
        <picture>
          <source srcSet="/loading/mascot-still.svg" media="(prefers-reduced-motion: reduce)" />
          <img src="/loading/mascot.svg" width={72} height={81} alt="" />
        </picture>
        <span className="text-sm text-stone-500">불러오는 중…</span>
      </div>
    </div>
  );
}
