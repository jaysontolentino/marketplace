import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>This page wandered off.</h1>
      <p>There are still plenty of great finds waiting for you.</p>
      <Link href="/" className="back-link">
        Back to Marketplace →
      </Link>
    </main>
  );
}
