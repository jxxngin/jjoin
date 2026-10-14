"use client";

import { useActionState } from "react";
import type { EventFormState, EventFormValues } from "./actions";
import { DateTimeField } from "./date-time-field";
import { PlaceField } from "./place-field";

const inputClass =
  "h-12 w-full rounded-xl border border-stone-300 bg-transparent px-4 outline-none focus:border-brand dark:border-stone-700";

export function EventForm({
  action,
  initialValues,
  submitLabel,
}: {
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  initialValues: EventFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initialValues;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="제목">
        <input
          name="title"
          required
          maxLength={50}
          defaultValue={values.title}
          placeholder="예: 금요일 저녁 삼겹살"
          className={inputClass}
        />
      </Field>

      <Field label="날짜와 시간">
        <DateTimeField name="startsAt" defaultValue={values.startsAt} />
      </Field>

      {/* 검색 결과 버튼을 탭할 때 label이 입력칸으로 초점을 옮기지 않게 div로 감싼다. */}
      <Field label="장소" hint="선택" as="div">
        <PlaceField
          defaultValue={{
            name: values.placeName,
            address: values.placeAddress,
            lat: values.placeLat,
            lng: values.placeLng,
            url: values.placeUrl,
          }}
        />
      </Field>

      <Field label="최대 인원" hint="비워 두면 제한 없음">
        <input
          type="number"
          name="maxPeople"
          min={1}
          max={100}
          inputMode="numeric"
          defaultValue={values.maxPeople}
          placeholder="제한 없음"
          className={inputClass}
        />
      </Field>

      <Field label="메모" hint="선택">
        <textarea
          name="memo"
          maxLength={500}
          rows={3}
          defaultValue={values.memo}
          placeholder="회비, 준비물 등"
          className="w-full rounded-xl border border-stone-300 bg-transparent px-4 py-3 outline-none focus:border-brand dark:border-stone-700"
        />
      </Field>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-brand font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "저장하는 중…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  as: Wrapper = "label",
  children,
}: {
  label: string;
  hint?: string;
  as?: "label" | "div";
  children: React.ReactNode;
}) {
  return (
    <Wrapper className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {label}
        {hint && <span className="ml-1 font-normal text-stone-500">· {hint}</span>}
      </span>
      {children}
    </Wrapper>
  );
}
