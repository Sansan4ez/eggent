export interface PiSessionOptions {
  cwd?: string;
  agentDir?: string;
  tools?: string[];
  chatId?: string;
  projectId?: string;
  memorySubdir?: string;
  knowledgeSubdirs?: string[];
  enableEggentTools?: boolean;
}

export interface PiChatRunOptions extends PiSessionOptions {
  chatId: string;
  userMessage: string;
  projectId?: string;
}

export type PiToolStatus = "running" | "completed" | "error";

export interface PiToolRecord {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  status: PiToolStatus;
}
