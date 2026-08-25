import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();

const CATEGORIES = ["WORK", "SOCIAL", "GAMING", "FITNESS", "CHORES"] as const;
const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

// ---------------------------------------------------------------------------
// Weekly draft generation (see diagrams/user-flow.mmd — synchronous, the user
// is waiting on this). Claude reasons in day-of-week + local HH:MM, not full
// datetimes — it has no idea what the plan's actual weekOf date is. The
// caller (the weekly-plan route) converts these into real DateTimes using
// the WeeklyPlan.weekOf + the user's timezone.
// ---------------------------------------------------------------------------

const WeeklyDraftSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      category: z.enum(CATEGORIES),
      dayOfWeek: z.enum(DAYS),
      startTime: z.string().describe("24-hour local time, HH:MM"),
      endTime: z.string().describe("24-hour local time, HH:MM"),
    }),
  ),
  summary: z
    .string()
    .describe(
      "One or two sentences on how the week was balanced across categories — not the place to explain excluded requests, that's excludedRequests below",
    ),
  excludedRequests: z
    .array(
      z.object({
        description: z.string().describe("What the user explicitly asked for, in their words"),
        category: z.enum(CATEGORIES).describe("The category it would need, which isn't selected"),
      }),
    )
    .describe(
      "Anything priorities explicitly and specifically named (e.g. \"date night\") that would need a category outside the user's selected set. Only genuinely explicit, specific requests belong here — never vague or inferred wants.",
    ),
});

export type WeeklyDraft = z.infer<typeof WeeklyDraftSchema>;

export async function generateWeeklyDraft(input: {
  existingItems: Array<{
    title: string;
    category: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }>;
  priorities: string;
  selectedCategories: string[];
}): Promise<WeeklyDraft> {
  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 4000,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(WeeklyDraftSchema),
    },
    system: `You help someone plan a balanced week. This app exists specifically to treat social and gaming time as real commitments, not whatever's left over after work fills the week — so when priorities mention things like gaming or time with someone, schedule them with the same seriousness as anything else.

Propose new items that fit around the existing fixed commitments already on the calendar. Never schedule a new item that overlaps an existing one. Keep the week realistic — don't overload any single day, and leave reasonable gaps between items.

Hard constraint, not a preference: every item's category MUST be one of the user's selected categories, exactly as given. Never propose a category outside that set, even if it seems like an obviously good idea. If priorities explicitly and specifically names something that would need a category outside the selected set (e.g. "date night" when Social isn't selected), do not schedule it and do not just mention it in the summary — record it in excludedRequests instead, with the request described in the user's own words and which category it needed.

If priorities is empty or vague, propose a light, modest week — a handful of items covering the most clearly underused categories, not a maximal fully-packed schedule. Guessing at a few well-chosen items beats inventing many. Every new item needs a specific day and time, not a vague placement.

If priorities contains genuinely contradictory instructions (e.g. asking to keep the week light while also asking to pack it full), don't silently pick one — resolve toward the lighter, more conservative interpretation (easier for the user to add to later than to undo an overloaded week), but say so explicitly in the summary, e.g. "You asked to keep it light but also pack the week — I erred toward keeping it light." Never resolve a contradiction silently.`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          existingItems: input.existingItems,
          priorities: input.priorities,
          selectedCategories: input.selectedCategories,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable weekly draft");
  }

  // Backstop, not just belt-and-suspenders — eval testing showed the model
  // will propose categories outside selectedCategories even with an
  // explicit "hard constraint" instruction in the system prompt (see
  // scripts/eval-prompts.ts's "single selected category" case). Prompt
  // wording alone isn't reliable enough for something the schema is meant
  // to guarantee, so enforce it here too.
  const allowed = new Set(input.selectedCategories);
  return {
    ...response.parsed_output,
    items: response.parsed_output.items.filter((item) => allowed.has(item.category)),
  };
}

// ---------------------------------------------------------------------------
// Missed-item suggestion (see diagrams/check-in-flow.mmd — synchronous,
// fires only once the user has 2-4+ weeks of history; the generic-tip path
// for newer users never calls Claude at all).
// ---------------------------------------------------------------------------

const SuggestionSchema = z.object({
  suggestion: z.string().describe("A specific, actionable suggestion for next week"),
  suggestedDayOfWeek: z.enum(DAYS).nullable(),
  suggestedTime: z
    .string()
    .nullable()
    .describe("24-hour local time HH:MM, or null if no specific time is being suggested"),
});

export type MissedItemSuggestion = z.infer<typeof SuggestionSchema>;

export async function generateMissedItemSuggestion(input: {
  missedItem: { title: string; category: string; statusNote: string | null };
  pastPatterns: string;
}): Promise<MissedItemSuggestion> {
  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 1000,
    output_config: {
      effort: "low",
      format: zodOutputFormat(SuggestionSchema),
    },
    system: `A user missed a planned item this week. Suggest one concrete, specific adjustment for next week — not generic advice like "try to prioritize this." If their past pattern in this category suggests a better day or time, say so specifically.`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          missedItem: input.missedItem,
          pastPatterns: input.pastPatterns,
        }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable suggestion");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// Trend analysis (see diagrams/data-flow.mmd — scheduled, runs every 2-4
// weeks per user via the Recommendation Engine worker, never user-initiated).
// Haiku 4.5, not Sonnet — this is pattern-spotting over structured data, not
// a task that needs Sonnet-tier reasoning. Haiku 4.5 doesn't support the
// `effort` parameter at all (errors if passed), unlike Sonnet 5.
// ---------------------------------------------------------------------------

const TrendInsightSchema = z.object({
  insight: z
    .string()
    .describe("One recurring pattern observed across the weeks of data, stated plainly"),
  category: z.enum(CATEGORIES).nullable(),
});

export type TrendInsight = z.infer<typeof TrendInsightSchema>;

export async function analyzeTrends(input: {
  // Bounded lookback window (~12-16 weeks) — the caller is responsible for
  // not passing a user's entire unbounded history here.
  historyItems: Array<{
    title: string;
    category: string;
    weekOf: string;
    dayOfWeek: string;
    status: string;
    statusNote: string | null;
  }>;
}): Promise<TrendInsight> {
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1000,
    output_config: {
      format: zodOutputFormat(TrendInsightSchema),
    },
    system: `Look across several weeks of a person's planned items and find one recurring pattern worth surfacing — the same category or item repeating a specific outcome (missed, or consistently completed) across at least two or three distinct weeks, ideally tied to a specific day. A single occurrence in one week is never a pattern, no matter how notable it seems on its own — do not report on it. State the pattern plainly and specifically, referencing the actual recurrence (which day, which category, how many weeks it showed up). If nothing genuinely recurs across multiple weeks, say so honestly (e.g. "no clear recurring pattern yet") rather than inventing one from limited data.`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({ historyItems: input.historyItems }),
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable trend insight");
  }
  return response.parsed_output;
}
