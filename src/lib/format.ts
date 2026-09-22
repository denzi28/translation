/**
 * Dates are rendered in UTC with a fixed locale so the server-rendered markup
 * and the hydrated client markup always agree.
 */
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return `${DATE_TIME.format(new Date(value))} UTC`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return DATE_ONLY.format(new Date(value));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
