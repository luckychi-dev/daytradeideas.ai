import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
});

export function loadDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) throw new Error("DATABASE_URL is required and must be a valid URL.");
  return parsed.data.DATABASE_URL;
}

