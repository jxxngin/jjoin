import { eventPeriodParts } from "@/lib/datetime";

// 약속 날짜. 여러 날 약속이면 날짜 옆에 "2박 3일"을 작은 배지로 붙인다.
// withTime: false면 시간 없이 날짜만 (기간 투표 후보)
export function Period({
  startsAt,
  endsAt,
  withTime = true,
}: {
  startsAt: string;
  endsAt: string | null;
  withTime?: boolean;
}) {
  const { dates, nights } = eventPeriodParts(startsAt, endsAt, withTime);
  return (
    <>
      {dates}
      {nights && (
        <span className="ml-1.5 inline-block rounded-full bg-sky-100 px-1.5 py-px align-[0.1em] text-[0.7em] font-semibold whitespace-nowrap text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          {nights}
        </span>
      )}
    </>
  );
}
