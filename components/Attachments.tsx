import type { Attachment } from "@/lib/posts";

export function Attachments({ items }: { items: Attachment[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-10 rounded border border-[var(--border)] bg-white p-5">
      <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Attachments
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((a) => (
          <li key={a.path}>
            <a href={a.path} download className="font-sans">
              {a.name}
            </a>
            {a.description ? (
              <span className="ml-2 font-sans text-sm text-[var(--muted)]">— {a.description}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
