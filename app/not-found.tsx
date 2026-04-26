import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
        Not found
      </h1>
      <p className="mt-4 text-muted">
        That page doesn&apos;t exist (or hasn&apos;t been written yet).
      </p>
      <p className="mt-8">
        <Link href="/" className="!text-accent no-underline hover:underline">
          ← Back home
        </Link>
      </p>
    </div>
  );
}
