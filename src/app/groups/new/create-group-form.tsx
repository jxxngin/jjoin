"use client";

import { useActionState } from "react";
import { createGroup } from "../actions";

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">그룹 이름</span>
        <input
          name="name"
          required
          maxLength={30}
          autoFocus
          placeholder="예: 대학 동기들"
          className="h-12 rounded-xl border border-zinc-300 bg-transparent px-4 outline-none focus:border-brand dark:border-zinc-700"
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
