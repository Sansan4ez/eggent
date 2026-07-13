import { createUIMessageStream } from "ai";
import type { UIMessage } from "ai";
import { createEggentPiSession } from "@/lib/pi/session";
import { retainPiScheduleSession, takeRetainedPiScheduleSession } from "@/lib/pi/schedule-host";
import type { PiChatRunOptions, PiToolRecord } from "@/lib/pi/types";
import { getChat, saveChat } from "@/lib/storage/chat-store";
import type { ChatMessage } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function stringifyForDisplay(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  const content = record?.content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        const part = asRecord(item);
        return typeof part?.text === "string" ? part.text : "";
      })
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getToolArgs(event: Record<string, unknown>) {
  return event.args ?? event.input ?? {};
}

function getToolResult(event: Record<string, unknown>) {
  return event.result ?? event.output ?? event.partialResult ?? "";
}

function normalizeToolInput(input: unknown): Record<string, unknown> {
  return asRecord(input) ?? {};
}

function hasScheduleManagementIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  const mentionsSchedules =
    /\b(scheduled|schedule|schedules|reminders?|jobs?)\b/.test(normalized) ||
    /(запланирован|расписани|напоминани|задач)/i.test(text);
  const managementVerb =
    /\b(cancel|delete|remove|clear|list|show|what|which)\b/.test(normalized) ||
    /(убери|удали|отмени|очисти|покажи|выведи|какие|список)/i.test(text);
  return mentionsSchedules && managementVerb;
}

function hasScheduleIntent(text: string): boolean {
  if (hasScheduleManagementIntent(text)) return false;
  const normalized = text.toLowerCase();
  return (
    /\b(in|after)\s+\d+\s*(seconds?|secs?|minutes?|mins?|hours?|days?)\b/.test(normalized) ||
    /\b(tomorrow|tonight|daily|weekly|monthly|every\s+\w+|remind\s+me|schedule)\b/.test(normalized) ||
    /\b(at)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/.test(normalized) ||
    /через\s+\d+\s*(секунд[уы]?|сек\.?|минут[уы]?|мин\.?|час(а|ов)?|дн(я|ей)?)/i.test(text) ||
    /(завтра|послезавтра|сегодня\s+в|напомни|напомнить|по\s+расписанию|кажд(ый|ую|ое)|ежедневно|еженедельно)/i.test(text)
  );
}

function applySchedulingToolPolicy(
  session: {
    getActiveToolNames: () => string[];
    setActiveToolsByName: (toolNames: string[]) => void;
    getToolDefinition?: (toolName: string) => unknown;
  },
  text: string
) {
  const activeTools = session.getActiveToolNames();
  if (hasScheduleManagementIntent(text)) {
    session.setActiveToolsByName(activeTools.filter((toolName) => toolName !== "Agent" && toolName !== "bash"));
    return;
  }
  if (hasScheduleIntent(text)) {
    if (activeTools.includes("bash")) {
      session.setActiveToolsByName(activeTools.filter((toolName) => toolName !== "bash"));
    }
    return;
  }

  // If a retained scheduler session was previously used for a scheduling turn,
  // restore bash for ordinary follow-up work.
  if (!activeTools.includes("bash") && session.getToolDefinition?.("bash")) {
    session.setActiveToolsByName([...activeTools, "bash"]);
  }
}

function withSchedulingDirective(text: string): string {
  if (hasScheduleManagementIntent(text)) {
    return [
      "Eggent schedule-management directive:",
      "- This user request asks to inspect or modify existing scheduled tasks.",
      "- Do not create a new scheduled Agent for this request.",
      "- Use eggent_manage_schedules with action=\"list\" or action=\"clear\".",
      "- For requests like 'убери все запланированные задачи', call eggent_manage_schedules with action=\"clear\" and scope=\"all\" unless the user explicitly says current project only.",
      "",
      "User request:",
      text,
    ].join("\n");
  }

  if (!hasScheduleIntent(text)) return text;
  return [
    "Eggent scheduling directive:",
    "- This user request asks for delayed/scheduled execution.",
    "- Do not emulate scheduling with bash, sleep, shell loops, at, or OS cron.",
    "- Use pi-subagents by calling the Agent tool with its schedule parameter (for example schedule=\"+30s\" or a 6-field cron expression).",
    "- The scheduled Agent prompt should contain the actual work to perform at fire time.",
    "",
    "User request:",
    text,
  ].join("\n");
}

async function persistUserMessage(options: PiChatRunOptions, userMessageId: string) {
  const chat = await getChat(options.chatId);
  if (!chat) return;

  if (chat.messages.some((message) => message.id === userMessageId)) return;

  const now = new Date().toISOString();
  chat.messages.push({
    id: userMessageId,
    role: "user",
    content: options.userMessage,
    createdAt: now,
  });

  const userMessageCount = chat.messages.filter((message) => message.role === "user").length;
  if (userMessageCount === 1 && chat.title === "New Chat") {
    chat.title =
      options.userMessage.slice(0, 60) +
      (options.userMessage.length > 60 ? "..." : "");
  }

  chat.updatedAt = now;
  await saveChat(chat);
}

async function persistAssistantMessage(options: {
  chatId: string;
  assistantText: string;
  tools: PiToolRecord[];
}) {
  const chat = await getChat(options.chatId);
  if (!chat) return;

  const now = new Date().toISOString();
  const completedTools = options.tools.filter((tool) => tool.status !== "running");

  if (options.assistantText.trim() || completedTools.length > 0) {
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: options.assistantText,
      createdAt: now,
      toolCalls: completedTools.map((tool) => ({
        toolCallId: tool.toolCallId,
        toolName: tool.toolName,
        args: normalizeToolInput(tool.input),
      })),
    };
    chat.messages.push(assistantMessage);

    for (const tool of completedTools) {
      chat.messages.push({
        id: crypto.randomUUID(),
        role: "tool",
        content: stringifyForDisplay(tool.output),
        createdAt: now,
        toolName: tool.toolName,
        toolCallId: tool.toolCallId,
        toolResult: tool.output,
      });
    }
  }

  chat.updatedAt = now;
  await saveChat(chat);
}

export async function runPiAgentText(options: PiChatRunOptions & { runtimeData?: Record<string, unknown> }): Promise<string> {
  const userMessageId = crypto.randomUUID();
  const prompt = options.runtimeData
    ? `${options.userMessage}\n\nRuntime data:\n${JSON.stringify(options.runtimeData, null, 2)}`
    : options.userMessage;

  await persistUserMessage({ ...options, userMessage: prompt }, userMessageId);

  const session = takeRetainedPiScheduleSession(options.chatId) ?? await createEggentPiSession({
    cwd: options.cwd,
    agentDir: options.agentDir,
    tools: options.tools,
    chatId: options.chatId,
    projectId: options.projectId,
  });

  let assistantText = "";
  const tools = new Map<string, PiToolRecord>();

  const unsubscribe = session.subscribe((event: unknown) => {
    const record = asRecord(event);
    if (!record) return;

    if (record.type === "message_update") {
      const assistantEvent = asRecord(record.assistantMessageEvent);
      if (assistantEvent?.type === "text_delta" && typeof assistantEvent.delta === "string") {
        assistantText += assistantEvent.delta;
      }
      return;
    }

    if (record.type === "tool_execution_start") {
      const toolCallId =
        typeof record.toolCallId === "string" ? record.toolCallId : crypto.randomUUID();
      const toolName = typeof record.toolName === "string" ? record.toolName : "tool";
      tools.set(toolCallId, {
        toolCallId,
        toolName,
        input: getToolArgs(record),
        status: "running",
      });
      return;
    }

    if (record.type === "tool_execution_end") {
      const toolCallId =
        typeof record.toolCallId === "string" ? record.toolCallId : crypto.randomUUID();
      const toolName = typeof record.toolName === "string" ? record.toolName : "tool";
      const existing = tools.get(toolCallId);
      tools.set(toolCallId, {
        toolCallId,
        toolName,
        input: existing?.input ?? {},
        output: getToolResult(record),
        status: record.isError === true ? "error" : "completed",
      });
    }
  });

  try {
    applySchedulingToolPolicy(session, prompt);
    await session.prompt(withSchedulingDirective(prompt));
    await persistAssistantMessage({
      chatId: options.chatId,
      assistantText,
      tools: [...tools.values()],
    });
    return assistantText;
  } finally {
    unsubscribe();
    const retained = await retainPiScheduleSession({
      chatId: options.chatId,
      projectId: options.projectId,
      session,
    });
    if (!retained) session.dispose();
  }
}

export function createPiChatUIMessageStream(options: PiChatRunOptions) {
  const userMessageId = crypto.randomUUID();

  return createUIMessageStream<UIMessage>({
    async execute({ writer }) {
      await persistUserMessage(options, userMessageId);

      const session = takeRetainedPiScheduleSession(options.chatId) ?? await createEggentPiSession({
        cwd: options.cwd,
        agentDir: options.agentDir,
        tools: options.tools,
        chatId: options.chatId,
        projectId: options.projectId,
      });

      let assistantText = "";
      let textStarted = false;
      const textId = `pi-text-${crypto.randomUUID()}`;
      const tools = new Map<string, PiToolRecord>();

      const ensureTextStarted = () => {
        if (textStarted) return;
        textStarted = true;
        writer.write({ type: "text-start", id: textId });
      };

      const unsubscribe = session.subscribe((event: unknown) => {
        const record = asRecord(event);
        if (!record) return;

        if (record.type === "message_update") {
          const assistantEvent = asRecord(record.assistantMessageEvent);
          if (assistantEvent?.type === "text_delta" && typeof assistantEvent.delta === "string") {
            ensureTextStarted();
            assistantText += assistantEvent.delta;
            writer.write({ type: "text-delta", id: textId, delta: assistantEvent.delta });
          }
          return;
        }

        if (record.type === "tool_execution_start") {
          const toolCallId =
            typeof record.toolCallId === "string" ? record.toolCallId : crypto.randomUUID();
          const toolName = typeof record.toolName === "string" ? record.toolName : "tool";
          const input = getToolArgs(record);
          tools.set(toolCallId, {
            toolCallId,
            toolName,
            input,
            status: "running",
          });
          writer.write({
            type: "tool-input-available",
            toolCallId,
            toolName,
            input,
            dynamic: true,
          });
          return;
        }

        if (record.type === "tool_execution_end") {
          const toolCallId =
            typeof record.toolCallId === "string" ? record.toolCallId : crypto.randomUUID();
          const toolName = typeof record.toolName === "string" ? record.toolName : "tool";
          const output = getToolResult(record);
          const isError = record.isError === true;
          const existing = tools.get(toolCallId);
          tools.set(toolCallId, {
            toolCallId,
            toolName,
            input: existing?.input ?? {},
            output,
            status: isError ? "error" : "completed",
          });

          if (isError) {
            writer.write({
              type: "tool-output-error",
              toolCallId,
              errorText: stringifyForDisplay(output),
              dynamic: true,
            });
          } else {
            writer.write({
              type: "tool-output-available",
              toolCallId,
              output: stringifyForDisplay(output),
              dynamic: true,
            });
          }
        }
      });

      try {
        applySchedulingToolPolicy(session, options.userMessage);
        await session.prompt(withSchedulingDirective(options.userMessage));
        if (textStarted) {
          writer.write({ type: "text-end", id: textId });
        }
        await persistAssistantMessage({
          chatId: options.chatId,
          assistantText,
          tools: [...tools.values()],
        });
      } finally {
        unsubscribe();
        const retained = await retainPiScheduleSession({
          chatId: options.chatId,
          projectId: options.projectId,
          session,
        });
        if (!retained) session.dispose();
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      return message || "pi chat failed";
    },
  });
}
