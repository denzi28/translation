import Link from "next/link";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { respondToInviteAction } from "@/lib/actions/groups";
import { getCurrentUser, getMyGroupId, isStaff } from "@/lib/auth";
import { MAX_MEMBERS } from "@/lib/constants";
import {
  countsByRole,
  getGroup,
  getGuidelinesMeta,
  latestGrade,
  listGroups,
  listVisiblePosts,
  myOutgoingRequests,
  pendingForUser,
} from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { displayName } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const staff = isStaff(user);
  const myGroupId = await getMyGroupId(user.id);
  const myGroup = myGroupId ? await getGroup(myGroupId) : null;
  const posts = await listVisiblePosts(user, myGroupId);
  const recent = posts.slice(0, 6);
  const guidelines = await getGuidelinesMeta();

  const invites = staff ? [] : await pendingForUser(user.id);
  const outgoing = staff ? [] : await myOutgoingRequests(user.id);
  const groups = staff ? await listGroups() : [];
  const counts = user.role === "ADMIN" ? await countsByRole() : null;
  const myGrade = myGroupId ? await latestGrade(myGroupId) : null;

  return (
    <>
      <div className="page-head">
        <h1>Welcome, {displayName(user)}</h1>
        <p className="lede">
          {staff
            ? "Read every group blog and leave private grades and feedback."
            : "Form a group of 1–5 people, write your blog and read what the class publishes."}
        </p>
      </div>

      {invites.length > 0 ? (
        <section className="card">
          <div className="card-title"><h2>Your invitations</h2></div>
          <ul className="plain">
            {invites.map((invite) => (
              <li key={invite.id} className="spread">
                <div>
                  <strong>{invite.group_name}</strong> invited you to join.
                  <div className="tiny muted">{formatDateTime(invite.created_at)}</div>
                </div>
                <div className="row">
                  <ActionForm action={respondToInviteAction}>
                    <input type="hidden" name="request_id" value={invite.id} />
                    <input type="hidden" name="decision" value="accept" />
                    <SubmitButton className="primary small" pendingLabel="Joining…">Accept</SubmitButton>
                  </ActionForm>
                  <ActionForm action={respondToInviteAction}>
                    <input type="hidden" name="request_id" value={invite.id} />
                    <input type="hidden" name="decision" value="decline" />
                    <SubmitButton className="small">Decline</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid two">
        {!staff ? (
          <section className="card">
            <div className="card-title">
              <h2>Your group</h2>
              {myGroup ? (
                <span className="badge owner">
                  {myGroup.member_count}/{MAX_MEMBERS}
                </span>
              ) : null}
            </div>
            {myGroup ? (
              <>
                <p style={{ marginTop: 0 }}>
                  <Link href={`/groups/${myGroup.id}`}><strong>{myGroup.name}</strong></Link>
                </p>
                <ul className="plain">
                  {myGroup.members.map((member) => (
                    <li key={member.user_id} className="small">
                      {displayName(member)}
                      {member.is_owner ? <> <span className="badge owner">Owner</span></> : null}
                    </li>
                  ))}
                </ul>
                <p className="small" style={{ marginTop: 10 }}>
                  {myGrade !== null ? (
                    <span className="badge published">Latest grade: {myGrade} / 100</span>
                  ) : (
                    <span className="badge">Not graded yet</span>
                  )}
                </p>
                <Link className="btn small" href={`/groups/${myGroup.id}`}>Open group blog</Link>
              </>
            ) : (
              <>
                <p className="empty" style={{ marginTop: 0 }}>
                  You are not in a group yet.
                </p>
                {outgoing.length > 0 ? (
                  <p className="small muted">
                    Waiting on: {outgoing.map((r) => r.group_name).join(", ")}
                  </p>
                ) : null}
                <Link className="btn primary small" href="/my-group">Create or join a group</Link>
              </>
            )}
          </section>
        ) : (
          <section className="card">
            <div className="card-title"><h2>Class overview</h2></div>
            <div className="table-wrap">
              <table className="data stacked">
                <thead>
                  <tr><th>Group</th><th>Members</th><th>Published</th><th>Grade</th></tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr><td colSpan={4} className="empty">No groups have been formed yet.</td></tr>
                  ) : (
                    groups.map((group) => (
                      <tr key={group.id}>
                        <td data-label="Group">
                          <Link href={`/groups/${group.id}`}>{group.name}</Link>
                        </td>
                        <td data-label="Members">{group.member_count}/{MAX_MEMBERS}</td>
                        <td data-label="Published">{group.published_count}</td>
                        <td data-label="Grade">
                          <Link href={`/groups/${group.id}#evaluation`}>Evaluate</Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {counts ? (
              <p className="tiny muted" style={{ marginTop: 10 }}>
                {counts.STUDENT} students · {counts.TEACHER} teachers · {counts.ADMIN} admins
              </p>
            ) : null}
          </section>
        )}

        <section className="card">
          <div className="card-title"><h2>Project guidelines</h2></div>
          {guidelines ? (
            <>
              <p style={{ marginTop: 0 }}>
                <strong>{guidelines.filename}</strong>
                <br />
                <span className="tiny muted">
                  Updated {formatDateTime(guidelines.uploaded_at)}
                  {guidelines.uploader_name ? ` by ${guidelines.uploader_name}` : ""}
                </span>
              </p>
              <div className="row">
                <Link className="btn primary small" href="/guidelines">Read in browser</Link>
                <a className="btn small" href="/api/guidelines/file?download=1">Download PDF</a>
              </div>
            </>
          ) : (
            <>
              <p className="empty" style={{ marginTop: 0 }}>
                No guidelines PDF has been uploaded yet.
              </p>
              {staff ? <Link className="btn primary small" href="/guidelines">Upload it</Link> : null}
            </>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-title">
          <h2>Latest from the class</h2>
          <Link className="small" href="/groups">See all groups</Link>
        </div>
        {recent.length === 0 ? (
          <p className="empty">Nothing has been published yet.</p>
        ) : (
          <ul className="plain">
            {recent.map((post) => (
              <li key={post.id} className="spread">
                <div>
                  <Link href={`/posts/${post.id}`}><strong>{post.title}</strong></Link>
                  <div className="tiny muted">
                    {post.group_name} ·{" "}
                    {post.status === "PUBLISHED"
                      ? formatDateTime(post.published_at)
                      : `draft, edited ${formatDateTime(post.updated_at)}`}
                  </div>
                </div>
                <span className={`badge ${post.status === "PUBLISHED" ? "published" : "draft"}`}>
                  {post.status === "PUBLISHED" ? "Published" : "Draft"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
