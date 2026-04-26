export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] pt-6 font-sans text-sm text-[var(--muted)]">
      <p>
        © {new Date().getFullYear()} Noah. Nothing here is investment advice.
      </p>
    </footer>
  );
}
