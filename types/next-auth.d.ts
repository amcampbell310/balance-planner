import type { DefaultSession } from "next-auth";

// The default Session type has no `user.id` — this augments it to match
// what src/backend/auth.ts actually puts there in the session callback.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
