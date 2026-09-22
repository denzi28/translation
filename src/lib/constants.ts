/** Groups hold between 1 and 5 students. */
export const MIN_MEMBERS = 1;
export const MAX_MEMBERS = 5;

/**
 * Students register with a university address. Checked as a domain suffix
 * rather than a substring: a plain "contains" test would also accept
 * something like `iuc.edu.tr.example.com`, which is not a university address.
 */
export const UNIVERSITY_EMAIL_DOMAIN = "iuc.edu.tr";

export function isUniversityEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return domain === UNIVERSITY_EMAIL_DOMAIN || domain.endsWith(`.${UNIVERSITY_EMAIL_DOMAIN}`);
}
