"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { PersonName } from "@/components/person-name";
import type { GroupMember } from "@/lib/groups";

// 접힌 상태에서 보여 줄 프로필 사진 수
const PREVIEW = 5;

// 평소엔 겹친 프로필 사진만 보이고, 누르면 이름까지 있는 전체 명단이 부드럽게 펼쳐진다.
export function MemberList({ members, userId }: { members: GroupMember[]; userId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-stone-100 dark:bg-stone-900">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex -space-x-2">
          {members.slice(0, PREVIEW).map((member) => (
            <span key={member.id} className="rounded-full ring-2 ring-stone-100 dark:ring-stone-900">
              <Avatar src={member.avatarUrl} color={member.avatarColor} size="sm" />
            </span>
          ))}
        </span>
        {members.length > PREVIEW && (
          <span className="text-sm font-medium text-stone-500">+{members.length - PREVIEW}</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-sm text-stone-500">
          {open ? "접기" : "자세히"}
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={`size-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M5 8l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/* 높이를 0fr ↔ 1fr로 바꿔서 내용 높이를 몰라도 부드럽게 펼친다. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden" inert={!open}>
          <ul className="flex flex-col gap-1 border-t border-stone-200 px-4 py-2 dark:border-stone-800">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-2">
                <Avatar src={member.avatarUrl} color={member.avatarColor} />
                <PersonName nickname={member.nickname} kakaoName={member.kakaoName} className="font-medium" />
                {member.id === userId && <span className="text-sm text-stone-500">(나)</span>}
                {member.role === "owner" && (
                  <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-ink">
                    방장
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
