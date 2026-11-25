import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  SUBSCRIPTION_PLANS,
  ORDER_TTL_MS,
  generateBep20PaymentQr,
} from "@/lib/bsc";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const planDays = Number(body.planDays);
    const senderWallet = (body.senderWallet || "").trim();
    const plan = SUBSCRIPTION_PLANS[planDays];

    if (!plan) {
      return NextResponse.json(
        { error: "Invalid subscription plan selected." },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(senderWallet)) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid BEP20 wallet address (starts with 0x, 42 characters).",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Expire any previous pending orders for this user
    await prisma.paymentOrder.updateMany({
      where: {
        userId: session.sub,
        status: "pending",
      },
      data: { status: "expired" },
    });

    const expectedAmount = String(plan.baseUsd);
    const expiresAt = new Date(now.getTime() + ORDER_TTL_MS);

    const order = await prisma.paymentOrder.create({
      data: {
        userId: session.sub,
        planDays: plan.days,
        baseAmount: plan.baseUsd,
        expectedAmount,
        senderWallet: senderWallet.toLowerCase(),
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
        senderWallet: order.senderWallet,
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
