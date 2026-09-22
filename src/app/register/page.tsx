import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand-big">
          <img className="brand-mark" src="/logo.png" alt="" width={600} height={391} />
          {SITE_NAME}
        </div>
        <p className="muted small" style={{ marginTop: 0, marginBottom: 18 }}>
          Create your student account to join a group.
        </p>
        <div className="auth-tabs">
          <Link href="/login">Sign in</Link>
          <Link href="/register" className="active">Register</Link>
        </div>
        <div className="card">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
