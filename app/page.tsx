import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { SubscribeForm } from "@/components/SubscribeForm";
import { site } from "@/lib/site";

export default function HomePage() {
  const posts = getAllPosts();
  const recent = posts.slice(0, 5);

  return (
    <div className="page-narrow space-y-20">
      <section>
        <p className="eyebrow">Welcome</p>
        <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.5rem]">
          {site.description}
        </h1>
        <p className="mt-6 max-w-[34rem] font-sans text-lg leading-relaxed text-fg-soft">
          Single names I&apos;m researching, the macro context they live in, and
          the spreadsheets I built while thinking through them.
        </p>

        <div className="mt-10 max-w-md">
          <p className="eyebrow mb-3">Subscribe</p>
          <SubscribeForm />
          <p className="mt-3 font-sans text-xs text-muted">
            One email per new post. No other emails, ever.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-rule pb-3">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Latest writing
          </h2>
          {posts.length > recent.length ? (
            <Link
              href="/posts"
              className="font-sans text-sm !text-accent no-underline hover:underline"
            >
              All posts →
            </Link>
          ) : null}
        </div>
        <div>
          {recent.length === 0 ? (
            <p className="py-8 text-muted">No posts yet — first one coming soon.</p>
          ) : (
            recent.map((post) => <PostCard key={post.slug} post={post} />)
          )}
        </div>
      </section>
    </div>
  );
}
