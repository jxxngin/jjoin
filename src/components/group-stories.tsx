"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { GROUP_COLORS, type GroupColor } from "@/lib/group-style";
import type { GroupActivity } from "@/lib/groups";
import { eventSeenKey, groupSeenKey, markSeen, readSeen, subscribeSeen } from "@/lib/seen";

export type StoryGroup = {
  id: string;
  name: string;
  emoji: string;
  color: GroupColor;
  activity: GroupActivity[];
};

const time = (value: string) => (value ? Date.parse(value) : 0);

// 그룹 화면을 연 뒤에 생겼고, 그 약속 화면도 아직 안 열어 본 활동이 하나라도 있으면 새 소식이다.
// (약속을 알림이나 홈에서 바로 열어 봤으면 그 약속의 댓글은 이미 본 것으로 친다)
function hasNews(group: StoryGroup) {
  const groupSeen = time(readSeen(groupSeenKey(group.id)));
  return group.activity.some(
    ({ eventId, at }) => Date.parse(at) > Math.max(groupSeen, time(readSeen(eventSeenKey(eventId)))),
  );
}

// 인스타 스토리처럼 동그란 그룹 아이콘을 가로로 늘어놓는다.
// 마지막으로 본 뒤 다른 멤버가 약속을 올리거나 댓글을 달았으면 그라데이션 테두리가 돈다. (새 소식)
// 그룹 화면을 열면 읽은 것으로 보고 테두리가 꺼진다.
export function GroupStories({ groups }: { groups: StoryGroup[] }) {
  // 서버는 본 기록을 모르므로 처음엔 새 소식 없이 그리고, 브라우저에서 다시 계산한다.
  const newsSnapshot = useSyncExternalStore(
    subscribeSeen,
    () => groups.map((g) => (hasNews(g) ? "1" : "0")).join(""),
    () => null,
  );

  return (
    <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
      {groups.map((group, i) => {
        const isNew = newsSnapshot?.[i] === "1";
        const ring = isNew ? "story-ring-new" : "bg-stone-200 dark:bg-stone-800";

        return (
          <li key={group.id} className="w-16 shrink-0">
            <Link
              href={`/groups/${group.id}`}
              transitionTypes={["nav-forward"]}
              className="flex flex-col items-center gap-1.5 transition active:scale-95"
            >
              <span className={`rounded-full p-[3px] ${ring}`}>
                {/* 타일 색이 반투명이라 아래 테두리 색이 비치지 않게 배경을 깔아 둔다. */}
                <span className="flex size-14 rounded-full border-2 border-background bg-background">
                  <span
                    className={`flex size-full items-center justify-center rounded-full text-2xl ${GROUP_COLORS[group.color].tile}`}
                  >
                    {group.emoji}
                  </span>
                </span>
              </span>
              <span className={`w-full truncate text-center text-xs ${isNew ? "font-semibold" : ""}`}>
                {group.name}
              </span>
            </Link>
          </li>
        );
      })}
      <li className="w-16 shrink-0">
        <Link
          href="/groups/new"
          transitionTypes={["nav-forward"]}
          className="flex flex-col items-center gap-1.5 transition active:scale-95"
        >
          {/* 그룹 아이콘과 같은 크기: 바깥 3px 여백 + 안쪽 56px 원 */}
          <span className="p-[3px]">
            <span className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-stone-300 text-2xl text-stone-400 dark:border-stone-700">
              +
            </span>
          </span>
          <span className="text-xs text-stone-500">만들기</span>
        </Link>
      </li>
    </ul>
  );
}

// 그룹 화면을 열면 "지금 봤음"을 기록해서 홈의 새 소식 테두리를 끈다.
export function MarkGroupSeen({ groupId, loadedAt }: { groupId: string; loadedAt: string }) {
  useEffect(() => {
    markSeen(groupSeenKey(groupId), [loadedAt]);
  }, [groupId, loadedAt]);
  return null;
}
