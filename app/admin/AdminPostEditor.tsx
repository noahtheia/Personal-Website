"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { savePostAction, type AdminPostFile, type SaveResult } from "./actions";
import type { PostFrontmatter } from "@/lib/posts";
import { mdxComponentMeta } from "@/mdx/manifest";

type Props = { initial: AdminPostFile };

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const AUTOSAVE_MS = 1500;

export function AdminPostEditor({ initial }: Props) {
  const [frontmatter, setFrontmatter] = useState<PostFrontmatter>(initial.frontmatter);
  const [body, setBody] = useState(initial.body);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pendingCursor, setPendingCursor] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const savedSnapshot = useRef({ frontmatter: initial.frontmatter, body: initial.body });
  const inFlight = useRef(false);

  const dirty = useMemo(() => {
    const s = savedSnapshot.current;
    return (
      JSON.stringify(s.frontmatter) !== JSON.stringify(frontmatter) ||
      s.body !== body
    );
  }, [frontmatter, body]);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus({ kind: "saving" });
    let res: SaveResult;
    try {
      res = await savePostAction(initial.slug, frontmatter, body);
    } catch (err) {
      inFlight.current = false;
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Save failed" });
      return;
    }
    inFlight.current = false;
    if (!res.ok) {
      setStatus({ kind: "error", message: res.error });
      return;
    }
    savedSnapshot.current = { frontmatter, body };
    setStatus({ kind: "saved", at: Date.now() });
    reloadPreview();
  }, [initial.slug, frontmatter, body]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, save]);

  // Cmd/Ctrl-S to save immediately
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  // Restore cursor after programmatic body edits (chart inserts / tab)
  useLayoutEffect(() => {
    if (pendingCursor === null) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(pendingCursor, pendingCursor);
    setPendingCursor(null);
  }, [pendingCursor]);

  function reloadPreview() {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    let scrollY = 0;
    try { scrollY = iframe.contentWindow.scrollY; } catch { /* cross-origin in error states */ }
    const onLoad = () => {
      try { iframe.contentWindow?.scrollTo(0, scrollY); } catch { /* noop */ }
      iframe.removeEventListener("load", onLoad);
    };
    iframe.addEventListener("load", onLoad);
    iframe.contentWindow.location.reload();
  }

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sep = needsLeadingNewlines(body, start);
    const insertion = `${sep}${text}\n`;
    const next = body.slice(0, start) + insertion + body.slice(end);
    setBody(next);
    setPendingCursor(start + insertion.length);
  }

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const s = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = body.slice(0, s) + "  " + body.slice(end);
      setBody(next);
      setPendingCursor(s + 2);
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, typeof mdxComponentMeta>();
    for (const m of mdxComponentMeta) {
      const k = m.group ?? "Other";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-3">
      <FrontmatterRow
        frontmatter={frontmatter}
        onChange={setFrontmatter}
        slug={initial.slug}
        status={status}
        dirty={dirty}
        onSave={save}
      />
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
        <Palette groups={groups} onInsert={insertAtCursor} />
        <div className="flex min-h-0 flex-col">
          <div className="mb-1 font-sans text-[11px] uppercase tracking-wider text-muted">
            Source (MDX)
          </div>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            spellCheck
            className="min-h-0 flex-1 w-full resize-none rounded-sm border border-rule bg-[var(--bg)] p-3 font-mono text-[13px] leading-relaxed text-fg focus:border-[var(--accent-warm)] focus:outline-none"
          />
        </div>
        <div className="hidden min-h-0 flex-col lg:flex">
          <div className="mb-1 flex items-center justify-between font-sans text-[11px] uppercase tracking-wider text-muted">
            <span>Preview</span>
            <a
              href={`/posts/${initial.slug}`}
              target="_blank"
              rel="noreferrer"
              className="!text-muted no-underline hover:!text-accent"
            >
              Open ↗
            </a>
          </div>
          <iframe
            ref={iframeRef}
            src={`/posts/${initial.slug}`}
            title="Post preview"
            className="min-h-0 flex-1 w-full rounded-sm border border-rule bg-[var(--bg-elevated)]"
          />
        </div>
      </div>
    </div>
  );
}

function needsLeadingNewlines(body: string, pos: number): string {
  if (pos === 0) return "";
  const before = body.slice(0, pos);
  if (before.endsWith("\n\n")) return "";
  if (before.endsWith("\n")) return "\n";
  return "\n\n";
}

function FrontmatterRow({
  frontmatter,
  onChange,
  slug,
  status,
  dirty,
  onSave,
}: {
  frontmatter: PostFrontmatter;
  onChange: (fm: PostFrontmatter) => void;
  slug: string;
  status: Status;
  dirty: boolean;
  onSave: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-sm border border-rule bg-surface p-3 lg:grid-cols-[1fr_140px_2fr_auto_auto]">
      <input
        value={frontmatter.title ?? ""}
        onChange={(e) => onChange({ ...frontmatter, title: e.target.value })}
        placeholder="Title"
        className="rounded-sm border border-rule bg-[var(--bg)] px-2 py-1.5 font-display text-base font-semibold focus:border-[var(--accent-warm)] focus:outline-none"
      />
      <input
        value={frontmatter.date ?? ""}
        onChange={(e) => onChange({ ...frontmatter, date: e.target.value })}
        placeholder="YYYY-MM-DD"
        className="rounded-sm border border-rule bg-[var(--bg)] px-2 py-1.5 font-mono text-sm focus:border-[var(--accent-warm)] focus:outline-none"
      />
      <input
        value={frontmatter.excerpt ?? ""}
        onChange={(e) => onChange({ ...frontmatter, excerpt: e.target.value })}
        placeholder="One-line excerpt (meta description + newsletter body)"
        className="rounded-sm border border-rule bg-[var(--bg)] px-2 py-1.5 font-sans text-sm focus:border-[var(--accent-warm)] focus:outline-none"
      />
      <label className="flex items-center gap-2 px-2 font-sans text-xs text-fg-soft">
        <input
          type="checkbox"
          checked={frontmatter.draft === true}
          onChange={(e) => onChange({ ...frontmatter, draft: e.target.checked || undefined })}
        />
        Draft
      </label>
      <div className="flex items-center gap-2">
        <StatusLabel status={status} dirty={dirty} />
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || status.kind === "saving"}
          className="rounded-sm border border-[var(--accent-warm)] bg-[var(--accent-warm)] px-3 py-1.5 font-sans text-xs font-semibold !text-fg transition-opacity disabled:opacity-40"
          title="Save (⌘/Ctrl-S)"
        >
          Save
        </button>
      </div>
      <div className="col-span-full font-sans text-[11px] text-muted">
        <code>content/posts/{slug}.mdx</code> · drafts visible on preview deployments and{" "}
        <code>npm run dev</code>; production hides them.
      </div>
    </div>
  );
}

function StatusLabel({ status, dirty }: { status: Status; dirty: boolean }) {
  if (status.kind === "saving") return <span className="text-xs text-muted">Saving…</span>;
  if (status.kind === "error")
    return <span className="text-xs text-[var(--negative)]" title={status.message}>Error</span>;
  if (dirty) return <span className="text-xs text-muted">Unsaved</span>;
  if (status.kind === "saved")
    return <RelativeTime ts={status.at} />;
  return <span className="text-xs text-muted">Saved</span>;
}

function RelativeTime({ ts }: { ts: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  const label = s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
  return <span className="text-xs text-muted">Saved {label}</span>;
}

function Palette({
  groups,
  onInsert,
}: {
  groups: [string, typeof mdxComponentMeta][];
  onInsert: (text: string) => void;
}) {
  return (
    <aside className="min-h-0 overflow-y-auto rounded-sm border border-rule bg-surface p-3">
      <div className="font-sans text-[11px] uppercase tracking-wider text-muted">
        Chart palette
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted">
        Click to insert the tag at the cursor. New charts live in{" "}
        <code>components/charts/</code>.
      </p>
      <div className="mt-3 space-y-4">
        {groups.map(([group, items]) => (
          <div key={group}>
            <div className="font-sans text-[10px] font-semibold uppercase tracking-wider text-fg-soft">
              {group}
            </div>
            <ul className="mt-1 space-y-1">
              {items.map((m) => (
                <li key={m.name}>
                  <button
                    type="button"
                    onClick={() => onInsert(m.insert)}
                    className="w-full rounded-sm border border-rule bg-[var(--bg)] px-2 py-1.5 text-left font-sans text-xs transition-colors hover:border-[var(--accent-warm)]"
                    title={m.blurb}
                  >
                    <div className="font-semibold text-fg">{m.label}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-muted">{m.blurb}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
