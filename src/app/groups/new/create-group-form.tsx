"use client";

import { useActionState } from "react";
import { DEFAULT_GROUP_COLOR, DEFAULT_GROUP_EMOJI } from "@/lib/group-style";
import { createGroup } from "../actions";
import { GroupProfileFields } from "../group-profile-fields";

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <GroupProfileFields defaultEmoji={DEFAULT_GROUP_EMOJI} defaultColor={DEFAULT_GROUP_COLOR} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">그룹 이름</span>
        <input
          name="name"
          required
          maxLength={30}
          placeholder="예: 대학 동기들"
          className="h-12 rounded-xl border border-stone-300 bg-transparent px-4 outline-none focus:border-brand dark:border-stone-700"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-brand font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "만드는 중…" : "만들기"}
      </button>
    </form>
  );
}
