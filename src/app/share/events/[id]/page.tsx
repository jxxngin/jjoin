import type { Metadata } from "next";
import { Suspense } from "react";
import { getEventPreview } from "@/lib/link-preview";
import { OG_IMAGE, SharePage } from "../../share-page";

// 약속 링크(/events/id)를 카카오톡에 보냈을 때의 미리보기
export async function generateMetadata({ params }: PageProps<"/share/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventPreview(id);
  const title = event ? `${event.title} · ${event.when}` : "jjoin 약속";
  const description = event
    ? [`${event.group.emoji} ${event.group.name}의 약속`, event.place].filter(Boolean).join(" · ")
    : "jjoin에서 약속을 확인해 보세요";

  return {
    title,
    description,
    openGraph: { title, description, url: `/events/${id}`, type: "website", siteName: "jjoin", images: OG_IMAGE },
  };
}

export default function ShareEventPage({ params }: PageProps<"/share/events/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <EventShare id={id} />
      ))}
    </Suspense>
  );
}

async function EventShare({ id }: { id: string }) {
  const event = await getEventPreview(id);
  return (
    <SharePage
      title={event ? event.title : "jjoin 약속"}
      description={event ? event.when : "jjoin에서 약속을 확인해 보세요"}
      href={`/events/${id}`}
    />
  );
}
