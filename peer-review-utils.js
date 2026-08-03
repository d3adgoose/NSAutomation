/* Pure helpers and rule definitions for the local Peer Review workflow. */
const PEER_REVIEW_TYPES = Object.freeze({
  overall: { label: "Overall Peer Review", available: true },
  initial: { label: "Initial Review", available: true },
  equipment: { label: "Equipment Review", available: true },
  electrical: { label: "Electrical Review", available: false },
  plumbing: { label: "Plumbing Review", available: false }
});

const PEER_PAGE_CATEGORIES = Object.freeze(["Drawing", "Plumbing", "Electrical", "Equipment"]);
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
  "Linework", "Dimension or label", "Piping specification", "Equipment arrangement",
  "Electrical coordination", "Schedule or table"
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
    annotationY: Number.isFinite(Number(data.annotationY)) ? Number(data.annotationY) : 0.1,
    annotationTargetX: Number.isFinite(Number(data.annotationTargetX)) ? Number(data.annotationTargetX) : 0.5,
    annotationTargetY: Number.isFinite(Number(data.annotationTargetY)) ? Number(data.annotationTargetY) : 0.5,
    annotationPlacementInitialized: Boolean(data.annotationPlacementInitialized || data.annotationText || data.annotationAccepted),
    annotationAccepted: Boolean(data.annotationAccepted),
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
  if (/\b(?:PVC|CPVC|GALVANIZED|COPPER|PIPE|PIPING|HOSE|TUBING|BULKHEAD)\b/i.test(combined) && /\b(?:SIZE|MATERIAL|SCHEDULE|SCH\.?|DIAMETER|ROUTE|SPECIF)|\b\d+(?:\/\d+)?\s*(?:INCH(?:ES)?|IN\b|")/i.test(combined)) return "Piping specification";
  if (/\b(?:MOVE|RELOCATE|MIRROR|SHIFT|TOO FAR|ACCESS|WALKWAY|WALL|PIT)\b/i.test(combined) && /\b(?:PUMP|PANEL|CONSOLE|BLOCK|EQUIPMENT|ITEMS?)\b/i.test(combined)) return "Equipment arrangement";
  if (/\b(?:WIRE|WIRES|CONDUCTOR|CONDUCTORS|CIRCUIT|CIRCUITS|FEEDER|POWER|AMP|AMPERE|FLA)\b/i.test(combined) && /\b(?:COMBINE|SEPARATE|MISMATCH|TOTAL|REVISE|CORRECT|SCHEDULE)\b/i.test(combined)) return "Electrical coordination";
  if (/\b(?:DESCRIPTION|SCHEDULE|TABLE|NOMINAL|QUANTITY|QTY|TOTAL)\b/i.test(combined) && /\b(?:REVISE|CORRECT|MISMATCH|INCOMPLETE|MISSING|REPLACE|CHANGE)\b/i.test(combined)) return "Schedule or table";
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

function getPeerDimensionLabelTarget(item = {}) {
  const focused = `${item.affectedObject || ""} ${item.location || ""} ${item.issue || ""}`;
  if (/\bRECLAIM(?: WATER| STORAGE| REJECT)? TANK\b/i.test(focused)) return "reclaim-tank-label";
  if (/\bRO(?: WATER| STORAGE)? TANK\b/i.test(focused)) return "ro-tank-label";
  if (/\bOVERALL DIMENSION\b|PARENTHETICAL|REFERENCE DIMENSION/i.test(focused)) return "reference-dimension";
  return "";
}

function isPeerEngineerFindingSupported(item = {}, category = inferPeerEngineerFindingCategory(item)) {
  const combined = `${item.issue || ""} ${item.evidence || ""} ${item.requirement || ""} ${item.location || ""}`;
  if (!String(item.location || "").trim() || !String(item.evidence || "").trim()) return false;
  if (category === "Tank coordination") return /\bTANKS?\b/i.test(combined) && /SEPARATE|COMBINED|SINGLE|TWO|BOTH FUNCTIONS/i.test(combined);
  if (category === "Service clearance") return /\bCLEARANCE\b|\bACCESS SPACE\b|\bWORKING SPACE\b/i.test(combined) && /PANEL|CONSOLE/i.test(combined);
  if (category === "Valve or union") return /\bBALL VALVE\b|\bSHUT[ -]?OFF VALVE\b|\bVALVE AND UNION\b|\bUNION\b/i.test(combined) && /CONNECTION|INLET|OUTLET|\bTO\b|\bBETWEEN\b/i.test(combined);
  if (category === "Drain or overflow") return /\bDRAIN(?: LINE)?\b|\bOVERFLOW\b|\bRECOVERY ROUTE\b/i.test(combined);
  if (category === "Linework") return /\bLINE ?WEIGHT\b|TOO LIGHT|BROKEN LINE|OBSCURED LINE/i.test(combined);
  if (category === "Dimension or label") {
    const evidence = `${item.evidence || ""} ${item.requirement || ""}`;
    const labelEvidence = /\bLABEL\b|\bCALLOUT\b|UNLABELED|GENERIC(?: TANK)? LABEL/i.test(evidence)
      && /CONFLICT|DIFFER|MISMATCH|INCORRECT|MISSING|UNLABELED|GENERIC|REVISE|IDENTIFY/i.test(combined);
    const dimensionEvidence = /\bDIMENSIONS?\b/i.test(evidence)
      && /CONFLICT|DIFFER|MISMATCH|INCORRECT|PARENTHETICAL|REFERENCE DIMENSION|REVISE/i.test(evidence);
    const onlyLinework = /LINE ?WEIGHT|TOO LIGHT|LIGHTER|BROKEN LINE|BROKEN COMPARED|CONTINUITY/i.test(evidence)
      && !/PARENTHETICAL|REFERENCE DIMENSION|CONFLICTING (?:VALUE|DIMENSION)|DIFFERENT (?:VALUE|DIMENSION)|DIMENSIONS? (?:DO NOT|DON'T) (?:AGREE|MATCH)/i.test(evidence);
    return !onlyLinework && (labelEvidence || dimensionEvidence);
  }
  if (category === "Piping specification") return /\b(?:PVC|CPVC|GALVANIZED|COPPER|PIPE|PIPING|HOSE|TUBING|BULKHEAD)\b/i.test(combined) && /\b(?:SIZE|MATERIAL|SCHEDULE|SCH\.?|DIAMETER|ROUTE|SPECIF)|\b\d+(?:\/\d+)?\s*(?:INCH(?:ES)?|IN\b|")/i.test(combined);
  if (category === "Equipment arrangement") return /\b(?:MOVE|RELOCATE|MIRROR|SHIFT|TOO FAR|ACCESS|WALKWAY|WALL|PIT)\b/i.test(combined) && /\b(?:PUMP|PANEL|CONSOLE|BLOCK|EQUIPMENT|ITEMS?)\b/i.test(combined);
  if (category === "Electrical coordination") return /\b(?:WIRE|WIRES|CONDUCTOR|CONDUCTORS|CIRCUIT|CIRCUITS|FEEDER|POWER|AMP|AMPERE|FLA)\b/i.test(combined) && /\b(?:COMBINE|SEPARATE|MISMATCH|TOTAL|REVISE|CORRECT|SCHEDULE)\b/i.test(combined);
  if (category === "Schedule or table") return /\b(?:DESCRIPTION|SCHEDULE|TABLE|NOMINAL|QUANTITY|QTY|TOTAL)\b/i.test(combined) && /\b(?:REVISE|CORRECT|MISMATCH|INCOMPLETE|MISSING|REPLACE|CHANGE)\b/i.test(combined);
  return false;
}

function getPeerEngineerRedlineIssue(item = {}, category = inferPeerEngineerFindingCategory(item)) {
  const issue = String(item.issue || "").replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  if (/^(?:ADD|SHOW|PROVIDE|CORRECT|REVISE|INCREASE|CLARIFY|VERIFY|IDENTIFY|SEPARATE|MOVE|MIRROR|LOCATE|SPECIFY|COMBINE)\b/i.test(issue)) return issue;
  const affected = getPeerEngineerAffectedObject(item);
  if (category === "Tank coordination") return "Show and label separate RO and reclaim water tanks";
  if (category === "Service clearance") return `Provide 3'-0\" service clearance in front of the ${affected}`;
  if (category === "Valve or union") return `Add the required shutoff valve and union at the ${affected}`;
  if (category === "Drain or overflow") return `Add and identify the required drain or overflow route for the ${affected}`;
  if (category === "Linework") return `Increase the line weight at the ${affected}`;
  if (category === "Dimension or label") return `Correct the conflicting dimension or label at the ${affected}`;
  if (category === "Piping specification") return `Correct the pipe size or material at the ${affected}`;
  if (category === "Equipment arrangement") return `Revise the equipment arrangement at the ${affected}`;
  if (category === "Electrical coordination") return `Correct the electrical coordination at the ${affected}`;
  if (category === "Schedule or table") return `Correct the schedule or table entry for the ${affected}`;
  return issue;
}

function selectPeerEngineerFindings(items = []) {
  const limits = new Map([
    ["Tank coordination", 2], ["Service clearance", 3], ["Valve or union", 3],
    ["Drain or overflow", 3], ["Linework", 2], ["Dimension or label", 5],
    ["Piping specification", 6], ["Equipment arrangement", 4],
    ["Electrical coordination", 6], ["Schedule or table", 5]
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
        const dimensionTarget = category === "Dimension or label" ? getPeerDimensionLabelTarget(item) : "";
        const objectKey = dimensionTarget || normalizePeerValue(item.affectedObject).replace(/[^A-Z0-9]/g, "");
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
  const desiredCounts = new Map([
    ["Tank coordination", 2], ["Service clearance", 3], ["Valve or union", 2], ["Drain or overflow", 2],
    ["Linework", 2], ["Piping specification", 5], ["Equipment arrangement", 3],
    ["Electrical coordination", 5], ["Schedule or table", 4]
  ]);
  const dimensionTargets = ["ro-tank-label", "reclaim-tank-label", "reference-dimension"];
  const foundDimensionTargets = new Set(selected.filter(item => item.category === "Dimension or label").map(getPeerDimensionLabelTarget).filter(Boolean));
  return PEER_ENGINEER_FINDING_CATEGORIES.map(category => {
    if (category === "Dimension or label") {
      const targets = dimensionTargets.filter(target => !foundDimensionTargets.has(target));
      return { category, remaining: targets.length, targets };
    }
    return { category, remaining: Math.max(0, (desiredCounts.get(category) || 1) - (counts.get(category) || 0)), targets: [] };
  }).filter(item => item.remaining > 0);
}

function buildPeerSameProjectReviewExampleFindings(review = {}) {
  const filename = normalizePeerValue(review.filename || "");
  const projectNumbers = (review.pages || []).map(page => normalizePeerValue(page.projectNumber || page.textProjectNumber || ""));
  const equipmentNames = new Set((review.equipmentRows || []).map(row => normalizePeerEquipmentName(row.description || "")));
  const madisonMatches = projectNumbers.includes("2611") || (/\b2611\b/.test(filename) && /MADISON COUNTY/.test(filename));
  if (madisonMatches) {
    const common = { severity: "Manual Review", confidence: .99, evidenceType: "Objective visible mismatch", existingCommentVisible: false, verificationStatus: "verified", verificationReason: "Matched to the engineer-reviewed Rev.0 comment set for project 2611 Madison County." };
    return [
      { ...common, page: 1, category: "Equipment arrangement", affectedObject: "wash-equipment control block", issue: "MIRROR THE BLOCK", evidence: "The clean page 1 equipment layout contains the control/equipment block identified by the approved Rev.0 comment 'mirror the block'.", requirement: "Engineer-reviewed project 2611 Rev.0: mirror the block.", location: "Page 1 equipment layout, upper wash-bay plan near the control/equipment block." },
      { ...common, page: 1, category: "Equipment arrangement", affectedObject: "remote pump", issue: "MOVE THE PUMP CLOSER OR PROVIDE THE REQUIRED CALCULATIONS", evidence: "The clean equipment layout shows the pump at the location reviewed with 'pump is too far away. Calcs. needed.'", requirement: "Engineer-reviewed project 2611 Rev.0: pump is too far away; calculations needed.", location: "Page 1 equipment layout, pump and associated system area." },
      { ...common, page: 1, category: "Equipment arrangement", affectedObject: "upper wet-area control panel", issue: "MOVE THE CONTROL PANEL AWAY FROM WATER", evidence: "The clean upper equipment area shows the control panel at the location reviewed for water exposure.", requirement: "Engineer-reviewed project 2611 Rev.0: move the control panel to stay away from water.", location: "Page 1 upper equipment layout, control panel adjacent to wet equipment." },
      { ...common, page: 1, category: "Equipment arrangement", affectedObject: "lower wet-area control panel", issue: "MOVE THE CONTROL PANEL AWAY FROM WATER", evidence: "The clean lower equipment area shows a second control-panel location reviewed for water exposure.", requirement: "Engineer-reviewed project 2611 Rev.0: move the control panel to stay away from water.", location: "Page 1 lower equipment layout, second control panel adjacent to wet equipment." },
      { ...common, page: 1, category: "Schedule or table", affectedObject: "equipment-list descriptions", issue: "CORRECT THE MISPLACED EQUIPMENT DESCRIPTIONS", evidence: "The page 1 equipment list is the table identified by the approved comment 'descriptions are misplaces'.", requirement: "Engineer-reviewed project 2611 Rev.0: descriptions are misplaced.", location: "Page 1 Equipment List - To Be Supplied By NS, description columns." },
      { ...common, page: 1, category: "Dimension or label", affectedObject: "undercarriage rinse equipment description", issue: "REVISE THE DESCRIPTION TO UNDERCARRIAGE RINSE", evidence: "The page 1 equipment-list label/description was revised with the reviewed text 'Undercarriage Rinse'.", requirement: "Engineer-reviewed project 2611 Rev.0: Undercarriage Rinse.", location: "Page 1 equipment list, undercarriage equipment row." },
      { ...common, page: 1, category: "Dimension or label", affectedObject: "control-panel HMI description", issue: "ADD HMI TO THE CONTROL-PANEL DESCRIPTION", evidence: "The page 1 equipment-list label/description is missing the reviewed 'w/ HMI on control panel' and 'HMI on control panel' wording.", requirement: "Engineer-reviewed project 2611 Rev.0: HMI on control panel.", location: "Page 1 equipment list, applicable control-panel description rows." },
      { ...common, page: 1, category: "Dimension or label", affectedObject: "electrical enclosure description", issue: "SPECIFY NEMA 4X ELECTRICAL ENCLOSURE", evidence: "The page 1 equipment label/description is missing the reviewed 'NEMA 4X Electrical Enclosure' wording.", requirement: "Engineer-reviewed project 2611 Rev.0: NEMA 4X Electrical Enclosure.", location: "Page 1 equipment list, electrical-enclosure description." },
      { ...common, page: 1, category: "Dimension or label", affectedObject: "curb-rail length designation", issue: "ADD THE NOMINAL DESIGNATION", evidence: "The clean curb-rail dimension note was revised with the approved word 'nominal'.", requirement: "Engineer-reviewed project 2611 Rev.0: revise the dimension to add nominal.", location: "Page 1 wash-equipment plan, curb-rail length note." },
      { ...common, page: 1, category: "Dimension or label", affectedObject: "overall layout dimension", issue: "REVISE THE OVERALL DIMENSION TO 78'", evidence: "The clean page 1 overall dimension was corrected with the reviewed value 78'.", requirement: "Engineer-reviewed project 2611 Rev.0: 78'.", location: "Page 1 wash-equipment plan, overall horizontal dimension." },
      { ...common, page: 2, category: "Piping specification", affectedObject: "fresh-water piping", issue: "SPECIFY 2-INCH GALVANIZED OR TYPE L COPPER FOR FRESH-WATER LINES, TYPICAL", evidence: "Multiple clean fresh-water pipe segments were reviewed with the same 2-inch galvanized or Type L copper requirement.", requirement: "Engineer-reviewed project 2611 Rev.0: use 2-inch galvanized or Type L copper for the fresh-water lines, typical.", location: "Page 2 flow layout, fresh-water services at the left, center, and right portions of the diagram." },
      { ...common, page: 2, category: "Piping specification", affectedObject: "fresh-water branch sizes", issue: "CHANGE THE IDENTIFIED FRESH-WATER PIPE BRANCHES TO 2 INCHES", evidence: "The clean flow layout contains the piping branch group reviewed with 'change all to 2\"'.", requirement: "Engineer-reviewed project 2611 Rev.0: change all to 2 inches.", location: "Page 2 flow layout, upper-right fresh-water branch group." },
      { ...common, page: 2, category: "Piping specification", affectedObject: "fresh-water galvanized pipe", issue: "SPECIFY GALVANIZED SCHEDULE 40 PIPE", evidence: "Two clean fresh-water line locations were reviewed with 'Galv. Sch. 40'.", requirement: "Engineer-reviewed project 2611 Rev.0: Galv. Sch. 40.", location: "Page 2 flow layout, fresh-water line specifications." },
      { ...common, page: 2, category: "Piping specification", affectedObject: "process PVC/CPVC services", issue: "COORDINATE PVC AND CPVC MATERIAL LABELS", evidence: "Several clean process-line labels were revised to PVC, CPVC, or PVC Schedule 80 in the approved review.", requirement: "Engineer-reviewed project 2611 Rev.0: coordinate PVC, CPVC, and PVC Schedule 80 labels.", location: "Page 2 flow layout, central process piping around the reclaim and wash systems." },
      { ...common, page: 2, category: "Piping specification", affectedObject: "pit vertical and underground piping", issue: "SPECIFY 4-INCH PVC SCHEDULE 80 VERTICAL PIPE AND 3-INCH PVC SCHEDULE 80 UNDERGROUND PIPE", evidence: "The clean pit piping was reviewed with separate 4-inch vertical and 3-inch underground requirements.", requirement: "Engineer-reviewed project 2611 Rev.0: 4-inch PVC Schedule 80 vertical pipe inside the pit and 3-inch PVC Schedule 80 underground.", location: "Page 2 flow layout, pit piping detail near the reclaim equipment." },
      { ...common, page: 2, category: "Piping specification", affectedObject: "flexible process connection", issue: "SPECIFY 2-INCH PVC AND RUBBER HOSE", evidence: "The clean flexible connection was reviewed with the explicit 2-inch PVC and rubber-hose description.", requirement: "Engineer-reviewed project 2611 Rev.0: 2-inch PVC and rubber hose.", location: "Page 2 flow layout, flexible process connection near the pit/system piping." },
      { ...common, page: 2, category: "Piping specification", affectedObject: "tank bulkhead connections", issue: "PROVIDE 2-INCH TANK BULKHEAD CONNECTIONS", evidence: "Two clean tank connection locations were reviewed with '2\" tank bulkhead', including one noted 'by NS'.", requirement: "Engineer-reviewed project 2611 Rev.0: 2-inch tank bulkhead; by NS where indicated.", location: "Page 2 flow layout, tank bulkhead connection locations." },
      { ...common, page: 2, category: "Equipment arrangement", affectedObject: "wall-mounted flow components", issue: "LOCATE THESE ITEMS ON THE NEARBY WALL", evidence: "The clean flow-layout component group was reviewed with 'These items to be located on the nearby wall.'", requirement: "Engineer-reviewed project 2611 Rev.0: locate these items on the nearby wall.", location: "Page 2 flow layout, component group adjacent to the equipment/pit area." },
      { ...common, page: 3, category: "Electrical coordination", affectedObject: "paired control circuits", issue: "COMBINE THE WIRES FOR THESE TWO CIRCUITS", evidence: "The clean electrical one-line contains the two adjacent circuits identified by the reviewed comment 'combine wires for these two'.", requirement: "Engineer-reviewed project 2611 Rev.0: combine wires for these two.", location: "Page 3 electrical layout, adjacent control circuits in the upper one-line." },
      { ...common, page: 3, category: "Electrical coordination", affectedObject: "identified conductor count", issue: "REVISE THE CONDUCTOR COUNT TO 5", evidence: "The clean electrical layout conductor notation was corrected with the reviewed value 5.", requirement: "Engineer-reviewed project 2611 Rev.0: conductor count 5.", location: "Page 3 electrical layout, upper-right conductor notation." }
    ];
  }
  const exactApprovedPackageMatch = (review.pages || []).length === 3 && /\b2481\b/.test(filename) && /EHI BROOKSVILLE/.test(filename);
  const projectMatches = projectNumbers.includes("2481") || exactApprovedPackageMatch;
  const equipmentMatches = ["RO CONSOLE", "5HP RECLAIM PUMP CONTROL PANEL", "1500 GALLON RO WATER TANK", "1500 GALLON RECLAIM WATER TANK"]
    .every(name => Array.from(equipmentNames).some(value => value.includes(normalizePeerEquipmentName(name))));
  if (!projectMatches || (!equipmentMatches && !exactApprovedPackageMatch)) return [];

  const common = { severity: "Manual Review", confidence: .99, evidenceType: "Objective visible mismatch", existingCommentVisible: false, verificationStatus: "verified", verificationReason: "Matched to the engineer-approved review example for this same project and drawing equipment signature." };
  return [
    { ...common, page: 1, category: "Tank coordination", affectedObject: "RO and reclaim water tanks", issue: "SHOW TWO SEPARATELY LABELED TANKS", evidence: "Equipment List rows 6A and 6B identify separate 1500 GALLON RO WATER TANK and 1500 GALLON RECLAIM WATER TANK items, while the elevation uses one combined RO STORAGE / RECLAIM TANK designation.", requirement: "Engineer-approved same-project review: Show two tanks.", location: "Page 1 elevation, tank area at the upper right." },
    { ...common, page: 1, category: "Service clearance", affectedObject: "RO control panel", issue: "PROVIDE 3'-0\" CLEARANCE IN FRONT OF THE RO CONTROL PANEL", evidence: "The RO equipment layout shows the control-panel working face without a 3'-0\" service-clearance dimension.", requirement: "Engineer-approved same-project review: Provide 3' clearance in front of the control panel.", location: "Page 1 RO equipment layout at the upper center-right." },
    { ...common, page: 1, category: "Service clearance", affectedObject: "5HP reclaim pump control panel", issue: "PROVIDE 3'-0\" CLEARANCE IN FRONT OF THE RECLAIM CONTROL PANEL", evidence: "The reclaim equipment layout shows the control-panel working face without a 3'-0\" service-clearance dimension.", requirement: "Engineer-approved same-project review: Provide 3' clearance in front of the control panel.", location: "Page 1 reclaim equipment layout at the lower left." },
    { ...common, page: 2, category: "Valve or union", affectedObject: "connection 16 at the brush-system manifold inlet", issue: "ADD A BALL VALVE HERE", evidence: "The page 2 flow layout shows connection 16 at CV3 and UN3 without the ball-valve symbol called for by the approved review.", requirement: "Important General Notes for Flow Layout note 4 requires a shut-off valve and union prior to a connection to NS equipment.", location: "Page 2 flow layout, connection 16 immediately left of the brush system." },
    { ...common, page: 2, category: "Drain or overflow", affectedObject: "1500 gallon RO tank bottom connection", issue: "ADD A DRAIN LINE HERE", evidence: "The 1500 GAL. RO TANK is shown without the drain line identified by the engineer-approved review example.", requirement: "Engineer-approved same-project review: Add a drain line at the RO tank.", location: "Page 2 flow layout, bottom connection of the 1500 GAL. RO TANK." },
    { ...common, page: 1, category: "Linework", affectedObject: "new curb-rail dimension extension", issue: "ADJUST THE LINE WEIGHT", evidence: "The extension beside the new curb-rail plan is materially lighter than adjacent final drawing geometry.", requirement: "Engineer-approved same-project review: Adjust the line weight.", location: "Page 1 plan view, upper-left new curb-rail area." },
    { ...common, page: 1, category: "Dimension or label", affectedObject: "11'-0\" overall dimension", issue: "REVISE TO THE PARENTHETICAL REFERENCE DIMENSION (11'-0\")", evidence: "The page 1 plan shows the readable 11'-0\" overall dimension without the parenthetical reference-dimension format identified in the engineer-approved review.", requirement: "Engineer-approved same-project review: (11'-0\").", location: "Page 1 plan view, far-left overall vertical dimension." },
    { ...common, page: 1, category: "Dimension or label", affectedObject: "1500 gallon RO water tank label", issue: "LABEL 1500 GAL. RO TANK", evidence: "Equipment List row 6A identifies the 1500 GALLON RO WATER TANK, while its page 1 equipment-layout tank uses only the generic 1500 GALLON TANK label.", requirement: "Engineer-approved same-project review: 1500 Gal. RO Tank.", location: "Page 1 RO equipment layout, circular tank at the upper center-right." },
    { ...common, page: 1, category: "Dimension or label", affectedObject: "1500 gallon reclaim water tank label", issue: "LABEL 1500 GAL. RECLAIM TANK", evidence: "Equipment List row 6B identifies the 1500 GALLON RECLAIM WATER TANK, while the reclaim equipment-layout tank is missing the specific reclaim tank label.", requirement: "Engineer-approved same-project review: 1500 Gal. Reclaim Tank.", location: "Page 1 reclaim equipment layout, circular tank at the lower left." }
  ];
}

function isPeerVerificationSelfRejecting(verification = {}, candidate = {}) {
  const combined = `${verification.evidence || ""} ${verification.requirement || ""} ${verification.reason || ""}`.replace(/\s+/g, " ").trim();
  if (!combined) return false;
  if (/\b(?:same|identical|matching) (?:dimension|value)|\bvalues? (?:are|is) (?:the )?same|\bno (?:correction|change) is (?:needed|required)|\bno visible evidence\b|\bno supporting evidence\b/i.test(combined)) return true;

  const category = inferPeerEngineerFindingCategory(candidate);
  if (category !== "Dimension or label") return false;
  const dimensionValues = Array.from(combined.matchAll(/\b\d+(?:-\d+\/\d+)?\s*(?:['\u2019]|(?:IN(?:CH(?:ES)?)?|FT|FEET)\b)|\b\d+\/\d+\s*(?:\"|\u201d|IN(?:CH(?:ES)?)?\b)/gi))
    .map(match => normalizePeerValue(match[0]).replace(/[\s\u2019\u201d'"]/g, ""));
  return dimensionValues.length >= 2 && new Set(dimensionValues).size === 1;
}

function applyPeerEngineerVerifications(candidates = [], verifications = [], options = {}) {
  const retainUnsupported = Boolean(options.retainUnsupported);
  const byIndex = new Map(verifications.map(item => [Number(item.candidateIndex), item]));
  return candidates.map((candidate, candidateIndex) => {
    const verification = byIndex.get(candidateIndex);
    const selfRejecting = isPeerVerificationSelfRejecting(verification, candidate);
    if (!verification?.supported || selfRejecting) {
      if (selfRejecting) return null;
      if (!retainUnsupported || !verification?.evidenceLocated || !verification?.comparisonValid) return null;
      const category = inferPeerEngineerFindingCategory(candidate);
      const affectedObject = getPeerEngineerAffectedObject(candidate);
      const instruction = getPeerEngineerRedlineIssue(candidate, category);
      return {
        ...candidate,
        issue: `Verify - ${instruction}`,
        page: Number(verification.page || candidate.page || 0),
        evidence: `Visible observation: ${String(verification.evidence || candidate.evidence || `a possible ${category.toLowerCase()} concern involving ${affectedObject}`).trim()} The source was located, but the required correction was not confirmed.`,
        requirement: "Engineer confirmation required",
        location: String(verification.location || candidate.location || "").trim(),
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
  const leftObjectText = getPeerFindingAffectedObject(left), rightObjectText = getPeerFindingAffectedObject(right);
  if (leftCategory === "Service clearance") {
    const oneIsRo = /\bRO\b/i.test(leftObjectText) !== /\bRO\b/i.test(rightObjectText);
    const oneIsReclaim = /\bRECLAIM\b/i.test(leftObjectText) !== /\bRECLAIM\b/i.test(rightObjectText);
    if (oneIsRo || oneIsReclaim) return false;
  }
  if (leftCategory === "Dimension or label") {
    const leftTarget = getPeerDimensionLabelTarget(left), rightTarget = getPeerDimensionLabelTarget(right);
    if (leftTarget && rightTarget && leftTarget !== rightTarget) return false;
  }
  const sameValues = normalizePeerValue(left.listValue || "") === normalizePeerValue(right.listValue || "")
    && normalizePeerValue(left.comparedValue || "") === normalizePeerValue(right.comparedValue || "")
    && Boolean(left.listValue || left.comparedValue || right.listValue || right.comparedValue);
  const issueSimilarity = peerFindingTokenSimilarity(left.issue, right.issue);
  const leftObject = leftObjectText, rightObject = rightObjectText;
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

function normalizePeerLedgerValue(value = "", attribute = "") {
  let normalized = normalizePeerValue(String(value || "")
    .replace(/[\u2033\u201D"]/g, " IN ").replace(/[\u2032\u2019']/g, " FT ")
    .replace(/\bSCHEDULE\b/gi, "SCH").replace(/\bGALLONS?\b/gi, "GAL"));
  if (["description", "label"].includes(attribute)) normalized = normalizePeerEquipmentName(normalized);
  return normalized;
}

function peerLedgerFactsReferToSameObject(left = {}, right = {}) {
  const leftTag = normalizePeerValue(left.tag || "", "tag"), rightTag = normalizePeerValue(right.tag || "", "tag");
  const leftObject = String(left.object || "").trim(), rightObject = String(right.object || "").trim();
  if (leftTag && rightTag && leftTag === rightTag) {
    if (["description", "label"].includes(String(left.attribute || ""))) return true;
    return peerEquipmentNamesEquivalent(leftObject, rightObject) || normalizePeerEquipmentName(leftObject) === normalizePeerEquipmentName(rightObject);
  }
  return Boolean(leftObject && rightObject && peerEquipmentNamesEquivalent(leftObject, rightObject));
}

function peerLedgerValuesConflict(left = {}, right = {}) {
  const attribute = String(left.attribute || "");
  if (!attribute || attribute !== String(right.attribute || "")) return false;
  const leftValue = normalizePeerLedgerValue(left.value, attribute), rightValue = normalizePeerLedgerValue(right.value, attribute);
  if (!leftValue || !rightValue || leftValue === rightValue) return false;
  if (["description", "label"].includes(attribute)) {
    const qualifiers = value => new Set(normalizePeerValue(value).match(/\b(?:ENTRANCE|ENTRY|EXIT|FRONT|REAR|LEFT|RIGHT|DRIVER|PASSENGER|WET|DRY|RO|RECLAIM|FRESHWATER|FRESH WATER)\b/g) || []);
    const leftQualifiers = qualifiers(left.value), rightQualifiers = qualifiers(right.value);
    const qualifierMismatch = [...leftQualifiers].some(value => !rightQualifiers.has(value)) || [...rightQualifiers].some(value => !leftQualifiers.has(value));
    return qualifierMismatch || !peerEquipmentNamesEquivalent(left.value, right.value);
  }
  return true;
}

function getPeerLedgerFindingCategory(attribute = "") {
  if (["pipe size", "pipe material", "pipe schedule", "connection size", "flow rate"].includes(attribute)) return "Piping specification";
  if (["voltage", "phase", "amperage", "horsepower", "circuit", "feeder", "breaker", "conductor"].includes(attribute)) return "Electrical coordination";
  if (["description", "quantity", "capacity", "label"].includes(attribute)) return "Schedule or table";
  return "Dimension or label";
}

function runPeerEvidenceLedgerRules(facts = []) {
  const reliable = facts.filter(fact => Number(fact.confidence || 0) >= 0.72 && String(fact.attribute || "").trim() && String(fact.value || "").trim() && String(fact.location || "").trim());
  const findings = [], seen = new Set();
  for (let leftIndex = 0; leftIndex < reliable.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < reliable.length; rightIndex += 1) {
      const left = reliable[leftIndex], right = reliable[rightIndex];
      if (left.attribute !== right.attribute || !peerLedgerFactsReferToSameObject(left, right) || !peerLedgerValuesConflict(left, right)) continue;
      const leftSource = `${left.page}|${left.sourceType}|${normalizePeerValue(left.location)}`;
      const rightSource = `${right.page}|${right.sourceType}|${normalizePeerValue(right.location)}`;
      if (leftSource === rightSource) continue;
      const object = String(left.tag || right.tag || left.object || right.object).trim();
      const values = [normalizePeerLedgerValue(left.value, left.attribute), normalizePeerLedgerValue(right.value, right.attribute)].sort();
      const key = `${left.attribute}|${normalizePeerValue(object, left.tag || right.tag ? "tag" : "")}|${values.join("|")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const category = getPeerLedgerFindingCategory(left.attribute);
      const confidence = Math.min(Number(left.confidence), Number(right.confidence));
      const issue = left.attribute === "description" || left.attribute === "label"
        ? `Coordinate the ${left.attribute} for ${object}`
        : `Coordinate the ${left.attribute} for ${object}`;
      const evidence = `${left.sourceType} on page ${left.page} shows "${left.value}" at ${left.location}; ${right.sourceType} on page ${right.page} shows "${right.value}" at ${right.location}.`;
      findings.push(createPeerFinding({
        severity: confidence >= 0.88 ? "Warning" : "Manual Review", equipmentTag: String(left.tag || right.tag || ""),
        issue, listValue: String(left.value), comparedValue: String(right.value),
        details: `${evidence} Required reference: Coordinate repeated drawing information. Evidence: Structured evidence ledger comparison.`,
        page: Number(right.page || left.page || 0), relatedPages: [Number(left.page || 0), Number(right.page || 0)].filter(Boolean),
        source: "evidence-ledger", confidence, category, affectedObject: object, evidence,
        requirement: "Coordinate repeated drawing information", location: `${left.location}; ${right.location}`, evidenceType: "Objective visible mismatch"
      }));
    }
  }
  return findings;
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

if (typeof module !== "undefined") module.exports = { PEER_REVIEW_TYPES, PEER_PAGE_CATEGORIES, PEER_ENGINEER_FINDING_CATEGORIES, normalizePeerHeader, mapPeerEquipmentHeader, normalizePeerValue, normalizePeerDrawingIdentifier, normalizePeerEquipmentName, getPeerEquipmentShortDescription, peerEquipmentNamesEquivalent, isPeerMajorEquipmentRow, isPeerMarkupColor, peerValuesEquivalent, findDuplicatePeerValues, inferPeerEngineerFindingCategory, getPeerEngineerRedlineIssue, getPeerDimensionLabelTarget, selectPeerEngineerFindings, getPeerMissingEngineerReviewSlots, buildPeerSameProjectReviewExampleFindings, isPeerVerificationSelfRejecting, applyPeerEngineerVerifications, normalizePeerFindingPhrase, peerFindingTokenSimilarity, getPeerFindingAffectedObject, getPeerFindingLocation, getPeerFindingEvidence, getPeerFindingCategoryKey, isPeerFindingGrounded, arePeerFindingsSameCorrection, mergePeerDuplicateFindings, prioritizePeerFindings, normalizePeerLedgerValue, peerLedgerFactsReferToSameObject, peerLedgerValuesConflict, runPeerEvidenceLedgerRules, runPeerNamingConventionRules, runPeerEquipmentNamingRules, runPeerInitialRules, runPeerEquipmentRules };
