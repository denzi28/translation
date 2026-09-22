import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card card" style={{ textAlign: "center" }}>
        <h1>Page not found</h1>
        <p className="muted">
          This page does not exist, or it belongs to a group whose drafts you cannot read.
        </p>
        <Link className="btn primary" href="/dashboard">Back to the dashboard</Link>
      </div>
    </div>
  );
}
