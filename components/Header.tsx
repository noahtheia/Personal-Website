import Link from "next/link";
import { site } from "@/lib/site";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-rule pb-5">
      <Link
        href="/"
        className="group inline-flex items-baseline gap-2 !text-fg no-underline"
      >
        <span className="font-display text-lg font-semibold tracking-tight group-hover:!text-accent">
          {site.name}
        </span>
        <span className="font-sans text-[0.7rem] uppercase tracking-[0.16em] text-muted">
          {site.tagline}
        </span>
      </Link>
      <nav className="flex gap-6 font-sans text-sm">
        <NavLink href="/posts">Writing</NavLink>
        <NavLink href="/about">About</NavLink>
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="!text-fg no-underline transition-colors hover:!text-accent"
    >
      {children}
    </Link>
  );
}
