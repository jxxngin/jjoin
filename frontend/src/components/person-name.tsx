// 닉네임을 바꿔도 누구인지 알 수 있게, 카카오 이름이 다르면 옆에 함께 보여 준다.
export function PersonName({
  nickname,
  kakaoName,
  className = "",
}: {
  nickname: string;
  kakaoName: string | null;
  className?: string;
}) {
  return (
    <span className={className}>
      {nickname}
      {kakaoName && kakaoName !== nickname && (
        <span className="ml-1 text-xs font-normal text-stone-500">({kakaoName})</span>
      )}
    </span>
  );
}
