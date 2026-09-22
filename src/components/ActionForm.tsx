"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/auth";

const EMPTY: FormState = {};

/**
 * Wraps a server action so any error it returns is rendered next to the form
 * instead of throwing an error page.
 */
export default function ActionForm({
  action,
  children,
  className,
  style,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  return (
    <form action={formAction} className={className} style={style}>
      {state.error ? <p className="alert error">{state.error}</p> : null}
      {state.ok ? <p className="alert ok">{state.ok}</p> : null}
      {children}
    </form>
  );
}
