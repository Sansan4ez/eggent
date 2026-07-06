import { NextRequest } from "next/server";
import { getPipelineDefinitions, upsertPipelineDefinition } from "@/lib/pipelines/store";

export const runtime = "nodejs";

function isPipelinePayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const pipelines = await getPipelineDefinitions();
  return Response.json({ pipelines });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!isPipelinePayload(body)) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (typeof body.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    if (!Array.isArray(body.steps) || body.steps.length === 0) {
      return Response.json({ error: "steps are required" }, { status: 400 });
    }

    const pipeline = await upsertPipelineDefinition({
      id: typeof body.id === "string" ? body.id : undefined,
      name: body.name,
      description: typeof body.description === "string" ? body.description : undefined,
      steps: body.steps as never,
    });

    return Response.json({ pipeline }, { status: 201 });
  } catch (error) {
    console.error("Pipeline save API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
