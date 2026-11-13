import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, encryptTargetPassword } from "@/lib/crypto";
import { removeUserSessionDir } from "@/workers/bot";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (typeof body.username === "string" && body.username.trim()) {
      updateData.username = body.username.trim();
    }
    if (
      typeof body.targetWebsiteUrl === "string" &&
      body.targetWebsiteUrl.trim()
    ) {
      updateData.targetWebsiteUrl = body.targetWebsiteUrl.trim();
    }
    if (typeof body.buttonSelector === "string") {
      updateData.buttonSelector = body.buttonSelector.trim();
    }
    if (typeof body.usernameSelector === "string") {
      updateData.usernameSelector = body.usernameSelector.trim();
    }
    if (typeof body.passwordSelector === "string") {
      updateData.passwordSelector = body.passwordSelector.trim();
    }
    if (typeof body.submitSelector === "string") {
      updateData.submitSelector = body.submitSelector.trim();
    }
    if (body.status === "active" || body.status === "inactive") {
      updateData.status = body.status;
    }
    if (typeof body.password === "string" && body.password.length > 0) {
      updateData.password = await hashPassword(body.password);
      updateData.encryptedPassword = encryptTargetPassword(body.password);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        logs: {
          orderBy: { executedAt: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        targetWebsiteUrl: updated.targetWebsiteUrl,
        buttonSelector: updated.buttonSelector,
        usernameSelector: updated.usernameSelector,
        passwordSelector: updated.passwordSelector,
        submitSelector: updated.submitSelector,
        status: updated.status,
        lastRunAt: updated.lastRunAt,
        lastRunStatus: updated.lastRunStatus,
        lastRunMessage: updated.lastRunMessage,
        createdAt: updated.createdAt,
        logs: updated.logs,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/users/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to update user." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.user.delete({ where: { id } });
    removeUserSessionDir(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/users/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete user." },
      { status: 500 }
    );
  }
}
