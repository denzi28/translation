"use client";

import { useActionState } from "react";
import { loginAction, registerAction, type FormState } from "@/lib/actions/auth";
import SubmitButton from "./SubmitButton";

const EMPTY: FormState = {};

export function LoginForm() {
  const [state, action] = useActionState(loginAction, EMPTY);
  return (
    <form action={action}>
      {state.error ? <p className="alert error">{state.error}</p> : null}
      <label className="field">
        <span>Email (students) or username (staff)</span>
        <input name="identifier" autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, EMPTY);
  return (
    <form action={action}>
      {state.error ? <p className="alert error">{state.error}</p> : null}
      <label className="field">
        <span>Full name</span>
        <input name="full_name" autoComplete="name" required autoFocus />
      </label>
      <label className="field">
        <span>Student number</span>
        <input name="student_number" inputMode="numeric" required />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password (min. 8 characters)</span>
        <input type="password" name="password" autoComplete="new-password" required />
      </label>
      <label className="field">
        <span>Confirm password</span>
        <input type="password" name="confirm" autoComplete="new-password" required />
      </label>
      <p className="tiny muted" style={{ marginBottom: 12 }}>
        Your name appears across the app as <strong>Full Name (Student Number)</strong>.
      </p>
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}
