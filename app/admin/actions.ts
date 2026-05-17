"use server";

// Server actions for the admin editor. Two write paths:
//   * Dev (`npm run dev`): writes straight to content/posts/*.mdx on disk; no
//     auth required, no GitHub token needed.
//   * Prod (Vercel): reads the GitHub OAuth access token from the signed
//     session cookie and commits via the GitHub Contents API. Each save = one
//     commit on the configured branch (usually main). The deployed file
//     system is read-only, so this is the only writable path in prod.

import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";
import type { PostFrontmatter } from "@/lib/posts";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/admin-session";
import { ghGetFile, ghListMdx, ghPutFile } from "@/lib/admin-github";

const POSTS_DIR_ABS = path.join(process.cwd(), "content", "posts");
const POSTS_DIR_REL = "content/posts";
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

async function requireGithubToken(): Promise<string> {
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) throw new Error("Not signed in.");
  return session.accessToken;
}

function repoPath(slug: string): string {
  if (!SLUG_RE.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  return `${POSTS_DIR_REL}/${slug}.mdx`;
}

function fsPath(slug: string): string {
  if (!SLUG_RE.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  return path.join(POSTS_DIR_ABS, `${slug}.mdx`);
}

// --- list -----------------------------------------------------------------

export type AdminPostSummary = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  draft: boolean;
  updatedAt: string;
};

export async function listPostsAction(): Promise<AdminPostSummary[]> {
  if (isDev()) {
    if (!fs.existsSync(POSTS_DIR_ABS)) return [];
    const files = fs.readdirSync(POSTS_DIR_ABS).filter((f) => f.endsWith(".mdx"));
    const out: AdminPostSummary[] = [];
    for (const f of files) {
      const slug = f.replace(/\.mdx$/, "");
      const full = path.join(POSTS_DIR_ABS, f);
      const stat = fs.statSync(full);
      const { data } = matter(fs.readFileSync(full, "utf8"));
      out.push(summaryFrom(slug, data as Partial<PostFrontmatter>, stat.mtime.toISOString()));
    }
    return sortByDateDesc(out);
  }
  const token = await requireGithubToken();
  const files = await ghListMdx(token, POSTS_DIR_REL);
  const out: AdminPostSummary[] = [];
  for (const f of files) {
    const slug = f.replace(/\.mdx$/, "");
    const file = await ghGetFile(token, repoPath(slug));
    if (!file) continue;
    const { data } = matter(file.content);
    out.push(summaryFrom(slug, data as Partial<PostFrontmatter>, ""));
  }
  return sortByDateDesc(out);
}

function summaryFrom(
  slug: string,
  fm: Partial<PostFrontmatter>,
  updatedAt: string,
): AdminPostSummary {
  return {
    slug,
    title: fm.title ?? slug,
    date: fm.date ?? "",
    excerpt: fm.excerpt ?? "",
    draft: fm.draft === true,
    updatedAt,
  };
}

function sortByDateDesc(rows: AdminPostSummary[]): AdminPostSummary[] {
  return [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
}

// --- load -----------------------------------------------------------------

export type AdminPostFile = {
  slug: string;
  frontmatter: PostFrontmatter;
  body: string;
  updatedAt: string;
};

export async function loadPostAction(slug: string): Promise<AdminPostFile | null> {
  if (isDev()) {
    const file = fsPath(slug);
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
  const token = await requireGithubToken();
  const file = await ghGetFile(token, repoPath(slug));
  if (!file) return null;
  const { data, content } = matter(file.content);
  return {
    slug,
    frontmatter: data as PostFrontmatter,
    body: content.replace(/^\n+/, ""),
    updatedAt: "",
  };
}

// --- save -----------------------------------------------------------------

export type SaveResult =
  | { ok: true; updatedAt: string; mdxError: MdxCompileError | null }
  | { ok: false; error: string };

export type MdxCompileError = {
  message: string;
  reason: string;
  line: number | null;
  column: number | null;
};

async function tryCompileMdx(body: string): Promise<MdxCompileError | null> {
  if (!body.trim()) return null;
  try {
    const { compile } = await import("@mdx-js/mdx");
    await compile(body);
    return null;
  } catch (err: unknown) {
    const e = err as {
      message?: string;
      reason?: string;
      line?: number;
      column?: number;
      place?: { start?: { line?: number; column?: number } };
    };
    return {
      message: e.message ?? String(err),
      reason: e.reason ?? e.message ?? String(err),
      line: e.line ?? e.place?.start?.line ?? null,
      column: e.column ?? e.place?.start?.column ?? null,
    };
  }
}

export async function savePostAction(
  slug: string,
  frontmatter: PostFrontmatter,
  body: string,
): Promise<SaveResult> {
  if (!frontmatter.title?.trim()) return { ok: false, error: "Title is required." };
  if (!frontmatter.date?.trim()) return { ok: false, error: "Date is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.date)) {
    return { ok: false, error: "Date must be YYYY-MM-DD." };
  }
  if (!SLUG_RE.test(slug)) return { ok: false, error: `Invalid slug: ${slug}` };

  const clean: PostFrontmatter = {
    title: frontmatter.title.trim(),
    date: frontmatter.date,
    excerpt: frontmatter.excerpt?.trim() ?? "",
    ...(frontmatter.draft ? { draft: true } : {}),
    ...(frontmatter.attachments?.length ? { attachments: frontmatter.attachments } : {}),
  };
  const fileBody = matter.stringify(body.endsWith("\n") ? body : body + "\n", clean);

  if (isDev()) {
    if (!fs.existsSync(POSTS_DIR_ABS)) fs.mkdirSync(POSTS_DIR_ABS, { recursive: true });
    fs.writeFileSync(fsPath(slug), fileBody, "utf8");
  } else {
    let token: string;
    try {
      token = await requireGithubToken();
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Not signed in." };
    }
    try {
      const existing = await ghGetFile(token, repoPath(slug));
      await ghPutFile(
        token,
        repoPath(slug),
        fileBody,
        `edit: ${slug}`,
        existing?.sha,
      );
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Commit failed." };
    }
  }

  const mdxError = await tryCompileMdx(body);
  revalidatePath(`/posts/${slug}`);
  revalidatePath("/posts");
  revalidatePath("/admin");
  return { ok: true, updatedAt: new Date().toISOString(), mdxError };
}

// --- create ---------------------------------------------------------------

export type CreateResult = { ok: true; slug: string } | { ok: false; error: string };

export async function createPostAction(
  slug: string,
  title: string,
): Promise<CreateResult> {
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: "Slug must be lowercase letters, digits, and hyphens." };
  }
  if (!title.trim()) return { ok: false, error: "Title is required." };
  const fm: PostFrontmatter = {
    title: title.trim(),
    date: new Date().toISOString().slice(0, 10),
    excerpt: "",
    draft: true,
  };
  const fileBody = matter.stringify("\n", fm);

  if (isDev()) {
    if (!fs.existsSync(POSTS_DIR_ABS)) fs.mkdirSync(POSTS_DIR_ABS, { recursive: true });
    const file = fsPath(slug);
    if (fs.existsSync(file)) return { ok: false, error: `Post "${slug}" already exists.` };
    fs.writeFileSync(file, fileBody, "utf8");
  } else {
    let token: string;
    try {
      token = await requireGithubToken();
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Not signed in." };
    }
    try {
      const existing = await ghGetFile(token, repoPath(slug));
      if (existing) return { ok: false, error: `Post "${slug}" already exists.` };
      await ghPutFile(token, repoPath(slug), fileBody, `create: ${slug}`);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Commit failed." };
    }
  }

  revalidatePath("/admin");
  return { ok: true, slug };
}
