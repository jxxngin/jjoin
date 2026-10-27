"use client";

import { deleteEvent } from "../actions";

export function DeleteEventButton({ eventId, groupId }: { eventId: string; groupId: string }) {
  return (
    <form
      action={deleteEvent}
      onSubmit={(e) => {
        if (!confirm("이 약속을 삭제할까요?")) e.preventDefault();
      }}
      className="flex-1"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="groupId" value={groupId} />
      <button
        type="submit"
        className="h-12 w-full rounded-xl bg-red-50 font-medium text-red-600 dark:bg-red-950"
      >
        삭제
      </button>
    </form>
  );
}
