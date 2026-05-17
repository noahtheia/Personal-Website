"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
      <nav className="flex items-center gap-6 font-sans text-sm">
        <NavLink href="/posts">Writing</NavLink>
        <NavLink href="/targets">Targets</NavLink>
        <NavLink href="/analytics">Analytics</NavLink>
        {process.env.NODE_ENV === "development" ? (
          <NavLink href="/admin">Admin</NavLink>
        ) : null}
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`no-underline transition-colors hover:!text-accent ${
        active ? "!text-accent" : "!text-fg"
      }`}
    >
      {children}
    </Link>
  );
}
