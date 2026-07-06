import { NextRequest } from "next/server";
import { startPipelineRun, startPipelineRunInBackground } from "@/lib/pipelines/runner";
import { getPipelineRuns } from "@/lib/pipelines/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const runs = await getPipelineRuns();
  return Response.json({ runs });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const pipelineId = typeof body.pipelineId === "string" ? body.pipelineId : "";
    const input = typeof body.input === "string" ? body.input : "";

    if (!pipelineId.trim()) {
      return Response.json({ error: "pipelineId is required" }, { status: 400 });
    }
    if (!input.trim()) {
      return Response.json({ error: "input is required" }, { status: 400 });
    }

    const options = {
      pipelineId,
      input,
      chatId: typeof body.chatId === "string" ? body.chatId : undefined,
      projectId: typeof body.projectId === "string" ? body.projectId : undefined,
      cwd: typeof body.currentPath === "string" ? body.currentPath : undefined,
    };

    const wait = body.wait === true;
    const run = wait
      ? await startPipelineRun(options)
      : await startPipelineRunInBackground(options);

    return Response.json({ run }, { status: 202 });
  } catch (error) {
    console.error("Pipeline run API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
