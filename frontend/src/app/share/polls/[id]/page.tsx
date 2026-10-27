import type { Metadata } from "next";
import { Suspense } from "react";
import { getPollPreview } from "@/lib/link-preview";
import { OG_IMAGE, SharePage } from "../../share-page";

// 날짜 투표 링크(/polls/id)를 카카오톡에 보냈을 때의 미리보기
export async function generateMetadata({ params }: PageProps<"/share/polls/[id]">): Promise<Metadata> {
  const { id } = await params;
  const poll = await getPollPreview(id);
  const title = poll ? `${poll.title} · ${poll.kindLabel}` : "jjoin 날짜 투표";
  const description = poll
    ? `${poll.group.emoji} ${poll.group.name} · 후보 ${poll.optionCount}개 중 되는 날을 골라 주세요`
    : "jjoin에서 날짜 투표에 참여해 보세요";

  return {
    title,
    description,
    openGraph: { title, description, url: `/polls/${id}`, type: "website", siteName: "jjoin", images: OG_IMAGE },
  };
}

export default function SharePollPage({ params }: PageProps<"/share/polls/[id]">) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <PollShare id={id} />
      ))}
    </Suspense>
  );
}

async function PollShare({ id }: { id: string }) {
  const poll = await getPollPreview(id);
  return (
    <SharePage
      title={poll ? poll.title : "jjoin 날짜 투표"}
      description={poll ? `${poll.kindLabel} · 후보 ${poll.optionCount}개` : "jjoin에서 날짜 투표에 참여해 보세요"}
      href={`/polls/${id}`}
    />
  );
}
