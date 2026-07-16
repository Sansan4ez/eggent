"use client";

import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Loader2, Terminal, Wrench } from "lucide-react";
import { useAppStore } from "@/store/app-store";

interface McpServerItem {
  id: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
}

function normalizeServers(input: unknown): McpServerItem[] {
  if (!Array.isArray(input)) return [];

  const servers: McpServerItem[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    const transport = raw.transport;

    if (!id || (transport !== "stdio" && transport !== "http")) continue;

    if (transport === "stdio") {
      servers.push({
        id,
        transport,
        command: typeof raw.command === "string" ? raw.command : undefined,
        args: Array.isArray(raw.args)
          ? raw.args.filter((arg): arg is string => typeof arg === "string")
          : undefined,
        env:
          raw.env && typeof raw.env === "object" && !Array.isArray(raw.env)
            ? Object.fromEntries(
                Object.entries(raw.env).filter(
                  ([key, value]) =>
                    typeof key === "string" && typeof value === "string"
                )
              )
            : undefined,
        cwd: typeof raw.cwd === "string" ? raw.cwd : undefined,
      });
    } else {
      servers.push({
        id,
        transport,
        url: typeof raw.url === "string" ? raw.url : undefined,
        headers:
          raw.headers &&
          typeof raw.headers === "object" &&
          !Array.isArray(raw.headers)
            ? Object.fromEntries(
                Object.entries(raw.headers).filter(
                  ([key, value]) =>
                    typeof key === "string" && typeof value === "string"
                )
              )
            : undefined,
      });
    }
  }

  return servers;
}

const EMPTY_MCP_JSON = JSON.stringify({ mcpServers: {} }, null, 2);

export default function McpPage() {
  const { projects, setProjects, activeProjectId } = useAppStore();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [servers, setServers] = useState<McpServerItem[]>([]);
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState(EMPTY_MCP_JSON);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId("");
      return;
    }

    const hasCurrent = projects.some((project) => project.id === selectedProjectId);
    if (hasCurrent) return;

    const activeFromSidebar = activeProjectId
      ? projects.find((project) => project.id === activeProjectId)
      : null;

    if (activeFromSidebar) {
      setSelectedProjectId(activeFromSidebar.id);
      return;
    }

    setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId, activeProjectId]);

  useEffect(() => {
    loadProjectMcp(selectedProjectId);
  }, [selectedProjectId]);

  async function loadProjects() {
    try {
      setProjectsLoading(true);
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadProjectMcp(projectId: string) {
    if (!projectId) {
      setServers([]);
      setRawContent(null);
      setDraftContent(EMPTY_MCP_JSON);
      setStatusMessage(null);
      setStatusTone(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setStatusMessage(null);
      setStatusTone(null);
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/mcp`);
      const payload = await res.json();

      if (!res.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Failed to load MCP servers";
        setStatusMessage(message);
        setStatusTone("error");
        setServers([]);
        setRawContent(null);
        setDraftContent(EMPTY_MCP_JSON);
        return;
      }

      const content =
        typeof payload?.content === "string" ? payload.content : null;
      setRawContent(content);
      setDraftContent(content ?? EMPTY_MCP_JSON);
      setServers(normalizeServers(payload?.servers));
    } catch {
      setStatusMessage("Failed to load MCP servers");
      setStatusTone("error");
      setServers([]);
      setRawContent(null);
      setDraftContent(EMPTY_MCP_JSON);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRawContent() {
    if (!selectedProjectId) return;

    try {
      setSaving(true);
      setStatusMessage(null);
      setStatusTone(null);

      const res = await fetch(
        `/api/projects/${encodeURIComponent(selectedProjectId)}/mcp`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draftContent }),
        }
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Failed to save MCP servers"
        );
      }

      const content =
        typeof payload?.content === "string" ? payload.content : draftContent;
      setRawContent(content);
      setDraftContent(content);
      setServers(normalizeServers(payload?.servers));
      setStatusMessage("MCP configuration saved.");
      setStatusTone("success");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to save MCP servers"
      );
      setStatusTone("error");
    } finally {
      setSaving(false);
    }
  }

  const baselineContent = rawContent ?? EMPTY_MCP_JSON;
  const hasDraftChanges = draftContent !== baselineContent;
  const canSaveDraft = rawContent === null || hasDraftChanges;

  const filteredServers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return servers;

    return servers.filter((server) => {
      const parts = [server.id, server.transport, server.command, server.url]
        .filter((value): value is string => typeof value === "string")
        .join("\n")
        .toLowerCase();
      return parts.includes(query);
    });
  }, [servers, search]);

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader title="MCP" />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto w-full">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">MCP Servers</h2>
                <p className="text-sm text-muted-foreground">
                  View and edit MCP servers configured for each project from
                  <span className="font-mono"> .mcp.json </span>
                  and switch between projects. Runtime access is provided by Eggent.
                </p>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  disabled={projectsLoading || projects.length === 0}
                >
                  <SelectTrigger className="md:w-96">
                    <SelectValue placeholder={projectsLoading ? "Loading projects..." : "Select project"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name} ({project.id})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search MCP servers..."
                  className="md:max-w-sm"
                />
              </div>

              {statusMessage ? (
                <Alert variant={statusTone === "error" ? "destructive" : "default"}>
                  <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
              ) : null}

              <div className="rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="size-4 text-primary" />
                    <h3 className="text-sm font-medium">Servers In Project</h3>
                  </div>
                  {!loading && selectedProjectId && (
                    <span className="text-xs text-muted-foreground">
                      {servers.length} total
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Loading MCP servers...
                  </div>
                ) : !selectedProjectId ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Wrench /></EmptyMedia>
                      <EmptyTitle>Select a project</EmptyTitle>
                      <EmptyDescription>Choose a project to view MCP servers.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : filteredServers.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Wrench /></EmptyMedia>
                      <EmptyTitle>No MCP servers</EmptyTitle>
                      <EmptyDescription>Servers configured in .mcp.json will appear here.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="divide-y">
                    {filteredServers.map((server) => (
                      <div key={server.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {server.transport === "http" ? (
                              <Globe className="size-4 text-primary shrink-0" />
                            ) : (
                              <Terminal className="size-4 text-primary shrink-0" />
                            )}
                            <p className="font-medium truncate">{server.id}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0">{server.transport}</Badge>
                        </div>

                        {server.transport === "stdio" ? (
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>
                              Command: <span className="font-mono">{server.command || "-"}</span>
                            </p>
                            {server.args && server.args.length > 0 ? (
                              <p>
                                Args: <span className="font-mono">{server.args.join(" ")}</span>
                              </p>
                            ) : null}
                            {server.cwd ? (
                              <p>
                                CWD: <span className="font-mono">{server.cwd}</span>
                              </p>
                            ) : null}
                            {server.env && Object.keys(server.env).length > 0 ? (
                              <details className="pt-1">
                                <summary className="cursor-pointer text-xs">
                                  Environment ({Object.keys(server.env).length})
                                </summary>
                                <pre className="mt-2 rounded border bg-muted/30 p-2 text-xs font-mono whitespace-pre-wrap break-words">
                                  {JSON.stringify(server.env, null, 2)}
                                </pre>
                              </details>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>
                              URL: <span className="font-mono">{server.url || "-"}</span>
                            </p>
                            {server.headers && Object.keys(server.headers).length > 0 ? (
                              <details className="pt-1">
                                <summary className="cursor-pointer text-xs">
                                  Headers ({Object.keys(server.headers).length})
                                </summary>
                                <pre className="mt-2 rounded border bg-muted/30 p-2 text-xs font-mono whitespace-pre-wrap break-words">
                                  {JSON.stringify(server.headers, null, 2)}
                                </pre>
                              </details>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedProjectId ? (
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="text-sm font-medium">Raw .mcp.json</h3>
                    {!loading && (
                      <span className="text-xs text-muted-foreground">
                        Edit JSON directly
                      </span>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    {!loading && !rawContent && (
                      <p className="text-xs text-muted-foreground">
                        `.mcp.json` does not exist yet for this project. Save to create it.
                      </p>
                    )}
                    <Textarea
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      placeholder='{"mcpServers": {}}'
                      rows={10}
                      disabled={loading || saving}
                      className="min-h-64 font-mono text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleSaveRawContent}
                        disabled={loading || saving || !canSaveDraft}
                        className="gap-2"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save .mcp.json"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setDraftContent(baselineContent)}
                        disabled={loading || saving || !hasDraftChanges}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
