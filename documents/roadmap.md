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

## Phase 3 — Styling, Animation & Reminder Emails (in progress, started 2026-08-18)

- ✅ Real visual identity in `src/app/globals.css` — "evening planner" concept (warm blush/plum tones, not the generic cream-and-terracotta AI-design cliché), Fraunces/Karla type pairing, muted tonal category colors, both light and dark themes (system-aware).
- ✅ **Real navigation added, beyond the original plan** — the app previously had no way to leave the current week's locked-in view at all (a real gap the user caught mid-build, not something the original phases anticipated). Now: a hamburger-triggered slide-out sidebar (`src/frontend/components/Sidebar.tsx`), route restructure into `src/app/(app)/` (`/home` — landing page with the current week embedded directly plus a recent-recommendations preview; `/this-week` — the same current-week view standalone; `/weeks` + `/weeks/[weekOf]` — browsable read-only history), with gating centralized in `src/backend/gate.ts` (`requireOnboardedUser()`) so every route under the group is protected the same way whether reached via `/` or a direct URL.
- ✅ **Settings page added** (`/settings`) — preference editing (reuses `POST /api/onboarding`, which already validated/updated exactly these fields) plus a real account-deletion flow (`DELETE /api/account`, two-step confirmation UI). Building this surfaced a real, separate bug: a soft-deleted account's session wasn't actually being treated as logged out anywhere — fixed in `src/backend/auth.ts`'s `session` callback, which is now the single enforcement point (see `deletedAt` note in memory).
- ✅ **Custom `Select` component** (`src/frontend/components/Select.tsx`) replacing native `<select>` — native dropdown popups can't be reliably restyled cross-browser (the "bright white against a dark theme" problem), so this is a fully custom, themed dropdown with a curated (~40-entry, not the full ~400-zone IANA list), region-grouped timezone picker using real regional convention (`Intl` `timeZoneName: "short"` — letter abbreviations like PDT/EST where that's the actual convention, GMT+X offset everywhere else, verified empirically rather than assumed).
- Two backend-complete, frontend-missing features still flagged for a future pass (not yet built):
  - **Manual plan-item entry/edit/delete UI** — `POST /api/plan-items` and `/api/plan-items/[id]` fully support this; no form exists.
  - **Recommendations list + dismiss/acted-on UI** beyond the Home preview — `Recommendation.status` and `/api/recommendations` fully support dismiss/acted-on; no UI for it yet.
- Reminder email templates/design — depends on Phase 1's provider choice (Resend); HTML email has its own constraints (inlined CSS, table layout) worth planning for up front rather than retrofitting.
- Micro-interactions for the check-in and approval flows (a basic staggered fade-in on list items exists; nothing beyond that yet).

## Backlog — Potential Future Features

Not phased, no commitment to build:

- **Historical/past-weeks view** — right now the app only ever shows "this week"; there's no way to look back at prior plans or check-ins even though the data exists.
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
