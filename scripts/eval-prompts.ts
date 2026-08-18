import "dotenv/config";
import { generateWeeklyDraft, generateMissedItemSuggestion } from "@/backend/claude";

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
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
