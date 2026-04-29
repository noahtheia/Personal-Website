#!/usr/bin/env node
// Detect posts that just transitioned to published in this push.
// Compares two git refs and prints space-separated slugs for the posts
// that are currently published AND were either (a) newly added, or
// (b) draft in the previous ref.
//
// Usage: detect-publish-events.mjs <BEFORE_SHA> <AFTER_SHA>

import { execSync } from "node:child_process";
import path from "node:path";

const before = process.argv[2];
const after = process.argv[3];

if (!before || !after) {
  console.error("Usage: detect-publish-events.mjs <BEFORE_SHA> <AFTER_SHA>");
  process.exit(1);
}

// Detect first push to a branch (BEFORE = all-zero SHA). In that case
// "newly added" against an empty tree is everything in the post dir.
const ZERO_SHA = "0000000000000000000000000000000000000000";

function isDraft(content) {
  if (content == null) return null; // file didn't exist
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return false; // no frontmatter; treat as published
  return /^\s*draft:\s*true\s*$/m.test(fm[1]);
}

function readFileAt(ref, file) {
  if (ref === ZERO_SHA) return null;
  try {
    return execSync(`git show ${ref}:${file}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null; // file did not exist at that ref
  }
}

let changedFiles = [];
try {
  const range = before === ZERO_SHA ? after : `${before}..${after}`;
  const out = execSync(
    `git diff --name-only --diff-filter=ACMR ${range} -- 'content/posts/*.mdx'`,
    { encoding: "utf8" },
  );
  changedFiles = out.split("\n").filter(Boolean);
} catch (err) {
  console.error("git diff failed:", err.message);
  process.exit(1);
}

const slugs = [];
for (const file of changedFiles) {
  const slug = path.basename(file, ".mdx");
  const prevContent = readFileAt(before, file);
  const currContent = readFileAt(after, file);

  if (currContent == null) continue; // deleted
  const currDraft = isDraft(currContent);
  if (currDraft === true) continue; // still a draft

  if (prevContent == null) {
    // Newly added as published.
    slugs.push(slug);
    continue;
  }
  const prevDraft = isDraft(prevContent);
  if (prevDraft === true) {
    // Transitioned from draft → published.
    slugs.push(slug);
  }
  // else: was already published; this is just an edit. Do not notify.
}

process.stdout.write(slugs.join(" "));
