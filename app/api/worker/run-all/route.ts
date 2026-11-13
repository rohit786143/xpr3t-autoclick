import { NextResponse } from "next/server";
import { runAllActiveUsers } from "@/workers/bot";

export async function POST() {
  try {
    const results = await runAllActiveUsers();
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[POST /api/worker/run-all] Error:", error);
    return NextResponse.json(
      { error: "Failed to execute batch worker run." },
      { status: 500 }
    );
  }
}

