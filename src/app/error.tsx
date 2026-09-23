"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="auth-wrap classic">
      <div className="auth-card card">
        <h1>Something went wrong</h1>
        <p className="muted">
          {error.message === "UNAUTHENTICATED"
            ? "Your session has expired. Please sign in again."
            : error.message === "FORBIDDEN"
              ? "You do not have permission to do that."
              : "The page could not be loaded."}
        </p>
        <div className="row">
          <button className="primary" onClick={reset}>Try again</button>
          <Link className="btn" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
