import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/AuthForms";
import Portico from "@/components/Portico";
import { getCurrentUser } from "@/lib/auth";
import { readPending } from "@/lib/google";
import { SITE_CREDIT, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The one-time step after a new student's first Google sign-in. */
export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const pending = await readPending();
  if (!pending) redirect("/login");
  return (
    <div className="auth-wrap classic">
      <div className="auth-card">
        <Portico className="portico-auth" />
        <div className="brand-big">
          <img className="brand-mark" src="/logo.png" alt="" width={600} height={391} />
          {SITE_NAME}
        </div>
        <p className="muted small" style={{ marginTop: 0, marginBottom: 18 }}>
          Signed in with Google as <strong>{pending.email}</strong>. Add your name and student number to
          finish.
        </p>
        <div className="card">
          <ProfileForm googleName={pending.name} />
        </div>
        <p className="credit">{SITE_CREDIT}</p>
      </div>
    </div>
  );
}
