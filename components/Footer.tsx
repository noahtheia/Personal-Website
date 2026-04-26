import Link from "next/link";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-rule pt-6 font-sans text-sm text-muted">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.author}.
        </p>
        <div className="flex items-center gap-4 text-xs">
          <Link
            href="/disclosures"
            className="!text-muted no-underline hover:!text-accent hover:underline"
          >
            Disclosures
          </Link>
          <a
            href="/feed.xml"
            className="!text-muted no-underline hover:!text-accent hover:underline"
          >
            RSS
          </a>
        </div>
      </div>
    </footer>
  );
}
