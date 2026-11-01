import type { PlannedSource } from "./types.js";

const BASE = "Day_Trade_Ideas_AI_Knowledge_Base_Release_Candidate_v1.0";
const CONTROLS = `${BASE}/01_CORE_CONTROLS`;
const TEACHING = `${BASE}/02_APPROVED_TEACHING_CANDIDATE`;

function stagingDoc(
  key: string,
  relativePath: string,
  moduleCode: string,
  topicTags: string[],
): PlannedSource {
  return {
    key,
    relativePath,
    title: relativePath.split("/").at(-1)?.replace(/\.docx$/i, "") ?? key,
    version: "working-candidate",
    moduleCode,
    authorOrSpeaker: "Jason Sen / Day Trade Ideas",
    authorityLayer: "A",
    approvalStatus: "validation_required",
    retrievalPermission: "admin_only",
    contentType: "control-candidate",
    topicTags,
    kind: "docx",
  };
}

function teachingDoc(
  key: string,
  filename: string,
  moduleCode: string,
  topicTags: string[],
  authorityLayer: "B" | "C" = "B",
): PlannedSource {
  return {
    key,
    relativePath: `${TEACHING}/${filename}`,
    title: filename.replace(/\.docx$/i, ""),
    version: filename.match(/_v([\d.]+)\.docx$/i)?.[1] ?? "working-candidate",
    moduleCode,
    authorOrSpeaker: "Jason Sen / Day Trade Ideas",
    authorityLayer,
    approvalStatus: "validation_required",
    retrievalPermission: "admin_only",
    contentType: "teaching-candidate",
    topicTags,
    kind: "docx",
  };
}

export const SOURCE_PLAN: PlannedSource[] = [
  {
    key: "canonical-rules",
    relativePath: `${CONTROLS}/Day_Trade_Ideas_AI_Canonical_Rule_Matrix_v1.0.xlsx`,
    title: "Day Trade Ideas Canonical Rule Matrix",
    version: "1.0",
    moduleCode: "CONTROL",
    authorOrSpeaker: "Jason Sen / owner-confirmed",
    authorityLayer: "A",
    approvalStatus: "approved",
    retrievalPermission: "production_teaching",
    contentType: "canonical-rules",
    topicTags: ["canonical", "risk", "mentor-behaviour"],
    kind: "canonical-rules",
  },
  stagingDoc("master-instructions", `${CONTROLS}/Day_Trade_Ideas_AI_Master_Instructions_v1.0.docx`, "CONTROL", ["instructions", "mentor"]),
  stagingDoc("behaviour-contract", `${CONTROLS}/Day_Trade_Ideas_AI_Behaviour_and_Trade_Assessment_Contract_v1.0.docx`, "CONTROL", ["behaviour", "trade-assessment"]),
  stagingDoc("risk-engine-spec", `${CONTROLS}/Day_Trade_Ideas_AI_Deterministic_Risk_Rule_Engine_Specification_v1.0.docx`, "CONTROL", ["risk", "rule-engine"]),
  stagingDoc("mentor-style", `${CONTROLS}/Day_Trade_Ideas_AI_Mentor_Personality_Style_Guide_v1.0.docx`, "CONTROL", ["mentor", "style"]),
  stagingDoc("chart-protocol", `${CONTROLS}/Day_Trade_Ideas_AI_Chart_Interpretation_and_Evidence_Protocol_v1.0.docx`, "CONTROL", ["charts", "evidence"]),
  stagingDoc("response-library", `${CONTROLS}/Day_Trade_Ideas_AI_Mentor_Response_Library_v1.0.docx`, "CONTROL", ["mentor", "examples"]),
  teachingDoc("kb01", "Day_Trade_Ideas_AI_KB01_Core_Philosophy_and_Five_Pillars_v0.1.docx", "KB01", ["philosophy", "five-pillars"]),
  teachingDoc("kb02", "Day_Trade_Ideas_AI_KB02_Technical_Analysis_v0.2.docx", "KB02", ["technical-analysis"]),
  teachingDoc("kb03", "Day_Trade_Ideas_AI_KB03_Fibonacci_Methodology_v0.2.docx", "KB03", ["fibonacci"]),
  teachingDoc("kb04", "Day_Trade_Ideas_AI_KB04_Trade_Execution_and_Risk_Management_v0.1.docx", "KB04", ["execution", "risk"]),
  teachingDoc("kb05", "Day_Trade_Ideas_AI_KB05_Trading_Psychology_v0.1.docx", "KB05", ["psychology"]),
  teachingDoc("kb06", "Day_Trade_Ideas_AI_KB06_Account_Management_and_Trading_Process_v0.1.docx", "KB06", ["account-management"]),
  teachingDoc("kb07", "Day_Trade_Ideas_AI_KB07_News_and_Market_Conditions_v0.1.docx", "KB07", ["news", "market-conditions"], "C"),
  teachingDoc("kb08", "Day_Trade_Ideas_AI_KB08_Trading_Experience_Case_Studies_v0.1.docx", "KB08", ["case-studies", "experience"], "C"),
  teachingDoc("kb10", "Day_Trade_Ideas_AI_KB10_Marketing_and_Public_Claims_v0.1.docx", "KB10", ["marketing", "claims"], "C"),
];

