import {
  KnowledgeDocumentConflictError,
  KnowledgeDocumentNotFoundError,
  KnowledgeInputError,
} from "../domain/admin-knowledge-service.js";

export function success<T extends Record<string, unknown>>(
  data: T,
  message: string,
) {
  return {
    content: [{ type: "text" as const, text: message }],
    structuredContent: data,
  };
}

export async function runTool<T extends Record<string, unknown>>(
  action: () => Promise<T>,
  message: (value: T) => string,
) {
  try {
    const value = await action();
    return success(value, message(value));
  } catch (error) {
    const known = error instanceof KnowledgeInputError ||
      error instanceof KnowledgeDocumentNotFoundError ||
      error instanceof KnowledgeDocumentConflictError;
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: known && error instanceof Error
          ? error.message
          : "The knowledge operation failed.",
      }],
    };
  }
}
