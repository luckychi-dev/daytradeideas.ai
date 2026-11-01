import type { BackendClient, InterfaceIdentity } from "./backend-client.js";
import type { TelegramClient } from "./client.js";
import { linkAccountKeyboard } from "./replies.js";
import { handlePublicSupport } from "./support-handler.js";

interface AccountCommandDependencies {
  backend: BackendClient;
  client: TelegramClient;
  warn(data: unknown, message?: string): void;
}

export async function handleAccountCommand(
  dependencies: AccountCommandDependencies,
  updateId: number,
  chatId: number,
  identity: InterfaceIdentity,
  command: string | undefined,
): Promise<boolean> {
  if (command === "/plans") {
    await handlePublicSupport(
      dependencies,
      updateId,
      chatId,
      identity,
      "List all available Day Trade Ideas membership plans and explain how to join.",
    );
    return true;
  }
  if (command !== "/unbind" && command !== "/logout") return false;
  try {
    await dependencies.backend.unbind(identity);
    await dependencies.client.sendMessage(
      chatId,
      "Your Day Trade Ideas account has been unlinked. Link another email when you are ready.",
      linkAccountKeyboard(),
    );
  } catch (error) {
    dependencies.warn(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Telegram account unbind failed.",
    );
    await dependencies.client.sendMessage(
      chatId,
      "I couldn't unlink the account safely. Please try again shortly.",
    );
  }
  return true;
}
