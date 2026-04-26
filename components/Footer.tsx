import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-rule pt-6 font-sans text-sm text-muted">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.copyrightHolder}.
        </p>
        <p className="text-xs">
          For discussion only. Nothing here is investment advice.
        </p>
      </div>
    </footer>
  );
}
