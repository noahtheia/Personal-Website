import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { SubscribeForm } from "@/components/SubscribeForm";
import { site } from "@/lib/site";

export default function HomePage() {
  const posts = getAllPosts();
  const recent = posts.slice(0, 5);

  return (
    <div className="space-y-20">
      <section>
        <p className="eyebrow">{site.tagline}</p>
        <h1 className="mt-3 font-display text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-[3.25rem]">
          {site.name}
        </h1>
        <p className="mt-6 max-w-[36rem] font-sans text-lg leading-relaxed text-fg-soft">
          {site.description}
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
