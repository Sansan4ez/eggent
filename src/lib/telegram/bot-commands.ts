interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
}

const EGGENT_TELEGRAM_BOT_COMMANDS = [
  { command: "start", description: "Show help and current project" },
  { command: "help", description: "Show available commands" },
  { command: "code", description: "Activate access with a code" },
  { command: "new", description: "Start a new conversation" },
];

function parseTelegramError(status: number, payload: TelegramApiResponse | null): string {
  const description = payload?.description?.trim();
  return description
    ? `Telegram API error (${status}): ${description}`
    : `Telegram API error (${status})`;
}

async function callTelegramBotApi(
  botToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<void> {
  const token = botToken.trim();
  if (!token) return;

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const payload = (await response.json().catch(() => null)) as TelegramApiResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(parseTelegramError(response.status, payload));
  }
}

export async function setEggentTelegramBotCommands(botToken: string): Promise<void> {
  await callTelegramBotApi(botToken, "setMyCommands", {
    commands: EGGENT_TELEGRAM_BOT_COMMANDS,
    scope: { type: "default" },
  });
}

export async function deleteEggentTelegramBotCommands(botToken: string): Promise<void> {
  await callTelegramBotApi(botToken, "deleteMyCommands", {
    scope: { type: "default" },
  });
}
