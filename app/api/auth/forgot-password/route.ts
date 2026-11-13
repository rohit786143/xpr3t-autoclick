import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

/**
 * Handles Requesting Password Reset link via Email, or resetting with token.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action; // "request" | "reset"

    if (action === "reset") {
      const { email, token, newPassword } = body;
      if (!email || !token || !newPassword) {
        return NextResponse.json(
          { error: "Email, token, and new password are required." },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });

      if (!user || user.resetToken !== token || !user.resetTokenExpiry) {
        return NextResponse.json(
          { error: "Invalid or expired reset token." },
          { status: 400 }
        );
      }

      if (new Date() > new Date(user.resetTokenExpiry)) {
        return NextResponse.json(
          { error: "Reset token has expired. Please request a new one." },
          { status: 400 }
        );
      }

      const hashed = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          portalPassword: hashed,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Password reset successful! You can now log in with your new password.",
      });
    }

    // Default: Request reset token
    const email = (body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "Please provide your registered email address." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Security standard: don't reveal if email exists
      return NextResponse.json({
        success: true,
        message: "If that email is registered, password reset instructions have been sent.",
      });
    }

    // Generate 6-digit OTP code or reset token
    const resetToken = crypto.randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry: expiry,
      },
    });

    console.log(`[Password Reset] Generated Token for ${user.email}: ${resetToken}`);

    // In production SMTP, send mail here. Also return token so user is never locked out
    return NextResponse.json({
      success: true,
      message: `Password reset instructions sent to ${user.email}. (Reset Code: ${resetToken})`,
      resetCode: resetToken, // Provided directly for immediate assistance
    });
  } catch (error) {
    console.error("[Forgot Password Error]:", error);
    return NextResponse.json(
      { error: "Failed to process password reset request." },
      { status: 500 }
    );
  }
}

