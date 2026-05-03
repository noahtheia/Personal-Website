"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";

const analyticsTabs = [
  { href: "/analytics/public-farmland", label: "Public Farmland" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onAnalytics = pathname?.startsWith("/analytics") ?? false;

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
        <div ref={wrapRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className={`inline-flex items-center gap-1 no-underline transition-colors hover:!text-accent ${
              onAnalytics ? "!text-accent" : "!text-fg"
            }`}
          >
            Analytics
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              aria-hidden="true"
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path
                d="M2 4l3 3 3-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-2 min-w-[12rem] rounded-sm border border-rule bg-surface py-1 shadow-sm"
            >
              {analyticsTabs.map((t) => {
                const active = pathname === t.href;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    role="menuitem"
                    className={`block px-3 py-2 text-sm no-underline transition-colors hover:bg-bg ${
                      active ? "!text-accent" : "!text-fg"
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
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
