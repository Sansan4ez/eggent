import { NextRequest } from "next/server";
import { createEggentPiSession } from "@/lib/pi/session";

export const runtime = "nodejs";
export const maxDuration = 60;

function sourceLabel(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["label", "source", "location", "kind"]) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  let session: Awaited<ReturnType<typeof createEggentPiSession>> | undefined;
  try {
    const projectParam = req.nextUrl.searchParams.get("projectId");
    const projectId = projectParam && projectParam !== "none" ? projectParam : undefined;
    const currentPath = req.nextUrl.searchParams.get("currentPath") || undefined;

    session = await createEggentPiSession({
      projectId,
      cwd: currentPath,
      enableEggentTools: false,
    });

    const skills = session.resourceLoader.getSkills().skills.map((skill) => ({
      name: `skill:${skill.name}`,
      title: skill.name,
      description: skill.description,
      source: "skill" as const,
      location: sourceLabel(skill.sourceInfo),
      path: skill.filePath,
    }));

    const prompts = session.promptTemplates.map((prompt) => ({
      name: prompt.name,
      title: prompt.name,
      description: prompt.description,
      argumentHint: prompt.argumentHint,
      source: "prompt" as const,
      location: sourceLabel(prompt.sourceInfo),
      path: prompt.filePath,
    }));

    return Response.json({ commands: [...skills, ...prompts] });
  } catch (error) {
    console.error("Slash commands API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load commands" },
      { status: 500 }
    );
  } finally {
    session?.dispose();
  }
}
