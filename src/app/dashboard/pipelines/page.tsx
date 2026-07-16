"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GitBranch, Loader2, Play, Save, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SettingsNavigation } from "@/components/settings-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { useBackgroundSync } from "@/hooks/use-background-sync";
import { useAppStore } from "@/store/app-store";
import type { PipelineDefinition, PipelineRun } from "@/lib/pipelines/types";

const EMPTY_STEPS = JSON.stringify(
  [
    {
      id: "agent-1",
      name: "Agent project step",
      projectId: "project-id-here",
      instructions: "Run this Eggent project as the next agent. Use previous artifacts as input and save handoff output in the artifacts directory."
    },
  ],
  null,
  2
);

function formatDate(value?: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed") return "destructive";
  if (status === "completed") return "secondary";
  if (status === "running") return "default";
  return "outline";
}

export default function PipelinesPage() {
  const { activeProjectId, currentPath, projects, setProjects } = useAppStore();
  const syncTick = useBackgroundSync({ topics: ["pipelines", "global"] });
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [runInput, setRunInput] = useState("Нужно выполнить цепочку агентов.");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("New pipeline");
  const [editDescription, setEditDescription] = useState("");
  const [editSteps, setEditSteps] = useState(EMPTY_STEPS);
  const [saving, setSaving] = useState(false);

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ?? pipelines[0],
    [pipelines, selectedPipelineId]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [pipelinesRes, runsRes, projectsRes] = await Promise.all([
          fetch("/api/pipelines"),
          fetch("/api/pipeline-runs"),
          fetch("/api/projects"),
        ]);
        const [pipelinesJson, runsJson, projectsJson] = await Promise.all([
          pipelinesRes.json(),
          runsRes.json(),
          projectsRes.json(),
        ]);
        if (cancelled) return;
        const nextPipelines = Array.isArray(pipelinesJson.pipelines)
          ? pipelinesJson.pipelines
          : [];
        setPipelines(nextPipelines);
        setRuns(Array.isArray(runsJson.runs) ? runsJson.runs : []);
        if (Array.isArray(projectsJson)) {
          setProjects(projectsJson);
        }
        if (!selectedPipelineId && nextPipelines[0]) {
          setSelectedPipelineId(nextPipelines[0].id);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load pipelines");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedPipelineId, setProjects, syncTick]);

  function createProjectSequenceTemplate() {
    const templateProjects = projects.length > 0 ? projects : [];
    const steps = templateProjects.slice(0, 3).map((project, index) => ({
      id: project.id,
      name: project.name,
      projectId: project.id,
      instructions:
        index === 0
          ? "Run this project agent first. Save the initial output in the artifacts directory."
          : "Run this project agent after previous project agents. Read artifacts and save your handoff output.",
    }));
    setEditSteps(JSON.stringify(steps.length > 0 ? steps : JSON.parse(EMPTY_STEPS), null, 2));
  }

  function beginEdit(pipeline?: PipelineDefinition) {
    setError(null);
    if (!pipeline) {
      setEditingId(null);
      setEditName("New pipeline");
      setEditDescription("");
      setEditSteps(EMPTY_STEPS);
      return;
    }
    setEditingId(pipeline.id);
    setEditName(pipeline.name);
    setEditDescription(pipeline.description || "");
    setEditSteps(JSON.stringify(pipeline.steps, null, 2));
  }

  async function savePipeline() {
    try {
      setSaving(true);
      setError(null);
      const steps = JSON.parse(editSteps);
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error("Steps must be a non-empty JSON array");
      }
      const payload = {
        id: editingId || undefined,
        name: editName,
        description: editDescription,
        steps,
      };
      const res = await fetch(editingId ? `/api/pipelines/${editingId}` : "/api/pipelines", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save pipeline");
      setSelectedPipelineId(json.pipeline.id);
      beginEdit(json.pipeline);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save pipeline");
    } finally {
      setSaving(false);
    }
  }

  async function deletePipeline(id: string) {
    if (!confirm("Delete this pipeline?")) return;
    try {
      setError(null);
      const res = await fetch(`/api/pipelines/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete pipeline");
      setEditingId(null);
      setSelectedPipelineId("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete pipeline");
    }
  }

  async function runPipeline() {
    const pipeline = selectedPipeline;
    if (!pipeline) return;
    try {
      setRunning(true);
      setError(null);
      const res = await fetch("/api/pipeline-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: pipeline.id,
          input: runInput,
          projectId: activeProjectId,
          currentPath,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start pipeline");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to start pipeline");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader title="Pipelines" />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-6">
              <SettingsNavigation />

              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <h2 className="flex items-center gap-2 text-2xl font-semibold">
                    <GitBranch className="size-6" /> Pipelines
                  </h2>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Reusable workflows that run selected Eggent projects one after another and pass artifacts between steps.
                  </p>
                </div>
                <Button variant="outline" onClick={() => beginEdit()} className="gap-2 md:self-start">
                  <GitBranch className="size-4" /> New pipeline
                </Button>
              </div>

              <Alert>
                <GitBranch className="size-4" />
                <AlertDescription>
                  Use pipelines when the same task needs multiple project agents in a fixed order. For a one-off chain, you can also ask Eggent in chat to run projects in sequence.
                </AlertDescription>
              </Alert>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Saved pipelines</CardTitle>
                      <CardDescription>Select a workflow to edit or run.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" /> Loading...
                        </div>
                      ) : pipelines.length === 0 ? (
                        <Empty className="border">
                          <EmptyHeader>
                            <EmptyMedia variant="icon"><GitBranch /></EmptyMedia>
                            <EmptyTitle>No pipelines yet</EmptyTitle>
                            <EmptyDescription>Create a chain of project agents to run repeatable workflows.</EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {pipelines.map((pipeline) => (
                            <button
                              key={pipeline.id}
                              onClick={() => {
                                setSelectedPipelineId(pipeline.id);
                                beginEdit(pipeline);
                              }}
                              className={`w-full rounded-lg border p-3 text-left text-sm transition hover:bg-muted/60 ${
                                selectedPipeline?.id === pipeline.id ? "border-primary bg-primary/5" : ""
                              }`}
                            >
                              <div className="font-medium">{pipeline.name}</div>
                              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {pipeline.description || `${pipeline.steps.length} steps`}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Run selected pipeline</CardTitle>
                      <CardDescription>Provide the initial task for the first step.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <Select value={selectedPipeline?.id || ""} onValueChange={setSelectedPipelineId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select pipeline" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {pipelines.map((pipeline) => (
                              <SelectItem key={pipeline.id} value={pipeline.id}>{pipeline.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={runInput}
                        onChange={(event) => setRunInput(event.target.value)}
                        className="min-h-28 field-sizing-fixed resize-y"
                        placeholder="Describe the task for this chain..."
                      />
                      <Button
                        className="w-full gap-2"
                        onClick={runPipeline}
                        disabled={!selectedPipeline || running}
                      >
                        {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                        Start run
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                  <Card className="min-w-0 overflow-hidden">
                    <CardHeader>
                      <CardTitle>Pipeline editor</CardTitle>
                      <CardDescription>Name the workflow and define the ordered project steps.</CardDescription>
                      <CardAction>
                        <div className="flex gap-2">
                          {editingId ? (
                            <Button size="sm" variant="outline" onClick={() => deletePipeline(editingId)}>
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                          <Button size="sm" className="gap-2" onClick={savePipeline} disabled={saving}>
                            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            Save
                          </Button>
                        </div>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="grid min-w-0 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="pipeline-name">Name</Label>
                        <Input id="pipeline-name" value={editName} onChange={(event) => setEditName(event.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="pipeline-description">Description</Label>
                        <Input
                          id="pipeline-description"
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                          placeholder="What this workflow is for"
                        />
                      </div>
                      <div className="min-w-0 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                        <div className="mb-2 font-medium text-foreground">Pipeline = sequence of Eggent projects</div>
                        <p>
                          Each step should set <code>projectId</code>. That project directory is launched as an Eggent agent with context.md, memory.md, skills/, .mcp.json and model.json.
                        </p>
                        {projects.length > 0 ? (
                          <div className="mt-2 break-words">
                            Available projects: {projects.map((project) => `${project.name} (${project.id})`).join(", ")}
                          </div>
                        ) : null}
                        <Button size="sm" variant="outline" className="mt-3" onClick={createProjectSequenceTemplate}>
                          Use current projects as sequence
                        </Button>
                      </div>
                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor="pipeline-steps">Steps JSON</Label>
                        <Textarea
                          id="pipeline-steps"
                          value={editSteps}
                          onChange={(event) => setEditSteps(event.target.value)}
                          className="min-h-80 w-full min-w-0 field-sizing-fixed resize-y overflow-auto font-mono text-xs"
                          spellCheck={false}
                        />
                        <p className="text-xs text-muted-foreground">
                          Each step needs a projectId. Steps run top-to-bottom and can read artifacts from previous steps.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="min-w-0 overflow-hidden">
                    <CardHeader>
                      <CardTitle>Run history</CardTitle>
                      <CardDescription>Recent pipeline executions and their step status.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {runs.length === 0 ? (
                        <Empty className="border">
                          <EmptyHeader>
                            <EmptyMedia variant="icon"><Play /></EmptyMedia>
                            <EmptyTitle>No runs yet</EmptyTitle>
                            <EmptyDescription>Run a pipeline to see its execution history here.</EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {runs.slice(0, 12).map((run) => (
                            <div key={run.id} className="rounded-lg border p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-medium">{run.pipelineId}</div>
                                <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                <Link className="underline-offset-2 hover:underline" href={`/dashboard/pipeline-runs/${run.id}`}>
                                  {run.id}
                                </Link>{" "}
                                · {formatDate(run.updatedAt)}
                              </div>
                              <div className="mt-2 space-y-1">
                                {run.steps.map((step) => (
                                  <div key={step.id} className="flex items-center justify-between gap-2 text-xs">
                                    <span>{step.name}{step.projectId ? ` · ${step.projectId}` : ""}</span>
                                    <Badge variant={statusVariant(step.status)}>{step.status}</Badge>
                                  </div>
                                ))}
                              </div>
                              {run.error ? <div className="mt-2 text-xs text-destructive">{run.error}</div> : null}
                              <div className="mt-2 truncate text-xs text-muted-foreground">
                                Artifacts: {run.artifactsDir}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
