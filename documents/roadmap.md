# Balance Planner — Roadmap

Status as of 2026-08-17: the v1 core loop is fully built and verified live end-to-end — Google OAuth login, onboarding, Claude-drafted weekly plans, approval with correct per-user timezone handling, check-in, and both the generic-tip and personalized-suggestion recommendation paths. See `prisma/schema.prisma` and `diagrams/*.mmd` for the current data model and flows.

This doc tracks what's next. Phases are roughly sequential; the backlog isn't.

## Phase 1 — Scheduler / Reminder Worker ✅ complete (2026-08-18)

Built as the full Redis-queue architecture from the original diagrams (BullMQ), not a simplified single-script version — a deliberate choice to match the diagrammed design now rather than defer it. Runs as one persistent process (`npm run worker`, `src/worker/index.ts`), matching the already-decided Railway hosting plan.

- Four BullMQ queues (`src/backend/queue.ts`), each with one repeatable "sweep" producer (`src/worker/scheduler.ts`) rather than a literal per-user cron entry per the diagrams — per-user/timezone-awareness lives in each job's own eligibility logic instead (using `User.timezone`/`weekStartDay`), which avoids maintaining N schedules that shift on every onboarding/timezone change. `checkin-reminder` sweeps every 15 min; `draft-pending`, `inactivity`, `trend-refresh` sweep daily.
- `src/backend/jobs/checkInReminder.ts` — creates `PENDING` `CheckIn`s and sends `CHECK_IN_REMINDER`. Scans a bounded 8-week lookback (not just "last week"), so it self-heals and catches up correctly if the worker was ever offline — consolidated into one email per user per sweep even if several weeks piled up at once, never a burst.
- `src/backend/jobs/draftPending.ts` — `DRAFT_PENDING`, once per `WeeklyPlan`, respecting the 7-day anti-spam throttle.
- `src/backend/jobs/inactivity.ts` — `RE_ENGAGEMENT` after 14 days inactive, 30-day resuppression, same 7-day throttle.
- `src/backend/jobs/trendRefresh.ts` — wires `analyzeTrends()` (previously unused) into the `PATTERN_INSIGHT` recommendation type, ~14-day refresh cadence, 16-week bounded history lookback.
- Email via Resend (`src/backend/email.ts`) — live and verified.
- Redis runs locally via Docker on port 6380 (6379 was already taken by an unrelated project's container on this machine).

**Verified live**, not just typechecked: the real running worker autonomously fired its first trend-refresh sweep and generated a genuine, accurate insight ("Game Night with Friends... consistently missed... across all four weeks") via a real Haiku 4.5 call. Every job's positive path and its "correctly does nothing" path were exercised by hand against seeded scenarios, including confirming the anti-spam throttle actually suppresses one job type when another just fired for the same user. A real test email was sent and confirmed received.

**Known gap, deliberately deferred**: no retry/dead-letter handling beyond BullMQ's defaults, and the `every`-based sweep intervals are a simplification of "per-user timezone-aware cron" (see above) — revisit if this ever needs tighter timing precision than "within 15 minutes of a boundary."

## Phase 2 — Prompt Tuning (in progress, first pass done 2026-08-18)

Built `scripts/eval-prompts.ts` (`npm run eval:prompts`) — 5 `generateWeeklyDraft` scenarios (normal case, empty priorities, single selected category, packed schedule, overlapping/inconsistent existing items) and 3 `generateMissedItemSuggestion` scenarios (no history, clear pattern, unhelpful statusNote), re-run after every prompt change instead of eyeballing one draft at a time.

First pass found two real issues, both fixed and re-verified live in `src/backend/claude.ts`:
- **Bug**: with `selectedCategories: ["WORK"]`, the model proposed SOCIAL and GAMING items anyway — direct violation of the system prompt's existing "only use categories from the user's selected set" instruction. Prompt wording alone wasn't reliable enough, so added a **programmatic backstop**: `generateWeeklyDraft` now filters `items` down to `selectedCategories` before returning, regardless of what the prompt achieves. Worth remembering as a general pattern: don't trust a "hard constraint" phrased only in the system prompt for anything the schema is supposed to guarantee — verify it eval-style, and enforce anything that matters in code.
- **Quality**: empty/vague priorities produced a maximalist, presumptuous 15-item week filling every day. Added explicit guidance to propose a light, modest week in that case instead — re-verified live, now produces ~5 well-chosen items.

`generateMissedItemSuggestion` held up well across all three scenarios with no changes needed. Remaining for this phase: `analyzeTrends` doesn't have eval coverage yet; consider adding a couple of scenarios once there's a natural reason to touch that prompt again.

## Phase 3 — Styling, Animation & Reminder Emails ✅ complete (2026-08-18 – 2026-08-23)

- ✅ Real visual identity in `src/app/globals.css` — "evening planner" concept (warm blush/plum tones, not the generic cream-and-terracotta AI-design cliché), Fraunces/Karla type pairing, muted tonal category colors, both light and dark themes (system-aware).
- ✅ **Real navigation added, beyond the original plan** — the app previously had no way to leave the current week's locked-in view at all (a real gap the user caught mid-build, not something the original phases anticipated). Now: a hamburger-triggered slide-out sidebar (`src/frontend/components/Sidebar.tsx`), route restructure into `src/app/(app)/` (`/home` — landing page with the current week embedded directly plus a recent-recommendations preview; `/this-week` — the same current-week view standalone; `/weeks` + `/weeks/[weekOf]` — browsable read-only history), with gating centralized in `src/backend/gate.ts` (`requireOnboardedUser()`) so every route under the group is protected the same way whether reached via `/` or a direct URL.
- ✅ **Settings page added** (`/settings`) — preference editing (reuses `POST /api/onboarding`, which already validated/updated exactly these fields) plus a real account-deletion flow (`DELETE /api/account`, two-step confirmation UI). Building this surfaced a real, separate bug: a soft-deleted account's session wasn't actually being treated as logged out anywhere — fixed in `src/backend/auth.ts`'s `session` callback, which is now the single enforcement point (see `deletedAt` note in memory).
- ✅ **Custom `Select` component** (`src/frontend/components/Select.tsx`) replacing native `<select>` — native dropdown popups can't be reliably restyled cross-browser (the "bright white against a dark theme" problem), so this is a fully custom, themed dropdown with a curated (~40-entry, not the full ~400-zone IANA list), region-grouped timezone picker using real regional convention (`Intl` `timeZoneName: "short"` — letter abbreviations like PDT/EST where that's the actual convention, GMT+X offset everywhere else, verified empirically rather than assumed).
- ✅ **Home is now a real calendar view** (2026-08-19/22) — the backlog item below is done, well ahead of where Phase 3 originally expected it. `CalendarWeekView.tsx`: time-grid (time horizontal, days vertical — swapped from an initial vertical-time version after collision-splitting made overlapping items unreadable there), click-and-drag to create, drag-to-resize, click-to-info popover, real interval-graph collision layout, percentage-based positioning (fits all 24 hours on wide screens, falls back to fixed-width + scroll below an 860px breakpoint, no JS branching needed). `/home` now serves both the current week (interactive) and any past week (read-only) via `?week=`; `/this-week` and `/weeks/[weekOf]` are thin redirects into it.
- ✅ **Manual plan-item entry + scoped deletion UI** — was flagged as backend-complete/frontend-missing; now built. `AddPlanItemForm` is a popover (day-of-week pills, native start time, a 15-minute-increment duration `Select` rather than a raw end-time field). `DELETE /api/plan-items/[id]` (new) only allows manually-added (`source === "MANUAL"`) items on the current week — Claude's approved plan and all past-week history stay permanently read-only.
- ✅ **"Week at a glance" view** — a toggleable, simpler read-only per-day list next to the recommendations aside, for a fast read of the week without the time-grid. Deliberately read-only (no add/delete) — the calendar is the one place for editing.
- Deferred, no timeline: a "fun animated way to show the week at a glance" — floated during the glance-view work, explicitly tabled rather than designed.
- ✅ **Recommendations list + dismiss/acted-on UI** (`/recommendations`, `src/frontend/components/RecommendationsList.tsx`) — Active/History tabs (reusing the calendar's toggle pattern), dismiss and "mark acted on" actions wired into the already-built `GET`/`PATCH /api/recommendations`. `PATTERN_INSIGHT`-type recommendations get a small quiet tag distinguishing them from the more common per-item `WEEKLY_SUGGESTION` type; the same tag was backfilled into the Home "Recent suggestions" preview for consistency.
- ✅ **Micro-interactions for check-in and approval** — a focused set, not blanket animation: a tactile "pop" when picking DONE/MISSED/SKIPPED, a rise-in entrance for the optional note field, a rise-in reveal for the check-in result screen, and a "pop" on the "Locked in" status pill when a draft gets approved. All respect `prefers-reduced-motion`, reusing the pattern the existing list fade-in already established.
- ✅ **Reminder email templates/design** — real HTML templates via `@react-email/components` (Resend's own recommended library) rather than hand-rolled table/inline-CSS HTML, matching the same "use a real library" lesson the icon-SVG saga taught earlier. One shared `ReminderEmail` template (`src/backend/emails/ReminderEmail.tsx`) reused across all three notification types, styled with the app's real light-theme hex values (email dark-mode support is too inconsistent across clients to target) and safe font fallbacks. `sendEmail()` now sends both the rendered HTML and a plain-text fallback. New `APP_URL` env var so email CTAs can link back into the app from a worker process with no request context of its own. Verified with a real sent-and-received test email, not just typechecked — hit one real install snag along the way (`@react-email/components`'s declared `@react-email/render` dependency didn't actually land in `node_modules`; installed it explicitly).

## Backlog — Potential Future Features

Not phased, no commitment to build:

- ✅ ~~Historical/past-weeks view~~ — built in Phase 3 (`/weeks` + `/weeks/[weekOf]`).
- ✅ ~~Home as a real calendar view~~ — built, see Phase 3 above.
- Google Calendar sync (already deferred to v2 in the original design).
- Microsoft and Apple OAuth (Google-only for now).
- Credentials (email + password) sign-in alongside OAuth (already discussed, deferred).
- Scheduled hard-delete purge job for soft-deleted accounts (`User.deletedAt` exists; nothing acts on it yet).
- User data export.
- PWA / mobile home-screen support.
- Actual deployment to Vercel + Railway + Supabase (still entirely local).

## Other suggestions

A few things not on your list that I'd flag before this goes much further:

- **Cost guardrails on Claude-calling routes.** Real billing is live now. Regenerate/draft-generation currently has no rate limit — worth a simple cap (e.g. N regenerations per day) before this is ever used somewhere other than by you alone.
- **A small automated test suite**, starting with `src/backend/week.ts`'s timezone math. That bug was subtle enough in manual testing that it's a good candidate for the first real tests — a regression there would be easy to miss by eye again.
- **Deploy something bare-bones early**, even before Phase 3 is polished. Production tends to surface a different class of problem (env vars, cron scheduling on Railway, email deliverability) than local dev does, and it's cheaper to find those before more is built on top.
