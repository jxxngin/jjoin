"use client";

import { startTransition, useActionState, useState } from "react";
import { Avatar } from "@/components/avatar";
import type { Profile } from "@/lib/auth";
import { updateProfile } from "./actions";

const AVATAR_SIZE = 256;

// 사진을 가운데 기준 정사각형으로 잘라 256px JPEG로 줄인다. (서버 액션 1MB 제한)
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  canvas
    .getContext("2d")!
    .drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("사진을 처리하지 못했어요."))),
      "image/jpeg",
      0.85,
    ),
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateProfile, {});
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatar, setAvatar] = useState<{ blob: Blob; preview: string } | "remove" | null>(null);
  const [photoError, setPhotoError] = useState<string>();

  const preview =
    avatar === "remove" ? null : avatar ? avatar.preview : profile.avatarUrl;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPhotoError(undefined);
    try {
      const blob = await resizeImage(file);
      setAvatar({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setPhotoError("이 사진은 사용할 수 없어요. 다른 사진을 골라 주세요.");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("nickname", nickname);
    if (avatar === "remove") {
      formData.set("avatarMode", "remove");
    } else if (avatar) {
      formData.set("avatarMode", "upload");
      formData.set("avatar", avatar.blob, "avatar.jpg");
    } else {
      formData.set("avatarMode", "keep");
    }
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        <Avatar src={preview} size="lg" />
        <div className="flex gap-2 text-sm">
          <label className="cursor-pointer rounded-full bg-zinc-100 px-3 py-1.5 font-medium dark:bg-zinc-900">
            사진 변경
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          {preview && (
            <button
              type="button"
              onClick={() => setAvatar("remove")}
              className="rounded-full px-3 py-1.5 text-zinc-500"
            >
              기본 이미지로
            </button>
          )}
        </div>
        {photoError && <p className="text-sm text-red-600">{photoError}</p>}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">닉네임</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          maxLength={20}
          className="h-12 rounded-xl border border-zinc-300 bg-transparent px-4 outline-none focus:border-brand dark:border-zinc-700"
        />
        {profile.kakaoName && (
          <span className="text-xs text-zinc-500">
            카카오 이름: <b>{profile.kakaoName}</b> · 닉네임과 다르면 친구들에게 함께 보여요.
          </span>
        )}
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !pending && <p className="text-sm text-emerald-600">저장했어요.</p>}

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
