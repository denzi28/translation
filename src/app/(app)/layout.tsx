import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { displayName, roleLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const staff = isStaff(user);
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/dashboard" className="brand">Classroom Blog</Link>
          <nav className="nav">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/groups">Groups &amp; Blogs</Link>
            {!staff ? <Link href="/my-group">My Group</Link> : null}
            {staff ? <Link href="/evaluations">Evaluations</Link> : null}
            <Link href="/guidelines" className="highlight">Project Guidelines</Link>
            {user.role === "ADMIN" ? <Link href="/admin">Admin</Link> : null}
          </nav>
          <div className="whoami">
            <span>
              <strong>{displayName(user)}</strong>
              <br />
              <span className="tiny">{roleLabel(user.role)}</span>
            </span>
            <form action={logoutAction}>
              <button className="small" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="foot">Classroom Blog · course project workspace</footer>
    </div>
  );
}
