"use client";

import { useActionState, useState } from "react";
import { keepFormOnSubmit } from "@/lib/keep-form";
import { deleteAccount } from "../delete-actions";

// "탈퇴"를 똑같이 입력해야 버튼이 눌린다.
export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccount, {});
  const [text, setText] = useState("");
  const ready = text.trim() === "탈퇴";

  return (
    <form onSubmit={keepFormOnSubmit(formAction)} className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          확인을 위해 <b className="text-red-600">탈퇴</b>를 입력해 주세요
        </span>
        <input
          name="confirm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          placeholder="탈퇴"
          className="h-12 rounded-xl border border-stone-300 bg-transparent px-4 text-base outline-none focus:border-red-500 dark:border-stone-700"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={!ready || pending}
        className="h-12 rounded-xl bg-red-600 font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {pending ? "탈퇴하는 중…" : "회원 탈퇴"}
      </button>
    </form>
  );
}
