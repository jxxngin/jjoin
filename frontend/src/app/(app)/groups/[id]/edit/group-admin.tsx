"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { PersonName } from "@/components/person-name";
import type { GroupMember } from "@/lib/groups";
import { deleteGroup, kickMember, regenerateInviteCode, transferOwnership } from "../../actions";

const sectionTitle = "text-sm font-semibold text-stone-500";
const smallButton = "rounded-full px-3 py-1 text-xs font-medium transition active:scale-95 disabled:opacity-50";

// 방장 전용 그룹 관리: 멤버 내보내기·방장 넘기기, 초대 링크 새로 만들기, 그룹 삭제
export function GroupAdmin({
  groupId,
  groupName,
  members,
  ownerId,
}: {
  groupId: string;
  groupName: string;
  members: GroupMember[];
  ownerId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function run(confirmText: string, action: () => Promise<{ error?: string }>, done?: string) {
    if (!confirm(confirmText)) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await action();
      setMessage(result.error ?? done);
    });
  }

  const others = members.filter((m) => m.id !== ownerId);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>멤버 관리</h2>
        {others.length === 0 ? (
          <p className="text-sm text-stone-500">아직 다른 멤버가 없어요.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-stone-200 rounded-2xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
            {others.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar src={member.avatarUrl} color={member.avatarColor} size="sm" />
                <PersonName
                  nickname={member.nickname}
                  kakaoName={member.kakaoName}
                  className="min-w-0 flex-1 truncate text-sm font-medium"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      `${member.nickname}님에게 방장을 넘길까요? 넘기면 나는 일반 멤버가 돼요.`,
                      () => transferOwnership(groupId, member.id),
                    )
                  }
                  className={`${smallButton} bg-stone-100 dark:bg-stone-900`}
                >
                  방장 넘기기
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      `${member.nickname}님을 그룹에서 내보낼까요?`,
                      () => kickMember(groupId, member.id),
                      `${member.nickname}님을 내보냈어요.`,
                    )
                  }
                  className={`${smallButton} text-red-600`}
                >
                  내보내기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>초대 링크</h2>
        <p className="text-sm text-stone-500">
          새로 만들면 예전에 보낸 초대 링크로는 더 이상 들어올 수 없어요.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              "초대 링크를 새로 만들까요? 예전 링크는 쓸 수 없게 돼요.",
              () => regenerateInviteCode(groupId),
              "새 초대 링크를 만들었어요. 그룹 화면에서 복사해 보내 주세요.",
            )
          }
          className="h-11 self-start rounded-xl bg-stone-100 px-4 text-sm font-medium dark:bg-stone-900"
        >
          초대 링크 새로 만들기
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={`${sectionTitle} text-red-600`}>그룹 삭제</h2>
        <p className="text-sm text-stone-500">
          약속·댓글·투표가 모두 지워지고 되돌릴 수 없어요.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(`"${groupName}" 그룹을 정말 삭제할까요? 되돌릴 수 없어요.`, () => deleteGroup(groupId))
          }
          className="h-11 self-start rounded-xl bg-red-50 px-4 text-sm font-medium text-red-600 dark:bg-red-950"
        >
          그룹 삭제
        </button>
      </section>

      {message && (
        <p role="status" className="text-sm text-stone-600 dark:text-stone-400">
          {message}
        </p>
      )}
    </div>
  );
}
