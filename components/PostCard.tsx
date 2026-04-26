import Link from "next/link";
import { formatDate, type Post } from "@/lib/posts";

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="border-b border-[var(--border)] py-6 last:border-b-0">
      <Link href={`/posts/${post.slug}`} className="!text-[var(--fg)] no-underline">
        <h2 className="font-sans text-xl font-semibold hover:!text-[var(--accent)]">
          {post.frontmatter.title}
        </h2>
      </Link>
      <p className="mt-1 font-sans text-sm text-[var(--muted)]">
        {formatDate(post.frontmatter.date)}
        {post.frontmatter.attachments?.length ? (
          <> · {post.frontmatter.attachments.length} attachment{post.frontmatter.attachments.length === 1 ? "" : "s"}</>
        ) : null}
      </p>
      <p className="mt-3 leading-relaxed">{post.frontmatter.excerpt}</p>
    </article>
  );
}
