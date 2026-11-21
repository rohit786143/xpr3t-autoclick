import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyPassword, hashPassword, encryptTargetPassword } from "@/lib/crypto";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { verifyXpr3tLogin } from "@/workers/bot";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawIdentifier = (body.loginIdentifier || body.username || body.email || "").trim();
    const lowerIdentifier = rawIdentifier.toLowerCase();
    const password = body.password || "";

    if (!rawIdentifier || !password) {
      return NextResponse.json(
        { error: "XPR3T Login ID and Password are required." },
        { status: 400 }
      );
    }

    // 1. Check if logging in as Admin (by admin email)
    const adminUser = await prisma.user.findFirst({
      where: {
        email: lowerIdentifier,
        role: "admin",
      },
    });

    if (adminUser) {
      const isValidAdmin = await verifyPassword(password, adminUser.portalPassword);
      if (!isValidAdmin) {
        return NextResponse.json(
          { error: "Invalid Admin Email or Password." },
          { status: 401 }
        );
      }

      const token = await signSessionToken({
        id: adminUser.id,
        email: adminUser.email,
        role: "admin",
        xpr3tUsername: adminUser.xpr3tUsername || undefined,
      });

      const response = NextResponse.json({
        success: true,
        role: "admin",
        user: {
          id: adminUser.id,
          email: adminUser.email,
          role: "admin",
          xpr3tUsername: adminUser.xpr3tUsername,
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
    }

    // 2. Direct XPR3T Login: verify live credentials against https://xpr3t.com/Sign-in.html
    const verification = await verifyXpr3tLogin(rawIdentifier, password);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Wrong XPR3T username or password." },
        { status: 401 }
      );
    }

    // 3. Credentials verified! Upsert user record in database
    const hashed = await hashPassword(password);
    const encrypted = encryptTargetPassword(password);
    const syntheticEmail = `${lowerIdentifier}@xpr3t.user`;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { xpr3tUsername: rawIdentifier },
          { xpr3tUsername: rawIdentifier.toUpperCase() },
          { email: syntheticEmail },
        ],
      },
    });

    const statsData = {
      ...(verification.stats?.totalDeposit
        ? { totalDeposit: verification.stats.totalDeposit }
        : {}),
      ...(verification.stats?.totalWithdraw
        ? { totalWithdraw: verification.stats.totalWithdraw }
        : {}),
      ...(verification.stats?.totalIncome
        ? { totalIncome: verification.stats.totalIncome }
        : {}),
      ...(verification.stats?.totalDeposit ||
      verification.stats?.totalWithdraw ||
      verification.stats?.totalIncome
        ? { statsUpdatedAt: new Date() }
        : {}),
    };

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          xpr3tUsername: rawIdentifier,
          portalPassword: hashed,
          xpr3tPassword: hashed,
          encryptedPassword: encrypted,
          ...statsData,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: syntheticEmail,
          portalPassword: hashed,
          role: "user",
          xpr3tUsername: rawIdentifier,
          xpr3tPassword: hashed,
          encryptedPassword: encrypted,
          status: "inactive",
          ...statsData,
        },
      });
    }

    const token = await signSessionToken({
      id: user.id,
      email: user.email,
      role: "user",
      xpr3tUsername: user.xpr3tUsername || rawIdentifier,
    });

    const response = NextResponse.json({
      success: true,
      role: "user",
      user: {
        id: user.id,
        email: user.email,
        role: "user",
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
