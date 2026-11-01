import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { KnowledgeInputError } from "../../domain/admin-knowledge-service.js";
import type { KnowledgeFileReader } from "../../domain/admin-knowledge-ports.js";
import type { KnowledgeFileUpload } from "../../domain/admin-knowledge-types.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown"]);

function fileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function normalizeParagraphs(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

async function workbookText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  return workbook.worksheets.map((sheet) => {
    const rows: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => cells.push(cell.text.trim()));
      const line = cells.join(" | ").trim();
      if (line) rows.push(line);
    });
    return `## ${sheet.name}\n${rows.join("\n")}`;
  }).join("\n\n");
}

export class LocalKnowledgeFileReader implements KnowledgeFileReader {
  async extract(file: KnowledgeFileUpload): Promise<{ content: string; fileName: string }> {
    const fileName = file.fileName.split(/[\\/]/).at(-1)?.trim() ?? "";
    if (!fileName) throw new KnowledgeInputError("The uploaded file has no name.");
    const extension = fileExtension(fileName);
    const buffer = Buffer.from(file.base64, "base64");
    if (buffer.length === 0) throw new KnowledgeInputError("The uploaded file is empty.");
    if (buffer.length > MAX_FILE_BYTES) {
      throw new KnowledgeInputError("The uploaded file must be 5 MB or smaller.");
    }

    let content: string;
    if (TEXT_EXTENSIONS.has(extension)) {
      content = buffer.toString("utf8");
    } else if (extension === ".docx") {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } else if (extension === ".xlsx") {
      content = await workbookText(buffer);
    } else {
      throw new KnowledgeInputError("Upload a DOCX, XLSX, TXT or Markdown file.");
    }
    const normalized = normalizeParagraphs(content);
    if (!normalized) throw new KnowledgeInputError("No readable text was found in the file.");
    return { content: normalized, fileName };
  }
}
