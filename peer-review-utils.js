/* Pure helpers and rule definitions for the local Peer Review workflow. */
const PEER_REVIEW_TYPES = Object.freeze({
  initial: { label: "Initial Review", available: true },
  equipment: { label: "Equipment Review", available: true },
  electrical: { label: "Electrical Review", available: false },
  plumbing: { label: "Plumbing Review", available: false }
});

const PEER_PAGE_CATEGORIES = Object.freeze(["Drawing", "Equipment", "Electrical", "Plumbing"]);
const PEER_FINDING_STATUSES = Object.freeze([
  "Open", "In Progress", "Fixed", "Accepted", "False Positive",
  "Needs Clarification", "Not Applicable"
]);
const PEER_CHECKLIST_RESPONSES = Object.freeze(["Pass", "Fail", "Not Applicable", "Needs Discussion"]);
const PEER_FIX_STATUSES = Object.freeze(["Not Started", "In Progress", "Fixed", "Needs Clarification", "Not Applicable"]);
const PEER_EQUIPMENT_FIELDS = Object.freeze([
  ["tag", "Equipment Tag"], ["description", "Description"], ["quantity", "Quantity"],
  ["manufacturer", "Manufacturer"], ["modelNumber", "Model Number"], ["partNumber", "Part Number"],
  ["voltage", "Voltage"], ["phase", "Phase"], ["horsepower", "Horsepower"],
  ["amperage", "Amperage"], ["flowRate", "Flow Rate"], ["pressure", "Pressure"],
  ["pipeSize", "Pipe Size"], ["connectionSize", "Connection Size"]
]);

function peerId(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePeerHeader(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mapPeerEquipmentHeader(value = "") {
  const header = normalizePeerHeader(value);
  const aliases = {
    tag: ["equipment tag", "equip tag", "tag", "equipment id", "unit tag"],
    description: ["description", "equipment description", "service"],
    quantity: ["quantity", "qty", "count"], manufacturer: ["manufacturer", "mfr", "make"],
    modelNumber: ["model number", "model no", "model", "model #"],
    partNumber: ["part number", "part no", "part", "part #", "pn"],
    voltage: ["voltage", "volts", "volt", "v"], phase: ["phase", "ph"],
    horsepower: ["horsepower", "hp"], amperage: ["amperage", "amps", "amp", "fla"],
    flowRate: ["flow rate", "flow", "gpm", "cfm"], pressure: ["pressure", "psi", "head"],
    pipeSize: ["pipe size", "line size"], connectionSize: ["connection size", "conn size", "connection"]
  };
  return Object.entries(aliases).find(([, names]) => names.includes(header))?.[0] || "";
}

function normalizePeerValue(value = "", field = "") {
  let normalized = String(value).trim().toUpperCase()
    .replace(/[–—]/g, "-").replace(/\s+/g, " ")
    .replace(/\bHORSE\s*POWER\b/g, "HP")
    .replace(/\bAMPERES?\b/g, "A").replace(/\bVOLTS?\b/g, "V")
    .replace(/\bTHREE[ -]?PHASE\b|\b3[ -]?PHASE\b/g, "3PH")
    .replace(/\bSINGLE[ -]?PHASE\b|\b1[ -]?PHASE\b/g, "1PH")
    .replace(/\bINCH(?:ES)?\b/g, "IN");
  if (field === "tag" || field === "modelNumber" || field === "partNumber") {
    return normalized.replace(/[\s-]+/g, "");
  }
  normalized = normalized.replace(/(\d+)\.0+(?=\D|$)/g, "$1");
  return normalized.replace(/\s*(V|A|HP|PH|PSI|GPM|CFM|IN)\b/g, "$1");
}

function peerValuesEquivalent(left, right, field = "") {
  return normalizePeerValue(left, field) === normalizePeerValue(right, field);
}

function createPeerFinding(data = {}) {
  return {
    id: data.id || peerId("finding"), severity: data.severity || "Warning",
    equipmentTag: data.equipmentTag || "", issue: data.issue || "Potential inconsistency",
    listValue: data.listValue || "", comparedValue: data.comparedValue || "",
    page: Number(data.page || 0), status: data.status || "Open",
    comments: Array.isArray(data.comments) ? data.comments : [],
    resolutionNote: data.resolutionNote || "", history: Array.isArray(data.history) ? data.history : [],
    source: data.source || "automatic", createdAt: data.createdAt || new Date().toISOString()
  };
}

function findDuplicatePeerValues(values, normalizer = value => normalizePeerValue(value)) {
  const groups = new Map();
  values.forEach((value, index) => {
    const key = normalizer(value);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });
  return Array.from(groups.values()).filter(indices => indices.length > 1);
}

function runPeerInitialRules(pages = []) {
  const findings = [];
  const drawingNumbers = pages.map(page => page.drawingNumber || "");
  const projectNumbers = pages.map(page => page.projectNumber || "").filter(Boolean);
  pages.forEach(page => {
    if (page.blank) findings.push(createPeerFinding({ severity: "Warning", issue: "Potential inconsistency: page appears blank", page: page.number }));
    if (!page.text?.trim()) findings.push(createPeerFinding({ severity: "Manual Review", issue: "Potential inconsistency: page has no selectable text and may require OCR", page: page.number }));
    if (!page.drawingNumber) findings.push(createPeerFinding({ severity: "Warning", issue: "Potential inconsistency: missing drawing number", page: page.number }));
    if (!page.projectNumber) findings.push(createPeerFinding({ severity: "Warning", issue: "Potential inconsistency: missing project number", page: page.number }));
    if (!page.pageNumberDetected) findings.push(createPeerFinding({ severity: "Warning", issue: "Potential inconsistency: missing page number", page: page.number }));
  });
  findDuplicatePeerValues(drawingNumbers).forEach(indices => indices.forEach(index => findings.push(createPeerFinding({
    severity: "Error", issue: "Potential inconsistency: duplicate drawing number", comparedValue: drawingNumbers[index], page: pages[index].number
  }))));
  findDuplicatePeerValues(pages.map(page => page.fingerprint), value => value).forEach(indices => indices.slice(1).forEach(index => findings.push(createPeerFinding({
    severity: "Warning", issue: "Potential inconsistency: page content appears duplicated", page: pages[index].number
  }))));
  if (new Set(projectNumbers.map(value => normalizePeerValue(value, "tag"))).size > 1) {
    projectNumbers.forEach(value => findings.push(createPeerFinding({ severity: "Error", issue: "Potential inconsistency: project number differs between pages", comparedValue: value })));
  }
  return findings;
}

function runPeerEquipmentRules(rows = []) {
  const findings = [];
  rows.forEach(row => {
    if (!String(row.tag || "").trim()) findings.push(createPeerFinding({ severity: "Error", issue: "Potential inconsistency: missing equipment tag", page: row.page }));
    const presentFields = Object.keys(row).filter(key => !["id", "page", "source", "compareTo"].includes(key) && row[key] !== "");
    const emptyPresentColumns = (row.presentColumns || []).filter(key => key !== "tag" && !String(row[key] || "").trim());
    if (emptyPresentColumns.length) findings.push(createPeerFinding({ severity: "Warning", equipmentTag: row.tag, issue: `Potential inconsistency: incomplete equipment list fields (${emptyPresentColumns.map(key => PEER_EQUIPMENT_FIELDS.find(item => item[0] === key)?.[1] || key).join(", ")})`, page: row.page }));
    if (!presentFields.length) return;
    const comparison = row.compareTo || {};
    Object.keys(comparison).forEach(field => {
      if (!row.presentColumns?.includes(field) || !String(row[field] || "").trim() || !String(comparison[field] || "").trim()) return;
      if (peerValuesEquivalent(row[field], comparison[field], field)) return;
      const label = PEER_EQUIPMENT_FIELDS.find(item => item[0] === field)?.[1] || field;
      findings.push(createPeerFinding({ severity: "Error", equipmentTag: row.tag, issue: `Potential inconsistency: ${label.toLowerCase()} mismatch`, listValue: row[field], comparedValue: comparison[field], page: row.page }));
    });
  });
  findDuplicatePeerValues(rows.map(row => row.tag), value => normalizePeerValue(value, "tag")).forEach(indices => indices.forEach(index => findings.push(createPeerFinding({
    severity: "Error", equipmentTag: rows[index].tag, issue: "Potential inconsistency: duplicate equipment tag", page: rows[index].page
  }))));
  return findings;
}

if (typeof module !== "undefined") module.exports = { normalizePeerHeader, mapPeerEquipmentHeader, normalizePeerValue, peerValuesEquivalent, findDuplicatePeerValues, runPeerInitialRules, runPeerEquipmentRules };
