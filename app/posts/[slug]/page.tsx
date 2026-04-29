import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  formatDate,
  getAdjacentPosts,
  getPostBySlug,
  getPostSlugs,
  type Post,
} from "@/lib/posts";
import { Attachments } from "@/components/Attachments";
import { SubscribeForm } from "@/components/SubscribeForm";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.frontmatter.title,
    description: post.frontmatter.excerpt,
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.excerpt,
      type: "article",
      publishedTime: post.frontmatter.date,
    },
  };
}

export default async function PostPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { older, newer } = getAdjacentPosts(slug);
  const url = `${site.url}/posts/${post.slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.frontmatter.title,
    description: post.frontmatter.excerpt,
    datePublished: post.frontmatter.date,
    dateModified: post.frontmatter.date,
    author: { "@type": "Person", name: site.author, url: site.url },
    publisher: { "@type": "Person", name: site.author },
    url,
    mainEntityOfPage: url,
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {post.frontmatter.draft ? (
        <div className="mb-8 rounded border border-[var(--accent-warm)] bg-[#fff8e1] px-4 py-3 font-sans text-sm">
          <strong className="text-[var(--accent-warm-hover)]">
            Draft preview
          </strong>
          <span className="ml-2 text-fg-soft">
            This post is not published yet. It&apos;s only visible on preview
            deployments and in local dev. Set{" "}
            <code className="rounded bg-white px-1 py-0.5 text-xs">
              draft: false
            </code>{" "}
            (or remove the line) to publish.
          </span>
        </div>
      ) : null}

      <header className="border-b border-rule pb-8">
        <p className="eyebrow">
          <time dateTime={post.frontmatter.date}>
            {formatDate(post.frontmatter.date)}
          </time>
          <span className="ml-3 text-muted">
            · {post.readingTimeMinutes} min read
          </span>
        </p>
        <h1 className="mt-3 font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.75rem]">
          {post.frontmatter.title}
        </h1>
        {post.frontmatter.excerpt ? (
          <p className="mt-4 font-sans text-lg leading-relaxed text-fg-soft">
            {post.frontmatter.excerpt}
          </p>
        ) : null}
      </header>

      <div className="prose prose-neutral mt-10 max-w-none">
        <MDXRemote source={post.content} />
      </div>

      {post.frontmatter.attachments?.length ? (
        <Attachments items={post.frontmatter.attachments} />
      ) : null}

      {older || newer ? (
        <nav className="mt-16 border-t border-rule pt-8">
          <p className="eyebrow">More writing</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AdjacentLink direction="older" post={older} />
            <AdjacentLink direction="newer" post={newer} />
          </div>
        </nav>
      ) : null}

      <section className="mt-16 border-t border-rule pt-10">
        <p className="eyebrow">Subscribe</p>
        <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">
          Get the next post by email
        </h3>
        <p className="mt-2 font-sans text-sm text-muted">
          One email per new post. Unsubscribe anytime.
        </p>
        <div className="mt-5 max-w-md">
          <SubscribeForm />
        </div>
        <p className="mt-8 font-sans text-sm">
          <Link href="/posts" className="!text-accent no-underline hover:underline">
            ← All posts
          </Link>
        </p>
      </section>
    </article>
  );
}

function AdjacentLink({
  direction,
  post,
}: {
  direction: "older" | "newer";
  post: Post | null;
}) {
  const label = direction === "older" ? "Older" : "Newer";
  const arrow = direction === "older" ? "←" : "→";
  const align = direction === "older" ? "text-left" : "sm:text-right";

  if (!post) {
    return <div aria-hidden className={`hidden sm:block ${align}`} />;
  }

  return (
    <Link
      href={`/posts/${post.slug}`}
      className={`group block !text-fg no-underline ${align}`}
    >
      <p className="font-sans text-xs uppercase tracking-[0.16em] text-muted">
        {direction === "older" ? `${arrow} ${label}` : `${label} ${arrow}`}
      </p>
      <p className="mt-1 font-display text-[1.05rem] font-semibold leading-snug transition-colors group-hover:!text-accent">
        {post.frontmatter.title}
      </p>
    </Link>
  );
}
