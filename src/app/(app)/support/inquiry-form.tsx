"use client";

import { startTransition, useActionState, useState } from "react";
import { createInquiry } from "./actions";

type Category = { value: string; icon: string; label: string; hint: string };

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-transparent px-4 outline-none focus:border-brand dark:border-stone-700";

// 문의 작성. 유형을 고르고 제목·내용을 쓴다. 문의를 연 화면과 기기 정보는 숨은 칸으로 같이 보낸다.
export function InquiryForm({ categories, fromPath }: { categories: Category[]; fromPath: string | null }) {
  const [state, formAction, pending] = useActionState(createInquiry, {});
  const [category, setCategory] = useState("");
  const isBug = category === "bug";

  return (
    <form
      // 입력한 내용이 지워지지 않게 직접 보낸다. (keep-form.ts와 같은 방식) 기기 정보는 이때 붙인다.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("userAgent", navigator.userAgent);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="pagePath" value={fromPath ?? ""} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">문의 유형</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="문의 유형">
          {categories.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={category === option.value}
              onClick={() => setCategory(option.value)}
              className={`flex flex-col items-start gap-0.5 rounded-2xl border-2 px-3 py-2.5 text-left transition ${
                category === option.value ? "border-brand bg-brand/10" : "border-stone-200 dark:border-stone-800"
              }`}
            >
              <span className="text-sm font-medium">
                {option.icon} {option.label}
              </span>
              <span className="text-xs text-stone-500">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">제목</span>
        <input
          name="title"
          required
          maxLength={80}
          placeholder={isBug ? "예: 시간 고르는 목록이 하얗게 보여요" : "한 줄로 알려 주세요"}
          className={`${inputClass} h-12 text-base`}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">내용</span>
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={6}
          placeholder={
            isBug
              ? "어느 화면에서 무엇을 눌렀더니 어떻게 됐는지 적어 주세요.\n예: 약속 만들기 → 시간 칸을 누르면 목록 글자가 안 보여요 (삼성폰, 웨일)"
              : "자세히 적어 주실수록 빨리 도와드릴 수 있어요."
          }
          className={`${inputClass} py-3 text-base`}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || !category}
        className="h-12 rounded-xl bg-brand font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "보내는 중…" : category ? "문의 보내기" : "문의 유형을 골라 주세요"}
      </button>
    </form>
  );
}
