# Balance Planner — Executive Summary

## The problem

Most scheduling tools are built for meetings. They're excellent at protecting work time and terrible at protecting anything else — gym sessions, gaming nights, time with a partner all get treated as optional, and quietly lose to whatever work fills the week. The result is a familiar pattern: you reach Friday having been "productive," but you didn't do any of the things that actually made the week feel worth living.

## The idea

Balance Planner is a personal scheduling assistant that treats non-work time as a real commitment, not whatever's left over. Instead of just tracking what you *have* to do, it asks what you *want* your week to include — gaming, a date night, the gym — and uses Claude to build a draft week that fits those alongside your existing obligations. You approve or adjust the draft; nothing gets scheduled without you signing off.

At the end of the week, it checks in: what actually happened? Over time, that feedback lets the system learn your real patterns — not generic scheduling advice, but "you keep missing gym on Tuesdays, here's why that might be" — instead of a one-size-fits-all planner pretending everyone's week looks the same.

## How it works, in brief

- **Plan the week** — you state what matters to you this week; Claude drafts a schedule around your existing commitments and stated priorities; you approve or revise it.
- **Check in** — at week's end, you mark what actually happened. This isn't optional busywork — it's the data the system needs to get better.
- **Learn over time** — a background recommendation engine looks for patterns across multiple weeks (not just one) and surfaces them as suggestions, once there's enough history to say something meaningful rather than generic.

The product deliberately stays narrow: a curated set of categories (work, social, gaming, fitness, chores) rather than an infinitely configurable all-in-one system. It's designed to know what it's for.

## Origin and philosophy

This project started from advice to build something genuinely useful to its own creator first, rather than a generic tool aimed at an abstract user — the theory being that a real, specific pain point produces a better product than a hypothetical one, and that the right shape for the product will emerge from actually using it rather than being fully speculated up front. It's explicitly meant to start small and evolve as real use reveals what it actually needs to become.

## Current status

**v1 is complete** (2026-08-17). The full core loop is built and verified live, end to end, with a real account: Google sign-in, onboarding, a Claude-drafted weekly plan the user approves or adjusts, correct per-user timezone handling, a weekly check-in, and a recommendation engine that gives generic tips in week one and genuinely personalized, pattern-aware suggestions once it has a few weeks of history. See `diagrams/*.mmd` for the full design and `documents/roadmap.md` for what's next.

v2 work is now underway: the scheduler/reminder worker that automates check-in creation and notifications (the one piece of the original design not yet built), prompt tuning, visual design, and a backlog of further features. See `documents/roadmap.md` for the current phase breakdown.

## Where this could go

Today, this is a single-user tool. If the underlying idea holds up under real use — that people will engage with a system that protects their non-work time as seriously as their work time — the natural next step is opening it up beyond one user, at which point the multi-tenant groundwork already in the design (accounts, per-user preferences, hosted infrastructure) starts to matter rather than being over-engineering for a personal project.
