"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileText, Loader2, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";

type FilePayload = {
  projectId: string;
  path: string;
  filename: string;
  content: string;
  size?: number;
  updatedAt?: string;
};

function formatFileSize(bytes?: number) {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function GenericFileEditorPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") || "none";
  const filePath = searchParams.get("path") || "";

  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [metadata, setMetadata] = useState<FilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadHref = useMemo(() => {
    const params = new URLSearchParams({ project: projectId, path: filePath });
    return `/api/files/download?${params.toString()}`;
  }, [projectId, filePath]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!filePath) {
        setError("No file selected.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setStatus(null);
      setError(null);
      try {
        const params = new URLSearchParams({ project: projectId, path: filePath });
        const res = await fetch(`/api/files/content?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load file");
        if (cancelled) return;
        const payload = json as FilePayload;
        setMetadata(payload);
        setContent(payload.content || "");
        setDraft(payload.content || "");
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, filePath]);

  async function save() {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const params = new URLSearchParams({ project: projectId, path: filePath });
      const res = await fetch(`/api/files/content?${params.toString()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save file");
      const payload = json as FilePayload;
      setMetadata(payload);
      setContent(payload.content || draft);
      setDraft(payload.content || draft);
      setStatus("File saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save file");
    } finally {
      setSaving(false);
    }
  }

  const dirty = draft !== content;
  const title = metadata?.filename || filePath.split("/").pop() || "File";

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader title="File Preview" />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto w-full">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">{title}</h2>
                <p className="break-all text-sm text-muted-foreground">
                  {projectId === "none" ? "Orchestrator" : `Project ${projectId}`} / {filePath}
                </p>
              </div>

              <section className="rounded-xl border bg-card p-4 md:p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <FileText className="mt-1 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">Text preview</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(metadata?.size)}{metadata?.updatedAt ? ` · Updated ${new Date(metadata.updatedAt).toLocaleString()}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" asChild className="gap-2">
                      <a href={downloadHref} download={title}>
                        <Download className="size-4" />
                        Download
                      </a>
                    </Button>
                    <Button onClick={save} disabled={loading || saving || !dirty} className="gap-2">
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Save
                    </Button>
                  </div>
                </div>

                {status ? <Badge variant="secondary">{status}</Badge> : null}
                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading file...
                  </div>
                ) : error ? null : (
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={saving}
                    rows={24}
                    className="min-h-[560px] font-mono text-sm"
                  />
                )}
              </section>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
