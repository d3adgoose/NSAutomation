/* Local, rule-based Peer Review workflow. No drawing data leaves the browser. */
const PEER_STORAGE_KEY = "ns-peer-reviews-v1";
const PEER_PDF_DB = "NSPeerReviewStorage";
const PEER_PDF_STORE = "reviewPdfs";
const PEER_KNOWLEDGE_STORE = "knowledgeSources";
const PEER_HISTORY_LIMIT = 5;
const PEER_KNOWLEDGE_KEY = "ns-peer-review-knowledge-v1";
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

SOURCE EXAMPLE: A readable general flow note requires a shutoff valve and union before a connection to supplied equipment, but the traced connection visibly omits one.
EXPECTED FINDING: Identify the connection and the missing valve or union. Do not report this unless the note and the affected connection are both readable.

SOURCE EXAMPLE: A tank is shown with process inlet/outlet piping but its required drain, overflow, or recovery route is absent or conflicts with the connections table.
EXPECTED FINDING: Request the missing route and cite the tank label plus the applicable connection-table row or flow note.

SOURCE EXAMPLE: A major equipment outline, dimension extension, leader, or flow line is materially lighter, broken, or obscured compared with adjacent drawing geometry.
EXPECTED FINDING: Request a line-weight or legibility correction and identify the exact object or dimension. Ignore ordinary construction-line hierarchy.

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
    findings: { type: "array", items: { type: "object", additionalProperties: false, properties: { severity: { type: "string", enum: ["Error", "Warning", "Manual Review"] }, issue: { type: "string" }, evidence: { type: "string" }, location: { type: "string" }, confidence: { type: "number" }, evidenceType: { type: "string", enum: ["Explicit reviewer correction", "Unresolved placeholder", "Objective visible mismatch", "Required reference missing"] }, existingCommentVisible: { type: "boolean" } }, required: ["severity", "issue", "evidence", "location", "confidence", "evidenceType", "existingCommentVisible"] } }
  }, required: ["drawingNumber", "projectNumber", "sheetNumber", "sheetTotal", "titleBlockConfidence", "pageType", "equipmentRows", "findings"]
};
const PEER_COORDINATION_REVIEW_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    findings: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, properties: {
      severity: { type: "string", enum: ["Error", "Warning", "Manual Review"] },
      issue: { type: "string" }, evidence: { type: "string" }, location: { type: "string" },
      confidence: { type: "number" }, evidenceType: { type: "string", enum: ["Unresolved placeholder", "Objective visible mismatch", "Required reference missing"] }
    }, required: ["severity", "issue", "evidence", "location", "confidence", "evidenceType"] } }
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
let peerReview = null;
let peerPdfDocument = null;
let peerActiveCommentFinding = "";
let peerCurrentUser = "Local reviewer";
let peerOcrRunning = false;
let peerAnalysisStartedAt = 0;
let peerAnalysisTimer = null;
let peerAnalysisLastMessage = "";
let peerAnalysisMessageCount = 0;
let peerOcrLoadStage = "";
let peerActiveRedlineFinding = "";
let peerActiveFixItem = "";
let peerRedlinePreviewCanvas = null;
let peerRedlinePreviewBase = null;
let peerAiStatus = { ready: false, loaded: false, authenticated: false, model: "Qwen3-VL", error: "Checking the Local AI service." };

const PEER_INITIAL_CHECKLIST = ["Drawing information appears complete.", "Title blocks are complete.", "Drawing numbers appear correct.", "Pages are readable.", "General comments."];
const PEER_EQUIPMENT_CHECKLIST = ["Equipment tags appear consistent.", "Manufacturer information appears correct.", "Model numbers appear correct.", "Quantities appear correct.", "Equipment descriptions appear complete.", "No obvious inconsistencies remain.", "Additional comments."];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("peerPdfUpload")?.addEventListener("change", event => handlePeerPdf(event.target.files?.[0]));
  setupPeerDropZone(); populatePeerFixFilter(); populatePeerFindingFilter(); renderPeerSavedReviews();
  updatePeerAiIndicator();
  window.addEventListener("ns-auth-session-changed", event => {
    const user = event.detail?.user;
    peerCurrentUser = user?.user_metadata?.full_name || user?.email || "Local reviewer";
    if (peerReview) renderPeerSummary();
    updatePeerAiIndicator();
  });
});

async function updatePeerAiIndicator() {
  const button = document.getElementById("peerAiHeaderButton"), label = button?.querySelector(".spec-ai-header-status-label");
  if (!button) return false;
  button.classList.remove("is-ready", "is-error"); button.classList.add("is-checking");
  if (label) label.textContent = "Checking Local AI";
  const servedLocally = (location.hostname === "127.0.0.1" || location.hostname === "localhost") && location.port === "4173";
  try {
    if (!window.supabaseClient) throw new Error("Sign in with the Database login to use Local AI.");
    const { data } = await window.supabaseClient.auth.getSession();
    if (!data.session?.access_token) throw new Error("Sign in with the Database login to use Local AI.");
    const user = data.session.user;
    peerCurrentUser = user?.user_metadata?.full_name || user?.email || "Signed in";
    const response = await fetch(`${servedLocally ? "" : "http://127.0.0.1:4173"}/api/local-ai`, { ...(servedLocally ? {} : { targetAddressSpace: "loopback" }), headers: { Authorization: `Bearer ${data.session.access_token}` } });
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
  button.classList.add(state === "ready" ? "is-ready" : state === "working" ? "is-checking" : "is-error");
  if (label) label.textContent = state === "working" ? "Local AI Reviewing" : state === "ready" ? "Local AI Ready" : "Local AI Offline";
  button.title = state === "working" ? "Local visual AI is reviewing the drawing now." : state === "ready" ? "Local AI is connected. Open review details." : "Local AI is unavailable. Open review details.";
}

function openPeerAiStatus() {
  const body = document.getElementById("peerAiStatusBody"); if (!body) return;
  const active = Boolean(peerAnalysisTimer);
  body.innerHTML = `<div class="spec-ai-status-hero${peerAiStatus.ready ? "" : " is-error"}"><div class="spec-ai-status-orb">AI</div><div><h3>${active ? "Local AI is reviewing drawings" : peerAiStatus.ready ? "Local AI is ready" : "Local AI needs attention"}</h3><p>${escapePeerHTML(active ? peerAnalysisLastMessage || "Reading the current drawing package." : peerAiStatus.error || `${peerAiStatus.model} is available for visual drawing review.`)}</p></div></div><p class="spec-ai-status-next"><strong>Your next step:</strong> ${active ? "Keep this page open while the drawing regions are reviewed." : peerAiStatus.ready ? "Choose a review type, upload a drawing package, and run the automatic checks." : !peerAiStatus.authenticated ? "Open Database and sign in with your company account, then select Try Reconnecting." : "Start the Local AI server, then select Try Reconnecting."}</p><div class="spec-ai-status-grid"><div class="spec-ai-status-card"><span>Background service</span><strong>${peerAiStatus.ready ? "Connected" : "Unavailable"}</strong></div><div class="spec-ai-status-card"><span>Model</span><strong>${escapePeerHTML(peerAiStatus.model)}</strong></div><div class="spec-ai-status-card"><span>Model memory</span><strong>${peerAiStatus.loaded ? "Loaded now" : peerAiStatus.ready ? "Loads on demand" : "Not available"}</strong></div><div class="spec-ai-status-card"><span>Database account</span><strong>${peerAiStatus.authenticated ? escapePeerHTML(peerCurrentUser) : "Sign in required"}</strong></div><div class="spec-ai-status-card"><span>Current activity</span><strong>${active ? "Drawing analysis running" : "Idle"}</strong></div><div class="spec-ai-status-card"><span>Review method</span><strong>Local visual AI + OCR + rules</strong></div></div><div class="spec-ai-pipeline"><strong>How Peer Review works</strong><div class="spec-ai-pipeline-steps"><div class="spec-ai-pipeline-step"><b>1. Read</b>OCR reads image-only title blocks.</div><div class="spec-ai-pipeline-step"><b>2. Analyze</b>Local visual AI examines enlarged drawing regions, tables, callouts, and annotations.</div><div class="spec-ai-pipeline-step"><b>3. Verify</b>Rule checks compare readable values, then every result waits for engineer review.</div></div></div><p class="spec-ai-status-note"><strong>Privacy:</strong> Drawing images are processed by the Local AI service running on this computer, not a public AI website.</p><p class="spec-ai-status-next"><strong>Review boundary:</strong> Local AI finds visible, mundane inconsistencies. It does not certify the design or replace engineering review.</p>`;
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

function getPeerKnowledgePrompt() {
  let optional = "";
  try { optional = localStorage.getItem(PEER_KNOWLEDGE_KEY) || ""; } catch {}
  let general = "";
  try { general = localStorage.getItem(COMPANY_AI_GENERAL_GUIDANCE_KEY) || ""; } catch {}
  let acceptedTerms = [];
  try { acceptedTerms = JSON.parse(localStorage.getItem(COMPANY_AI_ACCEPTED_TERMS_KEY) || "[]"); } catch {}
  const acceptedText = Array.isArray(acceptedTerms) ? acceptedTerms.filter(item => item.status !== "Warning").map(item => `${item.type || "Company Knowledge"}: ${item.text || ""}`).join("\n").slice(0, 16000) : "";
  return `${PEER_BUILT_IN_KNOWLEDGE}${general.trim() ? `\n\nGENERAL COMPANY AI GUIDANCE SHARED WITH SPECIFICATION:\n${general.trim().slice(0, 16000)}` : ""}${acceptedText ? `\n\nACCEPTED COMPANY KNOWLEDGE SHARED WITH SPECIFICATION:\n${acceptedText}` : ""}${optional.trim() ? `\n\nAPPROVED PEER REVIEW EXAMPLES:\n${optional.trim().slice(0, 12000)}` : ""}`;
}

async function openPeerSourceLibrary() {
  document.getElementById("peerSourceLibraryModal")?.classList.remove("hidden");
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
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Log in through Database first.");
    const servedLocally = (location.hostname === "127.0.0.1" || location.hostname === "localhost") && location.port === "4173";
    const format = { type: "object", properties: { status: { type: "string", enum: ["Saved", "Warning"] }, type: { type: "string", enum: ["Terminology", "System Fundamental", "Company Rule", "Known Exception", "Needs Clarification"] }, normalizedText: { type: "string" }, message: { type: "string" } }, required: ["status", "type", "normalizedText", "message"] };
    const response = await fetch(`${servedLocally ? "" : "http://127.0.0.1:4173"}/api/local-ai`, { method: "POST", ...(servedLocally ? {} : { targetAddressSpace: "loopback" }), headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ messages: [{ role: "system", content: "Review proposed reusable company knowledge for N/S Corporation vehicle-wash Specification and Peer Review tools. Save clear general terminology, system fundamentals, established company rules, and explicit known exceptions. Interpret ordinary engineering intent charitably. Do not rewrite, grammar-correct, rephrase, expand, or normalize the user's statement; normalizedText must reproduce the user's text exactly. In particular, distinguish equipment capability from simultaneous operation: a tank type that may be designated for either reclaimed-water service or fresh-water service does not imply that one installed tank mixes, switches between, or simultaneously serves both systems. Warn only when a material ambiguity remains that would change engineering meaning, or when the statement is contradictory, unsafe, unsupported, or project-specific. Keep message concise and useful. Do not invent facts. Return JSON only." }, { role: "user", content: text }], format, numCtx: 4096, maxTokens: 450 }) });
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
      await putPeerKnowledgeSource({ id: crypto.randomUUID(), name: file.name, category, status: "Approved", addedAt: new Date().toISOString(), size: file.size, chunks });
      added += 1;
    } catch (error) {
      if (status) status.textContent = `${file.name} was not added: ${error.message}`;
    }
  }
  document.getElementById("peerKnowledgeFiles").value = "";
  if (status && added) status.textContent = `${added} source${added === 1 ? "" : "s"} added and available to Local AI.`;
  await renderPeerKnowledgeSources();
}

async function extractPeerKnowledgeChunks(file) {
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
  if (!/\.(?:txt|md|csv)$/i.test(file.name)) throw new Error("Choose a PDF, TXT, MD, or CSV file.");
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
  try { sources = (await getAllPeerKnowledgeSources()).filter(source => source.status === "Approved"); } catch { return "No approved company knowledge sources were retrieved."; }
  if (!sources.length) return "No approved company knowledge sources have been added.";
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
    const citation = `[Source: ${source.name}${chunk.page ? `, page ${chunk.page}` : ""}; Category: ${source.category}]`;
    excerpts.push(`${citation}\n${text}`); used += citation.length + text.length;
  });
  return excerpts.length ? excerpts.join("\n\n") : "Approved sources exist, but no readable excerpts were available.";
}

function newPeerReview(type) {
  const now = new Date().toISOString();
  return { id: peerId("review"), type, project: "", filename: "", reviewer: peerCurrentUser, createdAt: now, updatedAt: now, status: "In Progress", pages: [], equipmentRows: [], findings: [], checklist: [], fixStates: {}, history: [{ action: "Review created", user: peerCurrentUser, date: now }] };
}

function startPeerReview(type) {
  if (!PEER_REVIEW_TYPES[type]?.available) return;
  peerReview = newPeerReview(type); peerPdfDocument = null;
  document.getElementById("peerReviewLanding").classList.add("hidden");
  document.getElementById("peerWorkspace").classList.remove("hidden");
  document.getElementById("peerPdfUpload").value = "";
  document.getElementById("peerUploadStatus").textContent = "Choose a PDF to begin.";
  renderPeerSummary(); renderPeerPages(); renderPeerEquipmentTable(); renderPeerFindings(); renderPeerChecklist(); renderPeerFixList(); showPeerStep("setup");
}

function peerIncludesEquipmentReview() {
  return Boolean(peerReview && peerReview.type !== "initial");
}

async function openPeerReview(id) {
  const stored = readPeerReviews().find(review => review.id === id);
  if (!stored) return showPeerToast("That saved review could not be found.");
  peerReview = stored; peerPdfDocument = null;
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
  zone.addEventListener("drop", event => handlePeerPdf(event.dataTransfer.files?.[0]));
  zone.addEventListener("click", event => {
    if (event.target.closest("label, input, button")) return;
    document.getElementById("peerPdfUpload").click();
  });
}

async function handlePeerPdf(file) {
  if (!peerReview || !file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setPeerStatus("Choose a PDF file.", true);
  setPeerStatus(`Reading ${file.name} locally...`);
  try {
    peerReview.filename = file.name; peerReview.pages = []; peerReview.equipmentRows = []; peerReview.findings = [];
    await loadPeerPdfDocument(file, true); await savePeerPdf(peerReview.id, file);
    peerReview.updatedAt = new Date().toISOString(); renderPeerSummary(); renderPeerPages(); renderPeerEquipmentTable(); savePeerReview(false); showPeerStep("pages");
    setPeerStatus(`${file.name} loaded. ${peerReview.pages.length} page${peerReview.pages.length === 1 ? "" : "s"} ready for review.`);
  } catch (error) {
    const message = /password|encrypted/i.test(error?.message || "") ? "This PDF is encrypted. Remove the password and try again." : /InvalidPDF|invalid pdf/i.test(error?.message || "") ? "This PDF appears corrupted or is not a valid PDF." : `The PDF could not be read: ${error?.message || "Unknown error"}`;
    setPeerStatus(message, true);
  }
}

async function loadPeerPdfDocument(file, extractPages) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  peerPdfDocument = await pdfjsLib.getDocument({ data: bytes }).promise;
  if (!peerPdfDocument.numPages) throw new Error("This PDF is empty.");
  if (!extractPages) return;
  for (let number = 1; number <= peerPdfDocument.numPages; number += 1) {
    setPeerStatus(`Reading page ${number} of ${peerPdfDocument.numPages}...`);
    const page = await peerPdfDocument.getPage(number); const content = await page.getTextContent();
    const text = content.items.map(item => `${item.str}${item.hasEOL ? "\n" : " "}`).join("").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
    peerReview.pages.push(analyzePeerPage(number, text, peerPdfDocument.numPages));
  }
}

function analyzePeerPage(number, text, totalPages = 0) {
  const flattened = String(text || "").replace(/[–—−]/g, "-").replace(/\s+/g, " ");
  const drawingMatch = flattened.match(/(?:DRAWING|DWG\.?)\s*(?:NO\.?|NUMBER|#)?\s*[:#-]?\s*([A-Z]{1,5}\s*-\s*[0-9IO]{1,4}(?:[.,][0-9IO]{1,3})?)/i)
    || flattened.match(/\b(W[S5]\s*-\s*[0-9IO]{1,4}(?:[.,][0-9IO]{1,3})?)\b/i);
  const projectMatch = flattened.match(/(?:PROJECT|PROJ\.?|JOB)\s*(?:NO\.?|NUMBER|#)?\s*[:#-]?\s*([0-9IOS]{3,6})\b/i);
  const sheetMatch = flattened.match(/\b([0-9IO]{1,3})\s+(?:OF|\/)\s+([0-9IO]{1,3})\b/i);
  const titleMatch = flattened.match(/\bTITLE\s*:\s*([A-Z0-9][A-Z0-9 &/().,'-]{2,70}?)(?=\s+(?:PROJECT|DRAWING|REV(?:ISION)?|SCALE|DATE)\b|$)/i);
  const pageRegex = new RegExp(`(?:PAGE|SHEET)\\s*(?:NO\\.?|NUMBER|#)?\\s*[:#-]?\\s*${number}\\b|\\b${number}\\s*(?:OF|/)\\s*${totalPages || "\\d+"}\\b`, "i");
  return { number, category: "Drawing", text, tableTypes: detectPeerTableTypes(flattened), blank: text.length < 8, drawingNumber: normalizePeerOcrIdentifier(drawingMatch?.[1] || ""), projectNumber: normalizePeerOcrDigits(projectMatch?.[1] || ""), sheetNumber: Number(normalizePeerOcrDigits(sheetMatch?.[1] || "0")), sheetTotal: Number(normalizePeerOcrDigits(sheetMatch?.[2] || "0")), sheetTitle: titleMatch?.[1]?.trim() || "", pageNumberDetected: pageRegex.test(flattened) || Boolean(sheetMatch), fingerprint: normalizePeerValue(text.slice(0, 1200)).slice(0, 500) };
}

function detectPeerTableTypes(text = "") { const value = String(text).toUpperCase(), types = []; if (/EQUIPMENT LIST[^\n]{0,80}(?:SUPPLIED BY NS|TO BE SUPPLIED BY NS)/.test(value)) types.push("Main Equipment List"); if (/POWER REQUIREMENT/.test(value)) types.push("Power Requirement"); if (/CONNECTIONS? TABLE/.test(value)) types.push("Connections"); if (/FITTINGS?.{0,20}VALVES?.{0,20}COMPONENTS?/.test(value)) types.push("Fittings Valves Components"); if (/NOZZLE SCHEDULE/.test(value)) types.push("Nozzle Schedule"); if (/GENERAL NOTES?/.test(value)) types.push("General Notes"); return types.length ? types : ["Other"]; }

function normalizePeerOcrDigits(value) { return String(value).toUpperCase().replace(/[O]/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/[^0-9]/g, ""); }
function normalizePeerOcrIdentifier(value) {
  const match = String(value).toUpperCase().replace(/[–—−]/g, "-").replace(/\s+/g, "").match(/^([A-Z]{1,5})-(.+)$/); if (!match) return "";
  let suffix = match[2].replace(/O/g, "0").replace(/[IL]/g, "1").replace(/,/g, ".");
  if (/^\d+-\d+$/.test(suffix)) suffix = suffix.replace(/-(\d+)$/, ".$1");
  return `${match[1].replace(/5/g, "S")}-${suffix}`;
}

async function renderPeerPages() {
  const grid = document.getElementById("peerPageGrid"); if (!grid || !peerReview) return;
  grid.replaceChildren();
  if (!peerReview.pages.length) { grid.innerHTML = "<p>Upload a PDF to display its pages.</p>"; return; }
  for (const info of peerReview.pages) {
    const card = document.createElement("article"); card.className = "peer-page-card"; card.id = `peer-page-${info.number}`;
    const preview = document.createElement("div"); preview.className = "peer-page-preview"; preview.textContent = "Loading preview...";
    const label = document.createElement("label"); label.textContent = peerIncludesEquipmentReview() ? `Page ${info.number} type` : `Page ${info.number} · Drawing`;
    if (peerIncludesEquipmentReview()) {
      const select = document.createElement("select"); PEER_PAGE_CATEGORIES.forEach(category => select.add(new Option(category, category)));
      select.value = info.category || "Drawing"; select.addEventListener("change", () => { info.category = select.value; info.categoryManuallySet = true; extractPeerEquipmentRows(); savePeerReview(false); });
      label.append(select);
    }
    card.append(preview, label); grid.appendChild(card); renderPeerPageCanvas(info.number, preview);
  }
}

async function renderPeerPageCanvas(number, target) {
  if (!peerPdfDocument) { target.textContent = "Preview available when the saved PDF is loaded."; return; }
  try { const page = await peerPdfDocument.getPage(number); const viewport = page.getViewport({ scale: 0.48 }); const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height; await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise; target.replaceChildren(canvas); }
  catch { target.textContent = "Preview unavailable."; }
}

function extractPeerEquipmentRows() {
  if (!peerIncludesEquipmentReview()) return;
  const visualRows = peerReview.equipmentRows.filter(row => row.source === "visual-ai");
  peerReview.equipmentRows = visualRows;
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
  head.innerHTML = `<tr><th>Page</th>${fields.map(([, label]) => `<th>${escapePeerHTML(label)}</th>`).join("")}<th></th></tr>`;
  body.innerHTML = peerReview.equipmentRows.map(row => `<tr><td>${row.page || "-"}</td>${fields.map(([field]) => `<td><input value="${escapePeerHTML(row[field] || "")}" onchange="updatePeerEquipmentRow('${row.id}','${field}',this.value)" aria-label="${field}"></td>`).join("")}<td><button class="delete-btn" onclick="deletePeerEquipmentRow('${row.id}')">Remove</button></td></tr>`).join("") || `<tr><td colspan="${fields.length + 2}">No equipment rows extracted yet.</td></tr>`;
  hint.textContent = peerReview.pages.some(page => page.category === "Equipment" && !page.text) ? "Some Equipment pages have no selectable text. Run OCR on the PDF before validation, then upload it again." : "Extraction uses selectable PDF text and may need manual cleanup. Original page text remains unchanged.";
}

function addPeerEquipmentRow() { if (!peerReview) return; peerReview.equipmentRows.push({ id: peerId("equip"), page: 0, tag: "", presentColumns: PEER_EQUIPMENT_FIELDS.map(item => item[0]) }); renderPeerEquipmentTable(); }
function updatePeerEquipmentRow(id, field, value) { const row = peerReview?.equipmentRows.find(item => item.id === id); if (!row) return; row[field] = value; if (!row.presentColumns.includes(field)) row.presentColumns.push(field); }
function deletePeerEquipmentRow(id) { peerReview.equipmentRows = peerReview.equipmentRows.filter(row => row.id !== id); renderPeerEquipmentTable(); }

async function runPeerChecks() {
  if (!peerReview?.pages.length) return showPeerToast("Upload a PDF before running checks.");
  if (peerOcrRunning) return showPeerToast("Text recognition is already running.");
  if (!await updatePeerAiIndicator()) {
    openPeerAiStatus();
    return showPeerToast(peerAiStatus.authenticated ? "Local AI must be connected before running checks." : "Sign in through Database before running checks.");
  }
  startPeerAnalysisTimer("Starting automatic review. Looking for readable page text and image-only title blocks.");
  setPeerCheckButtonsDisabled(true);
  try {
    const imageOnlyPages = peerReview.pages.filter(page => (!page.text?.trim() || page.ocrApplied) && page.ocrVersion !== 2);
    if (imageOnlyPages.length) {
      try { await recognizePeerTitleBlocks(imageOnlyPages); }
      catch (error) {
        setPeerAnalysisProgress("running", `Title-block OCR is unavailable, so the review is continuing with Local Visual AI. ${error.message || "Image-only title-block values may need manual confirmation."}`);
      }
    }
    recordPeerAnalysisMessage("Reviewing the clean drawing independently. Existing reviewer annotations are not required or expected.");
    const visualFindings = await runPeerVisualReview();
    reconcilePeerTitleBlockMetadata();
    setPeerAnalysisProgress("running", "Checking routine drawing details: drawing numbers, project numbers, sheet sequence, page totals, and naming patterns.");
    if (peerIncludesEquipmentReview()) extractPeerEquipmentRows();
    const manual = peerReview.findings.filter(item => item.source === "manual");
    const naming = runPeerNamingConventionRules(peerReview.pages, peerReview.filename);
    const equipmentReadiness = peerIncludesEquipmentReview() && peerReview.pages.some(page => page.visualEquipmentTableDetected || page.category === "Equipment") ? getPeerEquipmentReadinessFindings() : [];
    const completeness = runPeerDocumentCompletenessRules();
    const ruleEquipmentRows = peerReview.equipmentRows.filter(row => row.source !== "visual-ai");
    const automatic = peerIncludesEquipmentReview()
      ? [...runPeerInitialRules(peerReview.pages), ...runPeerEquipmentRules(ruleEquipmentRows), ...runPeerEquipmentNamingRules(ruleEquipmentRows), ...naming, ...equipmentReadiness, ...completeness, ...visualFindings]
      : [...runPeerInitialRules(peerReview.pages), ...naming, ...completeness, ...visualFindings];
    const uniqueAutomatic = Array.from(new Map(automatic.map(item => [`${item.issue}|${item.page}|${item.equipmentTag}|${item.listValue}|${item.comparedValue}|${item.details}`, item])).values());
    peerReview.findings = [...uniqueAutomatic, ...manual]; peerReview.history.push({ action: "Automatic checks run", user: peerCurrentUser, date: new Date().toISOString() });
    renderPeerFindings(); renderPeerFixList(); savePeerReview(false); showPeerStep("findings");
    const recognized = peerReview.pages.filter(page => page.ocrApplied).length;
    setPeerAnalysisProgress("complete", `Automatic review complete. ${recognized ? `${recognized} image-only page${recognized === 1 ? "" : "s"} read. ` : ""}${uniqueAutomatic.length} item${uniqueAutomatic.length === 1 ? "" : "s"} need review.`);
    showPeerToast(`${uniqueAutomatic.length} potential inconsistenc${uniqueAutomatic.length === 1 ? "y" : "ies"} found.`);
  } catch (error) {
    console.error("Peer Review checks failed:", error);
    setPeerAnalysisProgress("error", `Automatic review stopped. ${error.message || "The review could not be completed. Try again."}`);
  } finally {
    stopPeerAnalysisTimer();
    setPeerCheckButtonsDisabled(false);
  }
}

function runPeerDocumentCompletenessRules() {
  const findings = [], rows = peerReview.equipmentRows.filter(row => row.sourceTable === "Main Equipment List"), callouts = peerReview.pages.flatMap(page => (page.visualCallouts || []).map(callout => ({ ...callout, page: page.number })));
  const matches = (row, callout) => { const rowTag = normalizePeerValue(row.tag, "tag"), calloutTag = normalizePeerValue(callout.tag, "tag"); return Boolean(rowTag && calloutTag && rowTag === calloutTag) || peerEquipmentNamesEquivalent(row.description, callout.name); };
  const mainRows = rows.filter(isPeerMajorEquipmentRow);
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
  const trustedProjects = peerReview.pages.filter(page => Number(page.metadataConfidence || 0) >= 0.72 && /^\d{4}$/.test(String(page.projectNumber || ""))).map(page => page.projectNumber);
  if (!trustedProjects.length) return;
  const counts = trustedProjects.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map());
  const dominantProject = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  peerReview.pages.forEach(page => {
    if (dominantProject && (Number(page.metadataConfidence || 0) < 0.72 || !/^\d{4}$/.test(String(page.projectNumber || "")))) page.projectNumber = dominantProject;
    if (page.drawingNumber) page.drawingNumber = normalizePeerOcrIdentifier(page.drawingNumber);
  });
}

async function runPeerVisualReview() {
  const findings = [];
  peerReview.equipmentRows = peerReview.equipmentRows.filter(row => row.source !== "visual-ai");
  for (let index = 0; index < peerReview.pages.length; index += 1) {
    const info = peerReview.pages[index];
    setPeerAnalysisProgress("running", `Visually reviewing page ${info.number} (${index + 1} of ${peerReview.pages.length}). Independently checking drawing notes, callouts, schedules, dimensions, quantities, and coordination issues.`);
    try {
      const detailedRegions = await renderPeerAnalysisRegions(info.number), regionResults = [], incompleteRegions = [];
      setPeerAnalysisProgress("running", `Reviewing both halves of page ${info.number} together. Comparing tables, plan views, elevations, dimensions, and equipment counts across the page.`);
      try {
        regionResults.push(await requestPeerVisualAnalysis(info.number, detailedRegions));
      } catch (combinedError) {
        if (/sign in|could not be reached/i.test(combinedError.message)) throw combinedError;
        recordPeerAnalysisMessage(`Combined page ${info.number} review could not finish; retrying each half separately.`, true);
        for (let regionIndex = 0; regionIndex < detailedRegions.length; regionIndex += 1) {
          const regionLabel = regionIndex ? "right" : "left";
          setPeerAnalysisProgress("running", `Fallback review of the ${regionLabel} half of page ${info.number} (${regionIndex + 1} of ${detailedRegions.length}).`);
          try { regionResults.push(await requestPeerVisualAnalysis(info.number, detailedRegions[regionIndex], 1)); }
          catch (retryError) {
            incompleteRegions.push(regionLabel);
            recordPeerAnalysisMessage(`${regionLabel[0].toUpperCase()}${regionLabel.slice(1)} half of page ${info.number} could not be completed; manual review is required for that area.`, true);
          }
        }
      }
      if (!regionResults.length) throw new Error("Local visual AI returned incomplete review information.");
      let result = mergePeerVisualRegionResults(regionResults);
      if (!filterPeerVisualFindings(result.findings || []).length) {
        try {
          setPeerAnalysisProgress("running", `Page ${info.number} returned no findings. Rechecking once with the committed review logic.`);
          regionResults.push(await requestPeerVisualAnalysis(info.number, detailedRegions, 1));
          result = mergePeerVisualRegionResults(regionResults);
        } catch (emptyRetryError) {
          recordPeerAnalysisMessage(`The zero-finding recheck could not finish on page ${info.number}; the completed first pass was retained.`, true);
        }
      }
      result.equipmentRows = [];
      result.pageType = "Drawing";
      try {
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
        if (focusedRows.length) {
          result.equipmentRows = focusedRows;
          result.pageType = "Drawing with Equipment Table";
          result.tableTypes = Array.from(new Set([...(result.tableTypes || []), "Main Equipment List"]));
        }
      } catch (equipmentError) {
        recordPeerAnalysisMessage(`The focused equipment-list crop could not be fully read on page ${info.number}; that page was not used as an equipment table.`, true);
      }
      info.visualReviewed = true;
      info.visualReviewComplete = incompleteRegions.length === 0;
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
      if (titleConfidence >= 0.72 && /^\d{4}$/.test(visualProjectNumber)) info.projectNumber = visualProjectNumber;
      if (titleConfidence >= 0.72 && result.sheetNumber) info.sheetNumber = Number(result.sheetNumber);
      if (titleConfidence >= 0.72 && result.sheetTotal) info.sheetTotal = Number(result.sheetTotal);
      if (titleConfidence >= 0.72) info.metadataConfidence = titleConfidence;
      if (info.sheetNumber) info.pageNumberDetected = true;
      const hasEquipmentTable = result.pageType === "Equipment Table" || result.pageType === "Drawing with Equipment Table";
      info.visualEquipmentTableDetected = hasEquipmentTable;
      info.tableTypes = Array.from(new Set([...(info.tableTypes || []), ...(result.tableTypes || [])]));
      info.visualCallouts = result.callouts || [];
      info.unresolvedLabels = result.unresolvedLabels || [];
      if (hasEquipmentTable && !info.categoryManuallySet) info.category = "Equipment";
      (result.equipmentRows || []).forEach(row => {
        if (row.sourceTable !== "Main Equipment List" || !isPeerMainEquipmentTableTitle(row.tableTitle)) return;
        if (!String(row.tag || row.description || "").trim()) return;
        const rowKey = `${info.number}|${normalizePeerValue(row.tag, "tag")}|${normalizePeerEquipmentName(row.description)}`;
        if (peerReview.equipmentRows.some(existing => existing.visualRowKey === rowKey)) return;
        peerReview.equipmentRows.push({ id: peerId("equip"), page: info.number, tag: row.tag || "", description: row.description || "", presentColumns: ["tag", "description"], source: "visual-ai", sourceTable: row.sourceTable, tableTitle: row.tableTitle, visualRowKey: rowKey });
      });
      filterPeerVisualFindings(result.findings || []).forEach(item => findings.push(createPeerFinding({
        severity: item.confidence < 0.78 ? "Manual Review" : item.severity === "Manual Review" && item.evidenceType === "Explicit reviewer correction" ? "Warning" : item.severity,
        issue: getPeerVisualFindingIssue(item),
        details: item.evidenceType === "Explicit reviewer correction"
          ? `Detected from a visible reviewer annotation.${item.location ? ` Location: ${item.location}.` : ""}`
          : `${item.evidence}${item.location ? ` Location: ${item.location}.` : ""} Evidence: ${item.evidenceType}.`,
        page: info.number,
        source: "visual-ai",
        confidence: item.confidence
      })));
      const acceptedCount = filterPeerVisualFindings(result.findings || []).length;
      recordPeerAnalysisMessage(`Page ${info.number} visual review ${incompleteRegions.length ? "partially completed" : "completed"} with ${acceptedCount} potential item${acceptedCount === 1 ? "" : "s"} across all confidence levels.`);
    } catch (error) {
      console.warn(`Visual review failed for page ${info.number}:`, error);
      recordPeerAnalysisMessage(`Page ${info.number} visual review could not finish: ${error.message}`, true);
      findings.push(createPeerFinding({ severity: "Manual Review", issue: "Visual drawing review could not be completed for this page", details: error.message, page: info.number, source: "visual-ai" }));
    }
  }
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

function filterPeerVisualFindings(items) {
  const allowedTypes = new Set(["Unresolved placeholder", "Objective visible mismatch", "Required reference missing"]);
  return items.filter(item => {
    if (!item || !String(item.issue || "").trim()) return false;
    item.confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
    if (item.evidenceType === "Explicit reviewer correction" || item.existingCommentVisible) return false;
    if (!allowedTypes.has(item.evidenceType)) item.evidenceType = "Objective visible mismatch";
    const combined = `${item.issue || ""} ${item.evidence || ""} ${item.location || ""}`;
    const claimsMissingCallout = /not called out|no corresponding callout|missing equipment callout|equipment item is listed|no corresponding equipment (?:label|identifier)|no matching row|no corresponding row|no specific callouts?/i.test(combined);
    // Regional requests cannot prove document-wide absence. The deterministic
    // completeness pass evaluates merged main-list rows and callouts instead.
    if (claimsMissingCallout) return false;
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

async function requestPeerVisualAnalysis(pageNumber, imageInput, retryAttempt = 0) {
  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in with the Database login to run visual drawing checks.");
  const servedLocally = (location.hostname === "127.0.0.1" || location.hostname === "localhost") && location.port === "4173";
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 120000);
  const images = Array.isArray(imageInput) ? imageInput : [imageInput];
  const sourceKnowledge = await buildPeerKnowledgeContext(pageNumber);
  const prompt = `Review page ${pageNumber} of this clean, unannotated N/S Corporation engineering drawing for potential mundane drafting and coordination errors at every confidence level.${images.length > 1 ? " The supplied images are overlapping regions of the same page; combine their evidence and do not duplicate findings." : " Inspect the complete visible page."} Review geometry, labels, notes, dimensions, equipment tables, quantities, callouts, and the title block.

Perform the review independently. No reviewer comments, redlines, corrected revision, or answer key will be supplied. You are creating the proposed review annotations from the original drawing. Retain only issues supported by explicit visible evidence: an unresolved UNKNOWN/TBD/placeholder, an objective visible mismatch between two readable values/callouts, a quantity or equipment-count mismatch between a table and the plan/elevation views, a conflicting dimension between views, a missing clearance or access dimension explicitly required by a visible note or approved company knowledge, or a required reference explicitly demanded by a readable note but absent from the same visible region. Write each issue as a concise, actionable proposed annotation and state the exact visible evidence and location. Do not decide that equipment is missing from the drawing; a separate document-wide rule performs that check after all regions and pages are merged.

Systematic original-drawing checks: compare quantities and distinct equipment shown across the formal equipment list, plan, elevation, and detail views; compare repeated dimensions and elevations wherever they describe the same object; check that labeled tanks, pumps, panels, and other major equipment are represented consistently across views; check whether readable installation/access notes require a clearance or dimension that is not shown; and identify leaders, labels, or callouts that point ambiguously or contradict another visible value. Do not invent a requirement merely because a drawing could contain more detail.

Response priorities: return at most six findings, ranked by visible evidence strength. Prefer a smaller set with exact quoted values, object names, and locations over a long list. Every finding must explain (1) what is visibly wrong, (2) the two conflicting values or the explicit requirement and missing reference, (3) where each piece of evidence appears, and (4) the concise annotation a reviewer should place on the drawing. Include evidence-based coordination concerns at confidence 0.35 or higher as Manual Review when the conflict is visible but its intended correction is uncertain. Do not default to an empty findings array merely because an issue is not certain; use honest lower confidence. Still exclude hypothetical requirements and all schedule-row missing-callout claims.

Extract every legible formal main-equipment row and numbered main-equipment callout, but do not turn either extraction into a missing-equipment finding. Return every other genuinely visible potential issue even when confidence is low; assign an honest confidence from 0.01 to 1 so the user can decide, and never omit an issue solely because confidence is below a threshold. Do not report capitalization, spacing, alignment, wording style, or table formatting unless a supplied written convention is visibly violated. A circled flow-line number refers to its Connections Table row and does not need to repeat the pipe or tube size beside the circle. Anchor-bolt requirements, conduit/cable schedules, parts lists, fittings/valves/components tables, power tables, legends, and general notes do not require every row or referenced item to have an independent layout callout. General responsibility notes do not require every referenced connection, fitting, conduit, J-box, or termination to be drawn on the same sheet. A model number or part number is valid supporting text, not evidence that the equipment name is missing. Do not infer design correctness, code compliance, hidden connections, or conflicts between unrelated tables. Extracted equipment rows and callouts are data, not findings.

Finding quality rules: Return each underlying issue exactly once. Never return a finding that says the table is hypothetical, not present, would need to be checked, cannot be verified, or would only be an issue if something existed. When the formal main equipment list is not visibly present in the supplied page images, do not invent its rows or create missing-equipment findings for that page. Evidence for each equipment item must come from that item's own visible row and its own callout search; never reuse a note about one item as evidence for a different item. A parts-list fastener, washer, screw, shaft, or other assembly component does not require an independent equipment callout. Do not report parts-list rows as missing equipment. Low confidence means uncertain visible evidence, not hypothetical evidence.

Legend and note safeguards: A Plumbing Legend defines available symbols and does not require every symbol type to appear in the current drawing. Never report a missing reference merely because a legend entry has no visible use. Flow Notes and General Notes may describe operation or installation without requiring a separately tagged object on the same sheet. Report a note-related missing reference only when the note explicitly commands that a specific detail, connection, or item must be shown on this drawing.

Classify the page as Equipment Table or Drawing with Equipment Table only when a formal main project equipment list is visible. A Fittings / Valves / Components Table, nozzle schedule, connection schedule, parts list, anchor-bolt table, power table, or conduit schedule is an Other Table and does not make the page an Equipment Table. Extract equipmentRows only from the formal main equipment list titled EQUIPMENT LIST - TO BE SUPPLIED BY NS, set sourceTable to Main Equipment List, copy that exact visible heading into tableTitle, and use the complete sub-item identifier such as 6A or 6B rather than the repeated parent item number 6. For description, copy only the short value from the column headed PART / ITEM DESCRIPTION, such as BRUSH SYSTEM PACKAGE, 5HP RECLAIM SYSTEM, or RO CONSOLE. Never copy the long paragraph from the NS EQUIPMENT DETAILS / DESCRIPTION column into description. For every other table set sourceTable to Other Table and its actual heading in tableTitle; do not return its rows. Never extract quantities, line numbers, fitting tags such as TBF1, nozzle types, anchor-bolt rows, or schedule rows as equipment tags. If no main equipment list is present, return an empty equipmentRows array. Do not create missing-equipment findings during this regional visual pass. Match extraction data by either its identifier or an unambiguous equipment name: a visibly labeled 2HP RO PUMP corresponds to a 2HP RO PUMP AND STAND row even when a model number is also present.

Return tableTypes for every visible table using only the supplied categories. Return callouts only for numbered main-equipment callouts in the drawing area, with a numeric tag such as 6, 6A, or 18 and its equipment name. Do not return fittings, valves, instruments, connection identifiers, table rows, or component tags such as TBF2, BV4, UN2, SV1, PG1, PR1, CV1, BH2, or SBA1 as main-equipment callouts. Return unresolvedLabels for every visible UNKNOWN, TBD, TBC, repeated question mark, or explicit placeholder. These arrays are extraction data for deterministic document-wide checks, not findings by themselves.

Use the following approved peer-review examples as judgment guidance. Follow IGNORE EXAMPLE entries as carefully as finding examples. Never copy their project-specific facts into this drawing:
${getPeerKnowledgePrompt()}

${PEER_ENGINEER_REVIEW_PATTERNS}

APPROVED COMPANY KNOWLEDGE EXCERPTS:
${sourceKnowledge}

Knowledge safeguards: Only the excerpts above marked Source are approved library material. Use them only when visibly applicable to this drawing. If a finding relies on an excerpt, include its exact [Source: ...] label in evidence. Never turn a typical arrangement into a requirement unless the source explicitly states it is required. If sources conflict, report Needs Clarification in the evidence instead of choosing one silently. Project-specific names, quantities, dimensions, and part numbers from a knowledge source must never be copied into this project unless the drawing itself confirms them.

Also transcribe the title-block drawing number, project number, sheet number, and total exactly when visible and provide titleBlockConfidence from 0 to 1; otherwise return empty strings, 0, and low confidence. Return JSON only.${retryAttempt ? " This is a compact regional retry. Return one complete JSON object immediately. Limit findings to the four strongest items. Include every required property; use empty strings, 0, false, or empty arrays when needed. Do not use markdown or explanatory text." : ""}`;
  let response;
  try {
    response = await fetch(`${servedLocally ? "" : "http://127.0.0.1:4173"}/api/local-ai`, { method: "POST", signal: controller.signal, ...(servedLocally ? {} : { targetAddressSpace: "loopback" }), headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ messages: [{ role: "system", content: "You are a conservative engineering drawing peer-review assistant. Review independently without relying on reviewer comments. Return every genuinely visible mundane issue with honest confidence, including uncertain visible issues at low confidence. Never return hypothetical, conditional, unverifiable, duplicated, or vague findings. Compare a formal main equipment list against drawing callouts only when that list is visible in the supplied images. Keep each finding's evidence tied to the exact item it describes. Extracted table rows are data, not errors." }, { role: "user", content: prompt, images }], format: PEER_VISUAL_REVIEW_SCHEMA, numCtx: images.length > 1 ? 12288 : 8192, maxTokens: 4096, retryAttempt }) });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Visual analysis exceeded the 120-second region limit.");
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
  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in with the Database login to run visual drawing checks.");
  const servedLocally = (location.hostname === "127.0.0.1" || location.hostname === "localhost") && location.port === "4173";
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
    response = await fetch(`${servedLocally ? "" : "http://127.0.0.1:4173"}/api/local-ai`, {
      method: "POST", signal: controller.signal, ...(servedLocally ? {} : { targetAddressSpace: "loopback" }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
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

async function requestPeerEquipmentExtraction(pageNumber, images = []) {
  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in with the Database login to read equipment tables.");
  const servedLocally = (location.hostname === "127.0.0.1" || location.hostname === "localhost") && location.port === "4173";
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
    response = await fetch(`${servedLocally ? "" : "http://127.0.0.1:4173"}/api/local-ai`, {
      method: "POST", signal: controller.signal, ...(servedLocally ? {} : { targetAddressSpace: "loopback" }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
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

function startPeerAnalysisTimer(message) {
  peerAnalysisStartedAt = performance.now(); peerAnalysisLastMessage = ""; peerAnalysisMessageCount = 0;
  setPeerAiIndicatorState("working");
  document.getElementById("peerAnalysisMessageHistory")?.replaceChildren();
  const elapsed = document.getElementById("peerAnalysisElapsed"); if (elapsed) elapsed.textContent = "0:00";
  clearInterval(peerAnalysisTimer); peerAnalysisTimer = setInterval(updatePeerAnalysisElapsed, 250);
  setPeerAnalysisProgress("running", message);
}

function stopPeerAnalysisTimer() {
  updatePeerAnalysisElapsed(); clearInterval(peerAnalysisTimer); peerAnalysisTimer = null; peerAnalysisStartedAt = 0;
  updatePeerAnalysisMessageSummary();
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
  root.classList.remove("hidden", "is-complete", "is-error");
  root.classList.toggle("is-complete", state === "complete"); root.classList.toggle("is-error", state === "error");
  const status = document.getElementById("peerAnalysisStatus");
  if (status) { status.textContent = message; status.classList.toggle("is-loading", state === "running"); status.classList.toggle("is-complete", state === "complete"); status.classList.toggle("is-error", state === "error"); }
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
  const equipmentPages = peerReview.pages.filter(page => page.category === "Equipment");
  if (!equipmentPages.length) return [createPeerFinding({ severity: "Manual Review", issue: "No equipment table was detected", details: "The visual review did not identify an equipment list or schedule. If one is present, use the page-type dropdown to mark that page as Equipment and run the checks again." })];
  if (!peerReview.equipmentRows.length) return [createPeerFinding({ severity: "Manual Review", issue: "No equipment rows could be extracted from the selected equipment page", details: "The selected table is image-based. Preview it to confirm the page selection; full equipment-table recognition is still needed before row-by-row naming checks can run.", page: equipmentPages[0].number })];
  return [];
}

function renderPeerFindings() {
  const body = document.getElementById("peerFindingsBody"); if (!body || !peerReview) return;
  const search = String(document.getElementById("peerFindingSearch")?.value || "").trim().toLowerCase();
  const severity = document.getElementById("peerFindingSeverity")?.value || "all";
  const status = document.getElementById("peerFindingStatus")?.value || "all";
  const counts = peerReview.findings.reduce((result, item) => { result[item.severity] = (result[item.severity] || 0) + 1; result.open += ["Open", "In Progress", "Needs Clarification"].includes(item.status) ? 1 : 0; return result; }, { open: 0 });
  document.getElementById("peerFindingCount").textContent = `(${peerReview.findings.length})`;
  const summary = document.getElementById("peerFindingSummary");
  if (summary) summary.innerHTML = `<span><strong>${counts.open}</strong> unresolved</span><span><strong>${counts.Error || 0}</strong> errors</span><span><strong>${counts.Warning || 0}</strong> warnings</span><span><strong>${counts["Manual Review"] || 0}</strong> manual review</span>`;
  const displayed = peerReview.findings.filter(item => {
    if (severity !== "all" && item.severity !== severity) return false;
    if (status !== "all" && item.status !== status) return false;
    return !search || `${item.issue} ${item.equipmentTag} ${item.listValue} ${item.comparedValue} ${item.page}`.toLowerCase().includes(search);
  });
  body.innerHTML = displayed.map((item, index) => `<article class="peer-finding-card"><header class="peer-finding-card-head"><div class="peer-finding-identity"><span class="peer-finding-number">${index + 1}</span><div><span class="peer-severity ${item.severity.toLowerCase().replace(/\s/g, "-")}">${escapePeerHTML(item.severity)}</span>${item.confidence !== null && item.confidence !== undefined && Number.isFinite(Number(item.confidence)) ? `<span class="peer-confidence ${Number(item.confidence) >= .92 ? "high" : Number(item.confidence) < .78 ? "low" : "supported"}">${Number(item.confidence) < .78 ? "Low · " : ""}${Math.round(Number(item.confidence) * 100)}% confidence</span>` : item.source === "visual-ai" ? `<span class="peer-confidence low">AI coverage issue</span>` : item.source !== "manual" ? `<span class="peer-confidence rule" title="Rule checks do not have a model confidence score. Confirm the extracted source values in the redline view.">Rule check · confirm source</span>` : ""}${item.equipmentTag ? `<span class="peer-equipment-tag">${escapePeerHTML(item.equipmentTag)}</span>` : ""}</div></div><label class="peer-finding-status"><span>Status</span><select onchange="updatePeerFindingStatus('${item.id}',this.value)">${PEER_FINDING_STATUSES.map(value => `<option${value === item.status ? " selected" : ""}>${value}</option>`).join("")}</select></label></header><div class="peer-finding-content"><h3>${escapePeerHTML(item.issue)}</h3>${item.details ? `<p class="peer-finding-explanation">${escapePeerHTML(item.details)}</p>` : ""}${item.listValue || item.comparedValue ? `<div class="peer-value-compare"><div><small>Equipment table</small><strong>${escapePeerHTML(item.listValue || "Not provided")}</strong></div><span class="peer-compare-arrow" aria-hidden="true">→</span><div><small>Drawing / compared source</small><strong>${escapePeerHTML(item.comparedValue || "Not provided")}</strong></div></div>` : ""}</div><footer class="peer-finding-card-actions">${item.page ? `<span class="peer-finding-page-label">Page ${item.page}</span>` : `<span></span>`}<button class="secondary" onclick="openPeerComments('${item.id}')">${item.comments.length ? `${item.comments.length} comment${item.comments.length === 1 ? "" : "s"}` : "Add comment"}</button></footer></article>`).join("") || '<div class="peer-empty-findings"><strong>No findings match this view.</strong><span>Run automatic checks or clear the filters.</span></div>';
  Array.from(body.querySelectorAll(":scope > .peer-finding-card")).forEach((card, index) => {
    const item = displayed[index], footer = card.querySelector(".peer-finding-card-actions");
    if (!item || !footer) return;
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
    if (item.page) footer.insertAdjacentHTML("beforeend", `<button class="${item.annotationAccepted ? "" : "secondary"} peer-redline-button" onclick="openPeerRedlinePreview('${item.id}')">${item.annotationAccepted ? "Edit accepted redline" : "Create redline"}</button>`);
  });
  organizePeerFindingGroups(body, displayed);
}

function getPeerFindingReliability(item) { if (item.source === "manual") return "Manual Comments"; if (item.confidence !== null && item.confidence !== undefined && Number(item.confidence) < .5) return "Possible Findings"; if (["visual-ai", "red-markup-ocr"].includes(item.source)) return "Visual Review"; return "Rule-Based Checks"; }
function organizePeerFindingGroups(body, displayed) { if (!body || !displayed.length) return; const cards = Array.from(body.querySelectorAll(":scope > .peer-finding-card")), order = ["Confirmed PDF Comments", "Rule-Based Checks", "Visual Review", "Possible Findings", "Manual Comments"], groups = new Map(); displayed.forEach((item, index) => { const label = getPeerFindingReliability(item); if (!groups.has(label)) groups.set(label, []); if (cards[index]) groups.get(label).push(cards[index]); }); body.replaceChildren(); order.forEach(label => { const items = groups.get(label); if (!items?.length) return; const section = document.createElement("section"); section.className = `peer-finding-group${label === "Possible Findings" ? " is-possible" : ""}`; section.innerHTML = `<div class="peer-finding-group-heading"><strong>${escapePeerHTML(label)}</strong><span>${items.length} item${items.length === 1 ? "" : "s"}</span></div>`; items.forEach(card => section.appendChild(card)); body.appendChild(section); }); }

function updatePeerFindingStatus(id, status) { const item = peerReview.findings.find(finding => finding.id === id); if (!item) return; item.status = status; item.history.push({ action: `Status changed to ${status}`, user: peerCurrentUser, date: new Date().toISOString() }); if (status === "Fixed") recordPeerResolution(item); renderPeerFindings(); renderPeerFixList(); savePeerReview(false); }
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
  const quotedSubject = String(item.details || "").match(/['"]([^'"]{3,80})['"]/)?.[1] || "";
  const subject = getPeerEquipmentShortDescription(item.listValue || item.comparedValue || quotedSubject || item.equipmentTag || "THIS ITEM").toUpperCase();
  if (/placeholder/i.test(item.issue) && item.comparedValue) return `REPLACE "${item.comparedValue}" WITH FINAL PROJECT VALUE.`;
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

async function openPeerRedlinePreview(id) {
  const item = peerReview?.findings.find(finding => finding.id === id);
  const modal = document.getElementById("peerRedlineModal"), root = document.getElementById("peerRedlineCanvasRoot"), input = document.getElementById("peerRedlineText");
  if (!item?.page || !modal || !root || !input) return showPeerToast("A page number is required before creating a redline.");
  peerActiveRedlineFinding = id;
  input.value = getPeerSuggestedAnnotation(item);
  document.getElementById("peerRedlineTitle").textContent = `Page ${item.page} redline preview`;
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
    base.getContext("2d").drawImage(canvas, 0, 0);
    peerRedlinePreviewCanvas = canvas; peerRedlinePreviewBase = base;
    canvas.addEventListener("click", event => {
      const rect = canvas.getBoundingClientRect();
      item.annotationX = Math.max(0.01, Math.min(0.94, (event.clientX - rect.left) / rect.width));
      item.annotationY = Math.max(0.01, Math.min(0.94, (event.clientY - rect.top) / rect.height));
      refreshPeerRedlinePreview();
    });
    root.replaceChildren(canvas);
    refreshPeerRedlinePreview();
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
  const fontSize = Math.max(9, Math.min(14, Math.round(canvas.width / 225))); context.font = `700 ${fontSize}px Arial`;
  const maxWidth = Math.min(canvas.width * 0.19, 250), lines = wrapPeerCanvasText(context, input.value, maxWidth - 12);
  if (!lines.length) lines.push("ENTER REVIEW COMMENT");
  const lineHeight = Math.round(fontSize * 1.18), boxWidth = Math.max(88, Math.min(maxWidth, Math.max(...lines.map(line => context.measureText(line).width), 76) + 12));
  const boxHeight = Math.max(25, lines.length * lineHeight + 10);
  const x = Math.min(canvas.width - boxWidth - 6, Math.max(6, item.annotationX * canvas.width));
  const y = Math.min(canvas.height - boxHeight - 6, Math.max(6, item.annotationY * canvas.height));
  context.fillStyle = "rgba(255,255,255,.92)"; context.fillRect(x, y, boxWidth, boxHeight);
  context.strokeStyle = "#e00000"; context.lineWidth = Math.max(1.5, fontSize / 8); context.strokeRect(x, y, boxWidth, boxHeight);
  context.fillStyle = "#d40000"; lines.forEach((line, index) => context.fillText(line, x + 7, y + 6 + lineHeight * (index + 0.78)));
}

function acceptAllPeerFindings() {
  if (!peerReview) return;
  const items = peerReview.findings.filter(item => ["Open", "In Progress", "Needs Clarification"].includes(item.status));
  if (!items.length) return showPeerToast("There are no unresolved findings to accept.");
  const date = new Date().toISOString();
  items.forEach(item => {
    item.status = "Accepted";
    item.history.push({ action: "Finding accepted", user: peerCurrentUser, date, note: "Accepted from the Findings list." });
  });
  peerReview.history.push({ action: `${items.length} findings accepted`, user: peerCurrentUser, date });
  savePeerReview(false);
  renderPeerFindings();
  renderPeerFixList();
  showPeerToast(`${items.length} finding${items.length === 1 ? "" : "s"} accepted. Redlines can still be reviewed individually.`);
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

function renderPeerChecklist() {
  const root = document.getElementById("peerChecklist"); if (!root || !peerReview) return;
  root.innerHTML = peerReview.checklist.map(item => `<div class="peer-check-row"><div><strong>${escapePeerHTML(item.title)}</strong><textarea placeholder="Comments" onchange="updatePeerChecklist('${item.id}','comments',this.value)">${escapePeerHTML(item.comments)}</textarea></div><select onchange="updatePeerChecklist('${item.id}','response',this.value)"><option value="">Select response</option>${PEER_CHECKLIST_RESPONSES.map(value => `<option${value === item.response ? " selected" : ""}>${value}</option>`).join("")}</select></div>`).join("");
}
function updatePeerChecklist(id, field, value) { const item = peerReview.checklist.find(check => check.id === id); if (!item) return; item[field] = value; item.history.push({ action: `${field} updated`, value, user: peerCurrentUser, date: new Date().toISOString() }); renderPeerFixList(); savePeerReview(false); }

function getPeerFixItems() {
  if (!peerReview) return [];
  const active = new Set(["Open", "In Progress", "Needs Clarification"]);
  const findings = peerReview.findings.filter(item => active.has(item.status) || peerReview.fixStates[item.id]).map(item => ({ id: item.id, title: item.issue, tag: item.equipmentTag, description: [item.listValue, item.comparedValue].filter(Boolean).join(" → "), page: item.page, severity: item.severity, sourceStatus: item.status, comments: item.comments.map(comment => comment.text).join("; ") }));
  return findings;
}

function renderPeerFixList() {
  const root = document.getElementById("peerFixList"); if (!root || !peerReview) return;
  const search = (document.getElementById("peerFixSearch")?.value || "").toLowerCase(), filter = document.getElementById("peerFixFilter")?.value || "all", sort = document.getElementById("peerFixSort")?.value || "page";
  let items = getPeerFixItems().filter(item => `${item.title} ${item.tag} ${item.description} ${item.comments}`.toLowerCase().includes(search));
  items = items.filter(item => filter === "all" || (peerReview.fixStates[item.id]?.status || "Not Started") === filter);
  const severityOrder = { Error: 0, Warning: 1, "Manual Review": 2 }; items.sort((a, b) => sort === "severity" ? (severityOrder[a.severity] - severityOrder[b.severity]) : sort === "status" ? (peerReview.fixStates[a.id]?.status || "").localeCompare(peerReview.fixStates[b.id]?.status || "") : (a.page || 9999) - (b.page || 9999));
  root.innerHTML = items.map(item => {
    const state = peerReview.fixStates[item.id] || { status: "Not Started", notes: "", history: [] };
    return `<article class="peer-fix-item ${state.status === "Fixed" ? "is-fixed" : ""}"><input type="checkbox" aria-label="${state.status === "Fixed" ? "Undo resolved item" : "Resolve item"}" ${state.status === "Fixed" ? "checked" : ""} onchange="togglePeerFixResolution('${item.id}',this.checked)"><div><strong>${escapePeerHTML(item.title)}</strong><p>${item.tag ? `<b>${escapePeerHTML(item.tag)}</b> · ` : ""}${escapePeerHTML(item.description || "Review and resolve this item.")}${item.page ? ` · <button class="peer-page-link" onclick="jumpPeerPage(${item.page})">Page ${item.page}</button>` : ""}</p><small>${escapePeerHTML(item.severity)} · Source status: ${escapePeerHTML(item.sourceStatus)} · Fix status: ${escapePeerHTML(state.status)}</small>${state.notes ? `<p class="peer-fix-note"><b>Resolution:</b> ${escapePeerHTML(state.notes)}</p>` : ""}</div></article>`;
  }).join("") || "<p>No items match this view.</p>";
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
function recordPeerResolution(item) { item.history.push({ action: "Resolved", user: peerCurrentUser, date: new Date().toISOString(), note: item.resolutionNote || "" }); }

function savePeerReview(showToast = true) {
  if (!peerReview) return; peerReview.reviewer = peerCurrentUser; peerReview.updatedAt = new Date().toISOString();
  const reviews = readPeerReviews().filter(item => item.id !== peerReview.id); reviews.unshift(peerReview);
  const retained = reviews.slice(0, PEER_HISTORY_LIMIT), removed = reviews.slice(PEER_HISTORY_LIMIT);
  while (retained.length) {
    try { localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(retained)); break; }
    catch (error) {
      if (!isPeerStorageFullError(error) || retained.length === 1) { if (showToast) showPeerToast("This review could not be saved locally."); return; }
      removed.push(retained.pop());
    }
  }
  removed.forEach(item => deletePeerPdf(item.id).catch(() => {}));
  if (showToast) showPeerToast(`Review saved locally. Keeping the latest ${retained.length} of ${PEER_HISTORY_LIMIT}.`);
  renderPeerSummary(); updatePeerStorageStatus();
}
function completePeerReview() {
  if (!peerReview) return;
  const unresolved = peerReview.findings.filter(item => !["Accepted", "Closed", "False Positive"].includes(item.status)).length;
  peerReview.status = "Complete";
  peerReview.completedAt = new Date().toISOString();
  peerReview.history.push({ action: "Review marked complete", user: peerCurrentUser, date: peerReview.completedAt, note: unresolved ? `${unresolved} finding${unresolved === 1 ? "" : "s"} remained open.` : "All findings were resolved." });
  savePeerReview(false);
  renderPeerSummary();
  showPeerToast(unresolved ? `Review marked complete. ${unresolved} finding${unresolved === 1 ? "" : "s"} remain open.` : "Review marked complete. All findings are resolved.");
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
  await deletePeerPdf(id); renderPeerSavedReviews();
}

async function clearPeerReviewHistory() {
  const reviews = readPeerReviews(); if (!reviews.length) return;
  if (!window.confirm("Remove all saved peer reviews and their PDFs from this browser?")) return;
  localStorage.removeItem(PEER_STORAGE_KEY);
  await Promise.all(reviews.map(item => deletePeerPdf(item.id).catch(() => {}))); renderPeerSavedReviews();
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
function renderPeerSummary() { if (!peerReview) return; document.getElementById("peerReviewTypeBadge").textContent = PEER_REVIEW_TYPES[peerReview.type].label; document.getElementById("peerReviewTitle").textContent = peerReview.filename || "New Review"; document.getElementById("peerReviewMeta").textContent = `${peerReview.filename || "No PDF uploaded"} · ${peerCurrentUser} · ${new Date(peerReview.createdAt).toLocaleDateString()} · ${peerReview.status}`; }

function populatePeerFixFilter() { const select = document.getElementById("peerFixFilter"); PEER_FIX_STATUSES.forEach(status => select?.add(new Option(status, status))); }
function populatePeerFindingFilter() { const select = document.getElementById("peerFindingStatus"); PEER_FINDING_STATUSES.forEach(status => select?.add(new Option(status, status))); }

function openPeerExportModal() { if (!peerReview) return; document.getElementById("peerExportModal").classList.remove("hidden"); }
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

async function exportAcceptedPeerRedlines() {
  if (!peerReview) return;
  const accepted = peerReview.findings.filter(item => item.annotationAccepted && item.annotationText && item.page);
  if (!accepted.length) return showPeerToast("Accept at least one redline before downloading the marked PDF.");
  try {
    const file = await getPeerPdf(peerReview.id);
    if (!file) throw new Error("The saved original PDF is unavailable.");
    const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer()), font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    accepted.forEach(item => {
      const page = doc.getPages()[item.page - 1]; if (!page) return;
      const { width, height } = page.getSize(), size = Math.max(5.5, Math.min(8, width / 135)), maxWidth = Math.min(width * .21, 165);
      const lines = wrapPeerPdfText(font, item.annotationText, size, maxWidth - 14), lineHeight = size * 1.25;
      const boxWidth = Math.max(72, Math.min(maxWidth, Math.max(...lines.map(line => font.widthOfTextAtSize(line, size)), 62) + 10));
      const boxHeight = Math.max(19, lines.length * lineHeight + 8);
      const x = Math.min(width - boxWidth - 5, Math.max(5, Number(item.annotationX || .08) * width));
      const y = Math.min(height - boxHeight - 5, Math.max(5, height - Number(item.annotationY || .1) * height - boxHeight));
      page.drawRectangle({ x, y, width: boxWidth, height: boxHeight, color: PDFLib.rgb(1, 1, 1), opacity: .9, borderColor: PDFLib.rgb(.88, 0, 0), borderWidth: 1.5 });
      lines.forEach((line, index) => page.drawText(line, { x: x + 7, y: y + boxHeight - 8 - size - index * lineHeight, size, font, color: PDFLib.rgb(.84, 0, 0) }));
    });
    const bytes = await doc.save();
    downloadPeerFile(bytes, `${(peerReview.filename || "Peer Review").replace(/\.pdf$/i, "")} - Accepted Redlines.pdf`, "application/pdf");
    closePeerModal("peerExportModal");
  } catch (error) { showPeerToast(error.message || "The accepted redline PDF could not be created."); }
}

function peerExportBaseName() { return `${(peerReview.filename || "Peer Review").replace(/\.pdf$/i, "")} - ${PEER_REVIEW_TYPES[peerReview.type].label}`.replace(/[\\/:*?"<>|]/g, "-"); }
function downloadPeerFile(data, filename, type) { const url = URL.createObjectURL(new Blob([data], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function openPeerPdfDB() { return new Promise((resolve, reject) => { const request = indexedDB.open(PEER_PDF_DB, 2); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(PEER_PDF_STORE)) request.result.createObjectStore(PEER_PDF_STORE); if (!request.result.objectStoreNames.contains(PEER_KNOWLEDGE_STORE)) request.result.createObjectStore(PEER_KNOWLEDGE_STORE, { keyPath: "id" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
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
async function putPeerKnowledgeSource(source) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_KNOWLEDGE_STORE, "readwrite"); tx.objectStore(PEER_KNOWLEDGE_STORE).put(source); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }
async function getPeerKnowledgeSource(id) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const request = db.transaction(PEER_KNOWLEDGE_STORE).objectStore(PEER_KNOWLEDGE_STORE).get(id); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
async function getAllPeerKnowledgeSources() { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const request = db.transaction(PEER_KNOWLEDGE_STORE).objectStore(PEER_KNOWLEDGE_STORE).getAll(); request.onsuccess = () => { db.close(); resolve((request.result || []).sort((left, right) => String(right.addedAt).localeCompare(String(left.addedAt)))); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
async function deletePeerKnowledgeSource(id) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_KNOWLEDGE_STORE, "readwrite"); tx.objectStore(PEER_KNOWLEDGE_STORE).delete(id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; }); }

function setPeerStatus(message, error = false) { const status = document.getElementById("peerUploadStatus"); if (status) { status.textContent = message; status.classList.toggle("is-error", error); } }
function showPeerToast(message) { const toast = document.getElementById("peerToast"); toast.textContent = message; toast.classList.remove("hidden"); clearTimeout(showPeerToast.timer); showPeerToast.timer = setTimeout(() => toast.classList.add("hidden"), 3200); }
function formatPeerDate(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString() : ""; }
function escapePeerHTML(value = "") { return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
