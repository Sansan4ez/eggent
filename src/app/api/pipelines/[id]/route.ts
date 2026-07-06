import { NextRequest } from "next/server";
import {
  deletePipelineDefinition,
  getPipelineDefinition,
  upsertPipelineDefinition,
} from "@/lib/pipelines/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pipeline = await getPipelineDefinition(id);
  if (!pipeline) {
    return Response.json({ error: "Pipeline not found" }, { status: 404 });
  }
  return Response.json({ pipeline });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    if (!Array.isArray(body.steps) || body.steps.length === 0) {
      return Response.json({ error: "steps are required" }, { status: 400 });
    }

    const existing = await getPipelineDefinition(id);
    const pipeline = await upsertPipelineDefinition({
      id,
      name: body.name,
      description: typeof body.description === "string" ? body.description : undefined,
      steps: body.steps as never,
      createdAt: existing?.createdAt,
    });

    return Response.json({ pipeline });
  } catch (error) {
    console.error("Pipeline update API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deletePipelineDefinition(id);
  if (!deleted) {
    return Response.json({ error: "Pipeline not found" }, { status: 404 });
  }
  return Response.json({ success: true });
}
