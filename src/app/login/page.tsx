import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand-big">
          <span className="brand-mark" aria-hidden="true">CB</span>
          Classroom Blog
        </div>
        <p className="muted small" style={{ marginTop: 0, marginBottom: 18 }}>
          Group blogs, project guidelines and teacher evaluation.
        </p>
        <div className="auth-tabs">
          <Link href="/login" className="active">Sign in</Link>
          <Link href="/register">Register</Link>
        </div>
        <div className="card">
          <LoginForm />
        </div>
        <p className="seed-note">
          Teacher: <code>devrim.ozkan</code> · Admin: <code>admin323123</code>
          <br />
          Students sign in with the email they registered with.
        </p>
      </div>
    </div>
  );
}
