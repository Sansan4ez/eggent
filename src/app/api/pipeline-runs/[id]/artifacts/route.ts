import fs from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { getPipelineRun } from "@/lib/pipelines/store";

export const runtime = "nodejs";

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      if (entry.isFile()) files.push(path.relative(root, fullPath));
    }
  }
  try {
    await walk(root);
  } catch {
    return [];
  }
  return files.sort();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await getPipelineRun(id);
  if (!run) {
    return Response.json({ error: "Pipeline run not found" }, { status: 404 });
  }

  const artifact = req.nextUrl.searchParams.get("path");
  const root = path.resolve(run.artifactsDir);

  if (!artifact) {
    return Response.json({ artifacts: await listFiles(root) });
  }

  const fullPath = path.resolve(root, artifact);
  if (!isInside(root, fullPath)) {
    return Response.json({ error: "Invalid artifact path" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(fullPath, "utf-8");
    return Response.json({ path: artifact, content });
  } catch {
    return Response.json({ error: "Artifact not found or not text" }, { status: 404 });
  }
}
