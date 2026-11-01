import ExcelJS from "exceljs";
import type {
  ApprovalStatus,
  KnowledgeChunkDraft,
  PlannedSource,
  RetrievalPermission,
} from "./types.js";

type Row = ExcelJS.Row;

function headers(worksheet: ExcelJS.Worksheet): Map<string, number> {
  const result = new Map<string, number>();
  worksheet.getRow(1).eachCell((cell, column) => {
    result.set(cell.text.trim(), column);
  });
  return result;
}

function cell(row: Row, columns: Map<string, number>, name: string): string {
  const column = columns.get(name);
  return column ? row.getCell(column).text.trim() : "";
}

function statusFor(value: string): {
  approvalStatus: ApprovalStatus;
  retrievalPermission: RetrievalPermission;
} {
  return value.toLowerCase() === "confirmed"
    ? { approvalStatus: "approved", retrievalPermission: "production_teaching" }
    : { approvalStatus: "validation_required", retrievalPermission: "admin_only" };
}

function canonicalChunks(
  worksheet: ExcelJS.Worksheet,
  source: PlannedSource,
): KnowledgeChunkDraft[] {
  const columns = headers(worksheet);
  const chunks: KnowledgeChunkDraft[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const ruleId = cell(row, columns, "Rule ID");
    if (!ruleId) return;
    const domain = cell(row, columns, "Domain");
    const requirement = cell(row, columns, "Rule / decision");
    const classification = cell(row, columns, "Classification");
    const status = cell(row, columns, "Status");
    const authority = cell(row, columns, "Authority");
    const action = cell(row, columns, "AI action");
    const conflict = cell(row, columns, "Known conflict / caveat");
    const qaCoverage = cell(row, columns, "QA coverage");
    const state = statusFor(status);
    chunks.push({
      chunkIndex: chunks.length,
      locator: `Canonical Rules!${rowNumber} / ${ruleId}`,
      content: [
        `Rule ${ruleId} — ${domain}`,
        `Requirement: ${requirement}`,
        `Classification: ${classification}`,
        `Status: ${status}`,
        `Authority: ${authority}`,
        `Required AI action: ${action}`,
        `Known conflict or caveat: ${conflict}`,
      ].join("\n"),
      authorityLayer: "A",
      ...state,
      contentType: classification || "rule",
      topicTags: [domain.toLowerCase(), "canonical-rule"].filter(Boolean),
      ruleIds: [ruleId],
      metadata: { sheet: worksheet.name, row: rowNumber, qaCoverage },
    });
  });
  return chunks;
}

function unresolvedChunks(
  worksheet: ExcelJS.Worksheet,
  source: PlannedSource,
  offset: number,
): KnowledgeChunkDraft[] {
  const columns = headers(worksheet);
  const chunks: KnowledgeChunkDraft[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const id = cell(row, columns, "ID");
    if (!id) return;
    chunks.push({
      chunkIndex: offset + chunks.length,
      locator: `Unresolved Decisions!${rowNumber} / ${id}`,
      content: [
        `Unresolved decision ${id}`,
        `Issue: ${cell(row, columns, "Issue")}`,
        `Current position: ${cell(row, columns, "Current position")}`,
        `Required AI handling now: ${cell(row, columns, "What the AI must do now")}`,
        `Resolution required: ${cell(row, columns, "What would resolve it")}`,
      ].join("\n"),
      authorityLayer: "A",
      approvalStatus: "validation_required",
      retrievalPermission: "admin_only",
      contentType: "unresolved",
      topicTags: ["unresolved", "canonical-control"],
      ruleIds: [id],
      metadata: { sheet: worksheet.name, row: rowNumber },
    });
  });
  return chunks;
}

export async function readCanonicalChunks(
  path: string,
  source: PlannedSource,
): Promise<KnowledgeChunkDraft[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const rules = workbook.getWorksheet("Canonical Rules");
  const unresolved = workbook.getWorksheet("Unresolved Decisions");
  if (!rules) throw new Error("Canonical Rules worksheet is missing.");
  const chunks = canonicalChunks(rules, source);
  return unresolved
    ? [...chunks, ...unresolvedChunks(unresolved, source, chunks.length)]
    : chunks;
}

