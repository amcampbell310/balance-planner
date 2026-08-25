import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/backend/db";
import { passwordError } from "@/backend/authValidation";

const BCRYPT_ROUNDS = 12;

// Creates a credentials-based account only — this does not sign the user
// in. Auth.js's Credentials provider (src/backend/auth.ts) verifies
// password on login separately; the client calls next-auth/react's signIn
// right after a successful signup here, same as any other login.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, password } = body as { name?: string; email?: string; password?: string };

  // Required, not optional — OAuth accounts always get a real name from
  // the provider profile, and the calendar/greeting is meant to feel
  // personalized per person, not generic. See prisma/schema.prisma's
  // User.name field: still nullable at the DB level (an existing account
  // predating this requirement, or a future OAuth edge case, shouldn't
  // become an unrepresentable state), enforced here and in
  // PATCH /api/account instead.
  if (!name?.trim() || !email || !password) {
    return NextResponse.json(
      { error: "name, email, and password are required" },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const pwError = passwordError(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
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
      name: name.trim(),
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
