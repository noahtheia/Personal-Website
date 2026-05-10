// Server helper: stops @tailwindcss/typography's `.prose` styles from cascading
// into embedded chart UI / hand-written tables inside MDX articles. The chart
// components already bake `not-prose` into their own root element, so this is
// only needed for ad-hoc figures or tables written directly in `.mdx`.

export function NotProse({ children }: { children: React.ReactNode }) {
  return <div className="not-prose">{children}</div>;
}
