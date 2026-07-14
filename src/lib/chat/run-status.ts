import { publishUiSyncEvent } from "@/lib/realtime/event-bus";

export interface ActiveChatRunStatus {
  chatId: string;
  projectId?: string | null;
  startedAt: string;
  updatedAt: string;
  phase: "starting" | "thinking" | "tool" | "finalizing";
  toolName?: string;
}

const activeChatRuns = new Map<string, ActiveChatRunStatus>();

function publishRunSync(status: ActiveChatRunStatus | { chatId: string; projectId?: string | null }) {
  publishUiSyncEvent({
    topic: "chat",
    chatId: status.chatId,
    projectId: status.projectId ?? null,
    reason: "chat_run_status_changed",
  });
}

export function startChatRun(chatId: string, projectId?: string | null): ActiveChatRunStatus {
  const now = new Date().toISOString();
  const status: ActiveChatRunStatus = {
    chatId,
    projectId: projectId ?? null,
    startedAt: now,
    updatedAt: now,
    phase: "starting",
  };
  activeChatRuns.set(chatId, status);
  publishRunSync(status);
  return status;
}

export function updateChatRun(
  chatId: string,
  patch: Partial<Pick<ActiveChatRunStatus, "phase" | "toolName">>
): ActiveChatRunStatus | null {
  const existing = activeChatRuns.get(chatId);
  if (!existing) return null;
  const next: ActiveChatRunStatus = {
    ...existing,
    ...patch,
    toolName: patch.toolName ?? (patch.phase === "tool" ? existing.toolName : undefined),
    updatedAt: new Date().toISOString(),
  };
  activeChatRuns.set(chatId, next);
  publishRunSync(next);
  return next;
}

export function finishChatRun(chatId: string): void {
  const existing = activeChatRuns.get(chatId);
  if (!existing) return;
  activeChatRuns.delete(chatId);
  publishRunSync(existing);
}

export function getActiveChatRun(chatId: string): ActiveChatRunStatus | null {
  return activeChatRuns.get(chatId) ?? null;
}

export function getActiveChatRuns(): ActiveChatRunStatus[] {
  return [...activeChatRuns.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
