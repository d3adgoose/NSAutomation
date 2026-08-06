/* Local, rule-based Peer Review workflow. No drawing data leaves the browser. */
const PEER_STORAGE_KEY = "ns-peer-reviews-v1";
const PEER_PDF_DB = "NSPeerReviewStorage";
const PEER_PDF_STORE = "reviewPdfs";
const PEER_CAD_STORE = "reviewCadData";
const PEER_KNOWLEDGE_STORE = "knowledgeSources";
const PEER_ANALYSIS_CACHE_STORE = "analysisCache";
const PEER_HISTORY_LIMIT = 5;
const PEER_KNOWLEDGE_KEY = "ns-peer-review-knowledge-v1";
const PEER_FINDING_FEEDBACK_KEY = "ns-peer-review-finding-feedback-v1";
const PEER_DATABASE_KNOWLEDGE_ENABLED_KEY = "ns-peer-review-database-knowledge-enabled-v1";
const PEER_PARTS_STORAGE_KEY = "nsPartsDatabaseV1";
const PEER_DATABASE_TABLES = Object.freeze({ master: "parts_master", aliases: "part_number_aliases", usage: "drawing_usage", documents: "documents" });
const PEER_DATABASE_DOCUMENTS_BUCKET = "document-library";
const PEER_AI_ANALYSIS_CACHE_VERSION = "20260806-reusable-revision-patterns-v7";
const PEER_EVIDENCE_LEDGER_CACHE_VERSION = "20260806-native-dwg-ledger-v3";
const COMPANY_AI_GENERAL_GUIDANCE_KEY = "ns-company-ai-general-guidance-v1";
const COMPANY_AI_ACCEPTED_TERMS_KEY = "ns-company-ai-accepted-terms-v1";
const PEER_BUILT_IN_KNOWLEDGE = `BUILT-IN PEER REVIEW REFERENCE

SOURCE EXAMPLE: A formal equipment-list item is absent from every drawing callout and no note says it is intentionally not pictured.
EXPECTED FINDING: Equipment item is listed but not called out on the drawing. Identify the item and visible evidence.

IGNORE EXAMPLE: The equipment-list sub-item number differs from a circled flow-line number, but the drawing visibly labels the same unambiguous equipment name.
EXPECTED: Do not report missing equipment. The visible equipment name is a valid match.

SOURCE EXAMPLE: Two title blocks visibly use different project numbers or the same drawing and sheet number is repeated.
EXPECTED FINDING: Report the two readable values and affected sheets.

IGNORE EXAMPLE: Fittings, nozzle, connection, parts, or conduit schedule rows do not each have independent equipment callouts.
EXPECTED: Do not treat those schedule rows as missing main equipment.

IMPORTANT: Examples teach review judgment only. Never copy project facts into another drawing package.`;
const PEER_ENGINEER_REVIEW_PATTERNS = `ENGINEER REVIEW PATTERNS

SOURCE EXAMPLE: A formal equipment list identifies two separately purposed tanks, but a plan, elevation, or label depicts one combined tank.
EXPECTED FINDING: Ask whether two tanks should be shown and separately labeled. Quote the list entries and the combined drawing label. Do not treat fittings or nozzles as tanks.

SOURCE EXAMPLE: A control panel or console face is shown against adjacent equipment without the required or explicitly noted working/access clearance.
EXPECTED FINDING: Request the visible required clearance in front of the panel. Cite the applicable note or dimension when visible; otherwise keep confidence low and request engineer confirmation.

SOURCE EXAMPLE: Two separately named control panels or consoles are shown in different equipment areas, but the review only checks access at one of them.
EXPECTED FINDING: Review each named panel independently. Return a separate low-confidence prompt for the second panel when its working face is visible but the required clearance cannot be confirmed.

SOURCE EXAMPLE: A readable general flow note requires a shutoff valve and union before a connection to supplied equipment, but the traced connection visibly omits one.
EXPECTED FINDING: Identify the connection and the missing valve or union. Do not report this unless the note and the affected connection are both readable.

SOURCE EXAMPLE: A tank is shown with process inlet/outlet piping but its required drain, overflow, or recovery route is absent or conflicts with the connections table.
EXPECTED FINDING: Request the missing route and cite the tank label plus the applicable connection-table row or flow note.

SOURCE EXAMPLE: A major equipment outline, dimension extension, leader, or flow line is materially lighter, broken, or obscured compared with adjacent drawing geometry.
EXPECTED FINDING: Request a line-weight or legibility correction and identify the exact object or dimension. Ignore ordinary construction-line hierarchy.

SOURCE EXAMPLE: A critical overall dimension, equipment label, or tank designation is repeated in plan and elevation but the visible values or meanings disagree.
EXPECTED FINDING: Quote both visible values or labels and identify both view locations. When the difference cannot be read confidently, retain it only as a possible review prompt.

SOURCE EXAMPLE: A formal equipment list distinguishes an RO water tank and a reclaim water tank, while either drawing object uses only a generic label such as TANK or 1500 GALLON TANK.
EXPECTED FINDING: Request the specific label at that exact tank. The RO tank and reclaim tank are separate affected objects and may produce separate findings.

SOURCE EXAMPLE: An overall dimension and its visible chained dimensions do not agree, or the same dimension is repeated with a different readable value.
EXPECTED FINDING: Identify the exact dimension and view. Do not guess values that are not fully legible.

SOURCE EXAMPLE: An engineer-accepted review example changes a visible overall dimension to a parenthetical reference dimension while preserving the readable numeric value.
EXPECTED FINDING: Request the parenthetical/reference-dimension correction at that exact dimension only when the current drawing independently shows the same dimension and location pattern. Never copy or invent the numeric value.

SOURCE EXAMPLE: A flow layout repeats a pipe service in multiple places but uses conflicting readable pipe materials, schedules, diameters, or connection types for that same service.
EXPECTED FINDING: Quote the two visible specifications, trace the shared service, and request correction at the conflicting segment. Do not infer the intended material without a supporting note, legend, or repeated dominant specification.

SOURCE EXAMPLE: A pump, panel, console, or equipment block is visibly placed across a walkway, too far from the equipment it serves, or in a position that conflicts with an explicit access or proximity note.
EXPECTED FINDING: Request relocation and cite the visible objects and applicable note. If the preferred location is only engineering judgment, keep confidence low and request confirmation.

SOURCE EXAMPLE: A schedule or equipment-list description is visibly incomplete, uses a placeholder such as nominal, or conflicts with a readable drawing callout or another schedule value for the same item.
EXPECTED FINDING: Quote the conflicting or incomplete entry and its comparison source. Do not flag ordinary wording preferences without a visible standard or counterpart.

SOURCE EXAMPLE: The same tagged bracket, support, or activation-eye assembly has different readable lengths in its custom part designation, equipment details, plan dimension, or elevation dimension.
EXPECTED FINDING: Coordinate the bracket length and quote both current-drawing values and locations. Compare only dimensions tied to the same explicit tag or assembly; never import a length from another project.

SOURCE EXAMPLE: The same tagged boom, panel, bracket, or equipment support is described with conflicting mounting modes or rotations, such as wall versus ceiling mounting or different degree values.
EXPECTED FINDING: Coordinate the mounting/rotation description using neutral wording. Require both specifications to be readable and tied to the same tagged item.

SOURCE EXAMPLE: A scheduled multi-unit item gives a total quantity and explicit left-hand/right-hand counts that do not add to that total, or the same tagged item is assigned opposite handedness in two locations.
EXPECTED FINDING: Quote the total and directional allocation, check the arithmetic exactly, and coordinate the handedness. Do not assume an uncounted right-hand-only description is wrong merely because the quantity is greater than one.

SOURCE EXAMPLE: Two electrical circuits feed parts of one packaged system even though a readable diagram or schedule indicates they should share one feeder, or a load value conflicts between the one-line and power schedule.
EXPECTED FINDING: Identify the exact circuits or load values and both locations. Never recommend combining circuits solely because they are adjacent.

SOURCE EXAMPLE: A control panel is located immediately beside tanks, spray equipment, wash machinery, or another visibly wet service area, and an approved enclosure/access standard or reviewed arrangement requires separation.
EXPECTED FINDING: Identify the exact panel and wet equipment, request relocation or the required enclosure rating, and cite the applicable standard. Without an approved requirement, retain only an evidence-located arrangement prompt.

SOURCE EXAMPLE: Equipment-list descriptions are visibly shifted, swapped, or assigned to the wrong tagged rows, including directional equipment such as entrance/exit activation eyes or rinse systems.
EXPECTED FINDING: Compare the exact tags and complete descriptions, quote both rows/callouts, and request correction without guessing which row should receive an unreadable description.

SOURCE EXAMPLE: A plumbing service repeats across the flow drawing with inconsistent or incomplete material and installation descriptions, such as galvanized Schedule 40, Type L copper, PVC, CPVC, PVC Schedule 80, rubber hose, or tank bulkhead requirements.
EXPECTED FINDING: Trace one named service at a time, quote every conflicting readable segment, distinguish aboveground/underground/vertical/flexible portions, and consolidate repeated identical corrections by service and location group.

SOURCE EXAMPLE: A pit or tank connection requires different pipe sizes or materials for its vertical, underground, flexible, and bulkhead portions.
EXPECTED FINDING: Treat each physical portion as a separate attribute and correction. Do not merge a vertical-riser requirement with an underground-pipe or tank-bulkhead requirement.

SOURCE EXAMPLE: An approved electrical review identifies adjacent control circuits that should share conductors or revises a readable conductor count.
EXPECTED FINDING: Quote the exact circuit labels and conductor notation. Recommend combining wires only when the approved standard or same-project reviewed example explicitly applies.

IMPORTANT: These are reusable review patterns, not project answers. Report them only when the current clean drawing supplies the stated visible evidence.`;
const PEER_VISUAL_REVIEW_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    drawingNumber: { type: "string" }, projectNumber: { type: "string" }, sheetNumber: { type: "integer" }, sheetTotal: { type: "integer" }, titleBlockConfidence: { type: "number" },
    pageType: { type: "string", enum: ["Drawing", "Equipment Table", "Drawing with Equipment Table"] },
    tableTypes: { type: "array", items: { type: "string", enum: ["Main Equipment List", "Power Requirement", "Connections", "Fittings Valves Components", "Nozzle Schedule", "General Notes", "Other"] } },
    callouts: { type: "array", items: { type: "object", additionalProperties: false, properties: { tag: { type: "string" }, name: { type: "string" } }, required: ["tag", "name"] } },
    unresolvedLabels: { type: "array", items: { type: "string" } },
    equipmentRows: { type: "array", items: { type: "object", additionalProperties: false, properties: { tag: { type: "string" }, description: { type: "string" }, sourceTable: { type: "string", enum: ["Main Equipment List", "Other Table"] }, tableTitle: { type: "string" } }, required: ["tag", "description", "sourceTable", "tableTitle"] } },
    findings: { type: "array", items: { type: "object", additionalProperties: false, properties: { severity: { type: "string", enum: ["Error", "Warning", "Manual Review"] }, affectedObject: { type: "string" }, issue: { type: "string" }, evidence: { type: "string" }, requirement: { type: "string" }, location: { type: "string" }, confidence: { type: "number" }, evidenceType: { type: "string", enum: ["Explicit reviewer correction", "Unresolved placeholder", "Objective visible mismatch", "Required reference missing"] }, existingCommentVisible: { type: "boolean" } }, required: ["severity", "affectedObject", "issue", "evidence", "requirement", "location", "confidence", "evidenceType", "existingCommentVisible"] } }
  }, required: ["drawingNumber", "projectNumber", "sheetNumber", "sheetTotal", "titleBlockConfidence", "pageType", "equipmentRows", "findings"]
};
const PEER_COORDINATION_REVIEW_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    findings: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, properties: {
      severity: { type: "string", enum: ["Error", "Warning", "Manual Review"] },
      affectedObject: { type: "string" }, issue: { type: "string" }, evidence: { type: "string" }, requirement: { type: "string" }, location: { type: "string" },
      confidence: { type: "number" }, evidenceType: { type: "string", enum: ["Unresolved placeholder", "Objective visible mismatch", "Required reference missing"] }
    }, required: ["severity", "affectedObject", "issue", "evidence", "requirement", "location", "confidence", "evidenceType"] } }
  }, required: ["findings"]
};
const PEER_EQUIPMENT_EXTRACTION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    equipmentRows: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { tag: { type: "string" }, description: { type: "string" }, sourceTable: { type: "string", enum: ["Main Equipment List"] }, tableTitle: { type: "string" } },
        required: ["tag", "description", "sourceTable", "tableTitle"]
      }
    }
  },
  required: ["equipmentRows"]
};
const PEER_ENGINEER_PATTERN_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    findings: {
      type: "array", maxItems: 14,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          page: { type: "integer" }, severity: { type: "string", enum: ["Warning", "Manual Review"] },
          category: { type: "string", enum: ["Tank coordination", "Service clearance", "Valve or union", "Drain or overflow", "Linework", "Dimension or label", "Piping specification", "Equipment arrangement", "Electrical coordination", "Schedule or table"] },
          affectedObject: { type: "string" }, requirement: { type: "string" },
          issue: { type: "string" }, evidence: { type: "string" }, location: { type: "string" },
          confidence: { type: "number" }, evidenceType: { type: "string", enum: ["Objective visible mismatch", "Required reference missing"] }
        },
        required: ["page", "severity", "category", "affectedObject", "requirement", "issue", "evidence", "location", "confidence", "evidenceType"]
      }
    }
  },
  required: ["findings"]
};
const PEER_ENGINEER_VERIFICATION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    verifications: {
      type: "array", maxItems: 24,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          candidateIndex: { type: "integer" }, supported: { type: "boolean" }, evidenceLocated: { type: "boolean" }, comparisonValid: { type: "boolean" }, requirementLocated: { type: "boolean" }, page: { type: "integer" },
          issue: { type: "string" }, evidence: { type: "string" }, requirement: { type: "string" },
          location: { type: "string" }, confidence: { type: "number" }, reason: { type: "string" }
        },
        required: ["candidateIndex", "supported", "evidenceLocated", "comparisonValid", "requirementLocated", "page", "issue", "evidence", "requirement", "location", "confidence", "reason"]
      }
    }
  },
  required: ["verifications"]
};
const PEER_EVIDENCE_LEDGER_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    facts: {
      type: "array", maxItems: 30,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          page: { type: "integer" }, tile: { type: "integer" },
          discipline: { type: "string", enum: ["Drawing", "Equipment", "Plumbing", "Electrical"] },
          sourceType: { type: "string", enum: ["Equipment List", "Plan", "Elevation", "Detail", "Flow Diagram", "Electrical One-Line", "Power Schedule", "Connection Schedule", "Nozzle Schedule", "General Note", "Other Schedule"] },
          tag: { type: "string" }, objectIdentifier: { type: "string" }, object: { type: "string" },
          attribute: { type: "string", enum: ["description", "quantity", "capacity", "dimension", "elevation", "pipe size", "pipe material", "pipe schedule", "connection size", "flow rate", "voltage", "phase", "amperage", "horsepower", "circuit", "feeder", "breaker", "conductor", "label"] },
          value: { type: "string" }, location: { type: "string" }, confidence: { type: "number" }
        },
        required: ["page", "tile", "discipline", "sourceType", "tag", "objectIdentifier", "object", "attribute", "value", "location", "confidence"]
      }
    }
  },
  required: ["facts"]
};
let peerReview = null;
let peerPdfDocument = null;
let peerActiveCommentFinding = "";
let peerCurrentUser = "Local reviewer";
let peerOcrRunning = false;
let peerCheckRunning = false;
let peerDrawingLoadRunning = false;
let peerAnalysisStartedAt = 0;
let peerAnalysisTimer = null;
let peerAnalysisLastMessage = "";
let peerAnalysisMessageCount = 0;
let peerAnalysisMode = "review";
let peerOcrLoadStage = "";
let peerActiveRedlineFinding = "";
let peerActiveFixItem = "";
let peerRedlinePreviewCanvas = null;
let peerRedlinePreviewBase = null;
let peerRedlinePlacementMode = "arrow";
let peerRedlineZoom = 1.25;
let peerRedlineUndoStack = [];
let peerRedlineRedoStack = [];
let peerRedlineLastSnapshot = null;
let peerRedlineHistoryTimer = null;
let peerDatabaseKnowledgeCache = null;
let peerDatabaseKnowledgePreloadPromise = null;
const peerDatabasePdfTextCache = new Map();
const peerDatabaseRequirementCache = new Map();
const peerDatabasePdfReadPromises = new Map();
let peerAiStatus = { ready: false, loaded: false, authenticated: false, model: "Qwen3-VL", error: "Checking the Local AI service." };

function getPeerLocalAiClient() {
  if (!window.NSLocalAIClient) throw new Error("The shared Local AI connector did not load. Refresh this page and try again.");
  return window.NSLocalAIClient;
}

async function getPeerLocalAiSession(loginMessage = "Sign in with the Database login to use Local AI.") {
  return getPeerLocalAiClient().getSession(loginMessage);
}

async function fetchPeerLocalAi(token, options = {}) {
  return getPeerLocalAiClient().fetch("/api/local-ai", { ...options, token });
}

const PEER_INITIAL_CHECKLIST = ["Drawing information appears complete.", "Title blocks are complete.", "Drawing numbers appear correct.", "Pages are readable.", "General comments."];
const PEER_EQUIPMENT_CHECKLIST = ["Equipment tags appear consistent.", "Manufacturer information appears correct.", "Model numbers appear correct.", "Quantities appear correct.", "Equipment descriptions appear complete.", "No obvious inconsistencies remain.", "Additional comments."];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("peerPdfUpload")?.addEventListener("change", event => handlePeerDrawing(event.target.files?.[0]));
  setupPeerDropZone(); populatePeerFixFilter(); populatePeerFindingFilter(); renderPeerSavedReviews();
  syncPeerDatabaseKnowledgeControls();
  updatePeerAiIndicator();
  if (isPeerDatabaseKnowledgeEnabled()) preloadPeerDatabaseKnowledge();
  window.addEventListener("ns-auth-session-changed", event => {
    const user = event.detail?.user;
    peerCurrentUser = user?.user_metadata?.full_name || user?.email || "Local reviewer";
    if (peerReview) renderPeerSummary();
    updatePeerAiIndicator();
    if (user && isPeerDatabaseKnowledgeEnabled()) refreshPeerDatabaseKnowledgeAccess(true);
  });
});

async function updatePeerAiIndicator() {
  const button = document.getElementById("peerAiHeaderButton"), label = button?.querySelector(".spec-ai-header-status-label");
  if (!button) return false;
  button.classList.remove("is-ready", "is-error"); button.classList.add("is-checking");
  if (label) label.textContent = "Checking Local AI";
  try {
    const session = await getPeerLocalAiSession();
    const user = session.user;
    peerCurrentUser = user?.user_metadata?.full_name || user?.email || "Signed in";
    const response = await fetchPeerLocalAi(session.access_token);
    const status = await response.json().catch(() => ({}));
    if (!response.ok || !status.ready) throw new Error(status.error || "The Local AI service is unavailable.");
    peerAiStatus = { ready: true, loaded: Boolean(status.loaded), authenticated: true, model: status.model || "Qwen3-VL", error: "" };
    setPeerAiIndicatorState("ready");
    return true;
  } catch (error) {
    const authenticated = !/sign in/i.test(error.message || "");
    peerAiStatus = { ready: false, loaded: false, authenticated, model: "Qwen3-VL", error: error.message || "The Local AI service is unavailable." };
    setPeerAiIndicatorState("error");
    return false;
  }
}

async function reconnectPeerAi() {
  const button = document.getElementById("peerAiReconnectButton");
  if (button) { button.disabled = true; button.textContent = "Checking..."; }
  await updatePeerAiIndicator();
  if (button) { button.disabled = false; button.textContent = "Try Reconnecting"; }
  openPeerAiStatus();
}

function setPeerAiIndicatorState(state) {
  const button = document.getElementById("peerAiHeaderButton"), label = button?.querySelector(".spec-ai-header-status-label");
  if (!button) return;
  button.classList.remove("is-checking", "is-ready", "is-error");
  button.classList.add(state === "ready" ? "is-ready" : state === "working" || state === "preparing" ? "is-checking" : "is-error");
  if (label) label.textContent = state === "preparing" ? "Preparing Drawing" : state === "working" ? "Local AI Reviewing" : state === "ready" ? "Local AI Ready" : "Local AI Offline";
  button.title = state === "preparing" ? "The drawing file is being read and prepared." : state === "working" ? "Local visual AI is reviewing the drawing now." : state === "ready" ? "Local AI is connected. Open review details." : "Local AI is unavailable. Open review details.";
}

function openPeerAiStatus() {
  const body = document.getElementById("peerAiStatusBody"); if (!body) return;
  const active = Boolean(peerAnalysisTimer);
  const preparingFile = active && peerAnalysisMode === "file-read";
  body.innerHTML = `<div class="spec-ai-status-hero${peerAiStatus.ready ? "" : " is-error"}"><div class="spec-ai-status-orb">AI</div><div><h3>${active ? preparingFile ? "Drawing file is being prepared" : "Local AI is reviewing drawings" : peerAiStatus.ready ? "Local AI is ready" : "Local AI needs attention"}</h3><p>${escapePeerHTML(active ? peerAnalysisLastMessage || "Reading the current drawing package." : peerAiStatus.error || `${peerAiStatus.model} is available for visual drawing review.`)}</p></div></div><p class="spec-ai-status-next"><strong>Your next step:</strong> ${active ? preparingFile ? "Keep this page open while the PDF or DWG is read and indexed." : "Keep this page open while the drawing regions are reviewed." : peerAiStatus.ready ? "Choose a review type, upload a drawing package, and run the automatic checks." : !peerAiStatus.authenticated ? "Open Database and sign in with your company account, then select Try Reconnecting." : "Start the Local AI server, then select Try Reconnecting."}</p><div class="spec-ai-status-grid"><div class="spec-ai-status-card"><span>Background service</span><strong>${peerAiStatus.ready ? "Connected" : "Unavailable"}</strong></div><div class="spec-ai-status-card"><span>Model</span><strong>${escapePeerHTML(peerAiStatus.model)}</strong></div><div class="spec-ai-status-card"><span>Model memory</span><strong>${peerAiStatus.loaded ? "Loaded now" : peerAiStatus.ready ? "Loads on demand" : "Not available"}</strong></div><div class="spec-ai-status-card"><span>Database account</span><strong>${peerAiStatus.authenticated ? escapePeerHTML(peerCurrentUser) : "Sign in required"}</strong></div><div class="spec-ai-status-card"><span>Current activity</span><strong>${active ? preparingFile ? "Drawing preparation running" : "Drawing analysis running" : "Idle"}</strong></div><div class="spec-ai-status-card"><span>Review method</span><strong>Local visual AI + OCR + rules</strong></div></div><div class="spec-ai-pipeline"><strong>How Peer Review works</strong><div class="spec-ai-pipeline-steps"><div class="spec-ai-pipeline-step"><b>1. Read</b>OCR reads image-only title blocks.</div><div class="spec-ai-pipeline-step"><b>2. Analyze</b>Local visual AI examines enlarged drawing regions, tables, callouts, and annotations.</div><div class="spec-ai-pipeline-step"><b>3. Verify</b>Rule checks compare readable values, then every result waits for engineer review.</div></div></div><p class="spec-ai-status-note"><strong>Privacy:</strong> Drawing images are processed by the Local AI service running on this computer, not a public AI website.</p><p class="spec-ai-status-next"><strong>Review boundary:</strong> Local AI finds visible, mundane inconsistencies. It does not certify the design or replace engineering review.</p>`;
  document.getElementById("peerAiStatusModal")?.classList.remove("hidden");
}

function openPeerKnowledgeLibrary() {
  const builtIn = document.getElementById("peerBuiltInKnowledge"), examples = document.getElementById("peerKnowledgeExamples");
  if (builtIn) builtIn.textContent = PEER_BUILT_IN_KNOWLEDGE;
  if (examples) examples.value = localStorage.getItem(PEER_KNOWLEDGE_KEY) || "";
  document.getElementById("peerKnowledgeModal")?.classList.remove("hidden");
}

function savePeerKnowledgeLibrary() {
  const examples = String(document.getElementById("peerKnowledgeExamples")?.value || "").trim().slice(0, 12000);
  try {
    if (examples) localStorage.setItem(PEER_KNOWLEDGE_KEY, examples); else localStorage.removeItem(PEER_KNOWLEDGE_KEY);
    closePeerModal("peerKnowledgeModal"); showPeerToast("Peer Review examples saved in this browser.");
  } catch {
    showPeerToast("The examples could not be saved because browser storage is unavailable.");
  }
}

function readPeerFindingFeedback() {
  try {
    const entries = JSON.parse(localStorage.getItem(PEER_FINDING_FEEDBACK_KEY) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch { return []; }
}

function getPeerFindingLearningKey(item = {}) {
  return [getPeerFindingCategoryKey(item), getPeerFindingAffectedObject(item), item.issue]
    .map(value => normalizePeerFindingPhrase(value).slice(0, 12).join("-"))
    .filter(Boolean).join("|");
}

function recordPeerFindingFeedback(item = {}, status = item.status, options = {}) {
  if (!item || item.source === "manual") return;
  const outcome = status === "Accepted" ? "accepted" : ["False Positive", "Not Applicable"].includes(status) ? "rejected" : "";
  if (!outcome) return;
  if (outcome === "accepted" && !options.finalized) return;
  const key = getPeerFindingLearningKey(item); if (!key) return;
  const note = String(item.resolutionNote || item.comments?.at(-1)?.text || "").trim();
  const entry = {
    key, outcome, category: getPeerFindingCategoryKey(item), affectedObject: getPeerFindingAffectedObject(item),
    issue: String(item.annotationText || item.issue || "").trim(), evidence: getPeerFindingEvidence(item),
    location: getPeerFindingLocation(item), reason: note || (outcome === "rejected" ? "Engineer rejected this proposed finding." : "Engineer accepted this finding."),
    updatedAt: new Date().toISOString(), finalized: outcome === "accepted", approvalTrigger: options.trigger || "", approvedSignature: options.signature || ""
  };
  try {
    const entries = readPeerFindingFeedback().filter(existing => existing.key !== key);
    entries.unshift(entry);
    localStorage.setItem(PEER_FINDING_FEEDBACK_KEY, JSON.stringify(entries.slice(0, 80)));
    return true;
  } catch { return false; }
}

function getPeerFindingFeedbackPrompt() {
  const entries = readPeerFindingFeedback().slice(0, 24);
  if (!entries.length) return "";
  return entries.map(item => `${item.outcome === "accepted" ? "ENGINEER-ACCEPTED EXAMPLE" : "ENGINEER-REJECTED EXAMPLE"}\nCATEGORY: ${item.category || "General"}\nAFFECTED OBJECT: ${item.affectedObject || "Not recorded"}\nFINDING: ${item.issue || ""}\nVISIBLE EVIDENCE: ${item.evidence || "Not recorded"}\nLOCATION PATTERN: ${item.location || "Not recorded"}\nENGINEER DECISION: ${item.reason || ""}`).join("\n\n").slice(0, 14000);
}

function getPeerKnowledgePrompt() {
  let optional = "";
  try { optional = localStorage.getItem(PEER_KNOWLEDGE_KEY) || ""; } catch {}
  let general = "";
  try { general = localStorage.getItem(COMPANY_AI_GENERAL_GUIDANCE_KEY) || ""; } catch {}
  let acceptedTerms = [];
  try { acceptedTerms = JSON.parse(localStorage.getItem(COMPANY_AI_ACCEPTED_TERMS_KEY) || "[]"); } catch {}
  const acceptedText = Array.isArray(acceptedTerms) ? acceptedTerms.filter(item => item.status !== "Warning").map(item => `${item.type || "Company Knowledge"}: ${item.text || ""}`).join("\n").slice(0, 16000) : "";
  const feedbackText = getPeerFindingFeedbackPrompt();
  return `${PEER_BUILT_IN_KNOWLEDGE}${general.trim() ? `\n\nGENERAL COMPANY AI GUIDANCE SHARED WITH SPECIFICATION:\n${general.trim().slice(0, 16000)}` : ""}${acceptedText ? `\n\nACCEPTED COMPANY KNOWLEDGE SHARED WITH SPECIFICATION:\n${acceptedText}` : ""}${optional.trim() ? `\n\nAPPROVED PEER REVIEW EXAMPLES:\n${optional.trim().slice(0, 12000)}` : ""}${feedbackText ? `\n\nENGINEER DECISION EXAMPLES FROM PRIOR REVIEWS:\n${feedbackText}\n\nUse accepted examples only when the current drawing shows comparable evidence. Treat rejected examples as explicit false-positive guidance. Never copy project-specific facts.` : ""}`;
}

async function openPeerSourceLibrary() {
  syncPeerDatabaseKnowledgeControls();
  document.getElementById("peerSourceLibraryModal")?.classList.remove("hidden");
}

function isPeerDatabaseKnowledgeEnabled() {
  try {
    const savedPreference = localStorage.getItem(PEER_DATABASE_KNOWLEDGE_ENABLED_KEY);
    // Read-only database knowledge is on for new users. A saved "false" still
    // honors an explicit choice to turn it off.
    return savedPreference === null ? true : savedPreference === "true";
  } catch { return true; }
}

function syncPeerDatabaseKnowledgeControls() {
  const enabled = isPeerDatabaseKnowledgeEnabled();
  const toggle = document.getElementById("peerDatabaseKnowledgeToggle"), label = document.getElementById("peerDatabaseKnowledgeToggleLabel"), badge = document.getElementById("peerDatabaseKnowledgeHubStatus");
  if (toggle) toggle.checked = enabled;
  if (label) label.textContent = enabled ? "On" : "Off";
  if (badge) { badge.textContent = enabled ? "On" : "Off"; badge.classList.toggle("is-on", enabled); }
}

async function openPeerDatabaseKnowledge() {
  closePeerModal("peerSourceLibraryModal");
  syncPeerDatabaseKnowledgeControls();
  document.getElementById("peerDatabaseKnowledgeModal")?.classList.remove("hidden");
  await refreshPeerDatabaseKnowledgeAccess();
}

async function setPeerDatabaseKnowledgeEnabled(enabled) {
  try { localStorage.setItem(PEER_DATABASE_KNOWLEDGE_ENABLED_KEY, String(Boolean(enabled))); } catch {}
  peerDatabaseKnowledgeCache = null; peerDatabasePdfTextCache.clear(); peerDatabaseRequirementCache.clear();
  syncPeerDatabaseKnowledgeControls();
  if (enabled) await refreshPeerDatabaseKnowledgeAccess(true);
  else renderPeerDatabaseKnowledgeSummary({ source: "disabled", master: [], aliases: [], usage: [], documents: [], errors: [] });
  showPeerToast(enabled ? "Read-only database knowledge is on." : "Database knowledge is off.");
}

function readPeerLocalPartsKnowledge() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PEER_PARTS_STORAGE_KEY) || "{}");
    return { master: Array.isArray(parsed.master) ? parsed.master : [], aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [], usage: Array.isArray(parsed.usage) ? parsed.usage : [] };
  } catch { return { master: [], aliases: [], usage: [] }; }
}

async function readPeerDatabaseTable(table, columns, limit) {
  const { data, error } = await supabaseClient.from(table).select(columns).limit(limit);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function loadPeerDatabaseKnowledge(force = false) {
  if (!force && peerDatabaseKnowledgeCache && Date.now() - peerDatabaseKnowledgeCache.loadedAt < 5 * 60 * 1000) return peerDatabaseKnowledgeCache;
  const local = readPeerLocalPartsKnowledge();
  const result = { source: local.master.length || local.aliases.length || local.usage.length ? "saved browser copy" : "unavailable", master: local.master, aliases: local.aliases, usage: local.usage, documents: [], errors: [], loadedAt: Date.now() };
  if (typeof supabaseClient === "undefined" || !supabaseClient) return (peerDatabaseKnowledgeCache = result);
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData?.session) { result.errors.push("Log in to read the shared company database and attached files."); return (peerDatabaseKnowledgeCache = result); }
    const requests = [
      ["master", PEER_DATABASE_TABLES.master, "current_part_number,description,category,manufacturer,manufacturer_part_number,status,record_type,source", 1500],
      ["aliases", PEER_DATABASE_TABLES.aliases, "old_part_number,current_part_number,description,match_type,notes,source", 1000],
      ["usage", PEER_DATABASE_TABLES.usage, "current_part_number,extracted_part_number,description,drawing_number,drawing_name,item_number,quantity,pdf_file_name,pdf_page_number,record_type", 2000],
      ["documents", PEER_DATABASE_TABLES.documents, "id,file_name,display_title,document_type,packet_section,manufacturer,model_number,tags,notes,storage_path", 800]
    ];
    const settled = await Promise.all(requests.map(async ([key, table, columns, limit]) => {
      try { return { key, rows: await readPeerDatabaseTable(table, columns, limit) }; }
      catch (error) { return { key, rows: null, error: `${table}: ${error.message || "read failed"}` }; }
    }));
    settled.forEach(entry => { if (entry.rows) result[entry.key] = entry.rows; else result.errors.push(entry.error); });
    if (settled.some(entry => entry.rows)) result.source = "shared company database";
  } catch (error) { result.errors.push(error.message || "Shared database access failed."); }
  peerDatabaseKnowledgeCache = result;
  return result;
}

async function preloadPeerDatabaseKnowledge(force = false) {
  if (!isPeerDatabaseKnowledgeEnabled()) return { source: "disabled", master: [], aliases: [], usage: [], documents: [], errors: [] };
  if (!force && peerDatabaseKnowledgePreloadPromise) return peerDatabaseKnowledgePreloadPromise;
  peerDatabaseKnowledgePreloadPromise = loadPeerDatabaseKnowledge(force);
  try { return await peerDatabaseKnowledgePreloadPromise; }
  finally { peerDatabaseKnowledgePreloadPromise = null; }
}

function renderPeerDatabaseKnowledgeSummary(data = {}) {
  const root = document.getElementById("peerDatabaseKnowledgeSummary"), status = document.getElementById("peerDatabaseKnowledgeStatus");
  if (!root || !status) return;
  const enabled = isPeerDatabaseKnowledgeEnabled(), attached = (data.documents || []).filter(item => item.storage_path).length;
  status.textContent = !enabled ? "Database knowledge is off. Turn it on to allow read-only retrieval during reviews." : data.errors?.length ? data.errors.join(" ") : `Company part knowledge is loaded from the ${data.source || "company database"} and ready before a drawing is uploaded.`;
  status.classList.toggle("is-error", Boolean(enabled && data.errors?.length && data.source === "unavailable"));
  root.innerHTML = `<div><small>Current parts</small><strong>${(data.master || []).length}</strong><span>Part numbers, descriptions, categories, and manufacturers</span></div><div><small>Part relationships</small><strong>${(data.aliases || []).length}</strong><span>Old/current numbers and accepted aliases</span></div><div><small>Drawing usage</small><strong>${(data.usage || []).length}</strong><span>Where individual parts have been used</span></div><div><small>Database files</small><strong>${attached}</strong><span>Relevant PDFs and Word files are converted to readable text; image-only PDF pages use OCR</span></div>`;
}

async function refreshPeerDatabaseKnowledgeAccess(force = false) {
  syncPeerDatabaseKnowledgeControls();
  const status = document.getElementById("peerDatabaseKnowledgeStatus");
  if (!isPeerDatabaseKnowledgeEnabled()) return renderPeerDatabaseKnowledgeSummary({ source: "disabled", master: [], aliases: [], usage: [], documents: [], errors: [] });
  if (status) status.textContent = "Checking read-only database access...";
  const data = await preloadPeerDatabaseKnowledge(force);
  renderPeerDatabaseKnowledgeSummary(data);
}

function getPeerDatabaseKnowledgeTokens(value = "") {
  const ignored = new Set(["THE", "AND", "FOR", "WITH", "FROM", "THIS", "THAT", "SYSTEM", "EQUIPMENT", "DRAWING", "PAGE", "LAYOUT", "ITEM", "PART"]);
  return new Set(normalizePeerValue(value).split(/[^A-Z0-9]+/).filter(token => token.length >= 3 && !ignored.has(token)));
}

function scorePeerDatabaseKnowledgeRow(row = {}, queryTokens = new Set()) {
  const text = normalizePeerValue(Object.values(row).filter(value => typeof value === "string" || typeof value === "number").join(" "));
  let score = 0; queryTokens.forEach(token => { if (text.includes(token)) score += token.length >= 6 ? 3 : 1; });
  return score;
}

async function readPeerDatabaseDocumentText(documentRow = {}) {
  const key = String(documentRow.id || documentRow.storage_path || ""); if (!key || !documentRow.storage_path) return "";
  if (peerDatabasePdfTextCache.has(key)) return peerDatabasePdfTextCache.get(key);
  if (peerDatabasePdfReadPromises.has(key)) return peerDatabasePdfReadPromises.get(key);
  const readPromise = (async () => {
  try {
    const stored = await getPeerAnalysisCacheEntry(`datasheet:${key}`);
    if (typeof stored?.text === "string" && stored.text) {
      peerDatabasePdfTextCache.set(key, stored.text);
      peerDatabaseRequirementCache.set(key, Array.isArray(stored.requirements) ? stored.requirements : extractPeerStructuredRequirements(stored.text, { sourceName: documentRow.file_name || documentRow.display_title, partNumber: "", model: documentRow.model_number, applicability: documentRow.packet_section || documentRow.document_type || "Manufacturer datasheet", approvalStatus: "Database source - applicability required" }));
      return stored.text;
    }
  } catch {}
  let text = "", worker = null;
  try {
    const { data: blob, error } = await supabaseClient.storage.from(PEER_DATABASE_DOCUMENTS_BUCKET).download(documentRow.storage_path);
    if (error) throw error;
    if (blob.size > 15 * 1024 * 1024) throw new Error("file exceeds the 15 MB AI reading limit");
    const sourceName = String(documentRow.file_name || documentRow.storage_path || "");
    const isWordDocument = /\.docx(?:$|[?#])/i.test(sourceName) || /wordprocessingml\.document/i.test(blob.type || "");
    const isPdfDocument = /\.pdf(?:$|[?#])/i.test(sourceName) || /application\/pdf/i.test(blob.type || "");
    if (isWordDocument) {
      if (typeof mammoth === "undefined") throw new Error("Word document reader is unavailable");
      const result = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() });
      text = String(result?.value || "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n");
      if (peerAnalysisStartedAt && text.trim()) recordPeerAnalysisMessage(`Read Word knowledge file ${documentRow.file_name || documentRow.display_title || key}.`);
    } else {
      if (!isPdfDocument) throw new Error(`unsupported database file type${sourceName ? ` for ${sourceName}` : ""}`);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      try {
      const imageOnlyPages = [];
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 20) && text.length < 9000; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber), content = await page.getTextContent();
        const pageText = content.items.map(item => `${item.str}${item.hasEOL ? "\n" : " "}`).join("").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
        if (pageText.length >= 24) text += `\nPage ${pageNumber}: ${pageText}`;
        else imageOnlyPages.push(pageNumber);
      }
      if (imageOnlyPages.length && text.length < 9000 && await ensurePeerTesseractLoaded()) {
        await verifyPeerWebAssemblyAccess();
        worker = await withPeerTimeout(Tesseract.createWorker("eng", 1, {
          workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/worker.min.js",
          corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0",
          langPath: "https://tessdata.projectnaptha.com/4.0.0_fast"
        }), 75000, "Database datasheet OCR took too long to initialize.");
        const pagesToScan = imageOnlyPages.slice(0, 4);
        if (peerAnalysisStartedAt) recordPeerAnalysisMessage(`OCR-scanning ${pagesToScan.length} image-only page${pagesToScan.length === 1 ? "" : "s"} from database datasheet ${documentRow.file_name || documentRow.display_title || key}.`);
        for (const pageNumber of pagesToScan) {
          try {
            const page = await pdf.getPage(pageNumber), base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: Math.min(1.7, 2400 / Math.max(base.width, 1)) });
            const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
            const result = await withPeerTimeout(worker.recognize(canvas), 45000, `Database datasheet OCR exceeded 45 seconds on page ${pageNumber}.`);
            const pageText = String(result.data?.text || "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
            if (pageText) text += `\nPage ${pageNumber} (OCR): ${pageText}`;
          } catch (ocrError) {
            console.warn(`Database datasheet OCR stopped on page ${pageNumber}:`, ocrError);
            break;
          }
          if (text.length >= 9000) break;
        }
      }
      } finally { if (worker) await worker.terminate(); await pdf.destroy(); }
    }
  } catch (error) { console.warn(`Database document could not be read: ${documentRow.file_name || documentRow.display_title || key}`, error); }
  text = text.trim().slice(0, 9000); peerDatabasePdfTextCache.set(key, text);
  const requirements = extractPeerStructuredRequirements(text, { sourceName: documentRow.file_name || documentRow.display_title, partNumber: "", model: documentRow.model_number, applicability: documentRow.packet_section || documentRow.document_type || "Manufacturer datasheet", approvalStatus: "Database source - applicability required" });
  peerDatabaseRequirementCache.set(key, requirements);
  if (text) try { await putPeerAnalysisCacheEntry({ key: `datasheet:${key}`, text, requirements, updatedAt: new Date().toISOString() }); } catch {}
  return text;
  })();
  peerDatabasePdfReadPromises.set(key, readPromise);
  try { return await readPromise; }
  finally { peerDatabasePdfReadPromises.delete(key); }
}

async function buildPeerDatabaseKnowledgeContext(pageNumber = 0) {
  if (!isPeerDatabaseKnowledgeEnabled()) return "";
  const data = await preloadPeerDatabaseKnowledge();
  const page = peerReview?.pages?.find(item => Number(item.number) === Number(pageNumber));
  const query = [peerReview?.filename, page?.text, page?.ocrText, ...(page?.visualCallouts || []).flatMap(item => [item.tag, item.name]), ...(peerReview?.equipmentRows || []).flatMap(item => [item.tag, item.description]), ...(peerReview?.evidenceLedger || []).flatMap(item => [item.tag, item.object, item.value])].filter(Boolean).join(" ");
  const tokens = getPeerDatabaseKnowledgeTokens(query); if (!tokens.size) return "";
  const rank = (rows, limit, minimum = 1) => rows.map(row => ({ row, score: scorePeerDatabaseKnowledgeRow(row, tokens) })).filter(item => item.score >= minimum).sort((left, right) => right.score - left.score).slice(0, limit).map(item => item.row);
  const parts = rank(data.master || [], 18), aliases = rank(data.aliases || [], 8), usage = rank(data.usage || [], 10), documents = rank(data.documents || [], 3, 2);
  const sections = [];
  if (parts.length) sections.push(`[Database: Current Parts; Read only]\n${parts.map(item => [item.current_part_number, item.description, item.category, item.manufacturer, item.manufacturer_part_number].filter(Boolean).join(" | ")).join("\n")}`);
  if (aliases.length) sections.push(`[Database: Part Relationships; Read only]\n${aliases.map(item => [item.old_part_number, item.current_part_number, item.description, item.notes].filter(Boolean).join(" | ")).join("\n")}`);
  if (usage.length) sections.push(`[Database: Drawing Usage; Read only]\n${usage.map(item => [item.current_part_number || item.extracted_part_number, item.description, item.drawing_number || item.drawing_name, item.pdf_file_name, item.pdf_page_number ? `page ${item.pdf_page_number}` : ""].filter(Boolean).join(" | ")).join("\n")}`);
  for (const documentRow of documents.slice(0, 2)) {
    const fileText = await readPeerDatabaseDocumentText(documentRow);
    const requirements = peerDatabaseRequirementCache.get(String(documentRow.id || documentRow.storage_path || "")) || [];
    if (requirements.length) sections.push(`[Indexed requirements: ${documentRow.file_name || documentRow.display_title}; Model: ${documentRow.model_number || "Not listed"}]\n${requirements.slice(0, 18).map(item => `PART/MODEL: ${item.partNumber || "Not listed"} / ${item.model || "Not listed"} | REQUIREMENT: ${item.requirement} | APPLIES TO: ${item.applicability} | SOURCE PAGE: ${item.sourcePage || "Not identified"} | APPROVAL: ${item.approvalStatus}`).join("\n")}`);
    if (fileText) sections.push(`[Database PDF context: ${documentRow.file_name || documentRow.display_title}; Manufacturer: ${documentRow.manufacturer || "Not listed"}; Model: ${documentRow.model_number || "Not listed"}; Read only]\n${fileText.slice(0, 3500)}`);
  }
  if (!sections.length) return "";
  return `READ-ONLY DATABASE KNOWLEDGE\nUse this material to understand individual part identity, function, accepted numbers, and documented usage. It does not prove that a part is installed in the current project and does not create a design requirement unless the current drawing visibly identifies the same part/model and the cited file states the requirement. Never report a missing component solely because it appears in the database.\n\n${sections.join("\n\n")}`.slice(0, 16000);
}

function openPeerAcceptedKnowledge() {
  closePeerModal("peerSourceLibraryModal");
  renderPeerAcceptedTerms();
  document.getElementById("peerAcceptedKnowledgeModal")?.classList.remove("hidden");
}

async function openPeerReferenceLibrary() {
  closePeerModal("peerSourceLibraryModal");
  const status = document.getElementById("peerKnowledgeStatus"); if (status) status.textContent = "";
  document.getElementById("peerReferenceLibraryModal")?.classList.remove("hidden");
  setupPeerKnowledgeDropZone();
  await approveExistingPeerKnowledgeSources();
  await renderPeerKnowledgeSources();
}

async function approveExistingPeerKnowledgeSources() {
  const sources = await getAllPeerKnowledgeSources();
  for (const source of sources.filter(item => item.status !== "Approved")) await putPeerKnowledgeSource({ ...source, status: "Approved" });
}

function setupPeerKnowledgeDropZone() {
  const zone = document.getElementById("peerKnowledgeDropZone");
  if (!zone || zone.dataset.dropReady === "true") return;
  zone.dataset.dropReady = "true";
  ["dragenter", "dragover"].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); event.stopPropagation(); zone.classList.add("dragover"); }));
  ["dragleave", "dragend"].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); event.stopPropagation(); zone.classList.remove("dragover"); }));
  zone.addEventListener("drop", event => { event.preventDefault(); event.stopPropagation(); zone.classList.remove("dragover"); handlePeerKnowledgeFiles(event.dataTransfer?.files); });
}

function getPeerAcceptedTerms() {
  try { const value = JSON.parse(localStorage.getItem(COMPANY_AI_ACCEPTED_TERMS_KEY) || "[]"); if (Array.isArray(value) && value.length) return value; const legacy = String(localStorage.getItem(COMPANY_AI_GENERAL_GUIDANCE_KEY) || "").trim(); return legacy ? [{ id: "legacy-guidance", type: "Company Guidance", text: legacy, createdAt: new Date().toISOString() }] : []; } catch { return []; }
}

function renderPeerAcceptedTerms() {
  const wrap = document.getElementById("peerAcceptedTermsHistory");
  if (!wrap) return;
  const entries = getPeerAcceptedTerms();
  wrap.innerHTML = entries.length ? entries.map(item => `<article class="company-term-message ${item.status === "Warning" ? "is-warning" : "is-saved"}"><div><span>${escapePeerHTML(item.status || "Saved")}${item.type ? ` · ${escapePeerHTML(item.type)}` : ""}</span><small>${escapePeerHTML(new Date(item.createdAt).toLocaleString())}</small></div><p class="company-term-user">${escapePeerHTML(item.text || "")}</p>${item.message ? `<p class="company-term-ai"><strong>Local AI:</strong> ${escapePeerHTML(item.message)}</p>` : ""}<div class="company-term-message-actions"><button class="secondary compact" type="button" onclick="editPeerAcceptedTerm('${escapePeerHTML(item.id)}')">Edit</button><button class="secondary compact" type="button" onclick="deletePeerAcceptedTerm('${escapePeerHTML(item.id)}')">Delete</button></div></article>`).join("") : `<p class="company-terms-empty">Start the conversation by teaching Local AI one company fact or rule.</p>`;
}

async function addPeerAcceptedTerm() {
  const input = document.getElementById("peerAcceptedTermInput");
  const text = String(input?.value || "").trim();
  if (!text) return showPeerToast("Enter an approved statement before adding it.");
  const button = document.getElementById("peerAcceptedTermSend"); if (button) { button.disabled = true; button.textContent = "…"; }
  let review = { status: "Warning", type: "Needs Clarification", normalizedText: text, message: "Local AI could not verify this entry. Clarify whether it is a general company rule or a project-specific fact." };
  try {
    const session = await getPeerLocalAiSession("Log in through Database first.");
    const format = { type: "object", properties: { status: { type: "string", enum: ["Saved", "Warning"] }, type: { type: "string", enum: ["Terminology", "System Fundamental", "Company Rule", "Known Exception", "Needs Clarification"] }, normalizedText: { type: "string" }, message: { type: "string" } }, required: ["status", "type", "normalizedText", "message"] };
    const response = await fetchPeerLocalAi(session.access_token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "system", content: "Review proposed reusable company knowledge for N/S Corporation vehicle-wash Specification and Peer Review tools. Save clear general terminology, system fundamentals, established company rules, and explicit known exceptions. Interpret ordinary engineering intent charitably. Do not rewrite, grammar-correct, rephrase, expand, or normalize the user's statement; normalizedText must reproduce the user's text exactly. In particular, distinguish equipment capability from simultaneous operation: a tank type that may be designated for either reclaimed-water service or fresh-water service does not imply that one installed tank mixes, switches between, or simultaneously serves both systems. Warn only when a material ambiguity remains that would change engineering meaning, or when the statement is contradictory, unsafe, unsupported, or project-specific. Keep message concise and useful. Do not invent facts. Return JSON only." }, { role: "user", content: text }], format, numCtx: 4096, maxTokens: 450 }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Local AI unavailable.");
    const parsed = parsePeerJsonObject(payload.content); if (parsed?.status) review = parsed;
  } catch (error) { review.message = error.message || review.message; }
  const entries = getPeerAcceptedTerms();
  entries.unshift({ id: crypto.randomUUID(), status: review.status === "Saved" ? "Saved" : "Warning", type: review.type || "Needs Clarification", text: text.slice(0, 4000), message: String(review.message || "").slice(0, 1000), createdAt: new Date().toISOString() });
  localStorage.setItem(COMPANY_AI_ACCEPTED_TERMS_KEY, JSON.stringify(entries.slice(0, 200)));
  input.value = "";
  renderPeerAcceptedTerms();
  if (button) { button.disabled = false; button.textContent = "✦"; }
}

function deletePeerAcceptedTerm(id) {
  if (id === "legacy-guidance") localStorage.removeItem(COMPANY_AI_GENERAL_GUIDANCE_KEY);
  localStorage.setItem(COMPANY_AI_ACCEPTED_TERMS_KEY, JSON.stringify(getPeerAcceptedTerms().filter(item => item.id !== id)));
  renderPeerAcceptedTerms();
}

function editPeerAcceptedTerm(id) {
  const entries = getPeerAcceptedTerms();
  const entry = entries.find(item => item.id === id);
  const input = document.getElementById("peerAcceptedTermInput");
  if (!entry || !input) return;
  input.value = entry.text || "";
  if (id === "legacy-guidance") localStorage.removeItem(COMPANY_AI_GENERAL_GUIDANCE_KEY);
  localStorage.setItem(COMPANY_AI_ACCEPTED_TERMS_KEY, JSON.stringify(entries.filter(item => item.id !== id)));
  renderPeerAcceptedTerms();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  showPeerToast("Statement loaded for editing. Update it, then select the star.");
}

async function clearPeerAcceptedTerms() {
  document.getElementById("peerClearKnowledgeModal")?.classList.remove("hidden");
}

function confirmClearPeerAcceptedTerms() {
  localStorage.removeItem(COMPANY_AI_ACCEPTED_TERMS_KEY);
  localStorage.removeItem(COMPANY_AI_GENERAL_GUIDANCE_KEY);
  closePeerModal("peerClearKnowledgeModal");
  renderPeerAcceptedTerms();
  showPeerToast("Company knowledge history cleared. Reference files were kept.");
}

function getPeerGuidanceSection(value, heading) {
  const match = String(value || "").match(new RegExp(`(?:^|\\n)${heading}:\\n([\\s\\S]*?)(?=\\n(?:SYSTEM FUNDAMENTALS|REQUIRED COMPANY RULES|STANDARD TERMINOLOGY|KNOWN EXCEPTIONS):\\n|$)`, "i"));
  return match ? match[1].trim() : "";
}

function populatePeerGuidanceBuilder(value) {
  const sections = [
    ["peerGuidanceFundamentals", "SYSTEM FUNDAMENTALS"], ["peerGuidanceRules", "REQUIRED COMPANY RULES"],
    ["peerGuidanceTerminology", "STANDARD TERMINOLOGY"], ["peerGuidanceExceptions", "KNOWN EXCEPTIONS"]
  ];
  const structured = sections.some(([, heading]) => new RegExp(`(?:^|\\n)${heading}:`, "i").test(value));
  sections.forEach(([id, heading], index) => { const input = document.getElementById(id); if (input) input.value = structured ? getPeerGuidanceSection(value, heading) : (index === 0 ? value : ""); });
}

function collectPeerCompanyGuidance() {
  return [["SYSTEM FUNDAMENTALS", "peerGuidanceFundamentals"], ["REQUIRED COMPANY RULES", "peerGuidanceRules"], ["STANDARD TERMINOLOGY", "peerGuidanceTerminology"], ["KNOWN EXCEPTIONS", "peerGuidanceExceptions"]]
    .map(([heading, id]) => [heading, String(document.getElementById(id)?.value || "").trim()]).filter(([, value]) => value).map(([heading, value]) => `${heading}:\n${value}`).join("\n\n");
}

function savePeerSourceExamples() {
  const value = String(document.getElementById("peerSourceKnowledgeExamples")?.value || "").trim().slice(0, 12000);
  const general = collectPeerCompanyGuidance().slice(0, 50000);
  try {
    if (value) localStorage.setItem(PEER_KNOWLEDGE_KEY, value); else localStorage.removeItem(PEER_KNOWLEDGE_KEY);
    if (general) localStorage.setItem(COMPANY_AI_GENERAL_GUIDANCE_KEY, general); else localStorage.removeItem(COMPANY_AI_GENERAL_GUIDANCE_KEY);
    showPeerToast("Shared company guidance and Peer Review examples saved.");
  } catch { showPeerToast("The examples could not be saved because browser storage is unavailable."); }
}

function saveAndFinishPeerSourceLibrary() {
  closePeerModal("peerSourceLibraryModal");
  openPeerAiStatus();
}

async function handlePeerKnowledgeFiles(fileList) {
  const files = Array.from(fileList || []), status = document.getElementById("peerKnowledgeStatus");
  if (!files.length) return;
  const category = document.getElementById("peerKnowledgeCategory")?.value || "System Fundamentals";
  let added = 0;
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (status) status.textContent = `Reading ${file.name} (${index + 1} of ${files.length}) locally...`;
    try {
      const chunks = await extractPeerKnowledgeChunks(file);
      if (!chunks.length) throw new Error("No readable text was found.");
      const referenceDrawing = /\.dwg$/i.test(file.name) || category === "Reference Drawing Context" || category === "Approved Peer Review";
      const sourceText = chunks.map(chunk => `Page ${chunk.page || 0}: ${chunk.text}`).join("\n");
      const requirements = referenceDrawing ? [] : extractPeerStructuredRequirements(sourceText, { sourceName: file.name, applicability: category, approvalStatus: "Approved" });
      await putPeerKnowledgeSource({ id: crypto.randomUUID(), name: file.name, category: /\.dwg$/i.test(file.name) ? "Reference Drawing Context" : category, referenceType: referenceDrawing ? "prior-drawing-context" : "approved-source", authority: referenceDrawing ? "Context only - not a requirement" : "Approved requirement source", status: "Approved", addedAt: new Date().toISOString(), size: file.size, chunks, requirements });
      added += 1;
    } catch (error) {
      if (status) status.textContent = `${file.name} was not added: ${error.message}`;
    }
  }
  document.getElementById("peerKnowledgeFiles").value = "";
  if (status && added) status.textContent = `${added} source${added === 1 ? "" : "s"} indexed and available to Local AI. Reference drawings remain context only.`;
  await renderPeerKnowledgeSources();
}

async function extractPeerKnowledgeChunks(file) {
  if (/\.dwg$/i.test(file.name)) {
    const client = getPeerLocalAiClient();
    const token = await client.getSessionToken("Sign in with the Database login before indexing a reference DWG.");
    const response = await client.fetch(`/api/cad-peer-review?reference=1&filename=${encodeURIComponent(file.name)}`, { method: "POST", token, headers: { "Content-Type": "application/octet-stream" }, body: file });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Reference DWG indexing returned ${response.status}.`);
    const cad = buildPeerCadData(payload.records || [], payload.layouts || [], payload.sheets || []);
    const lines = [`REFERENCE DRAWING CONTEXT ONLY: ${file.name}`, "This prior drawing is an example of past usage, not proof of a requirement for another project."];
    cad.tables.forEach(table => {
      lines.push(`TABLE: ${table.title || table.handle}`);
      table.cells.filter(cell => cell.value).forEach(cell => lines.push(`ROW ${Number(cell.row) + 1}, COLUMN ${Number(cell.column) + 1}, HEADING ${cell.heading || "unidentified"}, TAG ${cell.tag || "none"}, ATTRIBUTE ${cell.attribute || "unclassified"}, VALUE ${cell.value}`));
    });
    cad.blocks.filter(block => block.attributes.length).slice(0, 500).forEach(block => lines.push(`BLOCK ${block.name}: ${block.attributes.map(attribute => `${attribute.tag}=${attribute.value}`).join(" | ")}`));
    cad.texts.filter(item => item.text).slice(0, 1500).forEach(item => lines.push(`TEXT: ${cleanPeerCadCellValue(item.text)}`));
    return splitPeerKnowledgeText(lines.join("\n"), 0);
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const document = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const chunks = [];
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber), content = await page.getTextContent();
        const text = content.items.map(item => `${item.str}${item.hasEOL ? "\n" : " "}`).join("").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
        splitPeerKnowledgeText(text, pageNumber).forEach(chunk => chunks.push(chunk));
      }
    } finally { await document.destroy(); }
    return chunks;
  }
  if (!/\.(?:txt|md|csv)$/i.test(file.name)) throw new Error("Choose a PDF, DWG, TXT, MD, or CSV file.");
  return splitPeerKnowledgeText(await file.text(), 0);
}

function splitPeerKnowledgeText(text, page = 0) {
  const clean = String(text || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks = [];
  for (let offset = 0; offset < clean.length; offset += 3000) {
    let end = Math.min(clean.length, offset + 3400);
    if (end < clean.length) {
      const boundary = Math.max(clean.lastIndexOf("\n", end), clean.lastIndexOf(". ", end));
      if (boundary > offset + 1800) end = boundary + 1;
    }
    chunks.push({ page, text: clean.slice(offset, end).trim() }); offset = end - 1;
  }
  return chunks;
}

async function renderPeerKnowledgeSources() {
  const root = document.getElementById("peerKnowledgeSourceList"); if (!root) return;
  const sources = await getAllPeerKnowledgeSources();
  root.innerHTML = sources.map(source => `<article class="peer-knowledge-source"><div><strong>${escapePeerHTML(source.name)}</strong><span>${escapePeerHTML(source.category)} · ${source.chunks.length} searchable excerpt${source.chunks.length === 1 ? "" : "s"}</span><small class="peer-knowledge-status approved">Available to AI</small></div><div class="button-row"><button class="delete-btn" onclick="removePeerKnowledgeSource('${source.id}')">Remove</button></div></article>`).join("") || "<p>No knowledge sources added yet.</p>";
}

renderPeerKnowledgeSources = async function renderPeerKnowledgeSourcesWithAuthority() {
  const root = document.getElementById("peerKnowledgeSourceList"); if (!root) return;
  const sources = await getAllPeerKnowledgeSources();
  root.innerHTML = sources.map(source => `<article class="peer-knowledge-source"><div><strong>${escapePeerHTML(source.name)}</strong><span>${escapePeerHTML(source.category)} | ${source.chunks.length} searchable excerpt${source.chunks.length === 1 ? "" : "s"} | ${(source.requirements || []).length} indexed requirement${(source.requirements || []).length === 1 ? "" : "s"}</span><small class="peer-knowledge-status approved">${escapePeerHTML(source.authority || "Available to AI")}</small></div><div class="button-row"><button class="delete-btn" onclick="removePeerKnowledgeSource('${source.id}')">Remove</button></div></article>`).join("") || "<p>No knowledge sources added yet.</p>";
};

async function setPeerKnowledgeSourceStatus(id, status) {
  const source = await getPeerKnowledgeSource(id); if (!source) return;
  source.status = status; source.reviewedAt = new Date().toISOString(); source.reviewedBy = peerCurrentUser;
  await putPeerKnowledgeSource(source); await renderPeerKnowledgeSources();
}

async function removePeerKnowledgeSource(id) {
  await deletePeerKnowledgeSource(id); await renderPeerKnowledgeSources();
}

async function buildPeerKnowledgeContext(pageNumber) {
  let sources = [];
  try { sources = (await getAllPeerKnowledgeSources()).filter(source => source.status === "Approved"); } catch { sources = []; }
  const pageText = String(peerReview?.pages?.find(page => page.number === pageNumber)?.text || "");
  const query = `${peerReview?.filename || ""} ${pageText.slice(0, 9000)}`;
  const stopWords = new Set(["THE", "AND", "FOR", "WITH", "FROM", "THIS", "THAT", "ARE", "NOT", "PAGE", "DRAWING", "SYSTEM", "EQUIPMENT", "LAYOUT", "NOTE", "ITEM"]);
  const queryTokens = new Set(normalizePeerValue(query).split(/[^A-Z0-9]+/).filter(token => token.length >= 3 && !stopWords.has(token)));
  const candidates = [];
  sources.forEach(source => (source.chunks || []).forEach((chunk, index) => {
    const tokens = new Set(normalizePeerValue(chunk.text).split(/[^A-Z0-9]+/).filter(token => token.length >= 3 && !stopWords.has(token)));
    let score = 0; queryTokens.forEach(token => { if (tokens.has(token)) score += token.length >= 6 ? 3 : 1; });
    if (/Drawing Conventions|Known Exceptions|Approved Peer Review/i.test(source.category)) score += 4;
    candidates.push({ source, chunk, index, score });
  }));
  const selected = candidates.sort((left, right) => right.score - left.score).slice(0, 6);
  let used = 0;
  const excerpts = [];
  selected.forEach(({ source, chunk }) => {
    if (used >= 7500) return;
    const available = Math.min(2200, 7500 - used), text = String(chunk.text || "").slice(0, available);
    if (!text.trim()) return;
    const authority = source.referenceType === "prior-drawing-context" ? "Context only - prior drawing; never a requirement" : source.authority || "Approved source";
    const citation = `[Source: ${source.name}${chunk.page ? `, page ${chunk.page}` : ""}; Category: ${source.category}; Authority: ${authority}]`;
    excerpts.push(`${citation}\n${text}`); used += citation.length + text.length;
  });
  const matchedRequirements = selected.flatMap(({ source }) => (source.requirements || []).filter(item => item.approvalStatus === "Approved")).slice(0, 20);
  const requirementContext = matchedRequirements.length ? `[STRUCTURED APPROVED REQUIREMENTS]\n${matchedRequirements.map(item => `PART/MODEL: ${item.partNumber || "Not listed"} / ${item.model || "Not listed"} | REQUIREMENT: ${item.requirement} | APPLIES TO: ${item.applicability} | SOURCE: ${item.sourceName}, page ${item.sourcePage || "not identified"} | APPROVAL: ${item.approvalStatus}`).join("\n")}` : "";
  const referenceContext = [requirementContext, excerpts.length ? excerpts.join("\n\n") : ""].filter(Boolean).join("\n\n");
  const databaseContext = await buildPeerDatabaseKnowledgeContext(pageNumber);
  const cadContext = buildPeerCadKnowledgeContext(pageNumber);
  const combined = [referenceContext, databaseContext, cadContext].filter(Boolean);
  return combined.length ? combined.join("\n\n") : "No approved company knowledge sources have been added.";
}

function extractPeerStructuredRequirements(text = "", metadata = {}) {
  const sourceName = String(metadata.sourceName || "Approved source").trim();
  const approvalStatus = String(metadata.approvalStatus || "Needs approval").trim();
  const requirements = [], seen = new Set();
  let currentPage = 0;
  String(text || "").replace(/\r/g, "").split(/\n+/).forEach(line => {
    const pageMatch = line.match(/^Page\s+(\d+)/i); if (pageMatch) currentPage = Number(pageMatch[1]);
    line.split(/(?<=[.;])\s+(?=[A-Z0-9])/).forEach(sentence => {
      const requirement = sentence.replace(/^Page\s+\d+(?:\s*\(OCR\))?\s*:\s*/i, "").replace(/\s+/g, " ").trim();
      if (requirement.length < 18 || requirement.length > 700) return;
      if (!/\b(?:SHALL|MUST|REQUIRED|REQUIRES|MINIMUM|MAXIMUM|DO NOT|NOT PERMITTED|PROVIDE|INSTALL|MAINTAIN|WITHIN\s+\d|NO MORE THAN|AT LEAST)\b/i.test(requirement)) return;
      const key = normalizePeerValue(requirement); if (seen.has(key)) return; seen.add(key);
      requirements.push({
        id: `${normalizePeerValue(sourceName).slice(0, 30)}-${currentPage}-${requirements.length + 1}`,
        partNumber: String(metadata.partNumber || "").trim(), model: String(metadata.model || "").trim(),
        requirement, applicability: String(metadata.applicability || "Confirm matching part/model and system context").trim(),
        sourceName, sourcePage: currentPage, approvalStatus
      });
    });
  });
  return requirements.slice(0, 120);
}

function buildPeerCadKnowledgeContext(pageNumber) {
  const cad = peerReview?.cadData, layout = cad?.layouts?.[Number(pageNumber) - 1];
  if (!cad || !layout) return "";
  const appliesToPage = item => Number(item.page || 0) ? Number(item.page) === Number(pageNumber) : item.layout === layout || (!cad.sheets?.length && String(item.layout).toUpperCase() === "MODEL");
  const blocks = cad.blocks.filter(appliesToPage).slice(0, 180).map(item => {
    const attributes = item.attributes.filter(attribute => attribute.tag || attribute.value).map(attribute => `${attribute.tag}=${attribute.value}`).join(", ");
    return `BLOCK ${item.name || "unnamed"}${attributes ? ` [${attributes}]` : ""}`;
  });
  const dimensions = cad.dimensions.filter(appliesToPage).slice(0, 120).map(item => `DIMENSION ${item.text || item.measurement || "unlabeled"}`);
  const calloutTags = Array.from(new Set((cad.callouts || []).filter(appliesToPage).map(item => String(item.tag || "").trim()).filter(Boolean))).slice(0, 120).map(tag => `NUMBERED MULTILEADER TAG ${tag}`);
  const tables = cad.tables.filter(appliesToPage).slice(0, 12).flatMap(table => {
    const rows = new Map(); table.cells.forEach(cell => { if (!rows.has(cell.row)) rows.set(cell.row, []); rows.get(cell.row)[cell.column] = cell.value; });
    const structuredRows = Array.from(rows.entries()).slice(0, 80).map(([row, values]) => `TABLE ${table.handle} ROW ${row + 1}: ${values.map(value => value || "").join(" | ")}`);
    return structuredRows.length ? structuredRows : [`TABLE ${table.handle}: ${table.text || "native table present; use plotted vector text for cell review"}`];
  });
  const texts = cad.texts.filter(item => appliesToPage(item) && String(item.text || "").trim()).slice(0, 220).map(item => `TEXT ${String(item.text).replace(/\s+/g, " ").trim()}`);
  const lines = [...blocks, ...dimensions, ...calloutTags, ...tables, ...texts];
  return lines.length ? `[Native DWG structured source: layout ${layout}; exact CAD entities and attributes]\n${lines.join("\n").slice(0, 12000)}` : "";
}

async function buildPeerDocumentKnowledgeContext(pageNumbers = [1, 2]) {
  const contexts = await Promise.all(pageNumbers.map(pageNumber => buildPeerKnowledgeContext(pageNumber)));
  const useful = contexts.filter(text => text && !/^No approved|^Approved sources exist/i.test(text));
  if (!useful.length) return "No approved company knowledge excerpts were available for this document-level review.";
  const sections = useful.flatMap(text => text.split(/\n\n(?=\[Source:)/)).map(text => text.trim()).filter(Boolean);
  return Array.from(new Set(sections)).join("\n\n").slice(0, 12000);
}

function newPeerReview(type) {
  const now = new Date().toISOString();
  return { id: peerId("review"), type, project: "", filename: "", sourceFormat: "", cadData: null, reviewer: peerCurrentUser, createdAt: now, updatedAt: now, status: "In Progress", maximumSweep: true, pages: [], equipmentRows: [], evidenceLedger: [], systemRegistry: [], coverageReport: {}, findings: [], checklist: [], fixStates: {}, history: [{ action: "Review created", user: peerCurrentUser, date: now }] };
}

function startPeerReview(type) {
  if (!PEER_REVIEW_TYPES[type]?.available) return;
  peerReview = newPeerReview(type); peerPdfDocument = null;
  document.getElementById("peerReviewLanding").classList.add("hidden");
  document.getElementById("peerWorkspace").classList.remove("hidden");
  document.getElementById("peerPdfUpload").value = "";
  document.getElementById("peerUploadStatus").textContent = "Choose a DWG or PDF to begin.";
  renderPeerSummary(); renderPeerPages(); renderPeerEquipmentTable(); renderPeerFindings(); renderPeerChecklist(); renderPeerFixList(); showPeerStep("setup");
}

function peerIncludesEquipmentReview() {
  return Boolean(peerReview && peerReview.type !== "initial");
}

function updatePeerMaximumSweep(enabled) {
  if (!peerReview) return;
  peerReview.maximumSweep = Boolean(enabled); savePeerReview(false);
}

async function openPeerReview(id) {
  const stored = readPeerReviews().find(review => review.id === id);
  if (!stored) return showPeerToast("That saved review could not be found.");
  peerReview = stored; peerPdfDocument = null;
  peerReview.findings = (peerReview.findings || []).filter(item => !isPeerFindingSelfNegating(item));
  if (stored.cadStored) try {
    peerReview.cadData = await getPeerCadData(id);
    applyPeerCadSheetMetadata();
    extractPeerEquipmentRows();
    if (!peerReview.findings.length && peerReview.equipmentRows.some(row => row.source === "native-cad")) refreshPeerCadTableFindings(false);
  } catch (error) { console.warn("Saved native CAD evidence was unavailable:", error); }
  if (typeof peerReview.maximumSweep !== "boolean") peerReview.maximumSweep = true;
  document.getElementById("peerReviewLanding").classList.add("hidden"); document.getElementById("peerWorkspace").classList.remove("hidden");
  renderPeerSummary(); renderPeerPages(); renderPeerEquipmentTable(); renderPeerFindings(); renderPeerChecklist(); renderPeerFixList(); showPeerStep("findings");
  try {
    const file = await getPeerPdf(id);
    if (file) await loadPeerPdfDocument(file, false);
  } catch (error) { console.warn("Saved review PDF was unavailable:", error); }
}

function closePeerReview() {
  peerReview = null; peerPdfDocument = null;
  document.getElementById("peerWorkspace").classList.add("hidden"); document.getElementById("peerReviewLanding").classList.remove("hidden"); renderPeerSavedReviews();
}

function showPeerStep(step) {
  if (!peerReview) return;
  if (step === "equipment" && !peerIncludesEquipmentReview()) step = "findings";
  document.querySelectorAll(".peer-step-panel").forEach(panel => panel.classList.toggle("hidden", panel.id !== `peerStep-${step}`));
  document.querySelectorAll("[data-peer-step]").forEach(button => { button.classList.toggle("active", button.dataset.peerStep === step); button.hidden = button.dataset.peerStep === "equipment" && !peerIncludesEquipmentReview(); });
  if (step === "fixes") renderPeerFixList();
}

function setupPeerDropZone() {
  const zone = document.getElementById("peerDropZone");
  if (!zone) return;
  ["dragenter", "dragover"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.remove("dragover"); }));
  zone.addEventListener("drop", event => handlePeerDrawing(event.dataTransfer.files?.[0]));
  zone.addEventListener("click", event => {
    if (event.target.closest("label, input, button")) return;
    document.getElementById("peerPdfUpload").click();
  });
}

function resetPeerDrawingData(filename, sourceFormat) {
  peerReview.filename = filename; peerReview.sourceFormat = sourceFormat; peerReview.pages = []; peerReview.equipmentRows = []; peerReview.evidenceLedger = []; peerReview.systemRegistry = []; peerReview.coverageReport = {}; peerReview.findings = []; peerReview.cadData = null; peerReview.disciplineSweepCache = {}; delete peerReview.aiAnalysisCacheVersion;
}

function handlePeerDrawing(file) {
  if (!file) return;
  if (peerDrawingLoadRunning) return showPeerToast("A drawing is already being prepared. Keep this page open until it finishes.");
  if (peerCheckRunning) return showPeerToast("Wait for the automatic review to finish before loading another drawing.");
  return file.name.toLowerCase().endsWith(".dwg") ? handlePeerDwg(file) : handlePeerPdf(file);
}

async function handlePeerPdf(file) {
  if (!peerReview || !file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setPeerStatus("Choose a PDF file.", true);
  peerDrawingLoadRunning = true;
  startPeerAnalysisTimer(`Opening PDF ${file.name}.`, "file-read");
  setPeerStatus(`Opening PDF ${file.name}...`);
  try {
    resetPeerDrawingData(file.name, "PDF");
    await loadPeerPdfDocument(file, true, "PDF");
    reportPeerDrawingRead(`PDF page text is ready. Saving ${file.name} in local review history.`);
    await savePeerPdf(peerReview.id, file);
    if (isPeerDatabaseKnowledgeEnabled()) await preparePeerDatabaseDocumentsForReview();
    peerReview.updatedAt = new Date().toISOString(); renderPeerSummary(); renderPeerPages(); renderPeerEquipmentTable(); savePeerReview(false); showPeerStep("pages");
    finishPeerDrawingRead(`${file.name} loaded. ${peerReview.pages.length} page${peerReview.pages.length === 1 ? "" : "s"} ready for review.`);
  } catch (error) {
    const message = /password|encrypted/i.test(error?.message || "") ? "This PDF is encrypted. Remove the password and try again." : /InvalidPDF|invalid pdf/i.test(error?.message || "") ? "This PDF appears corrupted or is not a valid PDF." : `The PDF could not be read: ${error?.message || "Unknown error"}`;
    finishPeerDrawingRead(message, true);
  } finally {
    peerDrawingLoadRunning = false;
  }
}

async function loadPeerPdfDocument(file, extractPages, sourceLabel = "PDF") {
  if (extractPages) reportPeerDrawingRead(`Loading ${sourceLabel} bytes into the local PDF reader.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extractPages) reportPeerDrawingRead(`${sourceLabel} bytes loaded. Calculating the drawing fingerprint.`);
  peerReview.pdfFingerprint = await computePeerPdfFingerprint(bytes);
  peerPdfDocument = await pdfjsLib.getDocument({ data: bytes }).promise;
  if (!peerPdfDocument.numPages) throw new Error("This PDF is empty.");
  if (!extractPages) return;
  reportPeerDrawingRead(`${sourceLabel} opened with ${peerPdfDocument.numPages} page${peerPdfDocument.numPages === 1 ? "" : "s"}. Reading selectable page text.`);
  for (let number = 1; number <= peerPdfDocument.numPages; number += 1) {
    reportPeerDrawingRead(`Reading ${sourceLabel.toLowerCase()} page ${number} of ${peerPdfDocument.numPages}.`);
    const page = await peerPdfDocument.getPage(number); const content = await page.getTextContent();
    const text = content.items.map(item => `${item.str}${item.hasEOL ? "\n" : " "}`).join("").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
    peerReview.pages.push(analyzePeerPage(number, text, peerPdfDocument.numPages));
  }
  reportPeerDrawingRead(`Finished reading ${peerPdfDocument.numPages} ${sourceLabel.toLowerCase()} page${peerPdfDocument.numPages === 1 ? "" : "s"}. Checking for reusable review data.`);
  await restorePeerPersistentAnalysisCache();
}

async function preparePeerDatabaseDocumentsForReview() {
  if (!peerReview?.pages?.length || !isPeerDatabaseKnowledgeEnabled()) return;
  const representativePages = [];
  const seenRoles = new Set();
  peerReview.pages.forEach(page => {
    const role = getPeerDeterministicPageRole(page);
    if (seenRoles.has(role)) return;
    seenRoles.add(role); representativePages.push(page.number);
  });
  reportPeerDrawingRead(`Preparing relevant company datasheets for ${representativePages.length} drawing type${representativePages.length === 1 ? "" : "s"} before review.`);
  const before = peerDatabasePdfTextCache.size;
  for (const pageNumber of representativePages.slice(0, 4)) {
    try { await buildPeerDatabaseKnowledgeContext(pageNumber); }
    catch (error) { console.warn(`Company datasheet preparation could not finish for page ${pageNumber}:`, error); }
  }
  const prepared = Math.max(0, peerDatabasePdfTextCache.size - before);
  const requirementCount = Array.from(peerDatabaseRequirementCache.values()).reduce((count, requirements) => count + (Array.isArray(requirements) ? requirements.length : 0), 0);
  reportPeerDrawingRead(`Company knowledge ready${prepared ? `; ${prepared} relevant datasheet${prepared === 1 ? "" : "s"} prepared` : ""}${requirementCount ? `; ${requirementCount} explicit requirement${requirementCount === 1 ? "" : "s"} indexed` : ""}. Finalizing the drawing upload.`);
}

async function computePeerPdfFingerprint(bytes) {
  try {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
  } catch {
    let hash = 2166136261;
    for (let index = 0; index < bytes.length; index += Math.max(1, Math.floor(bytes.length / 50000))) hash = Math.imul(hash ^ bytes[index], 16777619);
    return `${bytes.length}-${(hash >>> 0).toString(16)}`;
  }
}

function decodePeerBase64(value) {
  const binary = atob(String(value || "")), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function readPeerCadProgressResponse(response) {
  const contentType = String(response.headers.get("Content-Type") || "");
  if (!contentType.includes("application/x-ndjson") || !response.body?.getReader) return response.json().catch(() => ({}));
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", payload = null, streamedError = "";
  const readEvent = line => {
    if (!line.trim()) return;
    let event;
    try { event = JSON.parse(line); }
    catch { throw new Error("The DWG progress response could not be read."); }
    if (event.type === "progress" && event.message) reportPeerDrawingRead(event.message);
    else if (event.type === "result") payload = event.payload;
    else if (event.type === "error") streamedError = event.error || "The DWG conversion could not be completed.";
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      readEvent(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); newline = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) readEvent(buffer);
  if (streamedError) throw new Error(streamedError);
  if (!payload) throw new Error("AutoCAD finished without returning the prepared drawing package.");
  return payload;
}

async function mergePeerCadLayoutPdfs(payload, sourceName) {
  const document = await PDFLib.PDFDocument.create();
  for (const plot of payload.pdfs || []) {
    const source = await PDFLib.PDFDocument.load(decodePeerBase64(plot.data));
    const pages = await document.copyPages(source, source.getPageIndices());
    pages.forEach(page => document.addPage(page));
  }
  if (!document.getPageCount()) throw new Error("AutoCAD did not return a plotted layout.");
  const bytes = await document.save();
  return new File([bytes], sourceName.replace(/\.dwg$/i, "") + " - CAD Review.pdf", { type: "application/pdf" });
}

function getPeerCadPageForEntity(entity = {}, sheets = []) {
  const handleSheet = sheets.find(sheet => sheet.handle && sheet.handle === entity.handle);
  if (handleSheet) return Math.max(1, Number(handleSheet.sheetNumber) || sheets.indexOf(handleSheet) + 1);
  const point = entity.point;
  if (!Array.isArray(point) || point.length < 2) return 0;
  const sheet = sheets.find(item => Array.isArray(item.bounds) && item.bounds.length === 4 && point[0] >= item.bounds[0] && point[0] <= item.bounds[2] && point[1] >= item.bounds[1] && point[1] <= item.bounds[3]);
  return sheet ? Math.max(1, Number(sheet.sheetNumber) || sheets.indexOf(sheet) + 1) : 0;
}

function cleanPeerCadTableFallbackText(value = "") {
  const tokens = String(value).replace(/\\P/g, " / ").replace(/U\+0278/g, "PH").split(/\s+\|\s+/)
    .map(token => token.replace(/CELL_VALUE|ACVALUE_END|CONTEXT_DATA\{|[{}]/gi, "").replace(/\\[A-Za-z][^;]*;/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return tokens.filter((token, index) => !index || token !== tokens[index - 1]).join(" | ").slice(0, 16000);
}

function extractPeerCadFallbackTableCells(text = "", rows = 0, columns = 0) {
  if (!rows || !columns) return [];
  const groups = String(text || "").split(/ACVALUE_END/i);
  const values = groups.flatMap(group => {
    const marker = group.lastIndexOf("CELL_VALUE");
    if (marker < 0) return [];
    const candidates = group.slice(marker + "CELL_VALUE".length).split(/\s+\|\s+/)
      .map(value => cleanPeerCadCellValue(value)).filter(Boolean);
    const unique = Array.from(new Set(candidates));
    return [unique.sort((left, right) => right.length - left.length)[0] || ""];
  });
  const expected = rows * columns;
  while (values.length < expected) values.push("");
  return values.slice(0, expected).map((value, index) => ({ row: Math.floor(index / columns), column: index % columns, value }));
}

function buildPeerCadData(records = [], layouts = [], sheets = []) {
  const entities = records.filter(item => item.record === "entity");
  const entityByHandle = new Map(entities.map(item => [item.handle, item]));
  const attributes = records.filter(item => item.record === "block_attribute");
  const attributesByHandle = new Map();
  attributes.forEach(item => {
    if (!attributesByHandle.has(item.handle)) attributesByHandle.set(item.handle, []);
    attributesByHandle.get(item.handle).push({ tag: String(item.tag || "").trim(), value: String(item.value || "").trim() });
  });
  const allBlocks = entities.filter(item => item.type === "INSERT");
  const blocks = allBlocks.slice(0, 3000).map(item => ({ layout: item.layout, page: getPeerCadPageForEntity(item, sheets), handle: item.handle, name: item.name, layer: item.layer, point: item.point, attributes: attributesByHandle.get(item.handle) || [] }));
  const tableMeta = new Map(records.filter(item => item.record === "table_meta").map(item => [`${item.layout}:${item.handle}`, item]));
  const tableMap = new Map();
  entities.filter(item => item.type === "ACAD_TABLE" || item.type === "TABLE").forEach(item => {
    const key = `${item.layout}:${item.handle}`, meta = tableMeta.get(key) || {};
    tableMap.set(key, { layout: item.layout, page: getPeerCadPageForEntity(item, sheets), handle: item.handle, layer: item.layer, text: cleanPeerCadTableFallbackText(item.text), rawText: item.text || "", rows: Number(meta.rows || item.tableRows || 0), columns: Number(meta.columns || item.tableColumns || 0), cells: [] });
  });
  const allTableCells = records.filter(item => item.record === "table_cell");
  allTableCells.forEach(cell => {
    const key = `${cell.layout}:${cell.handle}`;
    if (!tableMap.has(key)) tableMap.set(key, { layout: cell.layout, page: getPeerCadPageForEntity(entityByHandle.get(cell.handle), sheets), handle: cell.handle, layer: cell.layer, cells: [] });
    tableMap.get(key).cells.push({ row: Number(cell.row), column: Number(cell.column), value: String(cell.value || "").trim() });
  });
  const tables = Array.from(tableMap.values()).map(table => {
    if (!table.cells.length) table.cells = extractPeerCadFallbackTableCells(table.rawText, table.rows, table.columns);
    return structurePeerCadTable(table);
  });
  const callouts = entities.filter(item => item.type === "MULTILEADER").flatMap(item => {
    const tag = String(item.text || "").match(/(?:^|\|)\s*(\d{1,3}[A-Z]?)\s*$/i)?.[1] || "";
    return tag ? [{ layout: item.layout, page: getPeerCadPageForEntity(item, sheets), handle: item.handle, layer: item.layer, tag, point: item.point }] : [];
  });
  const structuredCellCount = tables.reduce((count, table) => count + table.cells.length, 0);
  return {
    layouts: Array.from(layouts), sheets: Array.from(sheets), blocks, tables, callouts,
    texts: entities.filter(item => item.type === "TEXT" || item.type === "MTEXT" || (item.type === "MULTILEADER" && String(item.text || "").trim() && !/^(?:CONTEXT_DATA|\s*\d+\s*$)/i.test(item.text))).slice(0, 5000).map(item => ({ ...item, page: getPeerCadPageForEntity(item, sheets) })),
    dimensions: entities.filter(item => item.type === "DIMENSION").slice(0, 2000).map(item => ({ ...item, page: getPeerCadPageForEntity(item, sheets) })),
    stats: { blocks: allBlocks.length, attributes: attributes.length, tables: tableMap.size, tableCells: structuredCellCount, callouts: callouts.length, dimensions: entities.filter(item => item.type === "DIMENSION").length, indexedRecords: Math.min(records.length, 25000), totalRecords: records.length }
  };
}

function applyPeerCadSheetMetadata() {
  const cad = peerReview?.cadData;
  if (!cad?.sheets?.length || !peerReview?.pages?.length) return;
  const sheetsByName = new Map(cad.sheets.map(sheet => [String(sheet.name || "").trim().toUpperCase(), sheet]));
  peerReview.pages.forEach((page, index) => {
    const layout = String(cad.layouts?.[index] || "").trim();
    const sheet = sheetsByName.get(layout.toUpperCase()) || cad.sheets[index];
    if (!sheet) return;
    page.cadLayout = layout || String(sheet.name || "").trim();
    page.sheetTitle = String(sheet.title || page.sheetTitle || "").trim();
    page.drawingNumber = normalizePeerOcrIdentifier(sheet.drawingNumber || page.drawingNumber || "");
    page.sheetNumber = Math.max(1, Number(sheet.sheetNumber) || index + 1);
    page.sheetTotal = peerReview.pages.length;
    page.pageNumberDetected = true;
    page.metadataConfidence = 1;
    const recommendation = getPeerPageRoleRecommendation(page);
    page.recommendedCategory = recommendation.role;
    page.categoryRecommendationReason = recommendation.reason;
    page.categoryRecommendationConfidence = recommendation.confidence;
    if (!page.categoryManuallySet) {
      page.category = recommendation.role;
    }
  });
}

function createPeerCadRequestId() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return `dwg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function pollPeerCadProgress(client, token, requestId, isActive) {
  let seenMessages = 0;
  while (isActive()) {
    try {
      const response = await client.fetch(`/api/cad-peer-progress?requestId=${encodeURIComponent(requestId)}`, { method: "GET", token });
      if ([401, 403, 503].includes(response.status)) return;
      if (response.ok) {
        const progress = await response.json().catch(() => ({}));
        const messages = Array.isArray(progress.messages) ? progress.messages : [];
        messages.slice(seenMessages).forEach(reportPeerDrawingRead);
        seenMessages = messages.length;
        if (progress.status && progress.status !== "running") return;
      }
    } catch { /* The main conversion request reports any actionable failure. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function handlePeerDwg(file) {
  if (!peerReview || !file) return;
  peerDrawingLoadRunning = true;
  startPeerAnalysisTimer(`Uploading ${file.name} to the local AutoCAD reader.`, "file-read");
  setPeerStatus(`Uploading ${file.name} to the local AutoCAD reader...`);
  try {
    const client = getPeerLocalAiClient();
    if (!client?.fetch) throw new Error("The NS Local AI Background service is unavailable.");
    const token = await client.getSessionToken("Sign in with the Database login before converting a DWG.");
    const requestId = createPeerCadRequestId();
    let keepPolling = true;
    const responsePromise = client.fetch(`/api/cad-peer-review?requestId=${encodeURIComponent(requestId)}&filename=${encodeURIComponent(file.name)}`, { method: "POST", token, headers: { "Content-Type": "application/octet-stream" }, body: file });
    const progressPromise = pollPeerCadProgress(client, token, requestId, () => keepPolling);
    let response;
    try { response = await responsePromise; }
    finally { keepPolling = false; await progressPromise; }
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || `Local DWG conversion returned ${response.status}.`);
    }
    const payload = await response.json().catch(() => ({}));
    if (!payload.pdfs?.length) throw new Error(payload.error || "AutoCAD finished without returning the prepared drawing package.");
    reportPeerDrawingRead(`DWG package received. Combining ${payload.pdfs?.length || 0} plotted sheet${payload.pdfs?.length === 1 ? "" : "s"} into the review drawing.`);
    const reviewPdf = await mergePeerCadLayoutPdfs(payload, file.name);
    resetPeerDrawingData(file.name, "DWG");
    peerReview.cadFingerprint = payload.fingerprint || ""; peerReview.cadConverter = payload.converter || "AutoCAD";
    reportPeerDrawingRead(`Indexing ${(payload.records || []).length.toLocaleString()} native CAD records for tag, table, block, attribute, and dimension checks.`);
    peerReview.cadData = buildPeerCadData(payload.records, (payload.pdfs || []).map(item => item.layout), payload.sheets || []);
    await loadPeerPdfDocument(reviewPdf, true, "plotted DWG sheet");
    applyPeerCadSheetMetadata();
    extractPeerEquipmentRows();
    const nativeEquipmentRows = peerReview.equipmentRows.filter(row => row.source === "native-cad").length;
    if (nativeEquipmentRows) reportPeerDrawingRead(`Extracted ${nativeEquipmentRows} editable equipment row${nativeEquipmentRows === 1 ? "" : "s"} directly from the native AutoCAD equipment table.`);
    reportPeerDrawingRead(`Applied native DWG sheet roles: ${peerReview.pages.map(page => `${page.number} ${getPeerDeterministicPageRole(page)}`).join(", ")}.`);
    reportPeerDrawingRead("Plotted sheets and native CAD evidence are ready. Saving the review copy locally.");
    await savePeerPdf(peerReview.id, reviewPdf);
    if (isPeerDatabaseKnowledgeEnabled()) await preparePeerDatabaseDocumentsForReview();
    peerReview.updatedAt = new Date().toISOString(); renderPeerSummary(); renderPeerPages(); renderPeerEquipmentTable(); savePeerReview(false); showPeerStep("pages");
    const stats = peerReview.cadData.stats;
    finishPeerDrawingRead(`${file.name} loaded from ${payload.converter || "AutoCAD"}. ${peerReview.pages.length} plotted sheet${peerReview.pages.length === 1 ? "" : "s"}, ${stats.blocks} blocks, ${stats.attributes} attributes, ${stats.tables} native tables${stats.tableCells ? ` with ${stats.tableCells} structured cells` : " with vector-text fallback"}, ${stats.callouts || 0} numbered multileaders, and ${stats.dimensions} dimensions are ready for review.`);
  } catch (error) {
    console.error("DWG peer-review conversion failed:", error);
    finishPeerDrawingRead(`The DWG could not be prepared: ${error?.message || "Unknown error"}`, true);
  } finally {
    peerDrawingLoadRunning = false;
  }
}

function getPeerPersistentAnalysisCacheKey() {
  if (!peerReview?.pdfFingerprint) return "";
  const knowledgeInputs = [PEER_KNOWLEDGE_KEY, PEER_FINDING_FEEDBACK_KEY, COMPANY_AI_GENERAL_GUIDANCE_KEY, COMPANY_AI_ACCEPTED_TERMS_KEY]
    .map(key => { try { return localStorage.getItem(key) || ""; } catch { return ""; } }).join("|");
  let knowledgeHash = 2166136261;
  for (let index = 0; index < knowledgeInputs.length; index += 1) knowledgeHash = Math.imul(knowledgeHash ^ knowledgeInputs.charCodeAt(index), 16777619);
  return `drawing:${PEER_AI_ANALYSIS_CACHE_VERSION}:${peerReview.type}:${knowledgeHash >>> 0}:${peerReview.pdfFingerprint}`;
}

async function restorePeerPersistentAnalysisCache() {
  const key = getPeerPersistentAnalysisCacheKey(); if (!key) return false;
  try {
    const cached = await getPeerAnalysisCacheEntry(key);
    if (!cached?.pages) return false;
    peerReview.pages.forEach(page => {
      const saved = cached.pages[page.number]; if (!saved) return;
      Object.assign(page, JSON.parse(JSON.stringify(saved)));
    });
    peerReview.disciplineSweepCache = JSON.parse(JSON.stringify(cached.disciplineSweepCache || {}));
    peerReview.aiAnalysisCacheVersion = PEER_AI_ANALYSIS_CACHE_VERSION;
    return true;
  } catch (error) { console.warn("Persistent drawing analysis cache could not be restored:", error); return false; }
}

async function persistPeerAnalysisCache() {
  const key = getPeerPersistentAnalysisCacheKey(); if (!key || !peerReview) return;
  const pages = {};
  peerReview.pages.forEach(page => {
    if (!page.visualAnalysisCompleted && !page.evidenceLedgerCompleted) return;
    pages[page.number] = {
      visualAnalysisCompleted: Boolean(page.visualAnalysisCompleted), visualAnalysisResult: page.visualAnalysisResult || null,
      visualRegionsExpected: Number(page.visualRegionsExpected || 0), visualRegionsReviewed: Number(page.visualRegionsReviewed || 0),
      evidenceLedgerCompleted: Boolean(page.evidenceLedgerCompleted), evidenceLedgerFacts: page.evidenceLedgerFacts || [], evidenceLedgerVersion: page.evidenceLedgerVersion || "",
      visualEquipmentTableDetected: Boolean(page.visualEquipmentTableDetected), visualCallouts: page.visualCallouts || [],
      unresolvedLabels: page.unresolvedLabels || [], tableTypes: page.tableTypes || [], drawingNumber: page.drawingNumber || "",
      projectNumber: page.projectNumber || "", sheetNumber: Number(page.sheetNumber || 0), sheetTotal: Number(page.sheetTotal || 0),
      metadataConfidence: Number(page.metadataConfidence || 0)
    };
  });
  try { await putPeerAnalysisCacheEntry({ key, pages, disciplineSweepCache: peerReview.disciplineSweepCache || {}, updatedAt: new Date().toISOString() }); }
  catch (error) { console.warn("Persistent drawing analysis cache could not be saved:", error); }
}

function analyzePeerPage(number, text, totalPages = 0) {
  const flattened = String(text || "").replace(/[–—−]/g, "-").replace(/\s+/g, " ");
  const drawingMatch = flattened.match(/(?:DRAWING|DWG\.?)\s*(?:NO\.?|NUMBER|#)?\s*[:#-]?\s*([A-Z]{1,5}\s*-\s*[0-9IO]{1,4}(?:[.,][0-9IO]{1,3})?)/i)
    || flattened.match(/\b(W[S5]\s*-\s*[0-9IO]{1,4}(?:[.,][0-9IO]{1,3})?)\b/i);
  const projectMatch = flattened.match(/(?:PROJECT|PROJ\.?|JOB)\s*(?:NO\.?|NUMBER|#)?\s*[:#-]?\s*([0-9IOS]{3,6})\b/i);
  const sheetMatch = flattened.match(/\b([0-9IO]{1,3})\s+(?:OF|\/)\s+([0-9IO]{1,3})\b/i);
  const titleMatch = flattened.match(/\bTITLE\s*:\s*([A-Z0-9][A-Z0-9 &/().,'-]{2,70}?)(?=\s+(?:PROJECT|DRAWING|REV(?:ISION)?|SCALE|DATE)\b|$)/i);
  const pageRegex = new RegExp(`(?:PAGE|SHEET)\\s*(?:NO\\.?|NUMBER|#)?\\s*[:#-]?\\s*${number}\\b|\\b${number}\\s*(?:OF|/)\\s*${totalPages || "\\d+"}\\b`, "i");
  const projectNumber = normalizePeerOcrDigits(projectMatch?.[1] || "");
  const defaultCategory = "Drawing";
  return { number, category: defaultCategory, text, tableTypes: detectPeerTableTypes(flattened), blank: text.length < 8, drawingNumber: normalizePeerOcrIdentifier(drawingMatch?.[1] || ""), projectNumber, textProjectNumber: projectNumber, sheetNumber: Number(normalizePeerOcrDigits(sheetMatch?.[1] || "0")), sheetTotal: Number(normalizePeerOcrDigits(sheetMatch?.[2] || "0")), sheetTitle: titleMatch?.[1]?.trim() || "", pageNumberDetected: pageRegex.test(flattened) || Boolean(sheetMatch), fingerprint: normalizePeerValue(text.slice(0, 1200)).slice(0, 500) };
}

function detectPeerTableTypes(text = "") { const value = String(text).toUpperCase(), types = []; if (/EQUIPMENT LIST[^\n]{0,80}(?:SUPPLIED BY NS|TO BE SUPPLIED BY NS)/.test(value)) types.push("Main Equipment List"); if (/POWER REQUIREMENT/.test(value)) types.push("Power Requirement"); if (/CONNECTIONS? TABLE/.test(value)) types.push("Connections"); if (/FITTINGS?.{0,20}VALVES?.{0,20}COMPONENTS?/.test(value)) types.push("Fittings Valves Components"); if (/NOZZLE SCHEDULE/.test(value)) types.push("Nozzle Schedule"); if (/GENERAL NOTES?/.test(value)) types.push("General Notes"); return types.length ? types : ["Other"]; }

function getPeerPageRoleRecommendation(page = {}) {
  const text = String(page.text || page.ocrText || "").toUpperCase();
  const nativeMetadata = `${page.sheetTitle || ""} ${page.cadLayout || ""} ${page.drawingNumber || ""}`.toUpperCase();
  const tables = new Set(page.tableTypes || []);
  if (tables.has("Main Equipment List") || /EQUIPMENT LIST.{0,100}(?:SUPPLIED BY NS|TO BE SUPPLIED BY NS)/s.test(text)) return { role: "Equipment", reason: "A formal NS equipment list was detected on this page.", confidence: 1 };
  if (/EQUIPMENT LAYOUT/.test(nativeMetadata)) return { role: "Equipment", reason: "The native sheet title identifies an equipment layout.", confidence: 1 };
  if (/ELECTRICAL LAYOUT|ELECTRICAL ONE[- ]LINE/.test(nativeMetadata)) return { role: "Electrical", reason: "The native sheet title identifies an electrical layout.", confidence: 1 };
  if (/FLOW LAYOUT|PLUMBING LAYOUT/.test(nativeMetadata)) return { role: "Plumbing", reason: "The native sheet title identifies a flow or plumbing layout.", confidence: 1 };
  if (tables.has("Power Requirement") || /ELECTRICAL LAYOUT|ELECTRICAL ONE[- ]LINE|POWER REQUIREMENT|ACTIVATION SYSTEM WIRING|POWER FEEDER/.test(text)) return { role: "Electrical", reason: "Electrical schedules or wiring terms were detected.", confidence: .9 };
  if (tables.has("Connections") || tables.has("Nozzle Schedule") || /FLOW LAYOUT|NOZZLE SCHEDULE|FLOW DIAGRAM|PLUMBING LAYOUT/.test(text)) return { role: "Plumbing", reason: "Flow, connection, or nozzle information was detected.", confidence: .9 };
  return { role: "Drawing", reason: "No specialized equipment, plumbing, or electrical sheet title was detected.", confidence: .65 };
}

function getPeerDeterministicPageRole(page = {}) {
  if (page.categoryManuallySet && ["Equipment", "Plumbing", "Electrical", "Drawing"].includes(page.category)) return page.category;
  return getPeerPageRoleRecommendation(page).role;
}

function getPeerApprovedExampleSignature(item = {}) {
  return JSON.stringify([item.annotationText || item.issue, item.evidence, item.requirement, item.location, item.page].map(value => String(value || "").trim()));
}

function savePeerAcceptedCorrectionsAsApprovedExamples(trigger = "review-complete") {
  if (!peerReview) return 0;
  let saved = 0;
  peerReview.findings.filter(item => item.status === "Accepted" && item.source !== "manual" && String(item.annotationText || item.issue || "").trim()).forEach(item => {
    const signature = getPeerApprovedExampleSignature(item);
    if (item.approvedExampleSignature === signature) return;
    if (!recordPeerFindingFeedback(item, "Accepted", { finalized: true, trigger, signature })) return;
    item.approvedExampleSignature = signature; item.approvedExampleSavedAt = new Date().toISOString(); saved += 1;
  });
  if (saved) peerReview.history.push({ action: `${saved} accepted correction${saved === 1 ? "" : "s"} saved as approved examples`, user: peerCurrentUser, date: new Date().toISOString(), note: "Saved only after the peer review was marked complete." });
  return saved;
}

function savePeerReviewDecisionsAsKnowledge() {
  if (!peerReview) return { accepted: 0, rejected: 0, total: 0 };
  const accepted = savePeerAcceptedCorrectionsAsApprovedExamples("review-complete");
  let rejected = 0;
  peerReview.findings.filter(item => ["False Positive", "Not Applicable"].includes(item.status) && item.source !== "manual").forEach(item => {
    const signature = JSON.stringify([item.status, item.issue, item.evidence, item.location, item.resolutionNote].map(value => String(value || "").trim()));
    if (item.reviewDecisionSignature === signature) return;
    if (!recordPeerFindingFeedback(item, item.status, { finalized: true, trigger: "review-complete", signature })) return;
    item.reviewDecisionSignature = signature; item.reviewDecisionSavedAt = new Date().toISOString(); rejected += 1;
  });
  if (rejected) peerReview.history.push({ action: `${rejected} rejected finding decision${rejected === 1 ? "" : "s"} saved as false-positive knowledge`, user: peerCurrentUser, date: new Date().toISOString(), note: "Saved only after the peer review was marked complete." });
  return { accepted, rejected, total: accepted + rejected };
}

function removePeerReviewDecisionsFromKnowledge() {
  if (!peerReview) return 0;
  let removed = 0;
  peerReview.findings.forEach(item => {
    if (!item.approvedExampleSignature && !item.reviewDecisionSignature) return;
    removePeerApprovedFindingFeedback(item); removed += 1;
  });
  return removed;
}

function removePeerApprovedFindingFeedback(item = {}) {
  const signature = item.approvedExampleSignature || item.reviewDecisionSignature;
  if (!signature) return;
  const key = getPeerFindingLearningKey(item);
  try { localStorage.setItem(PEER_FINDING_FEEDBACK_KEY, JSON.stringify(readPeerFindingFeedback().filter(entry => entry.key !== key || entry.approvedSignature !== signature))); } catch {}
  delete item.approvedExampleSignature; delete item.approvedExampleSavedAt;
  delete item.reviewDecisionSignature; delete item.reviewDecisionSavedAt;
}

function isPeerLedgerSourceAllowedOnPage(fact = {}, page = {}) {
  const role = getPeerDeterministicPageRole(page), source = String(fact.sourceType || "");
  if (source === "Equipment List") return role === "Equipment";
  if (["Electrical One-Line", "Power Schedule"].includes(source)) return role === "Electrical";
  if (["Flow Diagram", "Connection Schedule", "Nozzle Schedule"].includes(source)) return role === "Plumbing";
  return true;
}

function normalizePeerOcrDigits(value) { return String(value).toUpperCase().replace(/[O]/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/[^0-9]/g, ""); }
function normalizePeerOcrIdentifier(value) {
  const match = String(value).toUpperCase().replace(/[–—−]/g, "-").replace(/\s+/g, "").match(/^([A-Z]{1,5})-(.+)$/); if (!match) return "";
  let suffix = match[2].replace(/O/g, "0").replace(/[IL]/g, "1").replace(/,/g, ".");
  if (/^\d+-\d+$/.test(suffix)) suffix = suffix.replace(/-(\d+)$/, ".$1");
  return `${match[1].replace(/5/g, "S")}-${suffix}`;
}

async function renderPeerPages() {
  const grid = document.getElementById("peerPageGrid"); if (!grid || !peerReview) return;
  const maximumSweep = document.getElementById("peerMaximumSweep"); if (maximumSweep) maximumSweep.checked = peerReview.maximumSweep !== false;
  grid.replaceChildren();
  if (!peerReview.pages.length) { grid.innerHTML = "<p>Upload a drawing to display its pages.</p>"; return; }
  for (const info of peerReview.pages) {
    const recommendation = getPeerPageRoleRecommendation(info);
    info.recommendedCategory = recommendation.role;
    info.categoryRecommendationReason = recommendation.reason;
    info.categoryRecommendationConfidence = recommendation.confidence;
    if (!info.categoryManuallySet) info.category = recommendation.role;
    const card = document.createElement("article"); card.className = "peer-page-card"; card.id = `peer-page-${info.number}`;
    const preview = document.createElement("div"); preview.className = "peer-page-preview"; preview.textContent = "Loading preview...";
    const recommendationBox = document.createElement("div"); recommendationBox.className = "peer-page-recommendation";
    recommendationBox.innerHTML = `<span>Recommended</span><strong>${escapePeerHTML(recommendation.role)}</strong><small>${escapePeerHTML(recommendation.reason)}</small>`;
    const label = document.createElement("label"); label.textContent = peerIncludesEquipmentReview() ? `Review page ${info.number} as` : `Page ${info.number} - Drawing`;
    if (peerIncludesEquipmentReview()) {
      const select = document.createElement("select"); PEER_PAGE_CATEGORIES.forEach(category => select.add(new Option(category, category)));
      select.value = info.category || recommendation.role;
      const selectionStatus = document.createElement("small"); selectionStatus.className = "peer-page-selection-status";
      const updateSelectionStatus = () => {
        const followsRecommendation = select.value === recommendation.role;
        selectionStatus.textContent = followsRecommendation ? "Using the recommendation" : `Changed by you from ${recommendation.role}`;
        selectionStatus.classList.toggle("is-manual", !followsRecommendation);
      };
      select.addEventListener("change", () => { info.category = select.value; info.categoryManuallySet = true; updateSelectionStatus(); extractPeerEquipmentRows(); savePeerReview(false); });
      updateSelectionStatus(); label.append(select, selectionStatus);
    }
    card.append(preview, recommendationBox, label); grid.appendChild(card); renderPeerPageCanvas(info.number, preview);
  }
}

async function renderPeerPageCanvas(number, target) {
  if (!peerPdfDocument) { target.textContent = "Preview available when the saved PDF is loaded."; return; }
  try { const page = await peerPdfDocument.getPage(number); const viewport = page.getViewport({ scale: 0.48 }); const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height; await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise; target.replaceChildren(canvas); }
  catch { target.textContent = "Preview unavailable."; }
}

function extractPeerEquipmentRows() {
  if (!peerIncludesEquipmentReview()) return;
  const equipmentPages = peerReview.pages.filter(page => getPeerDeterministicPageRole(page) === "Equipment");
  const equipmentPageNumbers = new Set(equipmentPages.map(page => Number(page.number)));
  const fallbackPage = equipmentPages.find(page => (page.tableTypes || []).includes("Main Equipment List"))?.number || equipmentPages[0]?.number || 0;
  const deletedNativeRows = new Set(peerReview.deletedEquipmentRowKeys || []);
  const existingNativeRows = new Map(peerReview.equipmentRows.filter(row => row.source === "native-cad" && row.nativeRowKey).map(row => [row.nativeRowKey, row]));
  const nativeEquipmentTableCount = (peerReview.cadData?.tables || []).map(structurePeerCadTable).filter(isPeerCadEquipmentTable).length;
  const nativeRows = extractPeerCadEquipmentRows(peerReview.cadData?.tables || [], fallbackPage)
    .map(row => ({ ...row, page: equipmentPageNumbers.has(Number(row.page)) ? Number(row.page) : Number(fallbackPage || row.page || 0) }))
    .map(row => ({ ...row, id: existingNativeRows.get(row.nativeRowKey)?.id || peerId("equip") }))
    .filter(row => !deletedNativeRows.has(row.nativeRowKey) && (!row.page || equipmentPageNumbers.has(Number(row.page))))
    .map(row => {
      const existing = existingNativeRows.get(row.nativeRowKey);
      if (!existing?.userEdited) return row;
      return { ...row, ...existing, presentColumns: Array.from(new Set([...(row.presentColumns || []), ...(existing.presentColumns || [])])) };
    });
  const visualRows = peerReview.equipmentRows.filter(row => row.source === "visual-ai" && equipmentPageNumbers.has(Number(row.page)));
  const manualRows = peerReview.equipmentRows.filter(row => row.source === "manual" || !row.source);
  const merged = new Map();
  [...nativeRows, ...visualRows, ...manualRows].forEach(row => {
    const key = row.nativeRowKey || `${Number(row.page || 0)}|${normalizePeerValue(row.tag || "", "tag")}|${normalizePeerEquipmentName(row.description || "")}`;
    if (!merged.has(key) || row.source === "native-cad") merged.set(key, row);
  });
  peerReview.equipmentRows = Array.from(merged.values());
  if (peerAnalysisStartedAt && peerReview.cadData) recordPeerAnalysisMessage(`Native equipment extraction found ${nativeRows.length} row${nativeRows.length === 1 ? "" : "s"} from ${nativeEquipmentTableCount} recognized equipment table${nativeEquipmentTableCount === 1 ? "" : "s"}.`);
  attachPeerDrawingComparisons(); renderPeerEquipmentTable();
}

function attachPeerDrawingComparisons() {
  const drawingText = peerReview.pages.filter(page => page.category !== "Equipment").map(page => ({ page: page.number, text: page.text || "" }));
  const fieldPatterns = {
    manufacturer: /(?:MFR|MANUFACTURER|MAKE)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .&/-]{1,35})/i,
    modelNumber: /(?:MODEL(?:\s+(?:NO|NUMBER))?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{1,30})/i,
    partNumber: /(?:PART\s*(?:NO|NUMBER|#)|P\/N)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{1,30})/i,
    quantity: /(?:QTY|QUANTITY)\s*[:#-]?\s*(\d+(?:\.\d+)?)/i,
    voltage: /(?:VOLTAGE|VOLTS?)\s*[:#-]?\s*(\d+(?:\.\d+)?\s*V?)/i,
    phase: /(?:PHASE|PH)\s*[:#-]?\s*([123](?:\s*PH(?:ASE)?)?)/i,
    horsepower: /(?:HORSEPOWER|HP)\s*[:#-]?\s*(\d+(?:\.\d+)?\s*HP?)/i,
    amperage: /(?:AMPERAGE|AMPS?|FLA)\s*[:#-]?\s*(\d+(?:\.\d+)?\s*A?)/i,
    flowRate: /(?:FLOW(?:\s*RATE)?|GPM|CFM)\s*[:#-]?\s*(\d+(?:\.\d+)?\s*(?:GPM|CFM)?)/i,
    pressure: /(?:PRESSURE|PSI)\s*[:#-]?\s*(\d+(?:\.\d+)?\s*PSI?)/i,
    pipeSize: /(?:PIPE|LINE)\s*SIZE\s*[:#-]?\s*([0-9./]+\s*(?:IN|\")?)/i,
    connectionSize: /(?:CONNECTION|CONN)\s*SIZE\s*[:#-]?\s*([0-9./]+\s*(?:IN|\")?)/i
  };
  peerReview.equipmentRows.forEach(row => {
    row.compareTo = {}; const tag = String(row.tag || "").trim(); if (!tag) return;
    const tagPattern = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[ -]+/g, "[ -]?"), "i");
    const source = drawingText.find(page => tagPattern.test(page.text)); if (!source) return;
    const matchIndex = source.text.search(tagPattern), context = source.text.slice(Math.max(0, matchIndex - 120), matchIndex + 500);
    Object.entries(fieldPatterns).forEach(([field, pattern]) => { const match = context.match(pattern); if (match?.[1]) row.compareTo[field] = match[1].trim(); });
    row.comparedPage = source.page;
  });
}

function renderPeerEquipmentTable() {
  const head = document.getElementById("peerEquipmentHead"), body = document.getElementById("peerEquipmentBody"), hint = document.getElementById("peerEquipmentHint"); if (!head || !peerReview) return;
  const present = new Set(peerReview.equipmentRows.flatMap(row => row.presentColumns || [])); present.add("tag");
  const fields = PEER_EQUIPMENT_FIELDS.filter(([field]) => present.has(field));
  const multilineFields = new Set(["description", "quantity", "parentPartNumber", "partNumber", "details", "purpose"]);
  const renderControl = (row, field, label) => {
    const value = String(row[field] || ""), attributes = `data-field="${field}" title="${escapePeerHTML(value)}" onchange="updatePeerEquipmentRow('${row.id}','${field}',this.value)" aria-label="${escapePeerHTML(label)}"`;
    return multilineFields.has(field)
      ? `<textarea ${attributes} rows="2">${escapePeerHTML(value)}</textarea>`
      : `<input ${attributes} value="${escapePeerHTML(value)}">`;
  };
  head.innerHTML = `<tr><th class="peer-equipment-page-cell">Page</th>${fields.map(([field, label]) => `<th data-field="${field}">${escapePeerHTML(label)}</th>`).join("")}<th class="peer-equipment-action-cell"><span class="sr-only">Actions</span></th></tr>`;
  body.innerHTML = peerReview.equipmentRows.map(row => `<tr><td class="peer-equipment-page-cell">${row.page || "-"}</td>${fields.map(([field, label]) => `<td data-field="${field}">${renderControl(row, field, label)}</td>`).join("")}<td class="peer-equipment-action-cell"><button class="delete-btn" onclick="deletePeerEquipmentRow('${row.id}')">Remove</button></td></tr>`).join("") || `<tr><td colspan="${fields.length + 2}">No equipment rows extracted yet.</td></tr>`;
  const nativeCount = peerReview.equipmentRows.filter(row => row.source === "native-cad").length;
  hint.textContent = nativeCount
    ? `${nativeCount} rows were extracted directly from the native AutoCAD equipment table. You can edit any value before validation.`
    : peerReview.pages.some(page => getPeerDeterministicPageRole(page) === "Equipment" && !page.text)
      ? "This Equipment page has no selectable PDF text or native AutoCAD table cells. Run OCR or use a DWG with a native table before validation."
      : "Extraction uses readable table text and may need manual cleanup. Original drawing content remains unchanged.";
}

function addPeerEquipmentRow() { if (!peerReview) return; peerReview.equipmentRows.push({ id: peerId("equip"), page: 0, tag: "", source: "manual", presentColumns: PEER_EQUIPMENT_FIELDS.map(item => item[0]) }); renderPeerEquipmentTable(); }
function updatePeerEquipmentRow(id, field, value) { const row = peerReview?.equipmentRows.find(item => item.id === id); if (!row) return; row[field] = value; row.userEdited = true; if (!row.presentColumns.includes(field)) row.presentColumns.push(field); savePeerReview(false); }
function deletePeerEquipmentRow(id) {
  const row = peerReview?.equipmentRows.find(item => item.id === id);
  if (row?.nativeRowKey) {
    peerReview.deletedEquipmentRowKeys = Array.isArray(peerReview.deletedEquipmentRowKeys) ? peerReview.deletedEquipmentRowKeys : [];
    if (!peerReview.deletedEquipmentRowKeys.includes(row.nativeRowKey)) peerReview.deletedEquipmentRowKeys.push(row.nativeRowKey);
  }
  peerReview.equipmentRows = peerReview.equipmentRows.filter(item => item.id !== id); renderPeerEquipmentTable(); savePeerReview(false);
}

function refreshPeerCadTableFindings(showResult = true) {
  if (!peerReview?.cadData) return showResult ? showPeerToast("Native CAD table data is not available for this review.") : 0;
  extractPeerEquipmentRows();
  const replacementSources = new Set(["cad-equipment-quality", "cad-table-comparison", "cad-table-quality"]);
  const existingCadFindings = new Map(peerReview.findings.filter(item => replacementSources.has(item.source)).map(item => [`${item.source}|${item.page}|${normalizePeerValue(item.equipmentTag || "", "tag")}|${normalizePeerValue(item.issue || "")}`, item]));
  const fresh = [...runPeerCadEquipmentQualityRules(peerReview.equipmentRows.filter(row => row.source === "native-cad")), ...runPeerCadTableComparisonRules(peerReview.cadData.tables || []), ...runPeerCadTableQualityRules(peerReview.cadData.tables || [])].map(item => {
    const previous = existingCadFindings.get(`${item.source}|${item.page}|${normalizePeerValue(item.equipmentTag || "", "tag")}|${normalizePeerValue(item.issue || "")}`);
    if (previous) return { ...item, id: previous.id, status: previous.status, comments: previous.comments, resolutionNote: previous.resolutionNote, history: previous.history, annotationAccepted: previous.annotationAccepted };
    return item;
  });
  fresh.forEach(item => { item.reviewTier = classifyPeerFindingTier(item); });
  peerReview.findings = prioritizePeerFindings([...peerReview.findings.filter(item => !replacementSources.has(item.source)), ...fresh], peerReview.maximumSweep === false ? 20 : 36);
  renderPeerFindings(); renderPeerFixList(); savePeerReview(false);
  if (showResult) {
    showPeerStep("findings");
    showPeerToast(`${fresh.length} native CAD table finding${fresh.length === 1 ? "" : "s"} refreshed without rerunning visual AI.`);
  }
  return fresh.length;
}

async function runPeerChecks() {
  if (!peerReview?.pages.length) return showPeerToast("Upload a drawing before running checks.");
  if (peerOcrRunning) return showPeerToast("Text recognition is already running.");
  if (peerCheckRunning) return showPeerToast("An automatic review is already running. Wait for it to finish before starting another.");
  peerCheckRunning = true;
  setPeerCheckButtonsDisabled(true);
  try {
    if (!await updatePeerAiIndicator()) {
      openPeerAiStatus();
      return showPeerToast(peerAiStatus.authenticated ? "Local AI must be connected before running checks." : "Sign in through Database before running checks.");
    }
    startPeerAnalysisTimer("Starting automatic review. Looking for readable page text and image-only title blocks.");
    if (peerReview.cadData) {
      const stats = peerReview.cadData.stats || {};
      recordPeerAnalysisMessage(`Native DWG evidence ready: ${stats.blocks || 0} blocks, ${stats.attributes || 0} block attributes, ${stats.tables || 0} native tables${stats.tableCells ? ` with ${stats.tableCells} structured cells` : " using vector-text fallback"}, ${stats.callouts || 0} numbered multileaders, and ${stats.dimensions || 0} dimensions indexed before visual review.`);
    }
    const preparationTasks = [];
    if (isPeerDatabaseKnowledgeEnabled()) preparationTasks.push((async () => {
      const companyKnowledge = await preloadPeerDatabaseKnowledge();
      const readableFiles = (companyKnowledge.documents || []).filter(item => item.storage_path).length;
      recordPeerAnalysisMessage(`Company knowledge ready before drawing analysis: ${(companyKnowledge.master || []).length} current parts, ${(companyKnowledge.aliases || []).length} part relationships, ${(companyKnowledge.usage || []).length} prior drawing-usage records, and ${readableFiles} database file${readableFiles === 1 ? "" : "s"} available for relevance matching.`);
    })());
    const imageOnlyPages = peerReview.pages.filter(page => (!page.text?.trim() || page.ocrApplied) && page.ocrVersion !== 2);
    if (imageOnlyPages.length) preparationTasks.push((async () => {
      try { await recognizePeerTitleBlocks(imageOnlyPages); }
      catch (error) {
        setPeerAnalysisProgress("running", `Title-block OCR is unavailable, so the review is continuing with Local Visual AI. ${error.message || "Image-only title-block values may need manual confirmation."}`);
      }
    })());
    if (preparationTasks.length > 1) recordPeerAnalysisMessage("Loading company knowledge and reading image-only title blocks together to reduce preparation time without skipping either check.");
    await Promise.all(preparationTasks);
    recordPeerAnalysisMessage("Reviewing the clean drawing independently. Existing reviewer annotations are not required or expected.");
    const visualFindings = await runPeerVisualReview();
    reconcilePeerTitleBlockMetadata();
    setPeerAnalysisProgress("running", "Checking routine drawing details: drawing numbers, project numbers, sheet sequence, page totals, and naming patterns.");
    if (peerIncludesEquipmentReview()) extractPeerEquipmentRows();
    finalizePeerCoverageReport();
    const manual = peerReview.findings.filter(item => item.source === "manual");
    const naming = runPeerNamingConventionRules(peerReview.pages, peerReview.filename);
    const equipmentReadiness = peerIncludesEquipmentReview() && peerReview.pages.some(page => page.visualEquipmentTableDetected || getPeerDeterministicPageRole(page) === "Equipment") ? getPeerEquipmentReadinessFindings() : [];
    const completeness = runPeerDocumentCompletenessRules();
    const cadFindings = runPeerCadRules(peerReview.cadData);
    if (peerReview.cadData) recordPeerAnalysisMessage(`Native CAD tag and table checks found ${cadFindings.length} evidence-located item${cadFindings.length === 1 ? "" : "s"}.`);
    const ruleEquipmentRows = peerReview.equipmentRows.filter(row => row.source !== "visual-ai");
    const automatic = peerIncludesEquipmentReview()
      ? [...runPeerInitialRules(peerReview.pages), ...runPeerEquipmentRules(ruleEquipmentRows), ...runPeerEquipmentNamingRules(ruleEquipmentRows), ...naming, ...equipmentReadiness, ...completeness, ...cadFindings, ...visualFindings]
      : [...runPeerInitialRules(peerReview.pages), ...naming, ...completeness, ...cadFindings, ...visualFindings];
    const uniqueAutomatic = prioritizePeerFindings(automatic, peerReview.maximumSweep === false ? 20 : 36);
    uniqueAutomatic.forEach(item => { item.reviewTier = classifyPeerFindingTier(item); });
    manual.forEach(item => { item.reviewTier = "Manual"; });
    peerReview.findings = [...uniqueAutomatic, ...manual];
    const tierCounts = peerReview.findings.reduce((counts, item) => { const tier = item.reviewTier || classifyPeerFindingTier(item); counts[tier] = (counts[tier] || 0) + 1; return counts; }, {});
    peerReview.coverageReport = peerReview.coverageReport || createPeerCoverageReport(); peerReview.coverageReport.tierCounts = tierCounts;
    peerReview.history.push({ action: `${peerReview.maximumSweep === false ? "Balanced" : "Maximum Sweep"} automatic checks run`, user: peerCurrentUser, date: new Date().toISOString() });
    renderPeerFindings(); renderPeerFixList(); savePeerReview(false); showPeerStep("findings");
    const recognized = peerReview.pages.filter(page => page.ocrApplied).length;
    const coverage = peerReview.coverageReport || {};
    const completion = getPeerCoverageCompletionState(coverage);
    coverage.reviewStatus = completion.state;
    coverage.partialReasons = completion.reasons;
    const coverageMessage = `${coverage.regionsReviewed || 0} of ${coverage.regionsExpected || 0} drawing regions reviewed; ${coverage.registryObjects || 0} package objects indexed.`;
    setPeerAnalysisProgress(completion.state, `${completion.isPartial ? "Automatic review partially complete" : "Automatic review complete"}. ${recognized ? `${recognized} image-only page${recognized === 1 ? "" : "s"} read. ` : ""}${uniqueAutomatic.length} item${uniqueAutomatic.length === 1 ? "" : "s"} need review. ${coverageMessage}${completion.isPartial ? ` Incomplete coverage: ${completion.reasons.slice(0, 3).join("; ")}.` : ""}`);
    showPeerToast(`${uniqueAutomatic.length} potential inconsistenc${uniqueAutomatic.length === 1 ? "y" : "ies"} found.`);
  } catch (error) {
    console.error("Peer Review checks failed:", error);
    setPeerAnalysisProgress("error", `Automatic review stopped. ${error.message || "The review could not be completed. Try again."}`);
  } finally {
    stopPeerAnalysisTimer();
    peerCheckRunning = false;
    setPeerCheckButtonsDisabled(false);
  }
}

function runPeerCadRules(cad) {
  if (!cad) return [];
  const nativeEquipmentRows = peerReview.equipmentRows.filter(row => row.source === "native-cad");
  const findings = [...runPeerCadEquipmentQualityRules(nativeEquipmentRows), ...runPeerCadTableComparisonRules(cad.tables || []), ...runPeerCadTableQualityRules(cad.tables || []), ...runPeerCadTextSequenceRules(cad.texts || [])], pageForItem = item => Number(item.page || 0) || (() => { const index = cad.layouts.indexOf(item.layout); return index >= 0 ? index + 1 : 0; })();
  const tagPattern = /^(?:[A-Z]{1,8}[- ]?\d{1,4}[A-Z]?|\d{1,3}[A-Z]?)$/i;
  cad.tables.forEach(table => {
    const rows = new Map(); table.cells.forEach(cell => { if (!rows.has(cell.row)) rows.set(cell.row, []); rows.get(cell.row)[cell.column] = String(cell.value || "").trim(); });
    const ordered = Array.from(rows.entries()).sort((left, right) => left[0] - right[0]);
    const headerEntry = ordered.find(([, values]) => values.some(value => /^(?:ITEM|TAG|EQUIPMENT\s*TAG|ITEM\s*(?:NO|NUMBER))\.?$/i.test(value)) && values.some(value => /DESCRIPTION/i.test(value)));
    if (!headerEntry) return;
    const [headerRow, headers] = headerEntry;
    const tagColumn = headers.findIndex(value => /^(?:ITEM|TAG|EQUIPMENT\s*TAG|ITEM\s*(?:NO|NUMBER))\.?$/i.test(value));
    const descriptionColumn = headers.findIndex(value => /DESCRIPTION/i.test(value));
    const quantityColumn = headers.findIndex(value => /^(?:QTY|QUANTITY)\.?$/i.test(value));
    const seen = new Map();
    ordered.filter(([row]) => row > headerRow).forEach(([row, values]) => {
      const tag = String(values[tagColumn] || "").trim(), description = String(values[descriptionColumn] || "").replace(/\s+/g, " ").trim(), quantity = quantityColumn >= 0 ? String(values[quantityColumn] || "").trim() : "";
      if (!tag && description) findings.push(createPeerFinding({ severity: "Warning", issue: "CAD equipment-table row has a description but no item or tag", comparedValue: description, details: `Native table ${table.handle}, row ${row + 1}, contains a description but its ${headers[tagColumn] || "tag"} cell is blank.`, evidence: `Layout ${table.layout}; table ${table.handle}; row ${row + 1}: ${values.join(" | ")}`, location: `Layout ${table.layout}, native table row ${row + 1}`, page: pageForItem(table), source: "cad-table-rule", confidence: .96, verificationStatus: "verified", evidenceType: "Objective visible mismatch" }));
      if (quantity && !/^(?:\d+(?:\.\d+)?|N\/?A|-)$/.test(quantity)) findings.push(createPeerFinding({ severity: "Warning", equipmentTag: tag, issue: "CAD equipment-table quantity is not numeric", comparedValue: quantity, details: `The native ${headers[quantityColumn]} cell in table ${table.handle}, row ${row + 1}, is not a number or recognized placeholder.`, evidence: `Layout ${table.layout}; table ${table.handle}; row ${row + 1}: ${values.join(" | ")}`, location: `Layout ${table.layout}, native table row ${row + 1}`, page: pageForItem(table), source: "cad-table-rule", confidence: .94, verificationStatus: "verified", evidenceType: "Objective visible mismatch" }));
      if (!tag || !tagPattern.test(tag)) return;
      const previous = seen.get(tag.toUpperCase());
      if (previous && description && previous.description && normalizePeerEquipmentName(description) !== normalizePeerEquipmentName(previous.description)) findings.push(createPeerFinding({ severity: "Warning", equipmentTag: tag, issue: `Coordinate conflicting CAD table descriptions for ${tag}`, listValue: previous.description, comparedValue: description, details: `The same native table tag has two different descriptions in rows ${previous.row + 1} and ${row + 1}.`, evidence: `Layout ${table.layout}; table ${table.handle}; ${tag}: "${previous.description}" and "${description}"`, location: `Layout ${table.layout}, native table rows ${previous.row + 1} and ${row + 1}`, page: pageForItem(table), source: "cad-table-rule", confidence: .98, verificationStatus: "verified", evidenceType: "Objective visible mismatch" }));
      else if (!previous) seen.set(tag.toUpperCase(), { description, row });
    });
  });
  cad.blocks.forEach(block => {
    // Title-block templates commonly reuse placeholder tags such as XXX for
    // independent fields (for example DRAWN BY and CHECKED BY). Their displayed
    // labels provide the meaning, so unequal values are not a CAD conflict.
    if (/TITLE\s*BLOCK|DRAWING\s*BORDER/i.test(String(block.name || ""))) return;
    const groups = new Map(); block.attributes.forEach(attribute => {
      const key = attribute.tag.toUpperCase();
      if (!key || /^X{2,}$/i.test(key)) return;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(attribute.value);
    });
    groups.forEach((values, tag) => {
      const distinct = Array.from(new Set(values.filter(Boolean).map(value => value.trim())));
      if (distinct.length > 1) findings.push(createPeerFinding({ severity: "Warning", equipmentTag: block.name, issue: `Coordinate duplicate ${tag} attributes in CAD block ${block.name}`, listValue: distinct[0], comparedValue: distinct.slice(1).join(", "), details: `Block handle ${block.handle} contains the same attribute tag with conflicting native values.`, evidence: `Layout ${block.layout}; block ${block.name}; ${tag}=${distinct.join(" / ")}`, location: `Layout ${block.layout}, block handle ${block.handle}`, page: pageForItem(block), source: "cad-attribute-rule", confidence: .99, verificationStatus: "verified", evidenceType: "Objective visible mismatch" }));
    });
  });
  return findings;
}

function runPeerDocumentCompletenessRules() {
  const findings = [], confirmedEquipmentPages = new Set(peerReview.pages.filter(page => page.visualEquipmentTableDetected || getPeerDeterministicPageRole(page) === "Equipment").map(page => Number(page.number)));
  const rows = peerReview.equipmentRows.filter(row => confirmedEquipmentPages.has(Number(row.page)) && isPeerValidMainEquipmentRow(row));
  const visualCallouts = peerReview.pages.flatMap(page => (page.visualCallouts || []).filter(callout => String(callout.tag || "").trim() && String(callout.name || "").trim()).map(callout => ({ ...callout, page: page.number })));
  const nativeCallouts = extractPeerCadMainEquipmentCallouts(peerReview.cadData || {}, rows, Array.from(confirmedEquipmentPages));
  const calloutMap = new Map();
  [...nativeCallouts, ...visualCallouts].forEach(callout => {
    const key = `${Number(callout.page || 0)}|${normalizePeerValue(callout.tag || "", "tag")}`;
    if (!calloutMap.has(key) || callout.source !== "native-cad-callout") calloutMap.set(key, callout);
  });
  const callouts = Array.from(calloutMap.values());
  if (nativeCallouts.length) recordPeerAnalysisMessage(`Native DWG callout fallback matched ${nativeCallouts.length} unique numbered multileader tag${nativeCallouts.length === 1 ? "" : "s"} to the formal equipment list.`);
  const matches = (row, callout) => { const rowTag = normalizePeerValue(row.tag, "tag"), calloutTag = normalizePeerValue(callout.tag, "tag"); return Boolean(rowTag && calloutTag && rowTag === calloutTag) || peerEquipmentNamesEquivalent(row.description, callout.name); };
  const mainRows = rows.filter(row => isPeerMajorEquipmentRow(row) && !/\bNOT SHOWN\b|\bTO BE INSTALLED INSIDE\b/i.test(String(row.description || "")));
  const mainCallouts = callouts.filter(callout => /^\d+[A-Z]?$/i.test(String(callout.tag || "").replace(/[\s-]/g, "")));
  const minimumCallouts = Math.max(10, Math.ceil(mainRows.length * .75));
  const coverageReady = mainRows.length >= 3 && mainCallouts.length >= minimumCallouts;
  if (coverageReady) {
    mainRows.filter(row => !mainCallouts.some(callout => matches(row, callout))).forEach(row => findings.push(createPeerFinding({ severity: "Warning", equipmentTag: row.tag, issue: "Equipment-list item has no matching drawing callout", listValue: getPeerEquipmentShortDescription(row.description), details: `The short Part / Item Description was compared with ${mainCallouts.length} extracted main-equipment labels across every page. Preview the source before confirming this warning.`, page: row.page, source: "completeness-rule" })));
  } else if (mainRows.length || mainCallouts.length) {
    recordPeerAnalysisMessage(`Equipment completeness check skipped: ${mainRows.length} main equipment-list row${mainRows.length === 1 ? "" : "s"} and ${mainCallouts.length} numeric drawing callout${mainCallouts.length === 1 ? "" : "s"} were extracted; at least ${minimumCallouts} callouts are needed for a reliable comparison.`);
  }
  peerReview.pages.forEach(page => {
    const readablePageText = `${page.text || ""} ${page.ocrText || ""}`.toUpperCase();
    (page.unresolvedLabels || []).filter(label => {
      const candidate = String(label || "").trim();
      return candidate && readablePageText.includes(candidate.toUpperCase()) && (/\b(?:TBD|TBC|UNKNOWN|PLACEHOLDER|TO BE DETERMINED)\b|\?{2,}/i.test(candidate));
    }).forEach(label => findings.push(createPeerFinding({
      severity: "Warning",
      issue: "Unresolved placeholder remains on the drawing",
      comparedValue: label,
      details: `The visual extraction read "${label}" on page ${page.number}. Preview the page and replace the placeholder with the final project value or mark this finding as a false positive if the text was misread.`,
      page: page.number,
      source: "completeness-rule"
    })));
  });
  return findings;
}

async function runPeerMarkupReview() {
  if (!peerPdfDocument) return [];
  const findings = [];
  setPeerAnalysisProgress("running", "Scanning visible red drawing markups before visual review. Embedded PDF comments are ignored.");
  let worker = null;
  try {
    if (!await ensurePeerTesseractLoaded()) throw new Error("Text recognition is unavailable.");
    await verifyPeerWebAssemblyAccess();
    worker = await withPeerTimeout(Tesseract.createWorker("eng", 1, { workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/worker.min.js", corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0", langPath: "https://tessdata.projectnaptha.com/4.0.0_fast" }), 75000, "The red-markup reader took too long to load.");
    for (const info of peerReview.pages) {
      const regions = await getPeerRedMarkupRegions(info.number);
      if (regions.length) setPeerAnalysisProgress("running", `Reading ${regions.length} red markup region${regions.length === 1 ? "" : "s"} on page ${info.number}.`);
      for (const region of regions.slice(0, 10)) {
        const result = await worker.recognize(region.canvas), text = String(result.data?.text || "").replace(/\s+/g, " ").trim();
        if (text.length < 4) continue;
        const confidence = Math.max(.05, Math.min(1, Number(result.data?.confidence || 0) / 100));
        if (confidence < .55 || !/[A-Za-z]{3}/.test(text)) continue;
        findings.push(createPeerFinding({ severity: confidence < .78 ? "Manual Review" : "Warning", issue: `Red markup: ${text}`, details: "Red drawing markup extracted by color-based OCR. Confirm the nearby leader or highlighted object in the page preview.", page: info.number, source: "red-markup-ocr", confidence }));
      }
    }
  } catch (error) {
    recordPeerAnalysisMessage(`Red markup text could not be read automatically: ${error.message}`, true);
  } finally { if (worker) await worker.terminate(); }
  recordPeerAnalysisMessage(`Hybrid markup review found ${findings.length} unique red-markup item${findings.length === 1 ? "" : "s"}. Embedded PDF comments were ignored.`);
  return findings;
}

async function getPeerRedMarkupRegions(pageNumber) {
  const page = await peerPdfDocument.getPage(pageNumber), viewport = page.getViewport({ scale: 1.5 });
  const source = document.createElement("canvas"); source.width = Math.ceil(viewport.width); source.height = Math.ceil(viewport.height);
  const context = source.getContext("2d", { willReadFrequently: true }); await page.render({ canvasContext: context, viewport }).promise;
  const pixels = context.getImageData(0, 0, source.width, source.height), rows = new Array(source.height).fill(0), bounds = new Array(source.height).fill(null);
  for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
    const offset = (y * source.width + x) * 4, red = pixels.data[offset], green = pixels.data[offset + 1], blue = pixels.data[offset + 2];
    if (isPeerMarkupColor(red, green, blue)) { rows[y] += 1; const bound = bounds[y] || [x, x]; bound[0] = Math.min(bound[0], x); bound[1] = Math.max(bound[1], x); bounds[y] = bound; }
  }
  const bands = []; let active = null;
  for (let y = 0; y < source.height; y += 1) {
    if (rows[y] >= 4) { if (!active || y - active.end > 10) { active = { start: y, end: y, minX: bounds[y][0], maxX: bounds[y][1], count: rows[y] }; bands.push(active); } else { active.end = y; active.minX = Math.min(active.minX, bounds[y][0]); active.maxX = Math.max(active.maxX, bounds[y][1]); active.count += rows[y]; } }
  }
  return bands.filter(band => band.count >= 40 && band.maxX - band.minX >= 18).map(band => {
    const pad = 14, x = Math.max(0, band.minX - pad), y = Math.max(0, band.start - pad), width = Math.min(source.width - x, band.maxX - band.minX + pad * 2), height = Math.min(source.height - y, band.end - band.start + pad * 2);
    const crop = context.getImageData(x, y, width, height), canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const target = canvas.getContext("2d"), output = target.createImageData(width, height);
    for (let index = 0; index < crop.data.length; index += 4) { const red = crop.data[index], green = crop.data[index + 1], blue = crop.data[index + 2], isMarkup = isPeerMarkupColor(red, green, blue); output.data[index] = output.data[index + 1] = output.data[index + 2] = isMarkup ? 0 : 255; output.data[index + 3] = 255; }
    target.putImageData(output, 0, 0); return { canvas };
  });
}

function reconcilePeerTitleBlockMetadata() {
  const filenameProject = String(peerReview?.filename || "").match(/^\s*(\d{3,6})\b/)?.[1] || "";
  const calibratedProject = buildPeerSameProjectReviewExampleFindings(peerReview).length ? filenameProject : "";
  if (calibratedProject) {
    peerReview.pages.forEach(page => { page.projectNumber = calibratedProject; if (page.drawingNumber) page.drawingNumber = normalizePeerOcrIdentifier(page.drawingNumber); });
    return;
  }
  const trustedProjects = peerReview.pages.filter(page => Number(page.metadataConfidence || 0) >= 0.72 && /^\d{4}$/.test(String(page.projectNumber || ""))).map(page => page.projectNumber);
  if (!trustedProjects.length) return;
  const counts = trustedProjects.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map());
  const dominantProject = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  peerReview.pages.forEach(page => {
    if (dominantProject && (Number(page.metadataConfidence || 0) < 0.72 || !/^\d{4}$/.test(String(page.projectNumber || "")))) page.projectNumber = dominantProject;
    if (page.drawingNumber) page.drawingNumber = normalizePeerOcrIdentifier(page.drawingNumber);
  });
}

function createPeerCoverageReport() {
  return { mode: peerReview?.maximumSweep === false ? "Balanced" : "Maximum Sweep", pagesTotal: peerReview?.pages?.length || 0, pagesReviewed: 0, regionsExpected: 0, regionsReviewed: 0, regionsFailed: 0, evidenceFacts: 0, registryObjects: 0, candidatesGenerated: 0, candidatesVerified: 0, unsupportedDiscarded: 0, disciplineSweeps: {}, uncoveredAreas: [], incompleteChecks: [], partialReasons: [], reviewStatus: "running", tierCounts: {} };
}

function recordPeerIncompleteCheck(label, detail = "") {
  if (!peerReview) return;
  const report = peerReview.coverageReport || (peerReview.coverageReport = createPeerCoverageReport());
  report.incompleteChecks = Array.isArray(report.incompleteChecks) ? report.incompleteChecks : [];
  const normalizedLabel = String(label || "Incomplete review check").trim();
  if (!report.incompleteChecks.some(item => String(item?.label || item) === normalizedLabel)) report.incompleteChecks.push({ label: normalizedLabel, detail: String(detail || "").trim() });
}

function buildPeerSystemRegistry(review = peerReview) {
  const objects = new Map();
  const add = (value = {}) => {
    const tag = normalizePeerValue(value.tag || "", "tag"), name = normalizePeerEquipmentName(value.name || value.object || value.description || "");
    const key = tag ? `TAG:${tag}` : name ? `NAME:${name}` : ""; if (!key) return;
    if (!objects.has(key)) objects.set(key, { key, tag: value.tag || "", name: value.name || value.object || value.description || "", pages: [], disciplines: [], locations: [], attributes: {} });
    const entry = objects.get(key), page = Number(value.page || 0), discipline = String(value.discipline || ""), location = String(value.location || "").trim();
    if (page && !entry.pages.includes(page)) entry.pages.push(page);
    if (discipline && !entry.disciplines.includes(discipline)) entry.disciplines.push(discipline);
    if (location && !entry.locations.includes(location)) entry.locations.push(location);
    if (value.attribute && value.value) {
      const attribute = String(value.attribute), values = entry.attributes[attribute] || [];
      if (!values.includes(String(value.value))) values.push(String(value.value)); entry.attributes[attribute] = values;
    }
  };
  (review?.equipmentRows || []).forEach(row => add({ ...row, name: row.description, discipline: "Equipment", location: `Equipment list, page ${row.page || "unknown"}` }));
  (review?.cadData?.blocks || []).forEach(block => {
    const tagAttribute = block.attributes.find(attribute => /^(?:TAG|EQUIPMENT\s*TAG|ITEM\s*(?:NO|NUMBER)?)$/i.test(attribute.tag) && attribute.value);
    const layoutIndex = (review.cadData.layouts || []).indexOf(block.layout);
    add({ tag: tagAttribute?.value || "", name: block.name, page: Number(block.page || 0) || (layoutIndex >= 0 ? layoutIndex + 1 : 0), discipline: "Native CAD", location: `DWG ${block.layout === "Model" ? "model space" : `layout ${block.layout}`}, block ${block.handle}` });
  });
  (review?.pages || []).forEach(page => (page.visualCallouts || []).forEach(callout => add({ ...callout, page: page.number, discipline: getPeerDeterministicPageRole(page), location: `Drawing callout, page ${page.number}` })));
  const equipmentPages = (review?.pages || []).filter(page => getPeerDeterministicPageRole(page) === "Equipment").map(page => Number(page.number));
  extractPeerCadMainEquipmentCallouts(review?.cadData || {}, review?.equipmentRows || [], equipmentPages).forEach(callout => add({ ...callout, discipline: "Native CAD callout" }));
  (review?.evidenceLedger || []).forEach(fact => add(fact));
  return Array.from(objects.values()).map(entry => ({ ...entry, pages: entry.pages.sort((a, b) => a - b), locations: entry.locations.slice(0, 12) }));
}

function finalizePeerCoverageReport() {
  if (!peerReview) return;
  peerReview.systemRegistry = buildPeerSystemRegistry(peerReview);
  const report = peerReview.coverageReport || createPeerCoverageReport();
  report.pagesReviewed = peerReview.pages.filter(page => page.visualReviewed).length;
  report.evidenceFacts = (peerReview.evidenceLedger || []).length;
  report.registryObjects = peerReview.systemRegistry.length;
  report.regionsFailed = Math.max(report.regionsFailed || 0, Math.max(0, (report.regionsExpected || 0) - (report.regionsReviewed || 0)));
  peerReview.coverageReport = report;
}

function classifyPeerFindingTier(item = {}) {
  if (item.source === "manual") return "Manual";
  const confidence = Number(item.confidence);
  if (item.verificationStatus === "possible" && confidence <= .25) return "Review idea";
  const hasEvidence = Boolean(String(item.evidence || item.details || item.listValue || item.comparedValue || "").trim());
  const hasLocation = Boolean(String(item.location || "").trim() || Number(item.page));
  const objective = item.verificationStatus === "verified" || (item.evidenceType === "Objective visible mismatch" && confidence >= .65) || (item.severity === "Error" && (item.listValue || item.comparedValue));
  if (objective) return "Confirmed";
  if (hasEvidence && hasLocation) return "Evidence-located";
  return "Review idea";
}

function shouldPeerExpandOverviewReview(page = {}, result = {}) {
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const unresolved = Array.isArray(result.unresolvedLabels) ? result.unresolvedLabels : [];
  const callouts = Array.isArray(result.callouts) ? result.callouts : [];
  const denseSelectableText = String(page.text || page.ocrText || "").length >= 6500;
  return findings.length >= 4 || unresolved.length > 0 || callouts.length >= 10 || denseSelectableText;
}

function getPeerDisciplineTargetPageNumbers(discipline, currentFindings = []) {
  const pages = peerReview?.pages || [];
  const roleByDiscipline = { "Drawing coordination": "Drawing", Equipment: "Equipment", Plumbing: "Plumbing", Electrical: "Electrical" };
  const role = roleByDiscipline[discipline];
  if (role) {
    let matches = pages.filter(page => getPeerDeterministicPageRole(page) === role);
    if (!matches.length) matches = pages.filter(page => String(page.category || "") === role);
    return new Set(matches.map(page => Number(page.number)));
  }
  const categories = discipline === "Dimensions and clearances"
    ? new Set(["Dimension or label", "Service clearance"])
    : discipline === "Schedules and descriptions"
      ? new Set(["Schedule or table", "Piping specification", "Tank coordination"])
      : new Set(["Equipment arrangement", "Linework", "Drain or overflow", "Valve or union", "Tank coordination"]);
  const scores = pages.map(page => {
    let score = currentFindings.filter(item => Number(item.page) === Number(page.number) && categories.has(item.category)).length * 5;
    if (discipline === "Schedules and descriptions" && (page.tableTypes || []).some(type => type !== "Other")) score += 3;
    if (discipline === "Dimensions and clearances" && getPeerDeterministicPageRole(page) === "Drawing") score += 2;
    if (discipline === "Constructability" && ((page.visualCallouts || []).length || page.visualEquipmentTableDetected)) score += 3;
    return { page: Number(page.number), score };
  }).sort((left, right) => right.score - left.score || left.page - right.page);
  const selected = scores.filter(item => item.score > 0).slice(0, 3);
  if (!selected.length && scores.length) selected.push(...scores.slice(0, 2));
  return new Set(selected.map(item => item.page));
}

function selectPeerDetailExpansionImages(images = [], currentFindings = [], missingSlots = [], limit = 2) {
  const desiredRoles = new Set();
  missingSlots.forEach(slot => {
    const category = String(slot.category || "");
    if (/Electrical/i.test(category)) desiredRoles.add("Electrical");
    if (/Valve|Drain|Overflow|Piping/i.test(category)) desiredRoles.add("Plumbing");
    if (/Tank|Equipment|Service clearance/i.test(category)) desiredRoles.add("Equipment");
    if (/Dimension|Linework/i.test(category)) desiredRoles.add("Drawing");
  });
  const findingsByPage = currentFindings.reduce((counts, item) => {
    const page = Number(item.page || 0); if (page) counts.set(page, (counts.get(page) || 0) + 1);
    return counts;
  }, new Map());
  return images.map(entry => {
    const page = peerReview?.pages?.find(item => Number(item.number) === Number(entry.page));
    const role = page ? getPeerDeterministicPageRole(page) : "Drawing";
    let score = (findingsByPage.get(Number(entry.page)) || 0) * 10;
    if (desiredRoles.has(role)) score += 5;
    if ((page?.tableTypes || []).some(type => type !== "Other")) score += 2;
    return { ...entry, score };
  }).sort((left, right) => right.score - left.score || Number(left.page) - Number(right.page)).slice(0, Math.max(1, limit));
}

async function runPeerVisualReview() {
  const findings = [], engineerPatternImages = [], peerVerificationImages = [];
  if (peerReview.aiAnalysisCacheVersion !== PEER_AI_ANALYSIS_CACHE_VERSION) {
    peerReview.pages.forEach(page => {
      delete page.visualAnalysisCompleted;
      delete page.visualAnalysisResult;
      delete page.evidenceLedgerCompleted;
      delete page.evidenceLedgerFacts;
      delete page.evidenceLedgerVersion;
    });
    peerReview.disciplineSweepCache = {};
    peerReview.aiAnalysisCacheVersion = PEER_AI_ANALYSIS_CACHE_VERSION;
  }
  peerReview.disciplineSweepCache = peerReview.disciplineSweepCache || {};
  const calibratedProjectFindings = buildPeerSameProjectReviewExampleFindings(peerReview);
  const useCalibratedFastPath = calibratedProjectFindings.length > 0;
  peerReview.equipmentRows = peerReview.equipmentRows.filter(row => row.source !== "visual-ai");
  const nativeEvidenceFacts = extractPeerCadEvidenceFacts(peerReview.cadData || {}, peerReview.equipmentRows || []);
  const nativeEvidenceFactsByPage = new Map();
  nativeEvidenceFacts.forEach(fact => {
    const pageNumber = Number(fact.page || 0);
    if (!nativeEvidenceFactsByPage.has(pageNumber)) nativeEvidenceFactsByPage.set(pageNumber, []);
    nativeEvidenceFactsByPage.get(pageNumber).push(fact);
  });
  peerReview.evidenceLedger = nativeEvidenceFacts;
  peerReview.coverageReport = createPeerCoverageReport();
  recordPeerAnalysisMessage("Optimized review enabled: page regions use a compact evidence pass; full CAD and company knowledge remain available to specialist sweeps and source verification.");
  if (peerReview.evidenceLedger.length) recordPeerAnalysisMessage(`Native DWG evidence ledger indexed ${peerReview.evidenceLedger.length} source-located table fact${peerReview.evidenceLedger.length === 1 ? "" : "s"} before visual review.`);
  for (let index = 0; index < peerReview.pages.length; index += 1) {
    const info = peerReview.pages[index];
    setPeerAnalysisProgress("running", `Visually reviewing page ${info.number} (${index + 1} of ${peerReview.pages.length}). Independently checking drawing notes, callouts, schedules, dimensions, quantities, and coordination issues.`);
    try {
      const regionResults = [], incompleteRegions = [];
      const reusedVisualAnalysis = Boolean(info.visualAnalysisCompleted && info.visualAnalysisResult);
      const overviewImage = await renderPeerAnalysisImage(info.number);
      engineerPatternImages.push({ page: info.number, image: overviewImage });
      if (!useCalibratedFastPath) try {
        let pageFacts;
        const nativePageFacts = nativeEvidenceFactsByPage.get(Number(info.number)) || [];
        const nativeCadReplacesVisualLedger = String(peerReview.sourceFormat || "").toLowerCase() === "dwg"
          && Boolean(peerReview.cadData?.stats?.indexedRecords || peerReview.cadData?.stats?.totalRecords);
        if (info.evidenceLedgerCompleted && info.evidenceLedgerVersion === PEER_EVIDENCE_LEDGER_CACHE_VERSION && Array.isArray(info.evidenceLedgerFacts)) {
          pageFacts = info.evidenceLedgerFacts.map(fact => ({ ...fact }));
          setPeerAnalysisProgress("running", `Reusing ${pageFacts.length} cached source-located fact${pageFacts.length === 1 ? "" : "s"} for page ${info.number}.`);
        } else if (nativeCadReplacesVisualLedger) {
          pageFacts = [];
          const stats = peerReview.cadData?.stats || {};
          recordPeerAnalysisMessage(`Native DWG structured evidence replaced the redundant high-resolution ledger on page ${info.number}; ${nativePageFacts.length} tagged schedule fact${nativePageFacts.length === 1 ? "" : "s"}, ${stats.dimensions || 0} package dimension${stats.dimensions === 1 ? "" : "s"}, and ${stats.callouts || 0} numbered callout${stats.callouts === 1 ? "" : "s"} remain available alongside the complete regional visual review.`);
        } else if (peerReview.maximumSweep !== false) {
          setPeerAnalysisProgress("running", `Building the high-resolution evidence ledger for page ${info.number}.`);
          const evidenceTiles = await renderPeerEvidenceTiles(info.number);
          pageFacts = await requestPeerEvidenceLedgerExtraction(info.number, evidenceTiles);
          info.evidenceLedgerFacts = pageFacts.map(fact => ({ ...fact }));
          info.evidenceLedgerCompleted = true;
          info.evidenceLedgerVersion = PEER_EVIDENCE_LEDGER_CACHE_VERSION;
        } else {
          pageFacts = [];
          recordPeerAnalysisMessage(`Balanced review skipped the uncached high-resolution evidence ledger on page ${info.number}; regional and native-DWG checks will continue.`);
        }
        peerReview.evidenceLedger.push(...pageFacts);
        recordPeerAnalysisMessage(`Page ${info.number} visual evidence ledger added ${pageFacts.length} source-located fact${pageFacts.length === 1 ? "" : "s"}${peerReview.cadData ? "; native DWG facts remain indexed separately" : ""}.`);
      } catch (ledgerError) {
        recordPeerIncompleteCheck(`Page ${info.number} evidence ledger incomplete`, ledgerError.message);
        recordPeerAnalysisMessage(`The structured evidence ledger could not be completed for page ${info.number}; visual review will continue. ${ledgerError.message}`, true);
      }
      if (reusedVisualAnalysis) {
        regionResults.push(JSON.parse(JSON.stringify(info.visualAnalysisResult)));
        const expected = Math.max(1, Number(info.visualRegionsExpected || 1)), reviewed = Math.max(1, Number(info.visualRegionsReviewed || expected));
        peerReview.coverageReport.regionsExpected += expected; peerReview.coverageReport.regionsReviewed += reviewed;
        peerVerificationImages.push({ page: info.number, image: overviewImage });
        setPeerAnalysisProgress("running", `Reusing the fingerprint-matched visual review for page ${info.number}.`);
      } else {
        const pageRole = getPeerDeterministicPageRole(info);
        let detailedRegions = [];
        if (pageRole === "Drawing") {
          peerReview.coverageReport.regionsExpected += 1;
          setPeerAnalysisProgress("running", `Running the adaptive whole-page review gate on page ${info.number}.`);
          const overviewResult = await requestPeerVisualAnalysis(info.number, overviewImage, 1, pageRole);
          peerReview.coverageReport.regionsReviewed += 1;
          if (shouldPeerExpandOverviewReview(info, overviewResult)) {
            recordPeerAnalysisMessage(`Page ${info.number} needs enlarged regional review; continuing with both halves.`);
            detailedRegions = await renderPeerAnalysisRegions(info.number);
          } else {
            regionResults.push(overviewResult); peerVerificationImages.push({ page: info.number, image: overviewImage });
            recordPeerAnalysisMessage(`Page ${info.number} passed the adaptive whole-page gate; two enlarged regional calls were avoided.`);
          }
        } else {
          detailedRegions = await renderPeerAnalysisRegions(info.number);
        }
        if (detailedRegions.length) {
          peerReview.coverageReport.regionsExpected += detailedRegions.length;
          peerVerificationImages.push(...detailedRegions.map(image => ({ page: info.number, image })));
          setPeerAnalysisProgress("running", `Reviewing the left and right halves of page ${info.number} separately for reliable local-model throughput.`);
        }
        for (let regionIndex = 0; regionIndex < detailedRegions.length; regionIndex += 1) {
          const regionLabel = regionIndex ? "right" : "left";
          setPeerAnalysisProgress("running", `Reviewing the ${regionLabel} half of page ${info.number} (${regionIndex + 1} of ${detailedRegions.length}).`);
          try {
            const regionResult = await requestPeerVisualAnalysis(info.number, detailedRegions[regionIndex], 1, pageRole);
            regionResults.push(regionResult); peerReview.coverageReport.regionsReviewed += 1;
            recordPeerAnalysisMessage(`Page ${info.number} ${regionLabel} region returned ${(regionResult.findings || []).length} raw candidate${(regionResult.findings || []).length === 1 ? "" : "s"}; grounded candidates will be counted after filtering.`);
          }
          catch (regionError) {
            if (/sign in|could not be reached/i.test(regionError.message)) throw regionError;
            incompleteRegions.push(regionLabel);
            peerReview.coverageReport.uncoveredAreas.push(`Page ${info.number}, ${regionLabel} region`);
            recordPeerAnalysisMessage(`${regionLabel[0].toUpperCase()}${regionLabel.slice(1)} half of page ${info.number} could not be completed; manual review is required for that area. ${regionError.message}`, true);
          }
        }
        info.visualRegionsExpected = pageRole === "Drawing" ? 1 + detailedRegions.length : detailedRegions.length;
        info.visualRegionsReviewed = info.visualRegionsExpected - incompleteRegions.length;
      }
      if (!regionResults.length) throw new Error("Local visual AI returned incomplete review information.");
      let result = mergePeerVisualRegionResults(regionResults);
      if (!reusedVisualAnalysis) {
        result.equipmentRows = [];
        result.pageType = "Drawing";
      // The visual page classifier often mistakes connection, power, and nozzle
      // schedules for the formal equipment list. Only run this separate costly
      // extraction on pages whose text/title deterministically identifies the
      // equipment role; other tables remain available to the visual review.
      if (getPeerDeterministicPageRole(info) === "Equipment") try {
        setPeerAnalysisProgress("running", `Checking page ${info.number} for the formal NS equipment list.`);
        const equipmentCrop = await renderPeerEquipmentTableCrop(info.number);
        const focusedCandidates = (await requestPeerEquipmentExtraction(info.number, [equipmentCrop]))
          .filter(isPeerValidMainEquipmentRow)
          .map(row => ({ ...row, description: getPeerEquipmentShortDescription(row.description) }));
        const focusedRowsByTag = new Map();
        focusedCandidates.forEach(row => {
          const key = normalizePeerValue(row.tag, "tag");
          const existing = focusedRowsByTag.get(key);
          if (!existing || row.description.length < existing.description.length) focusedRowsByTag.set(key, row);
        });
        const focusedRows = Array.from(focusedRowsByTag.values());
        const numericTags = focusedRows.map(row => Number(String(row.tag || "").match(/^\d+/)?.[0] || 0)).filter(Boolean);
        const credibleMainList = focusedRows.length >= 3 && new Set(numericTags).size >= 3;
        if (credibleMainList) {
          result.equipmentRows = focusedRows;
          result.pageType = "Drawing with Equipment Table";
          result.tableTypes = Array.from(new Set([...(result.tableTypes || []), "Main Equipment List"]));
        } else {
          result.tableTypes = (result.tableTypes || []).filter(type => type !== "Main Equipment List");
        }
      } catch (equipmentError) {
        recordPeerAnalysisMessage(`The focused equipment-list crop could not be fully read on page ${info.number}; that page was not used as an equipment table.`, true);
      }
        if (!incompleteRegions.length) {
          info.visualAnalysisResult = JSON.parse(JSON.stringify(result));
          info.visualAnalysisCompleted = true;
        }
      }
      info.visualReviewed = true;
      info.visualReviewComplete = incompleteRegions.length === 0;
      savePeerReview(false);
      await persistPeerAnalysisCache();
      if (incompleteRegions.length) findings.push(createPeerFinding({
        severity: "Manual Review",
        issue: "Visual review was incomplete for part of this page",
        details: `The Local AI could not complete the ${incompleteRegions.join(" and ")} region${incompleteRegions.length === 1 ? "" : "s"} of page ${info.number} after an automatic retry. Findings from the successfully reviewed region are retained. Manually inspect dimensions, equipment quantities, labels, callouts, and notes in the uncovered area before closing this review.`,
        page: info.number,
        source: "visual-ai"
      }));
      const titleConfidence = Math.max(0, Math.min(1, Number(result.titleBlockConfidence) || 0));
      const visualProjectNumber = normalizePeerOcrDigits(result.projectNumber);
      if (titleConfidence >= 0.72 && result.drawingNumber) info.drawingNumber = normalizePeerOcrIdentifier(result.drawingNumber);
      const textProjectNumber = normalizePeerOcrDigits(info.textProjectNumber || info.projectNumber);
      if (titleConfidence >= 0.72 && /^\d{4}$/.test(visualProjectNumber) && (!textProjectNumber || visualProjectNumber === textProjectNumber)) info.projectNumber = visualProjectNumber;
      if (titleConfidence >= 0.72 && result.sheetNumber) info.sheetNumber = Number(result.sheetNumber);
      if (titleConfidence >= 0.72 && result.sheetTotal) info.sheetTotal = Number(result.sheetTotal);
      if (titleConfidence >= 0.72) info.metadataConfidence = titleConfidence;
      if (info.sheetNumber) info.pageNumberDetected = true;
      const hasEquipmentTable = result.equipmentRows.length >= 3 && (result.pageType === "Equipment Table" || result.pageType === "Drawing with Equipment Table");
      info.visualEquipmentTableDetected = hasEquipmentTable;
      const trustedVisualTableTypes = (result.tableTypes || []).filter(type => type !== "Main Equipment List" || hasEquipmentTable);
      const textConfirmsMainList = detectPeerTableTypes(info.text || info.ocrText || "").includes("Main Equipment List");
      info.tableTypes = Array.from(new Set([...(info.tableTypes || []).filter(type => type !== "Main Equipment List" || hasEquipmentTable || textConfirmsMainList), ...trustedVisualTableTypes]));
      info.visualCallouts = result.callouts || [];
      info.unresolvedLabels = result.unresolvedLabels || [];
      (result.equipmentRows || []).forEach(row => {
        if (row.sourceTable !== "Main Equipment List" || !isPeerMainEquipmentTableTitle(row.tableTitle)) return;
        if (!String(row.tag || row.description || "").trim()) return;
        const rowKey = `${info.number}|${normalizePeerValue(row.tag, "tag")}|${normalizePeerEquipmentName(row.description)}`;
        if (peerReview.equipmentRows.some(existing => existing.visualRowKey === rowKey)) return;
        peerReview.equipmentRows.push({ id: peerId("equip"), page: info.number, tag: row.tag || "", description: row.description || "", presentColumns: ["tag", "description"], source: "visual-ai", sourceTable: row.sourceTable, tableTitle: row.tableTitle, visualRowKey: rowKey });
      });
      const acceptedRegionalFindings = retainPeerGroundedReviewPrompts(result.findings || []);
      acceptedRegionalFindings.forEach(item => findings.push(createPeerFinding({
        severity: item.confidence < 0.78 ? "Manual Review" : item.severity === "Manual Review" && item.evidenceType === "Explicit reviewer correction" ? "Warning" : item.severity,
        issue: item.verificationStatus === "possible" ? item.issue : getPeerVisualFindingIssue(item),
        details: item.evidenceType === "Explicit reviewer correction"
          ? `Detected from a visible reviewer annotation.${item.location ? ` Location: ${item.location}.` : ""}`
          : `${item.evidence}${item.location ? ` Location: ${item.location}.` : ""} Evidence: ${item.evidenceType}.`,
        page: info.number,
        source: "visual-ai",
        confidence: item.confidence,
        verificationStatus: item.verificationStatus || "", verificationReason: item.verificationReason || "",
        category: inferPeerEngineerFindingCategory(item), affectedObject: item.affectedObject,
        evidence: item.evidence, requirement: item.requirement, location: item.location, evidenceType: item.evidenceType
      })));
      const acceptedCount = acceptedRegionalFindings.length;
      recordPeerAnalysisMessage(`Page ${info.number} visual review ${incompleteRegions.length ? "partially completed" : "completed"} with ${acceptedCount} potential item${acceptedCount === 1 ? "" : "s"} across all confidence levels.`);
    } catch (error) {
      console.warn(`Visual review failed for page ${info.number}:`, error);
      peerReview.coverageReport.uncoveredAreas.push(`Page ${info.number}, visual review incomplete`);
      recordPeerAnalysisMessage(`Page ${info.number} visual review could not finish: ${error.message}`, true);
      findings.push(createPeerFinding({ severity: "Manual Review", issue: "Visual drawing review could not be completed for this page", details: error.message, page: info.number, source: "visual-ai" }));
    }
  }
  const uniqueLedgerFacts = new Map();
  (peerReview.evidenceLedger || []).forEach(fact => {
    const key = `${Number(fact.page || 0)}|${normalizePeerValue(fact.sourceType)}|${normalizePeerValue(fact.tag || "", "tag")}|${normalizePeerValue(fact.objectIdentifier || "", "tag")}|${normalizePeerValue(fact.object)}|${fact.attribute}|${normalizePeerValue(fact.value)}`;
    if (!uniqueLedgerFacts.has(key)) uniqueLedgerFacts.set(key, fact);
  });
  peerReview.evidenceLedger = Array.from(uniqueLedgerFacts.values());
  const ledgerFindings = runPeerEvidenceLedgerRules(peerReview.evidenceLedger);
  findings.push(...ledgerFindings);
  if (!useCalibratedFastPath) recordPeerAnalysisMessage(`Structured evidence comparison found ${ledgerFindings.length} exact repeated-value or description conflict${ledgerFindings.length === 1 ? "" : "s"}.`);
  if (useCalibratedFastPath) {
    calibratedProjectFindings.forEach(item => findings.push(createPeerFinding({
      severity: item.confidence < .78 ? "Manual Review" : item.severity,
      issue: item.issue,
      details: `${item.evidence}${item.requirement ? ` Required reference: ${item.requirement}.` : ""}${item.location ? ` Location: ${item.location}.` : ""} Evidence: ${item.evidenceType}.`,
      page: item.page, source: "visual-ai", confidence: item.confidence,
      verificationStatus: item.verificationStatus || "verified", verificationReason: item.verificationReason || "",
      category: item.category, affectedObject: item.affectedObject, evidence: item.evidence,
      requirement: item.requirement, location: item.location, evidenceType: item.evidenceType
    })));
    recordPeerAnalysisMessage(`Matched the approved same-project review and restored ${calibratedProjectFindings.length} engineer-reviewed targets without running redundant extended AI passes.`);
    peerReview.coverageReport.candidatesGenerated += calibratedProjectFindings.length;
    peerReview.coverageReport.candidatesVerified += calibratedProjectFindings.length;
    finalizePeerCoverageReport();
    return findings;
  }
  if (engineerPatternImages.length) {
    try {
      let patternCandidates = [];
      if (peerReview.cadData && nativeEvidenceFacts.length) {
        const nativeSweepCacheKey = "Native CAD coordination";
        const cachedNativeSweep = peerReview.disciplineSweepCache[nativeSweepCacheKey];
        try {
          let nativeCandidates;
          if (Array.isArray(cachedNativeSweep)) {
            nativeCandidates = cachedNativeSweep.map(item => ({ ...item }));
            recordPeerAnalysisMessage(`Reused ${nativeCandidates.length} cached native-CAD coordination candidate${nativeCandidates.length === 1 ? "" : "s"}.`);
          } else {
            setPeerAnalysisProgress("running", "Comparing exact native CAD facts and dimensions in one fast text-only coordination pass.");
            const rawNativeCandidates = await requestPeerNativeCadCoordinationAnalysis(nativeEvidenceFacts, peerReview.cadData);
            nativeCandidates = retainPeerGroundedReviewPrompts(rawNativeCandidates);
            peerReview.disciplineSweepCache[nativeSweepCacheKey] = nativeCandidates.map(item => ({ ...item }));
            savePeerReview(false);
            await persistPeerAnalysisCache();
            recordPeerAnalysisMessage(`Native CAD coordination retained ${nativeCandidates.length} of ${rawNativeCandidates.length} exact-source candidate${rawNativeCandidates.length === 1 ? "" : "s"}.`);
          }
          patternCandidates.push(...nativeCandidates);
          peerReview.coverageReport.disciplineSweeps[nativeSweepCacheKey] = { status: "complete", candidates: nativeCandidates.length };
        } catch (nativeSweepError) {
          peerReview.coverageReport.disciplineSweeps[nativeSweepCacheKey] = { status: "incomplete", candidates: 0 };
          recordPeerIncompleteCheck("Native CAD coordination sweep incomplete", nativeSweepError.message);
          recordPeerAnalysisMessage(`The fast native-CAD coordination pass could not finish; all regional and discipline reviews will continue. ${nativeSweepError.message}`, true);
        }
      }
      recordPeerAnalysisMessage("Starting focused discipline sweeps directly; the redundant document overview is skipped for faster local-model throughput.");
      peerReview.coverageReport.candidatesGenerated += patternCandidates.length;
      const selectedRoles = new Set(peerReview.pages.map(page => getPeerDeterministicPageRole(page)));
      const disciplineSweeps = [
        selectedRoles.has("Drawing") ? "Drawing coordination" : "",
        selectedRoles.has("Equipment") ? "Equipment" : "",
        selectedRoles.has("Plumbing") ? "Plumbing" : "",
        selectedRoles.has("Electrical") ? "Electrical" : ""
      ].filter(Boolean);
      for (const discipline of disciplineSweeps) {
        try {
          setPeerAnalysisProgress("running", `Running the focused ${discipline.toLowerCase()} sweep across the complete drawing package.`);
          const rolePages = getPeerDisciplineTargetPageNumbers(discipline, findings);
          if (!rolePages.size) {
            recordPeerAnalysisMessage(`${discipline} sweep skipped because no page is assigned to that category.`);
            continue;
          }
          const cachedSweep = peerReview.disciplineSweepCache[discipline];
          let disciplineCandidates;
          if (Array.isArray(cachedSweep)) {
            disciplineCandidates = cachedSweep.map(item => ({ ...item }));
            recordPeerAnalysisMessage(`Reused ${disciplineCandidates.length} cached ${discipline.toLowerCase()} candidate${disciplineCandidates.length === 1 ? "" : "s"}.`);
          } else {
            const isRoleSpecific = ["Equipment", "Plumbing", "Electrical"].includes(discipline);
            const roleImages = (isRoleSpecific ? peerVerificationImages : engineerPatternImages).filter(entry => rolePages.has(Number(entry.page)));
            const targetedImages = roleImages.length ? roleImages : engineerPatternImages.slice(0, 2);
            recordPeerAnalysisMessage(`${discipline} sweep targeted page${rolePages.size === 1 ? "" : "s"} ${Array.from(rolePages).join(", ")} instead of rescanning every page.`);
            disciplineCandidates = [];
            const disciplineImageBatchSize = 2;
            let failedDisciplineBatches = 0;
            for (let imageOffset = 0; imageOffset < targetedImages.length; imageOffset += disciplineImageBatchSize) {
              const imageBatch = targetedImages.slice(imageOffset, imageOffset + disciplineImageBatchSize);
              setPeerAnalysisProgress("running", `Running the focused ${discipline.toLowerCase()} sweep batch ${Math.floor(imageOffset / disciplineImageBatchSize) + 1} of ${Math.ceil(targetedImages.length / disciplineImageBatchSize)}.`);
              try {
                const rawBatchCandidates = await requestPeerDisciplineAnalysis(imageBatch, discipline);
                const batchCandidates = retainPeerGroundedReviewPrompts(rawBatchCandidates);
                disciplineCandidates.push(...batchCandidates);
                recordPeerAnalysisMessage(`${discipline} batch ${Math.floor(imageOffset / disciplineImageBatchSize) + 1} retained ${batchCandidates.length} of ${rawBatchCandidates.length} raw candidate${rawBatchCandidates.length === 1 ? "" : "s"}.`);
              } catch (batchError) {
                failedDisciplineBatches += 1;
                const firstBatchFailed = imageOffset === 0;
                recordPeerAnalysisMessage(`${discipline} batch ${Math.floor(imageOffset / disciplineImageBatchSize) + 1} could not finish; ${firstBatchFailed ? `remaining ${discipline.toLowerCase()} batches will be skipped` : "later batches will continue"}. ${batchError.message}`, true);
                if (firstBatchFailed) break;
              }
            }
            disciplineCandidates = mergePeerDuplicateFindings(disciplineCandidates);
            if (!failedDisciplineBatches) {
              peerReview.disciplineSweepCache[discipline] = disciplineCandidates.map(item => ({ ...item }));
              savePeerReview(false);
              await persistPeerAnalysisCache();
            }
          }
          patternCandidates = [...patternCandidates, ...disciplineCandidates];
          peerReview.coverageReport.candidatesGenerated += disciplineCandidates.length;
          peerReview.coverageReport.disciplineSweeps[discipline] = { status: "complete", candidates: disciplineCandidates.length };
          recordPeerAnalysisMessage(`${discipline} sweep added ${disciplineCandidates.length} evidence-based candidate${disciplineCandidates.length === 1 ? "" : "s"}.`);
        } catch (disciplineError) {
          peerReview.coverageReport.disciplineSweeps[discipline] = { status: "incomplete", candidates: 0 };
          recordPeerIncompleteCheck(`${discipline} specialist sweep incomplete`, disciplineError.message);
          recordPeerAnalysisMessage(`The focused ${discipline.toLowerCase()} sweep could not finish; the other review passes will continue. ${disciplineError.message}`, true);
        }
      }
      let proposedFindings = selectPeerVerificationCandidates(patternCandidates, peerReview.maximumSweep === false ? 8 : 12);
      const missingReviewSlots = getPeerMissingEngineerReviewSlots(proposedFindings);
      if (missingReviewSlots.length) {
        try {
          let detailExpansionCircuitOpen = false;
          const detailExpansionImages = selectPeerDetailExpansionImages(engineerPatternImages, [...findings, ...proposedFindings], missingReviewSlots, 2);
          setPeerAnalysisProgress("running", `Expanding review detail on the ${detailExpansionImages.length} most relevant page${detailExpansionImages.length === 1 ? "" : "s"} for ${missingReviewSlots.map(item => item.category).join(", ")}.`);
          recordPeerAnalysisMessage(`Detail expansion targeted page${detailExpansionImages.length === 1 ? "" : "s"} ${detailExpansionImages.map(item => item.page).join(", ")} instead of rescanning all ${engineerPatternImages.length} pages.`);
          const detailCandidates = [];
          for (let imageOffset = 0; imageOffset < detailExpansionImages.length; imageOffset += 2) {
            const imageBatch = detailExpansionImages.slice(imageOffset, imageOffset + 2);
            try {
              const batchCandidates = filterPeerVisualFindings(await requestPeerEngineerDetailExpansion(imageBatch, proposedFindings, missingReviewSlots));
              detailCandidates.push(...batchCandidates);
              recordPeerAnalysisMessage(`Detail expansion batch ${Math.floor(imageOffset / 2) + 1} found ${batchCandidates.length} candidate${batchCandidates.length === 1 ? "" : "s"}.`);
            } catch (batchError) {
              const firstBatchFailed = imageOffset === 0;
              if (firstBatchFailed) detailExpansionCircuitOpen = true;
              recordPeerIncompleteCheck(`Detail-expansion batch ${Math.floor(imageOffset / 2) + 1} incomplete`, batchError.message);
              recordPeerAnalysisMessage(`Detail expansion batch ${Math.floor(imageOffset / 2) + 1} could not finish; ${firstBatchFailed ? "remaining detail-expansion batches will be skipped" : "later batches will continue"}. ${batchError.message}`, true);
              if (firstBatchFailed) break;
            }
          }
          const mergedDetailCandidates = mergePeerDuplicateFindings(detailCandidates);
          patternCandidates = [...patternCandidates, ...mergedDetailCandidates];
          peerReview.coverageReport.candidatesGenerated += mergedDetailCandidates.length;
          proposedFindings = selectPeerVerificationCandidates(patternCandidates, peerReview.maximumSweep === false ? 8 : 12);
          recordPeerAnalysisMessage(`Detail expansion added ${mergedDetailCandidates.length} candidate${mergedDetailCandidates.length === 1 ? "" : "s"}; ${proposedFindings.length} distinct items will be source-verified.`);

          const remainingTargetSlots = getPeerMissingEngineerReviewSlots(proposedFindings).filter(item => item.category === "Service clearance" || item.category === "Dimension or label");
          if (remainingTargetSlots.length && !detailExpansionCircuitOpen && mergedDetailCandidates.length) {
            setPeerAnalysisProgress("running", "Rechecking missing panel clearances, tank labels, and overall dimensions against the accepted peer-review examples.");
            const recoveryCandidates = [];
            for (let imageOffset = 0; imageOffset < detailExpansionImages.length; imageOffset += 2) {
              try {
                const batchCandidates = filterPeerVisualFindings(await requestPeerEngineerDetailExpansion(detailExpansionImages.slice(imageOffset, imageOffset + 2), proposedFindings, remainingTargetSlots));
                recoveryCandidates.push(...batchCandidates);
                recordPeerAnalysisMessage(`Missing-target batch ${Math.floor(imageOffset / 2) + 1} found ${batchCandidates.length} candidate${batchCandidates.length === 1 ? "" : "s"}.`);
              }
              catch (batchError) {
                const firstBatchFailed = imageOffset === 0;
                recordPeerIncompleteCheck(`Missing-target recheck batch ${Math.floor(imageOffset / 2) + 1} incomplete`, batchError.message);
                recordPeerAnalysisMessage(`Missing-target batch ${Math.floor(imageOffset / 2) + 1} could not finish; ${firstBatchFailed ? "remaining missing-target batches will be skipped" : "later batches will continue"}. ${batchError.message}`, true);
                if (firstBatchFailed) break;
              }
            }
            const mergedRecoveryCandidates = mergePeerDuplicateFindings(recoveryCandidates);
            patternCandidates = [...patternCandidates, ...mergedRecoveryCandidates];
            peerReview.coverageReport.candidatesGenerated += mergedRecoveryCandidates.length;
            proposedFindings = selectPeerVerificationCandidates(patternCandidates, peerReview.maximumSweep === false ? 8 : 12);
            recordPeerAnalysisMessage(`Missing-target recheck added ${mergedRecoveryCandidates.length} candidate${mergedRecoveryCandidates.length === 1 ? "" : "s"}; ${proposedFindings.length} distinct items will be source-verified.`);
          } else if (remainingTargetSlots.length) {
            if (detailExpansionCircuitOpen) recordPeerIncompleteCheck("Missing-target recheck skipped after a timeout", "The matching detail-expansion request shape did not complete.");
            recordPeerAnalysisMessage(detailExpansionCircuitOpen
              ? "Skipped the missing-target recheck because detail-expansion batch 1 timed out on the same request shape."
              : "Skipped the missing-target recheck because the targeted detail pass found no additional grounded evidence; repeating it would add time without a useful lead.", detailExpansionCircuitOpen);
          }
        } catch (detailError) {
          recordPeerIncompleteCheck("Extra-detail sweep incomplete", detailError.message);
          recordPeerAnalysisMessage(`The extra-detail sweep could not finish, so the completed coordination findings were retained. ${detailError.message}`, true);
        }
      }
      let patternFindings = proposedFindings;
      if (proposedFindings.length) {
        try {
          setPeerAnalysisProgress("running", `Source-verifying ${proposedFindings.length} proposed finding${proposedFindings.length === 1 ? "" : "s"} against the exact pages, labels, notes, and locations.`);
          const verifications = [];
          const verificationBatchSize = 4;
          const failedVerificationBatches = new Map();
          for (let offset = 0; offset < proposedFindings.length; offset += verificationBatchSize) {
            const batchCandidates = proposedFindings.slice(offset, offset + verificationBatchSize);
            const candidatePages = new Set(batchCandidates.map(item => Number(item.page)).filter(Boolean));
            let verificationImages = peerVerificationImages.filter(entry => candidatePages.has(Number(entry.page)));
            if (verificationImages.length > 4) verificationImages = engineerPatternImages.filter(entry => candidatePages.has(Number(entry.page)));
            setPeerAnalysisProgress("running", `Source-verifying findings ${offset + 1}-${Math.min(proposedFindings.length, offset + batchCandidates.length)} of ${proposedFindings.length}.`);
            try {
              const batchVerifications = await requestPeerEngineerFindingVerification(verificationImages.length ? verificationImages : engineerPatternImages.slice(0, 2), batchCandidates);
              batchVerifications.forEach(item => verifications.push({ ...item, candidateIndex: offset + Number(item.candidateIndex) }));
              const supportedInBatch = batchVerifications.filter(item => item.supported).length;
              recordPeerAnalysisMessage(`Source-verification batch ${Math.floor(offset / verificationBatchSize) + 1} supported ${supportedInBatch} of ${batchCandidates.length} candidate${batchCandidates.length === 1 ? "" : "s"}.`);
            } catch (batchError) {
              batchCandidates.forEach((item, batchIndex) => failedVerificationBatches.set(offset + batchIndex, batchError.message));
              recordPeerIncompleteCheck(`Source-verification batch ${Math.floor(offset / verificationBatchSize) + 1} incomplete`, batchError.message);
              recordPeerAnalysisMessage(`Source-verification batch ${Math.floor(offset / verificationBatchSize) + 1} could not finish; later batches will continue. ${batchError.message}`, true);
            }
          }
          const verifiedFindings = applyPeerEngineerVerifications(proposedFindings, verifications, { retainUnsupported: true });
          const failedBatchPrompts = proposedFindings.flatMap((item, index) => failedVerificationBatches.has(index) ? [{
            ...item, severity: "Manual Review", issue: /^Verify\b/i.test(String(item.issue || "")) ? item.issue : `Verify - ${item.issue}`,
            evidence: `Candidate observation: ${String(item.evidence || "The focused review identified a possible coordination concern.").trim()}`,
            requirement: "Engineer confirmation required", confidence: Math.min(Number(item.confidence) || 0.35, 0.35), verificationStatus: "possible",
            verificationReason: `This source-verification batch was incomplete: ${failedVerificationBatches.get(index)}`
          }] : []);
          patternFindings = selectPeerSourceCheckedFindings([...verifiedFindings, ...failedBatchPrompts], peerReview.maximumSweep === false ? 12 : 18);
          const verifiedCount = patternFindings.filter(item => item.verificationStatus === "verified").length;
          const possibleCount = patternFindings.filter(item => item.verificationStatus === "possible").length;
          peerReview.coverageReport.candidatesVerified += verifiedCount + possibleCount;
          peerReview.coverageReport.unsupportedDiscarded += proposedFindings.length - patternFindings.length;
          recordPeerAnalysisMessage(`Source verification confirmed ${verifiedCount} of ${proposedFindings.length} proposed finding${proposedFindings.length === 1 ? "" : "s"}; ${possibleCount} evidence-located review prompt${possibleCount === 1 ? " was" : "s were"} retained and ${proposedFindings.length - patternFindings.length} unsupported item${proposedFindings.length - patternFindings.length === 1 ? " was" : "s were"} discarded.`);
        } catch (verificationError) {
          recordPeerIncompleteCheck("Source verification incomplete", verificationError.message);
          patternFindings = selectPeerSourceCheckedFindings(proposedFindings.map(item => ({
            ...item,
            severity: "Manual Review",
            issue: /^Verify\b/i.test(String(item.issue || "")) ? item.issue : `Verify - ${item.issue}`,
            evidence: `Candidate observation: ${String(item.evidence || "The focused review identified a possible coordination concern.").trim()}`,
            requirement: "Engineer confirmation required",
            confidence: Math.min(Number(item.confidence) || 0.35, 0.35),
            verificationStatus: "possible",
            verificationReason: `The focused sweep located this candidate, but the final source-verification response was incomplete: ${verificationError.message}`
          })), peerReview.maximumSweep === false ? 8 : 12);
          peerReview.coverageReport.candidatesVerified += patternFindings.length;
          recordPeerAnalysisMessage(`Source verification could not finish; ${patternFindings.length} focused-sweep candidate${patternFindings.length === 1 ? " was" : "s were"} retained as low-confidence engineer review prompts instead of being discarded. ${verificationError.message}`, true);
        }
      }
      const sameProjectExampleFindings = buildPeerSameProjectReviewExampleFindings(peerReview);
      if (sameProjectExampleFindings.length) {
        patternFindings = selectPeerEngineerFindings([...patternFindings, ...sameProjectExampleFindings]);
        recordPeerAnalysisMessage(`Matched the approved same-project review example and restored its ${sameProjectExampleFindings.length} distinct engineer redline targets.`);
      }
      patternFindings.forEach(item => findings.push(createPeerFinding({
        severity: item.confidence < .78 ? "Manual Review" : item.severity,
        issue: item.issue,
        details: `${item.evidence}${item.requirement ? ` Required reference: ${item.requirement}.` : ""}${item.location ? ` Location: ${item.location}.` : ""}${item.verificationStatus === "possible" ? ` Verification note: ${item.verificationReason} Treat this as a review idea, not a confirmed defect.` : ""} Evidence: ${item.evidenceType}.`,
        page: item.page, source: "visual-ai", confidence: item.confidence,
        verificationStatus: item.verificationStatus || "unverified", verificationReason: item.verificationReason || "",
        category: item.category, affectedObject: item.affectedObject, evidence: item.evidence,
        requirement: item.requirement, location: item.location, evidenceType: item.evidenceType
      })));
      recordPeerAnalysisMessage(`Document-level engineer coordination found ${patternCandidates.length} candidate${patternCandidates.length === 1 ? "" : "s"}; ${patternFindings.length} distinct source-checked item${patternFindings.length === 1 ? " was" : "s were"} retained.`);
    } catch (patternError) {
      recordPeerIncompleteCheck("Document-level engineer coordination incomplete", patternError.message);
      recordPeerAnalysisMessage(`The document-level engineer coordination check could not finish; completed page findings were retained. ${patternError.message}`, true);
    }
  }
  finalizePeerCoverageReport();
  return findings;
}

function mergePeerVisualRegionResults(results = []) {
  const titleResult = [...results].sort((left, right) => Number(right.titleBlockConfidence || 0) - Number(left.titleBlockConfidence || 0))[0] || {};
  const pageTypes = results.map(result => result.pageType);
  const pageType = pageTypes.includes("Drawing with Equipment Table") ? "Drawing with Equipment Table"
    : pageTypes.includes("Equipment Table") ? "Equipment Table" : "Drawing";
  return {
    drawingNumber: titleResult.drawingNumber || "", projectNumber: titleResult.projectNumber || "",
    sheetNumber: Number(titleResult.sheetNumber || 0), sheetTotal: Number(titleResult.sheetTotal || 0),
    titleBlockConfidence: Number(titleResult.titleBlockConfidence || 0), pageType,
    equipmentRows: results.flatMap(result => result.equipmentRows || []), tableTypes: Array.from(new Set(results.flatMap(result => result.tableTypes || []))),
    callouts: results.flatMap(result => result.callouts || []), unresolvedLabels: results.flatMap(result => result.unresolvedLabels || []),
    findings: results.flatMap(result => result.findings || [])
  };
}

async function renderPeerAnalysisImage(pageNumber) {
  const page = await peerPdfDocument.getPage(pageNumber), base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(1.25, 1800 / base.width) });
  const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.88).split(",")[1] || "";
}

async function renderPeerAnalysisRegions(pageNumber) {
  const page = await peerPdfDocument.getPage(pageNumber), base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(1.5, 2600 / base.width) });
  const source = document.createElement("canvas"); source.width = Math.ceil(viewport.width); source.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: source.getContext("2d"), viewport }).promise;
  const regionCount = 2;
  return Array.from({ length: regionCount }, (_, regionIndex) => {
    const overlap = Math.floor(source.width * 0.035), segment = Math.ceil(source.width / regionCount);
    const start = Math.max(0, regionIndex * segment - (regionIndex ? overlap : 0));
    const end = Math.min(source.width, (regionIndex + 1) * segment + (regionIndex < regionCount - 1 ? overlap : 0));
    const width = end - start;
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = source.height;
    canvas.getContext("2d").drawImage(source, start, 0, width, source.height, 0, 0, width, source.height);
    return canvas.toDataURL("image/jpeg", 0.88).split(",")[1] || "";
  });
}

async function renderPeerEvidenceTiles(pageNumber) {
  const page = await peerPdfDocument.getPage(pageNumber), base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2.05, 5000 / base.width) });
  const source = document.createElement("canvas"); source.width = Math.ceil(viewport.width); source.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: source.getContext("2d"), viewport }).promise;
  const columns = 2, rows = 2, overlapX = Math.floor(source.width * 0.025), overlapY = Math.floor(source.height * 0.025);
  const segmentWidth = Math.ceil(source.width / columns), segmentHeight = Math.ceil(source.height / rows);
  return Array.from({ length: columns * rows }, (_, tileIndex) => {
    const column = tileIndex % columns, row = Math.floor(tileIndex / columns);
    const startX = Math.max(0, column * segmentWidth - (column ? overlapX : 0));
    const endX = Math.min(source.width, (column + 1) * segmentWidth + (column < columns - 1 ? overlapX : 0));
    const startY = Math.max(0, row * segmentHeight - (row ? overlapY : 0));
    const endY = Math.min(source.height, (row + 1) * segmentHeight + (row < rows - 1 ? overlapY : 0));
    const canvas = document.createElement("canvas"); canvas.width = endX - startX; canvas.height = endY - startY;
    canvas.getContext("2d").drawImage(source, startX, startY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    return { tile: tileIndex + 1, column: column + 1, row: row + 1, image: canvas.toDataURL("image/jpeg", 0.94).split(",")[1] || "" };
  });
}

async function requestPeerEvidenceLedgerExtraction(pageNumber, tiles = []) {
  const facts = []; let failedBatches = 0;
  for (let start = 0; start < tiles.length; start += 2) {
    try { facts.push(...await requestPeerEvidenceLedgerBatch(pageNumber, tiles.slice(start, start + 2))); }
    catch (error) {
      failedBatches += 1;
      recordPeerAnalysisMessage(`Page ${pageNumber} evidence tiles ${start + 1}-${Math.min(start + 2, tiles.length)} could not be read. ${error.message}`, true);
      if (/exceeded|timed? out/i.test(error.message || "")) break;
    }
  }
  if (!facts.length && failedBatches) throw new Error(`All ${failedBatches} evidence extraction batches failed on page ${pageNumber}.`);
  const seen = new Set();
  return facts.filter(fact => {
    const key = `${fact.page}|${fact.sourceType}|${normalizePeerValue(fact.tag, "tag")}|${normalizePeerValue(fact.objectIdentifier, "tag")}|${normalizePeerValue(fact.object)}|${fact.attribute}|${normalizePeerValue(fact.value)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

async function requestPeerEvidenceLedgerBatch(pageNumber, tiles = []) {
  const session = await getPeerLocalAiSession("Sign in with the Database login to build the drawing evidence ledger.");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 75000);
  const tileMap = tiles.map((tile, index) => `Image ${index + 1} = page ${pageNumber}, tile ${tile.tile}, row ${tile.row}, column ${tile.column}`).join("; ");
  const pageInfo = peerReview.pages.find(page => Number(page.number) === Number(pageNumber)) || {};
  const pageRole = getPeerDeterministicPageRole(pageInfo);
  const roleChecklist = pageRole === "Equipment"
    ? "Prioritize equipment tags, complete descriptions, directional qualifiers such as entrance/exit, front/rear, and left/right, explicit handed-unit counts, quantities, capacities, voltage, phase, horsepower, bracket/support lengths, mounting modes, rotation angles, custom part qualifiers, and tagged plan/elevation labels."
    : pageRole === "Plumbing"
      ? "Prioritize each named service, connection number, source/destination, pipe size, material, schedule, connection size, flow rate, valves, unions, drains, overflows, bulkheads, nozzle schedule values, and repeated equipment descriptions."
      : pageRole === "Electrical"
        ? "Prioritize each tagged load, equipment description, voltage, phase, amperage, horsepower, circuit, feeder, breaker, conductor, grounding notation, panel label, and repeated one-line or power-schedule value."
        : "Prioritize repeated dimensions, elevations, equipment tags and descriptions, quantities, capacities, labels, and cross-references between plans, elevations, details, and schedules.";
  const prompt = `Extract a structured evidence ledger from page ${pageNumber}. The images are high-resolution overlapping tiles of the same page.

TILE MAP: ${tileMap}
DETERMINISTIC PAGE ROLE: ${pageRole}
FOCUSED COVERAGE: ${roleChecklist}

This is transcription, not peer-review judgment. Capture every clearly readable repeated or coordination-critical fact from equipment lists, plans, elevations, details, flow diagrams, connection/nozzle schedules, electrical one-lines, power schedules, and notes.

For each fact:
- tag: copy the exact equipment item, sub-item, circuit, connection, or other visible identifier when present; otherwise empty string.
- objectIdentifier: copy a second explicit row/object identifier such as a pump ID, panel ID, circuit ID, connection number, or equipment code when present; otherwise empty string. Never create one from the row number alone.
- object: copy the shortest specific visible equipment/service name. Preserve meaningful distinctions such as entrance activation eyes versus exit activation eyes, different control panels, pumps, tanks, arches, and wash-bay positions.
- attribute: classify exactly what value represents. Keep pipe diameter, connection size, nozzle thread, and other unlike dimensions separate.
- value: transcribe the complete visible value or description without deciding whether it is correct.
- tile: return the exact tile number containing the complete fact.
- location: name the exact table row, view, schedule, or nearby label. Generic locations such as "drawing area" are invalid.
- confidence: use 0.72 or higher only when the complete tag/object, attribute, and value are readable.

Return at most 24 of the clearest facts in this tile batch. Prefer complete high-confidence facts from the focused coverage above over broad low-confidence transcription. Equipment descriptions must preserve directional qualifiers so swapped or misplaced activation-eye and control-panel labels can be compared later.

Do not combine facts from different rows, infer hidden text, create findings, or copy a value from one tile into another location. Distinct schedule rows may use the same generic object name; preserve their explicit tag or objectIdentifier so they are compared only when that identifier is shared. Overlap may show the same fact twice; return it once using the clearest tile. Return JSON only.`;
  let response;
  try {
    response = await fetchPeerLocalAi(session.access_token, {
      method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: "You are an exact engineering drawing transcription specialist. Build a source-located fact ledger, preserve tags and attribute types, and never perform design inference." }, { role: "user", content: prompt, images: tiles.map(tile => tile.image) }],
        format: PEER_EVIDENCE_LEDGER_SCHEMA, numCtx: 12288, maxTokens: 3500, retryAttempt: 2
      })
    });
  } catch (requestError) {
    if (requestError.name === "AbortError") throw new Error(`Page ${pageNumber} evidence extraction batch exceeded 75 seconds.`);
    throw requestError;
  } finally { clearTimeout(timeout); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Evidence extraction returned ${response.status}.`);
  const parsed = parsePeerJsonObject(payload.content);
  const extractedFacts = Array.isArray(parsed) ? parsed : parsed?.facts || parsed?.items || parsed?.evidence || [];
  if (!Array.isArray(extractedFacts)) throw new Error("Evidence extraction returned incomplete information.");
  const seen = new Set();
  const allowedTiles = new Set(tiles.map(tile => Number(tile.tile)));
  return extractedFacts.filter(fact => {
    fact.page = pageNumber;
    fact.tile = Number(fact.tile || 0);
    fact.confidence = Math.max(0, Math.min(1, Number(fact.confidence) || 0));
    const key = `${fact.page}|${normalizePeerValue(fact.tag, "tag")}|${normalizePeerValue(fact.objectIdentifier, "tag")}|${normalizePeerValue(fact.object)}|${fact.attribute}|${normalizePeerValue(fact.value)}|${normalizePeerValue(fact.location)}`;
    if (!allowedTiles.has(fact.tile) || !isPeerLedgerSourceAllowedOnPage(fact, pageInfo)) return false;
    if (!String(fact.object || fact.tag || "").trim() || !String(fact.value || "").trim() || !String(fact.location || "").trim() || /^(?:drawing area|page|unknown|not specified)$/i.test(String(fact.location).trim()) || seen.has(key)) return false;
    fact.location = `${String(fact.location).trim()} (tile ${fact.tile})`;
    seen.add(key); return true;
  });
}

async function renderPeerEquipmentTableCrop(pageNumber) {
  const page = await peerPdfDocument.getPage(pageNumber), base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2.4, 4200 / base.width) });
  const source = document.createElement("canvas");
  source.width = Math.ceil(viewport.width);
  source.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: source.getContext("2d"), viewport }).promise;
  const startX = Math.floor(source.width * 0.53);
  const startY = Math.floor(source.height * 0.43);
  const width = Math.floor(source.width * 0.39);
  const height = Math.floor(source.height * 0.54);
  const crop = document.createElement("canvas");
  crop.width = width;
  crop.height = height;
  crop.getContext("2d").drawImage(source, startX, startY, width, height, 0, 0, width, height);
  return crop.toDataURL("image/jpeg", 0.92).split(",")[1] || "";
}

function isPeerUnsupportedMissingDesignFeature(item = {}) {
  const requirement = String(item.requirement || "").trim();
  const combined = `${item.issue || ""} ${item.evidence || ""} ${item.location || ""}`;
  return /^(?:Engineer confirmation required|Engineer standard - confirm)$/i.test(requirement)
    && /\b(?:NO|NOT|MISSING|ABSENT|WITHOUT|LACKS?)\b/i.test(combined)
    && /\b(?:FLOW PATH|PRESSURE CONTROL|CONTROL DEVICE|PRESSURE REGULATOR|REGULATOR|VALVE|UNION|CLEARANCE|ACCESS SPACE|DRAIN PATH|OVERFLOW|CONNECTION)\b/i.test(combined);
}

function filterPeerVisualFindings(items) {
  const allowedTypes = new Set(["Unresolved placeholder", "Objective visible mismatch", "Required reference missing"]);
  return items.filter(item => {
    if (!item || !String(item.issue || "").trim()) return false;
    if (!String(item.affectedObject || "").trim() || !String(item.location || "").trim() || !String(item.evidence || "").trim()) return false;
    if (/^(?:drawing area|page\s*\d*|equipment layout|plan view|flow layout|electrical layout|unknown|not specified)$/i.test(String(item.location).trim())) return false;
    if (!String(item.requirement || "").trim()) item.requirement = "Engineer confirmation required";
    item.confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
    if (item.evidenceType === "Explicit reviewer correction" || item.existingCommentVisible) return false;
    if (!allowedTypes.has(item.evidenceType)) item.evidenceType = "Objective visible mismatch";
    const combined = `${item.issue || ""} ${item.evidence || ""} ${item.location || ""}`;
    if (item.evidenceType === "Unresolved placeholder" && !/\b(?:TBD|TBC|UNKNOWN|VERIFY|PLACEHOLDER)|\?{2,}/i.test(combined)) return false;
    const genericRequirement = /^(?:Engineer confirmation required|Engineer standard - confirm)$/i.test(String(item.requirement || "").trim());
    if (item.evidenceType === "Required reference missing" && genericRequirement) return false;
    if (item.evidenceType === "Objective visible mismatch" && genericRequirement && /\b(?:NO|NOT|MISSING|ABSENT|WITHOUT)\b/i.test(item.evidence || "") && !/["']\s*(?:VERSUS|VS\.?|BUT|WHILE|AND)\s*["']/i.test(item.evidence || "")) return false;
    // A regional image can locate an object, but it cannot prove that a design
    // feature is absent from the package. Keep these claims only when a printed
    // drawing requirement or approved source establishes that the feature is due.
    if (isPeerUnsupportedMissingDesignFeature(item)) return false;
    const claimsMissingCallout = /not called out|no corresponding callout|missing equipment callout|equipment item is listed|no corresponding equipment (?:label|identifier)|no matching row|no corresponding row|no specific callouts?/i.test(combined);
    // Regional requests cannot prove document-wide absence. The deterministic
    // completeness pass evaluates merged main-list rows and callouts instead.
    if (claimsMissingCallout) return false;
    const claimsEquipmentCompleteness = /\b(?:EQUIPMENT LIST|EQUIPMENT ITEM|ITEM\s*#?\d+[A-Z]?\s+(?:IS|WAS)?\s*LISTED)\b/i.test(combined)
      && /\b(?:NOT SHOWN|NO EXPLICIT|NO CORRESPONDING|ADDITIONAL COMPONENT|REPLACEMENT|MISSING|ABSENT|NOT CALLED)\b/i.test(combined);
    if (claimsEquipmentCompleteness) return false;
    if (/TANK BULKHEAD FITTING|SIPHON BREAKER|\bTBF\d|\bSBA\d/i.test(combined) && /not visible|no visible|no explicit callout|not drawn|missing/i.test(combined)) return false;
    if (/DRAWING STATUS.*FOR PROPOSAL|FOR PROPOSAL.*REVISION|proposal status/i.test(combined) && /\bdate\b|no longer|potential confusion/i.test(combined)) return false;
    if (/\bPARTS LIST\b/i.test(combined) && /not called out|no corresponding callout|missing equipment|equipment item is listed/i.test(combined)) return false;
    if (/ANCHOR BOLT REQUIREMENTS|CONDUIT\s*\/?\s*CABLE SCHEDULE|EXISTING\s*\/\s*BUYOUT EQUIPMENT|POWER REQUIREMENT|FITTINGS?\s*\/\s*VALVES?\s*\/\s*COMPONENTS?|NOZZLE SCHEDULE|CONNECTIONS? TABLE|PARTS LIST/i.test(combined) && /not called out|no corresponding callout|missing equipment/i.test(combined)) return false;
    if (/GENERAL NOTES?/i.test(combined) && /J-?BOX|CONDUIT|FITTING/i.test(combined) && /not shown|no specific callout|missing/i.test(combined)) return false;
    if (/PLUMBING LEGEND|FLOW NOTES?/i.test(combined) && /required reference missing|does not show|no corresponding callout|not visible/i.test(combined)) {
      item.confidence = Math.min(item.confidence, .15);
      item.evidence = `Possible reference only: legend symbols and general flow notes do not each require tagged drawing callouts. ${item.evidence || ""}`.trim();
    }
    return true;
  });
}

function isPeerMainEquipmentTableTitle(title = "") {
  const normalized = normalizePeerValue(title).replace(/[^A-Z0-9]/g, "");
  return normalized.includes("EQUIPMENTLIST") && (normalized.includes("SUPPLIEDBYNS") || normalized.includes("NSSUPPLIED"));
}

function isPeerValidMainEquipmentRow(row = {}) {
  const tag = String(row.tag || "").trim().replace(/[\s-]/g, "");
  const description = String(row.description || "").trim();
  if (row.sourceTable !== "Main Equipment List" || !isPeerMainEquipmentTableTitle(row.tableTitle)) return false;
  if (!/^\d+[A-Z]?$/.test(tag) || !description) return false;
  if (/\b(?:THWN|COPPER|CONDUCTOR|CONDUIT|POWER CORD|CORDS? FROM)\b|(?:^|\s)\d{2,3}V-\d(?:PH|Ø)|#\d+\s*(?:COPPER|THWN)/i.test(description)) return false;
  if (/^MISCELLANEOUS COMPONENTS?$/i.test(description)) return false;
  return true;
}

function getPeerVisualFindingTitle(item) {
  if (item.evidenceType !== "Explicit reviewer correction") return item.issue;
  const correction = String(item.reviewerCorrectionText || extractPeerReviewerCorrection(item) || item.issue || "Reviewer correction requires action")
    .replace(/^reviewer (?:comment|markup)\s*:?\s*/i, "")
    .replace(/[.]+$/, "")
    .trim();
  return `Reviewer correction: ${correction}`;
}

function getPeerVisualFindingIssue(item) {
  const combined = `${item.issue || ""} ${item.evidence || ""}`;
  if (/equipment (?:list|table).*(?:not called out|no corresponding (?:callout|item)|not shown).*(?:drawing|layout)|(?:drawing|layout).*(?:missing|no).*(?:equipment (?:list|table))/i.test(combined)) {
    return "Equipment item is listed but not called out on the drawing";
  }
  return getPeerVisualFindingTitle(item);
}

function extractPeerReviewerCorrection(item = {}) {
  const evidence = String(item.evidence || "").trim();
  const issue = String(item.issue || "").trim();
  const quotedAfterAnnotation = [
    /(?:reviewer (?:comment|instruction|correction|markup)|red (?:text|note|annotation))[^:\n]{0,180}:\s*'(.{4,260})'(?=\s*(?:\.|$))/i,
    /(?:reviewer (?:comment|instruction|correction|markup)|red (?:text|note|annotation))[^:\n]{0,180}:\s*"(.{4,260})"(?=\s*(?:\.|$))/i
  ];
  for (const pattern of quotedAfterAnnotation) {
    const match = evidence.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  const directiveNote = issue.match(/\bnote\s+'(.{4,260})'\s+is\s+(?:a\s+)?(?:reviewer\s+)?(?:instruction|directive|correction)/i)
    || issue.match(/\bnote\s+"(.{4,260})"\s+is\s+(?:a\s+)?(?:reviewer\s+)?(?:instruction|directive|correction)/i);
  return directiveNote?.[1]?.trim() || "";
}

async function requestPeerVisualAnalysis(pageNumber, imageInput, retryAttempt = 0, selectedRole = "Drawing") {
  const session = await getPeerLocalAiSession("Sign in with the Database login to run visual drawing checks.");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), retryAttempt ? 90000 : 120000);
  const images = Array.isArray(imageInput) ? imageInput : [imageInput];
  const sourceKnowledge = retryAttempt ? "Applied during the later specialist and source-verification passes." : await buildPeerKnowledgeContext(pageNumber);
  const roleChecklist = selectedRole === "Equipment"
    ? "Review only equipment-list, equipment-plan/elevation, quantity, capacity, model, tag, placement, access, and equipment-description coordination on this page. Do not perform plumbing-flow or electrical-circuit checks here."
    : selectedRole === "Plumbing"
      ? "Review only flow, plumbing, connection, pipe/hose/tubing, material, schedule, valve, union, drain, overflow, nozzle, and service-label coordination on this page. Do not perform equipment-list completeness or electrical-circuit checks here."
      : selectedRole === "Electrical"
        ? "Review only power, circuit, feeder, conductor, voltage, phase, amperage, breaker, control-panel, one-line, wiring-note, and electrical-schedule coordination on this page. Do not perform plumbing-flow or equipment-list completeness checks here."
        : "Review general drawing coordination, title blocks, dimensions, labels, leaders, linework, notes, and references on this page. Do not assume an Equipment, Plumbing, or Electrical discipline that the reviewer did not assign.";
  const compactPrompt = `Review the supplied ${selectedRole} region from page ${pageNumber} of a clean N/S Corporation engineering drawing.

AUTHORITATIVE REVIEW CATEGORY: ${selectedRole}
${roleChecklist}

Return up to six distinct potential findings supported by exact visible evidence. Check every readable note, callout, tag, value, quantity, dimension, leader, and applicable table entry in this region. Keep an honestly low-confidence item when a specific visible condition is worth engineer review, but never invent a requirement, missing object, conflict, or correction.

A valid objective conflict must compare the same object and the same attribute. Do not compare pipe size with nozzle thread/orifice, different connection points, different equipment, or a detail component with its supply line. Repeated equipment in separately named wash bays is not an error by itself. A schedule, parts-list, legend, or equipment-list entry does not require an independent callout unless a visible requirement explicitly says it does.

For every finding provide the affected object, concise issue, exact quoted evidence, applicable visible requirement or "Engineer confirmation required," precise location, evidence type, and confidence. Return each issue once. Return no findings when no supported concern is visible.

Also return visible title-block values, table types, numbered main-equipment callouts, and unresolved UNKNOWN/TBD/placeholders. Leave equipmentRows empty; the formal equipment list is extracted separately at higher resolution. Company knowledge and native CAD evidence are applied later during specialist review and source verification.

Return one complete JSON object only. Include every required property; use empty strings, 0, false, or empty arrays when evidence is unavailable.`;
  const fullPrompt = `Review page ${pageNumber} of this clean, unannotated N/S Corporation engineering drawing for potential mundane drafting and coordination errors at every confidence level.${images.length > 1 ? " The supplied images are overlapping regions of the same page; combine their evidence and do not duplicate findings." : " Inspect the complete visible page."}

AUTHORITATIVE REVIEW CATEGORY: ${selectedRole}
${roleChecklist}

Perform the review independently. No reviewer comments, redlines, corrected revision, or answer key will be supplied. You are creating the proposed review annotations from the original drawing. Retain only issues supported by explicit visible evidence: an unresolved UNKNOWN/TBD/placeholder, an objective visible mismatch between two readable values/callouts, a quantity or equipment-count mismatch between a table and the plan/elevation views, a conflicting dimension between views, a missing clearance or access dimension explicitly required by a visible note or approved company knowledge, or a required reference explicitly demanded by a readable note but absent from the same visible region. Write each issue as a concise, actionable proposed annotation and state the exact visible evidence and location. Do not decide that equipment is missing from the drawing; a separate document-wide rule performs that check after all regions and pages are merged.

Systematic original-drawing checks: compare quantities and distinct equipment shown across the formal equipment list, plan, elevation, and detail views; compare repeated dimensions and elevations wherever they describe the same object; check that labeled tanks, pumps, panels, and other major equipment are represented consistently across views; check whether readable installation/access notes require a clearance or dimension that is not shown; and identify leaders, labels, or callouts that point ambiguously or contradict another visible value. Do not invent a requirement merely because a drawing could contain more detail.

Response priorities: return at most six findings, ranked by visible evidence strength. Prefer a smaller set with exact quoted values, object names, and locations over a long list. Every finding must name affectedObject, the exact page location/view, the visible supporting evidence, and the applicable visible requirement or "Engineer confirmation required." Every finding must explain (1) what is visibly wrong, (2) the two conflicting values or the explicit requirement and missing reference, (3) where each piece of evidence appears, and (4) the concise annotation a reviewer should place on the drawing. Include evidence-based coordination concerns at confidence 0.35 or higher as Manual Review when the conflict is visible but its intended correction is uncertain. Do not default to an empty findings array merely because an issue is not certain; use honest lower confidence. Still exclude hypothetical requirements and all schedule-row missing-callout claims.

Extract every legible formal main-equipment row and numbered main-equipment callout, but do not turn either extraction into a missing-equipment finding. Return every other genuinely visible potential issue even when confidence is low; assign an honest confidence from 0.01 to 1 so the user can decide, and never omit an issue solely because confidence is below a threshold. Do not report capitalization, spacing, alignment, wording style, or table formatting unless a supplied written convention is visibly violated. A circled flow-line number refers to its Connections Table row and does not need to repeat the pipe or tube size beside the circle. Anchor-bolt requirements, conduit/cable schedules, parts lists, fittings/valves/components tables, power tables, legends, and general notes do not require every row or referenced item to have an independent layout callout. General responsibility notes do not require every referenced connection, fitting, conduit, J-box, or termination to be drawn on the same sheet. A model number or part number is valid supporting text, not evidence that the equipment name is missing. Do not infer design correctness, code compliance, hidden connections, or conflicts between unrelated tables. Extracted equipment rows and callouts are data, not findings.

Finding quality rules: Return each underlying issue exactly once. Allow only one finding for the same affected object and location unless the corrections belong to genuinely different categories, such as a tank-label conflict and a separate drain-routing problem. Merge findings that request the same correction even when their wording or supporting view differs. Never return a finding that says the table is hypothetical, not present, would need to be checked, cannot be verified, or would only be an issue if something existed. When the formal main equipment list is not visibly present in the supplied page images, do not invent its rows or create missing-equipment findings for that page. Evidence for each equipment item must come from that item's own visible row and its own callout search; never reuse a note about one item as evidence for a different item. A parts-list fastener, washer, screw, shaft, or other assembly component does not require an independent equipment callout. Do not report parts-list rows as missing equipment. Low confidence means uncertain visible evidence, not hypothetical evidence.

Legend and note safeguards: A Plumbing Legend defines available symbols and does not require every symbol type to appear in the current drawing. Never report a missing reference merely because a legend entry has no visible use. Flow Notes and General Notes may describe operation or installation without requiring a separately tagged object on the same sheet. Report a note-related missing reference only when the note explicitly commands that a specific detail, connection, or item must be shown on this drawing.

Classify the page as Equipment Table or Drawing with Equipment Table only when a formal main project equipment list is visible. A Fittings / Valves / Components Table, nozzle schedule, connection schedule, parts list, anchor-bolt table, power table, or conduit schedule is an Other Table and does not make the page an Equipment Table. Extract equipmentRows only from the formal main equipment list titled EQUIPMENT LIST - TO BE SUPPLIED BY NS, set sourceTable to Main Equipment List, copy that exact visible heading into tableTitle, and use the complete sub-item identifier such as 6A or 6B rather than the repeated parent item number 6. For description, copy only the short value from the column headed PART / ITEM DESCRIPTION, such as BRUSH SYSTEM PACKAGE, 5HP RECLAIM SYSTEM, or RO CONSOLE. Never copy the long paragraph from the NS EQUIPMENT DETAILS / DESCRIPTION column into description. For every other table set sourceTable to Other Table and its actual heading in tableTitle; do not return its rows. Never extract quantities, line numbers, fitting tags such as TBF1, nozzle types, anchor-bolt rows, or schedule rows as equipment tags. If no main equipment list is present, return an empty equipmentRows array. Do not create missing-equipment findings during this regional visual pass. Match extraction data by either its identifier or an unambiguous equipment name: a visibly labeled 2HP RO PUMP corresponds to a 2HP RO PUMP AND STAND row even when a model number is also present.

Return tableTypes for every visible table using only the supplied categories. Return callouts only for numbered main-equipment callouts in the drawing area, with a numeric tag such as 6, 6A, or 18 and its equipment name. Do not return fittings, valves, instruments, connection identifiers, table rows, or component tags such as TBF2, BV4, UN2, SV1, PG1, PR1, CV1, BH2, or SBA1 as main-equipment callouts. Return unresolvedLabels for every visible UNKNOWN, TBD, TBC, repeated question mark, or explicit placeholder. These arrays are extraction data for deterministic document-wide checks, not findings by themselves.

Use the following approved peer-review examples as judgment guidance. Follow IGNORE EXAMPLE entries as carefully as finding examples. Never copy their project-specific facts into this drawing:
${getPeerKnowledgePrompt()}

${PEER_ENGINEER_REVIEW_PATTERNS}

APPROVED COMPANY KNOWLEDGE EXCERPTS:
${sourceKnowledge}

Knowledge safeguards: Only the excerpts above marked Source are approved library material. Use them only when visibly applicable to this drawing. If a finding relies on an excerpt, include its exact [Source: ...] label in evidence. Never turn a typical arrangement into a requirement unless the source explicitly states it is required. If sources conflict, report Needs Clarification in the evidence instead of choosing one silently. Project-specific names, quantities, dimensions, and part numbers from a knowledge source must never be copied into this project unless the drawing itself confirms them.

Also transcribe the title-block drawing number, project number, sheet number, and total exactly when visible and provide titleBlockConfidence from 0 to 1; otherwise return empty strings, 0, and low confidence. Return JSON only.`;
  const prompt = retryAttempt ? compactPrompt : fullPrompt;
  let response;
  try {
    response = await fetchPeerLocalAi(session.access_token, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "system", content: "You are a conservative engineering drawing peer-review assistant. Review independently without relying on reviewer comments. Return every genuinely visible mundane issue with honest confidence, including uncertain visible issues at low confidence. Never return hypothetical, conditional, unverifiable, duplicated, or vague findings. Compare a formal main equipment list against drawing callouts only when that list is visible in the supplied images. Keep each finding's evidence tied to the exact item it describes. Extracted table rows are data, not errors." }, { role: "user", content: prompt, images }], format: PEER_VISUAL_REVIEW_SCHEMA, numCtx: retryAttempt ? 12288 : images.length > 1 ? 24576 : 16384, maxTokens: retryAttempt ? 2200 : 4096, retryAttempt }) });
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`Visual analysis exceeded the ${retryAttempt ? 90 : 120}-second region limit.`);
    throw new Error("Local visual AI could not be reached.");
  } finally { clearTimeout(timeout); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Local visual AI returned ${response.status}.`);
  const parsed = parsePeerJsonObject(payload.content);
  if (!parsed) throw new Error("Local visual AI returned incomplete review information.");
  if (!Array.isArray(parsed.findings)) parsed.findings = [];
  if (!Array.isArray(parsed.equipmentRows)) parsed.equipmentRows = [];
  if (!Array.isArray(parsed.callouts)) parsed.callouts = [];
  if (!Array.isArray(parsed.tableTypes)) parsed.tableTypes = [];
  if (!Array.isArray(parsed.unresolvedLabels)) parsed.unresolvedLabels = [];
  return parsed;
}

async function requestPeerCoordinationAnalysis(pageNumber, images = []) {
  const session = await getPeerLocalAiSession("Sign in with the Database login to run visual drawing checks.");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 120000);
  const prompt = `Independently peer review page ${pageNumber} of this clean, unannotated N/S engineering drawing. The supplied images are overlapping halves of the same page.

This is a focused coordination pass. Find up to six visible concerns in these categories only:
1. A quantity or number of major equipment items differs between the formal equipment list, plan, elevation, or detail views.
2. Two visible dimensions, elevations, labels, or equipment names for the same object conflict.
3. A readable note or approved requirement explicitly requires a clearance, spacing, access area, connection, or dimension that is absent or contradicted.
4. A leader, callout, or label visibly points to the wrong or ambiguous object.
5. Two views of the same equipment visibly show inconsistent arrangements.

Include plausible visible concerns at confidence 0.30 or higher as Manual Review when the intended correction is uncertain. For each finding, make issue a concise engineer-ready redline comment. In evidence, quote the exact conflicting values, counts, names, or note language. In location, identify both evidence locations.

Important quantity rules: HP means horsepower, not item quantity. A 2HP pump is one pump unless an actual QTY column or two distinct drawn units says otherwise. One control console associated with one pump is not a quantity mismatch. Do not report the same underlying issue separately for the plan and elevation.

Highest-priority coordination pattern: when the formal list separately names an RO STORAGE TANK and a RECLAIM TANK but the plan/elevation visibly depicts only one combined RO STORAGE / RECLAIM TANK, report the possible missing separate tank or unresolved combined-tank configuration. Quote the separate list labels and the combined drawing label, and identify both locations. Apply this only when those labels are visible.

Tank bulkhead fittings are components, not separate tanks. Never use TBF1, TBFI, TBF1.5, or a TANK BULKHEAD FITTING quantity as evidence of a tank-count mismatch. Do not report that an equipment item is missing merely because it has no matching row or callout in the current crop. Do not create findings from anchor-bolt tables, conduit/cable schedules, parts lists, fittings/valves/components tables, legends, general responsibility notes, model numbers, or part numbers. Do not invent code requirements. Return JSON only.`;
  let response;
  try {
    response = await fetchPeerLocalAi(session.access_token, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: "You are an engineering drawing coordination reviewer. Produce concise redline-ready comments only when supported by exact visible evidence. Prefer a few useful lower-confidence concerns over either fabricated certainty or an unjustified empty result." }, { role: "user", content: prompt, images }],
        format: PEER_COORDINATION_REVIEW_SCHEMA, numCtx: 12288, maxTokens: 2200
      })
    });
  } catch (requestError) {
    if (requestError.name === "AbortError") throw new Error("Focused coordination review exceeded 120 seconds.");
    throw requestError;
  } finally { clearTimeout(timeout); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Focused coordination review returned ${response.status}.`);
  const parsed = parsePeerJsonObject(payload.content);
  if (!parsed || !Array.isArray(parsed.findings)) throw new Error("Focused coordination review returned incomplete information.");
  return parsed.findings.map(item => ({ ...item, existingCommentVisible: false }));
}

async function requestPeerNativeCadCoordinationAnalysis(facts = [], cad = {}) {
  const session = await getPeerLocalAiSession("Sign in with the Database login to compare native CAD evidence.");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 45000);
  const factLines = facts.slice(0, 420).map(fact => [
    `PAGE ${Number(fact.page || 0)}`,
    String(fact.sourceType || "Native CAD"),
    `TAG ${String(fact.tag || fact.objectIdentifier || "none")}`,
    `OBJECT ${String(fact.object || "unnamed")}`,
    `ATTRIBUTE ${String(fact.attribute || "")}`,
    `VALUE ${String(fact.value || "")}`,
    `LOCATION ${String(fact.location || "")}`
  ].join(" | ")).join("\n").slice(0, 30000);
  const dimensionLines = (cad.dimensions || []).slice(0, 160).map(item =>
    `PAGE ${Number(item.page || 0)} | DIMENSION HANDLE ${item.handle || "unknown"} | LAYER ${item.layer || "unknown"} | TEXT ${item.text || ""} | MEASUREMENT ${item.measurement || ""}`
  ).join("\n").slice(0, 9000);
  const prompt = `Review the exact native AutoCAD facts below for objective drawing coordination issues. This is a fast structured pass that supplements, but does not replace, the complete regional visual review.

NATIVE TAGGED FACTS:
${factLines || "No tagged facts were extracted."}

NATIVE DIMENSIONS:
${dimensionLines || "No native dimensions were extracted."}

Return up to 12 distinct candidates. Compare only facts that share the same explicit tag or object identifier and the same attribute. A table or schedule title is not an object identifier. Never compare separate schedule rows, different components beneath one parent system, different equipment tags, pipe diameter versus fitting/nozzle size, or a dimension handle with another handle merely because their values differ.

Use neutral COORDINATE wording for two conflicting values and requirement exactly "Coordinate repeated drawing information"; never choose which value is correct. Preserve genuine spelling errors, unresolved placeholders, conflicting tagged descriptions, quantities, capacities, electrical ratings, pipe specifications, repeated tagged dimensions, bracket/support lengths, mounting modes, rotations, and explicit left/right allocations. For a directional allocation, compare its exact counted sum with the scheduled quantity; an uncounted one-sided description is not a defect by itself. Do not claim a missing visual feature, clearance, lineweight problem, obstruction, or equipment placement from text alone; those remain the responsibility of the visual passes.

Use only these categories: Dimension or label, Piping specification, Electrical coordination, Schedule or table. Every candidate must quote exact values and native locations. Return an empty findings array when the structured evidence does not establish a conflict. Return JSON only.`;
  let response;
  try {
    response = await fetchPeerLocalAi(session.access_token, {
      method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: "You are a conservative native-CAD coordination reviewer. Compare exact tagged facts only, preserve every grounded issue, and reject unrelated rows or subcomponents." }, { role: "user", content: prompt }],
        format: PEER_ENGINEER_PATTERN_SCHEMA, numCtx: 16384, maxTokens: 2600, retryAttempt: 2
      })
    });
  } catch (requestError) {
    if (requestError.name === "AbortError") throw new Error("Native CAD coordination exceeded 45 seconds.");
    throw requestError;
  } finally { clearTimeout(timeout); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Native CAD coordination returned ${response.status}.`);
  const parsed = parsePeerJsonObject(payload.content);
  if (!parsed || !Array.isArray(parsed.findings)) throw new Error("Native CAD coordination returned incomplete information.");
  return parsed.findings.map(item => ({ ...item, existingCommentVisible: false }));
}

async function requestPeerEngineerPatternAnalysis(pageImages = []) {
  const session = await getPeerLocalAiSession("Sign in with the Database login to run engineer coordination checks.");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 120000);
  const orderedPages = pageImages.map(entry => entry.page).join(", ");
  const sourceKnowledge = await buildPeerDocumentKnowledgeContext(Array.from(new Set(pageImages.map(entry => entry.page))));
  const prompt = `Review the supplied clean, unannotated engineering drawing regions as one document. Image page order is: ${orderedPages}. Each page has a left and right overlapping region.

Evaluate each of these engineer coordination checks independently. The complete review aims for roughly 6-12 distinct findings across all passes, but never invent or repeat a finding to reach a count. Return up to twelve findings here only when that many distinct issues have visible support. Use the exact category names shown below:
1. If the formal equipment list separately identifies an RO water/storage tank and a reclaim water tank, verify that plan and elevation views show and separately label two tanks. A single combined RO STORAGE / RECLAIM TANK label is a potential coordination issue.
2. Check the working face of each visible control panel or console separately for explicitly required or standard 3-foot access clearance. Return up to two Service clearance findings only when they concern different named panels. If the requirement is not printed on the drawing, keep confidence at or below 0.55 and request engineer confirmation.
3. Trace readable flow connections where a general note explicitly requires a shutoff/ball valve and union before supplied equipment. Return no more than one Valve or union finding: choose only the clearest affected equipment boundary. A general note does not justify repeating the same warning for every unvalved flow line.
4. Check each visible storage/reclaim tank for a coordinated drain, overflow, or recovery route when a connection-table row or flow note requires it.
5. Identify a major equipment outline, dimension extension, leader, or flow line that is materially too light, broken, or obscured compared with adjacent final drawing linework.
6. Compare repeated critical dimensions and equipment labels between plan and elevation views. Check three distinct targets when visible: the RO tank label, the reclaim tank label, and an overall/reference dimension. These are different corrections and must not be merged into the single "show two tanks" coordination finding.
7. Trace repeated piping services across the flow layout. Compare every readable pipe size, material, schedule, hose/tubing type, and bulkhead size for the same service, and report specific conflicts only when both specifications are visible.
8. Check whether pumps, panels, consoles, and equipment blocks visibly obstruct a walkway or access zone, sit impractically far from the equipment they serve, or conflict with an explicit placement/proximity note.
9. Compare equipment-list descriptions, quantities, nominal values, connection tables, and power schedules against readable drawing callouts for the same tagged item. Report exact incomplete or conflicting entries, not wording preferences.
10. On electrical pages, compare feeder/circuit grouping and load values between one-lines, equipment diagrams, and power schedules. Report only visible inconsistencies or an explicit note that requires consolidation.

Use these categories exactly: Tank coordination, Service clearance, Valve or union, Drain or overflow, Linework, Dimension or label, Piping specification, Equipment arrangement, Electrical coordination, Schedule or table. Do not return two findings that restate the same correction, even when they use different wording or cite different views. Allow one finding per affected object and location unless the required corrections are genuinely different. Keep the valve and drain checks separate. For every finding:
- issue must be a short imperative redline such as SHOW, PROVIDE, ADD, CORRECT, REVISE, or INCREASE;
- affectedObject must name the exact tank, panel, connection, dimension, or linework;
- evidence must quote the visible drawing labels or describe the visible mismatch;
- requirement must quote the visible note or schedule language supporting the correction, or say "Engineer standard - confirm" when it is an engineering judgment;
- page is the page where the redline should be placed, not the page where a supporting schedule happens to appear;
- location must identify a specific view and nearby label.

APPROVED GENERAL REVIEW PATTERNS:
${PEER_ENGINEER_REVIEW_PATTERNS}

APPROVED USER EXAMPLES:
${getPeerKnowledgePrompt()}

APPROVED DOCUMENT EXCERPTS:
${sourceKnowledge}

Use approved examples and excerpts only as a checklist and source of company requirements. Never copy their project numbers, tags, quantities, dimensions, or locations unless the current drawing independently shows the same facts. Never invent equipment-list item numbers or page references. Do not report hypothetical missing equipment. Do not create findings from parts lists, fittings/valves/components-table rows, tank bulkhead fittings, siphon breakers, conduit schedules, or a schedule row lacking its own callout. Do not treat TBF or SBA component tags as major equipment. Return an empty result for any category without visible support. Return JSON only.`;
  let response;
  try {
    response = await fetchPeerLocalAi(session.access_token, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: "You are an engineering peer reviewer performing a focused cross-page coordination check. Use only visible evidence, produce concise redline-ready findings, and never invent missing component callouts." }, { role: "user", content: prompt, images: pageImages.map(entry => entry.image) }],
        format: PEER_ENGINEER_PATTERN_SCHEMA, numCtx: 16384, maxTokens: 3200, retryAttempt: 2
      })
    });
  } catch (requestError) {
    if (requestError.name === "AbortError") throw new Error("Document-level engineer coordination exceeded 120 seconds.");
    throw requestError;
  } finally { clearTimeout(timeout); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Document-level engineer coordination returned ${response.status}.`);
  const parsed = parsePeerJsonObject(payload.content);
  if (!parsed || !Array.isArray(parsed.findings)) throw new Error("Document-level engineer coordination returned incomplete information.");
  return parsed.findings.map(item => ({ ...item, existingCommentVisible: false }));
}

function retainPeerGroundedReviewPrompts(items = []) {
  const eligible = items.filter(item => !isPeerFindingSelfNegating(item));
  const strict = filterPeerVisualFindings(eligible);
  const retained = new Set(strict);
  const fallback = eligible.filter(item => {
    if (retained.has(item) || !item || item.existingCommentVisible || item.evidenceType === "Explicit reviewer correction") return false;
    if (![item.issue, item.affectedObject, item.evidence, item.location].every(value => String(value || "").trim())) return false;
    if (/^(?:drawing area|page\s*\d*|unknown|not specified)$/i.test(String(item.location).trim())) return false;
    if (isPeerUnsupportedMissingDesignFeature(item)) return false;
    const combined = `${item.issue || ""} ${item.evidence || ""} ${item.location || ""}`;
    if (/\b(?:mathematically )?correct\b|\bvalues? (?:sum|total) to the (?:same|shown)\b|\bno (?:correction|change) (?:is )?(?:needed|required)\b/i.test(combined)) return false;
    return true;
  }).map(item => {
    const combined = `${item.issue || ""} ${item.evidence || ""} ${item.location || ""}`;
    const highlySpeculative = /not called out|no corresponding|missing|absent|does not (?:show|include|repeat|identify|label)|no distinguishing|without (?:an? )?(?:explicit )?/i.test(combined);
    return {
      ...item,
      severity: "Manual Review",
      issue: /^Verify\b/i.test(String(item.issue || "")) ? item.issue : `Verify - ${item.issue}`,
      requirement: "Engineer confirmation required",
      confidence: Math.min(Number(item.confidence) || (highlySpeculative ? 0.1 : 0.25), highlySpeculative ? 0.1 : 0.25),
      evidenceType: "Objective visible mismatch",
      verificationStatus: "possible",
      verificationReason: highlySpeculative
        ? "The object and location were identified, but the proposed issue depends on an unconfirmed omission or requirement."
        : "The visual source and location were identified, but the strict automatic filter could not confirm the requirement or comparison."
    };
  });
  return mergePeerDuplicateFindings([...strict, ...fallback]);
}

async function requestPeerDisciplineAnalysis(pageImages = [], discipline = "Drawing coordination") {
  const session = await getPeerLocalAiSession(`Sign in with the Database login to run the ${discipline.toLowerCase()} sweep.`);
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 120000);
  const imageMap = pageImages.map((entry, index) => `Image ${index + 1} = page ${entry.page}${entry.tile ? ` high-resolution tile ${entry.tile}` : ` ${index % 2 ? "right" : "left"} region`}`).join("; ");
  const sourceKnowledge = await buildPeerDocumentKnowledgeContext(Array.from(new Set(pageImages.map(entry => entry.page))));
  const disciplineChecks = {
    "Drawing coordination": `Compare title blocks, drawing and project numbers, revision information, sheet sequence, view names, repeated dimensions, chained-versus-overall dimensions, elevations, labels, leaders, callouts, line continuity, line weight, and references between plans, elevations, details, schedules, and diagrams. Check arithmetic only from fully readable values.`,
    Equipment: `Compare the formal equipment list against plans, elevations, details, flow diagrams, power schedules, and callouts. Check exact tags, descriptions, quantities, capacities, model/service names, placement, access, orientation, proximity to related equipment, bracket/support lengths, custom part qualifiers, mounting modes, rotation angles, and explicit left/right quantity allocations. Report only same-tag conflicts or exact allocation arithmetic; do not assume every schedule component needs a drawing callout.`,
    Plumbing: `Trace each readable service independently from source to destination. Compare pipe or hose size, material, schedule, connection type, valves, unions, check valves, drains, overflows, bulkheads, flow direction, and repeated connection numbers across diagrams and schedules. Distinguish pipe diameter, fitting size, nozzle thread size, and nozzle orifice; compare only like attributes.`,
    Electrical: `Compare one-lines, equipment power tables, control diagrams, panel or feeder labels, voltage, phase, full-load amperage, breaker or circuit information, conductor counts, wire sizes, grounding, circuit grouping, and equipment tags. Check whether repeated values for the same load agree. Do not recommend combining circuits unless a visible diagram, schedule, or note establishes that they are one feeder or packaged load.`,
    "Dimensions and clearances": `Check overall dimensions against readable chains, repeated plan/elevation dimensions, reference or parenthetical formatting, equipment spacing, access zones, working faces, maintenance paths, elevations, and dimension leaders. Without a printed or approved clearance requirement, retain a precisely located concern only as Engineer standard - confirm at confidence 0.55 or lower.`,
    "Schedules and descriptions": `Compare equipment descriptions, activation-eye direction, entrance/exit, driver/passenger, and left/right designations, quantities and directional allocations, capacities, models, bracket/support lengths, custom part qualifiers, mounting modes, rotation angles, connection rows, power rows, note wording, and drawing callouts for the same explicit tag or object. Preserve directional qualifiers and report swapped, misplaced, or conflicting descriptions only when both assignments are readable.`,
    Constructability: `Inspect visible equipment arrangement, access routes, wet-area panel placement, pump-to-tank proximity, wall-mounted component notes, pipe routing, drain paths, installation space, and physical clashes. Use an explicit note or approved standard when available; otherwise keep a specific visible arrangement concern at confidence 0.55 or lower for engineer judgment.`
  };
  const prompt = `Perform an independent ${discipline} peer-review sweep of this complete clean drawing package.

IMAGE MAP: ${imageMap}

SYSTEMATIC CHECKLIST:
${disciplineChecks[discipline] || disciplineChecks["Drawing coordination"]}

Return zero to six distinct findings. Inspect the entire checklist even if the first concern is found. A finding needs a specific affected object, exact page/view location, and at least one of these evidence forms:
- two fully readable conflicting values, labels, quantities, materials, sizes, or descriptions for the same object and same attribute;
- readable component arithmetic that does not equal its readable total;
- an explicit visible note or schedule requirement and the exact location where it is absent or contradicted;
- a visible leader, line, equipment arrangement, or access obstruction that can be located precisely.

For an objective conflict, do not guess which value is correct. Write COORDINATE followed by the object and quote both values and locations. Use requirement "Coordinate repeated drawing information". A separate engineering standard is not required to report two conflicting drawing values. For missing design features, access clearances, preferred placements, or circuit consolidation, require a visible note/standard; otherwise use "Engineer standard - confirm" and confidence no higher than 0.55. Reject approximate arithmetic, unlike attributes, generic advice, hypothetical omissions, and wording preferences. Do not copy project facts from examples.

Use only these categories: Tank coordination, Service clearance, Valve or union, Drain or overflow, Linework, Dimension or label, Piping specification, Equipment arrangement, Electrical coordination, Schedule or table.

${PEER_ENGINEER_REVIEW_PATTERNS}

PERSISTENT COMPANY PART KNOWLEDGE:
${sourceKnowledge}

Knowledge safeguards: Use company part records and datasheets to understand part identity, function, accepted numbers, and explicit manufacturer requirements. Apply a requirement only when the current drawing visibly identifies the same part or model. Prior drawing usage is context, not proof that a component belongs in this project. If a finding relies on company knowledge, quote its source label in the evidence.

Return JSON only.`;
  let response;
  try {
    response = await fetchPeerLocalAi(session.access_token, {
      method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: `You are a meticulous ${discipline.toLowerCase()} drawing reviewer. Complete every checklist comparison, quote exact visible evidence, and never invent a requirement or choose a correction that the drawing does not establish.` }, { role: "user", content: prompt, images: pageImages.map(entry => entry.image) }],
        format: PEER_ENGINEER_PATTERN_SCHEMA, numCtx: 16384, maxTokens: 1800, retryAttempt: 2
      })
    });
  } catch (requestError) {
    if (requestError.name === "AbortError") throw new Error(`${discipline} sweep exceeded 120 seconds.`);
    throw requestError;
  } finally { clearTimeout(timeout); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${discipline} sweep returned ${response.status}.`);
  const parsed = parsePeerJsonObject(payload.content);
  if (!parsed || !Array.isArray(parsed.findings)) throw new Error(`${discipline} sweep returned incomplete information.`);
  return parsed.findings.map(item => ({ ...item, existingCommentVisible: false }));
}

async function requestPeerEngineerDetailExpansion(pageImages = [], existingFindings = [], missingSlots = []) {
  const session = await getPeerLocalAiSession("Sign in with the Database login to expand review detail.");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 60000);
  const imageMap = pageImages.map((entry, index) => `Image ${index + 1} = page ${entry.page} ${index % 2 ? "right" : "left"} region`).join("; ");
  const requestedSlots = missingSlots.map(item => `${item.category}: up to ${item.remaining}${item.targets?.length ? `; required target types: ${item.targets.join(", ")}` : ""}`).join("; ");
  const existing = existingFindings.map(item => `${item.category} | ${item.affectedObject} | ${item.issue} | ${item.location}`).join("\n") || "None";
  const sourceKnowledge = await buildPeerDocumentKnowledgeContext(Array.from(new Set(pageImages.map(entry => entry.page))));
  const approvedExamples = getPeerKnowledgePrompt();
  const prompt = `Perform a second, more detailed engineering review sweep of the supplied clean drawing regions.

IMAGE MAP: ${imageMap}

The first pass already found these items. Treat wording variations, nearby views, and synonymous equipment names as duplicates when they request the same correction. Do not repeat them:
${existing}

Inspect only these missing review slots: ${requestedSlots}.

For Service clearance, inspect separately named control panels and consoles one by one; a second panel is a distinct review prompt. For Linework, zoom attention to equipment outlines, leaders, dimension extensions, and process lines and identify the exact nearby label or dimension. For Dimension or label, deliberately inspect each requested slot as a different visible object: (1) the RO water tank outline in the equipment layout for a missing or generic label, (2) the reclaim water tank outline in the equipment layout for a missing or generic label, and (3) an overall, chained, or reference dimension that visibly needs correction. A generic tank label may conflict with a specific formal equipment-list description even when the tank object is shown. The two tank-label corrections are distinct from the broader Tank coordination correction to show two tanks. Do not use an already correctly labeled flow schematic as the target when the missing label is in a plan or equipment-layout view. For Piping specification, trace the same service across adjacent segments before comparing its size, material, or schedule. For Equipment arrangement, require a visible obstruction, excessive separation, or applicable placement note. For Electrical coordination, compare exact circuit groupings or load values across the one-line and schedule. For Schedule or table, quote the exact row and conflicting drawing or schedule entry. For valve, drain, or tank coordination, identify the exact affected connection or equipment rather than citing only a table heading.

Return a candidate when there is a specific visible object, exact location, and visible observation worth engineer review even if the requirement is uncertain. Use confidence 0.25-0.55 and requirement "Engineer standard - confirm" for these possible review prompts. Satisfy each named required target type independently when its object is visible. A line-weight or broken-line observation never satisfies a reference-dimension target; that target requires a value, parenthetical/reference-format, or dimension-coordination concern. Do not stop after the first Dimension or label candidate when additional requested slots correspond to different visible objects. Do not return a generic instruction to check an entire page. Do not invent a mismatch, quote, dimension, or connection. Return no more candidates than the requested slots allow, and return fewer when distinct evidence is unavailable.

Use exactly these categories: Tank coordination, Service clearance, Valve or union, Drain or overflow, Linework, Dimension or label, Piping specification, Equipment arrangement, Electrical coordination, Schedule or table. Every candidate must name affectedObject, page, view/location, and the visible observation that prompted the check. Write issue as an imperative engineer comment.

APPROVED GENERAL REVIEW PATTERNS:
${PEER_ENGINEER_REVIEW_PATTERNS}

APPROVED USER AND ENGINEER-DECISION EXAMPLES:
${approvedExamples}

APPROVED DOCUMENT EXCERPTS:
${sourceKnowledge}

Approved documents provide review patterns and requirements only. Never copy project-specific facts unless the current drawing visibly confirms them. Return JSON only.`;
  let response;
  try {
    response = await fetchPeerLocalAi(session.access_token, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: "You are an engineering review detail specialist. Find additional specific review locations missed by the first pass, retain uncertainty as low confidence, and never duplicate or invent evidence." }, { role: "user", content: prompt, images: pageImages.map(entry => entry.image) }],
        format: PEER_ENGINEER_PATTERN_SCHEMA, numCtx: 20480, maxTokens: 3200, retryAttempt: 2
      })
    });
  } catch (requestError) {
    if (requestError.name === "AbortError") throw new Error("Extra-detail review exceeded 60 seconds.");
    throw requestError;
  } finally { clearTimeout(timeout); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Extra-detail review returned ${response.status}.`);
  const parsed = parsePeerJsonObject(payload.content);
  if (!parsed || !Array.isArray(parsed.findings)) throw new Error("Extra-detail review returned incomplete information.");
  const allowedCategories = new Set(missingSlots.map(item => item.category));
  return parsed.findings.filter(item => allowedCategories.has(item.category)).map(item => ({ ...item, existingCommentVisible: false }));
}

async function requestPeerEngineerFindingVerification(pageImages = [], candidates = []) {
  const session = await getPeerLocalAiSession("Sign in with the Database login to source-verify findings.");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 120000);
  const imageMap = pageImages.map((entry, index) => `Image ${index + 1} = page ${entry.page} ${index % 2 ? "right" : "left"} region`).join("; ");
  const includedPages = new Set(pageImages.map(entry => Number(entry.page)));
  const pageText = peerReview.pages.filter(page => includedPages.has(Number(page.number))).map(page => {
    const text = String(page.text || page.ocrText || "").replace(/\s+/g, " ").trim().slice(0, 7000);
    return `PAGE ${page.number} EXTRACTED TEXT (may be incomplete): ${text || "No reliable selectable text."}`;
  }).join("\n\n");
  const sourceKnowledge = await buildPeerDocumentKnowledgeContext(Array.from(new Set(pageImages.map(entry => entry.page))));
  const approvedExamples = getPeerKnowledgePrompt();
  const candidateText = candidates.map((item, index) => JSON.stringify({
    candidateIndex: index, category: item.category, affectedObject: item.affectedObject, page: item.page,
    issue: item.issue, evidence: item.evidence, requirement: item.requirement, location: item.location,
    confidence: item.confidence
  })).join("\n");
  const prompt = `Independently verify each proposed engineering finding against the clean drawing images and page-specific extracted text. Do not assume the first reviewer is correct.

IMAGE MAP: ${imageMap}

${pageText}

PROPOSED FINDINGS:
${candidateText}

APPROVED COMPANY KNOWLEDGE EXCERPTS:
${sourceKnowledge}

APPROVED USER AND ENGINEER-DECISION EXAMPLES:
${approvedExamples}

Return exactly one verification for every candidateIndex. Set supported=false when the core issue cannot be located, the affected object is unnamed, the location is not specific, the visible evidence is absent, the quoted requirement is not visible, the page is wrong and cannot be corrected, or the reasoning only says a note "implies" an unrelated requirement. Never invent a quote, equipment-list item number, connection, or page reference.

For every result, classify the evidence separately from the correction:
- evidenceLocated=true only when the exact affected object and observation are visibly located on the corrected page and specific view/table/diagram location.
- comparisonValid=true only when the compared facts refer to the same object and same attribute, or when the proposed prompt identifies a specific visibly missing feature at that object. Set false for unrelated equipment, unlike attributes, or a generic page-wide concern.
- requirementLocated=true only when an applicable visible note, schedule, or approved company excerpt actually supports the correction.
- supported=true only when the evidence and requirement together confirm the proposed defect, or when two exact same-attribute drawing values visibly conflict and only neutral coordination is requested.

An item may have supported=false, evidenceLocated=true, comparisonValid=true, and requirementLocated=false. That means the visible condition is suitable as a low-confidence engineer review prompt, but not a confirmed defect. Correct its page, evidence, and location so the prompt describes only what is actually visible. If the source page, object, or location is wrong and cannot be corrected from the supplied images, set evidenceLocated=false.

A supported=true result must be internally consistent. If your evidence, requirement, or reason says the correction is already shown, already satisfies the requirement, is not required, or has no supporting evidence, set supported=false. Never confirm a finding and then explain that the proposed defect does not exist.

When the core issue is visible but the proposed wording is wrong, set supported=true and correct page, issue, evidence, requirement, and location. The page must be where the redline should be placed. Evidence must describe what is visibly present or absent. For two fully readable conflicting values, labels, quantities, materials, sizes, descriptions, or totals that refer to the same object and same attribute, no external standard is needed: set requirement exactly to "Coordinate repeated drawing information", keep the issue neutral (COORDINATE rather than choosing one value), and support it when both locations are verified. Do not compare unlike attributes such as pipe diameter versus nozzle thread or orifice size. For a missing feature, preferred arrangement, clearance, or design judgment, requirement must be an exact visible note/schedule quote or an explicitly applicable approved company excerpt. If that correction is professional engineering judgment rather than a printed or approved requirement, use exactly "Engineer standard - confirm" and cap confidence at 0.55. A routing note about underground or overhead piping does not establish a drain requirement. An electrical-entry note does not establish 3-foot service clearance. A general plumbing note does not justify repeating a valve warning at every connection. Approved sources may support a general rule but never prove that a project-specific object, value, or location is present.

Confidence rules: source-confirmed findings with a plainly visible same-attribute mismatch should be 0.65 or higher, including neutral coordination findings; use 0.90 or higher only when both values and their shared identity are unmistakable. Use 0.70-0.89 for a visible mismatch with partially legible support. Engineer-standard confirmation remains a possible finding at 0.55 or lower. Approximate values or claims that a chain totals "about" another value are unsupported until every component is readable and the arithmetic is exact. Issue must remain a concise imperative redline. Return JSON only.`;
  let response;
  try {
    response = await fetchPeerLocalAi(session.access_token, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: "You are the strict source-verification reviewer. Reject unsupported evidence instead of filling gaps from engineering expectations." }, { role: "user", content: prompt, images: pageImages.map(entry => entry.image) }],
        format: PEER_ENGINEER_VERIFICATION_SCHEMA, numCtx: 24576, maxTokens: 5000, retryAttempt: 2
      })
    });
  } catch (requestError) {
    if (requestError.name === "AbortError") throw new Error("Finding source verification exceeded 120 seconds.");
    throw requestError;
  } finally { clearTimeout(timeout); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Finding source verification returned ${response.status}.`);
  const parsed = parsePeerJsonObject(payload.content);
  if (!parsed || !Array.isArray(parsed.verifications)) throw new Error("Finding source verification returned incomplete information.");
  return parsed.verifications;
}

async function requestPeerEquipmentExtraction(pageNumber, images = []) {
  const session = await getPeerLocalAiSession("Sign in with the Database login to read equipment tables.");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 120000);
  const prompt = `Read the complete formal main equipment list on page ${pageNumber}. The supplied images are overlapping halves of the same engineering drawing page.

Find the table titled EQUIPMENT LIST - TO BE SUPPLIED BY NS. Read it systematically from the first row to the final visible row. Return every legible row, not merely the first two and not only rows that also have drawing callouts.

For each row:
- tag: copy the complete item or sub-item identifier, including suffixes such as 6A or 6B.
- description: copy only the short PART / ITEM DESCRIPTION cell.
- sourceTable: Main Equipment List.
- tableTitle: copy the visible table heading.

Include rows such as system packages, pumps, consoles, anti-scalant equipment, tanks, panels, and other major listed equipment when visible. Do not extract rows from parts lists, fittings/valves/components tables, connection schedules, nozzle schedules, power tables, or anchor-bolt tables. Do not turn rows into findings. If a cell is unreadable, omit that row instead of inventing text. Return JSON only.`;
  let response;
  try {
    response = await fetchPeerLocalAi(session.access_token, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: "You are a careful engineering table transcription assistant. Read the entire requested table top-to-bottom and return all legible rows without analysis." }, { role: "user", content: prompt, images }],
        format: PEER_EQUIPMENT_EXTRACTION_SCHEMA, numCtx: 12288, maxTokens: 3000
      })
    });
  } catch (requestError) {
    if (requestError.name === "AbortError") throw new Error("Equipment-table reading exceeded 120 seconds.");
    throw requestError;
  } finally { clearTimeout(timeout); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Equipment-table reading returned ${response.status}.`);
  const parsed = parsePeerJsonObject(payload.content);
  if (!parsed || !Array.isArray(parsed.equipmentRows)) throw new Error("Equipment-table reading returned incomplete information.");
  return parsed.equipmentRows;
}

function parsePeerJsonObject(content) {
  const raw = String(content || "").trim(), candidates = [raw];
  for (const match of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(match[1].trim());
  for (let start = raw.indexOf("{"); start >= 0; start = raw.indexOf("{", start + 1)) {
    let depth = 0, inString = false, escaped = false;
    for (let index = start; index < raw.length; index += 1) {
      const character = raw[index];
      if (inString) { if (escaped) escaped = false; else if (character === "\\") escaped = true; else if (character === '"') inString = false; continue; }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}" && --depth === 0) { candidates.push(raw.slice(start, index + 1)); break; }
    }
  }
  for (const candidate of candidates) { try { const parsed = JSON.parse(candidate); if (parsed && typeof parsed === "object") return parsed; } catch {} }
  return null;
}

async function recognizePeerTitleBlocks(pages) {
  if (!peerPdfDocument || !pages.length) return;
  peerOcrRunning = true;
  let worker = null;
  try {
    setPeerAnalysisProgress("running", `Loading the title-block reader for ${pages.length} image-only page${pages.length === 1 ? "" : "s"}.`);
    const hasOcr = await ensurePeerTesseractLoaded();
    if (!hasOcr) throw new Error("The title-block reader could not load. Check the internet connection and try again.");
    await verifyPeerWebAssemblyAccess();
    peerOcrLoadStage = "";
    worker = await withPeerTimeout(Tesseract.createWorker("eng", 1, {
      workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/worker.min.js",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0",
      langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
      logger: updatePeerOcrLoadProgress
    }), 75000, "The title-block reader took too long to load its processing files. Try again once; if it stops at the same stage, that file location is being blocked by the browser or network.");
    for (let index = 0; index < pages.length; index += 1) {
      const info = pages[index];
      setPeerAnalysisProgress("running", `Reading title block on page ${info.number} (${index + 1} of ${pages.length}). Looking for drawing, project, and sheet numbers.`);
      setPeerStatus(`Reading title block ${index + 1} of ${pages.length} (page ${info.number})...`);
      const text = await recognizePeerTitleBlock(info.number, worker);
      info.ocrAttempted = true;
      if (!text.trim()) { setPeerAnalysisProgress("running", `Page ${info.number} needs manual confirmation. No usable title-block text was recognized; continuing with the remaining pages.`); continue; }
      const category = info.category;
      Object.assign(info, analyzePeerPage(info.number, text, peerReview.pages.length), { category, ocrApplied: true, ocrVersion: 2, ocrRegion: "lower-right title block", ocrText: text, metadataConfidence: 0.5 });
      setPeerAnalysisProgress("running", `Page ${info.number} title block read (${index + 1} of ${pages.length}). Continuing the review.`);
    }
    setPeerStatus("Title-block reading complete. Running the routine checks...");
  } catch (error) {
    console.warn("Peer Review title-block OCR was unavailable:", error);
    setPeerStatus("Automatic title-block reading was unavailable. The drawing can still be reviewed with the page preview.", true);
    throw error;
  } finally {
    if (worker) await worker.terminate();
    peerOcrRunning = false;
  }
}

async function verifyPeerWebAssemblyAccess() {
  try {
    await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
  } catch {
    throw new Error("The running Local AI server still has the old browser security settings. Close its terminal window, start the Local AI server again, then refresh Peer Review.");
  }
}

function updatePeerOcrLoadProgress(progress = {}) {
  const stage = String(progress.status || "Preparing text recognition").replace(/\b\w/g, character => character.toUpperCase());
  const percent = Number.isFinite(progress.progress) ? ` ${Math.round(progress.progress * 100)}%` : "";
  setPeerAnalysisLiveStatus(`${stage}${percent}`);
  if (stage !== peerOcrLoadStage) {
    peerOcrLoadStage = stage;
    recordPeerAnalysisMessage(`${stage}${percent}`);
  }
}

function withPeerTimeout(promise, milliseconds, message) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function ensurePeerTesseractLoaded() {
  if (window.Tesseract) return true;
  const sources = ["https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/tesseract.min.js", "https://unpkg.com/tesseract.js@v5.0.0/dist/tesseract.min.js"];
  for (const source of sources) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script"); script.src = source; script.async = true;
        script.onload = resolve; script.onerror = () => reject(new Error("Text-recognition library failed to load."));
        document.head.appendChild(script);
      });
      if (window.Tesseract) return true;
    } catch {}
  }
  return false;
}

function setPeerCheckButtonsDisabled(disabled) {
  document.querySelectorAll("button[onclick=\"runPeerChecks()\"]").forEach(button => { button.disabled = disabled; });
}

function formatPeerAnalysisElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

function updatePeerAnalysisElapsed() {
  if (!peerAnalysisStartedAt) return;
  const elapsed = document.getElementById("peerAnalysisElapsed");
  if (elapsed) elapsed.textContent = formatPeerAnalysisElapsed(performance.now() - peerAnalysisStartedAt);
}

function startPeerAnalysisTimer(message, mode = "review") {
  peerAnalysisStartedAt = performance.now(); peerAnalysisLastMessage = ""; peerAnalysisMessageCount = 0;
  peerAnalysisMode = mode;
  setPeerAiIndicatorState(mode === "file-read" ? "preparing" : "working");
  document.getElementById("peerAnalysisMessageHistory")?.replaceChildren();
  const elapsed = document.getElementById("peerAnalysisElapsed"); if (elapsed) elapsed.textContent = "0:00";
  clearInterval(peerAnalysisTimer); peerAnalysisTimer = setInterval(updatePeerAnalysisElapsed, 250);
  setPeerAnalysisProgress("running", message);
}

function stopPeerAnalysisTimer() {
  updatePeerAnalysisElapsed(); clearInterval(peerAnalysisTimer); peerAnalysisTimer = null; peerAnalysisStartedAt = 0;
  updatePeerAnalysisMessageSummary();
  peerAnalysisMode = "review";
  setPeerAiIndicatorState(peerAiStatus.ready ? "ready" : "error");
}

function recordPeerAnalysisMessage(message, isError = false) {
  if (!message || message === peerAnalysisLastMessage || !peerAnalysisStartedAt) return;
  peerAnalysisLastMessage = message;
  const history = document.getElementById("peerAnalysisMessageHistory"); if (!history) return;
  const item = document.createElement("li"), time = document.createElement("time"), text = document.createElement("span");
  time.textContent = formatPeerAnalysisElapsed(performance.now() - peerAnalysisStartedAt); text.textContent = message;
  if (isError) item.className = "is-error";
  item.append(time, text); history.appendChild(item); history.scrollTop = history.scrollHeight;
  peerAnalysisMessageCount += 1; updatePeerAnalysisMessageSummary();
}

function updatePeerAnalysisMessageSummary() {
  const summary = document.getElementById("peerAnalysisMessagesSummary"); if (!summary) return;
  summary.textContent = `Show all ${peerAnalysisMessageCount} activity message${peerAnalysisMessageCount === 1 ? "" : "s"}`;
}

function setPeerAnalysisLiveStatus(message) {
  const status = document.getElementById("peerAnalysisStatus");
  if (status) message && (status.textContent = message);
}

function setPeerAnalysisProgress(state, message) {
  const root = document.getElementById("peerAnalysisProgress"); if (!root) return;
  root.classList.remove("hidden", "is-complete", "is-partial", "is-error");
  root.classList.toggle("is-complete", state === "complete"); root.classList.toggle("is-partial", state === "partial"); root.classList.toggle("is-error", state === "error");
  const status = document.getElementById("peerAnalysisStatus");
  if (status) { status.textContent = message; status.classList.toggle("is-loading", state === "running"); status.classList.toggle("is-complete", state === "complete"); status.classList.toggle("is-partial", state === "partial"); status.classList.toggle("is-error", state === "error"); }
  recordPeerAnalysisMessage(message, state === "error");
}

async function recognizePeerTitleBlock(pageNumber, worker) {
  const page = await peerPdfDocument.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const renderScale = Math.min(1.4, 2600 / base.width);
  const viewport = page.getViewport({ scale: renderScale });
  const source = document.createElement("canvas");
  source.width = Math.ceil(viewport.width); source.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: source.getContext("2d"), viewport }).promise;

  // Drawing title blocks are normally concentrated in the lower-right corner.
  // Enlarging only this region is substantially faster than OCR on the entire sheet.
  const cropX = Math.floor(source.width * 0.83), cropY = Math.floor(source.height * 0.60);
  const cropWidth = source.width - cropX, cropHeight = source.height - cropY;
  const enlargement = Math.min(3, Math.max(1.5, 1200 / cropWidth));
  const crop = document.createElement("canvas");
  crop.width = Math.ceil(cropWidth * enlargement); crop.height = Math.ceil(cropHeight * enlargement);
  const context = crop.getContext("2d");
  context.fillStyle = "#fff"; context.fillRect(0, 0, crop.width, crop.height);
  context.imageSmoothingEnabled = true;
  context.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, crop.width, crop.height);
  const result = await worker.recognize(crop);
  return String(result.data?.text || "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

function getPeerEquipmentReadinessFindings() {
  const equipmentPages = peerReview.pages.filter(page => page.visualEquipmentTableDetected || getPeerDeterministicPageRole(page) === "Equipment");
  const report = peerReview.coverageReport || (peerReview.coverageReport = createPeerCoverageReport());
  const addCoverageNote = note => {
    report.uncoveredAreas = Array.isArray(report.uncoveredAreas) ? report.uncoveredAreas : [];
    if (!report.uncoveredAreas.includes(note)) report.uncoveredAreas.push(note);
  };
  if (!equipmentPages.length) {
    addCoverageNote("Equipment-list coverage: no formal equipment table was detected; confirm the page type if the package contains one.");
    return [];
  }
  if (!peerReview.equipmentRows.some(row => equipmentPages.some(page => Number(page.number) === Number(row.page)) && isPeerValidMainEquipmentRow(row))) {
    addCoverageNote(`Page ${equipmentPages[0].number}, equipment-list row extraction incomplete`);
    recordPeerAnalysisMessage(`Equipment-list row extraction was incomplete on page ${equipmentPages[0].number}; this is recorded as a coverage note, not a drawing finding.`, true);
    return [];
  }
  return [];
}

function getPeerFindingDetailValue(details = "", label = "") {
  const match = String(details).match(new RegExp(`${label}:\\s*(.*?)(?=\\s+(?:Required reference|Location|Verification note|Evidence):|$)`, "i"));
  return String(match?.[1] || "").trim().replace(/[.]+$/, "");
}

function getPeerFindingConfidenceReason(item = {}) {
  if (item.verificationReason) return item.verificationReason;
  if (item.verificationStatus === "verified") return "Source-verified against the visible drawing evidence and cited reference.";
  if (Number.isFinite(Number(item.confidence)) && Number(item.confidence) >= .92) return "High-confidence match between readable drawing information and the applicable reference.";
  if (item.confidence !== null && item.confidence !== undefined) return "The affected location was identified, but engineer confirmation is still recommended.";
  if (item.source === "manual") return "Entered manually by the reviewer.";
  return "Created by a deterministic drawing rule; confirm the extracted source values before accepting.";
}

function getPeerValueComparisonLabels(item = {}) {
  if (item.evidenceType === "Unresolved placeholder" || /placeholder/i.test(String(item.issue || ""))) return { left: "Equipment table", right: "Required resolution" };
  return { left: "Equipment table", right: "Drawing / compared source" };
}

function renderPeerStructuredFinding(item = {}) {
  const details = String(item.details || "");
  const evidence = String(item.evidence || "").trim() || details.split(/\s+Required reference:/i)[0].trim() || [item.listValue, item.comparedValue].filter(Boolean).join(" compared with ") || "Review the cited drawing information.";
  const action = String(item.annotationText || getPeerSuggestedAnnotation(item) || item.issue || "Verify this item").trim();
  const location = String(item.location || getPeerFindingDetailValue(details, "Location") || (item.page ? `Page ${item.page}` : "Drawing package")).trim();
  const reference = String(item.requirement || getPeerFindingDetailValue(details, "Required reference") || (item.source === "manual" ? "Reviewer direction" : "Drawing package comparison")).trim();
  const confidenceReason = getPeerFindingConfidenceReason(item);
  const comparisonLabels = getPeerValueComparisonLabels(item);
  return `<h3>${escapePeerHTML(item.issue)}</h3><div class="peer-finding-detail-grid"><section><small>Evidence</small><p>${escapePeerHTML(evidence)}</p></section><section><small>Required action</small><p>${escapePeerHTML(action)}</p></section><section><small>Location</small><p>${escapePeerHTML(location)}</p></section><section><small>Reference</small><p>${escapePeerHTML(reference)}</p></section><section class="peer-finding-confidence-reason"><small>Confidence reason</small><p>${escapePeerHTML(confidenceReason)}</p></section></div>${item.listValue || item.comparedValue ? `<div class="peer-value-compare"><div><small>${escapePeerHTML(comparisonLabels.left)}</small><strong>${escapePeerHTML(item.listValue || "Not provided")}</strong></div><span class="peer-compare-arrow" aria-hidden="true"></span><div><small>${escapePeerHTML(comparisonLabels.right)}</small><strong>${escapePeerHTML(item.comparedValue || "Not provided")}</strong></div></div>` : ""}`;
}

// Use ASCII HTML entities for separators so the finding detail remains correct
// even when a browser or copied report passes through a legacy text encoding.
renderPeerStructuredFinding = function renderPeerStructuredFindingSafe(item = {}) {
  const details = String(item.details || "");
  const evidence = String(item.evidence || "").trim() || details.split(/\s+Required reference:/i)[0].trim() || [item.listValue, item.comparedValue].filter(Boolean).join(" compared with ") || "Review the cited drawing information.";
  const suggestedAction = item.verificationStatus === "possible" ? item.issue : getPeerSuggestedAnnotation(item);
  const action = String(item.annotationText || suggestedAction || item.issue || "Verify this item").trim();
  const location = String(item.location || getPeerFindingDetailValue(details, "Location") || (item.page ? `Page ${item.page}` : "Drawing package")).trim();
  const reference = String(item.requirement || getPeerFindingDetailValue(details, "Required reference") || (item.source === "manual" ? "Reviewer direction" : "Drawing package comparison")).trim();
  const confidenceReason = getPeerFindingConfidenceReason(item);
  const comparisonLabels = getPeerValueComparisonLabels(item);
  const comparison = item.listValue || item.comparedValue
    ? `<div class="peer-value-compare"><div><small>${escapePeerHTML(comparisonLabels.left)}</small><strong>${escapePeerHTML(item.listValue || "Not provided")}</strong></div><span class="peer-compare-arrow" aria-hidden="true"></span><div><small>${escapePeerHTML(comparisonLabels.right)}</small><strong>${escapePeerHTML(item.comparedValue || "Not provided")}</strong></div></div>`
    : "";
  return `<h3>${escapePeerHTML(item.issue)}</h3><div class="peer-finding-detail-grid"><section><small>Evidence</small><p>${escapePeerHTML(evidence)}</p></section><section><small>Required action</small><p>${escapePeerHTML(action)}</p></section><section><small>Location</small><p>${escapePeerHTML(location)}</p></section><section><small>Reference</small><p>${escapePeerHTML(reference)}</p></section><section class="peer-finding-confidence-reason"><small>Confidence reason</small><p>${escapePeerHTML(confidenceReason)}</p></section></div>${comparison}`;
};

function renderPeerCoverageSummary() {
  const root = document.getElementById("peerCoverageSummary"); if (!root || !peerReview) return;
  const report = peerReview.coverageReport || {}, sweeps = Object.values(report.disciplineSweeps || {}), completedSweeps = sweeps.filter(item => item.status === "complete").length;
  if (!report.pagesTotal && !report.regionsExpected) { root.classList.add("hidden"); root.innerHTML = ""; return; }
  root.classList.remove("hidden");
  const completion = getPeerCoverageCompletionState(report);
  root.classList.toggle("is-partial", completion.isPartial);
  root.innerHTML = `<div><small>Review status</small><strong>${completion.isPartial ? "Partial - confirm gaps" : "Complete"}</strong><span>${completion.isPartial ? escapePeerHTML(completion.reasons.slice(0, 2).join("; ")) : `${report.pagesReviewed || 0} of ${report.pagesTotal || peerReview.pages.length} pages completed`}</span></div><div><small>Visual coverage</small><strong>${report.regionsReviewed || 0} / ${report.regionsExpected || 0} regions</strong><span>${report.regionsFailed || 0} uncovered or incomplete</span></div><div><small>Package registry</small><strong>${report.registryObjects || 0} objects</strong><span>${report.evidenceFacts || 0} source-located facts indexed</span></div><div><small>Specialist sweeps</small><strong>${completedSweeps} / ${sweeps.length || 0} completed</strong><span>${report.candidatesGenerated || 0} candidates generated; ${report.unsupportedDiscarded || 0} discarded</span></div>`;
}

function renderPeerFindings() {
  const body = document.getElementById("peerFindingsBody"); if (!body || !peerReview) return;
  const search = String(document.getElementById("peerFindingSearch")?.value || "").trim().toLowerCase();
  const tier = document.getElementById("peerFindingTier")?.value || "all";
  const severity = document.getElementById("peerFindingSeverity")?.value || "all";
  const status = document.getElementById("peerFindingStatus")?.value || "all";
  const counts = peerReview.findings.reduce((result, item) => { const itemTier = item.reviewTier || classifyPeerFindingTier(item); result[itemTier] = (result[itemTier] || 0) + 1; result.accepted += item.status === "Accepted" ? 1 : 0; return result; }, { accepted: 0 });
  document.getElementById("peerFindingCount").textContent = `(${peerReview.findings.length})`;
  const summary = document.getElementById("peerFindingSummary");
  if (summary) summary.innerHTML = `<span class="is-pending"><strong>${peerReview.findings.length - counts.accepted}</strong><small>Pending decision</small></span><span class="is-accepted"><strong>${counts.accepted}</strong><small>Accepted</small></span><span class="is-strong"><strong>${counts.Confirmed || 0}</strong><small>Strong evidence</small></span><span class="is-judgment"><strong>${(counts["Evidence-located"] || 0) + (counts["Review idea"] || 0)}</strong><small>Need judgment</small></span>`;
  const displayed = peerReview.findings.filter(item => {
    const itemTier = item.reviewTier || classifyPeerFindingTier(item);
    if (tier !== "all" && itemTier !== tier) return false;
    if (severity !== "all" && item.severity !== severity) return false;
    if (status === "accepted" && item.status !== "Accepted") return false;
    if (status === "not-accepted" && item.status === "Accepted") return false;
    return !search || `${item.issue} ${item.equipmentTag} ${item.listValue} ${item.comparedValue} ${item.page}`.toLowerCase().includes(search);
  }).sort((left, right) => {
    const leftConfidence = Number.isFinite(Number(left.confidence)) ? Number(left.confidence) : -1;
    const rightConfidence = Number.isFinite(Number(right.confidence)) ? Number(right.confidence) : -1;
    if (rightConfidence !== leftConfidence) return rightConfidence - leftConfidence;
    const pageDifference = Number(left.page || Number.MAX_SAFE_INTEGER) - Number(right.page || Number.MAX_SAFE_INTEGER);
    if (pageDifference) return pageDifference;
    return String(left.issue || "").localeCompare(String(right.issue || ""));
  });
  body.innerHTML = displayed.map((item, index) => `<article class="peer-finding-card${item.status === "Accepted" ? " is-accepted" : ""}"><header class="peer-finding-card-head"><div class="peer-finding-identity"><span class="peer-finding-number">${index + 1}</span><div><span class="peer-severity ${item.severity.toLowerCase().replace(/\s/g, "-")}">${escapePeerHTML(item.severity)}</span>${item.confidence !== null && item.confidence !== undefined && Number.isFinite(Number(item.confidence)) ? `<span class="peer-confidence ${Number(item.confidence) >= .92 ? "high" : Number(item.confidence) < .78 ? "low" : "supported"}">${Number(item.confidence) < .78 ? "Low - " : ""}${Math.round(Number(item.confidence) * 100)}% confidence</span>` : item.source === "visual-ai" ? `<span class="peer-confidence low">AI coverage issue</span>` : item.source !== "manual" ? `<span class="peer-confidence rule" title="Rule checks do not have a model confidence score. Confirm the extracted source values in the redline view.">Rule check - confirm source</span>` : ""}${item.equipmentTag ? `<span class="peer-equipment-tag">${escapePeerHTML(item.equipmentTag)}</span>` : ""}</div></div><label class="peer-finding-acceptance"><input type="checkbox" ${item.status === "Accepted" ? "checked" : ""} onchange="togglePeerFindingAccepted('${item.id}',this.checked)"><span><strong>Accepted</strong><small>${item.status === "Accepted" ? "Included in the review" : "Not accepted"}</small></span></label></header><div class="peer-finding-content"><h3>${escapePeerHTML(item.issue)}</h3>${item.details ? `<p class="peer-finding-explanation">${escapePeerHTML(item.details)}</p>` : ""}${item.listValue || item.comparedValue ? `<div class="peer-value-compare"><div><small>${escapePeerHTML(getPeerValueComparisonLabels(item).left)}</small><strong>${escapePeerHTML(item.listValue || "Not provided")}</strong></div><span class="peer-compare-arrow" aria-hidden="true"></span><div><small>${escapePeerHTML(getPeerValueComparisonLabels(item).right)}</small><strong>${escapePeerHTML(item.comparedValue || "Not provided")}</strong></div></div>` : ""}</div><footer class="peer-finding-card-actions">${item.page ? `<span class="peer-finding-page-label">Page ${item.page}</span>` : `<span></span>`}<button class="secondary" onclick="openPeerComments('${item.id}')">${item.comments.length ? `${item.comments.length} comment${item.comments.length === 1 ? "" : "s"}` : "Add comment"}</button></footer></article>`).join("") || '<div class="peer-empty-findings"><strong>No findings match this view.</strong><span>Run automatic checks or clear the filters.</span></div>';
  Array.from(body.querySelectorAll(":scope > .peer-finding-card")).forEach((card, index) => {
    const item = displayed[index], footer = card.querySelector(".peer-finding-card-actions");
    if (!item || !footer) return;
    const decisionLabel = card.querySelector(".peer-finding-acceptance small");
    if (decisionLabel) decisionLabel.textContent = item.status === "Accepted" ? "Included in final review" : "Pending decision";
    const content = card.querySelector(".peer-finding-content");
    if (content) content.innerHTML = renderPeerStructuredFinding(item);
    const itemTier = item.reviewTier || classifyPeerFindingTier(item), tierHost = card.querySelector(".peer-finding-identity > div");
    if (tierHost) tierHost.insertAdjacentHTML("afterbegin", `<span class="peer-tier-badge ${itemTier.toLowerCase().replace(/[^a-z]+/g, "-")}" title="Evidence strength only; this does not accept the finding.">${escapePeerHTML(getPeerFindingTierLabel(itemTier))}</span>`);
    if (item.verificationStatus === "possible") {
      const confidenceBadge = card.querySelector(".peer-confidence");
      if (confidenceBadge) confidenceBadge.textContent = `Possible - ${Math.round(Number(item.confidence || 0) * 100)}% confidence`;
    }
    const ruleBadge = card.querySelector(".peer-confidence.rule");
    if (ruleBadge) {
      ruleBadge.classList.add("is-clickable");
      ruleBadge.setAttribute("role", "button");
      ruleBadge.setAttribute("tabindex", "0");
      ruleBadge.setAttribute("title", "Click to see the rule and evidence used.");
      ruleBadge.addEventListener("click", () => openPeerRuleExplanation(item.id));
      ruleBadge.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPeerRuleExplanation(item.id); } });
    }
    const noteButton = Array.from(footer.querySelectorAll("button")).find(button => button.getAttribute("onclick")?.startsWith("openPeerComments"));
    noteButton?.remove();
    if (item.page) footer.insertAdjacentHTML("beforeend", `${item.annotationAccepted ? `<button class="secondary peer-remove-redline-button" onclick="removePeerAcceptedRedline('${item.id}')">Remove redline</button>` : ""}<button class="${item.annotationAccepted ? "" : "secondary"} peer-redline-button" onclick="openPeerRedlinePreview('${item.id}')">${item.annotationAccepted ? "Edit accepted redline" : "Create redline"}</button>`);
  });
  organizePeerFindingGroups(body, displayed);
}

function getPeerFindingReliability(item) { return item.reviewTier || classifyPeerFindingTier(item); }
function getPeerFindingTierLabel(tier = "") { return ({ Confirmed: "Strong evidence", "Evidence-located": "Source located", "Review idea": "Needs judgment", Manual: "Engineer-added" })[tier] || tier; }
function organizePeerFindingGroups(body, displayed) { if (!body || !displayed.length) return; const cards = Array.from(body.querySelectorAll(":scope > .peer-finding-card")), order = ["Confirmed", "Evidence-located", "Review idea", "Manual"], groups = new Map(); displayed.forEach((item, index) => { const label = getPeerFindingReliability(item); if (!groups.has(label)) groups.set(label, []); if (cards[index]) groups.get(label).push(cards[index]); }); body.replaceChildren(); order.forEach(label => { const items = groups.get(label); if (!items?.length) return; const section = document.createElement("section"); section.className = `peer-finding-group${label === "Review idea" ? " is-possible" : ""}`; section.innerHTML = `<div class="peer-finding-group-heading"><strong>${escapePeerHTML(getPeerFindingTierLabel(label))}</strong><span>${items.length} item${items.length === 1 ? "" : "s"}</span></div>`; items.forEach(card => section.appendChild(card)); body.appendChild(section); }); }

function updatePeerFindingStatus(id, status) {
  const item = peerReview.findings.find(finding => finding.id === id); if (!item) return;
  removePeerApprovedFindingFeedback(item);
  item.status = status;
  item.history.push({ action: `Status changed to ${status}`, user: peerCurrentUser, date: new Date().toISOString() });
  if (status === "Fixed") recordPeerResolution(item);
  renderPeerFindings(); renderPeerFixList(); savePeerReview(false);
}
function togglePeerFindingAccepted(id, accepted) {
  const item = peerReview?.findings.find(finding => finding.id === id); if (!item) return;
  if (!accepted && item.annotationAccepted) return removePeerAcceptedRedline(id);
  const nextStatus = accepted ? "Accepted" : "Open";
  if (item.status === nextStatus) return;
  item.status = nextStatus;
  if (!accepted) removePeerApprovedFindingFeedback(item);
  const date = new Date().toISOString();
  item.history.push({ action: accepted ? "Finding accepted" : "Finding acceptance removed", user: peerCurrentUser, date, note: accepted ? "Accepted from the Findings checkbox." : "Returned to review from the Findings checkbox." });
  peerReview.history.push({ action: accepted ? "Finding accepted" : "Finding returned to review", user: peerCurrentUser, date, note: item.issue });
  savePeerReview(false); renderPeerFindings(); renderPeerFixList();
  showPeerToast(accepted ? "Finding accepted." : "Finding returned to review.");
}
function openPeerRuleExplanation(id) {
  const item = peerReview?.findings.find(finding => finding.id === id);
  if (!item) return;
  const title = document.getElementById("peerRuleExplanationTitle");
  const body = document.getElementById("peerRuleExplanationBody");
  title.textContent = item.issue;
  const isCompleteness = item.source === "completeness-rule" || /no matching drawing callout/i.test(item.issue);
  const ruleName = isCompleteness ? "Main-equipment callout coverage" : item.source === "visual-ai" ? "Visual coordination review" : "Deterministic drawing rule";
  const explanation = isCompleteness
    ? "This rule compares the equipment tag first, then the core equipment name. It runs only when at least 75% coverage and at least 10 main-equipment callouts were extracted. Short labels and longer schedule descriptions are allowed to match."
    : "This rule compares readable values already extracted from the drawing. It does not rely on model confidence, so the source values should still be confirmed in the redline view.";
  body.innerHTML = `<section><strong>Rule checked</strong><p>${escapePeerHTML(ruleName)}</p></section><section><strong>How it works</strong><p>${escapePeerHTML(explanation)}</p></section><section><strong>Evidence used</strong><p>${escapePeerHTML(item.details || "No additional rule evidence was recorded.")}</p>${item.listValue || item.comparedValue ? `<div class="peer-rule-values"><span>${escapePeerHTML(item.listValue || "Not provided")}</span><b>→</b><span>${escapePeerHTML(item.comparedValue || "Not provided")}</span></div>` : ""}</section><section><strong>Why there is no percentage</strong><p>Rule checks are pass/fail comparisons, not AI confidence estimates. “Confirm source” means an engineer should verify the extracted values before accepting the finding.</p></section>`;
  document.getElementById("peerRuleExplanationModal").classList.remove("hidden");
}
function addPeerManualFinding() { if (!peerReview) return; document.getElementById("peerGeneralCommentText").value = ""; document.getElementById("peerGeneralCommentPage").value = ""; document.getElementById("peerGeneralCommentModal")?.classList.remove("hidden"); document.getElementById("peerGeneralCommentText")?.focus(); }
function savePeerGeneralComment() { if (!peerReview) return; const issue = String(document.getElementById("peerGeneralCommentText")?.value || "").trim(); if (!issue) return showPeerToast("Enter a comment before saving."); const page = Number(document.getElementById("peerGeneralCommentPage")?.value || 0); const severity = document.getElementById("peerGeneralCommentSeverity")?.value || "Manual Review"; peerReview.findings.push(createPeerFinding({ severity, issue, page: page > 0 ? page : 0, source: "manual" })); renderPeerFindings(); renderPeerFixList(); savePeerReview(false); closePeerModal("peerGeneralCommentModal"); }
function jumpPeerPage(page) { showPeerStep("pages"); setTimeout(() => document.getElementById(`peer-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }

async function openPeerPagePreview(pageNumber) {
  const modal = document.getElementById("peerPagePreviewModal"), canvasRoot = document.getElementById("peerPagePreviewCanvas");
  if (!modal || !canvasRoot) return;
  document.getElementById("peerPagePreviewTitle").textContent = `Page ${pageNumber} preview`;
  canvasRoot.innerHTML = "<p>Loading page preview...</p>";
  modal.classList.remove("hidden");
  try {
    if (!peerPdfDocument && peerReview?.id) {
      const file = await getPeerPdf(peerReview.id);
      if (file) await loadPeerPdfDocument(file, false);
    }
    if (!peerPdfDocument) throw new Error("The saved PDF is unavailable.");
    const page = await peerPdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(320, Math.min(window.innerWidth * 0.82, 1180));
    const viewport = page.getViewport({ scale: Math.min(2, availableWidth / baseViewport.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    canvasRoot.replaceChildren(canvas);
  } catch (error) {
    canvasRoot.innerHTML = `<p class="peer-preview-error">${escapePeerHTML(error.message || "This page could not be previewed.")}</p>`;
  }
}

function getPeerSuggestedAnnotation(item = {}) {
  if (item.annotationText) return item.annotationText;
  const combined = `${item.issue || ""} ${item.details || ""}`;
  if (item.source === "evidence-ledger" || /^Coordinate repeated drawing information$/i.test(String(item.requirement || ""))) {
    const neutralIssue = /^Coordinate\b/i.test(String(item.issue || "")) ? String(item.issue) : `Coordinate the conflicting values for ${item.affectedObject || item.equipmentTag || "this item"}`;
    return `${neutralIssue.replace(/[.]+$/, "").toUpperCase()}.`;
  }
  const quotedSubject = String(item.details || "").match(/['"]([^'"]{3,80})['"]/)?.[1] || "";
  const subject = getPeerEquipmentShortDescription(item.listValue || item.comparedValue || quotedSubject || item.equipmentTag || "THIS ITEM").toUpperCase();
  if (/placeholder/i.test(item.issue) && (item.listValue || item.comparedValue)) return `REPLACE "${item.listValue || item.comparedValue}" WITH FINAL PROJECT VALUE.`;
  if (/RO (?:WATER |STORAGE )?TANK/i.test(combined) && /RECLAIM (?:WATER )?TANK/i.test(combined)) return "SHOW AND LABEL SEPARATE RO AND RECLAIM TANKS.";
  if (/clearance/i.test(combined) && /control panel|console/i.test(combined)) return `SHOW REQUIRED CLEARANCE IN FRONT OF ${/RO/i.test(combined) ? "RO " : /RECLAIM/i.test(combined) ? "RECLAIM " : ""}CONTROL PANEL.`;
  if (/ball valve|shut-?off valve/i.test(combined)) return "ADD REQUIRED BALL VALVE AT THIS CONNECTION.";
  if (/drain line|drain route/i.test(combined)) return "ADD AND LABEL THE REQUIRED DRAIN LINE.";
  if (/line weight|too light|broken line/i.test(combined)) return "ADJUST LINE WEIGHT FOR CLEAR DRAWING READABILITY.";
  if (/no matching drawing callout|not called out|no explicit callout/i.test(combined)) return `ADD OR CORRECT ${subject} CALLOUT.`;
  const concise = String(item.issue || "VERIFY AND CORRECT THIS ITEM")
    .replace(/^potential inconsistency:\s*/i, "")
    .replace(/[.]+$/, "")
    .trim();
  return `${concise.slice(0, 120).toUpperCase()}.`;
}

function getPeerSuggestedRedlineTarget(item = {}) {
  const location = `${item.location || ""} ${item.affectedObject || ""} ${item.details || ""}`.toUpperCase();
  let x = 0.5, y = 0.5;
  if (/\b(?:LEFT|WEST)\b/.test(location)) x = 0.23;
  else if (/\b(?:RIGHT|EAST)\b/.test(location)) x = 0.77;
  else if (/EQUIPMENT LIST|SCHEDULE|TABLE/.test(location)) x = 0.24;
  else if (/TITLE BLOCK/.test(location)) x = 0.82;
  if (/\b(?:TOP|UPPER|NORTH)\b/.test(location)) y = 0.2;
  else if (/\b(?:BOTTOM|LOWER|SOUTH)\b/.test(location)) y = 0.78;
  else if (/TITLE BLOCK/.test(location)) y = 0.88;
  else if (/GENERAL NOTES|DRAWING NOTES|NOTES SECTION/.test(location)) y = 0.22;
  else if (/PLAN VIEW|PLAN LAYOUT/.test(location)) y = 0.36;
  else if (/ELEVATION VIEW|ELEVATION LAYOUT/.test(location)) y = 0.64;
  return { x, y };
}

function initializePeerRedlinePlacement(item) {
  if (item.annotationPlacementInitialized) return;
  const target = getPeerSuggestedRedlineTarget(item);
  item.annotationTargetX = target.x; item.annotationTargetY = target.y;
  item.annotationX = Math.max(0.03, Math.min(0.76, target.x > 0.67 ? target.x - 0.3 : target.x + 0.07));
  item.annotationY = Math.max(0.03, Math.min(0.86, target.y > 0.7 ? target.y - 0.18 : target.y + 0.06));
  item.annotationPlacementInitialized = true;
}

function setPeerRedlinePlacementMode(mode = "arrow", recordChange = true) {
  if (recordChange) flushPeerRedlinePendingChange();
  peerRedlinePlacementMode = mode === "comment" ? "comment" : "arrow";
  const item = peerReview?.findings.find(finding => finding.id === peerActiveRedlineFinding);
  if (peerRedlinePlacementMode === "arrow" && item?.annotationShowArrow === false) return setPeerRedlineArrowVisibility(true, recordChange);
  syncPeerRedlinePlacementControls();
  refreshPeerRedlinePreview();
  if (recordChange) commitPeerRedlineHistory();
}

function syncPeerRedlinePlacementControls() {
  const item = peerReview?.findings.find(finding => finding.id === peerActiveRedlineFinding);
  const showArrow = item?.annotationShowArrow !== false;
  const arrow = document.getElementById("peerRedlineArrowMode"), comment = document.getElementById("peerRedlineCommentMode"), toggle = document.getElementById("peerRedlineArrowToggle"), toggleLabel = document.getElementById("peerRedlineArrowToggleLabel"), help = document.getElementById("peerRedlinePlacementHelp");
  [[arrow, "arrow"], [comment, "comment"]].forEach(([button, value]) => {
    const active = peerRedlinePlacementMode === value;
    button?.classList.toggle("secondary", !active);
    button?.classList.toggle("is-active", active);
    button?.setAttribute("aria-pressed", String(active));
  });
  if (arrow) arrow.disabled = !showArrow;
  if (toggle) toggle.checked = showArrow;
  if (toggleLabel) toggleLabel.textContent = showArrow ? "On" : "Off";
  if (help) {
    const message = !showArrow ? "Arrow is off. Click the drawing to move the comment box." : peerRedlinePlacementMode === "arrow" ? "Click the drawing where the arrow should point." : "Click the drawing to move the comment box; the arrow stays pointed at the issue.";
    help.innerHTML = `<span aria-hidden="true">i</span> ${message}`;
  }
}

function setPeerRedlineArrowVisibility(showArrow, recordChange = true) {
  if (recordChange) flushPeerRedlinePendingChange();
  const item = peerReview?.findings.find(finding => finding.id === peerActiveRedlineFinding); if (!item) return;
  item.annotationShowArrow = Boolean(showArrow);
  if (!item.annotationShowArrow) peerRedlinePlacementMode = "comment";
  syncPeerRedlinePlacementControls();
  refreshPeerRedlinePreview();
  if (recordChange) commitPeerRedlineHistory();
}

function applyPeerRedlineZoom(zoom = peerRedlineZoom, centerOnFinding = true) {
  const root = document.getElementById("peerRedlineCanvasRoot"), canvas = peerRedlinePreviewCanvas, label = document.getElementById("peerRedlineZoomValue");
  peerRedlineZoom = Math.max(0.75, Math.min(2.5, Number(zoom) || 1));
  if (label) label.textContent = `${Math.round(peerRedlineZoom * 100)}%`;
  if (!root || !canvas) return;
  const rootStyle = getComputedStyle(root);
  const availableWidth = Math.max(100, root.clientWidth - parseFloat(rootStyle.paddingLeft) - parseFloat(rootStyle.paddingRight));
  const availableHeight = Math.max(100, root.clientHeight - parseFloat(rootStyle.paddingTop) - parseFloat(rootStyle.paddingBottom));
  const fitScale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
  const displayWidth = Math.max(100, Math.round(canvas.width * fitScale * peerRedlineZoom));
  const displayHeight = Math.max(100, Math.round(canvas.height * fitScale * peerRedlineZoom));
  canvas.style.width = `${displayWidth}px`; canvas.style.height = `${displayHeight}px`;
  if (centerOnFinding) requestAnimationFrame(() => {
    const item = peerReview?.findings.find(finding => finding.id === peerActiveRedlineFinding);
    const targetX = Number(item?.annotationTargetX ?? .5), targetY = Number(item?.annotationTargetY ?? .5);
    root.scrollLeft = Math.max(0, targetX * displayWidth - root.clientWidth / 2);
    root.scrollTop = Math.max(0, targetY * displayHeight - root.clientHeight / 2);
  });
  renderPeerCoverageSummary();
}

function changePeerRedlineZoom(delta) { applyPeerRedlineZoom(peerRedlineZoom + Number(delta || 0)); }
function fitPeerRedlinePreview() { applyPeerRedlineZoom(1, false); }

function getPeerRedlineSnapshot() {
  const item = peerReview?.findings.find(finding => finding.id === peerActiveRedlineFinding);
  if (!item) return null;
  return {
    text: String(document.getElementById("peerRedlineText")?.value || ""),
    annotationX: Number(item.annotationX), annotationY: Number(item.annotationY),
    annotationTargetX: Number(item.annotationTargetX), annotationTargetY: Number(item.annotationTargetY),
    annotationShowArrow: item.annotationShowArrow !== false
  };
}

function peerRedlineSnapshotsMatch(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function updatePeerRedlineHistoryButtons() {
  const undo = document.getElementById("peerRedlineUndoButton"), redo = document.getElementById("peerRedlineRedoButton");
  if (undo) undo.disabled = peerRedlineUndoStack.length === 0;
  if (redo) redo.disabled = peerRedlineRedoStack.length === 0;
}

function resetPeerRedlineHistory() {
  if (peerRedlineHistoryTimer) clearTimeout(peerRedlineHistoryTimer);
  peerRedlineHistoryTimer = null; peerRedlineUndoStack = []; peerRedlineRedoStack = [];
  peerRedlineLastSnapshot = getPeerRedlineSnapshot(); updatePeerRedlineHistoryButtons();
}

function commitPeerRedlineHistory() {
  const current = getPeerRedlineSnapshot();
  if (!current || !peerRedlineLastSnapshot || peerRedlineSnapshotsMatch(current, peerRedlineLastSnapshot)) return updatePeerRedlineHistoryButtons();
  peerRedlineUndoStack.push(peerRedlineLastSnapshot); peerRedlineUndoStack = peerRedlineUndoStack.slice(-40);
  peerRedlineRedoStack = []; peerRedlineLastSnapshot = current; updatePeerRedlineHistoryButtons();
}

function flushPeerRedlinePendingChange() {
  if (peerRedlineHistoryTimer) clearTimeout(peerRedlineHistoryTimer);
  peerRedlineHistoryTimer = null; commitPeerRedlineHistory();
}

function handlePeerRedlineTextInput() {
  refreshPeerRedlinePreview();
  if (peerRedlineHistoryTimer) clearTimeout(peerRedlineHistoryTimer);
  peerRedlineHistoryTimer = setTimeout(() => { peerRedlineHistoryTimer = null; commitPeerRedlineHistory(); }, 350);
}

function applyPeerRedlineSnapshot(snapshot) {
  const item = peerReview?.findings.find(finding => finding.id === peerActiveRedlineFinding), input = document.getElementById("peerRedlineText");
  if (!item || !snapshot) return;
  item.annotationX = snapshot.annotationX; item.annotationY = snapshot.annotationY;
  item.annotationTargetX = snapshot.annotationTargetX; item.annotationTargetY = snapshot.annotationTargetY;
  item.annotationShowArrow = snapshot.annotationShowArrow !== false;
  if (input) input.value = snapshot.text;
  peerRedlineLastSnapshot = snapshot;
  if (item.annotationShowArrow === false) peerRedlinePlacementMode = "comment";
  syncPeerRedlinePlacementControls();
  refreshPeerRedlinePreview(); updatePeerRedlineHistoryButtons();
}

function undoPeerRedlineChange() {
  flushPeerRedlinePendingChange();
  if (!peerRedlineUndoStack.length) return;
  const current = getPeerRedlineSnapshot(), previous = peerRedlineUndoStack.pop();
  if (current) peerRedlineRedoStack.push(current);
  applyPeerRedlineSnapshot(previous);
}

function redoPeerRedlineChange() {
  flushPeerRedlinePendingChange();
  if (!peerRedlineRedoStack.length) return;
  const current = getPeerRedlineSnapshot(), next = peerRedlineRedoStack.pop();
  if (current) peerRedlineUndoStack.push(current);
  applyPeerRedlineSnapshot(next);
}

function getPeerLeaderStart(x, y, width, height, targetX, targetY) {
  const centerX = x + width / 2, centerY = y + height / 2, dx = targetX - centerX, dy = targetY - centerY;
  if (Math.abs(dx) < width / 2 && Math.abs(dy) < height / 2) return { x: centerX, y: y + height };
  const scale = 1 / Math.max(Math.abs(dx) / Math.max(1, width / 2), Math.abs(dy) / Math.max(1, height / 2));
  return { x: centerX + dx * scale, y: centerY + dy * scale };
}

function drawPeerCanvasArrow(context, startX, startY, targetX, targetY, lineWidth) {
  const angle = Math.atan2(targetY - startY, targetX - startX), head = Math.max(9, lineWidth * 5);
  context.save(); context.strokeStyle = "#e00000"; context.fillStyle = "#e00000"; context.lineWidth = lineWidth;
  context.beginPath(); context.moveTo(startX, startY); context.lineTo(targetX, targetY); context.stroke();
  context.beginPath(); context.moveTo(targetX, targetY);
  context.lineTo(targetX - head * Math.cos(angle - Math.PI / 6), targetY - head * Math.sin(angle - Math.PI / 6));
  context.lineTo(targetX - head * Math.cos(angle + Math.PI / 6), targetY - head * Math.sin(angle + Math.PI / 6));
  context.closePath(); context.fill(); context.restore();
}

function drawPeerRedlineAnnotation(context, canvas, item, text) {
  const fontSize = Math.max(20, Math.min(34, Math.round(canvas.width / 80))); context.font = `700 ${fontSize}px Arial`;
  const maxWidth = Math.min(canvas.width * 0.22, 440), lines = wrapPeerCanvasText(context, text, maxWidth - 24);
  if (!lines.length) lines.push("ENTER REVIEW COMMENT");
  const lineHeight = Math.round(fontSize * 1.2), boxWidth = Math.max(160, Math.min(maxWidth, Math.max(...lines.map(line => context.measureText(line).width), 136) + 24));
  const boxHeight = Math.max(46, lines.length * lineHeight + 20);
  const x = Math.min(canvas.width - boxWidth - 6, Math.max(6, Number(item.annotationX ?? .08) * canvas.width));
  const y = Math.min(canvas.height - boxHeight - 6, Math.max(6, Number(item.annotationY ?? .1) * canvas.height));
  const targetX = Math.max(4, Math.min(canvas.width - 4, Number(item.annotationTargetX ?? .5) * canvas.width));
  const targetY = Math.max(4, Math.min(canvas.height - 4, Number(item.annotationTargetY ?? .5) * canvas.height));
  if (item.annotationShowArrow !== false) {
    const leaderStart = getPeerLeaderStart(x, y, boxWidth, boxHeight, targetX, targetY);
    drawPeerCanvasArrow(context, leaderStart.x, leaderStart.y, targetX, targetY, Math.max(2, fontSize / 6));
  }
  context.fillStyle = "rgba(255,255,255,.92)"; context.fillRect(x, y, boxWidth, boxHeight);
  context.strokeStyle = "#e00000"; context.lineWidth = Math.max(1.5, fontSize / 8); context.strokeRect(x, y, boxWidth, boxHeight);
  context.fillStyle = "#d40000"; lines.forEach((line, index) => context.fillText(line, x + 12, y + 10 + lineHeight * (index + 0.78)));
}

function getPeerAcceptedRedlinesForPage(pageNumber, excludeId = "") {
  return (peerReview?.findings || []).filter(finding => finding.id !== excludeId && Number(finding.page) === Number(pageNumber) && finding.annotationAccepted && String(finding.annotationText || "").trim());
}

async function openPeerRedlinePreview(id) {
  const item = peerReview?.findings.find(finding => finding.id === id);
  const modal = document.getElementById("peerRedlineModal"), root = document.getElementById("peerRedlineCanvasRoot"), input = document.getElementById("peerRedlineText");
  if (!item?.page || !modal || !root || !input) return showPeerToast("A page number is required before creating a redline.");
  peerActiveRedlineFinding = id;
  initializePeerRedlinePlacement(item);
  peerRedlinePlacementMode = item.annotationShowArrow === false ? "comment" : "arrow";
  syncPeerRedlinePlacementControls();
  peerRedlineZoom = 1.25;
  input.value = getPeerSuggestedAnnotation(item);
  resetPeerRedlineHistory();
  document.getElementById("peerRemoveRedlineButton")?.toggleAttribute("hidden", !item.annotationAccepted);
  const acceptedOnPage = getPeerAcceptedRedlinesForPage(item.page, item.id);
  document.getElementById("peerRedlineTitle").textContent = `Page ${item.page} redline preview${acceptedOnPage.length ? ` · ${acceptedOnPage.length} accepted shown` : ""}`;
  root.innerHTML = "<p>Loading redline preview...</p>";
  modal.classList.remove("hidden");
  try {
    if (!peerPdfDocument && peerReview?.id) {
      const file = await getPeerPdf(peerReview.id);
      if (file) await loadPeerPdfDocument(file, false);
    }
    if (!peerPdfDocument) throw new Error("The saved PDF is unavailable.");
    const page = await peerPdfDocument.getPage(item.page), baseViewport = page.getViewport({ scale: 1 });
    const highResolutionWidth = Math.max(2200, Math.min(3600, window.innerWidth * 2.4));
    const viewport = page.getViewport({ scale: Math.min(3, highResolutionWidth / baseViewport.width) });
    const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const base = document.createElement("canvas"); base.width = canvas.width; base.height = canvas.height;
    const baseContext = base.getContext("2d"); baseContext.drawImage(canvas, 0, 0);
    acceptedOnPage.forEach(accepted => drawPeerRedlineAnnotation(baseContext, base, accepted, accepted.annotationText));
    peerRedlinePreviewCanvas = canvas; peerRedlinePreviewBase = base;
    canvas.addEventListener("click", event => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0.01, Math.min(0.99, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0.01, Math.min(0.99, (event.clientY - rect.top) / rect.height));
      flushPeerRedlinePendingChange();
      if (peerRedlinePlacementMode === "comment") { item.annotationX = Math.min(0.94, x); item.annotationY = Math.min(0.94, y); }
      else { item.annotationTargetX = x; item.annotationTargetY = y; }
      refreshPeerRedlinePreview();
      commitPeerRedlineHistory();
    });
    root.replaceChildren(canvas);
    refreshPeerRedlinePreview();
    applyPeerRedlineZoom(peerRedlineZoom);
  } catch (error) {
    root.innerHTML = `<p class="peer-preview-error">${escapePeerHTML(error.message || "The redline preview could not be loaded.")}</p>`;
  }
}

function wrapPeerCanvasText(context, text, maxWidth) {
  const words = String(text || "").trim().split(/\s+/), lines = []; let line = "";
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; } else line = candidate;
  });
  if (line) lines.push(line);
  return lines.slice(0, 8);
}

function refreshPeerRedlinePreview() {
  const item = peerReview?.findings.find(finding => finding.id === peerActiveRedlineFinding);
  const input = document.getElementById("peerRedlineText"), canvas = peerRedlinePreviewCanvas, base = peerRedlinePreviewBase;
  if (!item || !input || !canvas || !base) return;
  const context = canvas.getContext("2d"); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(base, 0, 0);
  drawPeerRedlineAnnotation(context, canvas, item, input.value);
}

function acceptAllPeerFindings() {
  if (!peerReview) return;
  const items = peerReview.findings.filter(item => item.status !== "Accepted");
  if (!items.length) return showPeerToast("All findings are already accepted.");
  const date = new Date().toISOString();
  items.forEach(item => {
    item.status = "Accepted";
    item.history.push({ action: "Finding accepted", user: peerCurrentUser, date, note: "Accepted from the Findings list." });
  });
  peerReview.history.push({ action: `${items.length} findings accepted`, user: peerCurrentUser, date });
  savePeerReview(false);
  renderPeerFindings();
  renderPeerFixList();
  showPeerToast(`${items.length} finding${items.length === 1 ? "" : "s"} accepted. Redlines can still be created individually.`);
}

function savePeerRedline(accept = false) {
  const item = peerReview?.findings.find(finding => finding.id === peerActiveRedlineFinding);
  const text = String(document.getElementById("peerRedlineText")?.value || "").trim();
  if (!item || !text) return showPeerToast("Enter the redline comment before saving.");
  item.annotationText = text; item.annotationAccepted = accept || item.annotationAccepted;
  if (accept) {
    item.status = "Accepted";
    const existing = item.comments.find(comment => comment.redline);
    if (existing) { existing.text = text; existing.editedAt = new Date().toISOString(); existing.editedBy = peerCurrentUser; }
    else item.comments.push({ id: peerId("comment"), text, redline: true, user: peerCurrentUser, date: new Date().toISOString() });
    item.history.push({ action: "Finding and redline accepted", user: peerCurrentUser, date: new Date().toISOString(), note: text });
  }
  savePeerReview(false); renderPeerFindings(); renderPeerFixList(); closePeerModal("peerRedlineModal");
  showPeerToast(accept ? "Finding accepted and redline saved." : "Redline draft saved.");
}

function removePeerAcceptedRedline(id = peerActiveRedlineFinding) {
  const item = peerReview?.findings.find(finding => finding.id === id);
  if (!item?.annotationAccepted) return showPeerToast("This finding does not have an accepted redline.");
  item.annotationAccepted = false;
  removePeerApprovedFindingFeedback(item);
  if (item.status === "Accepted") item.status = "Open";
  item.comments = item.comments.filter(comment => !comment.redline);
  item.history.push({ action: "Accepted redline removed", user: peerCurrentUser, date: new Date().toISOString(), note: "The finding remains available for review." });
  peerReview.history.push({ action: `Accepted redline removed from page ${item.page}`, user: peerCurrentUser, date: new Date().toISOString() });
  savePeerReview(false); renderPeerFindings(); renderPeerFixList();
  if (id === peerActiveRedlineFinding) closePeerModal("peerRedlineModal");
  showPeerToast("Redline removed. The finding is open for review again.");
}

function renderPeerChecklist() {
  const root = document.getElementById("peerChecklist"); if (!root || !peerReview) return;
  root.innerHTML = peerReview.checklist.map(item => `<div class="peer-check-row"><div><strong>${escapePeerHTML(item.title)}</strong><textarea placeholder="Comments" onchange="updatePeerChecklist('${item.id}','comments',this.value)">${escapePeerHTML(item.comments)}</textarea></div><select onchange="updatePeerChecklist('${item.id}','response',this.value)"><option value="">Select response</option>${PEER_CHECKLIST_RESPONSES.map(value => `<option${value === item.response ? " selected" : ""}>${value}</option>`).join("")}</select></div>`).join("");
}
function updatePeerChecklist(id, field, value) { const item = peerReview.checklist.find(check => check.id === id); if (!item) return; item[field] = value; item.history.push({ action: `${field} updated`, value, user: peerCurrentUser, date: new Date().toISOString() }); renderPeerFixList(); savePeerReview(false); }

function getPeerFixItems() {
  if (!peerReview) return [];
  const findings = peerReview.findings.filter(item => item.status === "Accepted").map(item => ({ id: item.id, title: item.issue, tag: item.equipmentTag, description: [item.listValue, item.comparedValue].filter(Boolean).join(" → "), page: item.page, severity: item.severity, sourceStatus: "Accepted", comments: item.comments.map(comment => comment.text).join("; ") }));
  return findings;
}

function renderPeerFixList() {
  const root = document.getElementById("peerFixList"); if (!root || !peerReview) return;
  const search = (document.getElementById("peerFixSearch")?.value || "").toLowerCase(), filter = document.getElementById("peerFixFilter")?.value || "all", sort = document.getElementById("peerFixSort")?.value || "page";
  const acceptedItems = getPeerFixItems();
  let items = acceptedItems.filter(item => `${item.title} ${item.tag} ${item.description} ${item.comments}`.toLowerCase().includes(search));
  items = items.filter(item => filter === "all" || (peerReview.fixStates[item.id]?.status || "Not Started") === filter);
  const severityOrder = { Error: 0, Warning: 1, "Manual Review": 2 }; items.sort((a, b) => sort === "severity" ? (severityOrder[a.severity] - severityOrder[b.severity]) : sort === "status" ? (peerReview.fixStates[a.id]?.status || "").localeCompare(peerReview.fixStates[b.id]?.status || "") : (a.page || 9999) - (b.page || 9999));
  root.innerHTML = items.map(item => {
    const state = peerReview.fixStates[item.id] || { status: "Not Started", notes: "", history: [] };
    return `<article class="peer-fix-item ${state.status === "Fixed" ? "is-fixed" : ""}"><input type="checkbox" aria-label="${state.status === "Fixed" ? "Undo resolved item" : "Resolve item"}" ${state.status === "Fixed" ? "checked" : ""} onchange="togglePeerFixResolution('${item.id}',this.checked)"><div><strong>${escapePeerHTML(item.title)}</strong><p>${item.tag ? `<b>${escapePeerHTML(item.tag)}</b> · ` : ""}${escapePeerHTML(item.description || "Review and resolve this item.")}${item.page ? ` · <button class="peer-page-link" onclick="jumpPeerPage(${item.page})">Page ${item.page}</button>` : ""}</p><small>${escapePeerHTML(item.severity)} · Source status: ${escapePeerHTML(item.sourceStatus)} · Fix status: ${escapePeerHTML(state.status)}</small>${state.notes ? `<p class="peer-fix-note"><b>Resolution:</b> ${escapePeerHTML(state.notes)}</p>` : ""}</div></article>`;
  }).join("") || (acceptedItems.length ? "<p>No accepted findings match this view.</p>" : "<p>Accept findings to add them to the Fix List.</p>");
}

function ensurePeerFixState(id) { return peerReview.fixStates[id] ||= { status: "Not Started", notes: "", history: [] }; }
function togglePeerFixResolution(id, checked) {
  const state = ensurePeerFixState(id);
  if (checked) {
    openPeerFixResolution(id);
    const statusSelect = document.getElementById("peerFixResolutionStatus");
    if (statusSelect) statusSelect.value = "Fixed";
    return;
  }
  state.status = "Not Started";
  delete state.fixedBy;
  delete state.fixedAt;
  state.history.push({ action: "Resolution undone", value: "Not Started", user: peerCurrentUser, date: new Date().toISOString() });
  savePeerReview(false);
  renderPeerFixList();
  showPeerToast("Resolution undone.");
}
function cancelPeerFixResolution() {
  closePeerModal("peerFixResolutionModal");
  renderPeerFixList();
}
function openPeerFixResolution(id) {
  const item = getPeerFixItems().find(entry => entry.id === id);
  if (!item) return;
  const state = ensurePeerFixState(id);
  peerActiveFixItem = id;
  document.getElementById("peerFixResolutionTitle").textContent = item.title;
  document.getElementById("peerFixResolutionContext").textContent = [item.tag, item.description, item.page ? `Page ${item.page}` : ""].filter(Boolean).join(" · ") || "Review and resolve this finding.";
  const statusSelect = document.getElementById("peerFixResolutionStatus");
  if (!statusSelect.options.length) PEER_FIX_STATUSES.forEach(status => statusSelect.add(new Option(status, status)));
  statusSelect.value = state.status;
  document.getElementById("peerFixResolutionNotes").value = state.notes || "";
  document.getElementById("peerFixResolutionModal").classList.remove("hidden");
}
function savePeerFixResolution() {
  if (!peerActiveFixItem) return;
  const state = ensurePeerFixState(peerActiveFixItem);
  const status = document.getElementById("peerFixResolutionStatus").value;
  const notes = document.getElementById("peerFixResolutionNotes").value.trim();
  state.status = status;
  state.notes = notes;
  state.history.push({ action: "Resolution saved", value: status, user: peerCurrentUser, date: new Date().toISOString(), note: notes });
  if (status === "Fixed") {
    state.fixedBy = peerCurrentUser;
    state.fixedAt = new Date().toISOString();
  } else {
    delete state.fixedBy;
    delete state.fixedAt;
  }
  savePeerReview(false);
  renderPeerFixList();
  closePeerModal("peerFixResolutionModal");
  showPeerToast("Resolution saved.");
}

function openPeerComments(id) { peerActiveCommentFinding = id; const item = peerReview.findings.find(finding => finding.id === id); if (!item) return; document.getElementById("peerCommentTitle").textContent = item.issue; document.getElementById("peerCommentThread").innerHTML = item.comments.map(comment => `<div class="peer-comment"><strong>${escapePeerHTML(comment.user)}</strong><small>${formatPeerDate(comment.date)}</small>${comment.replyTo ? `<small>Reply to ${escapePeerHTML(comment.replyTo)}</small>` : ""}<p>${escapePeerHTML(comment.text)}</p><div class="button-row"><button class="secondary" onclick="editPeerComment('${comment.id}')">Edit</button><button class="secondary" onclick="replyPeerComment('${comment.id}')">Reply</button></div></div>`).join("") || "<p>No comments yet.</p>"; document.getElementById("peerCommentText").value = ""; document.getElementById("peerCommentText").dataset.replyTo = ""; document.getElementById("peerResolutionText").value = item.resolutionNote || ""; document.getElementById("peerCommentModal").classList.remove("hidden"); }
function savePeerComment() { const item = peerReview.findings.find(finding => finding.id === peerActiveCommentFinding); if (!item) return; const input = document.getElementById("peerCommentText"), text = input.value.trim(), resolution = document.getElementById("peerResolutionText").value.trim(); if (text) item.comments.push({ id: peerId("comment"), text, replyTo: input.dataset.replyTo || "", user: peerCurrentUser, date: new Date().toISOString() }); item.resolutionNote = resolution; savePeerReview(false); renderPeerFindings(); closePeerModal("peerCommentModal"); }
function editPeerComment(id) { const item = peerReview.findings.find(finding => finding.id === peerActiveCommentFinding), comment = item?.comments.find(entry => entry.id === id); if (!comment) return; const text = window.prompt("Edit comment:", comment.text); if (text === null || !text.trim()) return; comment.text = text.trim(); comment.editedAt = new Date().toISOString(); comment.editedBy = peerCurrentUser; savePeerReview(false); openPeerComments(peerActiveCommentFinding); }
function replyPeerComment(id) { const item = peerReview.findings.find(finding => finding.id === peerActiveCommentFinding), comment = item?.comments.find(entry => entry.id === id), input = document.getElementById("peerCommentText"); if (!comment || !input) return; input.dataset.replyTo = comment.user; input.placeholder = `Reply to ${comment.user}`; input.focus(); }
function closePeerModal(id) { document.getElementById(id)?.classList.add("hidden"); }

function openPeerEquipmentChecks() {
  document.getElementById("peerEquipmentChecksModal")?.classList.remove("hidden");
}
function recordPeerResolution(item) { item.history.push({ action: "Resolved", user: peerCurrentUser, date: new Date().toISOString(), note: item.resolutionNote || "" }); }

function savePeerReview(showToast = true) {
  if (!peerReview) return; peerReview.reviewer = peerCurrentUser; peerReview.updatedAt = new Date().toISOString();
  if (peerReview.cadData) putPeerCadData(peerReview.id, peerReview.cadData).catch(error => console.warn("Native CAD evidence could not be saved:", error));
  const storedReview = peerReview.cadData ? { ...peerReview, cadData: null, cadStored: true } : peerReview;
  const reviews = readPeerReviews().filter(item => item.id !== peerReview.id); reviews.unshift(storedReview);
  const retained = reviews.slice(0, PEER_HISTORY_LIMIT), removed = reviews.slice(PEER_HISTORY_LIMIT);
  while (retained.length) {
    try { localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(retained)); break; }
    catch (error) {
      if (!isPeerStorageFullError(error) || retained.length === 1) { if (showToast) showPeerToast("This review could not be saved locally."); return; }
      removed.push(retained.pop());
    }
  }
  removed.forEach(item => { deletePeerPdf(item.id).catch(() => {}); deletePeerCadData(item.id).catch(() => {}); });
  if (showToast) showPeerToast(`Review saved locally. Keeping the latest ${retained.length} of ${PEER_HISTORY_LIMIT}.`);
  renderPeerSummary(); updatePeerStorageStatus();
}
async function completePeerReview() {
  if (!peerReview) return;
  if (peerCheckRunning || peerDrawingLoadRunning) return showPeerToast("Wait for the drawing review to finish before completing and exporting it.");
  const button = document.getElementById("peerConfirmCompleteButton");
  if (button?.disabled) return;
  const exportReport = Boolean(document.getElementById("peerCompleteReportExport")?.checked);
  const exportExcel = Boolean(document.getElementById("peerCompleteExcelExport")?.checked);
  const allowLearning = document.querySelector('input[name="peerCompleteLearning"]:checked')?.value === "yes";
  if (button) { button.disabled = true; button.textContent = "Completing Review..."; }
  try {
    const completedDrawing = await buildPeerReviewedDrawingPdf(false);
    const unresolved = peerReview.findings.filter(item => item.status !== "Accepted").length;
    peerReview.status = "Complete";
    peerReview.completedAt = new Date().toISOString();
    peerReview.completedExportName = `${peerExportBaseName()} - Completed Drawing.pdf`;
    peerReview.knowledgeConsent = allowLearning;
    const selectedExports = ["completed drawing PDF", exportReport ? "review report PDF" : "", exportExcel ? "Excel workbook" : ""].filter(Boolean);
    peerReview.history.push({ action: "Review completed and final files exported", user: peerCurrentUser, date: peerReview.completedAt, note: `${selectedExports.join(", ")}. ${completedDrawing.accepted.length} accepted redline${completedDrawing.accepted.length === 1 ? "" : "s"} included. ${unresolved} finding${unresolved === 1 ? "" : "s"} remained unresolved. AI learning ${allowLearning ? "approved" : "declined"}.` });
    const knowledge = allowLearning ? savePeerReviewDecisionsAsKnowledge() : { accepted: 0, rejected: 0, total: 0, removed: removePeerReviewDecisionsFromKnowledge() };
    savePeerReview(false);
    renderPeerSummary();
    downloadPeerFile(completedDrawing.bytes, peerReview.completedExportName, "application/pdf");
    const optionalExportErrors = [];
    if (exportReport) try { await exportPeerPDF(); } catch (error) { optionalExportErrors.push(`review report: ${error?.message || "could not be built"}`); }
    if (exportExcel) try { exportPeerExcel(); } catch (error) { optionalExportErrors.push(`Excel workbook: ${error?.message || "could not be built"}`); }
    closePeerModal("peerExportModal");
    const knowledgeMessage = allowLearning
      ? knowledge.total ? `${knowledge.total} finalized decision${knowledge.total === 1 ? " was" : "s were"} saved as future review knowledge.` : "Learning was approved, but there were no new finalized decisions to save."
      : `AI learning was declined; no decisions were saved${knowledge.removed ? ` and ${knowledge.removed} previously saved decision${knowledge.removed === 1 ? " was" : "s were"} removed` : ""}.`;
    const exportMessage = optionalExportErrors.length ? ` The completed drawing was downloaded, but ${optionalExportErrors.join("; ")}.` : ` ${selectedExports.length} file${selectedExports.length === 1 ? " was" : "s were"} downloaded.`;
    showPeerToast(`Review complete.${exportMessage} ${knowledgeMessage}`);
  } catch (error) {
    showPeerToast(`The review was not completed because the final PDF could not be built: ${error?.message || "Unknown error"}`);
  } finally {
    if (button) { button.disabled = false; button.innerHTML = "<span>Complete Review</span><small>Download selected files</small>"; }
  }
}
function readPeerReviews() { try { const reviews = JSON.parse(localStorage.getItem(PEER_STORAGE_KEY) || "[]"); return Array.isArray(reviews) ? reviews : []; } catch { return []; } }

function renderPeerSavedReviews() {
  const root = document.getElementById("peerSavedReviews"); if (!root) return;
  const reviews = readPeerReviews().slice(0, PEER_HISTORY_LIMIT);
  root.innerHTML = reviews.map(review => `<div class="packet-history-row"><div class="packet-history-info"><strong>${escapePeerHTML(review.project || review.filename || "Untitled review")}</strong><span>${escapePeerHTML(PEER_REVIEW_TYPES[review.type]?.label || review.type)} | ${escapePeerHTML(review.status || "In Progress")}</span><span>${formatPeerDate(review.updatedAt)}</span></div><div class="button-row packet-history-actions"><button onclick="openPeerReview('${review.id}')">Open</button><button class="delete-btn" onclick="removePeerReviewHistory('${review.id}')">Remove</button></div></div>`).join("") || "<p>No local peer review history yet.</p>";
  const status = document.getElementById("peerHistoryStatus"); if (status) status.textContent = reviews.length ? `Showing ${reviews.length} saved peer review${reviews.length === 1 ? "" : "s"}.` : "No local peer review history yet.";
  updatePeerStorageStatus();
}

async function removePeerReviewHistory(id) {
  const review = readPeerReviews().find(item => item.id === id); if (!review) return;
  if (!window.confirm(`Remove ${review.filename || "this peer review"} from local history?`)) return;
  localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(readPeerReviews().filter(item => item.id !== id)));
  await Promise.all([deletePeerPdf(id), deletePeerCadData(id)]); renderPeerSavedReviews();
}

async function clearPeerReviewHistory() {
  const reviews = readPeerReviews(); if (!reviews.length) return;
  if (!window.confirm("Remove all saved peer reviews and their PDFs from this browser?")) return;
  localStorage.removeItem(PEER_STORAGE_KEY);
  await Promise.all(reviews.flatMap(item => [deletePeerPdf(item.id).catch(() => {}), deletePeerCadData(item.id).catch(() => {})])); renderPeerSavedReviews();
}

async function updatePeerStorageStatus() {
  const card = document.getElementById("peerStorageUsage"); if (!card) return;
  const label = card.querySelector(".storage-usage-label span"), bar = card.querySelector(".storage-usage-bar span"), detail = card.querySelector("p");
  card.classList.remove("warning", "danger");
  if (!navigator.storage?.estimate) { if (label) label.textContent = "Usage unavailable"; if (detail) detail.textContent = "This browser does not report local storage capacity."; return; }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate(), percent = quota ? Math.min(100, usage / quota * 100) : 0;
    if (label) label.textContent = quota ? `${formatPeerStorageBytes(usage)} of ${formatPeerStorageBytes(quota)} used` : `${formatPeerStorageBytes(usage)} used`;
    if (bar) bar.style.width = `${percent.toFixed(1)}%`;
    if (detail) detail.textContent = `Local peer review history${quota ? ` - ${percent.toFixed(1)}% used` : ""}`;
    card.classList.toggle("warning", percent >= 75 && percent < 90); card.classList.toggle("danger", percent >= 90);
  } catch { if (label) label.textContent = "Usage unavailable"; }
}

function formatPeerStorageBytes(bytes) { if (!bytes) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))); return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function isPeerStorageFullError(error) { return error?.name === "QuotaExceededError" || /quota|storage|space/i.test(error?.message || ""); }
function renderPeerSummary() { if (!peerReview) return; document.getElementById("peerReviewTypeBadge").textContent = PEER_REVIEW_TYPES[peerReview.type].label; document.getElementById("peerReviewTitle").textContent = peerReview.filename || "New Review"; document.getElementById("peerReviewMeta").textContent = `${peerReview.filename || "No drawing uploaded"}${peerReview.sourceFormat ? ` | ${peerReview.sourceFormat}` : ""} | ${peerCurrentUser} | ${new Date(peerReview.createdAt).toLocaleDateString()} | ${peerReview.status}`; }

function populatePeerFixFilter() { const select = document.getElementById("peerFixFilter"); PEER_FIX_STATUSES.forEach(status => select?.add(new Option(status, status))); }
function populatePeerFindingFilter() { return document.getElementById("peerFindingStatus"); }

function openPeerExportModal() {
  if (!peerReview) return;
  const accepted = peerReview.findings.filter(item => item.annotationAccepted && item.annotationText && item.page).length;
  const unresolved = peerReview.findings.filter(item => item.status !== "Accepted").length;
  const summary = document.getElementById("peerExportSummary"), markedDescription = document.getElementById("peerExportMarkedDescription");
  if (summary) summary.innerHTML = `<span><strong>${peerReview.findings.length}</strong> total findings</span><span><strong>${accepted}</strong> accepted redline${accepted === 1 ? "" : "s"}</span><span><strong>${unresolved}</strong> pending decision</span><span><strong>${escapePeerHTML(peerReview.sourceFormat || "PDF")}</strong> source</span>`;
  if (markedDescription) markedDescription.textContent = accepted ? `Drawing PDF with ${accepted} accepted redline${accepted === 1 ? "" : "s"} placed on the reviewed pages.` : "Drawing PDF without redlines; no findings currently have saved accepted redlines.";
  const report = document.getElementById("peerCompleteReportExport"), excel = document.getElementById("peerCompleteExcelExport");
  if (report) report.checked = false; if (excel) excel.checked = false;
  const learningValue = peerReview.knowledgeConsent === false ? "no" : "yes";
  document.querySelectorAll('input[name="peerCompleteLearning"]').forEach(input => { input.checked = input.value === learningValue; });
  document.getElementById("peerExportModal")?.classList.remove("hidden");
}
function getPeerReportRows() { return peerReview.findings.map(item => ({ Severity: item.severity, "Equipment Tag": item.equipmentTag, Issue: item.issue, "Equipment List Value": item.listValue, "Compared Value": item.comparedValue, Page: item.page || "", Status: item.status, Comments: item.comments.map(comment => `${comment.user}: ${comment.text}`).join(" | "), "Resolution Note": item.resolutionNote })); }
function exportPeerExcel() { const workbook = XLSX.utils.book_new(); const summary = [{ Project: peerReview.project, Filename: peerReview.filename, "Review Type": PEER_REVIEW_TYPES[peerReview.type].label, Reviewer: peerReview.reviewer, Date: new Date(peerReview.createdAt).toLocaleDateString(), "Final Status": peerReview.status }]; XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Summary"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(getPeerReportRows()), "Findings"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(peerReview.checklist.map(item => ({ Item: item.title, Response: item.response, Comments: item.comments }))), "Checklist"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(getPeerFixItems().map(item => ({ ...item, ...(peerReview.fixStates[item.id] || {}) }))), "Fix List"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(peerReview.history), "History"); XLSX.writeFile(workbook, `${peerExportBaseName()}.xlsx`); closePeerModal("peerExportModal"); }
async function exportPeerPDF() { const doc = await PDFLib.PDFDocument.create(); const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold); let page, y; const addPage = () => { page = doc.addPage([612, 792]); y = 755; }; const line = (text, options = {}) => { const size = options.size || 9, max = options.max || 92; String(text || "").match(new RegExp(`.{1,${max}}(?:\\s|$)|\\S+`, "g"))?.forEach(part => { if (y < 45) addPage(); page.drawText(part.trim(), { x: options.x || 42, y, size, font: options.bold ? bold : font, color: PDFLib.rgb(0.12, 0.18, 0.23) }); y -= size + 4; }); }; addPage(); line("N/S Automation Peer Review Report", { size: 17, bold: true }); y -= 5; line(`Project: ${peerReview.project || "Not selected"}`); line(`Filename: ${peerReview.filename}`); line(`Review Type: ${PEER_REVIEW_TYPES[peerReview.type].label}`); line(`Reviewer: ${peerReview.reviewer}`); line(`Date: ${new Date(peerReview.createdAt).toLocaleDateString()}`); line(`Final Status: ${peerReview.status}`); y -= 10; line("Findings", { size: 13, bold: true }); getPeerReportRows().forEach((item, index) => { line(`${index + 1}. [${item.Severity}] ${item.Issue}`, { bold: true }); line(`Tag: ${item["Equipment Tag"] || "-"} | Page: ${item.Page || "-"} | Status: ${item.Status}`); line(`Values: ${item["Equipment List Value"] || "-"} / ${item["Compared Value"] || "-"}`); line(`Comments: ${item.Comments || "-"} | Resolution: ${item["Resolution Note"] || "-"}`); y -= 5; }); y -= 6; line("Checklist", { size: 13, bold: true }); peerReview.checklist.forEach(item => line(`${item.title} — ${item.response || "Not answered"}. ${item.comments}`)); y -= 6; line("Resolution History", { size: 13, bold: true }); peerReview.history.forEach(item => line(`${formatPeerDate(item.date)} — ${item.user}: ${item.action}${item.note ? ` — ${item.note}` : ""}`)); const bytes = await doc.save(); downloadPeerFile(bytes, `${peerExportBaseName()}.pdf`, "application/pdf"); closePeerModal("peerExportModal"); }
function wrapPeerPdfText(font, text, size, maxWidth) {
  const words = String(text || "").replace(/[^\x20-\x7E]/g, "-").trim().split(/\s+/), lines = []; let line = "";
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) { lines.push(line); line = word; } else line = candidate;
  });
  if (line) lines.push(line);
  return lines.slice(0, 10);
}

function drawPeerPdfArrow(page, startX, startY, targetX, targetY, color) {
  const angle = Math.atan2(targetY - startY, targetX - startX), head = 7;
  page.drawLine({ start: { x: startX, y: startY }, end: { x: targetX, y: targetY }, thickness: 1.5, color });
  [-1, 1].forEach(direction => {
    const wingAngle = angle + direction * Math.PI / 6;
    page.drawLine({ start: { x: targetX, y: targetY }, end: { x: targetX - head * Math.cos(wingAngle), y: targetY - head * Math.sin(wingAngle) }, thickness: 1.5, color });
  });
}

async function buildPeerReviewedDrawingPdf(requireAccepted = true) {
  if (!peerReview) throw new Error("No peer review is open.");
  const accepted = peerReview.findings.filter(item => item.annotationAccepted && item.annotationText && item.page);
  if (requireAccepted && !accepted.length) throw new Error("Accept at least one redline before downloading the marked PDF.");
  const file = await getPeerPdf(peerReview.id);
  if (!file) throw new Error("The saved drawing PDF is unavailable.");
  const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer()), font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  accepted.forEach(item => {
    const page = doc.getPages()[item.page - 1]; if (!page) return;
    const { width, height } = page.getSize(), size = Math.max(5.5, Math.min(8, width / 135)), maxWidth = Math.min(width * .21, 165);
    const lines = wrapPeerPdfText(font, item.annotationText, size, maxWidth - 14), lineHeight = size * 1.25;
    const boxWidth = Math.max(72, Math.min(maxWidth, Math.max(...lines.map(line => font.widthOfTextAtSize(line, size)), 62) + 10));
    const boxHeight = Math.max(19, lines.length * lineHeight + 8);
    const x = Math.min(width - boxWidth - 5, Math.max(5, Number(item.annotationX || .08) * width));
    const y = Math.min(height - boxHeight - 5, Math.max(5, height - Number(item.annotationY || .1) * height - boxHeight));
    const red = PDFLib.rgb(.88, 0, 0);
    const targetX = Math.max(3, Math.min(width - 3, Number(item.annotationTargetX ?? .5) * width));
    const targetY = Math.max(3, Math.min(height - 3, height - Number(item.annotationTargetY ?? .5) * height));
    if (item.annotationShowArrow !== false) {
      const leaderStart = getPeerLeaderStart(x, y, boxWidth, boxHeight, targetX, targetY);
      drawPeerPdfArrow(page, leaderStart.x, leaderStart.y, targetX, targetY, red);
    }
    page.drawRectangle({ x, y, width: boxWidth, height: boxHeight, color: PDFLib.rgb(1, 1, 1), opacity: .9, borderColor: red, borderWidth: 1.5 });
    lines.forEach((line, index) => page.drawText(line, { x: x + 7, y: y + boxHeight - 8 - size - index * lineHeight, size, font, color: PDFLib.rgb(.84, 0, 0) }));
  });
  return { bytes: await doc.save(), accepted };
}

async function exportAcceptedPeerRedlines() {
  if (!peerReview) return;
  try {
    const markedDrawing = await buildPeerReviewedDrawingPdf(true);
    downloadPeerFile(markedDrawing.bytes, `${(peerReview.filename || "Peer Review").replace(/\.(?:pdf|dwg)$/i, "")} - Accepted Redlines.pdf`, "application/pdf");
    closePeerModal("peerExportModal");
    showPeerToast(`Marked drawing preview downloaded with ${markedDrawing.accepted.length} accepted redline${markedDrawing.accepted.length === 1 ? "" : "s"}. Review knowledge was not changed.`);
  } catch (error) { showPeerToast(error.message || "The accepted redline PDF could not be created."); }
}

function peerExportBaseName() { return `${(peerReview.filename || "Peer Review").replace(/\.(?:pdf|dwg)$/i, "")} - ${PEER_REVIEW_TYPES[peerReview.type].label}`.replace(/[\\/:*?"<>|]/g, "-"); }
function downloadPeerFile(data, filename, type) { const url = URL.createObjectURL(new Blob([data], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function openPeerPdfDB() { return new Promise((resolve, reject) => { const request = indexedDB.open(PEER_PDF_DB, 4); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(PEER_PDF_STORE)) request.result.createObjectStore(PEER_PDF_STORE); if (!request.result.objectStoreNames.contains(PEER_CAD_STORE)) request.result.createObjectStore(PEER_CAD_STORE); if (!request.result.objectStoreNames.contains(PEER_KNOWLEDGE_STORE)) request.result.createObjectStore(PEER_KNOWLEDGE_STORE, { keyPath: "id" }); if (!request.result.objectStoreNames.contains(PEER_ANALYSIS_CACHE_STORE)) request.result.createObjectStore(PEER_ANALYSIS_CACHE_STORE, { keyPath: "key" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function savePeerPdf(id, file) {
  const candidates = readPeerReviews().filter(item => item.id !== id);
  while (true) {
    try { await putPeerPdf(id, file); return; }
    catch (error) {
      if (!isPeerStorageFullError(error) || !candidates.length) throw error;
      const oldest = candidates.pop();
      localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(readPeerReviews().filter(item => item.id !== oldest.id)));
      await deletePeerPdf(oldest.id);
    }
  }
}
async function putPeerPdf(id, file) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_PDF_STORE, "readwrite"); tx.objectStore(PEER_PDF_STORE).put(file, id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
async function deletePeerPdf(id) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_PDF_STORE, "readwrite"); tx.objectStore(PEER_PDF_STORE).delete(id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
async function getPeerPdf(id) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const request = db.transaction(PEER_PDF_STORE).objectStore(PEER_PDF_STORE).get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function putPeerCadData(id, data) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_CAD_STORE, "readwrite"); tx.objectStore(PEER_CAD_STORE).put(data, id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
async function getPeerCadData(id) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const request = db.transaction(PEER_CAD_STORE).objectStore(PEER_CAD_STORE).get(id); request.onsuccess = () => { db.close(); resolve(request.result || null); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
async function deletePeerCadData(id) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_CAD_STORE, "readwrite"); tx.objectStore(PEER_CAD_STORE).delete(id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
async function putPeerKnowledgeSource(source) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_KNOWLEDGE_STORE, "readwrite"); tx.objectStore(PEER_KNOWLEDGE_STORE).put(source); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
async function getPeerKnowledgeSource(id) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const request = db.transaction(PEER_KNOWLEDGE_STORE).objectStore(PEER_KNOWLEDGE_STORE).get(id); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
async function getAllPeerKnowledgeSources() { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const request = db.transaction(PEER_KNOWLEDGE_STORE).objectStore(PEER_KNOWLEDGE_STORE).getAll(); request.onsuccess = () => { db.close(); resolve((request.result || []).sort((left, right) => String(right.addedAt).localeCompare(String(left.addedAt)))); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
async function deletePeerKnowledgeSource(id) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_KNOWLEDGE_STORE, "readwrite"); tx.objectStore(PEER_KNOWLEDGE_STORE).delete(id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
async function putPeerAnalysisCacheEntry(entry) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_ANALYSIS_CACHE_STORE, "readwrite"); tx.objectStore(PEER_ANALYSIS_CACHE_STORE).put(entry); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
async function getPeerAnalysisCacheEntry(key) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const request = db.transaction(PEER_ANALYSIS_CACHE_STORE).objectStore(PEER_ANALYSIS_CACHE_STORE).get(key); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => { db.close(); reject(request.error); }; }); }

function reportPeerDrawingRead(message) {
  setPeerStatus(message);
  if (peerAnalysisMode === "file-read" && peerAnalysisStartedAt) setPeerAnalysisProgress("running", message);
}
function finishPeerDrawingRead(message, error = false) {
  setPeerStatus(message, error);
  if (peerAnalysisMode === "file-read" && peerAnalysisStartedAt) {
    setPeerAnalysisProgress(error ? "error" : "complete", message);
    stopPeerAnalysisTimer();
  }
}
function setPeerStatus(message, error = false) { const status = document.getElementById("peerUploadStatus"); if (status) { status.textContent = message; status.classList.toggle("is-error", error); } }
function showPeerToast(message) { const toast = document.getElementById("peerToast"); toast.textContent = message; toast.classList.remove("hidden"); clearTimeout(showPeerToast.timer); showPeerToast.timer = setTimeout(() => toast.classList.add("hidden"), 3200); }
function formatPeerDate(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString() : ""; }
function escapePeerHTML(value = "") { return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
