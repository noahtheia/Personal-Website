import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
      <header className="border-b border-[var(--border)] pb-6">
        <h1 className="font-sans text-3xl font-semibold leading-tight">
          {post.frontmatter.title}
        </h1>
        <p className="mt-2 font-sans text-sm text-[var(--muted)]">
          {formatDate(post.frontmatter.date)}
        </p>
      </header>

      <div className="prose prose-neutral mt-8 max-w-none prose-headings:font-sans prose-headings:font-semibold prose-a:text-[var(--accent)]">
        <MDXRemote source={post.content} />
      </div>

      {post.frontmatter.attachments?.length ? (
        <Attachments items={post.frontmatter.attachments} />
      ) : null}

      <div className="mt-12 border-t border-[var(--border)] pt-8">
        <h3 className="font-sans text-base font-semibold">Get the next post by email</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          One email when I publish. No spam, unsubscribe anytime.
        </p>
        <div className="mt-3">
          <SubscribeForm />
        </div>
      </div>
    </article>
  );
}
