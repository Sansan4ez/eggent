export interface PiSessionOptions {
  cwd?: string;
  agentDir?: string;
  tools?: string[];
  chatId?: string;
  projectId?: string;
  memorySubdir?: string;
  enableEggentTools?: boolean;
  /**
   * Keep Eggent sessions fast by disabling global pi packages/extensions.
   * Core pi tools and Eggent custom tools still load. Project-local skills
   * passed by Eggent remain available.
   */
  corePiToolsOnly?: boolean;
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
