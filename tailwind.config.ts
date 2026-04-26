import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.mdx",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: [
          "var(--font-fraunces)",
          "ui-serif",
          "Georgia",
          "Cambria",
          "serif",
        ],
        display: [
          "var(--font-fraunces)",
          "ui-serif",
          "Georgia",
          "serif",
        ],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--bg-elevated)",
        fg: "var(--fg)",
        "fg-soft": "var(--fg-soft)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-warm": "var(--accent-warm)",
        rule: "var(--border)",
        "rule-strong": "var(--border-strong)",
      },
      maxWidth: {
        prose: "44rem",
      },
      typography: () => ({
        DEFAULT: {
          css: {
            "--tw-prose-body": "var(--fg-soft)",
            "--tw-prose-headings": "var(--fg)",
            "--tw-prose-links": "var(--accent)",
            "--tw-prose-bold": "var(--fg)",
            "--tw-prose-quotes": "var(--fg-soft)",
            "--tw-prose-quote-borders": "var(--accent-warm)",
            "--tw-prose-bullets": "var(--muted)",
            "--tw-prose-hr": "var(--border)",
            fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
            fontSize: "1.0625rem",
            lineHeight: "1.75",
            h1: { fontFamily: "var(--font-fraunces), serif", fontWeight: "600" },
            h2: { fontFamily: "var(--font-fraunces), serif", fontWeight: "600" },
            h3: { fontFamily: "var(--font-fraunces), serif", fontWeight: "600" },
            h4: { fontFamily: "var(--font-fraunces), serif", fontWeight: "600" },
            a: { textDecoration: "none", borderBottom: "1px solid var(--accent)" },
            "a:hover": {
              color: "var(--accent-hover)",
              borderBottomColor: "var(--accent-hover)",
            },
            blockquote: {
              fontStyle: "normal",
              borderLeftWidth: "3px",
              paddingLeft: "1.25rem",
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
};

export default config;
