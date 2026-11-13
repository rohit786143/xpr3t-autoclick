import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

/**
 * Handles requesting a 6-digit password reset OTP via email, and resetting password with OTP.
 * Never exposes the OTP in the HTTP response.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action; // "request" | "reset"

    if (action === "reset") {
      const { email, token, newPassword } = body;
      if (!email || !token || !newPassword) {
        return NextResponse.json(
          { error: "Email, reset code, and new password are required." },
          { status: 400 }
        );
      }

      if (String(newPassword).length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters long." },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });

      if (!user || user.resetToken !== token.trim() || !user.resetTokenExpiry) {
        return NextResponse.json(
          { error: "Invalid or expired reset code." },
          { status: 400 }
        );
      }

      if (new Date() > new Date(user.resetTokenExpiry)) {
        return NextResponse.json(
          { error: "Reset code has expired. Please request a new one." },
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

    // Default: Request reset OTP via Email
    const email = (body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "Please provide your registered email address." },
        { status: 400 }
      );
    }

    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (!smtpUser || !smtpPass) {
      return NextResponse.json(
        { error: "Email service (SMTP) is not configured on the server yet. Please contact administrator." },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Security standard: don't reveal whether email exists
      return NextResponse.json({
        success: true,
        message: "If that email is registered, a 6-digit reset code has been sent to your inbox.",
      });
    }

    const resetToken = crypto.randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry: expiry,
      },
    });

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"XPR3T Auto-Clicker" <${smtpFrom}>`,
      to: user.email,
      subject: "Password Reset Code - XPR3T Auto-Clicker",
      text: `Your password reset code is: ${resetToken}\n\nThis code is valid for 15 minutes. If you did not request a password reset, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #475569; font-size: 14px;">Use the 6-digit verification code below to reset your XPR3T Auto-Clicker portal password:</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a; margin: 20px 0;">
            ${resetToken}
          </div>
          <p style="color: #64748b; font-size: 12px;">This code expires in 15 minutes. Never share this code with anyone.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "A 6-digit password reset code has been sent to your registered email address.",
    });
  } catch (error) {
    console.error("[Forgot Password Error]:", error);
    return NextResponse.json(
      { error: "Failed to send password reset email. Please try again later." },
      { status: 500 }
    );
  }
}
