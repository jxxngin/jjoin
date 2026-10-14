import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 flex w-fit items-center gap-1 text-sm text-zinc-500"
    >
      <span aria-hidden="true">‹</span>
      {label}
    </Link>
  );
}
