import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { SESSION_COOKIE_NAME, signAdminToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    // Ensure default admin exists in DB if none seeded yet
    const defaultUsername = process.env.ADMIN_USERNAME || "admin";
    const defaultPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";

    let admin = await prisma.admin.findUnique({ where: { username } });

    if (!admin && username === defaultUsername) {
      const adminCount = await prisma.admin.count();
      if (adminCount === 0) {
        admin = await prisma.admin.create({
          data: {
            username: defaultUsername,
            password: await hashPassword(defaultPassword),
          },
        });
      }
    }

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid admin credentials." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid admin credentials." },
        { status: 401 }
      );
    }

    const token = await signAdminToken({
      id: admin.id,
      username: admin.username,
    });

    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, username: admin.username },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("[Auth Login Error]:", error);
    return NextResponse.json(
      { error: "Internal server error during login." },
      { status: 500 }
    );
  }
}

