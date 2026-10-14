import { BackLink } from "@/components/back-link";
import { CreateGroupForm } from "./create-group-form";

export default function NewGroupPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/" label="홈" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">그룹 만들기</h1>
        <p className="text-sm text-zinc-500">
          만든 사람이 방장이 되고, 초대 링크로 친구를 부를 수 있어요.
        </p>
      </div>
      <CreateGroupForm />
    </main>
  );
}
