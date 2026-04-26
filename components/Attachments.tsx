import type { Attachment } from "@/lib/posts";

export function Attachments({ items }: { items: Attachment[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-12 rounded border border-rule bg-surface p-6">
      <p className="eyebrow">Attachments</p>
      <ul className="mt-4 space-y-3">
        {items.map((a) => (
          <li key={a.path} className="flex items-baseline gap-3">
            <span aria-hidden className="font-sans text-xs text-muted">▸</span>
            <div>
              <a
                href={a.path}
                download
                className="font-sans text-[0.95rem] font-medium !text-fg no-underline underline-offset-4 hover:!text-accent hover:underline"
              >
                {a.name}
              </a>
              {a.description ? (
                <p className="mt-0.5 font-sans text-sm text-muted">
                  {a.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
