"use client";

import { useEffect, useState } from "react";
import { BookText, Loader2, Puzzle, Wrench } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ProjectSkillItem {
  name: string;
  description: string;
  content: string;
  license?: string;
  compatibility?: string;
}

interface ProjectContextSectionProps {
  projectId: string;
}

const EMPTY_MCP_JSON = JSON.stringify({ mcpServers: {} }, null, 2);

export function ProjectContextSection({ projectId }: ProjectContextSectionProps) {
  const [mcpContent, setMcpContent] = useState<string | null>(null);
  const [mcpDraft, setMcpDraft] = useState(EMPTY_MCP_JSON);
  const [mcpLoading, setMcpLoading] = useState(true);
  const [mcpSaving, setMcpSaving] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<string | null>(null);
  const [mcpStatusTone, setMcpStatusTone] = useState<"success" | "error" | null>(
    null
  );

  const [skills, setSkills] = useState<ProjectSkillItem[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  const [selectedSkill, setSelectedSkill] = useState<ProjectSkillItem | null>(null);
  const [skillSheetOpen, setSkillSheetOpen] = useState(false);

  useEffect(() => {
    async function loadContext() {
      setMcpLoading(true);
      setSkillsLoading(true);
      setMcpStatus(null);
      setMcpStatusTone(null);

      try {
        const [mcpRes, skillsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/mcp`),
          fetch(`/api/projects/${projectId}/skills`),
        ]);

        if (mcpRes.ok) {
          const mcpData = await mcpRes.json();
          const content =
            typeof mcpData.content === "string" ? mcpData.content : null;
          setMcpContent(content);
          setMcpDraft(content ?? EMPTY_MCP_JSON);
        } else {
          setMcpContent(null);
          setMcpDraft(EMPTY_MCP_JSON);
        }

        if (skillsRes.ok) {
          const skillsData = await skillsRes.json();
          if (Array.isArray(skillsData)) {
            setSkills(
              skillsData.map((skill) => ({
                name: typeof skill.name === "string" ? skill.name : "unknown-skill",
                description: typeof skill.description === "string" ? skill.description : "",
                content: typeof skill.content === "string" ? skill.content : "",
                license: typeof skill.license === "string" ? skill.license : undefined,
                compatibility:
                  typeof skill.compatibility === "string"
                    ? skill.compatibility
                    : undefined,
              }))
            );
          } else {
            setSkills([]);
          }
        } else {
          setSkills([]);
        }
      } catch {
        setMcpContent(null);
        setMcpDraft(EMPTY_MCP_JSON);
        setSkills([]);
      } finally {
        setMcpLoading(false);
        setSkillsLoading(false);
      }
    }

    loadContext();
  }, [projectId]);

  function handleOpenSkill(skill: ProjectSkillItem) {
    setSelectedSkill(skill);
    setSkillSheetOpen(true);
  }

  async function handleSaveMcp() {
    try {
      setMcpSaving(true);
      setMcpStatus(null);
      setMcpStatusTone(null);

      const res = await fetch(`/api/projects/${projectId}/mcp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: mcpDraft }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Failed to save MCP config"
        );
      }

      const content =
        typeof payload?.content === "string" ? payload.content : mcpDraft;
      setMcpContent(content);
      setMcpDraft(content);
      setMcpStatus("MCP configuration saved.");
      setMcpStatusTone("success");
    } catch (error) {
      setMcpStatus(
        error instanceof Error ? error.message : "Failed to save MCP config"
      );
      setMcpStatusTone("error");
    } finally {
      setMcpSaving(false);
    }
  }

  const mcpBaseline = mcpContent ?? EMPTY_MCP_JSON;
  const mcpDirty = mcpDraft !== mcpBaseline;
  const mcpCanSave = mcpContent === null || mcpDirty;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Wrench className="size-4 text-primary" />
              <h4 className="text-sm font-medium">MCP Servers</h4>
            </div>
          </div>

          {mcpLoading ? (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Loading MCP config...
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {!mcpContent && (
                <p className="text-xs text-muted-foreground">
                  No `.mcp.json` found for this project. Save to create it.
                </p>
              )}
              {mcpStatus ? (
                mcpStatusTone === "error" ? (
                  <Alert variant="destructive">
                    <AlertDescription>{mcpStatus}</AlertDescription>
                  </Alert>
                ) : (
                  <Badge variant="secondary">{mcpStatus}</Badge>
                )
              ) : null}
              <Textarea
                value={mcpDraft}
                onChange={(e) => setMcpDraft(e.target.value)}
                placeholder='{"mcpServers": {}}'
                rows={10}
                disabled={mcpSaving}
                className="min-h-64 font-mono text-xs"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveMcp}
                  disabled={mcpSaving || !mcpCanSave}
                  className="gap-2"
                >
                  {mcpSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMcpDraft(mcpBaseline)}
                  disabled={mcpSaving || !mcpDirty}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="border rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Puzzle className="size-4 text-primary" />
              <h4 className="text-sm font-medium">Project Skills</h4>
            </div>
            {!skillsLoading && (
              <span className="text-xs text-muted-foreground">
                {skills.length} total
              </span>
            )}
          </div>

          {skillsLoading ? (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Loading skills...
            </div>
          ) : skills.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Puzzle /></EmptyMedia>
                <EmptyTitle>No skills configured</EmptyTitle>
                <EmptyDescription>Project skills will appear here after installation.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y">
              {skills.map((skill) => (
                <button
                  key={skill.name}
                  type="button"
                  className="w-full p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => handleOpenSkill(skill)}
                >
                  <div className="bg-primary/10 p-2 rounded shrink-0 mt-0.5">
                    <BookText className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{skill.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {skill.description || "No description"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={skillSheetOpen} onOpenChange={setSkillSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
          <SheetHeader>
            <SheetTitle className="truncate pr-8">
              Skill: {selectedSkill?.name ?? ""}
            </SheetTitle>
            <SheetDescription>
              {selectedSkill?.description || "Skill instructions"}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <pre className="rounded-lg border bg-muted/30 p-3 text-sm font-mono whitespace-pre-wrap break-words">
              {selectedSkill?.content || "No skill content."}
            </pre>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
