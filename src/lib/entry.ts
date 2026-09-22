/**
 * The fixed shape of a dictionary entry — the "mould" every post is written
 * into. One entry is one word, and one word is one blog post.
 *
 * The `example` strings are shown as ghost text in the empty form, taken from
 * the model entry in the course brief so a student can see the expected shape
 * before typing anything.
 */
export type EntryFieldName =
  | "definition"
  | "context_notes"
  | "examples"
  | "attempts"
  | "why_untranslatable";

export type EntryField = {
  name: EntryFieldName;
  label: string;
  hint: string;
  example: string;
  rows: number;
};

export const ENTRY_FIELDS: EntryField[] = [
  {
    name: "definition",
    label: "Definition",
    hint: "What does it mean? One or two sentences.",
    example:
      "A kind wish said to someone who is working, hoping their task goes smoothly.",
    rows: 3,
  },
  {
    name: "context_notes",
    label: "Context",
    hint: "Who says it, to whom, and when?",
    example:
      "Said to anyone at work — a shop assistant, a cleaner, a colleague, a student studying — usually on arrival or when leaving.",
    rows: 3,
  },
  {
    name: "examples",
    label: "Examples",
    hint: "Real uses, with a literal gloss in brackets.",
    example:
      "“Hocam, kolay gelsin!” (teacher-my, easy may-come) · “Kolay gelsin usta, çay ister misin?” (easy may-come master, tea want-you?)",
    rows: 5,
  },
  {
    name: "attempts",
    label: "Attempts",
    hint: "Translations you tried, the strategy used, and why each falls short.",
    example:
      "(a) “Take it easy.” — cultural substitution; sounds casual and loses the wish. (b) “Hope the work goes well.” — explicitation; accurate but too long for a quick greeting.",
    rows: 5,
  },
  {
    name: "why_untranslatable",
    label: "Why untranslatable",
    hint: "Name the category, then explain what English is missing.",
    example:
      "Politeness formula. English has no fixed phrase for greeting someone at work; the function exists, the formula does not.",
    rows: 3,
  },
];

export const HEADLINE_EXAMPLES = {
  title: "Kolay gelsin",
  pronunciation: "/ko.laj ɟel.sin/",
  category: "everyday politeness formula",
};

export type EntryValues = Record<EntryFieldName, string> & {
  title: string;
  pronunciation: string;
  category: string;
};

/** The sections that must be written before an entry can be published. */
export const REQUIRED_FOR_PUBLISH: Array<{ key: keyof EntryValues; label: string }> = [
  { key: "title", label: "Word" },
  { key: "category", label: "Category" },
  ...ENTRY_FIELDS.map((field) => ({ key: field.name as keyof EntryValues, label: field.label })),
];

/** Returns the labels of the sections still left blank. */
export function missingSections(values: Partial<EntryValues>): string[] {
  return REQUIRED_FOR_PUBLISH.filter(
    ({ key }) => !String(values[key] ?? "").trim(),
  ).map(({ label }) => label);
}
