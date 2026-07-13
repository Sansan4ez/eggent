import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getAllProjects, getWorkDir } from "@/lib/storage/project-store";

export const dynamic = "force-dynamic";

type PiScheduleFile = {
  version?: number;
  jobs?: PiScheduledSubagent[];
};

type PiScheduledSubagent = {
  id: string;
  name?: string;
  description?: string;
  schedule?: string;
  scheduleType?: "cron" | "once" | "interval";
  subagent_type?: string;
  prompt?: string;
  enabled?: boolean;
  createdAt?: string;
  lastRun?: string;
  lastStatus?: "success" | "error" | "running";
  nextRun?: string;
  runCount?: number;
};

async function readSchedulesForContext(context: { projectId: string | null; projectName: string; cwd: string }) {
  const scheduleDir = path.join(context.cwd, ".pi", "subagent-schedules");
  let entries: string[];
  try {
    entries = await fs.readdir(scheduleDir);
  } catch {
    return [];
  }

  const schedules = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const filePath = path.join(scheduleDir, entry);
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf-8")) as PiScheduleFile;
      const sessionId = entry.replace(/\.json$/, "");
      for (const job of parsed.jobs ?? []) {
        schedules.push({
          ...job,
          projectId: context.projectId,
          projectName: context.projectName,
          sessionId,
          storePath: filePath,
        });
      }
    } catch {
      // Ignore corrupt/stale schedule files; pi-subagents will repair on next save.
    }
  }
  return schedules;
}

export async function GET() {
  const projects = await getAllProjects();
  const contexts = [
    { projectId: null, projectName: "Orchestrator", cwd: getWorkDir(null) },
    ...projects.map((project) => ({ projectId: project.id, projectName: project.name, cwd: getWorkDir(project.id) })),
  ];

  const nested = await Promise.all(contexts.map(readSchedulesForContext));
  const schedules = nested.flat().sort((a, b) => {
    const aNext = a.nextRun ?? a.createdAt ?? "";
    const bNext = b.nextRun ?? b.createdAt ?? "";
    return aNext.localeCompare(bNext);
  });

  return NextResponse.json({ schedules });
}
