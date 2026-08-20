import { redirect } from "next/navigation";

// /home now shows the current week by default (with a calendar view and
// prev/next navigation to any past week) — this route is a redirect shim
// to keep old links/bookmarks working, not a distinct page anymore.
export default function ThisWeekPage() {
  redirect("/home");
}
