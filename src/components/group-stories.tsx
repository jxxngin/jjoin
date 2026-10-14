"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { GROUP_COLORS, type GroupColor } from "@/lib/group-style";

// 그룹을 마지막으로 본 시각. 기기마다 따로 저장한다.
const seenKey = (groupId: string) => `group-seen:${groupId}`;

function readSeen(groupId: string) {
  try {
    return localStorage.getItem(seenKey(groupId));
  } catch {
    return null;
  }
}

export type StoryGroup = {
  id: string;
  name: string;
  emoji: string;
  color: GroupColor;
  latestActivityAt: string | null;
};

const noopSubscribe = () => () => {};

// 인스타 스토리처럼 동그란 그룹 아이콘을 가로로 늘어놓는다.
// 마지막으로 본 뒤 다른 멤버가 약속을 올리거나 댓글을 달았으면 그라데이션 테두리가 돈다. (새 소식)
// 그룹 화면을 열면 읽은 것으로 보고 테두리가 꺼진다.
export function GroupStories({ groups }: { groups: StoryGroup[] }) {
  // 서버는 본 기록을 모르므로 처음엔 새 소식 없이 그리고, 브라우저에서 다시 계산한다.
  const seenSnapshot = useSyncExternalStore(
    noopSubscribe,
    () => groups.map((g) => readSeen(g.id) ?? "").join("|"),
    () => null,
  );
  const seen = seenSnapshot?.split("|") ?? null;

  return (
    <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
      {groups.map((group, i) => {
        const isNew =
          seen !== null &&
          group.latestActivityAt !== null &&
          (seen[i] === "" || Date.parse(group.latestActivityAt) > Date.parse(seen[i]));
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
export function MarkGroupSeen({ groupId }: { groupId: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(seenKey(groupId), new Date().toISOString());
    } catch {
      // 저장이 막힌 브라우저에서는 새 소식 표시를 끄지 못할 뿐이다.
    }
  }, [groupId]);
  return null;
}
