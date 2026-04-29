import Link from "next/link";
import { site } from "@/lib/site";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-rule pb-5">
      <Link
        href="/"
        className="font-display text-lg font-semibold tracking-tight !text-fg no-underline transition-colors hover:!text-accent"
      >
        {site.brand}
      </Link>
      <nav className="flex gap-6 font-sans text-sm">
        <NavLink href="/posts">Writing</NavLink>
        <NavLink href="/targets">Targets</NavLink>
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
