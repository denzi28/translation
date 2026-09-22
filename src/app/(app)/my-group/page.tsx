import Link from "next/link";
import { redirect } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import {
  cancelRequestAction,
  createGroupAction,
  joinByCodeAction,
  respondToInviteAction,
} from "@/lib/actions/groups";
import { getCurrentUser, getMyGroupId, isStaff } from "@/lib/auth";
import { MAX_MEMBERS, MIN_MEMBERS } from "@/lib/constants";
import { listGroups, myOutgoingRequests, pendingForUser } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MyGroupPage() {
  const user = (await getCurrentUser())!;
  if (isStaff(user)) redirect("/groups");

  const myGroupId = await getMyGroupId(user.id);
  if (myGroupId) redirect(`/groups/${myGroupId}`);

  const invites = await pendingForUser(user.id);
  const outgoing = await myOutgoingRequests(user.id);
  const groups = await listGroups();
  const openGroups = groups.filter((g) => g.member_count < MAX_MEMBERS);

  return (
    <>
      <div className="page-head">
        <h1>Find your group</h1>
        <p className="lede">
          A group has between {MIN_MEMBERS} and {MAX_MEMBERS} members, and you can belong to only one
          group at a time.
        </p>
      </div>

      {invites.length > 0 ? (
        <section className="card">
          <div className="card-title"><h2>Invitations waiting for you</h2></div>
          <ul className="plain">
            {invites.map((invite) => (
              <li key={invite.id} className="spread">
                <div>
                  <strong>{invite.group_name}</strong>
                  <div className="tiny muted">Invited {formatDateTime(invite.created_at)}</div>
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
        <section className="card">
          <div className="card-title"><h2>Create a group</h2></div>
          <ActionForm action={createGroupAction} className="stack">
            <label className="field" style={{ margin: 0 }}>
              <span>Group name</span>
              <input name="name" placeholder="e.g. Team Aurora" required minLength={3} maxLength={60} />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Short description (optional)</span>
              <textarea name="description" placeholder="What is your project about?" />
            </label>
            <div>
              <SubmitButton pendingLabel="Creating…">Create group</SubmitButton>
            </div>
            <p className="tiny muted" style={{ margin: 0 }}>
              You become the owner and can invite up to {MAX_MEMBERS - 1} classmates.
            </p>
          </ActionForm>
        </section>

        <section className="card">
          <div className="card-title"><h2>Join with an invite code</h2></div>
          <ActionForm action={joinByCodeAction} className="stack">
            <label className="field" style={{ margin: 0 }}>
              <span>Invite code</span>
              <input name="invite_code" placeholder="e.g. 9F3A21BC" className="mono" required />
            </label>
            <div>
              <SubmitButton pendingLabel="Joining…">Join group</SubmitButton>
            </div>
          </ActionForm>

          {outgoing.length > 0 ? (
            <>
              <hr className="rule" />
              <h3>Your pending requests</h3>
              <ul className="plain">
                {outgoing.map((request) => (
                  <li key={request.id} className="spread">
                    <span>{request.group_name}</span>
                    <ActionForm action={cancelRequestAction}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <SubmitButton className="small">Withdraw</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>

      <section className="card">
        <div className="card-title">
          <h2>Groups with room left</h2>
          <Link className="small" href="/groups">See all groups</Link>
        </div>
        {openGroups.length === 0 ? (
          <p className="empty">Every existing group is full — create your own.</p>
        ) : (
          <ul className="plain">
            {openGroups.map((group) => (
              <li key={group.id} className="spread">
                <div>
                  <Link href={`/groups/${group.id}`}><strong>{group.name}</strong></Link>
                  <div className="tiny muted">
                    {group.member_count}/{MAX_MEMBERS} members · owner {group.owner_name}
                  </div>
                </div>
                <Link className="btn small" href={`/groups/${group.id}`}>View &amp; request to join</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
