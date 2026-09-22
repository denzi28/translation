import Link from "next/link";
import { redirect } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import {
  createStaffAction,
  deleteUserAction,
  resetPasswordAction,
  setUserRoleAction,
  setUsernameAction,
} from "@/lib/actions/admin";
import { deleteGroupAction } from "@/lib/actions/groups";
import { getCurrentUser } from "@/lib/auth";
import { MAX_MEMBERS } from "@/lib/constants";
import { countsByRole, getGuidelinesMeta, listAllUsers, listGroups } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = (await getCurrentUser())!;
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [users, groups, counts, guidelines] = await Promise.all([
    listAllUsers(),
    listGroups(),
    countsByRole(),
    getGuidelinesMeta(),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Administration</h1>
        <p className="lede">Accounts, groups and course settings.</p>
      </div>

      <div className="grid three">
        <div className="card">
          <h3 style={{ margin: 0 }}>{counts.STUDENT}</h3>
          <span className="tiny muted">Students</span>
        </div>
        <div className="card">
          <h3 style={{ margin: 0 }}>{groups.length}</h3>
          <span className="tiny muted">Groups (max {MAX_MEMBERS} members each)</span>
        </div>
        <div className="card">
          <h3 style={{ margin: 0 }}>{counts.TEACHER + counts.ADMIN}</h3>
          <span className="tiny muted">Staff accounts</span>
        </div>
      </div>

      <section className="card">
        <div className="card-title">
          <h2>Course settings</h2>
          <Link className="btn small" href="/guidelines">Manage guidelines PDF</Link>
        </div>
        <p className="small" style={{ margin: 0 }}>
          {guidelines
            ? `Guidelines: ${guidelines.filename}, updated ${formatDateTime(guidelines.uploaded_at)}.`
            : "No guidelines PDF has been uploaded yet."}
        </p>
      </section>

      <section className="card">
        <div className="card-title"><h2>Create a staff account</h2></div>
        <ActionForm action={createStaffAction} className="stack">
          <div className="grid two">
            <label className="field" style={{ margin: 0 }}>
              <span>Username</span>
              <input name="username" placeholder="e.g. jane.doe" required />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Full name</span>
              <input name="full_name" required />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Role</span>
              <select name="role" defaultValue="TEACHER">
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Password (min. 8 characters)</span>
              <input type="password" name="password" required minLength={8} />
            </label>
          </div>
          <div><SubmitButton pendingLabel="Creating…">Create account</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="card">
        <div className="card-title"><h2>Groups</h2></div>
        {groups.length === 0 ? (
          <p className="empty">No groups yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data stacked">
              <thead>
                <tr>
                  <th>Group</th><th>Members</th><th>Posts</th><th>Invite code</th><th></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td data-label="Group">
                      <Link href={`/groups/${group.id}`}>{group.name}</Link>
                    </td>
                    <td data-label="Members">{group.member_count}/{MAX_MEMBERS}</td>
                    <td data-label="Posts">
                      {group.published_count} published · {group.draft_count} draft
                    </td>
                    <td data-label="Code" className="mono tiny">{group.invite_code}</td>
                    <td data-label="Actions">
                      <ActionForm action={deleteGroupAction}>
                        <input type="hidden" name="group_id" value={group.id} />
                        <SubmitButton
                          className="danger small"
                          confirm={`Delete “${group.name}” with all of its posts and feedback?`}
                        >
                          Delete
                        </SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-title"><h2>Accounts</h2></div>
        <div className="table-wrap">
          <table className="data stacked">
            <thead>
              <tr>
                <th>Name</th><th>Identity</th><th>Role</th><th>Group</th><th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td data-label="Name">
                    <strong>{row.full_name}</strong>
                    {row.id === user.id ? <> <span className="badge owner">You</span></> : null}
                  </td>
                  <td data-label="Identity" className="tiny">
                    {row.student_number ? <>No. {row.student_number}<br /></> : null}
                    {row.email ?? null}
                    {row.username ? <span className="mono">{row.username}</span> : null}
                  </td>
                  <td data-label="Role" className="cell-wide">
                    <ActionForm action={setUserRoleAction} className="row">
                      <input type="hidden" name="user_id" value={row.id} />
                      <select name="role" defaultValue={row.role} className="field-xs">
                        <option value="STUDENT">Student</option>
                        <option value="TEACHER">Teacher</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <SubmitButton className="small">Set</SubmitButton>
                    </ActionForm>
                  </td>
                  <td data-label="Group" className="tiny">{row.group_name ?? "—"}</td>
                  <td data-label="Joined" className="tiny">{formatDate(row.created_at)}</td>
                  <td data-label="Actions" className="cell-wide">
                    <ActionForm action={resetPasswordAction} className="row">
                      <input type="hidden" name="user_id" value={row.id} />
                      <input
                        type="password"
                        name="password"
                        placeholder="New password"
                        minLength={8}
                        className="field-xs"
                      />
                      <SubmitButton className="small">Reset</SubmitButton>
                    </ActionForm>
                    {!row.username ? (
                      <ActionForm action={setUsernameAction} className="row" style={{ marginTop: 6 }}>
                        <input type="hidden" name="user_id" value={row.id} />
                        <input name="username" placeholder="Give a username" className="field-xs" />
                        <SubmitButton className="small">Set</SubmitButton>
                      </ActionForm>
                    ) : null}
                    {row.id !== user.id ? (
                      <ActionForm action={deleteUserAction} style={{ marginTop: 6 }}>
                        <input type="hidden" name="user_id" value={row.id} />
                        <SubmitButton
                          className="danger small"
                          confirm={`Delete the account of ${row.full_name}?`}
                        >
                          Delete account
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
