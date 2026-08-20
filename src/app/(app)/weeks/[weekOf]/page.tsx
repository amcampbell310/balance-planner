import { redirect } from "next/navigation";

// Superseded by /home?week=... (a real calendar view, and one that never
// 404s on an empty week — arrowing through history needs to work even when
// a week has nothing in it). Unconditional redirect, no DB query first, to
// keep old bookmarked/emailed links working.
export default async function PastWeekDetailRedirect({
  params,
}: {
  params: Promise<{ weekOf: string }>;
}) {
  const { weekOf } = await params;
  redirect(`/home?week=${weekOf}`);
}
