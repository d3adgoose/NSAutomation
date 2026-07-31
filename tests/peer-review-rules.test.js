const assert = require("assert");
const fs = require("fs");
const path = require("path");
const rules = require("../peer-review-utils.js");

assert.strictEqual(rules.PEER_REVIEW_TYPES.overall.label, "Overall Peer Review");
assert.strictEqual(rules.PEER_REVIEW_TYPES.overall.available, true);

assert.strictEqual(rules.normalizePeerValue("P-101", "tag"), rules.normalizePeerValue("p 101", "tag"));
assert.strictEqual(rules.normalizePeerValue("3 phase", "phase"), rules.normalizePeerValue("3PH", "phase"));
assert.strictEqual(rules.peerValuesEquivalent("460 Volts", "460V", "voltage"), true);
assert.strictEqual(rules.mapPeerEquipmentHeader("Mfr"), "manufacturer");

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
  { category: "Dimension or label", affectedObject: "11-foot overall dimension", issue: "Correct the conflicting dimension", evidence: "The plan and elevation dimensions differ.", requirement: "Repeated dimensions must agree", location: "Page 1 plan", confidence: .81 }
]);
assert.strictEqual(balancedEngineerFindings.length, 7);
assert.strictEqual(balancedEngineerFindings.filter(item => item.category === "Valve or union").length, 1);
assert.strictEqual(balancedEngineerFindings.filter(item => item.category === "Service clearance").length, 2);
assert.strictEqual(balancedEngineerFindings.find(item => item.affectedObject === "RO control panel").confidence, .55);
assert(balancedEngineerFindings.every(item => /^(?:Add|Show|Provide|Correct|Revise|Increase|Clarify|Verify|Identify|Separate)/i.test(item.issue)));
const missingEngineerSlots = rules.getPeerMissingEngineerReviewSlots(balancedEngineerFindings);
assert(!missingEngineerSlots.some(item => item.category === "Tank coordination"));
assert(!missingEngineerSlots.some(item => item.category === "Service clearance"));
assert(!missingEngineerSlots.some(item => item.category === "Valve or union"));
assert(!missingEngineerSlots.some(item => item.category === "Drain or overflow"));
assert(!missingEngineerSlots.some(item => item.category === "Linework"));
assert(!missingEngineerSlots.some(item => item.category === "Dimension or label"));
assert(rules.getPeerMissingEngineerReviewSlots(balancedEngineerFindings.filter(item => item.category !== "Linework")).some(item => item.category === "Linework" && item.remaining === 1));

const sourceVerifiedFindings = rules.applyPeerEngineerVerifications(balancedEngineerFindings.slice(0, 3), [
  { candidateIndex: 0, supported: true, page: 1, issue: "Show separate tanks", evidence: "Separate 6A and 6B callouts conflict with one combined tank.", requirement: "6A RO WATER TANK; 6B RECLAIM WATER TANK", location: "Page 1 plan", confidence: .90 },
  { candidateIndex: 1, supported: false, page: 1, issue: "", evidence: "", requirement: "", location: "", confidence: 0 },
  { candidateIndex: 2, supported: true, page: 1, issue: "Provide service clearance", evidence: "No service clearance is shown.", requirement: "Engineer standard - confirm", location: "Page 1 RO console", confidence: .55 }
]);
assert.strictEqual(sourceVerifiedFindings.length, 2);
assert.strictEqual(sourceVerifiedFindings[0].confidence, .90);
assert.strictEqual(sourceVerifiedFindings[1].confidence, .55);
const verifiedAndPossibleFindings = rules.applyPeerEngineerVerifications(balancedEngineerFindings.slice(0, 3), [
  { candidateIndex: 0, supported: true, page: 1, issue: "Show separate tanks", evidence: "Separate tank callouts are visible.", requirement: "6A and 6B", location: "Page 1", confidence: .90, reason: "Visible" },
  { candidateIndex: 1, supported: false, page: 1, issue: "", evidence: "", requirement: "", location: "", confidence: 0, reason: "The clearance requirement is not printed." }
], { retainUnsupported: true });
assert.strictEqual(verifiedAndPossibleFindings.length, 3);
assert.strictEqual(verifiedAndPossibleFindings.filter(item => item.verificationStatus === "possible").length, 2);
assert(verifiedAndPossibleFindings.filter(item => item.verificationStatus === "possible").every(item => item.confidence <= .35));
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
assert(peerReviewSource.includes("requestPeerEngineerPatternAnalysis"));
assert(peerReviewSource.includes("document-level engineer coordination"));
assert(peerReviewSource.includes("TANK BULKHEAD FITTING|SIPHON BREAKER"));
assert(peerReviewSource.includes("A general note does not justify repeating the same warning"));
assert(peerReviewSource.includes("requestPeerEngineerFindingVerification"));
assert(peerReviewSource.includes("Source verification confirmed"));
assert(peerReviewSource.includes("Possible - ${Math.round"));
assert(peerReviewSource.includes("requestPeerEngineerDetailExpansion"));
assert(peerReviewSource.includes("buildPeerDocumentKnowledgeContext"));
assert(peerReviewSource.includes("Expanding review detail"));
assert(peerReviewSource.includes("PEER_FINDING_FEEDBACK_KEY"));
assert(peerReviewSource.includes("recordPeerFindingFeedback(item, status)"));
assert(peerReviewSource.includes("one finding per affected object and location"));
assert(peerReviewSource.includes("prioritizePeerFindings(automatic, 12)"));
assert(!peerReviewSource.includes("The callout list containing 1A through 7"));
assert(!peerReviewSource.includes("Add review note"));
assert(!peerReviewSource.includes('issue: "Drawing callout has no matching main equipment-list item"'));
assert(peerReviewSource.includes("Rule check · confirm source"));
console.log("Peer Review rule tests passed.");
