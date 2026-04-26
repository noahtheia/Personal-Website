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
};

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

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
  return { slug, content, frontmatter };
}

export function getAllPosts(): Post[] {
  return getPostSlugs()
    .map((slug) => getPostBySlug(slug))
    .filter((p): p is Post => p !== null)
    .sort((a, b) =>
      a.frontmatter.date < b.frontmatter.date ? 1 : -1,
    );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
