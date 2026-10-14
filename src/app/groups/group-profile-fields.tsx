"use client";

import { useState } from "react";
import { GroupAvatar } from "@/components/group-avatar";
import { GROUP_COLORS, GROUP_EMOJIS, type GroupColor } from "@/lib/group-style";

// 그룹 만들기·수정 화면에서 쓰는 이모지·색깔 고르기. 값은 숨은 input으로 보낸다.
export function GroupProfileFields({
  defaultEmoji,
  defaultColor,
}: {
  defaultEmoji: string;
  defaultColor: GroupColor;
}) {
  const [emoji, setEmoji] = useState(defaultEmoji);
  const [color, setColor] = useState<GroupColor>(defaultColor);

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="emoji" value={emoji} />
      <input type="hidden" name="color" value={color} />

      <div className="flex justify-center">
        <GroupAvatar emoji={emoji} color={color} size="lg" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">대표 이모지</span>
        <div className="grid grid-cols-6 gap-2">
          {GROUP_EMOJIS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setEmoji(value)}
              aria-label={`이모지 ${value}`}
              aria-pressed={emoji === value}
              className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition ${
                emoji === value ? "bg-brand/15 ring-2 ring-brand" : "bg-stone-100 dark:bg-stone-900"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">색깔</span>
        <div className="flex gap-3">
          {(Object.keys(GROUP_COLORS) as GroupColor[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setColor(value)}
              aria-label={GROUP_COLORS[value].label}
              aria-pressed={color === value}
              className={`size-8 rounded-full ${GROUP_COLORS[value].swatch} ${
                color === value ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
