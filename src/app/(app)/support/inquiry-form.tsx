"use client";

import { startTransition, useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createInquiry } from "./actions";

type Category = { value: string; icon: string; label: string; hint: string };

const MAX_IMAGES = 3;
const MAX_SIDE = 1600;

// 스크린샷을 긴 변 1600px JPEG로 줄인다. (저장소 장당 3MB 제한, 휴대폰 데이터 절약)
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("사진을 처리하지 못했어요."))), "image/jpeg", 0.8),
  );
}

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-transparent px-4 outline-none focus:border-brand dark:border-stone-700";

// 문의 작성. 유형을 고르고 제목·내용을 쓰고, 스크린샷을 붙일 수 있다. 문의를 연 화면과 기기 정보는 숨은 칸으로 같이 보낸다.
export function InquiryForm({ categories, fromPath }: { categories: Category[]; fromPath: string | null }) {
  const [state, formAction, pending] = useActionState(createInquiry, {});
  const [category, setCategory] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const isBug = category === "bug";

  function addImages(files: FileList | null) {
    const picked = [...(files ?? [])].filter((file) => file.type.startsWith("image/"));
    setImages((current) =>
      [...current, ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, MAX_IMAGES),
    );
  }

  function removeImage(index: number) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, i) => i !== index);
    });
  }

  // 사진을 내 폴더({user id}/{임의 이름}.jpg)에 올리고 경로를 돌려준다.
  async function uploadImages(): Promise<string[] | null> {
    if (images.length === 0) return [];
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const paths: string[] = [];
    for (const { file } of images) {
      const path = `${data.user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("inquiry-images")
        .upload(path, await shrink(file), { contentType: "image/jpeg" });
      if (error) return null;
      paths.push(path);
    }
    return paths;
  }

  return (
    <form
      // 입력한 내용이 지워지지 않게 직접 보낸다. (keep-form.ts와 같은 방식) 기기 정보는 이때 붙인다.
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("userAgent", navigator.userAgent);
        setUploadError(undefined);
        setUploading(true);
        const paths = await uploadImages().catch(() => null);
        setUploading(false);
        if (paths === null) {
          setUploadError("사진을 올리지 못했어요. 사진을 빼거나 다시 시도해 주세요.");
          return;
        }
        for (const path of paths) formData.append("images", path);
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

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          스크린샷 <span className="font-normal text-stone-500">(선택, {MAX_IMAGES}장까지)</span>
        </span>
        <div className="flex gap-2">
          {images.map((image, i) => (
            <div key={image.preview} className="relative size-20 overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-900">
              {/* eslint-disable-next-line @next/next/no-img-element -- 올리기 전 미리 보기(blob 주소) */}
              <img src={image.preview} alt={`스크린샷 ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={`스크린샷 ${i + 1} 빼기`}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 text-xs text-stone-500 dark:border-stone-700">
              <span className="text-xl">＋</span>
              사진
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addImages(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <span className="text-xs text-stone-500">나와 관리자만 볼 수 있어요. 다른 사람의 개인정보가 보이면 가리고 올려 주세요.</span>
      </div>

      {(uploadError ?? state.error) && <p className="text-sm text-red-600">{uploadError ?? state.error}</p>}

      <button
        type="submit"
        disabled={pending || uploading || !category}
        className="h-12 rounded-xl bg-brand font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {uploading ? "사진 올리는 중…" : pending ? "보내는 중…" : category ? "문의 보내기" : "문의 유형을 골라 주세요"}
      </button>
    </form>
  );
}
