import Link from "next/link";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] pb-6">
      <Link href="/" className="font-sans text-lg font-semibold !text-[var(--fg)] no-underline">
        Noah&apos;s Notes
      </Link>
      <nav className="flex gap-5 font-sans text-sm">
        <Link href="/posts" className="!text-[var(--fg)] no-underline hover:!text-[var(--accent)]">
          Posts
        </Link>
        <Link href="/about" className="!text-[var(--fg)] no-underline hover:!text-[var(--accent)]">
          About
        </Link>
      </nav>
    </header>
  );
}
