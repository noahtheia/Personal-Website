import Link from "next/link";
import { formatDate, type Post } from "@/lib/posts";

export function PostCard({ post }: { post: Post }) {
  const attachmentCount = post.frontmatter.attachments?.length ?? 0;
  return (
    <article className="group border-b border-rule py-8 last:border-b-0">
      <p className="eyebrow">
        <time dateTime={post.frontmatter.date}>
          {formatDate(post.frontmatter.date)}
        </time>
        <span className="ml-3 text-muted">
          · {post.readingTimeMinutes} min read
        </span>
        {attachmentCount > 0 ? (
          <span className="ml-3 text-muted">
            · {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </p>
      <Link
        href={`/posts/${post.slug}`}
        className="!text-fg no-underline"
      >
        <h2 className="mt-2 font-display text-2xl font-semibold leading-snug transition-colors group-hover:!text-accent sm:text-[1.65rem]">
          {post.frontmatter.title}
        </h2>
      </Link>
      <p className="mt-3 text-[1.0625rem] leading-relaxed text-fg-soft">
        {post.frontmatter.excerpt}
      </p>
      <p className="mt-4">
        <Link
          href={`/posts/${post.slug}`}
          className="font-sans text-sm font-medium !text-accent no-underline hover:underline"
        >
          Read →
        </Link>
      </p>
    </article>
  );
}
