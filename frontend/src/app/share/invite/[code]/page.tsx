import type { Metadata } from "next";
import { Suspense } from "react";
import { getInvitePreview } from "@/lib/link-preview";
import { OG_IMAGE, SharePage } from "../../share-page";

// 초대 링크(/invite/코드)를 카카오톡에 보냈을 때의 미리보기
export async function generateMetadata({ params }: PageProps<"/share/invite/[code]">): Promise<Metadata> {
  const { code } = await params;
  const group = await getInvitePreview(code);
  const title = group ? `${group.emoji} ${group.name}에 초대받았어요` : "jjoin 초대";
  const description = group?.description
    ? `${group.description} · jjoin에서 함께 약속을 잡아요`
    : "jjoin에서 함께 약속을 잡고, 누가 오는지 한눈에 봐요";

  return {
    title,
    description,
    openGraph: { title, description, url: `/invite/${code}`, type: "website", siteName: "jjoin", images: OG_IMAGE },
  };
}

export default function ShareInvitePage({ params }: PageProps<"/share/invite/[code]">) {
  return (
    <Suspense>
      {params.then(({ code }) => (
        <InviteShare code={code} />
      ))}
    </Suspense>
  );
}

async function InviteShare({ code }: { code: string }) {
  const group = await getInvitePreview(code);
  return (
    <SharePage
      title={group ? `${group.emoji} ${group.name}에 초대받았어요` : "jjoin 초대"}
      description="jjoin에서 함께 약속을 잡아요"
      href={`/invite/${code}`}
    />
  );
}
