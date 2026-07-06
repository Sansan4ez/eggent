import fs from "fs/promises";
import path from "path";

export async function ensureArtifactsDir(artifactsDir: string): Promise<void> {
  await fs.mkdir(artifactsDir, { recursive: true });
}

export async function listArtifacts(artifactsDir: string): Promise<string[]> {
  const result: string[] = [];

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        result.push(fullPath);
      }
    }
  }

  await walk(artifactsDir);
  return result.sort();
}
