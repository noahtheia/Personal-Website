// Single source of truth for site-wide naming, copy, and contact info.
// Update these values to rebrand the site.

export const site = {
  // Brand wordmark — used in the header, browser tab, and page-title template.
  brand: "Trader Noah",

  // Your real name — used on the About page and in the copyright line.
  author: "Noah Goldberg",

  description:
    "Long-form investment write-ups and macro essays for fun.",
  shortBio:
    "Investment write-ups and macro essays. Most posts come with the spreadsheet.",
  email: "hello@example.com",
  socials: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/noahgoldbergiu/" },
    { label: "X", href: "https://x.com/TraderNoah" },
  ],
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000",
};
