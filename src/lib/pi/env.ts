import fs from "fs";
import os from "os";
import path from "path";

/**
 * Eggent embeds the pi SDK. If the deployer set PI_CODING_AGENT_DIR explicitly
 * (Docker does this), respect it. Otherwise, local development should mirror
 * the user's existing pi CLI config so /dashboard/settings shows the same
 * auth.json, models.json, and settings.json as terminal pi. Fresh installs that
 * do not have ~/.pi/agent yet fall back to Eggent's local data directory.
 */
if (!process.env.PI_CODING_AGENT_DIR?.trim()) {
  const globalPiAgentDir = path.join(os.homedir(), ".pi", "agent");
  process.env.PI_CODING_AGENT_DIR = fs.existsSync(globalPiAgentDir)
    ? globalPiAgentDir
    : path.join(process.cwd(), "data", "pi-agent");
}
