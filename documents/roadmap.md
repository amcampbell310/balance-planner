# Balance Planner — Roadmap

Status as of 2026-08-17: the v1 core loop is fully built and verified live end-to-end — Google OAuth login, onboarding, Claude-drafted weekly plans, approval with correct per-user timezone handling, check-in, and both the generic-tip and personalized-suggestion recommendation paths. See `prisma/schema.prisma` and `diagrams/*.mmd` for the current data model and flows.

This doc tracks what's next. Phases are roughly sequential; the backlog isn't.

## Phase 1 — Scheduler / Reminder Worker

The only major piece of the original design not yet built. Nothing currently creates `CheckIn` rows or sends notifications automatically — both have been seeded/tested by hand so far.

- Weekly job that creates a `PENDING` `CheckIn` for every onboarded user at their week's end (this replaces the manual `psql` seeding used during testing).
- `CHECK_IN_REMINDER` notification — the core loop's always-on reminder.
- `DRAFT_PENDING` notification — nudge if a `WeeklyPlan` sits unapproved.
- `RE_ENGAGEMENT` notification — after ~14 days inactive, suppressed for 30 days after firing (already spec'd in `prisma/schema.prisma`'s `NotificationType` comment).
- Anti-spam throttle: check the `Notification` log before sending `DRAFT_PENDING` or `RE_ENGAGEMENT` — hold off if the user got anything in the last 7 days.
- Multi-week `PATTERN_INSIGHT` trend analysis — `analyzeTrends()` already exists in `src/backend/claude.ts` (Haiku 4.5) but isn't wired into anything yet. This is the job that should call it.
- Pick an email provider and wire actual delivery (nothing sends real email yet).
- Decide how this actually runs: a persistent Node process (matches the already-decided Railway hosting plan) vs. a scheduled Railway cron — worth a quick real decision, not just an assumption.

## Phase 2 — Prompt Tuning

Both Claude prompts have now produced real output to evaluate against, not just spec.

- `generateWeeklyDraft` — review against the actual drafts generated so far; tune for edge cases (no stated priorities, conflicting existing items, empty `selectedCategories`).
- `generateMissedItemSuggestion` — already produced one genuinely good, specific suggestion; worth a systematic pass (few-shot examples, tone) rather than one-off luck.
- Worth deciding now: a lightweight eval set (a handful of realistic scenario inputs you re-run after every prompt change) beats eyeballing one draft at a time.

## Phase 3 — Styling, Animation & Reminder Emails

- Replace the current bare functional CSS (`src/app/globals.css`) with a real visual identity — palette, type, layout — the app has none yet beyond "it works."
- Two backend-complete, frontend-missing features naturally belong in this pass (flagging for you to place, not assuming):
  - **Manual plan-item entry/edit/delete UI** — `POST /api/plan-items` and `/api/plan-items/[id]` fully support this; no form exists.
  - **Recommendations list + dismiss/acted-on UI** — `Recommendation.status` and `/api/recommendations` fully support this; right now a recommendation only ever flashes once on the check-in screen and is never seen again.
- Reminder email templates/design — depends on Phase 1's provider choice; HTML email has its own constraints (inlined CSS, table layout) worth planning for up front rather than retrofitting.
- Micro-interactions for the check-in and approval flows.

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
