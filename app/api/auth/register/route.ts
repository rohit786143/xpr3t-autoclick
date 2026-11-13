import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const portalPassword = body.portalPassword || "";
    const confirmPassword = body.confirmPassword || "";

    if (!email || !portalPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Email, Password, and Confirm Password are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (portalPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (portalPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please login." },
        { status: 400 }
      );
    }

    const hashedPortalPassword = await hashPassword(portalPassword);

    const newUser = await prisma.user.create({
      data: {
        email,
        portalPassword: hashedPortalPassword,
        role: "user",
      },
    });

    const token = await signSessionToken({
      id: newUser.id,
      email: newUser.email,
      role: "user",
    });

    const response = NextResponse.json({
      success: true,
      message: "Registration successful! Welcome to XPR3T Auto-Clicker.",
      user: {
        id: newUser.id,
        email: newUser.email,
        role: "user",
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("[Register Error]:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
