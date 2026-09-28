import { redirect } from "next/navigation";
import { StaffLogin } from "@/components/AuthForms";
import Portico from "@/components/Portico";
import { getCurrentUser } from "@/lib/auth";
import { UNIVERSITY_EMAIL_DOMAIN } from "@/lib/constants";
import { SITE_CREDIT, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  domain: `Use your university Google account, the one ending in @ogr.${UNIVERSITY_EMAIL_DOMAIN}. Personal accounts such as Gmail cannot join.`,
  failed: "Google sign-in did not finish. Please try again.",
  unavailable: "Google sign-in is not switched on yet. Please try again later.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="google-mark">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="auth-wrap classic">
      <div className="auth-card">
        <Portico className="portico-auth" />
        <div className="brand-big">
          <img className="brand-mark" src="/logo.png" alt="" width={600} height={391} />
          {SITE_NAME}
        </div>
        <p className="muted small" style={{ marginTop: 0, marginBottom: 18 }}>
          Group blogs, project guidelines and teacher evaluation.
        </p>
        <div className="card google-card">
          {error && ERRORS[error] ? <p className="alert error">{ERRORS[error]}</p> : null}
          <a className="btn google-btn" href="/api/auth/google">
            <GoogleMark />
            Continue with Google
          </a>
          <p className="tiny muted google-note">
            Use your university account (@ogr.{UNIVERSITY_EMAIL_DOMAIN}). The first time, you will be asked
            for your name and student number.
          </p>
        </div>
        <p className="credit">{SITE_CREDIT}</p>
      </div>
      <StaffLogin />
    </div>
  );
}
