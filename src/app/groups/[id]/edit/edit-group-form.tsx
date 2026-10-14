"use client";

import { useActionState } from "react";
import type { GroupColor } from "@/lib/group-style";
import { updateGroup } from "../../actions";
import { GroupProfileFields } from "../../group-profile-fields";

const inputClass =
  "h-12 rounded-xl border border-stone-300 bg-transparent px-4 outline-none focus:border-brand dark:border-stone-700";

export function EditGroupForm({
  group,
}: {
  group: { id: string; name: string; emoji: string; color: GroupColor; description: string | null };
}) {
  const [state, formAction, pending] = useActionState(updateGroup.bind(null, group.id), {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <GroupProfileFields defaultEmoji={group.emoji} defaultColor={group.color} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">그룹 이름</span>
        <input name="name" required maxLength={30} defaultValue={group.name} className={inputClass} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          한 줄 소개 <span className="font-normal text-stone-500">· 선택</span>
        </span>
        <input
          name="description"
          maxLength={60}
          defaultValue={group.description ?? ""}
          placeholder="예: 매주 금요일 풋살 모임"
          className={inputClass}
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-brand font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "저장하는 중…" : "저장"}
      </button>
    </form>
  );
}
