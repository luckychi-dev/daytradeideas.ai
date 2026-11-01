import mammoth from "mammoth";

export interface DocxExtraction {
  paragraphs: string[];
  warningCount: number;
}

export async function readDocxParagraphs(path: string): Promise<DocxExtraction> {
  const result = await mammoth.extractRawText({ path });
  return {
    paragraphs: result.value
      .split(/\r?\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean),
    warningCount: result.messages.length,
  };
}

