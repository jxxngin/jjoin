// 화면을 불러오는 동안 보이는 로딩. 빈 자리 가운데에 마스코트와 "불러오는 중…"만 띄운다.
// - 회색 뼈대는 그리지 않는다. 실제 내용과 모양이 달라서 오히려 헷갈렸고,
//   화면 전환 중에는 사라지는 이전 화면과 겹쳐 지저분해 보였다.
// - 내용이 들어올 자리만큼 높이(className, 기본 h-64)를 잡아 두어 화면이 덜 출렁이게 한다.
// - 0.3초가 지나도 안 끝날 때만 마스코트를 띄운다. (빨리 뜨는 화면에서는 깜빡이지 않게. globals.css의 .ghost-loading-ghost)
// - 그림은 public/loading/mascot.svg. 유령이 떠다니며 두리번거리고(눈은 몸에서 떼어 따로 움직임) 아래 점 세 개가 차례로 튄다.
//   움직임은 SVG 안의 CSS가 맡고, '동작 줄이기'를 켠 기기에서는 SVG가 스스로 멈춘다.
// - 화면 전체를 대신하는 큰 로딩에만 쓴다. 댓글 같은 작은 부분 로딩은 지금처럼 뼈대만.
export function GhostLoading({ className = "h-64" }: { className?: string }) {
  return (
    <div className={`relative w-full ${className}`}>
      <div className="ghost-loading-ghost" role="status">
        {/* 작은 SVG라 next/image 최적화가 필요 없고, SVG 안의 애니메이션을 그대로 살리려고 <img>를 쓴다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/loading/mascot.svg" width={72} height={81} alt="" />
        <span className="text-sm text-stone-500">불러오는 중…</span>
      </div>
    </div>
  );
}
