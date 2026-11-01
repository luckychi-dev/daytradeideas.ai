import "../env-file.js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "../db/database.js";
import { loadDatabaseUrl } from "../db/config.js";
import { readCanonicalChunks } from "./canonical-reader.js";
import { chunkParagraphs } from "./chunker.js";
import { readDocxParagraphs } from "./docx-reader.js";
import { SOURCE_PLAN } from "./source-plan.js";
import { IngestionStore } from "./store.js";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const knowledgeRoot = resolve(
  process.env.KNOWLEDGE_BASE_DIR ?? workspaceRoot,
);
const pool = createPool(loadDatabaseUrl());
const store = new IngestionStore(pool);
const runId = await store.startRun();
let sourceCount = 0;
let chunkCount = 0;

try {
  for (const source of SOURCE_PLAN) {
    const path = resolve(knowledgeRoot, source.relativePath);
    const bytes = await readFile(path);
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const chunks = source.kind === "canonical-rules"
      ? await readCanonicalChunks(path, source)
      : chunkParagraphs((await readDocxParagraphs(path)).paragraphs, source);
    if (chunks.length === 0) throw new Error(`No chunks extracted from ${source.relativePath}`);
    const result = await store.ingestSource({ source, fileHash, chunks });
    sourceCount += 1;
    chunkCount += result.chunks;
    console.info(`${source.moduleCode}: ${result.chunks} chunks`);
  }
  await store.finishRun(runId, sourceCount, chunkCount);
  console.info(`Ingestion completed: ${sourceCount} sources, ${chunkCount} chunks.`);
} catch (error) {
  await store.failRun(runId, error);
  console.error(`Ingestion failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

