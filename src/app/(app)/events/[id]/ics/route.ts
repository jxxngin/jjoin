import { icsFor } from "@/lib/calendar-export";
import { getEvent } from "@/lib/events";

// 약속을 캘린더 파일(.ics)로 내려받는다. 아이폰·맥 캘린더, 아웃룩에서 열린다.
// 그룹 멤버가 아니면 RLS 때문에 약속을 못 읽어 404다.
export async function GET(request: Request, { params }: RouteContext<"/events/[id]/ics">) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return new Response("Not found", { status: 404 });

  const url = new URL(`/events/${event.id}`, request.url).toString();
  const ics = icsFor(
    {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      placeName: event.placeName,
      address: event.place?.address ?? null,
      memo: event.memo,
    },
    url,
    new Date(),
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="jjoin-${event.id.slice(0, 8)}.ics"`,
    },
  });
}
