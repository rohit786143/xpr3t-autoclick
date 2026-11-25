import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fetchRecentIncomingUsdtTransfers, usdtToWei } from "@/lib/bsc";
import { runBotForUser } from "@/workers/bot";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const orderId = request.nextUrl.searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required." }, { status: 400 });
    }

    const order = await prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order || order.userId !== session.sub) {
      return NextResponse.json({ error: "Payment order not found." }, { status: 404 });
    }

    if (order.status === "paid") {
      return NextResponse.json({
        status: "paid",
        txHash: order.txHash,
        subscriptionExpiresAt: order.user.subscriptionExpiresAt,
      });
    }

    const now = new Date();
    // Allow 5-minute blockchain confirmation grace window after the 10-min countdown
    const graceCutoff = new Date(order.expiresAt.getTime() + 5 * 60 * 1000);
    if (now > graceCutoff) {
      if (order.status !== "expired") {
        await prisma.paymentOrder.update({
          where: { id: order.id },
          data: { status: "expired" },
        });
      }
      return NextResponse.json({ status: "expired" });
    }

    // Check blockchain (BscScan API / BSC RPC) for matching senderWallet + exact whole USDT amount
    const expectedWei = usdtToWei(order.expectedAmount);
    const minTimestampMs = order.createdAt.getTime() - 120_000;
    const expectedFrom = (order.senderWallet || "").toLowerCase();

    const transfers = await fetchRecentIncomingUsdtTransfers();

    for (const tx of transfers) {
      if (tx.timestampMs < minTimestampMs) continue;
      if (expectedFrom && tx.from !== expectedFrom) continue;
      if (tx.valueWei < expectedWei) continue;

      // Ensure txHash has not already been claimed by another order
      const alreadyClaimed = await prisma.paymentOrder.findUnique({
        where: { txHash: tx.txHash },
      });
      if (alreadyClaimed) continue;

      const baseExpiry =
        order.user.subscriptionExpiresAt && order.user.subscriptionExpiresAt > now
          ? order.user.subscriptionExpiresAt
          : now;
      const newExpiry = new Date(
        baseExpiry.getTime() + order.planDays * 24 * 60 * 60 * 1000
      );

      await prisma.$transaction([
        prisma.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: "paid",
            txHash: tx.txHash,
            paidAt: now,
          },
        }),
        prisma.user.update({
          where: { id: order.userId },
          data: {
            subscriptionExpiresAt: newExpiry,
            status: "active",
            lastRunMessage: `Payment verified (${order.planDays} days). Starting Auto-Click...`,
          },
        }),
      ]);

      // Run initial bot check immediately
      await runBotForUser(order.userId).catch((err) => {
        console.error("[Payment Activation Bot Error]:", err);
      });

      return NextResponse.json({
        status: "paid",
        txHash: tx.txHash,
        subscriptionExpiresAt: newExpiry,
      });
    }

    return NextResponse.json({
      status: "pending",
      expiresAt: order.expiresAt,
    });
  } catch (error) {
    console.error("[GET /api/payments/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment status." },
      { status: 500 }
    );
  }
}
