"use client";

import { useActionState, useState } from "react";
import { keepFormOnSubmit } from "@/lib/keep-form";
import { DateTimeField } from "@/app/(app)/events/date-time-field";
import { PlaceField } from "@/app/(app)/events/place-field";
import type { PollFormState } from "./actions";
import { TripRangeField, TripTimeField } from "./trip-fields";

const inputClass =
  "h-12 w-full rounded-xl border border-stone-300 bg-transparent px-4 outline-none focus:border-brand dark:border-stone-700";

const EMPTY_PLACE = { name: "", address: "", lat: "", lng: "", url: "" };

const KINDS = [
  { value: "day", icon: "⏰", label: "당일 약속", hint: "날짜와 시간 후보" },
  { value: "trip", icon: "🧳", label: "여러 날 약속", hint: "가는 날~오는 날 후보" },
] as const;

// 날짜 투표 만들기. 후보를 2~10개 넣으면 멤버들이 되는 후보에 모두 투표한다.
// 당일 약속은 날짜와 시간을, 여러 날 약속(여행 등)은 가는 날~오는 날을 후보로 올린다.
export function PollForm({
  action,
}: {
  action: (prev: PollFormState, formData: FormData) => Promise<PollFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // 후보마다 고유 key가 있어야 지울 때 다른 칸의 입력이 섞이지 않는다.
  const [slots, setSlots] = useState([1, 2]);
  const [nextKey, setNextKey] = useState(3);
  const [kind, setKind] = useState<"day" | "trip">("day");

  function addSlot() {
    setSlots((list) => [...list, nextKey]);
    setNextKey((key) => key + 1);
  }

  return (
    <form onSubmit={keepFormOnSubmit(formAction)} className="flex flex-col gap-5">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="투표 종류">
        {KINDS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={kind === option.value}
            onClick={() => setKind(option.value)}
            className={`flex flex-col items-start gap-0.5 rounded-2xl border-2 px-3 py-2.5 text-left transition ${
              kind === option.value
                ? "border-brand bg-brand/10"
                : "border-stone-200 text-stone-500 dark:border-stone-800"
            }`}
          >
            <span className="font-medium">
              {option.icon} {option.label}
            </span>
            <span className="text-xs text-stone-500">{option.hint}</span>
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">제목</span>
        <input
          name="title"
          required
          maxLength={50}
          placeholder={kind === "trip" ? "예: 제주도 여행" : "예: 연말 송년회"}
          className={inputClass}
        />
      </label>

      {kind === "trip" && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            출발 시간 <span className="font-normal text-stone-500">· 모든 후보에 같이 써요</span>
          </span>
          <TripTimeField />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          {kind === "trip" ? "후보 기간" : "후보 날짜"}{" "}
          <span className="font-normal text-stone-500">· 2~10개, 멤버는 여러 후보에 투표할 수 있어요</span>
        </span>
        <ol className="flex flex-col gap-3">
          {slots.map((key, i) => (
            <li key={key} className="reveal flex gap-2">
              <span className="mt-3 w-5 shrink-0 text-sm text-stone-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                {kind === "trip" ? <TripRangeField /> : <DateTimeField name="options" defaultValue="" />}
              </div>
              {slots.length > 2 && (
                <button
                  type="button"
                  onClick={() => setSlots((list) => list.filter((k) => k !== key))}
                  aria-label={`후보 ${i + 1} 지우기`}
                  className="mt-3 h-6 shrink-0 px-1 text-stone-400"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ol>
        {slots.length < 10 && (
          <button
            type="button"
            onClick={addSlot}
            className="h-11 rounded-xl border border-dashed border-stone-300 text-sm text-stone-500 dark:border-stone-700"
          >
            {kind === "trip" ? "+ 후보 기간 추가" : "+ 후보 날짜 추가"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          장소 <span className="font-normal text-stone-500">· 선택</span>
        </span>
        <PlaceField defaultValue={EMPTY_PLACE} />
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          최대 인원 <span className="font-normal text-stone-500">· 비워 두면 제한 없음</span>
        </span>
        <input type="number" name="maxPeople" min={1} max={100} inputMode="numeric" placeholder="제한 없음" className={inputClass} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          메모 <span className="font-normal text-stone-500">· 선택</span>
        </span>
        <textarea
          name="memo"
          maxLength={500}
          rows={3}
          placeholder="회비, 준비물 등"
          className="w-full rounded-xl border border-stone-300 bg-transparent px-4 py-3 outline-none focus:border-brand dark:border-stone-700"
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-brand font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "만드는 중…" : "투표 올리기"}
      </button>
    </form>
  );
}
