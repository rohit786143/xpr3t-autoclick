import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, encryptTargetPassword } from "@/lib/crypto";

const DEFAULT_TARGET_URL = "https://xpr3t.com/Sign-in.html";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        logs: {
          orderBy: { executedAt: "desc" },
          take: 5,
        },
      },
    });

    const sanitizedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      xpr3tUsername: u.xpr3tUsername,
      targetWebsiteUrl: u.targetWebsiteUrl || DEFAULT_TARGET_URL,
      buttonSelector: u.buttonSelector,
      status: u.status,
      lastRunAt: u.lastRunAt,
      lastRunStatus: u.lastRunStatus,
      lastRunMessage: u.lastRunMessage,
      createdAt: u.createdAt,
      logs: u.logs,
    }));

    return NextResponse.json({ users: sanitizedUsers });
  } catch (error) {
    console.error("[GET /api/users] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, xpr3tUsername, xpr3tPassword } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and Password are required." },
        { status: 400 }
      );
    }

    const hashedPortalPassword = await hashPassword(password);
    let encryptedTarget = null;
    let hashedTarget = null;

    if (xpr3tPassword) {
      hashedTarget = await hashPassword(xpr3tPassword);
      encryptedTarget = encryptTargetPassword(xpr3tPassword);
    }

    const newUser = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        portalPassword: hashedPortalPassword,
        role: "user",
        xpr3tUsername: xpr3tUsername ? xpr3tUsername.trim() : null,
        xpr3tPassword: hashedTarget,
        encryptedPassword: encryptedTarget,
        status: "active",
      },
      include: {
        logs: true,
      },
    });

    return NextResponse.json(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          xpr3tUsername: newUser.xpr3tUsername,
          status: newUser.status,
          createdAt: newUser.createdAt,
          logs: newUser.logs,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/users] Error:", error);
    return NextResponse.json(
      { error: "Failed to create user configuration." },
      { status: 500 }
    );
  }
}
