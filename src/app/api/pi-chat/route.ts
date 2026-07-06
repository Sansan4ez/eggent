import { createUIMessageStreamResponse } from "ai";
import { NextRequest } from "next/server";
import { createPiChatUIMessageStream } from "@/lib/pi/chat-runner";
import { createChat, getChat } from "@/lib/storage/chat-store";

export const runtime = "nodejs";
export const maxDuration = 300;

function extractMessage(body: Record<string, unknown>): string | undefined {
  if (typeof body.message === "string") return body.message;

  if (!Array.isArray(body.messages)) return undefined;

  const lastUserMessage = [...body.messages]
    .reverse()
    .find((message): message is Record<string, unknown> => {
      return (
        typeof message === "object" &&
        message !== null &&
        !Array.isArray(message) &&
        message.role === "user"
      );
    });

  if (!lastUserMessage) return undefined;
  if (typeof lastUserMessage.content === "string") return lastUserMessage.content;

  if (Array.isArray(lastUserMessage.parts)) {
    return lastUserMessage.parts
      .map((part) => {
        if (typeof part !== "object" || part === null || Array.isArray(part)) return "";
        const record = part as Record<string, unknown>;
        return record.type === "text" && typeof record.text === "string" ? record.text : "";
      })
      .join("");
  }

  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const message = extractMessage(body);

    if (!message?.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
    const currentPath = typeof body.currentPath === "string" ? body.currentPath : undefined;

    let chatId = typeof body.chatId === "string" && body.chatId.trim() ? body.chatId : undefined;
    if (!chatId) {
      chatId = crypto.randomUUID();
      await createChat(chatId, "New Chat", projectId);
    } else if (!(await getChat(chatId))) {
      await createChat(chatId, "New Chat", projectId);
    }

    const stream = createPiChatUIMessageStream({
      chatId,
      userMessage: message,
      projectId,
      cwd: currentPath,
    });

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "X-Chat-Id": chatId,
      },
    });
  } catch (error) {
    console.error("Pi chat API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
