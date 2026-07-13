import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getWorkDir } from "@/lib/storage/project-store";
import { publishUiSyncEvent } from "@/lib/realtime/event-bus";

function resolveSafeDir(projectId: string, dirPath: string) {
  const workDir = getWorkDir(projectId);
  const resolvedWorkDir = path.resolve(workDir);
  const resolvedDir = path.resolve(workDir, dirPath || ".");
  if (resolvedDir !== resolvedWorkDir && !resolvedDir.startsWith(resolvedWorkDir + path.sep)) {
    throw new Error("Invalid directory path");
  }
  return resolvedDir;
}

function safeFileName(name: string) {
  return path.basename(name).replace(/[\0]/g, "").trim();
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const projectId = String(formData.get("project") || "");
  const dirPath = String(formData.get("path") || "");
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (!projectId) {
    return Response.json({ error: "Project ID required" }, { status: 400 });
  }
  if (files.length === 0) {
    return Response.json({ error: "No files provided" }, { status: 400 });
  }

  let targetDir: string;
  try {
    targetDir = resolveSafeDir(projectId, dirPath);
  } catch {
    return Response.json({ error: "Invalid directory path" }, { status: 403 });
  }

  await fs.mkdir(targetDir, { recursive: true });

  const uploaded: Array<{ name: string; path: string; size: number }> = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const file of files) {
    const fileName = safeFileName(file.name);
    if (!fileName) {
      errors.push({ name: file.name || "(unnamed)", error: "Invalid filename" });
      continue;
    }

    const targetPath = path.join(targetDir, fileName);
    const relativePath = path.posix.join(dirPath.replace(/\\/g, "/"), fileName).replace(/^\.\//, "");
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(targetPath, buffer, { flag: "wx" });
      uploaded.push({ name: fileName, path: relativePath, size: buffer.length });
    } catch (error) {
      const message = error instanceof Error && "code" in error && error.code === "EEXIST"
        ? "File already exists"
        : "Failed to write file";
      errors.push({ name: fileName, error: message });
    }
  }

  if (uploaded.length > 0) {
    publishUiSyncEvent({
      topic: "files",
      projectId: projectId === "none" ? null : projectId,
      reason: "files_uploaded",
    });
  }

  return Response.json({ uploaded, errors });
}
