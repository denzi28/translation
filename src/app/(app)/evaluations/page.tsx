import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { MAX_MEMBERS } from "@/lib/constants";
import { listFeedbackForGroup, listGroups } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { displayName } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EvaluationsPage() {
  const user = (await getCurrentUser())!;
  if (!isStaff(user)) redirect("/dashboard");

  const groups = await listGroups();
  const rows = await Promise.all(
    groups.map(async (group) => ({ group, feedback: await listFeedbackForGroup(group.id) })),
  );

  return (
    <>
      <div className="page-head">
        <h1>Evaluations</h1>
        <p className="lede">
          Every group with its members, published work and the private feedback left so far.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card"><p className="empty">No groups have been formed yet.</p></div>
      ) : (
        rows.map(({ group, feedback }) => {
          const grade = feedback.find((entry) => entry.grade !== null)?.grade ?? null;
          const commented = feedback.some((entry) => entry.comment.trim() !== "");
          return (
            <section className="card" key={group.id}>
              <div className="card-title">
                <h2><Link href={`/groups/${group.id}`}>{group.name}</Link></h2>
                <div className="row">
                  {grade !== null ? (
                    <span className="badge published">{grade} / 100</span>
                  ) : commented ? (
                    <span className="badge owner">Commented</span>
                  ) : (
                    <span className="badge">Nothing yet</span>
                  )}
                  <Link className="btn small primary" href={`/groups/${group.id}#evaluation`}>
                    Give feedback
                  </Link>
                </div>
              </div>
              <p className="small muted" style={{ marginTop: 0 }}>
                {group.member_count}/{MAX_MEMBERS} members ·{" "}
                {group.published_count} published, {group.draft_count} draft
                {group.draft_count === 1 ? "" : "s"}
              </p>
              <p className="small">{group.members.map((m) => displayName(m)).join(" · ")}</p>
              {feedback.length > 0 ? (
                <ul className="plain small">
                  {feedback.slice(0, 3).map((entry) => (
                    <li key={entry.id}>
                      <span className="muted">{formatDateTime(entry.created_at)}</span>
                      {entry.grade !== null ? ` · ${entry.grade}/100` : ""}
                      {entry.comment ? ` · ${entry.comment.slice(0, 120)}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">No feedback yet.</p>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
