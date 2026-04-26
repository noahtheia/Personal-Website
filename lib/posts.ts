import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type Attachment = {
  name: string;
  path: string;
  description?: string;
};

export type PostFrontmatter = {
  title: string;
  date: string;
  excerpt: string;
  attachments?: Attachment[];
  draft?: boolean;
};

export type Post = {
  slug: string;
  content: string;
  frontmatter: PostFrontmatter;
  readingTimeMinutes: number;
};

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const WORDS_PER_MINUTE = 225;

export function getPostSlugs(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

export function getPostBySlug(slug: string): Post | null {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const frontmatter = data as PostFrontmatter;
  if (frontmatter.draft && process.env.NODE_ENV === "production") return null;
  return {
    slug,
    content,
    frontmatter,
    readingTimeMinutes: estimateReadingTime(content),
  };
}

export function getAllPosts(): Post[] {
  return getPostSlugs()
    .map((slug) => getPostBySlug(slug))
    .filter((p): p is Post => p !== null)
    .sort((a, b) =>
      a.frontmatter.date < b.frontmatter.date ? 1 : -1,
    );
}

export function getAdjacentPosts(slug: string): {
  older: Post | null;
  newer: Post | null;
} {
  const posts = getAllPosts(); // newest first
  const i = posts.findIndex((p) => p.slug === slug);
  if (i === -1) return { older: null, newer: null };
  return {
    older: posts[i + 1] ?? null,
    newer: posts[i - 1] ?? null,
  };
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function estimateReadingTime(content: string): number {
  // Strip MDX/markdown syntax tokens that aren't real words.
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_\-]/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
