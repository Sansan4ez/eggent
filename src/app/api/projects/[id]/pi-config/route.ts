import { NextRequest } from "next/server";
import { getEggentPiProjectConfig } from "@/lib/pi/project-config";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = await getEggentPiProjectConfig(id === "none" ? null : id);
  if (id !== "none" && !config.project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  return Response.json(config);
}
