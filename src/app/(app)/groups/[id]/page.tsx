import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import FeedbackPanel from "@/components/FeedbackPanel";
import SubmitButton from "@/components/SubmitButton";
import {
  cancelRequestAction,
  deleteGroupAction,
  inviteStudentAction,
  leaveGroupAction,
  regenerateInviteCodeAction,
  removeMemberAction,
  requestJoinAction,
  respondToJoinRequestAction,
  updateGroupAction,
} from "@/lib/actions/groups";
import { createPostAction } from "@/lib/actions/posts";
import { MAX_MEMBERS } from "@/lib/constants";
import { getCurrentUser, getMyGroupId, isStaff } from "@/lib/auth";
import {
  canSeeFeedback,
  getGroup,
  listFeedbackForGroup,
  listGroupPosts,
  pendingForGroup,
  unassignedStudents,
} from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { htmlExcerpt } from "@/lib/sanitize";
import { displayName } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q = "" } = await searchParams;

  const user = (await getCurrentUser())!;

  // The database is a round trip away, so independent reads go together rather
  // than one after another.
  const [group, myGroupId, posts] = await Promise.all([
    getGroup(id),
    getMyGroupId(user.id),
    listGroupPosts(id),
  ]);
  if (!group) notFound();

  const isMember = group.members.some((m) => m.user_id === user.id);
  const isOwner = group.members.some((m) => m.user_id === user.id && m.is_owner);
  const staff = isStaff(user);
  const full = group.member_count >= MAX_MEMBERS;

  const visiblePosts = isMember ? posts : posts.filter((p) => p.status === "PUBLISHED");
  const showFeedback = await canSeeFeedback(user, id, myGroupId);

  const [feedback, requests, candidates] = await Promise.all([
    showFeedback ? listFeedbackForGroup(id) : Promise.resolve([]),
    isMember || user.role === "ADMIN" ? pendingForGroup(id) : Promise.resolve([]),
    isMember && !full ? unassignedStudents(q) : Promise.resolve([]),
  ]);

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>{group.name}</h1>
          <p className="lede">
            {group.member_count} of {MAX_MEMBERS} members · created {formatDateTime(group.created_at)}
          </p>
        </div>
        <div className="row">
          {isMember ? <span className="badge owner">Your group</span> : null}
          {full ? <span className="badge">Full</span> : null}
        </div>
      </div>

      {group.description ? <p className="muted">{group.description}</p> : null}

      <div className="grid two">
        <section className="card">
          <div className="card-title">
            <h2>Blog posts</h2>
            {isMember ? (
              <ActionForm action={createPostAction} className="row">
                <input type="hidden" name="group_id" value={group.id} />
                <input name="title" placeholder="New post title" className="field-inline" />
                <SubmitButton className="primary small" pendingLabel="Creating…">
                  New post
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>

          {visiblePosts.length === 0 ? (
            <p className="empty">
              {isMember
                ? "No posts yet — start the group's blog with a new post."
                : "This group has not published anything yet."}
            </p>
          ) : (
            <ul className="plain">
              {visiblePosts.map((post) => (
                <li key={post.id}>
                  <div className="spread">
                    <Link href={`/posts/${post.id}`}>
                      <strong>{post.title}</strong>
                    </Link>
                    <span className={`badge ${post.status === "PUBLISHED" ? "published" : "draft"}`}>
                      {post.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="tiny muted">
                    {post.status === "PUBLISHED"
                      ? `Published ${formatDateTime(post.published_at)}`
                      : `Last edited ${formatDateTime(post.updated_at)}`}
                  </div>
                  {htmlExcerpt(post.content_html) ? (
                    <p className="small muted" style={{ margin: "6px 0 0" }}>
                      {htmlExcerpt(post.content_html)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <h2>Members</h2>
            <span className="tiny muted">1–{MAX_MEMBERS} people</span>
          </div>
          <ul className="plain">
            {group.members.map((member) => (
              <li key={member.user_id} className="spread">
                <div>
                  <strong>{displayName(member)}</strong>
                  {member.is_owner ? <> <span className="badge owner">Owner</span></> : null}
                  <div className="tiny muted">{member.email}</div>
                </div>
                {(isOwner || user.role === "ADMIN") && member.user_id !== user.id ? (
                  <ActionForm action={removeMemberAction}>
                    <input type="hidden" name="group_id" value={group.id} />
                    <input type="hidden" name="user_id" value={member.user_id} />
                    <SubmitButton
                      className="danger small"
                      confirm={`Remove ${member.full_name} from this group?`}
                    >
                      Remove
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>

          {isMember ? (
            <>
              <hr className="rule" />
              <p className="small">
                Invite code:{" "}
                <strong className="mono">{group.invite_code}</strong>{" "}
                <span className="muted">— classmates can join with this code.</span>
              </p>
              <ActionForm action={regenerateInviteCodeAction}>
                <input type="hidden" name="group_id" value={group.id} />
                <SubmitButton className="small">Generate a new code</SubmitButton>
              </ActionForm>
            </>
          ) : null}

          {!isMember && !staff && !myGroupId && !full ? (
            <ActionForm action={requestJoinAction} style={{ marginTop: 14 }}>
              <input type="hidden" name="group_id" value={group.id} />
              <SubmitButton pendingLabel="Sending…">Ask to join this group</SubmitButton>
            </ActionForm>
          ) : null}
        </section>
      </div>

      {isMember || user.role === "ADMIN" ? (
        <section className="card">
          <div className="card-title">
            <h2>Invitations &amp; join requests</h2>
          </div>

          {requests.length === 0 ? (
            <p className="empty">Nothing pending.</p>
          ) : (
            <ul className="plain">
              {requests.map((request) => (
                <li key={request.id} className="spread">
                  <div>
                    <strong>{displayName(request)}</strong>
                    <div className="tiny muted">
                      {request.kind === "INVITE"
                        ? "Invited by the group — waiting for them to accept"
                        : "Asked to join this group"}{" "}
                      · {formatDateTime(request.created_at)}
                    </div>
                  </div>
                  <div className="row">
                    {request.kind === "REQUEST" ? (
                      <>
                        <ActionForm action={respondToJoinRequestAction}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <input type="hidden" name="decision" value="accept" />
                          <SubmitButton className="primary small" pendingLabel="Adding…">
                            Accept
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={respondToJoinRequestAction}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <input type="hidden" name="decision" value="decline" />
                          <SubmitButton className="small">Decline</SubmitButton>
                        </ActionForm>
                      </>
                    ) : (
                      <ActionForm action={cancelRequestAction}>
                        <input type="hidden" name="request_id" value={request.id} />
                        <SubmitButton className="small">Withdraw</SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isMember && !full ? (
            <>
              <hr className="rule" />
              <h3>Invite a classmate</h3>
              <form className="row" style={{ marginBottom: 10 }}>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search by name, email or student number"
                  className="field-inline"
                />
                <button type="submit" className="small">Search</button>
              </form>
              {candidates.length === 0 ? (
                <p className="empty">No unassigned students match that search.</p>
              ) : (
                <ul className="plain">
                  {candidates.map((candidate) => (
                    <li key={candidate.id} className="spread">
                      <div>
                        <strong>{displayName(candidate)}</strong>
                        <div className="tiny muted">{candidate.email}</div>
                      </div>
                      <ActionForm action={inviteStudentAction}>
                        <input type="hidden" name="group_id" value={group.id} />
                        <input type="hidden" name="user_id" value={candidate.id} />
                        <SubmitButton className="small" pendingLabel="Inviting…">Invite</SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
          {isMember && full ? (
            <p className="alert info small" style={{ marginTop: 12 }}>
              This group has reached the {MAX_MEMBERS}-member limit, so no further invitations can be
              sent.
            </p>
          ) : null}
        </section>
      ) : null}

      {showFeedback ? (
        <FeedbackPanel
          groupId={group.id}
          posts={posts.map((p) => ({ id: p.id, title: p.title }))}
          feedback={feedback}
          viewerRole={user.role}
          viewerId={user.id}
        />
      ) : null}

      {isMember || user.role === "ADMIN" ? (
        <section className="card">
          <div className="card-title">
            <h2>Group settings</h2>
          </div>
          <ActionForm action={updateGroupAction} className="stack">
            <input type="hidden" name="group_id" value={group.id} />
            <label className="field" style={{ margin: 0 }}>
              <span>Group name</span>
              <input name="name" defaultValue={group.name} required maxLength={60} />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Description</span>
              <textarea name="description" defaultValue={group.description} />
            </label>
            <div>
              <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
            </div>
          </ActionForm>

          <div className="row" style={{ marginTop: 16 }}>
            {isMember ? (
              <ActionForm action={leaveGroupAction}>
                <input type="hidden" name="group_id" value={group.id} />
                <SubmitButton
                  className="danger"
                  confirm="Leave this group? You will be able to join or create another one."
                >
                  Leave group
                </SubmitButton>
              </ActionForm>
            ) : null}
            {isOwner || user.role === "ADMIN" ? (
              <ActionForm action={deleteGroupAction}>
                <input type="hidden" name="group_id" value={group.id} />
                <SubmitButton
                  className="danger"
                  confirm="Delete this group along with all of its posts and feedback? This cannot be undone."
                >
                  Delete group
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
