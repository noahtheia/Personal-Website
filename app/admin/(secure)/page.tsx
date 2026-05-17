import Link from "next/link";
import { listPostsAction } from "@/app/admin/actions";
import { NewPostForm } from "@/app/admin/NewPostForm";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  const posts = await listPostsAction();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="font-display text-xl font-semibold">Posts</h1>
        <p className="mt-1 text-xs text-muted">
          Saves write straight to <code>content/posts/*.mdx</code> — on the live site that&rsquo;s a
          GitHub commit on <code>main</code>; in <code>npm run dev</code> it&rsquo;s a local file write.
        </p>
        <ul className="mt-5 divide-y divide-rule border-y border-rule">
          {posts.length === 0 ? (
            <li className="py-6 text-sm text-muted">No posts yet. Create one →</li>
          ) : (
            posts.map((p) => (
              <li key={p.slug} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/posts/${p.slug}`}
                      className="truncate font-display text-base font-semibold !text-fg no-underline hover:!text-accent"
                    >
                      {p.title}
                    </Link>
                    {p.draft ? (
                      <span className="rounded-sm bg-[#fff8e1] px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-warm-hover)]">
                        Draft
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    <code>{p.slug}</code>
                    {p.date ? ` · ${p.date}` : ""}
                    {p.excerpt ? ` · ${p.excerpt}` : ""}
                  </div>
                </div>
                <Link
                  href={`/posts/${p.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 font-sans text-xs !text-muted no-underline hover:!text-accent"
                >
                  Preview ↗
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <aside>
        <h2 className="font-display text-base font-semibold">New post</h2>
        <p className="mt-1 text-xs text-muted">
          Creates an empty draft and opens the editor.
        </p>
        <div className="mt-4">
          <NewPostForm />
        </div>
      </aside>
    </div>
  );
}
