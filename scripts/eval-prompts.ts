import "dotenv/config";
import { generateWeeklyDraft, generateMissedItemSuggestion, analyzeTrends } from "@/backend/claude";

// Phase 2 prompt-tuning harness (documents/roadmap.md) — a handful of
// realistic scenarios re-run after every prompt change, rather than
// eyeballing one draft at a time in the live UI. Not exhaustive; add cases
// here as new edge cases turn up.

const draftScenarios: Array<{ name: string; input: Parameters<typeof generateWeeklyDraft>[0] }> = [
  {
    name: "normal case (real priorities, real schedule)",
    input: {
      existingItems: [
        { title: "Work Shift", category: "WORK", dayOfWeek: "MONDAY", startTime: "15:15", endTime: "23:45" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "TUESDAY", startTime: "15:15", endTime: "23:45" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "WEDNESDAY", startTime: "15:15", endTime: "23:45" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "SATURDAY", startTime: "14:15", endTime: "22:45" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "SUNDAY", startTime: "14:15", endTime: "22:45" },
      ],
      priorities: "I want to see my girlfriend at least twice and get one solid gaming session in with friends.",
      selectedCategories: ["WORK", "SOCIAL", "GAMING", "FITNESS", "CHORES"],
    },
  },
  {
    name: "empty priorities",
    input: {
      existingItems: [
        { title: "Work Shift", category: "WORK", dayOfWeek: "MONDAY", startTime: "09:00", endTime: "17:00" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "TUESDAY", startTime: "09:00", endTime: "17:00" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "17:00" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "THURSDAY", startTime: "09:00", endTime: "17:00" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "17:00" },
      ],
      priorities: "",
      selectedCategories: ["WORK", "SOCIAL", "GAMING", "FITNESS", "CHORES"],
    },
  },
  {
    name: "single selected category (WORK only)",
    input: {
      existingItems: [
        { title: "Work Shift", category: "WORK", dayOfWeek: "MONDAY", startTime: "09:00", endTime: "17:00" },
      ],
      priorities: "I really want to fit in more gaming and a date night this week.",
      selectedCategories: ["WORK"],
    },
  },
  {
    name: "packed schedule, little room",
    input: {
      existingItems: [
        { title: "Work Shift", category: "WORK", dayOfWeek: "MONDAY", startTime: "06:00", endTime: "22:00" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "TUESDAY", startTime: "06:00", endTime: "22:00" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "WEDNESDAY", startTime: "06:00", endTime: "22:00" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "THURSDAY", startTime: "06:00", endTime: "22:00" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "FRIDAY", startTime: "06:00", endTime: "22:00" },
        { title: "Work Shift", category: "WORK", dayOfWeek: "SATURDAY", startTime: "06:00", endTime: "22:00" },
      ],
      priorities: "I still want to squeeze in a workout and see my friends somehow.",
      selectedCategories: ["WORK", "SOCIAL", "GAMING", "FITNESS", "CHORES"],
    },
  },
  {
    name: "overlapping existing items (data already inconsistent)",
    input: {
      existingItems: [
        { title: "Work Shift", category: "WORK", dayOfWeek: "MONDAY", startTime: "09:00", endTime: "17:00" },
        { title: "Dentist", category: "CHORES", dayOfWeek: "MONDAY", startTime: "15:00", endTime: "16:00" },
      ],
      priorities: "Just want a relaxed week, nothing crazy planned.",
      selectedCategories: ["WORK", "SOCIAL", "GAMING", "FITNESS", "CHORES"],
    },
  },
];

const suggestionScenarios: Array<{
  name: string;
  input: Parameters<typeof generateMissedItemSuggestion>[0];
}> = [
  {
    name: "no prior history",
    input: {
      missedItem: { title: "Gym Session", category: "FITNESS", statusNote: null },
      pastPatterns: "No prior history in this category.",
    },
  },
  {
    name: "clear day/time pattern (real scenario from testing)",
    input: {
      missedItem: { title: "Game Night with Friends", category: "GAMING", statusNote: "worked late" },
      pastPatterns:
        "Game Night with Friends (MISSED); Game Night with Friends (MISSED); Morning Gaming Session (DONE)",
    },
  },
  {
    name: "statusNote present but unhelpful",
    input: {
      missedItem: { title: "Date Night", category: "SOCIAL", statusNote: "stuff came up" },
      pastPatterns: "Date Night (DONE); Date Night (DONE); Lunch Date (MISSED)",
    },
  },
];

// analyzeTrends's system prompt has its own "hard constraint" worth
// verifying rather than trusting, per the same lesson the draft-scenario
// pass already taught this project: "if nothing recurs clearly, say so
// honestly rather than inventing a pattern." The noise/insufficient-data
// scenarios below exist specifically to check that, not just the easy
// clear-pattern cases.
const trendScenarios: Array<{ name: string; input: Parameters<typeof analyzeTrends>[0] }> = [
  {
    name: "clear negative pattern (missed, same day/category — real scenario from testing)",
    input: {
      historyItems: [
        { title: "Game Night with Friends", category: "GAMING", weekOf: "2026-08-03", dayOfWeek: "MONDAY", status: "MISSED", statusNote: "worked late" },
        { title: "Game Night with Friends", category: "GAMING", weekOf: "2026-08-10", dayOfWeek: "MONDAY", status: "MISSED", statusNote: null },
        { title: "Game Night with Friends", category: "GAMING", weekOf: "2026-08-17", dayOfWeek: "MONDAY", status: "MISSED", statusNote: "too tired" },
        { title: "Morning Gaming Session", category: "GAMING", weekOf: "2026-08-17", dayOfWeek: "THURSDAY", status: "DONE", statusNote: null },
      ],
    },
  },
  {
    name: "clear positive pattern (consistently completed)",
    input: {
      historyItems: [
        { title: "Gym Session", category: "FITNESS", weekOf: "2026-08-03", dayOfWeek: "TUESDAY", status: "DONE", statusNote: null },
        { title: "Gym Session", category: "FITNESS", weekOf: "2026-08-10", dayOfWeek: "TUESDAY", status: "DONE", statusNote: null },
        { title: "Gym Session", category: "FITNESS", weekOf: "2026-08-17", dayOfWeek: "TUESDAY", status: "DONE", statusNote: null },
        { title: "Gym Session", category: "FITNESS", weekOf: "2026-08-24", dayOfWeek: "TUESDAY", status: "DONE", statusNote: null },
      ],
    },
  },
  {
    name: "no clear pattern (varied categories/days/statuses)",
    input: {
      historyItems: [
        { title: "Dentist", category: "CHORES", weekOf: "2026-08-03", dayOfWeek: "MONDAY", status: "DONE", statusNote: null },
        { title: "Lunch Date", category: "SOCIAL", weekOf: "2026-08-10", dayOfWeek: "WEDNESDAY", status: "MISSED", statusNote: "rescheduled" },
        { title: "Gym Session", category: "FITNESS", weekOf: "2026-08-17", dayOfWeek: "FRIDAY", status: "DONE", statusNote: null },
        { title: "Grocery Run", category: "CHORES", weekOf: "2026-08-24", dayOfWeek: "SUNDAY", status: "SKIPPED", statusNote: null },
      ],
    },
  },
  {
    name: "insufficient data (single data point)",
    input: {
      historyItems: [
        { title: "Yoga Class", category: "FITNESS", weekOf: "2026-08-17", dayOfWeek: "SATURDAY", status: "MISSED", statusNote: null },
      ],
    },
  },
];

async function main() {
  for (const scenario of draftScenarios) {
    console.log(`\n=== DRAFT: ${scenario.name} ===`);
    try {
      const result = await generateWeeklyDraft(scenario.input);
      console.log("summary:", result.summary);
      for (const item of result.items) {
        console.log(`  ${item.dayOfWeek} ${item.startTime}-${item.endTime} [${item.category}] ${item.title}`);
      }
    } catch (err) {
      console.error("FAILED:", err);
    }
  }

  for (const scenario of suggestionScenarios) {
    console.log(`\n=== SUGGESTION: ${scenario.name} ===`);
    try {
      const result = await generateMissedItemSuggestion(scenario.input);
      console.log("suggestion:", result.suggestion);
      console.log("suggestedDayOfWeek:", result.suggestedDayOfWeek, "suggestedTime:", result.suggestedTime);
    } catch (err) {
      console.error("FAILED:", err);
    }
  }

  for (const scenario of trendScenarios) {
    console.log(`\n=== TREND: ${scenario.name} ===`);
    try {
      const result = await analyzeTrends(scenario.input);
      console.log("insight:", result.insight);
      console.log("category:", result.category);
    } catch (err) {
      console.error("FAILED:", err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
