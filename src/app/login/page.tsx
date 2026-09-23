import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import Portico from "@/components/Portico";
import { getCurrentUser } from "@/lib/auth";
import { classicSignedOut } from "@/lib/classic";
import { SITE_CREDIT, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const classic = await classicSignedOut();
  return (
    <div className={classic ? "auth-wrap classic" : "auth-wrap"}>
      <div className="auth-card">
        {classic && <Portico className="portico-auth" />}
        <div className="brand-big">
          <img className="brand-mark" src="/logo.png" alt="" width={600} height={391} />
          {SITE_NAME}
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
          Teacher: <code>devrim.gunay</code> · Admin: <code>admin323123</code>
          <br />
          Students sign in with the email they registered with.
        </p>
        <p className="credit">{SITE_CREDIT}</p>
      </div>
    </div>
  );
}
