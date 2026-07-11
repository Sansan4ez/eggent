"use client";

import { useParams } from "next/navigation";
import { ProjectFileEditor } from "@/components/project-file-editor";
import { ProjectPageShell } from "@/components/project-page-shell";

export default function ProjectMcpPage() {
  const { id } = useParams();
  const projectId = id as string;
  return (
    <ProjectPageShell projectId={projectId} title="Project MCP" description="Edit .mcp.json for this project only.">
      <ProjectFileEditor
        projectId={projectId}
        endpoint="mcp"
        filename=".mcp.json"
        title=".mcp.json"
        description='Cursor-compatible MCP config for pi-mcp-adapter: { "mcpServers": { ... } }. Tools are available through the mcp proxy tool.'
        rows={18}
      />
    </ProjectPageShell>
  );
}
