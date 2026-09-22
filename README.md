# Classroom Blog

A course workspace where students form small groups, write and publish a group blog
with a Word-style editor, read the project guidelines PDF, and receive private
grades and feedback from the teacher.

## Stack

| Layer     | Choice                                                    |
| --------- | --------------------------------------------------------- |
| Framework | Next.js 15 (App Router, React 19, Server Actions)          |
| Language  | TypeScript                                                 |
| Database  | PostgreSQL (Supabase), accessed with `pg` over the pooler  |
| Auth      | Own session table + `scrypt` password hashing, HTTP-only cookie |
| Editor    | `contentEditable` + `execCommand` toolbar, server-side sanitised with `sanitize-html` |
| Styling   | One hand-written mobile-first stylesheet, no CSS framework            |
| Hosting   | Vercel                                                     |

Everything lives in the `app` Postgres schema, which is deliberately **not**
exposed through Supabase's public REST API — the Next.js server is the only
client and connects as a dedicated `app_user` role.

## Roles

| Role      | Sign in with | Can do                                                             |
| --------- | ------------ | ------------------------------------------------------------------ |
| `STUDENT` | email        | Create/join one group, write and publish that group's blog, read every published blog, read the guidelines |
| `TEACHER` | username     | Read every group blog, leave private grades (0–100) and comments     |
| `ADMIN`   | username     | Everything a teacher can, plus account and group management, and the guidelines upload |

### Pre-seeded accounts

| Role    | Username       | Password           |
| ------- | -------------- | ------------------ |
| Teacher | `devrim.gunay` | `devrim.gunay.123` |
| Admin   | `admin323123`  | `admin323321`      |

Both are inserted by `db/0001_init.sql`, so they exist as soon as the schema is
applied.

## Key rules, and where they are enforced

- **A student belongs to at most one group** — `unique (user_id)` on
  `app.group_members`, so the database rejects a second membership outright.
- **A group holds 1–5 members** — the `group_members_capacity` trigger rejects a
  sixth insert; the UI hides invite controls once a group is full. Leaving the
  last place empty deletes the group rather than leaving a 0-member one.
- **Only group members may write** — every mutation in `src/lib/actions/posts.ts`
  re-checks membership server-side; the editor route redirects non-members.
- **Drafts stay inside the group** — unpublished posts are filtered out of every
  listing and 404 for outsiders, staff included.
- **Feedback is private** — `canSeeFeedback` allows only staff and the members of
  the target group, so a student never sees another team's grade or critique.
- **A grade is optional** — the teacher can leave written feedback on its own,
  a grade on its own, or both; only a completely empty submission is rejected.
  Entries carrying no grade are labelled "Comment only", and a group that has
  been commented on but not marked reads as such rather than as ungraded.
- **Post HTML is sanitised on the server** — `sanitizePostHtml` runs on every
  save with an allowlist matching what the toolbar emits; `<script>`, event
  handlers, `<iframe>` and `javascript:` URLs are removed.

## Data model

```
users(id, role, email, username, full_name, student_number, password_hash)
sessions(token, user_id, expires_at)
groups(id, name, description, invite_code, created_by)
group_members(group_id, user_id UNIQUE, is_owner)        -- 1 group per student
group_requests(id, group_id, user_id, kind, status)      -- invites + join requests
posts(id, group_id, title, content_html, status, …)      -- DRAFT | PUBLISHED
feedback(id, group_id, post_id, author_id, grade, comment, created_at)
guidelines(id = 1, filename, mime_type, byte_size, data) -- the single course PDF
```

## Interface

The stylesheet is mobile-first and widens at 900px:

- **Phones** get a compact header (wordmark, your identity, sign out) and a
  fixed bottom tab bar for navigation, so the main destinations stay under your
  thumb instead of stacking into a tall wrapped menu.
- **Tables** (the admin account and group lists) turn into labelled cards below
  900px rather than scrolling off the side of the screen.
- **The guidelines PDF** embeds inline on desktop; phones, whose browsers
  mostly refuse to embed a PDF, get an open/save card instead of a blank frame.
- Tap targets are at least 32px, inputs render at 16px so iOS Safari does not
  zoom on focus, and `env(safe-area-inset-*)` keeps content clear of notches.
- `overflow-wrap: anywhere` on the body stops a single long unbreakable token —
  an email address, an invite code, a made-up word in a post — from setting the
  page's minimum content width. Left unguarded, the browser widens the *layout
  viewport* past the screen, and everything fixed to the viewport (the tab bar)
  hangs off the right edge with its last item out of reach. The tab bar is also
  a grid of `minmax(0, 1fr)` columns, which can never overflow its container,
  and the footer repeats the same links as a second route to every section.

Motion is deliberate and cheap: page blocks fade and rise in sequence, cards
lift on hover, buttons press, alerts pop, the save indicator changes colour, and
pages show a shimmering skeleton while they stream. Everything is disabled under
`prefers-reduced-motion`, and the header and tab bar are opaque rather than
blurred because `backdrop-filter` repaints on every scroll frame and janks on
low-end phones.

## Editor

The toolbar covers the required feature set: **bold, italic, underline,
strikethrough**, **H1/H2/H3** (plus paragraph, quote and code block), **bulleted
and numbered lists**, a **font family** picker, **font sizes**, and **left /
centre / right / justify** alignment, with link insertion, clear-formatting and
undo/redo. Pasting is forced to plain text so foreign markup never enters a post.

## Running it locally

```bash
npm install

# 1. Point at a Postgres database and create the schema + seeded accounts.
export DATABASE_URL='postgresql://postgres@127.0.0.1:5432/postgres?sslmode=disable'
npm run db:setup

# 2. Start the app.
npm run dev            # http://localhost:3000
```

`npm run db:setup` must run as a role that may create schemas (for example
`postgres`); the application itself connects as the lower-privilege `app_user`.

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`, and
`npx tsx scripts/check-sanitizer.ts` to see what the sanitiser keeps and drops.

### Tests

Two browser-driven suites:

- `tests/e2e.mjs` walks the whole flow — registration, group formation up to and
  past the 5-member limit, the editor, publishing, read-only access from another
  group, feedback privacy and the guidelines PDF.
- `tests/navigation.mjs` checks which tab lights up on each page, and that
  "My group" points straight at the group instead of bouncing through the
  `/my-group` redirect.
- `tests/responsive.mjs` audits every signed-in page at 320/390/768/1280px for
  content wider than the viewport, a layout viewport that grew past the device
  width, tap targets under 32px, the tab bar appearing on the wrong side of the
  900px breakpoint, and any navigation item missing or pushed off screen.

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npm start          # in another shell
node tests/e2e.mjs                  # BASE_URL=… to target a deployment
node tests/responsive.mjs
node tests/navigation.mjs
```

`e2e.mjs` creates real students, groups and posts, so point it at a scratch
database. Both suites drive several browser contexts at once and can time out on
a heavily loaded or still-warming machine; re-run before treating a lone failure
as real.

## Deploying

**Run the functions in the same region as the database.** `vercel.json` pins
them to `fra1` (Frankfurt) to match the Supabase project in `eu-central-1`.
Left on the default `iad1` (Washington DC) every query crossed the Atlantic at
roughly 100ms, and a page that made seven of them took seconds to open. Change
one and change the other. `GET /api/health` reports the round-trip time and the
region it ran in, which is the quickest way to check.

The only required environment variable is `DATABASE_URL`. On Supabase use the
**connection pooler** string (port 6543) so the serverless functions do not need
IPv6:

```
postgresql://app_user.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

The cluster prefix differs per project (`aws-0-…` or `aws-1-…`); the wrong one
answers with `tenant/user … not found`. `GET /api/health` reports whether the
deployed server can reach the database, which is the quickest way to tell.

Apply `db/0001_init.sql` once against the project (via `npm run db:setup` or the
Supabase SQL editor), then deploy.

## Project layout

```
db/0001_init.sql            schema, constraints, triggers and seeded accounts
scripts/setup-db.mjs        idempotent migration runner
src/app/(app)/…             signed-in pages: dashboard, groups, posts, guidelines, evaluations, admin
src/app/api/guidelines/file serves the course PDF to signed-in users
src/components/             editor, feedback panel, form helpers
src/lib/                    db pool, auth, queries, server actions, sanitiser
```
