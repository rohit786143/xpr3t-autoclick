import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword, encryptTargetPassword } from "@/lib/crypto";
import { runBotForUser } from "@/workers/bot";

/**
 * GET: Fetch the logged-in user's linked account & click logs
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: {
        logs: {
          orderBy: { executedAt: "desc" },
          take: 15,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      isGhost: !!session.isGhost,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        xpr3tUsername: user.xpr3tUsername,
        status: user.status,
        lastRunAt: user.lastRunAt,
        lastRunStatus: user.lastRunStatus,
        lastRunMessage: user.lastRunMessage,
        createdAt: user.createdAt,
        logs: user.logs,
      },
    });
  } catch (error) {
    console.error("[GET /api/user/account] Error:", error);
    return NextResponse.json({ error: "Failed to load account data." }, { status: 500 });
  }
}

/**
 * POST: User connects their single XPR3T account (Login-ID and Password)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const xpr3tUsername = (body.xpr3tUsername || "").trim();
    const xpr3tPassword = body.xpr3tPassword || "";

    if (!xpr3tUsername || !xpr3tPassword) {
      return NextResponse.json(
        { error: "XPR3T Agent Login-ID and Password are required." },
        { status: 400 }
      );
    }

    // Check if this XPR3T ID is already claimed by another user (One Account Rule)
    const existingClaim = await prisma.user.findFirst({
      where: {
        xpr3tUsername,
        NOT: { id: session.sub },
      },
    });

    if (existingClaim) {
      return NextResponse.json(
        { error: `XPR3T ID "${xpr3tUsername}" is already linked to another account.` },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(xpr3tPassword);
    const encryptedPassword = encryptTargetPassword(xpr3tPassword);

    const updated = await prisma.user.update({
      where: { id: session.sub },
      data: {
        xpr3tUsername,
        xpr3tPassword: hashedPassword,
        encryptedPassword,
        status: "active",
        lastRunStatus: null,
        lastRunMessage: "Account linked. Ready for next 12:00 AM IST cycle.",
      },
      include: {
        logs: { take: 5, orderBy: { executedAt: "desc" } },
      },
    });

    return NextResponse.json({
      success: true,
      message: `XPR3T account ${xpr3tUsername} linked successfully!`,
      user: {
        id: updated.id,
        email: updated.email,
        xpr3tUsername: updated.xpr3tUsername,
        status: updated.status,
        lastRunMessage: updated.lastRunMessage,
        logs: updated.logs,
      },
    });
  } catch (error) {
    console.error("[POST /api/user/account] Error:", error);
    return NextResponse.json({ error: "Failed to link account." }, { status: 500 });
  }
}

/**
 * PUT: Trigger instant test run for this user's account
 */
export async function PUT() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const result = await runBotForUser(session.sub);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[PUT /api/user/account/trigger] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Run failed." },
      { status: 500 }
    );
  }
}

