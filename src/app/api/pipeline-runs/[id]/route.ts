import { NextRequest } from "next/server";
import { executePipelineRun } from "@/lib/pipelines/runner";
import { getPipelineRun } from "@/lib/pipelines/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await getPipelineRun(id);
  if (!run) {
    return Response.json({ error: "Pipeline run not found" }, { status: 404 });
  }
  return Response.json({ run });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const currentPath = typeof body.currentPath === "string" ? body.currentPath : undefined;
    const wait = body.wait === true;

    if (wait) {
      const run = await executePipelineRun(id, { cwd: currentPath });
      return Response.json({ run });
    }

    void executePipelineRun(id, { cwd: currentPath }).catch((error) => {
      console.error(`Pipeline run ${id} failed:`, error);
    });
    const run = await getPipelineRun(id);
    if (!run) {
      return Response.json({ error: "Pipeline run not found" }, { status: 404 });
    }
    return Response.json({ run }, { status: 202 });
  } catch (error) {
    console.error("Pipeline run retry API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
