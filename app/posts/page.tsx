import { getAllPosts } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";

export const metadata = { title: "Writing" };

export default function PostsPage() {
  const posts = getAllPosts();
  return (
    <div className="page-narrow">
      <p className="eyebrow">Writing</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        All posts
      </h1>
      <div className="mt-10">
        {posts.length === 0 ? (
          <p className="text-muted">No posts yet.</p>
        ) : (
          posts.map((post) => <PostCard key={post.slug} post={post} />)
        )}
      </div>
    </div>
  );
}
