import { NextRequest, NextResponse } from "next/server";
import { getActiveChatRun, getActiveChatRuns } from "@/lib/chat/run-status";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId")?.trim();
  if (chatId) {
    return NextResponse.json({ run: getActiveChatRun(chatId) });
  }
  return NextResponse.json({ runs: getActiveChatRuns() });
}
