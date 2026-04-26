import { getAllPosts } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";

export const metadata = { title: "Posts" };

export default function PostsPage() {
  const posts = getAllPosts();
  return (
    <div>
      <h1 className="font-sans text-3xl font-semibold">All posts</h1>
      <div className="mt-6">
        {posts.length === 0 ? (
          <p className="text-[var(--muted)]">No posts yet.</p>
        ) : (
          posts.map((post) => <PostCard key={post.slug} post={post} />)
        )}
      </div>
    </div>
  );
}
