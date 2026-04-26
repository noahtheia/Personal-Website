import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-12 text-center">
      <h1 className="font-sans text-3xl font-semibold">Not found</h1>
      <p className="mt-3 text-[var(--muted)]">
        That page doesn&apos;t exist (or hasn&apos;t been written yet).
      </p>
      <p className="mt-6">
        <Link href="/">← Back home</Link>
      </p>
    </div>
  );
}
