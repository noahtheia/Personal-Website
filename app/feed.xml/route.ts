import { getAllPosts } from "@/lib/posts";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const posts = getAllPosts();
  const updated =
    posts[0] != null
      ? new Date(posts[0].frontmatter.date).toUTCString()
      : new Date().toUTCString();

  const items = posts
    .map((post) => {
      const url = `${site.url}/posts/${post.slug}`;
      const pubDate = new Date(post.frontmatter.date).toUTCString();

      const attachmentsHtml = post.frontmatter.attachments?.length
        ? `<p><strong>Attachments:</strong></p><ul>${post.frontmatter.attachments
            .map(
              (a) =>
                `<li><a href="${site.url}${a.path}">${escapeXml(a.name)}</a>${
                  a.description ? ` — ${escapeXml(a.description)}` : ""
                }</li>`,
            )
            .join("")}</ul>`
        : "";

      const description =
        `<p>${escapeXml(post.frontmatter.excerpt)}</p>` +
        attachmentsHtml +
        `<p><a href="${url}">Read the full post →</a></p>`;

      return `
    <item>
      <title>${escapeXml(post.frontmatter.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.brand)}</title>
    <link>${site.url}</link>
    <description>${escapeXml(site.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${updated}</lastBuildDate>
    <atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
