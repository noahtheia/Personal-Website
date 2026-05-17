"use client";

// Client-side MDX renderer for the admin editor's preview pane. The post page
// in production reads the file from disk and uses MDXRemote server-side; that
// path doesn't help us here because in deployed mode a save goes through a
// GitHub commit + Vercel rebuild, so the disk wouldn't update for ~30–60s.
// Compiling on the client means the preview is instant and stays in sync with
// the textarea — at the cost of pulling @mdx-js/mdx into the admin bundle.

import { useEffect, useState } from "react";
import { evaluate, type EvaluateOptions } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { mdxComponents } from "@/mdx/components";

type Props = {
  source: string;
  title: string;
  draft: boolean;
  date: string;
  excerpt: string;
};

export function MdxPreview({ source, title, draft, date, excerpt }: Props) {
  const [Content, setContent] = useState<React.ComponentType<{
    components?: Record<string, React.ComponentType>;
  }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debounced, setDebounced] = useState(source);

  // Debounce compile so we're not running it on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(source), 400);
    return () => clearTimeout(t);
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await evaluate(debounced, runtime as unknown as EvaluateOptions);
        if (cancelled) return;
        setContent(() => mod.default as React.ComponentType<{
          components?: Record<string, React.ComponentType>;
        }>);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-rule bg-[var(--bg-elevated)]">
      <article className="mx-auto max-w-prose px-6 py-8">
        {draft ? (
          <div className="mb-6 rounded-sm border border-[var(--accent-warm)] bg-[#fff8e1] px-3 py-2 font-sans text-[11px]">
            <strong className="text-[var(--accent-warm-hover)]">Draft preview</strong>
            <span className="ml-2 text-fg-soft">Hidden in production until <code>draft: false</code>.</span>
          </div>
        ) : null}
        <header className="border-b border-rule pb-6">
          <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-muted">
            {date || "—"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight">
            {title || "(untitled)"}
          </h1>
          {excerpt ? (
            <p className="mt-3 font-sans text-base leading-relaxed text-fg-soft">{excerpt}</p>
          ) : null}
        </header>
        <div className="prose prose-neutral mt-8 max-w-none">
          {error ? (
            <pre className="not-prose rounded-sm border border-[var(--negative)] bg-[#fdecea] p-3 font-mono text-[11px] leading-snug text-[var(--negative)] whitespace-pre-wrap">
              {error}
            </pre>
          ) : Content ? (
            <Content
              components={
                mdxComponents as unknown as Record<string, React.ComponentType>
              }
            />
          ) : (
            <p className="text-sm text-muted">Compiling…</p>
          )}
        </div>
      </article>
    </div>
  );
}
