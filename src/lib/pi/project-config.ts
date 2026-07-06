import path from "path";
import {
  getProject,
  getWorkDir,
  loadProjectMcpServers,
  loadProjectSkillsMetadata,
} from "@/lib/storage/project-store";

export async function getEggentPiProjectConfig(projectId?: string | null) {
  const project = projectId ? await getProject(projectId) : null;
  const cwd = projectId ? getWorkDir(projectId) : getWorkDir(null);
  const skills = projectId ? await loadProjectSkillsMetadata(projectId) : [];
  const mcp = projectId ? await loadProjectMcpServers(projectId) : null;
  const memorySubdir = project?.memoryMode === "global" ? "main" : projectId || "main";
  const knowledgeSubdirs = projectId ? [projectId, "main"] : ["main"];

  return {
    projectId: projectId || null,
    project,
    pi: {
      cwd,
      contextFile: projectId
        ? path.join(cwd, "EGGENT_PROJECT_CONTEXT.md")
        : path.join(cwd, "EGGENT_GLOBAL_CONTEXT.md"),
      instructions: project?.instructions || "",
      skills: skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        skillDir: skill.skillDir,
        skillFile: path.join(skill.skillDir, "SKILL.md"),
      })),
      mcpServers: mcp?.servers ?? [],
      memorySubdir,
      knowledgeSubdirs,
      bridgeTools: [
        "eggent_memory_search",
        "eggent_memory_save",
        "eggent_memory_delete",
        "eggent_knowledge_query",
        "eggent_mcp_*",
        "eggent_list_pipelines",
        "eggent_start_pipeline",
      ],
    },
  };
}
