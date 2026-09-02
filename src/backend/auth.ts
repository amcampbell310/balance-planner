import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextResponse } from "next/server";
import { db } from "@/backend/db";

// See diagrams/architecture.mmd: "Auth.js — OAuth handshake + JWT sessions".
// The Prisma adapter still persists User/Account records on sign-in (that's
// unrelated to session strategy), but with strategy: "jwt" it never touches
// a Session table — which is why prisma/schema.prisma has no Session model.
// Microsoft and Apple were considered and declined (2026-08-23, see
// documents/roadmap.md) — Apple specifically needs a paid $99/year Developer
// account, and Microsoft's setup overhead isn't worth it for a single-user
// app. Left in the source rather than removed (Auth.js throws
// InvalidEndpoints at request time for any *configured* provider missing
// required env vars, even if unused, so this filter is what keeps them
// harmlessly dormant) in case a real need for one comes up later.
const providers = [
  Google,
  MicrosoftEntraID,
  Apple,
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    // Returning null (not throwing) on any invalid-credentials case is
    // deliberate — Auth.js surfaces that uniformly as CredentialsSignin
    // regardless of *why* it failed, which avoids leaking whether an email
    // is registered at all through a different error message.
    async authorize(credentials) {
      const email = credentials?.email;
      const password = credentials?.password;
      if (typeof email !== "string" || typeof password !== "string") return null;

      const user = await db.user.findUnique({ where: { email } });
      if (!user?.password) return null; // no account, or an OAuth-only one

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return null;

      return user;
    },
  }),
].filter((provider) => {
  if (provider === MicrosoftEntraID) return Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);
  if (provider === Apple) return Boolean(process.env.AUTH_APPLE_ID);
  return true;
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/" },
  callbacks: {
    // Soft delete is meant to be recoverable for 30 days (see
    // purgeDeletedAccounts.ts's grace period) — without this, there was no
    // actual way back in: the account/user rows still exist, so OAuth just
    // re-links to the same soft-deleted user and credentials still verifies
    // the password fine, but the session callback below correctly refuses
    // to attach a session to a deleted account either way. The net effect
    // was a silent, permanent lockout with no error shown, not a real
    // "deleted for 30 days" grace period. Reactivating here — right after
    // proving account ownership via a real sign-in, before a session is
    // ever issued — is the actual recovery path that comment promised.
    async signIn({ user }) {
      if (user.id) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { deletedAt: true },
        });
        if (dbUser?.deletedAt) {
          await db.user.update({ where: { id: user.id }, data: { deletedAt: null } });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Soft-deleted accounts must be treated as logged out immediately,
        // not just once their JWT happens to expire — JWT sessions are
        // stateless, so this DB check on every session read is the actual
        // enforcement point. Leaving session.user.id unset here is what
        // makes every requireUserId()/requireOnboardedUser() call below
        // correctly see "no session" with no extra deletedAt checks needed
        // at each call site.
        const user = await db.user.findUnique({
          where: { id: token.sub },
          select: { deletedAt: true },
        });
        if (user && !user.deletedAt) {
          session.user.id = token.sub;
        }
      }
      return session;
    },
  },
});

// Every route handler calls this instead of accepting userId from the
// client. JWT sessions can live for weeks between actual OAuth logins (see
// diagrams/user-flow.mmd), so lastLoginAt has to update on every
// authenticated request to stay meaningful for RE_ENGAGEMENT detection, not
// just at sign-in time — which is why it lives here rather than in an
// Auth.js callback that only fires on fresh logins. At this project's
// scale, an UPDATE per request is not worth throttling; revisit if usage
// ever grows enough for it to matter. Awaited, not fire-and-forget — this
// runs on Vercel, where an unawaited promise can be cut off mid-flight once
// the response is sent.
//
// Returns the userId, or a 401 NextResponse the caller should return as-is:
//
//   const userId = await requireUserId();
//   if (userId instanceof NextResponse) return userId;
export async function requireUserId(): Promise<string | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { lastLoginAt: new Date() },
  });

  return session.user.id;
}
