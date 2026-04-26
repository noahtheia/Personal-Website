// Single source of truth for site-wide naming, copy, and contact info.
// Update these values to rebrand the site.

export const site = {
  name: "Noah Goldberg",
  tagline: "Ideas",
  fullName: "Noah Goldberg's Ideas",
  description:
    "Long-form investment write-ups and macro essays for sophisticated investors.",
  shortBio:
    "Investment write-ups and macro essays. Most posts come with the spreadsheet.",
  email: "hello@example.com",
  copyrightHolder: "Noah Goldberg",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000",
};
