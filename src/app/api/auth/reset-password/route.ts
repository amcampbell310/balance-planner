import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/backend/db";
import { passwordError } from "@/backend/authValidation";

const BCRYPT_ROUNDS = 12;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, password } = body as { token?: string; password?: string };

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  const pwError = passwordError(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db.$transaction([
    db.user.update({ where: { id: resetToken.userId }, data: { password: hashed } }),
    // One-time use — delete every outstanding token for this user, not just
    // the one that was redeemed, so an earlier still-unexpired link (from a
    // previous request) can't also be used afterward.
    db.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } }),
  ]);

  return NextResponse.json({ success: true });
}
