"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPostAction } from "./actions";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function NewPostForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveSlug = slugTouched ? slug : slugify(title);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createPostAction(effectiveSlug, title);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/admin/posts/${res.slug}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="font-sans text-[11px] uppercase tracking-wider text-muted">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A Bear Market in X Is Ending"
          required
          className="mt-1 w-full rounded-sm border border-rule bg-[var(--bg)] px-2 py-1.5 font-sans text-sm focus:border-[var(--accent-warm)] focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="font-sans text-[11px] uppercase tracking-wider text-muted">Slug (URL)</span>
        <input
          value={effectiveSlug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          placeholder="a-bear-market-in-x-is-ending"
          required
          className="mt-1 w-full rounded-sm border border-rule bg-[var(--bg)] px-2 py-1.5 font-mono text-sm focus:border-[var(--accent-warm)] focus:outline-none"
        />
        <span className="mt-1 block text-[11px] text-muted">
          Permanent once published — it&rsquo;s the URL and the email link target.
        </span>
      </label>
      {error ? (
        <p className="rounded-sm border border-[var(--negative)] bg-[#fdecea] px-2 py-1 text-xs text-[var(--negative)]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !title.trim() || !effectiveSlug}
        className="w-full rounded-sm border border-[var(--accent-warm)] bg-[var(--accent-warm)] px-3 py-1.5 font-sans text-sm font-semibold !text-fg transition-opacity disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}
