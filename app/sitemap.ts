import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/posts`, lastModified: new Date() },
    { url: `${base}/targets`, lastModified: new Date() },
    { url: `${base}/disclosures`, lastModified: new Date() },
  ];
  const postEntries: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${base}/posts/${post.slug}`,
    lastModified: new Date(post.frontmatter.date),
  }));
  return [...staticEntries, ...postEntries];
}
