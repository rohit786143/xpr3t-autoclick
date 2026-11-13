import { NextRequest, NextResponse } from "next/server";
import { runBotForUser } from "@/workers/bot";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const result = await runBotForUser(id);

    return NextResponse.json({
      result,
    });
  } catch (error) {
    console.error("[POST /api/users/[id]/trigger] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to execute Playwright bot for user.",
      },
      { status: 500 }
    );
  }
}

