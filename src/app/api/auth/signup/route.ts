import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/backend/db";

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

// Creates a credentials-based account only — this does not sign the user
// in. Auth.js's Credentials provider (src/backend/auth.ts) verifies
// password on login separately; the client calls next-auth/react's signIn
// right after a successful signup here, same as any other login.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Deliberately the same message whether the email belongs to an OAuth
    // account or an existing credentials one — account linking isn't
    // supported, but the error shouldn't reveal which case it is.
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db.user.create({
    data: {
      email,
      password: hashed,
      // See prisma/schema.prisma's User.emailVerified comment — matches
      // OAuth accounts' existing (also unverified-in-practice) trust level,
      // not a new gap introduced by adding this signup path.
      emailVerified: new Date(),
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
