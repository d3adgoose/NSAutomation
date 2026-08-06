const assert = require("assert");
const fs = require("fs");
const path = require("path");
const rules = require("../peer-review-utils.js");

assert.strictEqual(rules.PEER_REVIEW_TYPES.overall.label, "Overall Peer Review");
assert.strictEqual(rules.PEER_REVIEW_TYPES.overall.available, true);
assert.deepStrictEqual(rules.PEER_PAGE_CATEGORIES, ["Drawing", "Plumbing", "Electrical", "Equipment"]);

assert.strictEqual(rules.normalizePeerValue("P-101", "tag"), rules.normalizePeerValue("p 101", "tag"));
assert.strictEqual(rules.normalizePeerValue("3 phase", "phase"), rules.normalizePeerValue("3PH", "phase"));
assert.strictEqual(rules.peerValuesEquivalent("460 Volts", "460V", "voltage"), true);
assert.strictEqual(rules.mapPeerEquipmentHeader("Mfr"), "manufacturer");
assert.strictEqual(rules.inferPeerEngineerFindingCategory({ issue: "CORRECT THE PIPE SIZE AND MATERIAL", evidence: "The same service is labeled 1 IN. PVC upstream and 2 IN. CPVC downstream.", requirement: "Match the repeated piping service." }), "Piping specification");
assert.strictEqual(rules.inferPeerEngineerFindingCategory({ issue: "MOVE THE CONTROL PANEL", evidence: "The panel is too far from the pump it serves.", requirement: "Engineer standard - confirm" }), "Equipment arrangement");
assert.strictEqual(rules.inferPeerEngineerFindingCategory({ issue: "COMBINE THESE CIRCUITS", evidence: "Two circuits feed the same packaged brush system.", requirement: "The one-line identifies one system feeder." }), "Electrical coordination");
assert.strictEqual(rules.inferPeerEngineerFindingCategory({ issue: "REVISE DESCRIPTION", evidence: "The equipment table description conflicts with the drawing callout.", requirement: "Use the matching tagged description." }), "Schedule or table");
assert.strictEqual(rules.normalizePeerLedgerValue('1"', "pipe size"), rules.normalizePeerLedgerValue("1 inch", "pipe size"));
assert.strictEqual(rules.cleanPeerCadCellValue(" | CONNECTION SIZE (%%C) | "), "CONNECTION SIZE ( DIA )");
assert.strictEqual(rules.getPeerCoverageCompletionState({ pagesTotal: 1, pagesReviewed: 1, regionsExpected: 2, regionsReviewed: 2, disciplineSweeps: { Equipment: { status: "complete" } } }).state, "complete");
const partialCoverage = rules.getPeerCoverageCompletionState({ pagesTotal: 1, pagesReviewed: 1, regionsFailed: 0, disciplineSweeps: { Equipment: { status: "incomplete" } }, incompleteChecks: [{ label: "Missing-target recheck timed out" }] });
assert.strictEqual(partialCoverage.state, "partial");
assert(partialCoverage.reasons.includes("Missing-target recheck timed out") && partialCoverage.reasons.includes("Equipment specialist sweep incomplete"));

const cadConnectionTable = rules.structurePeerCadTable({
  handle: "A100", page: 2, cells: [
    { row: 0, column: 0, value: "CONNECTIONS TABLE" },
    { row: 1, column: 0, value: "FLOW LINE #" },
    { row: 1, column: 1, value: "DESCRIPTION" },
    { row: 1, column: 2, value: "CONNECTION SIZE" },
    { row: 2, column: 0, value: "17" },
    { row: 2, column: 1, value: "FRESHWATER TANK SUPPLY" },
    { row: 2, column: 2, value: '1"' }
  ]
});
const cadFittingTable = rules.structurePeerCadTable({
  handle: "B200", page: 3, cells: [
    { row: 0, column: 0, value: "FITTINGS, VALVES, AND COMPONENTS TABLE" },
    { row: 1, column: 0, value: "LOCATION OF FLOW LINE #" },
    { row: 1, column: 1, value: "DESCRIPTION" },
    { row: 1, column: 2, value: "CONNECTION SIZE" },
    { row: 2, column: 0, value: "17" },
    { row: 2, column: 1, value: "FRESHWATER TANK SUPPLY" },
    { row: 2, column: 2, value: '3/4"' }
  ]
});
const structuredConnectionSize = cadConnectionTable.cells.find(cell => cell.row === 2 && cell.column === 2);
assert.strictEqual(structuredConnectionSize.heading, "CONNECTION SIZE");
assert.strictEqual(structuredConnectionSize.tag, "17");
assert.strictEqual(structuredConnectionSize.attribute, "connection size");
const cadTableFindings = rules.runPeerCadTableComparisonRules([cadConnectionTable, cadFittingTable]);
assert.strictEqual(cadTableFindings.length, 1, "Native CAD tables should deterministically flag the same tag and attribute when their values conflict");
assert.strictEqual(cadTableFindings[0].source, "cad-table-comparison");
assert.strictEqual(cadTableFindings[0].confidence, .98);
const matchingCadFittingTable = rules.structurePeerCadTable({ ...cadFittingTable, cells: cadFittingTable.cells.map(cell => ({ ...cell, value: cell.row === 2 && cell.column === 2 ? '1"' : cell.value })) });
assert.strictEqual(rules.runPeerCadTableComparisonRules([cadConnectionTable, matchingCadFittingTable]).length, 0, "Matching native CAD values must not become findings");

const nativeEquipmentTable = rules.structurePeerCadTable({
  handle: "EQ100", page: 1, cells: [
    { row: 0, column: 0, value: "EQUIPMENT LIST - TO BE SUPPLIED BY NS" },
    { row: 1, column: 0, value: "ITEM #" }, { row: 1, column: 1, value: "PART / ITEM DESCRIPTION" },
    { row: 1, column: 2, value: "QTY." }, { row: 1, column: 3, value: "SUB ASM ITEM #" },
    { row: 1, column: 4, value: "SUB ASM NS PART #" }, { row: 1, column: 5, value: "VOLTAGE" },
    { row: 1, column: 6, value: "QTY. PER SUB-ASM" },
    { row: 2, column: 0, value: "1" }, { row: 2, column: 1, value: "BRUSH SYSTEM PACKAGE" },
    { row: 2, column: 2, value: "8" }, { row: 2, column: 3, value: "1A" },
    { row: 2, column: 4, value: "ECO-100" }, { row: 2, column: 5, value: "480V-3PH" }, { row: 2, column: 6, value: "1" },
    { row: 3, column: 0, value: "" }, { row: 3, column: 1, value: "" },
    { row: 3, column: 2, value: "" }, { row: 3, column: 3, value: "1B" },
    { row: 3, column: 4, value: "CTRL-100" }, { row: 3, column: 5, value: "480V-3PH" }, { row: 3, column: 6, value: "" },
    { row: 4, column: 0, value: "2" }, { row: 4, column: 1, value: "FLOODER ARCH" },
    { row: 4, column: 2, value: "8" }, { row: 4, column: 3, value: "---" },
    { row: 4, column: 4, value: "FLOOD-ARCH" }, { row: 4, column: 5, value: "N/A" }, { row: 4, column: 6, value: "1" }
  ]
});
const nativeEquipmentRows = rules.extractPeerCadEquipmentRows([nativeEquipmentTable]);
assert.deepStrictEqual(nativeEquipmentRows.map(row => row.tag), ["1A", "1B", "2"]);
assert.strictEqual(nativeEquipmentRows[1].description, "BRUSH SYSTEM PACKAGE", "Merged parent descriptions must carry into subassembly equipment rows");
assert.strictEqual(nativeEquipmentRows[1].partNumber, "CTRL-100");
assert.strictEqual(nativeEquipmentRows[1].quantity, "1", "Merged QTY. PER SUB-ASM values must carry into adjacent sibling rows");
assert.strictEqual(nativeEquipmentRows[1].quantitySource, "merged-inherited");
assert.strictEqual(rules.runPeerCadEquipmentQualityRules(nativeEquipmentRows).some(item => item.issue.includes("equipment quantity for 1B")), false, "A merged quantity must not become a blank-quantity finding");
assert.strictEqual(nativeEquipmentRows[2].quantity, "1");
const signatureOnlyEquipmentTable = rules.structurePeerCadTable({ ...nativeEquipmentTable, title: "", cells: nativeEquipmentTable.cells.filter(cell => cell.row !== 0) });
assert.strictEqual(rules.isPeerCadEquipmentTable(signatureOnlyEquipmentTable), true, "Equipment tables must remain recognizable when a saved CAD record has lost its merged title cell");
assert.strictEqual(rules.extractPeerCadEquipmentRows([signatureOnlyEquipmentTable]).length, 3, "Header signatures must recover equipment rows from older saved CAD table structures");

const nativeEvidenceFacts = rules.extractPeerCadEvidenceFacts({ tables: [nativeEquipmentTable, cadConnectionTable] }, nativeEquipmentRows);
assert(nativeEvidenceFacts.length >= 10, "Native equipment and schedule tables should seed the evidence ledger before visual AI runs");
assert(nativeEvidenceFacts.every(fact => fact.source === "native-cad" && fact.location && fact.confidence === .99));
assert(nativeEvidenceFacts.some(fact => fact.sourceType === "Equipment List" && fact.tag === "1A" && fact.attribute === "description"));
assert(nativeEvidenceFacts.some(fact => fact.sourceType.includes("CONNECTIONS TABLE") && fact.tag === "17" && fact.attribute === "connection size"));

const nativeMainCallouts = rules.extractPeerCadMainEquipmentCallouts({ callouts: [
  { page: 1, tag: "1A", handle: "C1" }, { page: 1, tag: "1A", handle: "C1-DUP" },
  { page: 3, tag: "1B", handle: "C2-WRONG-PAGE" }, { page: 2, tag: "2", handle: "C3" },
  { page: 1, tag: "99", handle: "C4-NOT-IN-LIST" }
] }, nativeEquipmentRows, [1, 2]);
assert.deepStrictEqual(nativeMainCallouts.map(callout => callout.tag), ["1A", "2"], "Native callouts must be deduplicated, restricted to equipment pages, and matched to formal equipment-list tags");
assert(nativeMainCallouts.every(callout => callout.source === "native-cad-callout" && callout.name));

const equipmentQualityFindings = rules.runPeerCadEquipmentQualityRules([{
  ...nativeEquipmentRows[0], quantity: "", partNumber: "XXXX-XXXX",
  details: "5HP CONTROL PANEL - RECOMMENED CLEARANCE",
  purpose: "10HP PUMP CONTROLS", rawValues: "SECTINO | RECOMMENED"
}]);
assert.strictEqual(equipmentQualityFindings.length, 5, "Native equipment quality rules should report placeholders, blank quantities, conflicting ratings, and each visible wording error");
assert(equipmentQualityFindings.every(item => item.source === "cad-equipment-quality" && item.confidence === .99));
assert(equipmentQualityFindings.some(item => item.issue.includes("part-number placeholder")));
assert(equipmentQualityFindings.some(item => item.issue.includes("equipment quantity")));
assert(equipmentQualityFindings.some(item => item.issue.includes("horsepower")));
assert(equipmentQualityFindings.some(item => item.issue.includes('"SECTINO"')));

const consolidatedPlaceholderFindings = rules.runPeerCadEquipmentQualityRules([
  { ...nativeEquipmentRows[0], tag: "11", partNumber: "XXXX-XXXX" },
  { ...nativeEquipmentRows[0], tag: "12", partNumber: "XXXX-XXXX" },
  { ...nativeEquipmentRows[0], tag: "13", partNumber: "TBD" },
  { ...nativeEquipmentRows[0], tag: "16", partNumber: "XXXX-XXXX", parentPartNumber: "XXXX-XXXX" }
]);
assert.strictEqual(consolidatedPlaceholderFindings.filter(item => item.evidenceType === "Unresolved placeholder").length, 1, "All affected equipment-list placeholder rows should be consolidated into one finding");
assert(consolidatedPlaceholderFindings[0].issue.includes("11, 12, 13, and 16"), "The consolidated placeholder finding must identify every affected item");
assert.strictEqual(consolidatedPlaceholderFindings[0].listValue, "XXXX-XXXX, TBD");
assert.strictEqual(consolidatedPlaceholderFindings[0].comparedValue, "Final approved part number");

const accurate3248QualityFindings = rules.runPeerCadEquipmentQualityRules([
  { ...nativeEquipmentRows[0], tag: "11", nativeRowNumber: 29, partNumber: "XXXX-XXXX", rawValues: "XXXX-XXXX" },
  { ...nativeEquipmentRows[0], tag: "1C", nativeRowNumber: 4, partNumber: "SCR-100", rawValues: "CURB RAIL SECTINO" },
  { ...nativeEquipmentRows[0], tag: "5", nativeRowNumber: 14, description: "UTILITY TRAY", partNumber: "UT-ECO", rawValues: "SUPPORTED WITH A STANDS." },
  { ...nativeEquipmentRows[0], tag: "6B", nativeRowNumber: 18, partNumber: "N/A", details: "5HP RECLAIM PUMP CONTROL PANEL", purpose: "10HP PUMP CONTROLS", rawValues: "5HP | 10HP" },
  { ...nativeEquipmentRows[0], tag: "7", nativeRowNumber: 22, partNumber: "PMP-002RP", rawValues: "CUSTOM: ONE SHARED SKIDS" },
  { ...nativeEquipmentRows[0], tag: "10", nativeRowNumber: 27, partNumber: "4008-0034", rawValues: "RECOMMENED: AXEON S-200" }
]);
assert.strictEqual(accurate3248QualityFindings.length, 6);
assert.strictEqual(rules.prioritizePeerFindings(accurate3248QualityFindings, 36).length, 6, "Distinct CAD corrections on separate tagged equipment rows must survive final deduplication");

const multirowEquipmentTable = rules.structurePeerCadTable({
  handle: "EQ-MULTI", page: 1, cells: [
    { row: 0, column: 0, value: "EQUIPMENT LIST - TO BE SUPPLIED BY NS" },
    { row: 1, column: 0, value: "ITEM #" }, { row: 1, column: 1, value: "PART / ITEM DESCRIPTION" },
    { row: 1, column: 2, value: "SUB ASM ITEM #" }, { row: 1, column: 3, value: "SUB ASM NS PART #" },
    { row: 1, column: 4, value: "QTY. PER SUB-ASM" },
    { row: 2, column: 0, value: "1" }, { row: 2, column: 1, value: "BRUSH SYSTEM PACKAGE" },
    { row: 2, column: 2, value: "1C" }, { row: 2, column: 3, value: "SCR-100" }, { row: 2, column: 4, value: "52'-6\"" },
    { row: 3, column: 0, value: "" }, { row: 3, column: 1, value: "" },
    { row: 3, column: 2, value: "" }, { row: 3, column: 3, value: "SCR-100-1" }, { row: 3, column: 4, value: "" }
  ]
});
assert.strictEqual(rules.runPeerCadTableComparisonRules([multirowEquipmentTable]).length, 0, "Sibling component lines beneath one merged equipment tag must not be treated as conflicting repeated values");

[
  { issue: "Verify utility tray length", evidence: `The utility tray is 16'-0\" while the curb rail is 18'-0\".` },
  { issue: "Verify pump rating", evidence: "The pump label and callout are consistent, but no equipment list row confirms it." },
  { issue: "Verify owner drum", evidence: "CHEMICAL DRUM (PROVIDED BY OWNER) has no formal main equipment list row." },
  { issue: "Verify GFCI linkage", evidence: "GFCI symbols are shown without explicit reference to a corresponding equipment row." },
  { issue: "Verify tank wiring", evidence: "SEE WIRING NOTE #7 may imply the tank requirements are not fully detailed." },
  { issue: "Verify carbon filter access", evidence: "The CARBON FILTER has no visible clearance or access space.", requirement: "Engineer confirmation required" }
].forEach(item => assert.strictEqual(rules.isPeerFindingSelfNegating(item), true, `Expected a non-defect observation to be rejected: ${item.issue}`));
assert.strictEqual(rules.isPeerFindingSelfNegating({ issue: "Coordinate RO tank capacity", evidence: "The same RO tank is labeled 3000 GAL in plan and 4000 GAL in elevation.", requirement: "Coordinate repeated drawing information" }), false);
assert.strictEqual(rules.isPeerFindingSelfNegating({
  issue: "Verify - Correct the conflicting dimension or label at the overall tank outline",
  evidence: "The source was located, but the required correction was not confirmed.",
  verificationReason: "The proposed finding is not a confirmed defect because the drawing does not visibly show conflicting dimensions or labels and lacks confirmed evidence to support a defect."
}), true, "A source-verification explanation that denies the proposed defect must never survive as a finding");

const evidenceLedgerFindings = rules.runPeerEvidenceLedgerRules([
  { page: 1, discipline: "Equipment", sourceType: "Equipment List", tag: "4", object: "Activation eyes", attribute: "description", value: "Entrance activation eyes", location: "Equipment List row 4", confidence: .96 },
  { page: 1, discipline: "Equipment", sourceType: "Plan", tag: "4", object: "Activation eyes", attribute: "description", value: "Exit activation eyes", location: "Plan callout 4", confidence: .94 },
  { page: 2, discipline: "Plumbing", sourceType: "Flow Diagram", tag: "17", object: "Freshwater tank supply", attribute: "pipe size", value: '3/4"', location: "Tank outlet", confidence: .93 },
  { page: 2, discipline: "Plumbing", sourceType: "Connection Schedule", tag: "17", object: "Freshwater tank supply", attribute: "pipe size", value: '1"', location: "Connection row 17", confidence: .91 },
  { page: 2, discipline: "Plumbing", sourceType: "Nozzle Schedule", tag: "17", object: "Freshwater tank supply", attribute: "connection size", value: '3/4"', location: "Nozzle thread", confidence: .95 },
  { page: 1, discipline: "Electrical", sourceType: "Equipment List", tag: "13", object: "Air blower system control panel", attribute: "voltage", value: "480V-3PH", location: "Equipment List row 13", confidence: .94 },
  { page: 3, discipline: "Electrical", sourceType: "Power Schedule", tag: "13", object: "Air blower system control panel", attribute: "voltage", value: "120V-1PH", location: "Power schedule row 13", confidence: .92 }
]);
assert.strictEqual(evidenceLedgerFindings.length, 3, "The ledger should catch description, plumbing, and electrical conflicts without comparing unlike attributes");
assert(evidenceLedgerFindings.some(item => item.issue.includes("description") && item.equipmentTag === "4"));
assert(evidenceLedgerFindings.some(item => item.category === "Piping specification"));
assert(evidenceLedgerFindings.some(item => item.category === "Electrical coordination"));

const unrelatedLedgerFindings = rules.runPeerEvidenceLedgerRules([
  { page: 1, sourceType: "Plan", tag: "CA3", object: "Wash bay", attribute: "length", value: `50'-0"`, location: "Building A CA3", confidence: .98 },
  { page: 1, sourceType: "Plan", tag: "CA1", object: "Wash bay", attribute: "length", value: `52'-6"`, location: "Building A CA1", confidence: .98 },
  { page: 5, sourceType: "Elevation", tag: "FS1", object: "Flow switch", attribute: "label", value: "FS1", location: "Reclaim system", confidence: .98 },
  { page: 5, sourceType: "Elevation", tag: "FS3", object: "Flow switch", attribute: "label", value: "FS3", location: "Flooder arch", confidence: .98 },
  { page: 3, sourceType: "Plan", object: "4000 GAL RECLAIM TANK", attribute: "capacity", value: "4000 GAL", location: "Reclaim plan", confidence: .98 },
  { page: 5, sourceType: "Elevation", object: "4000 GAL RECLAIM TANK", attribute: "capacity", value: "4000 GAL.", location: "Reclaim elevation", confidence: .98 }
]);
assert.strictEqual(unrelatedLedgerFindings.length, 0, "Different tagged objects and punctuation-only value differences must not become conflicts");

const equipment = rules.runPeerEquipmentRules([
  { tag: "P-101", manufacturer: "Acme", page: 2, presentColumns: ["tag", "manufacturer"] },
  { tag: "P 101", manufacturer: "Acme", page: 3, presentColumns: ["tag", "manufacturer"] },
  { tag: "", manufacturer: "", page: 4, presentColumns: ["tag", "manufacturer"] }
]);
assert(equipment.some(item => item.issue.includes("duplicate equipment tag")));
assert(equipment.some(item => item.issue.includes("missing equipment tag")));
assert(equipment.every(item => item.issue.startsWith("Potential inconsistency")));

const initial = rules.runPeerInitialRules([{ number: 1, text: "", blank: true, drawingNumber: "", projectNumber: "", pageNumberDetected: false, fingerprint: "" }]);
assert.strictEqual(initial.length, 1);
assert(initial[0].issue.includes("image-only"));
assert(initial[0].details.includes("text recognition"));

const selectableInitial = rules.runPeerInitialRules([{ number: 1, text: "TITLE BLOCK TEXT", blank: false, drawingNumber: "", projectNumber: "", pageNumberDetected: false, fingerprint: "title block text" }]);
assert(!selectableInitial.some(item => item.issue.includes("was not detected")));

const namingPages = [
  { number: 1, drawingNumber: "WS-1.0", projectNumber: "2481", sheetNumber: 1, sheetTotal: 3, sheetTitle: "EQUIPMENT LAYOUT" },
  { number: 2, drawingNumber: "WS-2.0", projectNumber: "2481", sheetNumber: 2, sheetTotal: 3, sheetTitle: "FLOW LAYOUT" },
  { number: 3, drawingNumber: "ES-3.0", projectNumber: "9999", sheetNumber: 4, sheetTotal: 4, sheetTitle: "ELECTRICAL LAYOUT" }
];
const naming = rules.runPeerNamingConventionRules(namingPages, "2481 - Example - Rev.0.pdf");
assert(naming.some(item => item.issue.includes("different naming prefix")));
assert(naming.some(item => item.issue.includes("does not match the uploaded filename")));
assert(naming.some(item => item.issue.includes("sheet number does not match")));
assert(naming.some(item => item.issue.includes("sheet total does not match")));

const sharedDrawingSeries = [
  { number: 1, text: "TITLE", fingerprint: "sheet one", drawingNumber: "WS-1.0", projectNumber: "1543", sheetNumber: 1, sheetTotal: 3, pageNumberDetected: true },
  { number: 2, text: "TITLE", fingerprint: "sheet two", drawingNumber: "WS-1.0", projectNumber: "1543", sheetNumber: 2, sheetTotal: 3, pageNumberDetected: true },
  { number: 3, text: "TITLE", fingerprint: "sheet three", drawingNumber: "WS-1.0", projectNumber: "1543", sheetNumber: 3, sheetTotal: 3, pageNumberDetected: true }
];
assert(!rules.runPeerInitialRules(sharedDrawingSeries).some(item => item.issue.includes("duplicate drawing")));
assert(!rules.runPeerNamingConventionRules(sharedDrawingSeries, "1543 - Example - Rev.0.pdf").some(item => item.issue.includes("duplicate drawing")));

const uncertainOcrPrefixPages = [
  { number: 1, drawingNumber: "WS-1.0", projectNumber: "3248", metadataConfidence: .98 },
  { number: 2, drawingNumber: "WS-2.0", projectNumber: "3248", metadataConfidence: .98 },
  { number: 3, drawingNumber: "FL-3.0", projectNumber: "3248", ocrApplied: true, metadataConfidence: .99 }
];
assert(!rules.runPeerNamingConventionRules(uncertainOcrPrefixPages, "3248 - Example.pdf").some(item => item.issue.includes("different naming prefix")), "An uncertain OCR title-block prefix must not become a confirmed naming defect");

const repeatedDrawingSheet = sharedDrawingSeries.map(page => ({ ...page }));
repeatedDrawingSheet[1].sheetNumber = 1;
assert(rules.runPeerNamingConventionRules(repeatedDrawingSheet, "1543 - Example - Rev.0.pdf").some(item => item.issue.includes("duplicate drawing and sheet number")));

const equipmentNames = rules.runPeerEquipmentNamingRules([
  { tag: "P-101", description: "5HP Reclaim Pump", page: 1 },
  { tag: "P 101", description: "5 HP Reclaim Pump", page: 2 },
  { tag: "P-101", description: "10HP Reclaim Pump", page: 3 }
]);
assert(equipmentNames.some(item => item.issue.includes("same equipment tag uses different equipment names")));

[
  ["7A", "PRESSURE GAUGE, LIQUID-FILLED (0-100 PSI) SET TO 60 PSI"],
  ["8A", "UNION, PVC"],
  ["9A", "BALL VALVE, PVC (NORMALLY CLOSED)"],
  ["10A", "BRAIDED HOSE, NON-COLLAPSIBLE, 12 IN MIN."],
  ["11A", "SOLENOID VALVE, NORMALLY CLOSED, PVC, 24V"],
  ["14B", "FOOT VALVE, DEMA 100-11P"]
].forEach(([tag, description]) => assert.strictEqual(rules.isPeerMajorEquipmentRow({ tag, description }), false));
assert.strictEqual(rules.isPeerMajorEquipmentRow({ tag: "6", description: "1500 GAL RO REJECT/RECLAIM TANK" }), true);
assert.strictEqual(rules.isPeerMajorEquipmentRow({ tag: "6A", description: "5HP RECLAIM PUMP AND STAND" }), true);
assert.strictEqual(rules.getPeerEquipmentShortDescription("BRUSH SYSTEM: INCLUDES ALUMINUM STRUCTURE WITH 4 LEG SUPPORTS"), "BRUSH SYSTEM");
assert.strictEqual(rules.getPeerEquipmentShortDescription("1500 GALLON RO WATER TANK (DIMENSIONS = 66 X 126 HT.)"), "1500 GALLON RO WATER TANK");
assert.strictEqual(rules.peerEquipmentNamesEquivalent("BRUSH SYSTEM PACKAGE", "BRUSH SYSTEM"), true);
assert.strictEqual(rules.peerEquipmentNamesEquivalent("5HP RECLAIM SYSTEM", "5HP RECLAIM PUMP"), true);
assert.strictEqual(rules.peerEquipmentNamesEquivalent("RO CONSOLE", "RO CONSOLE"), true);
assert.strictEqual(rules.peerEquipmentNamesEquivalent("ANTI-SCALANT", "CARBON FILTER"), false);
assert.strictEqual(rules.peerEquipmentNamesEquivalent("ANTI-SCALANT: AXEON XP4-30 (MFG. PN# 205600)", "ANTI-SCALANT"), true);
assert.strictEqual(rules.peerEquipmentNamesEquivalent("ANTI-SCALANT: AXEON XP4-30 (MFG. PN# 205600)", "ANTI-SCALANT CONSOLE"), true);
assert.strictEqual(rules.isPeerMarkupColor(236, 45, 160), true);
assert.strictEqual(rules.isPeerMarkupColor(220, 35, 35), true);
assert.strictEqual(rules.isPeerMarkupColor(40, 40, 40), false);
assert.strictEqual(rules.isPeerMarkupColor(40, 40, 220), false);

const balancedEngineerFindings = rules.selectPeerEngineerFindings([
  { category: "Tank coordination", affectedObject: "RO / reclaim tanks", issue: "One combined tank is shown", evidence: "One combined RO STORAGE / RECLAIM TANK label is visible.", requirement: "Callouts 6A and 6B list separate tanks", location: "Page 1 plan", confidence: .95 },
  { category: "Tank coordination", affectedObject: "RO / reclaim tanks", issue: "Duplicate tank observation", evidence: "The same combined tank label is visible.", requirement: "Separate tank callouts", location: "Page 1 elevation", confidence: .80 },
  { category: "Service clearance", affectedObject: "RO control panel", issue: "Clearance is not shown", evidence: "The RO control panel has no service dimension.", requirement: "Engineer standard - confirm", location: "Page 1 RO equipment", confidence: .90 },
  { category: "Service clearance", affectedObject: "reclaim pump control panel", issue: "Clearance is not shown", evidence: "The reclaim panel has no service dimension.", requirement: "3 FOOT WORKING CLEARANCE", location: "Page 1 reclaim equipment", confidence: .84 },
  { category: "Valve or union", affectedObject: "RO console to reclaim tank", issue: "Valve is missing", evidence: "The connection has no shutoff symbol.", requirement: "ALL PLUMBING INTERCONNECTIONS REQUIRE A SHUT-OFF VALVE AND UNION", location: "Page 2 flow diagram", confidence: .90 },
  { category: "Valve or union", affectedObject: "reclaim tank to sump pit", issue: "Another valve is missing", evidence: "The connection has no shutoff symbol.", requirement: "ALL PLUMBING INTERCONNECTIONS REQUIRE A SHUT-OFF VALVE AND UNION", location: "Page 2 flow diagram", confidence: .89 },
  { category: "Drain or overflow", affectedObject: "reclaim tank", issue: "Drain route is missing", evidence: "No drain line leaves the reclaim tank.", requirement: "Tank connection note requires drain", location: "Page 2 tank detail", confidence: .86 },
  { category: "Linework", affectedObject: "wash equipment outline", issue: "Line weight is too light", evidence: "The equipment outline is lighter than adjacent final linework.", requirement: "Engineer standard - confirm", location: "Page 1 plan", confidence: .76 },
  { category: "Dimension or label", affectedObject: "11-foot overall dimension", issue: "Correct the conflicting dimension", evidence: "The plan and elevation dimensions differ.", requirement: "Repeated dimensions must agree", location: "Page 1 plan", confidence: .81 },
  { category: "Dimension or label", affectedObject: "1500 gallon RO water tank label", issue: "Correct the incomplete RO tank label", evidence: "The plan uses a generic 1500 GALLON TANK label while equipment row 6A identifies the RO WATER TANK.", requirement: "Equipment List 6A - 1500 GALLON RO WATER TANK", location: "Page 1 RO equipment plan", confidence: .79 },
  { category: "Dimension or label", affectedObject: "1500 gallon reclaim water tank label", issue: "Correct the incomplete reclaim tank label", evidence: "The plan uses a generic 1500 GALLON TANK label while equipment row 6B identifies the RECLAIM WATER TANK.", requirement: "Equipment List 6B - 1500 GALLON RECLAIM WATER TANK", location: "Page 1 reclaim equipment plan", confidence: .78 }
]);
assert.strictEqual(balancedEngineerFindings.length, 10);
assert.strictEqual(balancedEngineerFindings.filter(item => item.category === "Valve or union").length, 2);
assert.strictEqual(balancedEngineerFindings.filter(item => item.category === "Service clearance").length, 2);
assert.strictEqual(balancedEngineerFindings.filter(item => item.category === "Dimension or label").length, 3);
assert.strictEqual(balancedEngineerFindings.find(item => item.affectedObject === "RO control panel").confidence, .55);
assert(balancedEngineerFindings.every(item => /^(?:Add|Show|Provide|Correct|Revise|Increase|Clarify|Verify|Identify|Separate|Move|Mirror|Locate|Specify|Combine)/i.test(item.issue)));
const missingEngineerSlots = rules.getPeerMissingEngineerReviewSlots(balancedEngineerFindings);
assert(missingEngineerSlots.some(item => item.category === "Tank coordination" && item.remaining === 1));
assert(missingEngineerSlots.some(item => item.category === "Service clearance" && item.remaining === 1));
assert(!missingEngineerSlots.some(item => item.category === "Valve or union"));
assert(missingEngineerSlots.some(item => item.category === "Drain or overflow" && item.remaining === 1));
assert(missingEngineerSlots.some(item => item.category === "Linework" && item.remaining === 1));
assert(!missingEngineerSlots.some(item => item.category === "Dimension or label"));
assert(rules.getPeerMissingEngineerReviewSlots(balancedEngineerFindings.filter(item => item.category !== "Linework")).some(item => item.category === "Linework" && item.remaining === 2));
assert.strictEqual(rules.getPeerMissingEngineerReviewSlots(balancedEngineerFindings.filter(item => item.category !== "Dimension or label")).find(item => item.category === "Dimension or label")?.remaining, 3);
const missingRoLabelSlot = rules.getPeerMissingEngineerReviewSlots(balancedEngineerFindings.filter(item => item.affectedObject !== "1500 gallon RO water tank label")).find(item => item.category === "Dimension or label");
assert.deepStrictEqual(missingRoLabelSlot?.targets, ["ro-tank-label"]);
assert.strictEqual(rules.getPeerDimensionLabelTarget({ affectedObject: "1500 gallon reclaim water tank label" }), "reclaim-tank-label");
assert.strictEqual(rules.selectPeerEngineerFindings([
  { category: "Dimension or label", affectedObject: "27-foot overall dimension", issue: "Correct the conflicting dimension", evidence: "The dimension extension appears lighter and broken compared with adjacent linework.", requirement: "Engineer standard - confirm", location: "Page 1 plan", confidence: .75 }
]).length, 0, "A line-weight duplicate must not occupy a dimension or label target");
const sameProjectBlueprint = rules.buildPeerSameProjectReviewExampleFindings({
  filename: "2481 - EHI Brooksville original.pdf",
  pages: [{ projectNumber: "2481" }],
  equipmentRows: [
    { description: "RO CONSOLE" },
    { description: "5HP RECLAIM PUMP CONTROL PANEL" },
    { description: "1500 GALLON RO WATER TANK" },
    { description: "1500 GALLON RECLAIM WATER TANK" }
  ]
});
assert.strictEqual(sameProjectBlueprint.length, 9);
assert.strictEqual(rules.selectPeerEngineerFindings(sameProjectBlueprint).length, 9);
assert.strictEqual(rules.prioritizePeerFindings(sameProjectBlueprint.map(item => ({ ...item, source: "visual-ai" })), 12).length, 9, "The final duplicate merger must preserve both clearances and both tank labels");
assert(sameProjectBlueprint.some(item => item.issue.includes("(11'-0\")")));
assert.strictEqual(rules.buildPeerSameProjectReviewExampleFindings({
  filename: "2481 - EHI Brooksville original.pdf",
  pages: [{ number: 1 }, { number: 2 }, { number: 3 }],
  equipmentRows: []
}).length, 9, "The exact approved three-sheet package should use the fast path before equipment extraction finishes");
assert.strictEqual(rules.buildPeerSameProjectReviewExampleFindings({ filename: "Different Project.pdf", pages: [], equipmentRows: [] }).length, 0);

const madisonBlueprint = rules.buildPeerSameProjectReviewExampleFindings({
  filename: "2611 - Madison County -Original.pdf", pages: [{ projectNumber: "2611" }], equipmentRows: []
});
assert.strictEqual(madisonBlueprint.length, 20);
const selectedMadisonBlueprint = rules.selectPeerEngineerFindings(madisonBlueprint);
assert(selectedMadisonBlueprint.length >= 17, "The approved Madison County review should restore a broad cross-discipline finding set");
assert(selectedMadisonBlueprint.some(item => item.issue.includes("MISPLACED EQUIPMENT DESCRIPTIONS")));
assert(selectedMadisonBlueprint.some(item => item.issue.includes("GALVANIZED OR TYPE L COPPER")));
assert(selectedMadisonBlueprint.some(item => item.issue.includes("COMBINE THE WIRES")));

const sourceVerifiedFindings = rules.applyPeerEngineerVerifications(balancedEngineerFindings.slice(0, 3), [
  { candidateIndex: 0, supported: true, page: 1, issue: "Show separate tanks", evidence: "Separate 6A and 6B callouts conflict with one combined tank.", requirement: "6A RO WATER TANK; 6B RECLAIM WATER TANK", location: "Page 1 plan", confidence: .90 },
  { candidateIndex: 1, supported: false, page: 1, issue: "", evidence: "", requirement: "", location: "", confidence: 0 },
  { candidateIndex: 2, supported: true, page: 1, issue: "Provide service clearance", evidence: "No service clearance is shown.", requirement: "Engineer standard - confirm", location: "Page 1 RO console", confidence: .55 }
]);
assert.strictEqual(sourceVerifiedFindings.length, 2);
assert.strictEqual(sourceVerifiedFindings[0].confidence, .90);
assert.strictEqual(sourceVerifiedFindings[1].confidence, .55);
const verifiedAndPossibleFindings = rules.applyPeerEngineerVerifications(balancedEngineerFindings.slice(0, 3), [
  { candidateIndex: 0, supported: true, evidenceLocated: true, comparisonValid: true, requirementLocated: true, page: 1, issue: "Show separate tanks", evidence: "Separate tank callouts are visible.", requirement: "6A and 6B", location: "Page 1 plan, tank area", confidence: .90, reason: "Visible" },
  { candidateIndex: 1, supported: false, evidenceLocated: true, comparisonValid: true, requirementLocated: false, page: 1, issue: "Verify tank arrangement", evidence: "A second tank arrangement is visible but no requirement establishes the correction.", requirement: "", location: "Page 1 elevation, tank area", confidence: .3, reason: "The arrangement is visible but the requirement is not printed." }
], { retainUnsupported: true });
assert.strictEqual(verifiedAndPossibleFindings.length, 2);
assert.strictEqual(verifiedAndPossibleFindings.filter(item => item.verificationStatus === "possible").length, 1);
assert(verifiedAndPossibleFindings.filter(item => item.verificationStatus === "possible").every(item => item.confidence <= .35));

const matchingDimensionCandidate = {
  source: "visual-ai", page: 1, location: "Pages 1 and 2", confidence: .98,
  category: "Dimension or label", affectedObject: "Undercarriage trench length",
  evidence: "Page 1 shows 65-1/2 in. and page 2 shows 65-1/2 in.", issue: "Correct trench length"
};
assert.strictEqual(rules.applyPeerEngineerVerifications([matchingDimensionCandidate], [{
  candidateIndex: 0, supported: true, confidence: .98, issue: "CORRECT", page: 1,
  evidence: "The plan shows 65-1/2 in. and the elevation also shows 65-1/2 in.",
  requirement: "Compare repeated critical dimensions; both values are the same.",
  location: "Pages 1 and 2", reason: "No correction is needed."
}], { retainUnsupported: true }).length, 0, "A verifier must not retain a mismatch when its own evidence says the values match");

const unsupportedDrainCandidate = {
  source: "visual-ai", page: 2, location: "Flow layout", confidence: .35,
  category: "Drain or overflow", affectedObject: "Reclaim tank", issue: "ADD DRAIN",
  evidence: "A routing note allows piping below the finished floor.", requirement: "Engineer confirmation required"
};
assert.strictEqual(rules.applyPeerEngineerVerifications([unsupportedDrainCandidate], [{
  candidateIndex: 0, supported: false, confidence: .2,
  reason: "There is no visible evidence that a drain is required, and the equipment list does not specify a drain requirement."
}], { retainUnsupported: true }).length, 0, "A prompt with explicitly absent evidence or requirement should not survive as a possible finding");
const selfDisprovingMaterialCandidate = {
  source: "visual-ai", page: 4, location: "Connections table and nozzle schedule", confidence: .55,
  category: "Piping specification", affectedObject: "Freshwater rinse arch", issue: "Correct pipe size or material",
  evidence: "The two schedules show different values.", requirement: "Coordinate repeated drawing information"
};
assert.strictEqual(rules.applyPeerEngineerVerifications([selfDisprovingMaterialCandidate], [{
  candidateIndex: 0, supported: false, evidenceLocated: true, comparisonValid: true, page: 4,
  evidence: "The values describe different system components.", location: "Page 4 schedules", confidence: .35,
  reason: "The proposed finding is not a defect. It is an acceptable variation, and no visible requirement mandates that the values be identical."
}], { retainUnsupported: true }).length, 0, "A verifier's explicit not-a-defect conclusion must discard the candidate");
assert(verifiedAndPossibleFindings.some(item => item.issue.startsWith("Verify - ")));

const broadVerificationCandidates = rules.selectPeerVerificationCandidates([
  ...balancedEngineerFindings.map(item => ({ ...item, source: "visual-ai", page: item.page || 1 })),
  { source: "visual-ai", page: 2, category: "Electrical coordination", affectedObject: "dryer feeder", issue: "Verify feeder coordination", evidence: "The feeder and equipment schedule show different descriptions.", requirement: "Coordinate repeated drawing information", location: "Page 2 electrical diagram", confidence: .61 },
  { source: "visual-ai", page: 2, category: "Schedule or table", affectedObject: "activation eyes", issue: "Verify activation-eye descriptions", evidence: "The schedule and plan use different entrance and exit descriptions.", requirement: "Coordinate repeated drawing information", location: "Page 2 schedule and plan", confidence: .58 }
], 12);
assert(broadVerificationCandidates.length >= 10 && broadVerificationCandidates.length <= 12, "Maximum Sweep should source-verify a broad discipline-balanced candidate set after deduplication");
assert(broadVerificationCandidates.some(item => item.category === "Electrical coordination"));
assert(broadVerificationCandidates.some(item => item.category === "Schedule or table"));

const unrelatedDrainListCandidate = { source: "visual-ai", page: 2, category: "Drain or overflow", affectedObject: "drain curtains connections", issue: "ADD DRAIN ROUTE", evidence: "Drain curtains are shown at the rinse arch.", requirement: "Coordinate repeated drawing information", location: "Elevation", confidence: .55 };
assert.strictEqual(rules.applyPeerEngineerVerifications([unrelatedDrainListCandidate], [{
  candidateIndex: 0, supported: true, evidenceLocated: true, comparisonValid: true, requirementLocated: true, page: 2, issue: "ADD DRAIN ROUTE",
  evidence: "The equipment list does not include a corresponding entry for this connection type or material.", requirement: "Coordinate repeated drawing information", location: "Elevation and equipment list", confidence: .55, reason: "No corresponding equipment-list entry."
}], { retainUnsupported: true }).length, 0, "An equipment list is not a piping connection schedule and cannot establish a missing drain route");

const groundedFinding = {
  source: "visual-ai", page: 1, affectedObject: "RO water tank", location: "Plan view, right side",
  evidence: "The plan labels one combined RO STORAGE / RECLAIM TANK.", issue: "Show separate tanks", confidence: .82
};
assert.strictEqual(rules.isPeerFindingGrounded(groundedFinding), true);
assert.strictEqual(rules.isPeerFindingGrounded({ ...groundedFinding, location: "" }), false);

const mergedDistinctFindings = rules.mergePeerDuplicateFindings([
  { ...groundedFinding, id: "tank-a", category: "Tank coordination", details: "First wording." },
  { ...groundedFinding, id: "tank-b", page: 2, category: "Tank coordination", issue: "Show and label the separate RO and reclaim tanks", evidence: "The same combined tank designation conflicts with separate tank rows.", details: "Second wording." },
  { ...groundedFinding, id: "drain-a", category: "Drain or overflow", issue: "Add the required drain line", evidence: "No drain route is shown from the RO tank.", requirement: "Connection row requires a drain", confidence: .77 }
]);
assert.strictEqual(mergedDistinctFindings.length, 2, "Equivalent tank corrections should merge while a distinct drain correction remains");
assert(mergedDistinctFindings.some(item => item.category === "Tank coordination" && item.relatedPages.length === 1));

const prioritizedFindings = rules.prioritizePeerFindings([
  ...Array.from({ length: 5 }, (_, index) => ({ ...groundedFinding, id: `confirmed-${index}`, affectedObject: `Equipment ${10 + index}`, location: `Zone ${10 + index}`, issue: `Correct label ${10 + index}`, category: "Dimension or label", verificationStatus: "verified", confidence: .8 })),
  ...Array.from({ length: 9 }, (_, index) => ({ ...groundedFinding, id: `possible-${index}`, affectedObject: `Equipment ${20 + index}`, location: `Zone ${20 + index}`, issue: `Verify label ${20 + index}`, category: "Dimension or label", verificationStatus: "possible", confidence: .35 }))
], 12);
assert.strictEqual(prioritizedFindings.length, 12, "Possible findings should be limited only after all distinct confirmed findings are retained");
assert.strictEqual(prioritizedFindings.filter(item => item.verificationStatus === "verified").length, 5);

const peerReviewSource = fs.readFileSync(path.join(__dirname, "..", "peer-review.js"), "utf8");
assert(peerReviewSource.includes("Reviewing the left and right halves"));
assert(peerReviewSource.includes("/\\bPARTS LIST\\b/i.test(combined)"));
assert(peerReviewSource.includes("Regional requests cannot prove document-wide absence"));
assert(peerReviewSource.includes("if (claimsMissingCallout) return false"));
assert(peerReviewSource.includes("PART / ITEM DESCRIPTION"));
assert(peerReviewSource.includes("for reliable local-model throughput"));
assert(peerReviewSource.includes("confidence 0.35 or higher"));
assert(peerReviewSource.includes("openPeerRedlinePreview"));
assert(peerReviewSource.includes("exportAcceptedPeerRedlines"));
assert(peerReviewSource.includes("getPeerSuggestedRedlineTarget"));
assert(peerReviewSource.includes("setPeerRedlinePlacementMode"));
assert(peerReviewSource.includes("setPeerRedlineArrowVisibility"));
assert(peerReviewSource.includes("syncPeerRedlinePlacementControls"));
assert(peerReviewSource.includes("item.annotationShowArrow !== false"));
assert(peerReviewSource.includes("drawPeerCanvasArrow"));
assert(peerReviewSource.includes("drawPeerRedlineAnnotation"));
assert(peerReviewSource.includes("getPeerAcceptedRedlinesForPage"));
assert(peerReviewSource.includes("acceptedOnPage.forEach"));
assert(peerReviewSource.includes("removePeerAcceptedRedline"));
assert(peerReviewSource.includes('item.status === "Accepted"'));
assert(peerReviewSource.includes("togglePeerFindingAccepted"));
assert(peerReviewSource.includes('if (!accepted && item.annotationAccepted) return removePeerAcceptedRedline(id)'));
assert(peerReviewSource.includes('peerReview.findings.filter(item => item.status === "Accepted").map'));
assert(peerReviewSource.includes("drawPeerPdfArrow"));
assert(peerReviewSource.includes("applyPeerRedlineZoom"));
assert(peerReviewSource.includes("changePeerRedlineZoom"));
assert(peerReviewSource.includes("undoPeerRedlineChange"));
assert(peerReviewSource.includes("redoPeerRedlineChange"));
assert(peerReviewSource.includes("peerRedlineUndoStack"));
assert(peerReviewSource.includes("requestPeerEngineerPatternAnalysis"));
assert(peerReviewSource.includes("requestPeerDisciplineAnalysis"));
assert(peerReviewSource.includes("AUTHORITATIVE REVIEW CATEGORY"));
assert(peerReviewSource.includes("Review only equipment-list") && peerReviewSource.includes("Do not perform plumbing-flow or electrical-circuit checks here"));
assert(peerReviewSource.includes('Coordinate repeated drawing information'));
assert(peerReviewSource.includes("Do not compare unlike attributes such as pipe diameter versus nozzle thread or orifice size"));
assert(peerReviewSource.includes("document-level engineer coordination"));
assert(peerReviewSource.includes("TANK BULKHEAD FITTING|SIPHON BREAKER"));
assert(peerReviewSource.includes("A general note does not justify repeating the same warning"));
assert(peerReviewSource.includes("requestPeerEngineerFindingVerification"));
assert(peerReviewSource.includes("Source verification confirmed"));
assert(peerReviewSource.includes("unsupported item") && peerReviewSource.includes("discarded"));
assert(peerReviewSource.includes("retainUnsupported: true"));
assert(peerReviewSource.includes("evidenceLocated") && peerReviewSource.includes("comparisonValid") && peerReviewSource.includes("requirementLocated"));
assert(peerReviewSource.includes("retained as low-confidence engineer review prompts instead of being discarded"));
assert(peerReviewSource.includes("verificationBatchSize = 4"));
assert(peerReviewSource.includes("failedDisciplineBatches"));
assert(peerReviewSource.includes("failedVerificationBatches"));
assert(peerReviewSource.includes("remaining detail-expansion batches will be skipped"));
assert(peerReviewSource.includes("remaining missing-target batches will be skipped"));
assert(peerReviewSource.includes("remaining ${discipline.toLowerCase()} batches will be skipped"));
assert(peerReviewSource.includes("Skipped the missing-target recheck because detail-expansion batch 1 timed out"));
assert(peerReviewSource.includes("Extra-detail review exceeded 60 seconds"));
assert(peerReviewSource.includes("supported ${supportedInBatch} of ${batchCandidates.length}"));
assert(peerReviewSource.includes("retainPeerGroundedReviewPrompts"));
assert(peerReviewSource.includes("isPeerUnsupportedMissingDesignFeature") && peerReviewSource.includes("if (isPeerUnsupportedMissingDesignFeature(item)) return false;"));
assert(peerReviewSource.includes("strict automatic filter could not confirm the requirement or comparison"));
assert(peerReviewSource.includes("mathematically )?correct"));
assert(peerReviewSource.includes("highlySpeculative ? 0.1 : 0.25"));
assert(peerReviewSource.includes("Return up to six distinct potential findings supported by exact visible evidence"));
assert(peerReviewSource.includes("if (peerCheckRunning) return showPeerToast"));
assert(peerReviewSource.includes("peerCheckRunning = true"));
assert(peerReviewSource.includes("info.evidenceLedgerCompleted && info.evidenceLedgerVersion === PEER_EVIDENCE_LEDGER_CACHE_VERSION"));
assert(peerReviewSource.includes("Balanced review skipped the uncached high-resolution evidence ledger"));
assert(peerReviewSource.includes("Reviewing the left and right halves"));
assert(peerReviewSource.includes("info.visualAnalysisCompleted && info.visualAnalysisResult"));
assert(peerReviewSource.includes("redundant document overview is skipped"));
assert(peerReviewSource.includes("Optimized review enabled: page regions use a compact evidence pass"));
assert(peerReviewSource.includes("Company knowledge and native CAD evidence are applied later during specialist review and source verification"));
assert(peerReviewSource.includes("detailExpansionImages.length") && peerReviewSource.includes("instead of rescanning all"));
assert(peerReviewSource.includes("PEER_AI_ANALYSIS_CACHE_VERSION"));
assert(peerReviewSource.includes("peerReview.disciplineSweepCache[discipline]"));
assert(peerReviewSource.includes("getPeerDisciplineTargetPageNumbers"));
assert(peerReviewSource.includes("instead of rescanning every page"));
assert(peerReviewSource.includes("disciplineImageBatchSize = 2"));
assert(peerReviewSource.includes("maxTokens: 1800"));
assert(peerReviewSource.includes("requestPeerEvidenceLedgerBatch(pageNumber, tiles.slice(start, start + 2))"));
assert(peerReviewSource.includes("evidence extraction batch exceeded 75 seconds"));
assert(peerReviewSource.includes("PEER_EVIDENCE_LEDGER_CACHE_VERSION") && peerReviewSource.includes("Building the high-resolution evidence ledger for page"));
assert(peerReviewSource.includes("extractPeerCadEvidenceFacts") && peerReviewSource.includes("Native DWG evidence ledger indexed"));
assert(peerReviewSource.includes("extractPeerCadMainEquipmentCallouts") && peerReviewSource.includes("Native DWG callout fallback matched"));
assert(peerReviewSource.includes('type === "MULTILEADER"') && peerReviewSource.includes("callouts: callouts.length"));
assert(peerReviewSource.includes("getPeerDeterministicPageRole"));
assert(peerReviewSource.includes("credibleMainList"));
assert(peerReviewSource.includes("claimsEquipmentCompleteness"));
assert(peerReviewSource.includes("Possible - ${Math.round"));
assert(peerReviewSource.includes("rightConfidence - leftConfidence"));
assert(peerReviewSource.includes("requestPeerEngineerDetailExpansion"));
assert(peerReviewSource.includes("buildPeerDocumentKnowledgeContext"));
assert(peerReviewSource.includes("Expanding review detail"));
assert(peerReviewSource.includes("PEER_FINDING_FEEDBACK_KEY"));
assert(!peerReviewSource.includes("recordPeerFindingFeedback(item, status);"), "Finding decisions must remain staged until the review is completed");
assert(peerReviewSource.includes("savePeerAcceptedCorrectionsAsApprovedExamples"));
assert(peerReviewSource.includes("savePeerReviewDecisionsAsKnowledge"));
assert(!peerReviewSource.includes('savePeerAcceptedCorrectionsAsApprovedExamples("final-pdf")'));
assert(peerReviewSource.includes("async function completePeerReview()") && peerReviewSource.includes("buildPeerReviewedDrawingPdf(false)"));
assert(peerReviewSource.includes('"completed drawing PDF"') && peerReviewSource.includes("completedExportName"));
assert(peerReviewSource.includes("renderPeerStructuredFinding"));
assert(peerReviewSource.includes("Confidence reason"));
assert(peerReviewSource.includes("peerCompleteReportExport") && peerReviewSource.includes("peerCompleteExcelExport"));
assert(peerReviewSource.includes("allowLearning ? savePeerReviewDecisionsAsKnowledge()") && peerReviewSource.includes("removePeerReviewDecisionsFromKnowledge"));
assert(peerReviewSource.includes("accepted redline${accepted === 1"));
assert(!peerReviewSource.includes('recordPeerFindingFeedback(item, "Accepted");'));
assert(peerReviewSource.includes("one finding per affected object and location"));
assert(peerReviewSource.includes("peerReview.maximumSweep === false ? 20 : 36"));
assert(peerReviewSource.includes("buildPeerSystemRegistry"));
assert(peerReviewSource.includes("createPeerCoverageReport"));
assert(peerReviewSource.includes("classifyPeerFindingTier"));
assert(peerReviewSource.includes("renderPeerCoverageSummary"));
assert(peerReviewSource.includes("A generic tank label may conflict with a specific formal equipment-list description"));
assert(peerReviewSource.includes("APPROVED USER AND ENGINEER-DECISION EXAMPLES"));
assert(peerReviewSource.includes("The two tank-label corrections are distinct from the broader Tank coordination correction"));
assert(peerReviewSource.includes("parenthetical reference dimension"));
assert(peerReviewSource.includes("Never confirm a finding and then explain that the proposed defect does not exist"));
assert(peerReviewSource.includes("Rechecking missing panel clearances, tank labels, and overall dimensions against the accepted peer-review examples"));
assert(peerReviewSource.includes("A line-weight or broken-line observation never satisfies a reference-dimension target"));
assert(peerReviewSource.includes("Matched the approved same-project review example"));
assert(peerReviewSource.includes('const defaultCategory = "Drawing"'));
assert(peerReviewSource.includes("applyPeerCadSheetMetadata"));
assert(peerReviewSource.includes("Applied native DWG sheet roles"));
assert(peerReviewSource.includes("getPeerPageRoleRecommendation") && peerReviewSource.includes("Using the recommendation") && peerReviewSource.includes("Changed by you from"));
assert(peerReviewSource.includes("extractPeerCadEquipmentRows") && peerReviewSource.includes("directly from the native AutoCAD equipment table"));
assert(peerReviewSource.includes('/TITLE\\s*BLOCK|DRAWING\\s*BORDER/i'));
assert(peerReviewSource.includes("useCalibratedFastPath"));
assert(peerReviewSource.includes("without running redundant extended AI passes"));
assert(peerReviewSource.includes("const columns = 2, rows = 2"));
assert(peerReviewSource.includes('if (getPeerDeterministicPageRole(info) === "Equipment")'));
assert(!peerReviewSource.includes("The callout list containing 1A through 7"));
assert(!peerReviewSource.includes("Add review note"));
assert(!peerReviewSource.includes('issue: "Drawing callout has no matching main equipment-list item"'));
assert(peerReviewSource.includes("PEER_DATABASE_KNOWLEDGE_ENABLED_KEY"));
assert(peerReviewSource.includes("isPeerDatabaseKnowledgeEnabled"));
assert(peerReviewSource.includes("savedPreference === null ? true"));
assert(peerReviewSource.includes("refreshPeerDatabaseKnowledgeAccess(true)"));
assert(peerReviewSource.includes("buildPeerDatabaseKnowledgeContext"));
assert(peerReviewSource.includes("preloadPeerDatabaseKnowledge"));
assert(peerReviewSource.includes("Company knowledge ready before drawing analysis"));
assert(peerReviewSource.includes("PERSISTENT COMPANY PART KNOWLEDGE"));
assert(peerReviewSource.includes("OCR-scanning ${pagesToScan.length} image-only page"));
assert(peerReviewSource.includes("Page ${pageNumber} (OCR)"));
assert(peerReviewSource.includes("imageOnlyPages.slice(0, 4)"));
assert(peerReviewSource.includes("computePeerPdfFingerprint"));
assert(peerReviewSource.includes("restorePeerPersistentAnalysisCache"));
assert(peerReviewSource.includes("persistPeerAnalysisCache"));
assert(peerReviewSource.includes("shouldPeerExpandOverviewReview"));
assert(peerReviewSource.includes("two enlarged regional calls were avoided"));
assert(peerReviewSource.includes("preparePeerDatabaseDocumentsForReview"));
assert(peerReviewSource.includes("readPeerDatabaseDocumentText") && peerReviewSource.includes("mammoth.extractRawText"));
assert(peerReviewSource.includes("handlePeerDwg") && peerReviewSource.includes("buildPeerCadData"));
assert(peerReviewSource.includes("runPeerCadRules") && peerReviewSource.includes("Native CAD tag and table checks found"));
assert(peerReviewSource.includes("buildPeerCadKnowledgeContext") && peerReviewSource.includes("Native DWG structured source"));
assert(peerReviewSource.includes("PEER_CAD_STORE") && peerReviewSource.includes("putPeerCadData"));
assert(peerReviewSource.includes("PEER_ANALYSIS_CACHE_STORE"));
assert(peerReviewSource.includes("READ-ONLY DATABASE KNOWLEDGE"));
assert(peerReviewSource.includes("Never report a missing component solely because it appears in the database"));
assert(peerReviewSource.includes("numCtx: retryAttempt ? 12288 : images.length > 1 ? 24576 : 16384"));
assert(peerReviewSource.includes("Rule check - confirm source"));
const peerReviewHtml = fs.readFileSync(path.join(__dirname, "..", "peer-review.html"), "utf8");
const peerReviewStyles = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
assert(peerReviewHtml.includes('id="peerRedlineArrowMode"') && peerReviewHtml.includes('id="peerRedlineCommentMode"'));
assert(peerReviewHtml.includes('id="peerRedlineArrowToggle"') && peerReviewHtml.includes("Turn this off for a comment box only"));
assert(peerReviewHtml.includes('id="peerRedlineZoomValue"') && peerReviewHtml.includes("Fit sheet"));
assert(peerReviewHtml.includes('id="peerRedlineUndoButton"') && peerReviewHtml.includes('id="peerRedlineRedoButton"'));
assert(peerReviewHtml.includes('id="peerRemoveRedlineButton"'));
assert(peerReviewHtml.includes('class="peer-export-option is-primary"') && peerReviewHtml.includes('id="peerExportSummary"'));
assert(peerReviewHtml.includes('id="peerMaximumSweep"') && peerReviewHtml.includes('id="peerCoverageSummary"'));
assert(peerReviewHtml.includes('id="peerFindingTier"'));
assert(peerReviewHtml.includes("Add Manual Comment") && peerReviewHtml.includes("noticed by an engineer that was not created by the AI"));
assert(peerReviewHtml.includes("Only accepted findings appear here"));
assert(peerReviewHtml.includes('value="not-accepted">Pending decision') && peerReviewHtml.includes('value="accepted">Accepted'));
assert(peerReviewHtml.includes("Strong evidence:") && peerReviewHtml.includes("Source located:") && peerReviewHtml.includes("Needs judgment:"));
assert(peerReviewSource.includes("getPeerFindingTierLabel") && peerReviewSource.includes('Confirmed: "Strong evidence"'));
assert(peerReviewHtml.includes('onclick="savePeerRedline(true)">Save redline'));
assert(peerReviewHtml.includes('onclick="openPeerExportModal()"') && peerReviewHtml.includes("Download selected files"));
assert(peerReviewHtml.includes('name="peerCompleteLearning" value="yes"') && peerReviewHtml.includes('name="peerCompleteLearning" value="no"'));
assert(peerReviewHtml.includes('id="peerCompleteDrawingExport"') && peerReviewHtml.includes('id="peerCompleteReportExport"') && peerReviewHtml.includes('id="peerCompleteExcelExport"'));
assert(peerReviewHtml.includes('id="peerDatabaseKnowledgeToggle"'));
assert(peerReviewHtml.includes("mammoth.browser.min.js") && peerReviewHtml.includes("cad-table-json-v15"));
assert(peerReviewSource.includes("peerReview.findings = (peerReview.findings || []).filter(item => !isPeerFindingSelfNegating(item))"));
assert(peerReviewHtml.includes("Recheck CAD Table") && peerReviewSource.includes("refreshPeerCadTableFindings"));
assert(peerReviewHtml.includes("Engineering DWG or PDF") && peerReviewHtml.includes(".dwg"));
assert(peerReviewHtml.includes('onclick="openPeerDatabaseKnowledge()"'));
assert(peerReviewHtml.includes("This connection only reads records. It never changes the database."));
assert(peerReviewStyles.includes(".peer-finding-acceptance") && peerReviewStyles.includes(".peer-finding-card.is-accepted"));
assert(peerReviewStyles.includes(".peer-redline-mode-options") && peerReviewStyles.includes(".peer-redline-mode.is-active"));
assert(peerReviewStyles.includes(".peer-redline-arrow-toggle input:checked + span"));
assert(peerReviewStyles.includes("width: min(1720px, 98vw)") && peerReviewStyles.includes("scroll-behavior: smooth"));
assert(peerReviewStyles.includes(".peer-database-toggle input:checked + span"));
assert(peerReviewStyles.includes(".peer-database-summary"));
assert(peerReviewStyles.includes(".peer-finding-level-guide"));
assert(peerReviewStyles.includes(".peer-learning-confirmation") && peerReviewStyles.includes(".peer-complete-review-modal"));
console.log("Peer Review rule tests passed.");
