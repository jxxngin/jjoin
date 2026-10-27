import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      transitionTypes={["nav-back"]}
      className="-ml-1 flex w-fit items-center gap-1 text-sm text-stone-500"
    >
      <span aria-hidden="true">‹</span>
      {label}
    </Link>
  );
}
