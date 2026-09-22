import Link from "next/link";
import { getCurrentUser, getMyGroupId, isStaff } from "@/lib/auth";
import { MAX_MEMBERS } from "@/lib/constants";
import { listGroups } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { displayName } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const user = (await getCurrentUser())!;
  const myGroupId = await getMyGroupId(user.id);
  const groups = await listGroups();

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>Groups &amp; blogs</h1>
          <p className="lede">
            Every group has its own blog space. Published posts are readable by the whole class.
          </p>
        </div>
        {!isStaff(user) && !myGroupId ? (
          <Link className="btn primary" href="/my-group">Create or join a group</Link>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <div className="card"><p className="empty">No groups have been created yet.</p></div>
      ) : (
        <div className="grid two">
          {groups.map((group) => (
            <section className="card" key={group.id}>
              <div className="card-title">
                <h2><Link href={`/groups/${group.id}`}>{group.name}</Link></h2>
                <span className="badge">
                  {group.member_count}/{MAX_MEMBERS}
                </span>
              </div>
              {group.description ? (
                <p className="small muted" style={{ marginTop: 0 }}>{group.description}</p>
              ) : null}
              <ul className="plain small">
                {group.members.map((member) => (
                  <li key={member.user_id} style={{ padding: "4px 0", borderBottom: "none" }}>
                    {displayName(member)}
                    {member.is_owner ? <> <span className="badge owner">Owner</span></> : null}
                  </li>
                ))}
              </ul>
              <div className="spread" style={{ marginTop: 10 }}>
                <span className="tiny muted">
                  {group.published_count} published · started {formatDate(group.created_at)}
                </span>
                <Link className="btn small" href={`/groups/${group.id}`}>
                  {group.id === myGroupId ? "Open my group" : "View blog"}
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
