export function resolveApiBaseUrl(
  configured: string | undefined,
  production: boolean,
): string {
  const base = configured || (production ? "https://api.ai.daytradeideas.co.uk" : "");
  return base.replace(/\/+$/, "");
}
