"use server";

// Server actions for the local-dev admin portal. Writes go straight to
// content/posts/*.mdx; you commit via git as today. Everything in this file is
// gated by NODE_ENV === "development" — on production builds the actions throw
// and the /admin routes are 404'd by app/admin/layout.tsx.

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";
import type { PostFrontmatter } from "@/lib/posts";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function ensureDev() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Admin is disabled outside `npm run dev`.");
  }
}

function pathFor(slug: string) {
  if (!SLUG_RE.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  return path.join(POSTS_DIR, `${slug}.mdx`);
}

export type AdminPostSummary = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  draft: boolean;
  updatedAt: string;
};

export async function listPostsAction(): Promise<AdminPostSummary[]> {
  ensureDev();
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".mdx"));
  const out: AdminPostSummary[] = [];
  for (const f of files) {
    const slug = f.replace(/\.mdx$/, "");
    const full = path.join(POSTS_DIR, f);
    const stat = fs.statSync(full);
    const { data } = matter(fs.readFileSync(full, "utf8"));
    const fm = data as Partial<PostFrontmatter>;
    out.push({
      slug,
      title: fm.title ?? slug,
      date: fm.date ?? "",
      excerpt: fm.excerpt ?? "",
      draft: fm.draft === true,
      updatedAt: stat.mtime.toISOString(),
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export type AdminPostFile = {
  slug: string;
  frontmatter: PostFrontmatter;
  body: string;
  updatedAt: string;
};

export async function loadPostAction(slug: string): Promise<AdminPostFile | null> {
  ensureDev();
  const file = pathFor(slug);
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  return {
    slug,
    frontmatter: data as PostFrontmatter,
    body: content.replace(/^\n+/, ""),
    updatedAt: stat.mtime.toISOString(),
  };
}

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; error: string };

export async function savePostAction(
  slug: string,
  frontmatter: PostFrontmatter,
  body: string,
): Promise<SaveResult> {
  ensureDev();
  if (!frontmatter.title?.trim()) return { ok: false, error: "Title is required." };
  if (!frontmatter.date?.trim()) return { ok: false, error: "Date is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.date)) {
    return { ok: false, error: "Date must be YYYY-MM-DD." };
  }
  const file = pathFor(slug);
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  const clean: PostFrontmatter = {
    title: frontmatter.title.trim(),
    date: frontmatter.date,
    excerpt: frontmatter.excerpt?.trim() ?? "",
    ...(frontmatter.draft ? { draft: true } : {}),
    ...(frontmatter.attachments?.length ? { attachments: frontmatter.attachments } : {}),
  };
  const out = matter.stringify(body.endsWith("\n") ? body : body + "\n", clean);
  fs.writeFileSync(file, out, "utf8");
  revalidatePath(`/posts/${slug}`);
  revalidatePath("/posts");
  revalidatePath("/admin");
  return { ok: true, updatedAt: new Date().toISOString() };
}

export type CreateResult = { ok: true; slug: string } | { ok: false; error: string };

export async function createPostAction(
  slug: string,
  title: string,
): Promise<CreateResult> {
  ensureDev();
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: "Slug must be lowercase letters, digits, and hyphens." };
  }
  if (!title.trim()) return { ok: false, error: "Title is required." };
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  const file = path.join(POSTS_DIR, `${slug}.mdx`);
  if (fs.existsSync(file)) return { ok: false, error: `Post "${slug}" already exists.` };
  const fm: PostFrontmatter = {
    title: title.trim(),
    date: new Date().toISOString().slice(0, 10),
    excerpt: "",
    draft: true,
  };
  fs.writeFileSync(file, matter.stringify("\n", fm), "utf8");
  revalidatePath("/admin");
  return { ok: true, slug };
}
