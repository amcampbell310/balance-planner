"use server";

import { signOut } from "@/backend/auth";

// Separate from auth.ts because this needs "use server" at the file level
// (a server action passed to a Client Component), while auth.ts exports
// signOut itself for direct use in Server Component forms like
// LoginButtons.tsx's sign-in actions.
export async function signOutAction() {
  await signOut();
}
