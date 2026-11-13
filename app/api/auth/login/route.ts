import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const loginIdentifier = (body.loginIdentifier || body.username || body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!loginIdentifier || !password) {
      return NextResponse.json(
        { error: "Email / Username and Password are required." },
        { status: 400 }
      );
    }

    // Allow login by either Portal Email or XPR3T Username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginIdentifier },
          { xpr3tUsername: loginIdentifier },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid Email/Username or Password." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.portalPassword);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Email/Username or Password." },
        { status: 401 }
      );
    }

    const token = await signSessionToken({
      id: user.id,
      email: user.email,
      role: user.role as "admin" | "user",
      xpr3tUsername: user.xpr3tUsername || undefined,
    });

    const response = NextResponse.json({
      success: true,
      role: user.role,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        xpr3tUsername: user.xpr3tUsername,
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
    console.error("[Login Error]:", error);
    return NextResponse.json(
      { error: "Internal server error during login." },
      { status: 500 }
    );
  }
}
