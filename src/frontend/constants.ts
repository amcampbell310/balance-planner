// Shared by OnboardingForm.tsx and SettingsForm.tsx — both edit the same
// three fields (POST /api/onboarding handles both initial setup and later
// edits).
export const CATEGORIES = [
  { value: "WORK", label: "Work" },
  { value: "SOCIAL", label: "Social" },
  { value: "GAMING", label: "Gaming" },
  { value: "FITNESS", label: "Fitness" },
  { value: "CHORES", label: "Chores" },
] as const;

export const WEEK_DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

// The full IANA zone list is ~400 entries — mostly redundant regional
// aliases (e.g. six separate America/Indiana/* zones) that just make the
// list exhausting to scroll. A curated set of major zones — one per
// populous city/region per distinct offset — covers what the overwhelming
// majority of users actually need, same approach most apps take rather
// than exposing the raw tzdb. Select.tsx falls back to showing the raw
// value if a user's browser-detected zone isn't in this list, so nothing
// breaks for the uncommon case — it just won't be pre-grouped nicely.
const CURATED_ZONES: Record<string, string[]> = {
  America: [
    "America/Los_Angeles",
    "America/Denver",
    "America/Phoenix",
    "America/Chicago",
    "America/New_York",
    "America/Anchorage",
    "America/Toronto",
    "America/Vancouver",
    "America/Halifax",
    "America/Mexico_City",
    "America/Bogota",
    "America/Sao_Paulo",
    "America/Argentina/Buenos_Aires",
  ],
  Pacific: ["Pacific/Honolulu", "Pacific/Auckland", "Pacific/Fiji"],
  Europe: [
    "Europe/London",
    "Europe/Dublin",
    "Europe/Lisbon",
    "Europe/Madrid",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Amsterdam",
    "Europe/Rome",
    "Europe/Athens",
    "Europe/Istanbul",
    "Europe/Moscow",
  ],
  Africa: ["Africa/Cairo", "Africa/Lagos", "Africa/Johannesburg", "Africa/Nairobi"],
  Asia: [
    "Asia/Dubai",
    "Asia/Karachi",
    "Asia/Kolkata",
    "Asia/Dhaka",
    "Asia/Bangkok",
    "Asia/Jakarta",
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Manila",
  ],
  Australia: ["Australia/Perth", "Australia/Adelaide", "Australia/Sydney", "Australia/Brisbane"],
  Other: ["UTC"],
};

// "short" gives real letter abbreviations where that's the actual regional
// convention (PDT, MST, CST, EDT, HST in North America) and falls back to a
// GMT+X offset everywhere else — checked empirically rather than assumed:
// most of the world (Europe, Asia, Africa, South America, Australia) has no
// standardized short abbreviation in everyday use, and some letter codes
// are outright ambiguous globally (CST collides between US Central and
// China Standard Time). This is ICU's real CLDR locale data reflecting
// that, not a gap to patch over with a hand-built lookup table.
function shortLabel(tz: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

export const TIMEZONES: Array<{ value: string; label: string; header?: boolean }> = [];
for (const group of Object.keys(CURATED_ZONES)) {
  TIMEZONES.push({ value: `__group_${group}`, label: group, header: true });
  for (const tz of CURATED_ZONES[group]) {
    const city = tz.includes("/") ? tz.slice(tz.indexOf("/") + 1) : tz;
    TIMEZONES.push({
      value: tz,
      label: `${city.replace(/_/g, " ").replace(/\//g, " / ")} (${shortLabel(tz)})`,
    });
  }
}
