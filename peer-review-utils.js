/* Pure helpers and rule definitions for the local Peer Review workflow. */
const PEER_REVIEW_TYPES = Object.freeze({
  overall: { label: "Overall Peer Review", available: true },
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
    details: data.details || "",
    page: Number(data.page || 0), status: data.status || "Open",
    comments: Array.isArray(data.comments) ? data.comments : [],
    resolutionNote: data.resolutionNote || "", history: Array.isArray(data.history) ? data.history : [],
    source: data.source || "automatic", confidence: Number.isFinite(Number(data.confidence)) ? Math.max(0, Math.min(1, Number(data.confidence))) : null,
    createdAt: data.createdAt || new Date().toISOString()
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

function normalizePeerDrawingIdentifier(value = "") {
  return String(value).toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
}

function normalizePeerEquipmentName(value = "") {
  return String(value).toUpperCase().replace(/[–—]/g, "-").replace(/[\s-]+/g, "").trim();
}

function getPeerEquipmentShortDescription(value = "") {
  return String(value || "")
    .split(/\s*:\s*(?:INCLUDES?|CONSISTS?|PROVIDES?|PUMPS?|STORES?|ACTIVATES?|INJECTS?)\b/i)[0]
    .replace(/\s*\((?:DIMENSIONS?|INCLUDES?)[^)]*\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function peerEquipmentNamesEquivalent(left = "", right = "") {
  const leftShort = getPeerEquipmentShortDescription(left);
  const rightShort = getPeerEquipmentShortDescription(right);
  const normalizedLeft = normalizePeerEquipmentName(leftShort);
  const normalizedRight = normalizePeerEquipmentName(rightShort);
  if (normalizedLeft.length >= 6 && normalizedRight.length >= 6 && (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))) return true;
  const ignored = new Set(["AND", "THE", "WITH", "SYSTEM", "PACKAGE", "ASSEMBLY", "EQUIPMENT", "STAND"]);
  const tokens = value => normalizePeerValue(value).match(/[A-Z0-9]+(?:HP)?/g)?.filter(token => token.length > 1 && !ignored.has(token)) || [];
  const leftTokens = tokens(leftShort), rightTokens = tokens(rightShort);
  if (!leftTokens.length || !rightTokens.length) return false;
  const shared = leftTokens.filter(token => rightTokens.includes(token));
  return shared.length >= 2 && shared.length / Math.min(leftTokens.length, rightTokens.length) >= 0.6;
}

function isPeerMajorEquipmentRow(row = {}) {
  const tag = String(row.tag || "").replace(/[\s-]/g, "");
  const description = normalizePeerValue(row.description || "");
  if (!/^\d+[A-Z]?$/i.test(tag) || !description) return false;
  if (/^\d+$/.test(tag)) return true;
  return /\b(?:PUMP|TANK|WASHER|ARCH|BLOWER|DRYER|MOTOR|HEATER|SOFTENER|FILTER|COMPRESSOR|BOILER|CHILLER|CONVEYOR|CONTROL PANEL|RECLAIM SYSTEM)\b/i.test(description);
}

function isPeerMarkupColor(red, green, blue) {
  const r = Number(red), g = Number(green), b = Number(blue);
  return r >= 135 && r - g >= 45 && (r >= b * 0.72 || r - b >= 35);
}

function runPeerNamingConventionRules(pages = [], filename = "") {
  const findings = [];
  const fileProjectNumber = String(filename).match(/^\s*(\d{3,6})\b/)?.[1] || "";
  const trustedPages = pages.filter(page => !page.ocrApplied || Number(page.metadataConfidence || 0) >= 0.72);
  const projectNumbers = trustedPages.map(page => String(page.projectNumber || "").trim()).filter(Boolean);
  const drawingNumbers = pages.map(page => String(page.drawingNumber || "").trim());
  const drawingFamilies = drawingNumbers.filter(Boolean).map(value => normalizePeerDrawingIdentifier(value).match(/^([A-Z]+)-/)?.[1] || "").filter(Boolean);
  const dominantFamily = drawingFamilies.sort((a, b) => drawingFamilies.filter(value => value === b).length - drawingFamilies.filter(value => value === a).length)[0] || "";

  pages.forEach(page => {
    const drawingNumber = String(page.drawingNumber || "").trim();
    if (drawingNumber && !/^[A-Z]{1,5}\s*-\s*\d+(?:\.\d+)?$/i.test(drawingNumber)) findings.push(createPeerFinding({
      severity: "Warning", issue: "Potential inconsistency: drawing number does not follow the expected letter-number format", comparedValue: drawingNumber, page: page.number
    }));
    const family = normalizePeerDrawingIdentifier(drawingNumber).match(/^([A-Z]+)-/)?.[1] || "";
    if (drawingNumber && dominantFamily && family && family !== dominantFamily) findings.push(createPeerFinding({
      severity: "Error", issue: "Potential inconsistency: drawing number uses a different naming prefix", listValue: dominantFamily, comparedValue: family, page: page.number
    }));
    if (fileProjectNumber && page.projectNumber && (!page.ocrApplied || Number(page.metadataConfidence || 0) >= 0.72) && normalizePeerValue(page.projectNumber, "tag") !== normalizePeerValue(fileProjectNumber, "tag")) findings.push(createPeerFinding({
      severity: "Error", issue: "Potential inconsistency: title-block project number does not match the uploaded filename", listValue: fileProjectNumber, comparedValue: page.projectNumber, page: page.number
    }));
    if (!page.ocrApplied && page.sheetNumber && Number(page.sheetNumber) !== Number(page.number)) findings.push(createPeerFinding({
      severity: "Error", issue: "Potential inconsistency: title-block sheet number does not match the PDF page position", listValue: String(page.number), comparedValue: String(page.sheetNumber), page: page.number
    }));
    if (page.sheetTotal && Number(page.sheetTotal) !== pages.length) findings.push(createPeerFinding({
      severity: "Error", issue: "Potential inconsistency: title-block sheet total does not match the PDF page count", listValue: String(pages.length), comparedValue: String(page.sheetTotal), page: page.number
    }));
    if (page.sheetTitle && !/^[A-Z0-9][A-Z0-9 &/().,'-]*$/i.test(page.sheetTitle)) findings.push(createPeerFinding({
      severity: "Warning", issue: "Potential inconsistency: sheet title contains unexpected naming characters", comparedValue: page.sheetTitle, page: page.number
    }));
  });

  findDuplicatePeerValues(drawingNumbers, normalizePeerDrawingIdentifier).forEach(indices => {
    const sheetNumbers = indices.map(index => Number(pages[index].sheetNumber || 0));
    const hasRepeatedSheet = sheetNumbers.some((sheet, index) => sheet && sheetNumbers.indexOf(sheet) !== index);
    if (!hasRepeatedSheet) return;
    indices.forEach(index => findings.push(createPeerFinding({
      severity: "Error", issue: "Potential inconsistency: duplicate drawing and sheet number", comparedValue: `${drawingNumbers[index]} / Sheet ${pages[index].sheetNumber}`, page: pages[index].number
    })));
  });
  if (new Set(projectNumbers.map(value => normalizePeerValue(value, "tag"))).size > 1) projectNumbers.forEach(value => findings.push(createPeerFinding({
    severity: "Error", issue: "Potential inconsistency: project number naming differs between title blocks", comparedValue: value
  })));
  return findings;
}

function runPeerEquipmentNamingRules(rows = []) {
  const findings = [];
  const byTag = new Map();
  rows.forEach(row => {
    const tag = normalizePeerValue(row.tag, "tag");
    if (!tag) return;
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push(row);
  });
  byTag.forEach(group => {
    const descriptions = new Set(group.map(row => normalizePeerEquipmentName(row.description)).filter(Boolean));
    if (descriptions.size <= 1) return;
    group.forEach(row => findings.push(createPeerFinding({
      severity: "Error", equipmentTag: row.tag, issue: "Potential inconsistency: the same equipment tag uses different equipment names", listValue: row.description, page: row.page
    })));
  });
  return findings;
}

function runPeerInitialRules(pages = []) {
  const findings = [];
  const drawingNumbers = pages.map(page => page.drawingNumber || "");
  const projectNumbers = pages.map(page => page.projectNumber || "").filter(Boolean);
  pages.forEach(page => {
    const hasSelectableText = Boolean(page.text?.trim());
    if (!hasSelectableText) {
      if (page.visualReviewed) return;
      findings.push(createPeerFinding({
        severity: "Manual Review",
        issue: page.ocrAttempted ? "The title block could not be read automatically" : "This page is image-only, so automatic title-block checks were skipped",
        details: page.ocrAttempted ? "The drawing is visible, but text recognition did not return usable title-block text. Preview this page and confirm its drawing number, project number, and sheet number manually." : "The drawing is visible, but automatic text recognition was unavailable. Preview this page and confirm its title-block information manually.",
        page: page.number
      }));
      return;
    }
    // Failure to extract a title-block value is a reader limitation, not an engineering defect.
    // Naming checks still compare every value that was read successfully.
  });
  findDuplicatePeerValues(drawingNumbers).forEach(indices => {
    const sheetNumbers = indices.map(index => Number(pages[index].sheetNumber || 0));
    const hasRepeatedSheet = sheetNumbers.some((sheet, index) => sheet && sheetNumbers.indexOf(sheet) !== index);
    if (!hasRepeatedSheet) return;
    indices.forEach(index => findings.push(createPeerFinding({
      severity: "Error", issue: "Potential inconsistency: duplicate drawing and sheet number", comparedValue: `${drawingNumbers[index]} / Sheet ${pages[index].sheetNumber}`, page: pages[index].number
    })));
  });
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

if (typeof module !== "undefined") module.exports = { PEER_REVIEW_TYPES, normalizePeerHeader, mapPeerEquipmentHeader, normalizePeerValue, normalizePeerDrawingIdentifier, normalizePeerEquipmentName, getPeerEquipmentShortDescription, peerEquipmentNamesEquivalent, isPeerMajorEquipmentRow, isPeerMarkupColor, peerValuesEquivalent, findDuplicatePeerValues, runPeerNamingConventionRules, runPeerEquipmentNamingRules, runPeerInitialRules, runPeerEquipmentRules };
