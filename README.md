# IUC Translation Community

A course workspace for İstanbul University-Cerrahpaşa where students form small groups, write and publish a group blog
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

### Registering

Students sign up with a university address: the domain must be `iuc.edu.tr` or
a subdomain of it, so `…@ogr.iuc.edu.tr` is accepted and a personal address is
refused with a reminder of what to use. The check is a **domain suffix** test,
not a substring one — `iuc.edu.tr.example.com` contains the string but is not a
university address, and is rejected.

The rule applies at sign-up only. Accounts created before it existed keep
working, since signing in does not re-check the domain.

A rejected sign-up hands the form back with the name, student number and email
still filled in; only the two password boxes are cleared, so a typo in the
confirmation costs one field, not the whole form. The same applies to a failed
sign-in, which keeps the email typed.

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
posts(id, group_id, title, pronunciation, category,      -- one word per entry
      definition, context_notes, examples, attempts,
      why_untranslatable, content_html, status, …)       -- DRAFT | PUBLISHED
feedback(id, group_id, post_id, author_id, grade, comment, created_at)
guidelines(id = 1, filename, mime_type, byte_size, data) -- the single course PDF
```

## Branding

The name lives in `src/lib/site.ts` and is used by the browser tab, the header
and the footer. The logo is one artwork, `public/logo.png`, from which
`src/app/icon.png` (the tab icon, picked up automatically by Next) and
`src/app/apple-icon.png` (the iOS home-screen icon, given a solid background
because Apple composites transparency onto black) are derived.

The tab title scrolls. It holds still in background tabs — where browsers
throttle timers and a moving title is hard to pick out of a crowded tab strip —
and under `prefers-reduced-motion`. Every space in the moving strip is
non-breaking, because browsers trim and collapse ordinary whitespace in a title
and the text would otherwise jump a character each time a space reached an end.

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

## Light and dark

Both themes are one set of custom properties, redefined under
`:root[data-theme="dark"]`; no component knows which theme is running. The
switch floats in the bottom-right corner: a gold sun whose rays retract into a
pale crescent, with a pair of vines unfurling around the dial on every change —
drawn by animating `stroke-dashoffset`, so the line really does grow from its
stem. Where the browser supports view transitions, the new palette arrives as a
circle spreading from the button itself; elsewhere it simply swaps. Both
effects are skipped under `prefers-reduced-motion`.

The starting theme follows the operating system until the reader chooses,
after which the choice is remembered. An inline script in the root layout sets
`data-theme` before the first paint, so the page is never drawn in one palette
and repainted in the other.

## Classical theme (preview)

A Greek look for the whole site: limestone by day, a lamplit colonnade by
night. **It is on preview: only admins see it.** Teachers and students keep the
current design and download none of its images or fonts.

- **Columns.** Two Ionic columns stand in the page margins on screens 1340px
  and wider, carrying the header like an entablature, with a Greek key frieze
  between them. Each column has a bronze lantern on a bracket; in the dark
  theme the columns fade to moonlight, the lanterns light, and their glow
  breathes slowly on the wall behind. Phones and tablets get the palette and
  the type only, since they have no margins to stand the columns in.
- **Rendered, not drawn.** The columns are a real 3D model (`scripts/colonnade`,
  three.js) lit by sun and by moon and lantern, rendered to five stacked pieces:
  capital, shaft, lantern section, shaft, base. The shaft piece is a tile that
  repeats, so a column fits any window height without stretching, and every
  join is blended to the tile's exact pixels so none can show. The whole set is
  about 90KB for both themes. To change the column, edit `scene.js` and run
  `render.mjs` then `process.mjs` (instructions at the top of `render.mjs`).
- **Type.** Headings, including group names and entry titles, are set in
  Cormorant Garamond, which has the full Turkish alphabet. Cinzel, drawn from
  Roman inscriptions, is used only for fixed text such as the site name: it has
  capitals only, so it would show a student's "ı" and "i" the same. Body text,
  forms and everything students write stay in the existing sans-serif.

**To ship it to everyone:** in `src/app/(app)/layout.tsx` set `classic` to
`true`, and in `src/lib/fonts.ts` turn `preload` back on for both fonts.

## Entries

One word is one entry, and one entry is one blog post — ten words means ten
posts. Every post is written into a fixed mould, defined once in
`src/lib/entry.ts`:

**Word** (plus optional pronunciation) · **Category** · **Definition** ·
**Context** · **Examples** · **Attempts** · **Why untranslatable**

Each box shows the model entry from the course brief as grey ghost text, which
disappears as soon as the student types. A draft can be saved half-written, but
**publishing is refused until every section is filled in**, and the error names
the sections still blank — the form also shows a live count and a "Still to
write" list so nobody discovers this only at the end.

Below the mould is an optional free-text section, written with the rich-text
editor, for whatever the student wants to add — what surprised them, what they
would ask a native speaker, where they disagree with the usual translation.

Every entry states who posted it, by full name and student number, on the entry
itself, in the group's list and on the dashboard. Where somebody other than the
author last edited it, that is shown too.

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
- `tests/no-long-dashes.mjs` fails if an em dash or en dash appears anywhere in
  the source. It scans the source rather than the rendered page, because a
  student's own entry may legitimately contain one and that is their writing.
- `tests/theme.mjs` checks that the system preference is honoured until the
  reader chooses, that the choice then wins and survives a reload and
  navigation, and that the palette really changes rather than only the
  attribute.
- `tests/registration.mjs` checks that a personal address is refused with a
  useful message, that a lookalike domain is refused too, that both real
  university forms are accepted, and that a refusal keeps everything except the
  passwords.
- `tests/entry-mould.mjs` checks the ghost text is present but submits nothing,
  that publishing an unfinished entry is refused by name, that a half-written
  draft still saves, and that a published entry renders every section and names
  its author.
- `tests/classic.mjs` checks the classical theme: admins get the columns and
  the classical type, teachers and students get neither and download none of
  its files, the columns sit under the frieze and on the bottom of the window
  at every size from 1340px up (including a short window), their pieces meet
  without a gap, they never touch the content or the header links, and the
  lanterns light in the dark theme and go out in the light one.
- `tests/navigation.mjs` checks which tab lights up on each page, and that
  "My group" points straight at the group instead of bouncing through the
  `/my-group` redirect.
- `tests/responsive.mjs` audits every signed-in page at 320/390/768/1280px for
  content wider than the viewport, a layout viewport that grew past the device
  width, tap targets under 32px, the tab bar appearing on the wrong side of the
  900px breakpoint, any navigation item missing or pushed off screen or
  clipped out of the desktop header, two
  top-level blocks sitting close enough to read as one, and cards in the same
  grid row not sharing a top edge.

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npm start          # in another shell
node tests/e2e.mjs                  # BASE_URL=… to target a deployment
node tests/responsive.mjs
node tests/navigation.mjs
node tests/entry-mould.mjs
node tests/registration.mjs
node tests/theme.mjs
node tests/no-long-dashes.mjs     # no browser needed
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
db/0002_entry_fields.sql    the entry mould's columns
scripts/setup-db.mjs        idempotent migration runner
scripts/colonnade/          3D model and render pipeline for the classical theme's columns
public/colonnade/           the rendered column pieces, day and night
src/app/(app)/…             signed-in pages: dashboard, groups, posts, guidelines, evaluations, admin
src/app/api/guidelines/file serves the course PDF to signed-in users
src/components/             editor, feedback panel, form helpers
src/lib/                    db pool, auth, queries, server actions, sanitiser
```
