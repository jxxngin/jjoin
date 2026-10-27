"use client";

import { useActionState, useState, useTransition } from "react";
import { keepFormOnSubmit } from "@/lib/keep-form";
import type { PlaceTarget } from "@/lib/places";
import { PlaceField } from "../place-field";
import {
  addPlaceOption,
  confirmPlaceOption,
  deletePlaceOption,
  togglePlaceVote,
  type PlaceOptionFormState,
} from "../place-actions";

const EMPTY_PLACE = { name: "", address: "", lat: "", lng: "", url: "" };

// 후보 옆 투표 버튼. 누르는 즉시 바뀌고, 저장에 실패하면 되돌린다.
export function PlaceVoteButton({ optionId, voted }: { optionId: string; voted: boolean }) {
  const [on, setOn] = useState(voted);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        startTransition(async () => {
          const result = await togglePlaceVote(optionId, next);
          if (result.error) setOn(!next);
        });
      }}
      className={`flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-medium transition active:scale-95 ${
        on ? "bg-brand text-white" : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300"
      }`}
    >
      {on ? "✓ 좋아요" : "여기 좋아요"}
    </button>
  );
}

// 후보 아래 작은 글자 버튼: 확정(약속 관리자), 지우기(올린 사람·관리자)
export function PlaceOptionActions({
  optionId,
  name,
  canConfirm,
  canDelete,
}: {
  optionId: string;
  name: string;
  canConfirm: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function run(confirmText: string, action: () => Promise<{ error?: string }>) {
    if (!confirm(confirmText)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  if (!canConfirm && !canDelete) return null;
  return (
    <span className="flex items-center gap-3 text-xs">
      {canConfirm && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(`'${name}'(으)로 장소를 확정할까요?\n다른 후보와 표는 정리돼요.`, () => confirmPlaceOption(optionId))}
          className="font-semibold text-brand-ink disabled:opacity-50"
        >
          이 장소로 확정
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("이 후보를 지울까요?", () => deletePlaceOption(optionId))}
          className="text-stone-400 disabled:opacity-50"
        >
          지우기
        </button>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </span>
  );
}

// 후보 장소 올리기. 처음엔 버튼만 보이고, 누르면 카카오맵 검색 칸이 열린다.
export function AddPlaceOption({ target, label }: { target: PlaceTarget; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<PlaceOptionFormState, FormData>(
    addPlaceOption.bind(null, target),
    {},
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-xl border border-dashed border-stone-300 text-sm text-stone-500 dark:border-stone-700"
      >
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={keepFormOnSubmit(formAction)} className="flex flex-col gap-2 rounded-2xl border border-stone-200 p-3 dark:border-stone-800">
      {/* 올릴 때마다 검색 칸을 비운다. */}
      <PlaceField key={state.added ?? 0} defaultValue={EMPTY_PLACE} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 flex-1 rounded-xl bg-stone-100 text-sm font-medium dark:bg-stone-900"
        >
          닫기
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-11 flex-1 rounded-xl bg-brand text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "올리는 중…" : "후보로 올리기"}
        </button>
      </div>
    </form>
  );
}
