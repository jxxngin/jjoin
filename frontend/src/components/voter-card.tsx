"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import type { AvatarColor } from "@/lib/avatar-style";

type Voter = { id: string; nickname: string; avatarUrl: string | null; avatarColor: AvatarColor };

// 접힌 상태에서 겹쳐 보여 줄 프로필 사진 수
const PREVIEW = 5;

// 투표 후보 카드 (날짜 투표·장소 투표 공용).
// 카드를 누르면 그 후보를 고른 사람의 이름 목록이 카드 아래로 부드럽게 펼쳐진다. (그룹 화면 멤버 목록과 같은 방식)
// 카드 안의 투표·확정·지우기 버튼과 장소 링크는 펼치지 않고 원래대로 동작한다.
export function VoterCard({
  voters,
  children,
  extra,
  action,
  barWidth,
  className = "rounded-2xl border border-stone-200 dark:border-stone-800",
}: {
  voters: Voter[];
  // 후보 이름 (장소면 주소까지)
  children: ReactNode;
  // 사진 줄 아래에 붙는 것 (장소 확정·지우기)
  extra?: ReactNode;
  // 오른쪽 버튼 (투표, 확정)
  action?: ReactNode;
  // 표 수만큼 차는 배경 막대 (0~100%). 없으면 그리지 않는다.
  barWidth?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const canOpen = voters.length > 0;

  function onCardClick(event: MouseEvent<HTMLLIElement>) {
    if (!canOpen) return;
    // 카드 안의 다른 버튼·링크·입력칸을 누른 것이면 펼치지 않는다.
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select, label, form")) return;
    setOpen((value) => !value);
  }

  return (
    <li onClick={onCardClick} className={`relative overflow-hidden px-4 py-3 ${canOpen ? "cursor-pointer" : ""} ${className}`}>
      {barWidth !== undefined && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-brand/10 transition-[width] duration-500"
          style={{ width: `${barWidth}%` }}
        />
      )}
      <div className="relative flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {children}
          {canOpen ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label={`고른 사람 ${voters.length}명 ${open ? "접기" : "보기"}`}
              className="flex w-fit items-center gap-1.5"
            >
              <VoterFaces voters={voters} />
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={`size-3.5 text-stone-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              >
                <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <span className="text-xs text-stone-400">아직 없어요</span>
          )}
          {extra}
        </div>
        {action}
      </div>

      {canOpen && (
        // 높이를 0fr ↔ 1fr로 바꿔서 내용 높이를 몰라도 부드럽게 펼친다.
        <div
          className={`relative grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden" inert={!open}>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
              {voters.map((voter) => (
                <li key={voter.id} className="flex min-w-0 items-center gap-2">
                  <Avatar src={voter.avatarUrl} color={voter.avatarColor} size="xs" />
                  <span className="truncate text-sm">{voter.nickname}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}

function VoterFaces({ voters }: { voters: Voter[] }) {
  return (
    <>
      <span className="flex -space-x-1.5">
        {voters.slice(0, PREVIEW).map((voter) => (
          <span key={voter.id} className="rounded-full ring-2 ring-background">
            <Avatar src={voter.avatarUrl} color={voter.avatarColor} size="xs" />
          </span>
        ))}
      </span>
      <span className="text-xs text-stone-500">{voters.length}명</span>
    </>
  );
}
