import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  SUBSCRIPTION_PLANS,
  ORDER_TTL_MS,
  generateBep20PaymentQr,
} from "@/lib/bsc";

/**
 * Generates a unique micro-amount (e.g. "1.014", "3.026") not currently used
 * by any other active pending PaymentOrder in the last 10 minutes.
 */
async function pickUniqueAmount(baseUsd: number): Promise<string> {
  // Reserve each generated micro-amount for 30 minutes so late blockchain confirmations
  // (e.g. user scans at 9:55 and tx confirms at 10:15) can never collide with another user.
  const cooldownCutoff = new Date(Date.now() - 30 * 60 * 1000);
  const recentOrders = await prisma.paymentOrder.findMany({
    where: {
      createdAt: { gt: cooldownCutoff },
    },
    select: { expectedAmount: true },
  });

  const usedSet = new Set(recentOrders.map((o) => o.expectedAmount));

  // Try 3-decimal micro-offsets (.001 to .099) first, e.g. 1.014, 3.026
  for (let attempt = 0; attempt < 60; attempt++) {
    const milli = crypto.randomInt(1, 100); // 1..99
    const candidate = (baseUsd + milli / 1000).toFixed(3);
    if (!usedSet.has(candidate)) {
      return candidate;
    }
  }

  // Fallback to 4-decimal micro-offsets (.0001 to .0999) for high concurrency
  for (let attempt = 0; attempt < 100; attempt++) {
    const tenThousandth = crypto.randomInt(1, 1000);
    const candidate = (baseUsd + tenThousandth / 10000).toFixed(4);
    if (!usedSet.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("High payment traffic right now. Please try again in a moment.");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const planDays = Number(body.planDays);
    const plan = SUBSCRIPTION_PLANS[planDays];

    if (!plan) {
      return NextResponse.json(
        { error: "Invalid subscription plan selected." },
        { status: 400 }
      );
    }

    const now = new Date();

    // Mark any previous pending orders for this user as expired so amount rotates cleanly
    await prisma.paymentOrder.updateMany({
      where: {
        userId: session.sub,
        status: "pending",
      },
      data: { status: "expired" },
    });

    const expectedAmount = await pickUniqueAmount(plan.baseUsd);
    const expiresAt = new Date(now.getTime() + ORDER_TTL_MS);

    const order = await prisma.paymentOrder.create({
      data: {
        userId: session.sub,
        planDays: plan.days,
        baseAmount: plan.baseUsd,
        expectedAmount,
        status: "pending",
        expiresAt,
      },
    });

    const qrDataUrl = await generateBep20PaymentQr();

    return NextResponse.json({
      order: {
        id: order.id,
        planDays: order.planDays,
        planLabel: plan.label,
        baseAmount: order.baseAmount,
        expectedAmount: order.expectedAmount,
        expiresAt: order.expiresAt,
        qrDataUrl,
      },
    });
  } catch (error) {
    console.error("[POST /api/payments/create] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment QR." },
      { status: 500 }
    );
  }
}
