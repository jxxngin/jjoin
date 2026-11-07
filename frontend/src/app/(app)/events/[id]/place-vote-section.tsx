import { VoterCard } from "@/components/voter-card";
import { getUserId } from "@/lib/auth";
import { getPlaceOptions, type PlaceTarget } from "@/lib/places";
import { AddPlaceOption, PlaceOptionActions, PlaceVoteButton } from "./place-vote";

// 장소 투표. 후보가 없으면 시작 버튼만 두고(장소가 정해져 있으면 "다른 장소 제안"), 있으면 후보와 표를 보여 준다.
// 약속 화면과 날짜 투표 화면이 같이 쓴다. 멤버 누구나 카카오맵 장소를 후보로 올리고 투표하며,
// 약속·투표를 만든 사람이나 방장이 하나를 확정한다.
export async function PlaceVote({
  target,
  hasPlace,
  canManage,
}: {
  target: PlaceTarget;
  hasPlace: boolean;
  canManage: boolean;
}) {
  const [options, userId] = await Promise.all([getPlaceOptions(target), getUserId()]);
  const maxVotes = Math.max(1, ...options.map((o) => o.voters.length));

  if (options.length === 0) {
    return (
      <AddPlaceOption
        target={target}
        label={hasPlace ? "+ 다른 장소 제안하기 (장소 투표)" : "📍 장소 투표 시작하기 · 후보 장소 올리기"}
      />
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">
        📍 장소 투표 <span className="text-sm font-normal text-stone-500">· 좋은 곳을 모두 골라 주세요</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {options.map((option) => (
          // 표 수만큼 배경 막대가 차고, 카드를 누르면 고른 사람 이름이 펼쳐진다. (날짜 투표와 같은 모양)
          <VoterCard
            key={option.id}
            voters={option.voters}
            barWidth={(option.voters.length / maxVotes) * 100}
            extra={
              <PlaceOptionActions
                optionId={option.id}
                name={option.name}
                canConfirm={canManage}
                canDelete={canManage || option.addedBy === userId}
              />
            }
            action={
              <PlaceVoteButton
                key={`${option.voters.length}-${option.voters.some((v) => v.id === userId)}`}
                optionId={option.id}
                voted={option.voters.some((v) => v.id === userId)}
              />
            }
          >
            <a href={option.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium underline-offset-4 hover:underline">
              {option.name}
            </a>
            {option.address && <span className="truncate text-xs text-stone-500">{option.address}</span>}
          </VoterCard>
        ))}
      </ul>
      <AddPlaceOption target={target} label="+ 후보 장소 더 올리기" />
    </section>
  );
}
