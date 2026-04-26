import { getAllPosts } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { SubscribeForm } from "@/components/SubscribeForm";

export default function HomePage() {
  const posts = getAllPosts().slice(0, 5);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="font-sans text-3xl font-semibold">Hi, I&apos;m Noah.</h1>
        <p className="mt-3 leading-relaxed text-[var(--muted)]">
          I write about investment ideas I&apos;m looking at — companies, situations, and
          frameworks. Posts often come with the spreadsheet I built while thinking through them.
        </p>
        <div className="mt-6">
          <SubscribeForm />
        </div>
      </section>

      <section>
        <h2 className="font-sans text-lg font-semibold">Recent posts</h2>
        <div className="mt-2">
          {posts.length === 0 ? (
            <p className="text-[var(--muted)]">No posts yet — first one coming soon.</p>
          ) : (
            posts.map((post) => <PostCard key={post.slug} post={post} />)
          )}
        </div>
      </section>
    </div>
  );
}
