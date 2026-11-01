import type { InterfaceIdentity } from "./backend-client.js";

export function toInterfaceIdentity(from: {
  id: number;
  first_name: string;
  last_name?: string | undefined;
  username?: string | undefined;
}): InterfaceIdentity {
  return {
    interfaceKind: "telegram",
    externalUserId: String(from.id),
    displayName: [from.first_name, from.last_name].filter(Boolean).join(" "),
    ...(from.username ? { username: from.username } : {}),
  };
}
