import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession, signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action; // "impersonate" | "revert"

    if (action === "revert") {
      if (!session.isGhost || !session.originalAdminId) {
        return NextResponse.json({ error: "Not in ghost mode." }, { status: 400 });
      }

      const adminUser = await prisma.user.findUnique({
        where: { id: session.originalAdminId },
      });

      if (!adminUser) {
        return NextResponse.json({ error: "Admin not found." }, { status: 404 });
      }

      const token = await signSessionToken({
        id: adminUser.id,
        email: adminUser.email,
        role: "admin",
      });

      const response = NextResponse.json({
        success: true,
        message: "Returned to Admin Dashboard.",
        redirect: "/admin/dashboard",
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    // Default: Impersonate user (Ghost Login)
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Only admins can ghost login." }, { status: 403 });
    }

    const targetUserId = body.userId;
    if (!targetUserId) {
      return NextResponse.json({ error: "Target userId is required." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User to impersonate not found." }, { status: 404 });
    }

    // Sign ghost session token
    const ghostToken = await signSessionToken({
      id: targetUser.id,
      email: targetUser.email,
      role: "user",
      xpr3tUsername: targetUser.xpr3tUsername || "",
      isGhost: true,
      originalAdminId: session.sub,
    });

    const response = NextResponse.json({
      success: true,
      message: `Ghost login into ${targetUser.email} successful!`,
      redirect: "/dashboard",
    });

    response.cookies.set(SESSION_COOKIE_NAME, ghostToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error("[Ghost Login Error]:", error);
    return NextResponse.json({ error: "Ghost login failed." }, { status: 500 });
  }
}

