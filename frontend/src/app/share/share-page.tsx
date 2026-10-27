import Image from "next/image";
import Link from "next/link";

// 링크 미리보기 이미지 (로고 + 글자 로고, 1200×630)
export const OG_IMAGE = [{ url: "/og.png", width: 1200, height: 630, alt: "jjoin" }];

// 링크 미리보기 크롤러에게만 보여 주는 화면. 사람은 프록시가 원래 주소로 보내서 볼 일이 거의 없다.

export function SharePage({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Image src="/logo-512.png" alt="" width={72} height={72} className="rounded-2xl" />
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-stone-500">{description}</p>
      <Link href={href} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white">
        jjoin에서 열기
      </Link>
    </main>
  );
}
