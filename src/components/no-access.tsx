import Link from "next/link";

// 그룹 멤버가 아닌 사람이 그룹·약속 주소로 바로 들어왔을 때 보여 준다.
// 멤버가 아닌지, 없는 주소인지는 RLS 때문에 구분할 수 없다.
export function NoAccess({ what }: { what: "그룹" | "약속" }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">{what}을 볼 수 없어요</h1>
      <p className="text-sm text-stone-500">
        아직 그룹 멤버가 아니라면, 친구에게 <b>초대 링크</b>를 받아 먼저 참여해 주세요.
        <br />
        삭제된 {what}일 수도 있어요.
      </p>
      <Link href="/" className="text-sm text-brand-ink underline underline-offset-4">
        홈으로
      </Link>
    </main>
  );
}
