import { cookies } from "next/headers";
import type { Role } from "./types";

/**
 * The classical theme is on preview: admins see it, everyone else keeps the
 * current design until it is approved. Shipping it to everyone means making
 * both of these return true.
 */
export function classicFor(role: Role): boolean {
  return role === "ADMIN";
}

/**
 * The sign-in and register pages cannot ask who is looking, so a browser an
 * admin has signed in or out of carries this cookie and gets the theme there
 * too. It changes nothing but the look of those two pages.
 */
export const CLASSIC_PREVIEW_COOKIE = "iuc_classic_preview";

export async function classicSignedOut(): Promise<boolean> {
  return (await cookies()).get(CLASSIC_PREVIEW_COOKIE)?.value === "1";
}

export async function rememberClassicPreview(): Promise<void> {
  (await cookies()).set(CLASSIC_PREVIEW_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
