// Tiny GitHub Contents-API client for the admin portal's production write path.
// Reads + writes single files via PUT /repos/{owner}/{repo}/contents/{path}.
// Uses the OAuth access token from the admin session; one commit per write.

const API = "https://api.github.com";

function repoConfig() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "main";
  if (!owner || !repo) {
    throw new Error("GITHUB_OWNER / GITHUB_REPO env vars are not set.");
  }
  return { owner, repo, branch };
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tradernoah-admin",
  };
}

export type GhFile = { content: string; sha: string };

/** Read a file at `path` (relative to repo root) on the configured branch. */
export async function ghGetFile(token: string, path: string): Promise<GhFile | null> {
  const { owner, repo, branch } = repoConfig();
  const url = `${API}/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: headers(token), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { content?: string; sha?: string; encoding?: string };
  if (typeof json.content !== "string" || typeof json.sha !== "string") return null;
  const content = Buffer.from(json.content, "base64").toString("utf8");
  return { content, sha: json.sha };
}

/**
 * Create or update a file. If `sha` is provided, it's an update (optimistic
 * concurrency — fails with 409 if the file has moved on). If omitted, it's a
 * create (fails with 422 if the file exists).
 */
export async function ghPutFile(
  token: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ sha: string; commitSha: string }> {
  const { owner, repo, branch } = repoConfig();
  const url = `${API}/repos/${owner}/${repo}/contents/${encodeURI(path)}`;
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT ${path}: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    content?: { sha?: string };
    commit?: { sha?: string };
  };
  return {
    sha: json.content?.sha ?? "",
    commitSha: json.commit?.sha ?? "",
  };
}

/** List all .mdx files under `dir` on the configured branch. */
export async function ghListMdx(token: string, dir: string): Promise<string[]> {
  const { owner, repo, branch } = repoConfig();
  const url = `${API}/repos/${owner}/${repo}/contents/${encodeURI(dir)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: headers(token), cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub LIST ${dir}: ${res.status} ${await res.text()}`);
  const items = (await res.json()) as { name: string; type: string }[];
  return items.filter((i) => i.type === "file" && i.name.endsWith(".mdx")).map((i) => i.name);
}
