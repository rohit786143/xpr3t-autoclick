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
      username: u.username,
      targetWebsiteUrl: u.targetWebsiteUrl || DEFAULT_TARGET_URL,
      buttonSelector: u.buttonSelector,
      usernameSelector: u.usernameSelector,
      passwordSelector: u.passwordSelector,
      submitSelector: u.submitSelector,
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
    const {
      username,
      password,
      targetWebsiteUrl,
      buttonSelector,
      usernameSelector,
      passwordSelector,
      submitSelector,
      status,
    } = body;

    if (!username || !password) {
      return NextResponse.json(
        {
          error: "Username (Login-ID) and Password are required.",
        },
        { status: 400 }
      );
    }

    const finalUrl = (targetWebsiteUrl || DEFAULT_TARGET_URL).trim();

    const hashedPassword = await hashPassword(password);
    const encryptedPassword = encryptTargetPassword(password);

    const newUser = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        encryptedPassword,
        targetWebsiteUrl: finalUrl,
        buttonSelector: (buttonSelector || "").trim(),
        usernameSelector: usernameSelector?.trim() || "#inputEmail",
        passwordSelector: passwordSelector?.trim() || "#inputPassword",
        submitSelector: submitSelector?.trim() || "#submit-login",
        status: status === "inactive" ? "inactive" : "active",
      },
      include: {
        logs: true,
      },
    });

    return NextResponse.json(
      {
        user: {
          id: newUser.id,
          username: newUser.username,
          targetWebsiteUrl: newUser.targetWebsiteUrl,
          buttonSelector: newUser.buttonSelector,
          usernameSelector: newUser.usernameSelector,
          passwordSelector: newUser.passwordSelector,
          submitSelector: newUser.submitSelector,
          status: newUser.status,
          lastRunAt: newUser.lastRunAt,
          lastRunStatus: newUser.lastRunStatus,
          lastRunMessage: newUser.lastRunMessage,
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
