/* Local, rule-based Peer Review workflow. No drawing data leaves the browser. */
const PEER_STORAGE_KEY = "ns-peer-reviews-v1";
const PEER_PROJECT_KEYS = ["ns-projects", "projects", "savedProjects", "submittalProjects", "spec-projects-v1"];
const PEER_PDF_DB = "NSPeerReviewStorage";
const PEER_PDF_STORE = "reviewPdfs";
let peerReview = null;
let peerPdfDocument = null;
let peerActiveCommentFinding = "";
let peerCurrentUser = "Local reviewer";

const PEER_INITIAL_CHECKLIST = ["Drawing information appears complete.", "Title blocks are complete.", "Drawing numbers appear correct.", "Pages are readable.", "General comments."];
const PEER_EQUIPMENT_CHECKLIST = ["Equipment tags appear consistent.", "Manufacturer information appears correct.", "Model numbers appear correct.", "Quantities appear correct.", "Equipment descriptions appear complete.", "No obvious inconsistencies remain.", "Additional comments."];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("peerPdfUpload")?.addEventListener("change", event => handlePeerPdf(event.target.files?.[0]));
  setupPeerDropZone(); populatePeerProjects(); populatePeerFixFilter(); renderPeerSavedReviews();
  window.addEventListener("ns-auth-session-changed", event => {
    const user = event.detail?.user;
    peerCurrentUser = user?.user_metadata?.full_name || user?.email || "Local reviewer";
    if (peerReview) renderPeerSummary();
  });
});

function newPeerReview(type) {
  const now = new Date().toISOString();
  const checklist = (type === "equipment" ? PEER_EQUIPMENT_CHECKLIST : PEER_INITIAL_CHECKLIST).map(title => ({ id: peerId("check"), title, response: "", comments: "", history: [] }));
  return { id: peerId("review"), type, project: "", filename: "", reviewer: peerCurrentUser, createdAt: now, updatedAt: now, status: "In Progress", pages: [], equipmentRows: [], findings: [], checklist, fixStates: {}, history: [{ action: "Review created", user: peerCurrentUser, date: now }] };
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
  if (step === "equipment" && peerReview.type !== "equipment") step = "findings";
  document.querySelectorAll(".peer-step-panel").forEach(panel => panel.classList.toggle("hidden", panel.id !== `peerStep-${step}`));
  document.querySelectorAll("[data-peer-step]").forEach(button => { button.classList.toggle("active", button.dataset.peerStep === step); button.hidden = button.dataset.peerStep === "equipment" && peerReview.type !== "equipment"; });
  if (step === "fixes") renderPeerFixList();
}

function setupPeerDropZone() {
  const zone = document.getElementById("peerDropZone");
  if (!zone) return;
  ["dragenter", "dragover"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.remove("dragover"); }));
  zone.addEventListener("drop", event => handlePeerPdf(event.dataTransfer.files?.[0]));
  zone.addEventListener("click", () => document.getElementById("peerPdfUpload").click());
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
    peerReview.pages.push(analyzePeerPage(number, text));
  }
}

function analyzePeerPage(number, text) {
  const drawingMatch = text.match(/(?:DRAWING|DWG\.?|SHEET)\s*(?:NO\.?|NUMBER|#)?\s*[:#-]?\s*([A-Z]{0,4}[- ]?\d{2,}[A-Z0-9.-]*)/i);
  const projectMatch = text.match(/(?:PROJECT|PROJ\.?|JOB)\s*(?:NO\.?|NUMBER|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9 ._-]{2,20})/i);
  const pageRegex = new RegExp(`(?:PAGE|SHEET)\\s*(?:NO\\.?|NUMBER|#)?\\s*[:#-]?\\s*${number}\\b|\\b${number}\\s*(?:OF|/)\\s*\\d+\\b`, "i");
  return { number, category: "Drawing", text, blank: text.length < 8, drawingNumber: drawingMatch?.[1]?.trim() || "", projectNumber: projectMatch?.[1]?.trim() || "", pageNumberDetected: pageRegex.test(text), fingerprint: normalizePeerValue(text.slice(0, 1200)).slice(0, 500) };
}

async function renderPeerPages() {
  const grid = document.getElementById("peerPageGrid"); if (!grid || !peerReview) return;
  grid.replaceChildren();
  if (!peerReview.pages.length) { grid.innerHTML = "<p>Upload a PDF to display its pages.</p>"; return; }
  for (const info of peerReview.pages) {
    const card = document.createElement("article"); card.className = "peer-page-card"; card.id = `peer-page-${info.number}`;
    const preview = document.createElement("div"); preview.className = "peer-page-preview"; preview.textContent = "Loading preview...";
    const label = document.createElement("label"); label.textContent = `Page ${info.number} category`;
    const select = document.createElement("select"); PEER_PAGE_CATEGORIES.forEach(category => select.add(new Option(category, category)));
    select.value = info.category || "Drawing"; select.addEventListener("change", () => { info.category = select.value; if (peerReview.type === "equipment") extractPeerEquipmentRows(); savePeerReview(false); });
    label.append(select); card.append(preview, label); grid.appendChild(card); renderPeerPageCanvas(info.number, preview);
  }
}

async function renderPeerPageCanvas(number, target) {
  if (!peerPdfDocument) { target.textContent = "Preview available when the saved PDF is loaded."; return; }
  try { const page = await peerPdfDocument.getPage(number); const viewport = page.getViewport({ scale: 0.48 }); const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height; await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise; target.replaceChildren(canvas); }
  catch { target.textContent = "Preview unavailable."; }
}

function extractPeerEquipmentRows() {
  if (!peerReview || peerReview.type !== "equipment") return;
  const previous = new Map(peerReview.equipmentRows.map(row => [`${row.page}:${normalizePeerValue(row.tag, "tag")}`, row]));
  const rows = [];
  peerReview.pages.filter(page => page.category === "Equipment").forEach(page => {
    const lines = page.text.split(/\s{2,}|\n/).map(line => line.trim()).filter(Boolean);
    let headers = []; let headerIndex = -1;
    lines.some((line, index) => { const parts = line.split(/\t|\s{2,}|\|/).map(value => value.trim()); const mapped = parts.map(mapPeerEquipmentHeader); if (mapped.filter(Boolean).length >= 2) { headers = mapped; headerIndex = index; return true; } return false; });
    if (headerIndex >= 0) lines.slice(headerIndex + 1).forEach(line => {
      const cells = line.split(/\t|\s{2,}|\|/).map(value => value.trim()); if (cells.length < 2) return;
      const row = { id: peerId("equip"), page: page.number, presentColumns: headers.filter(Boolean) }; headers.forEach((field, index) => { if (field) row[field] = cells[index] || ""; });
      if (row.tag || Object.values(row).some(Boolean)) rows.push({ ...row, ...(previous.get(`${page.number}:${normalizePeerValue(row.tag, "tag")}`) || {}) });
    });
  });
  peerReview.equipmentRows = rows; attachPeerDrawingComparisons(); renderPeerEquipmentTable();
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

function runPeerChecks() {
  if (!peerReview?.pages.length) return showPeerToast("Upload a PDF before running checks.");
  if (peerReview.type === "equipment") extractPeerEquipmentRows();
  const manual = peerReview.findings.filter(item => item.source === "manual");
  const automatic = peerReview.type === "equipment" ? runPeerEquipmentRules(peerReview.equipmentRows) : runPeerInitialRules(peerReview.pages);
  peerReview.findings = [...automatic, ...manual]; peerReview.history.push({ action: "Automatic checks run", user: peerCurrentUser, date: new Date().toISOString() });
  renderPeerFindings(); renderPeerFixList(); savePeerReview(false); showPeerStep("findings"); showPeerToast(`${automatic.length} potential inconsistenc${automatic.length === 1 ? "y" : "ies"} found.`);
}

function renderPeerFindings() {
  const body = document.getElementById("peerFindingsBody"); if (!body || !peerReview) return;
  document.getElementById("peerFindingCount").textContent = `(${peerReview.findings.length})`;
  body.innerHTML = peerReview.findings.map(item => `<tr><td><span class="peer-severity ${item.severity.toLowerCase().replace(/\s/g, "-")}">${escapePeerHTML(item.severity)}</span></td><td>${escapePeerHTML(item.equipmentTag)}</td><td>${escapePeerHTML(item.issue)}</td><td>${escapePeerHTML(item.listValue)}</td><td>${escapePeerHTML(item.comparedValue)}</td><td>${item.page ? `<button class="peer-page-link" onclick="jumpPeerPage(${item.page})">${item.page}</button>` : "-"}</td><td><select onchange="updatePeerFindingStatus('${item.id}',this.value)">${PEER_FINDING_STATUSES.map(status => `<option${status === item.status ? " selected" : ""}>${status}</option>`).join("")}</select></td><td><button class="secondary" onclick="openPeerComments('${item.id}')">${item.comments.length ? `${item.comments.length} comment(s)` : "Add comment"}</button></td></tr>`).join("") || '<tr><td colspan="8">No findings yet. Run automatic checks or add a general comment.</td></tr>';
}

function updatePeerFindingStatus(id, status) { const item = peerReview.findings.find(finding => finding.id === id); if (!item) return; item.status = status; item.history.push({ action: `Status changed to ${status}`, user: peerCurrentUser, date: new Date().toISOString() }); if (status === "Fixed") recordPeerResolution(item); renderPeerFixList(); savePeerReview(false); }
function addPeerManualFinding() { if (!peerReview) return; const issue = window.prompt("General comment or issue:"); if (!issue?.trim()) return; peerReview.findings.push(createPeerFinding({ severity: "Manual Review", issue: issue.trim(), source: "manual" })); renderPeerFindings(); renderPeerFixList(); }
function jumpPeerPage(page) { showPeerStep("pages"); setTimeout(() => document.getElementById(`peer-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }

function renderPeerChecklist() {
  const root = document.getElementById("peerChecklist"); if (!root || !peerReview) return;
  root.innerHTML = peerReview.checklist.map(item => `<div class="peer-check-row"><div><strong>${escapePeerHTML(item.title)}</strong><textarea placeholder="Comments" onchange="updatePeerChecklist('${item.id}','comments',this.value)">${escapePeerHTML(item.comments)}</textarea></div><select onchange="updatePeerChecklist('${item.id}','response',this.value)"><option value="">Select response</option>${PEER_CHECKLIST_RESPONSES.map(value => `<option${value === item.response ? " selected" : ""}>${value}</option>`).join("")}</select></div>`).join("");
}
function updatePeerChecklist(id, field, value) { const item = peerReview.checklist.find(check => check.id === id); if (!item) return; item[field] = value; item.history.push({ action: `${field} updated`, value, user: peerCurrentUser, date: new Date().toISOString() }); renderPeerFixList(); savePeerReview(false); }

function getPeerFixItems() {
  if (!peerReview) return [];
  const active = new Set(["Open", "In Progress", "Needs Clarification"]);
  const findings = peerReview.findings.filter(item => active.has(item.status) || peerReview.fixStates[item.id]).map(item => ({ id: item.id, title: item.issue, tag: item.equipmentTag, description: [item.listValue, item.comparedValue].filter(Boolean).join(" → "), page: item.page, severity: item.severity, sourceStatus: item.status, comments: item.comments.map(comment => comment.text).join("; ") }));
  const checks = peerReview.checklist.filter(item => ["Fail", "Needs Discussion"].includes(item.response) || peerReview.fixStates[item.id]).map(item => ({ id: item.id, title: item.title, tag: "", description: item.comments, page: 0, severity: "Manual Review", sourceStatus: item.response, comments: item.comments }));
  return [...findings, ...checks];
}

function renderPeerFixList() {
  const root = document.getElementById("peerFixList"); if (!root || !peerReview) return;
  const search = (document.getElementById("peerFixSearch")?.value || "").toLowerCase(), filter = document.getElementById("peerFixFilter")?.value || "all", sort = document.getElementById("peerFixSort")?.value || "page";
  let items = getPeerFixItems().filter(item => `${item.title} ${item.tag} ${item.description} ${item.comments}`.toLowerCase().includes(search));
  items = items.filter(item => filter === "all" || (peerReview.fixStates[item.id]?.status || "Not Started") === filter);
  const severityOrder = { Error: 0, Warning: 1, "Manual Review": 2 }; items.sort((a, b) => sort === "severity" ? (severityOrder[a.severity] - severityOrder[b.severity]) : sort === "status" ? (peerReview.fixStates[a.id]?.status || "").localeCompare(peerReview.fixStates[b.id]?.status || "") : (a.page || 9999) - (b.page || 9999));
  root.innerHTML = items.map(item => { const state = peerReview.fixStates[item.id] || { status: "Not Started", notes: "", history: [] }; return `<article class="peer-fix-item ${state.status === "Fixed" ? "is-fixed" : ""}"><input type="checkbox" aria-label="Mark fixed" ${state.status === "Fixed" ? "checked" : ""} onchange="togglePeerFix('${item.id}',this.checked)"><div><strong>${escapePeerHTML(item.title)}</strong><p>${item.tag ? `<b>${escapePeerHTML(item.tag)}</b> · ` : ""}${escapePeerHTML(item.description || "Review and resolve this item.")}${item.page ? ` · <button class="peer-page-link" onclick="jumpPeerPage(${item.page})">Page ${item.page}</button>` : ""}</p><small>${escapePeerHTML(item.severity)} · Source status: ${escapePeerHTML(item.sourceStatus)}</small><textarea placeholder="Fix notes" onchange="updatePeerFix('${item.id}','notes',this.value)">${escapePeerHTML(state.notes || "")}</textarea></div><select onchange="updatePeerFix('${item.id}','status',this.value)">${PEER_FIX_STATUSES.map(status => `<option${status === state.status ? " selected" : ""}>${status}</option>`).join("")}</select></article>`; }).join("") || "<p>No items match this view.</p>";
}

function ensurePeerFixState(id) { return peerReview.fixStates[id] ||= { status: "Not Started", notes: "", history: [] }; }
function togglePeerFix(id, fixed) { updatePeerFix(id, "status", fixed ? "Fixed" : "Not Started"); renderPeerFixList(); }
function updatePeerFix(id, field, value) { const state = ensurePeerFixState(id); state[field] = value; state.history.push({ action: `${field} changed`, value, user: peerCurrentUser, date: new Date().toISOString() }); if (field === "status" && value === "Fixed") { state.fixedBy = peerCurrentUser; state.fixedAt = new Date().toISOString(); if (!state.notes) state.notes = window.prompt("Resolution note (optional):") || ""; } savePeerReview(false); if (field === "status") renderPeerFixList(); }

function openPeerComments(id) { peerActiveCommentFinding = id; const item = peerReview.findings.find(finding => finding.id === id); if (!item) return; document.getElementById("peerCommentTitle").textContent = item.issue; document.getElementById("peerCommentThread").innerHTML = item.comments.map(comment => `<div class="peer-comment"><strong>${escapePeerHTML(comment.user)}</strong><small>${formatPeerDate(comment.date)}</small>${comment.replyTo ? `<small>Reply to ${escapePeerHTML(comment.replyTo)}</small>` : ""}<p>${escapePeerHTML(comment.text)}</p><div class="button-row"><button class="secondary" onclick="editPeerComment('${comment.id}')">Edit</button><button class="secondary" onclick="replyPeerComment('${comment.id}')">Reply</button></div></div>`).join("") || "<p>No comments yet.</p>"; document.getElementById("peerCommentText").value = ""; document.getElementById("peerCommentText").dataset.replyTo = ""; document.getElementById("peerResolutionText").value = item.resolutionNote || ""; document.getElementById("peerCommentModal").classList.remove("hidden"); }
function savePeerComment() { const item = peerReview.findings.find(finding => finding.id === peerActiveCommentFinding); if (!item) return; const input = document.getElementById("peerCommentText"), text = input.value.trim(), resolution = document.getElementById("peerResolutionText").value.trim(); if (text) item.comments.push({ id: peerId("comment"), text, replyTo: input.dataset.replyTo || "", user: peerCurrentUser, date: new Date().toISOString() }); item.resolutionNote = resolution; savePeerReview(false); renderPeerFindings(); closePeerModal("peerCommentModal"); }
function editPeerComment(id) { const item = peerReview.findings.find(finding => finding.id === peerActiveCommentFinding), comment = item?.comments.find(entry => entry.id === id); if (!comment) return; const text = window.prompt("Edit comment:", comment.text); if (text === null || !text.trim()) return; comment.text = text.trim(); comment.editedAt = new Date().toISOString(); comment.editedBy = peerCurrentUser; savePeerReview(false); openPeerComments(peerActiveCommentFinding); }
function replyPeerComment(id) { const item = peerReview.findings.find(finding => finding.id === peerActiveCommentFinding), comment = item?.comments.find(entry => entry.id === id), input = document.getElementById("peerCommentText"); if (!comment || !input) return; input.dataset.replyTo = comment.user; input.placeholder = `Reply to ${comment.user}`; input.focus(); }
function closePeerModal(id) { document.getElementById(id)?.classList.add("hidden"); }
function recordPeerResolution(item) { item.history.push({ action: "Resolved", user: peerCurrentUser, date: new Date().toISOString(), note: item.resolutionNote || "" }); }

function savePeerReview(showToast = true) {
  if (!peerReview) return; peerReview.project = document.getElementById("peerProjectSelect")?.value || peerReview.project || ""; peerReview.reviewer = peerCurrentUser; peerReview.updatedAt = new Date().toISOString();
  const reviews = readPeerReviews().filter(item => item.id !== peerReview.id); reviews.unshift(peerReview); localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(reviews.slice(0, 50))); if (showToast) showPeerToast("Review saved locally."); renderPeerSummary();
}
function completePeerReview() { if (!peerReview) return; peerReview.status = "Complete"; peerReview.completedAt = new Date().toISOString(); peerReview.history.push({ action: "Review marked complete", user: peerCurrentUser, date: peerReview.completedAt }); savePeerReview(false); renderPeerSummary(); showPeerToast("Review marked complete. Open issues remain in the Fix List."); }
function readPeerReviews() { try { const reviews = JSON.parse(localStorage.getItem(PEER_STORAGE_KEY) || "[]"); return Array.isArray(reviews) ? reviews : []; } catch { return []; } }

function renderPeerSavedReviews() { const root = document.getElementById("peerSavedReviews"); if (!root) return; const reviews = readPeerReviews(); root.innerHTML = reviews.map(review => `<button class="peer-saved-item" onclick="openPeerReview('${review.id}')"><span><strong>${escapePeerHTML(review.project || review.filename || "Untitled review")}</strong><small>${escapePeerHTML(PEER_REVIEW_TYPES[review.type]?.label || review.type)} · ${formatPeerDate(review.updatedAt)}</small></span><span class="peer-badge">${escapePeerHTML(review.status)}</span></button>`).join("") || "<p>No saved reviews yet.</p>"; }
function renderPeerSummary() { if (!peerReview) return; document.getElementById("peerReviewTypeBadge").textContent = PEER_REVIEW_TYPES[peerReview.type].label; document.getElementById("peerReviewTitle").textContent = peerReview.project || peerReview.filename || "New Review"; document.getElementById("peerReviewMeta").textContent = `${peerReview.filename || "No PDF uploaded"} · ${peerCurrentUser} · ${new Date(peerReview.createdAt).toLocaleDateString()} · ${peerReview.status}`; document.getElementById("peerProjectSelect").value = peerReview.project || ""; }

function populatePeerProjects() { const select = document.getElementById("peerProjectSelect"); if (!select) return; const names = new Set(); PEER_PROJECT_KEYS.forEach(key => { try { const value = JSON.parse(localStorage.getItem(key) || "null"); const list = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : []; list.forEach(item => { const name = item?.projectName || item?.name || item?.project || item?.projectNumber; if (name) names.add(String(name)); }); } catch {} }); [...names].sort().forEach(name => select.add(new Option(name, name))); select.addEventListener("change", () => { if (peerReview) { peerReview.project = select.value; renderPeerSummary(); } }); }
function populatePeerFixFilter() { const select = document.getElementById("peerFixFilter"); PEER_FIX_STATUSES.forEach(status => select?.add(new Option(status, status))); }

function openPeerExportModal() { if (!peerReview) return; document.getElementById("peerExportModal").classList.remove("hidden"); }
function getPeerReportRows() { return peerReview.findings.map(item => ({ Severity: item.severity, "Equipment Tag": item.equipmentTag, Issue: item.issue, "Equipment List Value": item.listValue, "Compared Value": item.comparedValue, Page: item.page || "", Status: item.status, Comments: item.comments.map(comment => `${comment.user}: ${comment.text}`).join(" | "), "Resolution Note": item.resolutionNote })); }
function exportPeerExcel() { const workbook = XLSX.utils.book_new(); const summary = [{ Project: peerReview.project, Filename: peerReview.filename, "Review Type": PEER_REVIEW_TYPES[peerReview.type].label, Reviewer: peerReview.reviewer, Date: new Date(peerReview.createdAt).toLocaleDateString(), "Final Status": peerReview.status }]; XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Summary"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(getPeerReportRows()), "Findings"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(peerReview.checklist.map(item => ({ Item: item.title, Response: item.response, Comments: item.comments }))), "Checklist"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(getPeerFixItems().map(item => ({ ...item, ...(peerReview.fixStates[item.id] || {}) }))), "Fix List"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(peerReview.history), "History"); XLSX.writeFile(workbook, `${peerExportBaseName()}.xlsx`); closePeerModal("peerExportModal"); }
async function exportPeerPDF() { const doc = await PDFLib.PDFDocument.create(); const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold); let page, y; const addPage = () => { page = doc.addPage([612, 792]); y = 755; }; const line = (text, options = {}) => { const size = options.size || 9, max = options.max || 92; String(text || "").match(new RegExp(`.{1,${max}}(?:\\s|$)|\\S+`, "g"))?.forEach(part => { if (y < 45) addPage(); page.drawText(part.trim(), { x: options.x || 42, y, size, font: options.bold ? bold : font, color: PDFLib.rgb(0.12, 0.18, 0.23) }); y -= size + 4; }); }; addPage(); line("N/S Automation Peer Review Report", { size: 17, bold: true }); y -= 5; line(`Project: ${peerReview.project || "Not selected"}`); line(`Filename: ${peerReview.filename}`); line(`Review Type: ${PEER_REVIEW_TYPES[peerReview.type].label}`); line(`Reviewer: ${peerReview.reviewer}`); line(`Date: ${new Date(peerReview.createdAt).toLocaleDateString()}`); line(`Final Status: ${peerReview.status}`); y -= 10; line("Findings", { size: 13, bold: true }); getPeerReportRows().forEach((item, index) => { line(`${index + 1}. [${item.Severity}] ${item.Issue}`, { bold: true }); line(`Tag: ${item["Equipment Tag"] || "-"} | Page: ${item.Page || "-"} | Status: ${item.Status}`); line(`Values: ${item["Equipment List Value"] || "-"} / ${item["Compared Value"] || "-"}`); line(`Comments: ${item.Comments || "-"} | Resolution: ${item["Resolution Note"] || "-"}`); y -= 5; }); y -= 6; line("Checklist", { size: 13, bold: true }); peerReview.checklist.forEach(item => line(`${item.title} — ${item.response || "Not answered"}. ${item.comments}`)); y -= 6; line("Resolution History", { size: 13, bold: true }); peerReview.history.forEach(item => line(`${formatPeerDate(item.date)} — ${item.user}: ${item.action}${item.note ? ` — ${item.note}` : ""}`)); const bytes = await doc.save(); downloadPeerFile(bytes, `${peerExportBaseName()}.pdf`, "application/pdf"); closePeerModal("peerExportModal"); }
function peerExportBaseName() { return `${(peerReview.filename || "Peer Review").replace(/\.pdf$/i, "")} - ${PEER_REVIEW_TYPES[peerReview.type].label}`.replace(/[\\/:*?"<>|]/g, "-"); }
function downloadPeerFile(data, filename, type) { const url = URL.createObjectURL(new Blob([data], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function openPeerPdfDB() { return new Promise((resolve, reject) => { const request = indexedDB.open(PEER_PDF_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore(PEER_PDF_STORE); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function savePeerPdf(id, file) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const tx = db.transaction(PEER_PDF_STORE, "readwrite"); tx.objectStore(PEER_PDF_STORE).put(file, id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
async function getPeerPdf(id) { const db = await openPeerPdfDB(); return new Promise((resolve, reject) => { const request = db.transaction(PEER_PDF_STORE).objectStore(PEER_PDF_STORE).get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }

function setPeerStatus(message, error = false) { const status = document.getElementById("peerUploadStatus"); if (status) { status.textContent = message; status.classList.toggle("is-error", error); } }
function showPeerToast(message) { const toast = document.getElementById("peerToast"); toast.textContent = message; toast.classList.remove("hidden"); clearTimeout(showPeerToast.timer); showPeerToast.timer = setTimeout(() => toast.classList.add("hidden"), 3200); }
function formatPeerDate(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString() : ""; }
function escapePeerHTML(value = "") { return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
