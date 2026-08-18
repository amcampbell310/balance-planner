import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextResponse } from "next/server";
import { db } from "@/backend/db";

// See diagrams/architecture.mmd: "Auth.js — OAuth handshake + JWT sessions".
// The Prisma adapter still persists User/Account records on sign-in (that's
// unrelated to session strategy), but with strategy: "jwt" it never touches
// a Session table — which is why prisma/schema.prisma has no Session model.
// Microsoft and Apple credentials aren't set yet (see project memory) —
// Auth.js throws InvalidEndpoints at request time for any *configured*
// provider missing required env vars, even if the user never tries to use
// it, so only register a provider once its credentials actually exist.
const providers = [Google, MicrosoftEntraID, Apple].filter((provider) => {
  if (provider === MicrosoftEntraID) return Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);
  if (provider === Apple) return Boolean(process.env.AUTH_APPLE_ID);
  return true;
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers,
  callbacks: {
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
