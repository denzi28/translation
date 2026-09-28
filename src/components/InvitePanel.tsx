"use client";

import { useActionState, useEffect, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { inviteStudentAction } from "@/lib/actions/groups";
import type { FormState } from "@/lib/actions/auth";

export type InviteCandidate = { id: string; name: string; email: string | null; invited: boolean };
type Notice = { kind: "ok" | "error"; text: string } | null;

/**
 * The "Invite a classmate" list. Each row sends its own invitation, but the
 * outcome is reported once, at the top of the section, so a row never
 * grows a message that pushes its button out of line. A classmate already
 * invited by this group is marked as such instead of offering a second
 * invitation.
 */
export default function InvitePanel({
  groupId,
  candidates,
  search,
  pager,
  empty,
}: {
  groupId: string;
  candidates: InviteCandidate[];
  search: React.ReactNode;
  pager: React.ReactNode;
  empty: string;
}) {
  const [notice, setNotice] = useState<Notice>(null);

  // Paging and searching come back to #invite, but the page streams in after
  // its loading skeleton, so the browser's own jump to the anchor happens
  // before the list exists. Make it once the list is here.
  useEffect(() => {
    if (window.location.hash === "#invite") {
      document.getElementById("invite")?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, []);

  return (
    <div className="invite-panel">
      <div role="status" aria-live="polite">
        {notice ? (
          <p className={`alert ${notice.kind === "ok" ? "ok" : "error"} invite-notice`}>{notice.text}</p>
        ) : null}
      </div>
      {search}
      {candidates.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ul className="plain invite-list">
          {candidates.map((candidate) => (
            <InviteRow key={candidate.id} groupId={groupId} candidate={candidate} onResult={setNotice} />
          ))}
        </ul>
      )}
      {pager}
    </div>
  );
}

const EMPTY: FormState = {};

function InviteRow({
  groupId,
  candidate,
  onResult,
}: {
  groupId: string;
  candidate: InviteCandidate;
  onResult: (notice: Notice) => void;
}) {
  const [state, formAction] = useActionState(inviteStudentAction, EMPTY);

  useEffect(() => {
    if (state.ok) onResult({ kind: "ok", text: `Invitation sent to ${candidate.name}.` });
    else if (state.error) onResult({ kind: "error", text: `${candidate.name}: ${state.error}` });
  }, [state, candidate.name, onResult]);

  return (
    <li className="spread invite-row">
      <div>
        <strong>{candidate.name}</strong>
        {candidate.email ? <div className="tiny muted">{candidate.email}</div> : null}
      </div>
      {candidate.invited ? (
        <span className="badge invited" title="Waiting for them to accept">Invited</span>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="user_id" value={candidate.id} />
          <SubmitButton className="small" pendingLabel="Inviting…">Invite</SubmitButton>
        </form>
      )}
    </li>
  );
}
