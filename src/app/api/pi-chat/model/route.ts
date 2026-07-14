import { NextRequest, NextResponse } from "next/server";
import { getResolvedPiRuntimeModel } from "@/lib/pi/config-store";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    return NextResponse.json(await getResolvedPiRuntimeModel(projectId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve pi model" },
      { status: 500 }
    );
  }
}
