import Link from "next/link";
import { redirect } from "next/navigation";
import { FooterNav, HeaderNav, TabBar, type NavItem } from "@/components/AppNav";
import { logoutAction } from "@/lib/actions/auth";
import { getCurrentUser, getMyGroupId, isStaff } from "@/lib/auth";
import { displayName, roleLabel, type User } from "@/lib/types";

export const dynamic = "force-dynamic";

function navFor(user: User, myGroupId: string | null): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", short: "Home", icon: "dashboard" },
    { href: "/groups", label: "Groups & Blogs", short: "Groups", icon: "groups", also: ["/posts"] },
  ];
  if (isStaff(user)) {
    items.push({ href: "/evaluations", label: "Evaluations", short: "Grades", icon: "evaluations" });
  } else {
    // Point straight at the group when there is one: /my-group only exists to
    // redirect there, and that redirect costs a whole extra round trip.
    items.push({
      href: myGroupId ? `/groups/${myGroupId}` : "/my-group",
      label: "My Group",
      short: "My group",
      icon: "myGroup",
      also: myGroupId ? ["/my-group"] : undefined,
    });
  }
  items.push({
    href: "/guidelines",
    label: "Project Guidelines",
    short: "Guidelines",
    icon: "guidelines",
  });
  if (user.role === "ADMIN") {
    items.push({ href: "/admin", label: "Admin", short: "Admin", icon: "admin" });
  }
  return items;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const myGroupId = isStaff(user) ? null : await getMyGroupId(user.id);
  const items = navFor(user, myGroupId);
  const roleClass =
    user.role === "ADMIN" ? "admin" : user.role === "TEACHER" ? "teacher" : "owner";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-shell">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark" aria-hidden="true">CB</span>
            <span className="brand-text">Classroom Blog</span>
          </Link>

          <HeaderNav items={items} />

          <div className="whoami">
            <span className="whoami-id">
              <strong>{displayName(user)}</strong>
              <span className={`badge ${roleClass}`}>{roleLabel(user.role)}</span>
            </span>
            <form action={logoutAction}>
              <button className="small ghost" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="page">{children}</main>

      <footer className="foot">
        <FooterNav items={items} />
        Classroom Blog · course project workspace
      </footer>
      <TabBar items={items} />
    </div>
  );
}
