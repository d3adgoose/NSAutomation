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
const PEER_ENGINEER_FINDING_CATEGORIES = Object.freeze([
  "Tank coordination", "Service clearance", "Valve or union", "Drain or overflow",
  "Linework", "Dimension or label"
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
    annotationText: data.annotationText || "", annotationX: Number.isFinite(Number(data.annotationX)) ? Number(data.annotationX) : 0.08,
    annotationY: Number.isFinite(Number(data.annotationY)) ? Number(data.annotationY) : 0.1, annotationAccepted: Boolean(data.annotationAccepted),
    source: data.source || "automatic", confidence: Number.isFinite(Number(data.confidence)) ? Math.max(0, Math.min(1, Number(data.confidence))) : null,
    verificationStatus: data.verificationStatus || "", verificationReason: data.verificationReason || "",
    category: data.category || "", affectedObject: data.affectedObject || "",
    evidence: data.evidence || "", requirement: data.requirement || "", location: data.location || "",
    evidenceType: data.evidenceType || "", relatedPages: Array.isArray(data.relatedPages) ? data.relatedPages.map(Number).filter(Boolean) : [],
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

function inferPeerEngineerFindingCategory(item = {}) {
  const declared = String(item.category || "").trim();
  const supported = PEER_ENGINEER_FINDING_CATEGORIES.find(category => category.toLowerCase() === declared.toLowerCase());
  if (supported) return supported;
  const combined = `${item.issue || ""} ${item.evidence || ""} ${item.requirement || ""}`;
  if (/\bTANKS?\b/i.test(combined) && /SEPARATE|COMBINED|SINGLE|TWO|BOTH FUNCTIONS/i.test(combined)) return "Tank coordination";
  if (/\bCLEARANCE\b|\bACCESS SPACE\b|\bWORKING SPACE\b/i.test(combined)) return "Service clearance";
  if (/\bBALL VALVE\b|\bSHUT[ -]?OFF VALVE\b|\bVALVE AND UNION\b|\bUNION\b/i.test(combined)) return "Valve or union";
  if (/\bDRAIN(?: LINE)?\b|\bOVERFLOW\b|\bRECOVERY ROUTE\b/i.test(combined)) return "Drain or overflow";
  if (/\bLINE ?WEIGHT\b|TOO LIGHT|BROKEN LINE|OBSCURED LINE/i.test(combined)) return "Linework";
  if (/\bDIMENSION\b|\bLABEL\b|\bCALLOUT\b/i.test(combined)) return "Dimension or label";
  return "";
}

function getPeerEngineerAffectedObject(item = {}) {
  const provided = String(item.affectedObject || "").replace(/\s+/g, " ").trim();
  if (provided) return provided;
  const combined = `${item.issue || ""} ${item.evidence || ""} ${item.location || ""}`;
  const patterns = [
    /\bRO (?:CONTROL PANEL|CONSOLE)\b/i,
    /\bRECLAIM (?:PUMP )?CONTROL PANEL\b/i,
    /\bRECLAIM TANK\s+(?:TO|AND)\s+SUMP PIT\b/i,
    /\bSUMP PIT\s+(?:TO|AND)\s+RECLAIM TANK\b/i,
    /\bRO CONSOLE\s+(?:TO|AND)\s+RECLAIM TANK\b/i,
    /\b(?:RO|RECLAIM)(?: WATER| STORAGE)? TANK\b/i
  ];
  return patterns.map(pattern => combined.match(pattern)?.[0]).find(Boolean) || String(item.location || "drawing location").trim();
}

function isPeerEngineerFindingSupported(item = {}, category = inferPeerEngineerFindingCategory(item)) {
  const combined = `${item.issue || ""} ${item.evidence || ""} ${item.requirement || ""} ${item.location || ""}`;
  if (!String(item.location || "").trim() || !String(item.evidence || "").trim()) return false;
  if (category === "Tank coordination") return /\bTANKS?\b/i.test(combined) && /SEPARATE|COMBINED|SINGLE|TWO|BOTH FUNCTIONS/i.test(combined);
  if (category === "Service clearance") return /\bCLEARANCE\b|\bACCESS SPACE\b|\bWORKING SPACE\b/i.test(combined) && /PANEL|CONSOLE/i.test(combined);
  if (category === "Valve or union") return /\bBALL VALVE\b|\bSHUT[ -]?OFF VALVE\b|\bVALVE AND UNION\b|\bUNION\b/i.test(combined) && /CONNECTION|INLET|OUTLET|\bTO\b|\bBETWEEN\b/i.test(combined);
  if (category === "Drain or overflow") return /\bDRAIN(?: LINE)?\b|\bOVERFLOW\b|\bRECOVERY ROUTE\b/i.test(combined);
  if (category === "Linework") return /\bLINE ?WEIGHT\b|TOO LIGHT|BROKEN LINE|OBSCURED LINE/i.test(combined);
  if (category === "Dimension or label") return /\bDIMENSION\b|\bLABEL\b|\bCALLOUT\b/i.test(combined) && /CONFLICT|DIFFER|MISMATCH|INCORRECT|MISSING|CORRECT|REVISE/i.test(combined);
  return false;
}

function getPeerEngineerRedlineIssue(item = {}, category = inferPeerEngineerFindingCategory(item)) {
  const issue = String(item.issue || "").replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  if (/^(?:ADD|SHOW|PROVIDE|CORRECT|REVISE|INCREASE|CLARIFY|VERIFY|IDENTIFY|SEPARATE)\b/i.test(issue)) return issue;
  const affected = getPeerEngineerAffectedObject(item);
  if (category === "Tank coordination") return "Show and label separate RO and reclaim water tanks";
  if (category === "Service clearance") return `Provide 3'-0\" service clearance in front of the ${affected}`;
  if (category === "Valve or union") return `Add the required shutoff valve and union at the ${affected}`;
  if (category === "Drain or overflow") return `Add and identify the required drain or overflow route for the ${affected}`;
  if (category === "Linework") return `Increase the line weight at the ${affected}`;
  if (category === "Dimension or label") return `Correct the conflicting dimension or label at the ${affected}`;
  return issue;
}

function selectPeerEngineerFindings(items = []) {
  const limits = new Map([
    ["Tank coordination", 1], ["Service clearance", 2], ["Valve or union", 1],
    ["Drain or overflow", 1], ["Linework", 1], ["Dimension or label", 1]
  ]);
  const prepared = items.map((item, index) => {
    const category = inferPeerEngineerFindingCategory(item);
    const affectedObject = getPeerEngineerAffectedObject(item);
    let confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
    const requirement = String(item.requirement || "");
    if (category === "Service clearance" && !/(?:3\s*(?:FEET|FOOT|FT)|3\s*['\u2019]|THREE[- ]FOOT)/i.test(requirement)) confidence = Math.min(confidence, 0.55);
    if (category === "Drain or overflow" && !/\bDRAIN(?: LINE)?\b|\bOVERFLOW\b|\bRECOVERY ROUTE\b/i.test(requirement)) confidence = Math.min(confidence, 0.55);
    return { ...item, category, affectedObject, confidence, _peerIndex: index };
  }).filter(item => limits.has(item.category) && isPeerEngineerFindingSupported(item, item.category));

  const selected = [];
  PEER_ENGINEER_FINDING_CATEGORIES.forEach(category => {
    const seenObjects = new Set();
    prepared.filter(item => item.category === category)
      .sort((left, right) => right.confidence - left.confidence || String(right.evidence || "").length - String(left.evidence || "").length)
      .some(item => {
        const objectKey = normalizePeerValue(item.affectedObject).replace(/[^A-Z0-9]/g, "");
        if (seenObjects.has(objectKey)) return false;
        seenObjects.add(objectKey);
        selected.push({ ...item, issue: getPeerEngineerRedlineIssue(item, category) });
        return selected.filter(entry => entry.category === category).length >= limits.get(category);
      });
  });
  return selected.sort((left, right) => left._peerIndex - right._peerIndex).map(item => {
    const cleaned = { ...item };
    delete cleaned._peerIndex;
    return cleaned;
  });
}

function getPeerMissingEngineerReviewSlots(items = []) {
  const selected = selectPeerEngineerFindings(items);
  const counts = new Map(PEER_ENGINEER_FINDING_CATEGORIES.map(category => [category, selected.filter(item => item.category === category).length]));
  return PEER_ENGINEER_FINDING_CATEGORIES.map(category => ({
    category,
    remaining: Math.max(0, (category === "Service clearance" ? 2 : 1) - (counts.get(category) || 0))
  })).filter(item => item.remaining > 0);
}

function applyPeerEngineerVerifications(candidates = [], verifications = [], options = {}) {
  const retainUnsupported = Boolean(options.retainUnsupported);
  const byIndex = new Map(verifications.map(item => [Number(item.candidateIndex), item]));
  return candidates.map((candidate, candidateIndex) => {
    const verification = byIndex.get(candidateIndex);
    if (!verification?.supported) {
      if (!retainUnsupported) return null;
      const category = inferPeerEngineerFindingCategory(candidate);
      const affectedObject = getPeerEngineerAffectedObject(candidate);
      const instruction = getPeerEngineerRedlineIssue(candidate, category);
      return {
        ...candidate,
        issue: `Verify - ${instruction}`,
        evidence: `Visible observation: ${String(candidate.evidence || `a possible ${category.toLowerCase()} concern involving ${affectedObject}`).trim()} Source verification could not confirm the required correction.`,
        requirement: "Engineer confirmation required",
        confidence: Math.min(Number(candidate.confidence) || 0, 0.35),
        verificationStatus: "possible",
        verificationReason: String(verification?.reason || "The source verifier did not return enough evidence for this candidate.").trim()
      };
    }
    const verifiedConfidence = Math.max(0, Math.min(1, Number(verification.confidence) || 0));
    const verifiedRequirement = String(verification.requirement || candidate.requirement || "").trim();
    const reliesOnEngineerStandard = /^Engineer standard - confirm$/i.test(verifiedRequirement);
    return {
      ...candidate,
      page: Number(verification.page || candidate.page || 0),
      issue: String(verification.issue || candidate.issue || "").trim(),
      evidence: String(verification.evidence || candidate.evidence || "").trim(),
      requirement: verifiedRequirement,
      location: String(verification.location || candidate.location || "").trim(),
      confidence: reliesOnEngineerStandard ? Math.min(verifiedConfidence || 0.55, 0.55) : Math.max(0.65, verifiedConfidence),
      verificationStatus: reliesOnEngineerStandard ? "possible" : "verified",
      verificationReason: String(verification.reason || "Source verification confirmed this finding.").trim()
    };
  }).filter(Boolean);
}

function normalizePeerFindingPhrase(value = "") {
  const ignored = new Set(["A", "AN", "AND", "AT", "FOR", "IN", "OF", "ON", "THE", "THIS", "TO", "WITH", "VERIFY", "POSSIBLE"]);
  return String(value || "").toUpperCase().replace(/[â€“â€”]/g, "-").match(/[A-Z0-9]+/g)?.filter(token => token.length > 1 && !ignored.has(token)) || [];
}

function peerFindingTokenSimilarity(left = "", right = "") {
  const leftTokens = new Set(normalizePeerFindingPhrase(left)), rightTokens = new Set(normalizePeerFindingPhrase(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const shared = [...leftTokens].filter(token => rightTokens.has(token)).length;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function getPeerFindingAffectedObject(item = {}) {
  return String(item.affectedObject || item.equipmentTag || item.listValue || item.comparedValue || "").replace(/\s+/g, " ").trim();
}

function getPeerFindingLocation(item = {}) {
  if (String(item.location || "").trim()) return String(item.location).replace(/\s+/g, " ").trim();
  return String(item.details || "").match(/\bLocation:\s*([^.]*)/i)?.[1]?.trim() || "";
}

function getPeerFindingEvidence(item = {}) {
  if (String(item.evidence || "").trim()) return String(item.evidence).replace(/\s+/g, " ").trim();
  return String(item.details || "").split(/\b(?:Required reference|Location|Verification note|Evidence):/i)[0].replace(/\s+/g, " ").trim();
}

function getPeerFindingCategoryKey(item = {}) {
  const engineerCategory = inferPeerEngineerFindingCategory(item);
  if (engineerCategory) return engineerCategory;
  const combined = `${item.issue || ""} ${item.details || ""}`;
  if (/PLACEHOLDER|\bTBD\b|\bTBC\b|UNKNOWN/i.test(combined)) return "Placeholder";
  if (/PROJECT NUMBER|DRAWING NUMBER|SHEET NUMBER|TITLE BLOCK/i.test(combined)) return "Title block";
  if (/EQUIPMENT.*(?:CALLOUT|LIST)|CALLOUT.*EQUIPMENT/i.test(combined)) return "Equipment coordination";
  if (/QUANTITY|\bQTY\b|COUNT MISMATCH/i.test(combined)) return "Quantity";
  return normalizePeerFindingPhrase(item.issue).slice(0, 5).join(" ");
}

function isPeerFindingGrounded(item = {}) {
  if (item.source === "manual" || item.confidence === null || item.confidence === undefined) return true;
  if (item.source !== "visual-ai") return Boolean(Number(item.page || 0) && String(item.issue || "").trim() && (getPeerFindingEvidence(item) || item.listValue || item.comparedValue));
  return Boolean(Number(item.page || 0) && getPeerFindingAffectedObject(item) && getPeerFindingLocation(item) && getPeerFindingEvidence(item));
}

function arePeerFindingsSameCorrection(left = {}, right = {}) {
  const leftCategory = getPeerFindingCategoryKey(left), rightCategory = getPeerFindingCategoryKey(right);
  if (!leftCategory || leftCategory !== rightCategory) return false;
  const sameValues = normalizePeerValue(left.listValue || "") === normalizePeerValue(right.listValue || "")
    && normalizePeerValue(left.comparedValue || "") === normalizePeerValue(right.comparedValue || "")
    && Boolean(left.listValue || left.comparedValue || right.listValue || right.comparedValue);
  const issueSimilarity = peerFindingTokenSimilarity(left.issue, right.issue);
  const leftObject = getPeerFindingAffectedObject(left), rightObject = getPeerFindingAffectedObject(right);
  const objectSimilarity = peerFindingTokenSimilarity(leftObject, rightObject);
  const locationSimilarity = peerFindingTokenSimilarity(getPeerFindingLocation(left), getPeerFindingLocation(right));
  if (sameValues && issueSimilarity >= 0.6) return true;
  if (leftObject && rightObject && objectSimilarity >= 0.6 && issueSimilarity >= 0.45) return true;
  return Number(left.page || 0) === Number(right.page || 0) && locationSimilarity >= 0.65 && issueSimilarity >= 0.55;
}

function getPeerFindingStrength(item = {}) {
  const confidence = Number(item.confidence || 0);
  const statusWeight = item.verificationStatus === "verified" ? 5 : item.verificationStatus === "possible" ? 1 : item.source === "visual-ai" ? 2 : 4;
  const severityWeight = item.severity === "Error" ? 0.3 : item.severity === "Warning" ? 0.2 : 0;
  return statusWeight + confidence + severityWeight + Math.min(0.25, getPeerFindingEvidence(item).length / 1000);
}

function mergePeerDuplicateFindings(items = []) {
  const groups = [];
  items.forEach(item => {
    const group = groups.find(entries => arePeerFindingsSameCorrection(entries[0], item));
    if (group) group.push(item); else groups.push([item]);
  });
  return groups.map(entries => {
    const ranked = [...entries].sort((left, right) => getPeerFindingStrength(right) - getPeerFindingStrength(left));
    const primary = { ...ranked[0] };
    const pages = Array.from(new Set(entries.flatMap(item => [Number(item.page || 0), ...(item.relatedPages || [])]).filter(Boolean))).sort((a, b) => a - b);
    primary.relatedPages = pages.filter(page => page !== Number(primary.page || 0));
    if (primary.relatedPages.length && !/Also observed on page/i.test(primary.details || "")) {
      primary.details = `${String(primary.details || "").trim()} Also observed on page${primary.relatedPages.length === 1 ? "" : "s"} ${primary.relatedPages.join(", ")}.`.trim();
    }
    return primary;
  });
}

function prioritizePeerFindings(items = [], targetMax = 12) {
  const merged = mergePeerDuplicateFindings(items.filter(isPeerFindingGrounded));
  if (merged.length <= targetMax) return merged;
  const confirmed = merged.filter(item => item.verificationStatus !== "possible");
  const possible = merged.filter(item => item.verificationStatus === "possible")
    .sort((left, right) => getPeerFindingStrength(right) - getPeerFindingStrength(left));
  if (confirmed.length >= targetMax) return confirmed;
  return [...confirmed, ...possible.slice(0, targetMax - confirmed.length)];
}

function normalizePeerDrawingIdentifier(value = "") {
  return String(value).toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
}

function normalizePeerEquipmentName(value = "") {
  return String(value).toUpperCase().replace(/[–—]/g, "-").replace(/[\s-]+/g, "").trim();
}

function getPeerEquipmentShortDescription(value = "") {
  return String(value || "")
    .split(/\s*:\s*/)[0]
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

if (typeof module !== "undefined") module.exports = { PEER_REVIEW_TYPES, PEER_ENGINEER_FINDING_CATEGORIES, normalizePeerHeader, mapPeerEquipmentHeader, normalizePeerValue, normalizePeerDrawingIdentifier, normalizePeerEquipmentName, getPeerEquipmentShortDescription, peerEquipmentNamesEquivalent, isPeerMajorEquipmentRow, isPeerMarkupColor, peerValuesEquivalent, findDuplicatePeerValues, inferPeerEngineerFindingCategory, getPeerEngineerRedlineIssue, selectPeerEngineerFindings, getPeerMissingEngineerReviewSlots, applyPeerEngineerVerifications, normalizePeerFindingPhrase, peerFindingTokenSimilarity, getPeerFindingAffectedObject, getPeerFindingLocation, getPeerFindingEvidence, getPeerFindingCategoryKey, isPeerFindingGrounded, arePeerFindingsSameCorrection, mergePeerDuplicateFindings, prioritizePeerFindings, runPeerNamingConventionRules, runPeerEquipmentNamingRules, runPeerInitialRules, runPeerEquipmentRules };
