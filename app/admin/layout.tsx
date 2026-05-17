// Outer admin shell — wraps both /admin/login and the secure editor tree in the
// same page-wide container, but doesn't enforce auth. Auth lives in
// app/admin/(secure)/layout.tsx so that /admin/login can render without a
// session.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="page-wide">{children}</div>;
}
