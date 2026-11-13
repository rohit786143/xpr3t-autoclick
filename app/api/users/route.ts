import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, encryptTargetPassword } from "@/lib/crypto";
import { getSession } from "@/lib/auth";

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
    const session = await getSession();
    if (!session || session.role !== "admin" || session.email !== "rohitsagarksg@gmail.com") {
      return NextResponse.json(
        { error: "Only Master Admin (rohitsagarksg@gmail.com) can add unlimited accounts." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const xpr3tUsername = (body.xpr3tUsername || body.username || "").trim();
    const xpr3tPassword = body.xpr3tPassword || body.password || "";

    if (!xpr3tUsername || !xpr3tPassword) {
      return NextResponse.json(
        { error: "XPR3T Login-ID and Password are required." },
        { status: 400 }
      );
    }

    const existingClaim = await prisma.user.findFirst({
      where: { xpr3tUsername },
    });

    if (existingClaim) {
      return NextResponse.json(
        { error: `XPR3T ID "${xpr3tUsername}" is already added.` },
        { status: 400 }
      );
    }

    const managedEmail = (body.email || `${xpr3tUsername.toLowerCase()}@managed.xpr3t.local`).trim().toLowerCase();
    const hashedPortalPassword = await hashPassword(xpr3tPassword);
    const hashedTarget = await hashPassword(xpr3tPassword);
    const encryptedTarget = encryptTargetPassword(xpr3tPassword);

    const newUser = await prisma.user.create({
      data: {
        email: managedEmail,
        portalPassword: hashedPortalPassword,
        role: "user",
        xpr3tUsername,
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
