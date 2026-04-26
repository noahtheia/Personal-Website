#!/usr/bin/env node
// Send a broadcast for a published post.
// Usage:  npm run notify -- <slug>
// Requires RESEND_API_KEY, RESEND_AUDIENCE_ID, NEWSLETTER_FROM, NEXT_PUBLIC_SITE_URL.

import fs from "node:fs";
import path from "node:path";
import { Resend } from "resend";
import matter from "gray-matter";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npm run notify -- <slug>");
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const audienceId = process.env.RESEND_AUDIENCE_ID;
const from = process.env.NEWSLETTER_FROM;
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

for (const [name, value] of Object.entries({
  RESEND_API_KEY: apiKey,
  RESEND_AUDIENCE_ID: audienceId,
  NEWSLETTER_FROM: from,
  NEXT_PUBLIC_SITE_URL: site,
})) {
  if (!value) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
}

const file = path.join(process.cwd(), "content", "posts", `${slug}.mdx`);
if (!fs.existsSync(file)) {
  console.error(`Post not found: ${file}`);
  process.exit(1);
}

const { data: fm, content } = matter(fs.readFileSync(file, "utf8"));
const url = `${site}/posts/${slug}`;
const subject = fm.title;

const attachmentsHtml = (fm.attachments ?? [])
  .map(
    (a) =>
      `<li><a href="${site}${a.path}">${escapeHtml(a.name)}</a>${
        a.description ? ` — ${escapeHtml(a.description)}` : ""
      }</li>`,
  )
  .join("");

const html = `
<div style="font-family: ui-serif, Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a; line-height: 1.6;">
  <h1 style="font-family: ui-sans-serif, system-ui, sans-serif; font-size: 22px; margin: 0 0 8px;">${escapeHtml(fm.title)}</h1>
  <p style="color: #6b6b6b; font-size: 14px; margin: 0 0 24px;">${escapeHtml(fm.excerpt ?? "")}</p>
  <p><a href="${url}" style="color: #1d4ed8;">Read the full post →</a></p>
  ${
    attachmentsHtml
      ? `<p style="margin-top: 24px; font-weight: 600;">Attachments</p><ul>${attachmentsHtml}</ul>`
      : ""
  }
  <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 32px 0;" />
  <p style="color: #6b6b6b; font-size: 12px;">You&apos;re receiving this because you subscribed at ${site}. {{{RESEND_UNSUBSCRIBE_URL}}}</p>
</div>
`;

const text = `${fm.title}

${fm.excerpt ?? ""}

Read the full post: ${url}
${
  (fm.attachments ?? []).length
    ? `\nAttachments:\n${fm.attachments
        .map((a) => `- ${a.name}: ${site}${a.path}`)
        .join("\n")}\n`
    : ""
}
Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}
`;

void content;

const resend = new Resend(apiKey);

console.log(`Creating broadcast for "${subject}"…`);
const created = await resend.broadcasts.create({
  audienceId,
  from,
  subject,
  html,
  text,
});

if (created.error || !created.data) {
  console.error("Failed to create broadcast:", created.error);
  process.exit(1);
}

const broadcastId = created.data.id;
console.log(`Broadcast created: ${broadcastId}`);

const sendArg = process.argv.includes("--send");
if (!sendArg) {
  console.log(
    "Draft created (not sent). Review it in the Resend dashboard, then re-run with --send to deliver.",
  );
  process.exit(0);
}

console.log("Sending…");
const sent = await resend.broadcasts.send(broadcastId);
if (sent.error) {
  console.error("Failed to send broadcast:", sent.error);
  process.exit(1);
}
console.log("Sent.");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
