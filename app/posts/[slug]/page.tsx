import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { formatDate, getPostBySlug, getPostSlugs } from "@/lib/posts";
import { Attachments } from "@/components/Attachments";
import { SubscribeForm } from "@/components/SubscribeForm";

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

  return (
    <article>
      <header className="border-b border-rule pb-8">
        <p className="eyebrow">
          <time dateTime={post.frontmatter.date}>
            {formatDate(post.frontmatter.date)}
          </time>
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
