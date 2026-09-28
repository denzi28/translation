"use client";

import { useActionState, useRef, useState } from "react";
import { completeProfileAction, staffLoginAction, type FormState } from "@/lib/actions/auth";
import SubmitButton from "./SubmitButton";

const EMPTY: FormState = {};

/** A new student's details, after Google has confirmed their address. */
export function ProfileForm({ googleName }: { googleName: string }) {
  const [state, action] = useActionState(completeProfileAction, EMPTY);
  // React resets an uncontrolled form once the action settles, back to these
  // defaults, so echoing the submitted values here is what keeps them.
  const kept = state.values ?? {};
  return (
    <form action={action}>
      {state.error ? <p className="alert error">{state.error}</p> : null}
      <label className="field">
        <span>Full name</span>
        <input name="full_name" autoComplete="name" required autoFocus defaultValue={kept.full_name ?? googleName} />
      </label>
      <label className="field">
        <span>Student number</span>
        <input name="student_number" inputMode="numeric" required defaultValue={kept.student_number ?? ""} />
      </label>
      <SubmitButton pendingLabel="Creating your account…">Create my account</SubmitButton>
    </form>
  );
}

type StaffRole = "TEACHER" | "ADMIN";
const LABEL: Record<StaffRole, string> = { TEACHER: "Teacher", ADMIN: "Admin" };

function TeacherIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 9 12 4l10 5-10 5z" />
      <path d="M6 11v5c0 1.3 2.7 3 6 3s6-1.7 6-3v-5" />
      <path d="M22 9v6" />
    </svg>
  );
}
function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4 6v6c0 4.4 3.4 8.2 8 9 4.6-.8 8-4.6 8-9V6z" />
      <circle cx="12" cy="11" r="2.2" />
      <path d="M12 13.2V16" />
    </svg>
  );
}

/**
 * Staff sign-in: two buttons in the bottom-left corner of the sign-in page.
 * Each asks only for a password; the button decides the role.
 */
export function StaffLogin() {
  const [role, setRole] = useState<StaffRole | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(staffLoginAction, EMPTY);

  function open(next: StaffRole) {
    setRole(next);
    dialog.current?.showModal();
  }

  return (
    <>
      <div className="staff-doors">
        <button type="button" className="staff-door" onClick={() => open("TEACHER")} aria-label="Teacher sign-in" title="Teacher sign-in">
          <TeacherIcon />
        </button>
        <button type="button" className="staff-door" onClick={() => open("ADMIN")} aria-label="Admin sign-in" title="Admin sign-in">
          <AdminIcon />
        </button>
      </div>
      <dialog ref={dialog} className="staff-dialog" aria-label={role ? `${LABEL[role]} sign-in` : "Staff sign-in"}>
        <form action={action} key={role ?? "none"}>
          <h2>{role ? `${LABEL[role]} sign-in` : "Staff sign-in"}</h2>
          {state.error ? <p className="alert error">{state.error}</p> : null}
          <input type="hidden" name="role" value={role ?? ""} />
          <label className="field">
            <span>Password</span>
            <input type="password" name="password" autoComplete="current-password" required autoFocus />
          </label>
          <div className="row">
            <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
            <button type="button" className="ghost" onClick={() => dialog.current?.close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
