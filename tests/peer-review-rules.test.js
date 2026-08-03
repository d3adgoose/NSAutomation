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
assert(verifiedAndPossibleFindings.some(item => item.issue.startsWith("Verify - ")));

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
assert(peerReviewSource.includes("retrying each half separately"));
assert(peerReviewSource.includes("/\\bPARTS LIST\\b/i.test(combined)"));
assert(peerReviewSource.includes("Regional requests cannot prove document-wide absence"));
assert(peerReviewSource.includes("if (claimsMissingCallout) return false"));
assert(peerReviewSource.includes("PART / ITEM DESCRIPTION"));
assert(peerReviewSource.includes("Reviewing both halves of page"));
assert(peerReviewSource.includes("confidence 0.35 or higher"));
assert(peerReviewSource.includes("openPeerRedlinePreview"));
assert(peerReviewSource.includes("exportAcceptedPeerRedlines"));
assert(peerReviewSource.includes("getPeerSuggestedRedlineTarget"));
assert(peerReviewSource.includes("setPeerRedlinePlacementMode"));
assert(peerReviewSource.includes("drawPeerCanvasArrow"));
assert(peerReviewSource.includes("drawPeerRedlineAnnotation"));
assert(peerReviewSource.includes("getPeerAcceptedRedlinesForPage"));
assert(peerReviewSource.includes("acceptedOnPage.forEach"));
assert(peerReviewSource.includes("removePeerAcceptedRedline"));
assert(peerReviewSource.includes('item.status === "Accepted"'));
assert(peerReviewSource.includes("drawPeerPdfArrow"));
assert(peerReviewSource.includes("applyPeerRedlineZoom"));
assert(peerReviewSource.includes("changePeerRedlineZoom"));
assert(peerReviewSource.includes("undoPeerRedlineChange"));
assert(peerReviewSource.includes("redoPeerRedlineChange"));
assert(peerReviewSource.includes("peerRedlineUndoStack"));
assert(peerReviewSource.includes("requestPeerEngineerPatternAnalysis"));
assert(peerReviewSource.includes("requestPeerDisciplineAnalysis"));
assert(peerReviewSource.includes('const disciplineSweeps = ["Drawing coordination", "Equipment", "Plumbing", "Electrical"]'));
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
assert(peerReviewSource.includes("unverified document-level candidates were discarded"));
assert(peerReviewSource.includes("requestPeerEvidenceLedgerBatch(pageNumber, tiles.slice(start, start + 2))"));
assert(peerReviewSource.includes("evidence extraction batch exceeded 75 seconds"));
assert(peerReviewSource.includes("getPeerDeterministicPageRole"));
assert(peerReviewSource.includes("credibleMainList"));
assert(peerReviewSource.includes("claimsEquipmentCompleteness"));
assert(peerReviewSource.includes("Possible - ${Math.round"));
assert(peerReviewSource.includes("requestPeerEngineerDetailExpansion"));
assert(peerReviewSource.includes("buildPeerDocumentKnowledgeContext"));
assert(peerReviewSource.includes("Expanding review detail"));
assert(peerReviewSource.includes("PEER_FINDING_FEEDBACK_KEY"));
assert(peerReviewSource.includes("recordPeerFindingFeedback(item, status)"));
assert(peerReviewSource.includes("one finding per affected object and location"));
assert(peerReviewSource.includes("prioritizePeerFindings(automatic, 20)"));
assert(peerReviewSource.includes("A generic tank label may conflict with a specific formal equipment-list description"));
assert(peerReviewSource.includes("APPROVED USER AND ENGINEER-DECISION EXAMPLES"));
assert(peerReviewSource.includes("The two tank-label corrections are distinct from the broader Tank coordination correction"));
assert(peerReviewSource.includes("parenthetical reference dimension"));
assert(peerReviewSource.includes("Never confirm a finding and then explain that the proposed defect does not exist"));
assert(peerReviewSource.includes("Rechecking missing panel clearances, tank labels, and overall dimensions against the accepted peer-review examples"));
assert(peerReviewSource.includes("A line-weight or broken-line observation never satisfies a reference-dimension target"));
assert(peerReviewSource.includes("Matched the approved same-project review example"));
assert(peerReviewSource.includes('const defaultCategory = number === 2 ? "Plumbing" : number === 3 ? "Electrical" : "Drawing"'));
assert(peerReviewSource.includes("useCalibratedFastPath"));
assert(peerReviewSource.includes("without running redundant extended AI passes"));
assert(peerReviewSource.includes("const columns = 2, rows = 2"));
assert(peerReviewSource.includes('regionalEquipmentHint || getPeerDeterministicPageRole(info) === "Equipment"'));
assert(!peerReviewSource.includes("The callout list containing 1A through 7"));
assert(!peerReviewSource.includes("Add review note"));
assert(!peerReviewSource.includes('issue: "Drawing callout has no matching main equipment-list item"'));
assert(peerReviewSource.includes("Rule check · confirm source"));
const peerReviewHtml = fs.readFileSync(path.join(__dirname, "..", "peer-review.html"), "utf8");
const peerReviewStyles = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
assert(peerReviewHtml.includes('id="peerRedlineArrowMode"') && peerReviewHtml.includes('id="peerRedlineCommentMode"'));
assert(peerReviewHtml.includes('id="peerRedlineZoomValue"') && peerReviewHtml.includes("Fit sheet"));
assert(peerReviewHtml.includes('id="peerRedlineUndoButton"') && peerReviewHtml.includes('id="peerRedlineRedoButton"'));
assert(peerReviewHtml.includes('id="peerRemoveRedlineButton"'));
assert(peerReviewStyles.includes("width: min(1720px, 98vw)") && peerReviewStyles.includes("scroll-behavior: smooth"));
console.log("Peer Review rule tests passed.");
